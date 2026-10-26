// Draws the fixed map "暖港湾" (src/sim/maps/harbor.ts) from a handful of shapes: coast, river, lake,
// mountains, forests, ore veins. The output is a plain character grid, so it can be hand-edited
// afterwards and read by any engine (see the legend in src/sim/maps/index.ts).
// Usage: node tools/maps/harbor.mjs [preview.png]   (the preview needs python3 + Pillow)
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const W = 96, SEED = 2026;
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const segDist = (px, pz, [ax, az], [bx, bz]) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};
const lineDist = (px, pz, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(px, pz, pts[i - 1], pts[i])); return d; };

// ---- shapes ----
/** south coast: a sheltered bay for the harbour, a western headland, the eastern cape, and the east sea */
const coastZ = x => 75 + (fbm(x * 0.09, 3.3, SEED) - 0.5) * 11
  + 8 * bump(x, 18, 6)              // 西岬 western headland
  - 13 * bump(x, 49, 8)           // 暖港湾 the harbour bay
  + 13 * bump(x, 67, 4.5)           // 东岬 the eastern cape
  - 0.11 * Math.max(0, x - 77) ** 2;  // 东海 the east sea
/** 清溪 runs from the northern hills into the bay */
const RIVER = [[31, -2], [33, 9], [29, 20], [31, 28], [35, 37], [34, 47], [37, 55], [36, 63], [34, 72]];
/** 镜湖 in the north-west, draining into the river */
const LAKE = { x: 14, z: 24, r: 6 };
const STREAM = [[19, 26], [24, 27], [30, 26]];
/** 北岭 north ridge and the north-east massif 东山 */
const rockAt = (x, z) => {
  const n = fbm(x * 0.12, z * 0.12, SEED + 21);
  if (z < 1 + fbm(x * 0.07, 1.7, SEED + 9) * 12) return true;
  if (Math.hypot(x - 80, z - 12) < 9 + (n - 0.5) * 8) return true;
  if (x < 2 + n * 5 && z < 62) return true;
  // a few outcrops
  if (Math.hypot(x - 52, z - 20) < 2.2 + n * 1.5) return true;
  if (Math.hypot(x - 22, z - 44) < 1.8 + n * 1.5) return true;
  return false;
};
const ISLET = { x: 85, z: 80, r: 3.6 };
/** ore veins: 2x2 patches (top-left corners). Iron for era 2, coal for era 3. */
const VEINS = [
  { kind: 'i', name: '东原铁矿', at: [[61, 35], [64, 37], [60, 39]] },
  { kind: 'i', name: '西岭铁矿', at: [[7, 44], [9, 48], [6, 51]] },
  { kind: 'c', name: '东山煤矿', at: [[68, 17], [70, 21], [66, 22]] },
  { kind: 'c', name: '北岭煤矿', at: [[42, 10], [46, 11], [44, 14]] },
];

// ---- rasterise ----
const T = Array.from({ length: W }, () => Array(W).fill('.'));
const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < W && z < W) T[z][x] = c; };
const get = (x, z) => (x >= 0 && z >= 0 && x < W && z < W) ? T[z][x] : '~';
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  const n = fbm(x * 0.2, z * 0.2, SEED + 3);
  let c = '.';
  if (rockAt(x, z)) c = '^';
  const rw = lineDist(x, z, RIVER), hw = 1.15 + Math.max(0, z - 40) / 60 + (n - 0.5) * 0.5;
  if (rw < hw) c = '=';
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + (n - 0.5) * 3.5) c = '=';
  if (lineDist(x, z, STREAM) < 0.9) c = '=';
  if (z > coastZ(x)) c = Math.hypot(x - ISLET.x, (z - ISLET.z) * 1.3) < ISLET.r + (n - 0.5) * 2 ? (n > 0.55 ? '^' : '.') : '~';
  T[z][x] = c;
}
// where the river meets the sea, it is sea
{
  const mouth = [];
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (T[z][x] === '=' && (get(x, z + 1) === '~' || get(x + 1, z) === '~' || get(x - 1, z) === '~')) mouth.push([x, z]);
  for (const [x, z] of mouth) T[z][x] = '~';
}
// beaches along the sea
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  if (T[z][x] !== '.') continue;
  let sea = false;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, z + dz) === '~' && z + dz < W) sea = true;
  if (sea) T[z][x] = ':';
}
// the harbour: a 3x3 on the bay shore whose middle faces open water
let depot = null;
for (let dx = 0; dx < 8 && !depot; dx++) for (const sx of [48 + dx, 48 - dx]) {
  for (let z = W - 4; z > 40; z--) {
    let land = true;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if ('.:'.indexOf(get(sx + i, z + j)) < 0) land = false;
    if (land && get(sx + 1, z + 3) === '~') { depot = [sx, z]; break; }
  }
  if (depot) break;
}
if (!depot) throw new Error('no harbour spot');
// forests
const rnd = (x, z, s) => hash(x, z, SEED + s);
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  if (T[z][x] !== '.') continue;
  if (Math.hypot(x - depot[0] - 1, z - depot[1] - 1) < 7) continue;
  const f = fbm(x * 0.11 + 40, z * 0.11, SEED + 5), r = rnd(x, z, 1);
  let nearRock = false;
  for (let dz = -3; dz <= 3 && !nearRock; dz++) for (let dx = -3; dx <= 3; dx++) if (get(x + dx, z + dz) === '^' && z + dz >= 0) { nearRock = true; break; }
  let p = 0.02;
  if (x < 30 && z > 30 && z < 74) p = f > 0.42 ? 0.85 : 0.25;                   // 西林 the western woods
  if (Math.hypot(x - 57, z - 51) < 7.5) p = 0.8;                                // 东林 the grove east of the harbour
  if (x >= 37 && x < 46 && z >= 38 && z < 55) p = f > 0.4 ? 0.8 : 0.35;          // 河畔林 the woods along the river
  if (x >= 46 && x < 76 && z >= 18 && z < 44) p = f > 0.62 ? 0.6 : 0.015;        // 东原 open meadow for farms
  if (nearRock) p = Math.max(p, 0.55);
  if (x > 62 && z > 54 && x < 74) p = Math.max(p, f > 0.5 ? 0.5 : 0.08);         // the cape
  if (r < p) T[z][x] = (nearRock || rnd(x, z, 2) < 0.4) ? 'p' : 't';
}
// ore veins: clear the ground under each patch
for (const v of VEINS) for (const [x, z] of v.at) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
  const c = get(x + i, z + j);
  if (c === '=' || c === '~' || c === '^') throw new Error(`${v.name} patch ${x},${z} is on ${c}`);
  set(x + i, z + j, v.kind);
}
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) set(depot[0] + i, depot[1] + j, 'H');

const rows = T.map(r => r.join(''));
const out = `// 暖港湾 — the fixed map. Generated by tools/maps/harbor.mjs, then free to hand-edit.
// Legend in ./index.ts. ${W}x${W}, row 0 is the north edge, the sea is to the south and east.
export const HARBOR_ROWS = [
${rows.map(r => `  '${r}',`).join('\n')}
];
`;
writeFileSync(new URL('../../src/sim/maps/harbor.ts', import.meta.url), out);
console.log('depot', depot, 'rows', rows.length);
const counts = {}; for (const r of rows) for (const ch of r) counts[ch] = (counts[ch] ?? 0) + 1;
console.log(counts);
if (process.argv[2]) {
  const py = `
import sys
from PIL import Image
rows=sys.stdin.read().split()
col={'.':(140,190,100),':':(235,215,160),'~':(60,120,190),'=':(90,160,215),'^':(130,125,120),'t':(60,130,60),'p':(40,95,60),'i':(190,90,60),'c':(40,40,40),'H':(230,60,60)}
W=len(rows); s=8
im=Image.new('RGB',(W*s,W*s))
for z,r in enumerate(rows):
  for x,ch in enumerate(r):
    for j in range(s):
      for i in range(s): im.putpixel((x*s+i,z*s+j),col[ch])
im.save(sys.argv[1])`;
  execFileSync('python3', ['-c', py, process.argv[2]], { input: rows.join('\n') });
}
