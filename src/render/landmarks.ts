// Set pieces from the map's landmark list (sim/maps): a lighthouse with a turning beam, an old watchtower,
// a ring of standing stones, a waterfall and a shipwreck. Pure decoration, built from primitives so they
// do not depend on the model file.
import * as THREE from 'three';
import type { World } from '../sim/world';
import type { Landmark } from '../sim/maps';
import { P, merge, Box, Cyl, Ball, Gable, outlineMat, Part } from './toon';
import { worldMaterial, ENV } from './shared';
import { Terrain, WATER_Y } from './terrain';

const WHITE = '#F4EFE6', RED = '#D9534A', STONE = '#B8AEA0', STONE_D = '#8E857A', WOOD = '#8A5A3B', WOOD_D = '#5E3B27', MOSS = '#6FA055';

/** mark some vertices as lit at night (lamp glass, windows) */
function glowing(part: Part) { (part as Part & { glow?: boolean }).glow = true; return part; }
function build(parts: Part[]) {
  const geo = merge(parts);
  const glow = new Float32Array(geo.body.getAttribute('position').count);
  let off = 0;
  for (const p of parts) { const n = p.p.length / 3; if ((p as Part & { glow?: boolean }).glow) glow.fill(1, off, off + n); off += n; }
  geo.body.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
  return geo;
}

function lighthouse() {
  const parts: Part[] = [];
  parts.push(P(Cyl(0.85, 0.95, 0.35, 12), { col: STONE_D, at: [0, 0.17, 0], type: 'cyl' }));
  const H = 3.0, n = 6;
  for (let i = 0; i < n; i++) {
    const r0 = 0.62 - (i / n) * 0.18, r1 = 0.62 - ((i + 1) / n) * 0.18;
    parts.push(P(Cyl(r1, r0, H / n, 14), { col: i % 2 ? RED : WHITE, at: [0, 0.35 + (i + 0.5) * H / n, 0], type: 'cyl' }));
  }
  const top = 0.35 + H;
  parts.push(P(Cyl(0.62, 0.55, 0.14, 14), { col: '#3F3A44', at: [0, top + 0.07, 0], type: 'cyl' }));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push(P(Box(0.04, 0.22, 0.04), { col: '#3F3A44', at: [Math.cos(a) * 0.58, top + 0.25, Math.sin(a) * 0.58] })); }
  parts.push(glowing(P(Cyl(0.34, 0.34, 0.5, 12), { col: '#FFF2B8', at: [0, top + 0.39, 0], type: 'cyl' })));
  parts.push(P(Cyl(0.06, 0.46, 0.42, 12), { col: RED, at: [0, top + 0.85, 0], type: 'cyl' }));
  parts.push(P(Ball(0.08, 8, 6), { col: '#3F3A44', at: [0, top + 1.1, 0], type: 'sphere' }));
  // a window band and the door
  for (let i = 0; i < 3; i++) parts.push(glowing(P(Box(0.14, 0.22, 0.05), { col: '#FFE7A3', at: [0, 1.1 + i * 0.85, 0.56 - i * 0.05] })));
  parts.push(P(Box(0.3, 0.5, 0.05), { col: WOOD_D, at: [0, 0.6, 0.6] }));
  // keeper's cottage
  parts.push(P(Box(1.1, 0.7, 0.8), { col: WHITE, at: [1.2, 0.35, 0.3] }));
  parts.push(P(Gable(0.65, 0.5, 1.2), { col: RED, at: [1.2, 0.95, 0.3], rot: [0, Math.PI / 2, 0] }));
  parts.push(glowing(P(Box(0.2, 0.2, 0.04), { col: '#FFE7A3', at: [1.2, 0.4, 0.72] })));
  return parts;
}

function tower() {
  const parts: Part[] = [];
  // a round stone keep, broken on one side, with ivy and fallen blocks
  const rings = 8;
  for (let i = 0; i < rings; i++) {
    const keep = i < 5 ? 1 : 1 - (i - 4) * 0.22;
    const seg = 14, arc = Math.PI * 2 * keep;
    for (let s = 0; s < seg * keep; s++) {
      const a = s / seg * Math.PI * 2 + (i % 2) * 0.22;
      if (a > arc) break;
      const shade = (s * 7 + i * 3) % 5 === 0 ? STONE_D : STONE;
      parts.push(P(Box(0.42, 0.34, 0.3), { col: shade, at: [Math.cos(a) * 0.75, 0.17 + i * 0.34, Math.sin(a) * 0.75], rot: [0, -a, 0] }));
    }
  }
  for (const [x, z, s] of [[1.4, 0.4, 1], [1.1, -0.9, 0.8], [-1.3, 0.8, 0.7]] as const)
    parts.push(P(Box(0.42 * s, 0.3 * s, 0.32 * s), { col: STONE_D, at: [x, 0.12, z], rot: [0.2, x, 0.3] }));
  for (const [a, y] of [[0.4, 0.5], [1.0, 1.2], [2.6, 0.8], [3.4, 1.6], [4.6, 0.6]] as const)
    parts.push(P(Ball(0.32, 8, 6), { col: MOSS, at: [Math.cos(a) * 0.86, y, Math.sin(a) * 0.86], scale: [1, 1.4, 0.6], type: 'sphere' }));
  // a tattered banner on a pole still standing on the high side
  parts.push(P(Cyl(0.03, 0.03, 1.2, 6), { col: WOOD_D, at: [0.2, 2.9, -0.65], type: 'cyl' }));
  parts.push(P(Box(0.5, 0.3, 0.02), { col: '#E7C15A', at: [0.47, 3.3, -0.65] }));
  return parts;
}

function stones() {
  const parts: Part[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, h = 0.9 + ((i * 5) % 3) * 0.25;
    parts.push(P(Box(0.34, h, 0.22), { col: i % 3 ? STONE : STONE_D, at: [Math.cos(a) * 1.25, h / 2 - 0.05, Math.sin(a) * 1.25], rot: [((i * 3) % 4 - 1.5) * 0.06, -a, ((i * 7) % 5 - 2) * 0.05] }));
  }
  parts.push(P(Box(0.3, 0.8, 0.3), { col: STONE_D, at: [-0.35, 0.4, 0] }));
  parts.push(P(Box(0.3, 0.8, 0.3), { col: STONE_D, at: [0.35, 0.4, 0] }));
  parts.push(P(Box(1.2, 0.22, 0.5), { col: STONE, at: [0, 0.9, 0], rot: [0, 0, 0.05] }));
  parts.push(P(Ball(0.25, 8, 6), { col: MOSS, at: [0.9, 0.15, -0.7], scale: [1.3, 0.6, 1], type: 'sphere' }));
  return parts;
}

function wreck() {
  const parts: Part[] = [];
  // the hull lies on its side in the shallows; ribs show where the planks are gone
  parts.push(P(Box(0.9, 0.5, 2.6), { col: WOOD, at: [0, 0.1, 0], rot: [0, 0, 0.45] }));
  parts.push(P(Box(0.5, 0.4, 0.7), { col: WOOD, at: [0.05, 0.12, 1.55], rot: [0.0, 0, 0.45], scale: [1, 1, 1] }));
  for (let i = 0; i < 4; i++) parts.push(P(Box(0.08, 0.7, 0.08), { col: WOOD_D, at: [-0.45, 0.45, -1.0 + i * 0.4], rot: [0, 0, 0.5] }));
  parts.push(P(Cyl(0.06, 0.07, 2.0, 6), { col: WOOD_D, at: [0.55, 1.1, 0.2], rot: [0, 0, -0.75], type: 'cyl' }));
  parts.push(P(Box(0.8, 0.05, 0.05), { col: WOOD_D, at: [0.95, 1.4, 0.2], rot: [0, 0, -0.75] }));
  parts.push(P(Box(0.02, 0.6, 0.5), { col: '#E9E1D0', at: [1.1, 1.2, 0.2], rot: [0, 0, -0.6] }));
  return parts;
}

/** a ribbon of falling water from a ledge down to the lake, with foam at the foot */
function falls(top: THREE.Vector3, bottom: THREE.Vector3, group: THREE.Group) {
  const seg = 12, w = 0.8;
  const pos: number[] = [], uv: number[] = [];
  const dir = new THREE.Vector3(bottom.x - top.x, 0, bottom.z - top.z);
  const run = dir.length(); dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    // leaves the lip, then falls steeply
    const y = top.y + (bottom.y - top.y) * Math.min(1, t * (0.35 + 0.65 * t) * 1.02);
    const fwd = run * (0.08 + 0.3 * Math.sqrt(t));
    for (const s of [-1, 1]) {
      const ww = w * (0.5 + 0.12 * t);
      pos.push(top.x + dir.x * fwd + side.x * s * ww, y, top.z + dir.z * fwd + side.z * s * ww);
      uv.push((s + 1) / 2, t);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: ENV.uTime, uGlow: ENV.uGlow }]),
    vertexShader: `varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uGlow; varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float col = floor(vUv.x * 9.0);
  float speed = 1.2 + h(vec2(col, 1.0)) * 0.8;
  float streak = fract(vUv.y * 3.0 - uTime * speed + h(vec2(col, 2.0)));
  vec3 c = mix(vec3(0.55, 0.82, 0.95), vec3(1.0), smoothstep(0.55, 0.95, streak));
  c = mix(c, vec3(1.0), smoothstep(0.75, 1.0, vUv.y));
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  c = mix(c, c * vec3(0.3, 0.38, 0.6), uGlow * 0.8);
  gl_FragColor = vec4(c, 0.85 * edge);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 2;
  group.add(m);
  // foam puffs bobbing at the foot
  const fg = new THREE.IcosahedronGeometry(0.22, 1);
  fg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(fg.getAttribute('position').count * 3).fill(1), 3));
  const foam = new THREE.InstancedMesh(fg, worldMaterial(), 9);
  const M = new THREE.Matrix4();
  const ex = top.x + dir.x * run * 0.38, ez = top.z + dir.z * run * 0.38;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39, r = 0.25 + (i % 3) * 0.22;
    M.compose(new THREE.Vector3(ex + Math.cos(a) * r, WATER_Y + 0.02, ez + Math.sin(a) * r * 0.7), new THREE.Quaternion(), new THREE.Vector3(1, 0.5, 1).multiplyScalar(0.8 + (i % 4) * 0.2));
    foam.setMatrixAt(i, M);
  }
  foam.userData.base = bottom.clone();
  group.add(foam);
  return foam;
}

export class Landmarks {
  group = new THREE.Group();
  private beam?: THREE.Group;
  private beamMat?: THREE.MeshBasicMaterial;
  private foam: THREE.InstancedMesh[] = [];
  private t = 0;

  constructor(world: World, terrain: Terrain, half: number) {
    const mat = worldMaterial();
    for (const l of world.landmarks as Landmark[]) {
      const wx = l.x + 0.5 - half, wz = l.z + 0.5 - half;
      if (l.kind === 'falls') { this.addFalls(world, terrain, half, l); continue; }
      const parts = l.kind === 'lighthouse' ? lighthouse() : l.kind === 'tower' ? tower() : l.kind === 'stones' ? stones() : l.kind === 'wreck' ? wreck() : null;
      if (!parts) continue;
      const geo = build(parts);
      const body = new THREE.Mesh(geo.body, mat), line = new THREE.Mesh(geo.line, outlineMat(0.03));
      body.castShadow = body.receiveShadow = true;
      const obj = new THREE.Group();
      obj.add(body, line);
      // stand on the lowest point under the footprint so nothing floats
      let y = Infinity;
      for (const [dx, dz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) y = Math.min(y, terrain.height(wx + dx, wz + dz));
      if (l.kind === 'wreck') y = WATER_Y - 0.15;
      obj.position.set(wx, y, wz);
      // face the open side: the lighthouse looks out to sea, the rest get a fixed turn
      obj.rotation.y = l.kind === 'lighthouse' ? Math.atan2(wx, wz) : (l.x * 7 + l.z * 3) % 6;
      this.group.add(obj);
      if (l.kind === 'lighthouse') this.addBeam(obj, 0.35 + 3.0 + 0.39);
    }
  }

  private addBeam(obj: THREE.Group, y: number) {
    const g = new THREE.Group();
    this.beamMat = new THREE.MeshBasicMaterial({ color: '#FFF1B0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const s of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 12, 16, 1, true), this.beamMat);
      cone.rotation.z = s * Math.PI / 2;
      cone.position.x = s * 6.2;
      g.add(cone);
    }
    g.position.y = y;
    obj.add(g);
    this.beam = g;
  }

  private addFalls(world: World, terrain: Terrain, half: number, l: Landmark) {
    // walk from the ledge towards the nearest lake tile
    const W = world.W;
    let best: [number, number] | null = null, bd = 1e9;
    for (let z = l.z - 4; z <= l.z + 4; z++) for (let x = l.x - 4; x <= l.x + 4; x++) {
      if (x < 0 || z < 0 || x >= W || z >= W || world.tiles[z * W + x] !== 2) continue;
      const d = Math.hypot(x - l.x, z - l.z);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    if (!best) return;
    const tx = l.x + 0.5 - half, tz = l.z + 0.5 - half;
    const bx = best[0] + 0.5 - half, bz = best[1] + 0.5 - half;
    // the lip: the highest point on the way down
    const top = new THREE.Vector3(tx, terrain.height(tx, tz) + 0.05, tz);
    const bottom = new THREE.Vector3(bx, WATER_Y, bz);
    this.foam.push(falls(top, bottom, this.group));
  }

  update(dt: number) {
    this.t += dt;
    if (this.beam && this.beamMat) {
      this.beam.rotation.y += dt * 0.9;
      this.beamMat.opacity = ENV.uGlow.value * 0.1;
      this.beam.visible = ENV.uGlow.value > 0.02;
    }
    const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    for (const f of this.foam) {
      for (let i = 0; i < f.count; i++) {
        f.getMatrixAt(i, M); M.decompose(V, Q, S);
        const k = 0.8 + (i % 4) * 0.2 + Math.sin(this.t * 3 + i * 1.7) * 0.15;
        S.set(k, k * 0.5, k);
        M.compose(V, Q, S); f.setMatrixAt(i, M);
      }
      f.instanceMatrix.needsUpdate = true;
    }
  }
}
