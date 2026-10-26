// Usage: node tools/check-models.mjs [path/to/town.glb] [--strict]
// Reports the complete atlas in model-local game coordinates (X / Y-up / Z).
// Warnings describe the current rest pose, including boats and other moving meshes;
// no animation sweep or outline thickness is included. --strict fails on warnings.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { build } from 'esbuild';
import { Matrix4, Vector3 } from 'three';
import { stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Match assets.ts: remove the top-level model transform, retain all child transforms.
 * Accessor.getElement decodes normalized quantized positions before the matrix transform.
 */
export function measureNode(node, modelRoot = node) {
  const inverse = new Matrix4().fromArray(modelRoot.getWorldMatrix()).invert();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const element = [], point = new Vector3();
  let vertices = 0;
  node.traverse(child => {
    const matrix = new Matrix4().multiplyMatrices(inverse, new Matrix4().fromArray(child.getWorldMatrix()));
    for (const primitive of child.getMesh()?.listPrimitives() ?? []) {
      const positions = primitive.getAttribute('POSITION');
      if (!positions) continue;
      const indices = primitive.getIndices();
      for (let i = 0, count = indices?.getCount() ?? positions.getCount(); i < count; i++) {
        positions.getElement(indices ? indices.getScalar(i) : i, element);
        point.fromArray(element).applyMatrix4(matrix);
        for (let axis = 0; axis < 3; axis++) {
          const value = point.getComponent(axis);
          if (!Number.isFinite(value)) throw new Error(`Non-finite position in ${child.getName()}`);
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
        vertices++;
      }
    }
  });
  return vertices ? { min, max, size: max.map((v, i) => v - min[i]) } : null;
}

export function footprintWarnings(bounds, size) {
  const warnings = [];
  for (const [axis, span, label] of [[0, size[0], 'X'], [2, size[1], 'Z']]) {
    const outside = Math.max(0, -span / 2 - bounds.min[axis], bounds.max[axis] - span / 2);
    if (outside > 0.05 + 1e-6) warnings.push(`${label}超界 ${outside.toFixed(3)}`);
    if (bounds.size[axis] < span * 0.85 - 1e-6) warnings.push(`${label}偏小 ${((1 - bounds.size[axis] / span) * 100).toFixed(1)}%`);
  }
  return warnings;
}

async function main() {
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL('../src/sim/data.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const { BUILDINGS, TIERS } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
  const path = process.argv.slice(2).find(a => !a.startsWith('--'))
    ?? fileURLToPath(new URL('../public/models/town.glb', import.meta.url));
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
  const roots = doc.getRoot().getDefaultScene()?.listChildren() ?? [];
  const models = new Map(roots.map(n => [n.getName(), n]));
  const hasDoors = roots.some(root => {
    let found = false;
    root.traverse(n => { if (n.getMesh() && /^(?:p_)?doorframe(?:[._]|$)/.test(n.getName())) found = true; });
    return found;
  });
  console.log('坐标：模型局部 XZ，1 单位 = 1 格；Y 向上，正面 +Z。含动画部件的静止姿态，不含描边或运动扫掠。');
  console.log('阈值：任一边超出占地 >0.05，或 X/Z 总宽比占地小 >15%，标记 ⚠；既有警告不自动修复。');
  console.log(hasDoors ? '门高：doorframe / p_doorframe 网格的实际 Y 高度（含父级缩放）。' : '门高：未保留 doorframe 网格名，跳过此列。');
  let warnings = 0, missing = 0, count = 0;
  for (const [type, def] of Object.entries(BUILDINGS)) {
    if (!def.model) continue;
    // house is a runtime alias, not a missing atlas root: models.ts selects 4 variants per tier.
    const names = def.model === 'house'
      ? Object.keys(TIERS).flatMap(tier => Array.from({ length: 4 }, (_, i) => `house_${tier}_${i}`))
      : [def.model];
    for (const name of names) {
      count++;
      const root = models.get(name);
      const bounds = root && measureNode(root);
      if (!bounds) { console.log(`❌ ${type}/${name} size=${def.size.join('×')} 缺少模型或网格`); missing++; continue; }
      const anims = [], smoke = [], doors = [];
      root.traverse(n => {
        if (/^(spinz|spinx|spiny|swingx|swingz|flag|bob)_/.test(n.getName())) anims.push(n.getName());
        if (n.getName().startsWith('smoke_')) smoke.push(n.getName());
        if (n.getMesh() && /^(?:p_)?doorframe(?:[._]|$)/.test(n.getName())) {
          const door = measureNode(n, root);
          if (door) doors.push(door.size[1].toFixed(3));
        }
      });
      const issues = footprintWarnings(bounds, def.size);
      if (issues.length) warnings++;
      const f = n => n.toFixed(3);
      console.log(`${issues.length ? '⚠' : '✓'} ${type}/${name} size=${def.size.join('×')} XZ=${f(bounds.size[0])}×${f(bounds.size[2])} X=[${f(bounds.min[0])},${f(bounds.max[0])}] Z=[${f(bounds.min[2])},${f(bounds.max[2])}] topY=${f(bounds.max[1])}${hasDoors ? ` doorH=[${doors.join(',') || '—'}]` : ''} anim=[${anims.join(',') || '—'}] smoke=[${smoke.join(',') || '—'}]${issues.length ? ` ${issues.join('；')}` : ''}`);
    }
  }
  console.log(`合计：${count} 项，${warnings} 项 ⚠，${missing} 项缺失。`);
  const { size } = await stat(path);
  console.log(`town.glb: ${size} bytes (${(size / 1e6).toFixed(3)} MB / ${(size / 1024 / 1024).toFixed(3)} MiB)${size > 6e6 ? ' ⚠ 超过 6MB' : ''}`);
  if (missing || (process.argv.includes('--strict') && (warnings || size > 6e6))) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
