// Smooth terrain and water. The game grid stays square, but the land/water boundary is
// interpolated between tile centres so coastlines curve, beaches slope into shallow water,
// and the water shader gets a fine distance-to-shore field for foam and waves.
import * as THREE from 'three';
import { World, Tile } from '../sim/world';
import { ramp } from './toon';
import { ENV } from './shared';

const SUB = 3;          // terrain vertices per tile
const MARGIN = 24;      // extra tiles drawn around the map
const DF = 4;           // distance-field cells per tile
const DF_MARGIN = 16;
export const WATER_Y = -0.28;

export class Terrain {
  W: number;
  half: number;
  private landT: Float32Array;   // smoothed land value per tile (incl. margin)
  private rockT: Float32Array;
  /** rock height per tile (incl. margin), lightly smoothed */
  private heightT: Float32Array;
  private TW: number;            // tiles across incl. margin
  terrainU = {
    uGrid: { value: 0 }, uW: { value: 0 },
    uRange: { value: new THREE.Vector3() }, uRangeOn: { value: 0 },
    uSel: { value: new THREE.Vector4() },
    uGrass: { value: new THREE.Color('#86CC63') },
    uPoll: { value: null as THREE.DataTexture | null }, uPollOn: { value: 0 },
    uRoad: { value: null as THREE.DataTexture | null }, uRoadStyle: { value: 0 },
    uReach: { value: null as THREE.DataTexture | null }, uReachOn: { value: 0 },
  };
  private pollData!: Uint8Array;
  private roadData!: Uint8Array;
  private reachData!: Uint8Array;
  /** occupied land tiles (buildings and roads), in the margin grid: the ground is levelled under them */
  private occT!: Float32Array;
  waterU: Record<string, THREE.IUniform>;
  terrain: THREE.Mesh;
  water: THREE.Mesh;

  /** pollution per tile (0..~100) into the ground texture */
  setPollution(p: Float32Array) {
    const d = this.pollData;
    for (let i = 0; i < p.length; i++) { const v = Math.min(255, p[i] / 60 * 255); d[i * 4] = v; d[i * 4 + 3] = 255; }
    this.terrainU.uPoll.value!.needsUpdate = true;
  }

  constructor(private world: World) {
    const W = world.W;
    this.W = W;
    this.half = W / 2;
    this.TW = W + MARGIN * 2;
    this.terrainU.uW.value = W;
    this.pollData = new Uint8Array(W * W * 4);
    const pt = new THREE.DataTexture(this.pollData, W, W, THREE.RGBAFormat);
    pt.magFilter = THREE.LinearFilter; pt.minFilter = THREE.LinearFilter;
    pt.needsUpdate = true;
    this.terrainU.uPoll.value = pt;
    this.roadData = new Uint8Array(W * W * 4);
    const rt = new THREE.DataTexture(this.roadData, W, W, THREE.RGBAFormat);
    rt.magFilter = THREE.LinearFilter; rt.minFilter = THREE.LinearFilter;
    rt.needsUpdate = true;
    this.terrainU.uRoad.value = rt;
    this.reachData = new Uint8Array(W * W * 4);
    const ct = new THREE.DataTexture(this.reachData, W, W, THREE.RGBAFormat);
    ct.magFilter = THREE.NearestFilter; ct.minFilter = THREE.NearestFilter;
    ct.needsUpdate = true;
    this.terrainU.uReach.value = ct;
    // tile-level fields with margin, then a light blur to round the corners
    const TW = this.TW;
    const raw = new Float32Array(TW * TW), rawR = new Float32Array(TW * TW);
    for (let tz = 0; tz < TW; tz++) for (let tx = 0; tx < TW; tx++) {
      const t = this.tileOut(tx - MARGIN, tz - MARGIN);
      raw[tz * TW + tx] = t === Tile.Water ? 0 : 1;
      rawR[tz * TW + tx] = t === Tile.Rock ? 1 : 0;
    }
    const blur = (src: Float32Array) => {
      const out = new Float32Array(TW * TW);
      for (let z = 0; z < TW; z++) for (let x = 0; x < TW; x++) {
        let s = 0, w = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.min(TW - 1, Math.max(0, x + dx)), nz = Math.min(TW - 1, Math.max(0, z + dz));
          const k = dx === 0 && dz === 0 ? 4 : (dx === 0 || dz === 0 ? 2 : 1);
          s += src[nz * TW + nx] * k; w += k;
        }
        // keep each tile on its own side of 0.5 so the game grid and the picture agree
        const v = s / w, own = src[z * TW + x];
        out[z * TW + x] = own > 0.5 ? Math.max(0.56, v) : Math.min(0.44, v);
      }
      return out;
    };
    this.occT = new Float32Array(TW * TW);
    this.landT = blur(raw);
    this.rockT = blur(rawR);
    // rock heights: maps without a height layer get the old low crags; past the edge the range keeps rising
    const rawH = new Float32Array(TW * TW);
    for (let tz = 0; tz < TW; tz++) for (let tx = 0; tx < TW; tx++) {
      const x = tx - MARGIN, z = tz - MARGIN;
      if (this.tileOut(x, z) !== Tile.Rock) continue;
      const cx = Math.max(0, Math.min(W - 1, x)), cz = Math.max(0, Math.min(W - 1, z));
      const h = world.heights[cz * W + cx] || 0.9;
      const out = Math.max(cx - x, x - cx, cz - z, z - cz);
      rawH[tz * TW + tx] = h + out * 0.35 * (0.6 + 0.4 * Math.sin(x * 0.4 + z * 0.3));
    }
    this.heightT = new Float32Array(TW * TW);
    for (let z = 0; z < TW; z++) for (let x = 0; x < TW; x++) {
      const own = rawH[z * TW + x];
      if (!own) continue;
      let s = 0, n = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const v = rawH[Math.min(TW - 1, Math.max(0, z + dz)) * TW + Math.min(TW - 1, Math.max(0, x + dx))];
        if (v) { s += v; n++; }
      }
      this.heightT[z * TW + x] = own * 0.55 + (s / n) * 0.45;
    }
    this.terrain = this.buildTerrain();
    const { mesh, uniforms } = this.buildWater();
    this.water = mesh;
    this.waterU = uniforms;
  }

  private tileOut(x: number, z: number): Tile {
    const W = this.W;
    if (x >= 0 && z >= 0 && x < W && z < W) return this.world.tile(x, z);
    const cx = Math.max(0, Math.min(W - 1, x)), cz = Math.max(0, Math.min(W - 1, z));
    const t = this.world.tile(cx, cz);
    return t === Tile.Water ? Tile.Water : t === Tile.Rock ? Tile.Rock : Tile.Grass;
  }

  private sample(f: Float32Array, wx: number, wz: number) {
    // world -> tile-centre coordinates in the margin grid
    const fx = wx + this.half + MARGIN - 0.5, fz = wz + this.half + MARGIN - 0.5;
    const TW = this.TW;
    const x0 = Math.max(0, Math.min(TW - 2, Math.floor(fx))), z0 = Math.max(0, Math.min(TW - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - x0)), tz = Math.min(1, Math.max(0, fz - z0));
    const a = f[z0 * TW + x0], b = f[z0 * TW + x0 + 1], c = f[(z0 + 1) * TW + x0], d = f[(z0 + 1) * TW + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  private noise(x: number, z: number) {
    return Math.sin(x * 1.7 + Math.sin(z * 0.9) * 1.3) * Math.cos(z * 1.3 + Math.sin(x * 0.7)) * 0.5;
  }
  /** 0..1, land where >= 0.5 */
  land(wx: number, wz: number) { return this.sample(this.landT, wx, wz) + this.noise(wx, wz) * 0.08; }
  /** ground height, levelled to the street where buildings and roads stand (a little quay on the shore) */
  height(wx: number, wz: number) {
    const y = this.rawHeight(wx, wz);
    return y < 0 ? y * (1 - this.raise(wx, wz)) : y;
  }
  /** 0..1 how much the ground at a point is levelled up to street height */
  raise(wx: number, wz: number) {
    const o = this.sample(this.occT, wx, wz);
    if (o < 0.3) return 0;
    const L = this.land(wx, wz);
    return THREE.MathUtils.smoothstep(o, 0.3, 0.62) * THREE.MathUtils.smoothstep(L, 0.46, 0.53);
  }
  /** street coverage overlay, bit flags: 1 own road, 2 other road of the same kind, 4 covered, 8 uncovered; null hides it */
  setReach(cells: Uint8Array | null) {
    if (!cells) { this.terrainU.uReachOn.value = 0; return; }
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      this.reachData[i * 4] = c & 1 ? 240 : c & 4 ? 120 : 0;
      this.reachData[i * 4 + 1] = c & 2 ? 255 : 0;
      this.reachData[i * 4 + 2] = c & 8 ? 255 : 0;
      this.reachData[i * 4 + 3] = 255;
    }
    this.terrainU.uReach.value!.needsUpdate = true;
    this.terrainU.uReachOn.value = 1;
  }
  /** roads and buildings changed: level the ground under them and repaint the streets */
  setGround(occ: Int32Array, isLandRoad: (i: number) => boolean, roadStyle: number) {
    const W = this.W, TW = this.TW;
    this.occT.fill(0);
    for (let i = 0; i < W * W; i++) {
      const x = i % W, z = (i / W) | 0;
      const road = isLandRoad(i);
      const v = occ[i] > 0 || road ? 1 : 0;
      this.occT[(z + MARGIN) * TW + x + MARGIN] = v;
      this.roadData[i * 4] = road ? 255 : 0; this.roadData[i * 4 + 1] = this.world.deposits[i] === 1 ? 255 : 0; this.roadData[i * 4 + 2] = this.world.deposits[i] === 2 ? 255 : 0; this.roadData[i * 4 + 3] = 255;
    }
    this.terrainU.uRoad.value!.needsUpdate = true;
    this.terrainU.uRoadStyle.value = roadStyle;
    const geo = this.terrain.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const ra = geo.getAttribute('raise') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const raw = this.rawHeight(x, z);
      const r = raw < 0 ? this.raise(x, z) : 0;
      pos.setY(i, raw < 0 ? raw * (1 - r) : raw);
      ra.setX(i, r * Math.min(1, -raw * 6));
    }
    pos.needsUpdate = true; ra.needsUpdate = true;
    geo.computeVertexNormals();
  }
  rawHeight(wx: number, wz: number) {
    const L = this.land(wx, wz);
    let y: number;
    if (L >= 0.62) y = 0;
    else if (L >= 0.5) y = (L - 0.62) * 1.0;
    else y = Math.max(-1.0, -0.12 + (L - 0.5) * 3.2);
    const R = this.sample(this.rockT, wx, wz);
    if (R > 0.05) {
      // rock rises from the edge of its tile: flat ground stays flat, water stays water
      const m = THREE.MathUtils.smoothstep(R, 0.42, 0.64);
      const h = this.sample(this.heightT, wx, wz);
      // crags and gullies: ridged noise that grows with the height of the rock
      const ridge = 0.5 - Math.abs(this.noise(wx * 0.9 + 7, wz * 0.9)) * 2;
      const rough = ridge * 0.9 + this.noise(wx * 1.9, wz * 1.9) * 0.6 + this.noise(wx * 4.1 + 3, wz * 4.1) * 0.3;
      y += m * (h + rough * Math.min(1, h * 0.4) * 0.8) + (Math.sin(wx * 2.3 + wz) * 0.5 + 0.5) * R * 0.12;
    }
    // gentle hills beyond the playable area (land only)
    const ox = Math.max(-this.half - wx, wx - this.half, 0), oz = Math.max(-this.half - wz, 0);
    const out = Math.max(ox, oz);
    if (out > 0 && L >= 0.5) y += Math.min(4, out * 0.22) * (0.6 + 0.4 * Math.sin(wx * 0.35 + wz * 0.27));
    return y;
  }

  private buildTerrain() {
    const size = this.TW, seg = size * SUB;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    const kind = new Float32Array(n * 3); // grass, sand, rock
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const L = this.land(x, z), R = this.sample(this.rockT, x, z);
      pos.setY(i, this.height(x, z));
      const sand = 1 - THREE.MathUtils.smoothstep(L, 0.62, 0.74);
      kind[i * 3] = 1 - sand;
      kind[i * 3 + 1] = sand;
      kind[i * 3 + 2] = THREE.MathUtils.smoothstep(R, 0.35, 0.65);
    }
    geo.setAttribute('kind', new THREE.BufferAttribute(kind, 3));
    geo.setAttribute('raise', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp });
    const U = this.terrainU;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, ENV);
      sh.vertexShader = 'attribute vec3 kind;\nattribute float raise;\nvarying vec3 vKind;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vRaise;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = objectNormal;\nvKind = kind;\nvRaise = raise;');
      sh.fragmentShader = `
uniform float uGrid, uW, uRangeOn, uSnow, uWet, uPollOn, uRoadStyle, uReachOn, uTime;
uniform sampler2D uPoll, uRoad, uReach;
varying float vRaise;
uniform vec3 uRange, uGrass;
uniform vec4 uSel;
varying vec3 vKind;
varying vec3 vWP;
varying vec3 vWN;
float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
float tfbm(vec2 p){ return tn(p) * 0.6 + tn(p * 2.3 + 7.1) * 0.3 + tn(p * 5.1 + 3.3) * 0.1; }
` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  float n1 = sin(vWP.x * 0.31 + vWP.z * 0.21) * 0.5 + 0.5;
  float n2 = sin(vWP.x * 1.7 - vWP.z * 1.3 + sin(vWP.z * 0.8)) * 0.5 + 0.5;
  // hand-painted grass: large soft clumps cut into two or three flat tones, plus small dark flecks
  float clump = tfbm(vWP.xz * 0.45);
  float tone = 1.0 + 0.07 * smoothstep(0.58, 0.62, clump) - 0.07 * smoothstep(0.36, 0.32, clump);
  float patchy = tfbm(vWP.xz * 1.6 + 11.0);
  tone -= 0.05 * smoothstep(0.66, 0.7, patchy);
  vec2 cell = floor(vWP.xz * 7.0);
  float fleck = step(0.93, th(cell)) * step(length(fract(vWP.xz * 7.0) - 0.5), 0.22);
  vec3 grass = uGrass * tone * (0.96 + 0.06 * n1);
  grass = mix(grass, uGrass * 0.78, fleck * 0.8);
  grass = mix(grass, mix(uGrass, vec3(1.0, 0.98, 0.7), 0.35), step(0.965, th(cell + 17.0)) * step(length(fract(vWP.xz * 7.0) - 0.5), 0.16));
  vec3 sand = vec3(0.96, 0.87, 0.64) * (1.0 - 0.04 * step(0.8, sin(vWP.x * 3.0 + tn(vWP.xz * 1.5) * 4.0)));
  vec3 wetSand = vec3(0.86, 0.76, 0.55);
  vec3 under = vec3(0.88, 0.84, 0.66);
  // mountains: layered rock on the steep faces (warm sandstone low down, grey granite higher up),
  // moss and alpine grass on ledges and flat tops, snow on the high crests
  float ny = normalize(vWN).y;
  float hgt = vWP.y;
  float band = tn(vec2(hgt * 3.2 + tn(vWP.xz * 0.35) * 2.5, 0.5));
  vec3 stoneLo = vec3(0.86, 0.74, 0.58), stoneHi = vec3(0.66, 0.64, 0.66);
  vec3 rock = mix(stoneLo, stoneHi, smoothstep(1.4, 3.6, hgt));
  rock *= 0.84 + 0.2 * step(0.5, band) + 0.08 * n2;
  rock = mix(rock, rock * 0.72, smoothstep(0.55, 0.25, ny) * step(0.72, tn(vWP.xz * 2.4 + hgt)));
  // baked hill shading so the relief reads from above, warm on the sunny side
  float hs = clamp(dot(normalize(vWN), normalize(vec3(-0.45, 0.75, 0.5))), 0.0, 1.0);
  rock *= 0.62 + 0.5 * hs;
  rock = mix(rock, rock * vec3(1.05, 0.98, 0.9), hs * 0.5);
  float ledge = step(0.84 + (tn(vWP.xz * 1.3) - 0.5) * 0.12, ny);
  vec3 moss = mix(uGrass * vec3(0.78, 0.8, 0.66), uGrass * vec3(0.72, 0.76, 0.6), smoothstep(2.0, 4.2, hgt)) * (0.78 + 0.25 * hs);
  rock = mix(rock, moss, ledge * (1.0 - smoothstep(4.4, 5.2, hgt)));
  float snowLine = 5.6 + (tn(vWP.xz * 0.4) - 0.5) * 1.2;
  float peakSnow = step(snowLine, hgt) * step(0.45, ny);
  rock = mix(rock, vec3(0.95, 0.97, 1.0) * (0.8 + 0.22 * hs), peakSnow);
  vec3 c = mix(sand, grass, vKind.x);
  c = mix(c, wetSand, smoothstep(-0.02, -0.14, vWP.y) * vKind.y);
  c = mix(c, under, smoothstep(-0.2, -0.45, vWP.y));
  c = mix(c, rock, vKind.z);
  // pollution turns the grass dusty and olive
  float poll = texture2D(uPoll, (vWP.xz + uW * 0.5) / uW).r;
  c = mix(c, vec3(0.64, 0.6, 0.46) * (0.95 + 0.05 * n1), smoothstep(0.15, 0.8, poll) * 0.7 * vKind.x * step(-0.1, vWP.y));
  // levelled ground on the shore becomes a little stone quay
  vec2 qc = floor(vec2(vWP.x * 4.0 + floor(vWP.y * 6.0) * 0.5, vWP.y * 6.0 + vWP.z * 4.0));
  vec3 quay = vec3(0.80, 0.76, 0.69) * (0.9 + 0.12 * th(qc));
  float mortar = step(0.86, fract(vWP.y * 6.0)) + step(0.9, fract(vWP.x * 4.0 + vWP.z * 4.0 + floor(vWP.y * 6.0) * 0.5));
  quay *= 1.0 - 0.18 * clamp(mortar, 0.0, 1.0);
  c = mix(c, quay, smoothstep(0.05, 0.35, vRaise));
  // streets painted into the ground: dirt track, then cobbles, then paving
  vec2 ruv = (vWP.xz + uW * 0.5) / uW;
  vec4 rtex = texture2D(uRoad, ruv);
  float rm = rtex.r;
  // mineral patches: stony ground speckled red (iron) or black (coal)
  vec2 dc = floor(vWP.xz * 6.0);
  c = mix(c, mix(vec3(0.62, 0.55, 0.5), vec3(0.78, 0.45, 0.35), step(0.7, th(dc))), smoothstep(0.45, 0.55, rtex.g) * 0.85);
  c = mix(c, mix(vec3(0.42, 0.40, 0.42), vec3(0.18, 0.17, 0.2), step(0.6, th(dc))), smoothstep(0.45, 0.55, rtex.b) * 0.85);
  float road = smoothstep(0.56, 0.6, rm);
  float kerb = road * (1.0 - smoothstep(0.6, 0.68, rm));
  vec3 dirt = vec3(0.86, 0.75, 0.56) * (0.94 + 0.1 * tn(vWP.xz * 3.0)) * (1.0 - 0.06 * step(0.7, tn(vWP.xz * 9.0)));
  vec2 cs = vWP.xz * 4.5; vec2 ci = floor(cs + vec2(0.5 * mod(floor(cs.y), 2.0), 0.0));
  vec2 cf = fract(cs + vec2(0.5 * mod(floor(cs.y), 2.0), 0.0)) - 0.5;
  float stoneEdge = smoothstep(0.36, 0.48, max(abs(cf.x), abs(cf.y)));
  vec3 cobble = mix(vec3(0.82, 0.78, 0.71) * (0.9 + 0.14 * th(ci)), vec3(0.6, 0.56, 0.52), stoneEdge);
  vec3 paved = vec3(0.70, 0.70, 0.71) * (0.97 + 0.04 * tn(vWP.xz * 6.0));
  vec3 rc = uRoadStyle < 0.5 ? dirt : uRoadStyle < 1.5 ? cobble : paved;
  vec3 kerbC = uRoadStyle < 0.5 ? vec3(0.74, 0.62, 0.45) : uRoadStyle < 1.5 ? vec3(0.66, 0.62, 0.57) : vec3(0.88, 0.87, 0.84);
  rc = mix(rc, kerbC, kerb);
  c = mix(c, rc, road);
  float snowAmt = uSnow * smoothstep(-0.24, -0.1, vWP.y) * (1.0 - 0.25 * vKind.z) * (1.0 - road * 0.4);
  c = mix(c, vec3(0.94, 0.96, 1.0) * (0.96 + 0.04 * n2), snowAmt);
  c *= 1.0 - uWet * 0.14;
  vec4 diffuseColor = vec4(c, opacity);`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
  vec2 gp = vWP.xz + uW * 0.5;
  vec2 f = abs(fract(gp) - 0.5);
  float inMap = step(0.0, gp.x) * step(0.0, gp.y) * step(gp.x, uW) * step(gp.y, uW);
  float line = smoothstep(0.47, 0.5, max(f.x, f.y));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), line * 0.28 * uGrid * inMap * step(-0.05, vWP.y) * step(vWP.y, 0.35));
  // pollution view: clean green, then yellow, orange and smoggy purple
  float pv = texture2D(uPoll, gp / uW).r;
  vec3 heat = pv < 0.33 ? mix(vec3(0.55, 0.85, 0.5), vec3(1.0, 0.86, 0.35), pv / 0.33)
            : pv < 0.66 ? mix(vec3(1.0, 0.86, 0.35), vec3(0.95, 0.45, 0.3), (pv - 0.33) / 0.33)
            : mix(vec3(0.95, 0.45, 0.3), vec3(0.55, 0.3, 0.55), (pv - 0.66) / 0.34);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, heat, uPollOn * inMap * 0.6);
  // street coverage: reached roads glow, covered buildings get a soft wash
  float rv = texture2D(uReach, gp / uW).r;
  float pulse = 0.85 + 0.15 * sin(uTime * 4.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.86, 0.35), uReachOn * inMap * step(0.6, rv) * 0.55 * pulse);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.6, 0.9, 1.0), uReachOn * inMap * step(0.3, rv) * (1.0 - step(0.6, rv)) * 0.45);
  vec3 rq = texture2D(uReach, gp / uW).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.68, 0.28), uReachOn * inMap * step(0.5, rq.g) * (1.0 - step(0.6, rv)) * 0.4);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.45, 0.4), uReachOn * inMap * step(0.5, rq.b) * 0.42);
  float d = distance(vWP.xz, uRange.xy);
  float inside = 1.0 - smoothstep(uRange.z - 0.06, uRange.z, d);
  float ring = smoothstep(uRange.z - 0.18, uRange.z - 0.06, d) * inside;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.97, 0.82), uRangeOn * (inside * 0.18 + ring * 0.6));
  vec2 sd = abs(vWP.xz - uSel.xy) - uSel.zw * 0.5;
  float edge = step(max(sd.x, sd.y), 0.08) * step(-0.08, max(sd.x, sd.y));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.86, 0.35), edge * step(0.01, uSel.z));`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildWater() {
    // fine distance-to-land field (in tiles) via a two-pass chamfer transform
    const N = (this.W + DF_MARGIN * 2) * DF;
    const dist = new Float32Array(N * N);
    const toWorld = (i: number) => (i + 0.5) / DF - DF_MARGIN - this.half;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) dist[z * N + x] = this.land(toWorld(x), toWorld(z)) >= 0.5 ? 0 : 1e6;
    const c1 = 1 / DF, c2 = Math.SQRT2 / DF;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      let v = dist[z * N + x];
      if (x > 0) v = Math.min(v, dist[z * N + x - 1] + c1);
      if (z > 0) { v = Math.min(v, dist[(z - 1) * N + x] + c1); if (x > 0) v = Math.min(v, dist[(z - 1) * N + x - 1] + c2); if (x < N - 1) v = Math.min(v, dist[(z - 1) * N + x + 1] + c2); }
      dist[z * N + x] = v;
    }
    for (let z = N - 1; z >= 0; z--) for (let x = N - 1; x >= 0; x--) {
      let v = dist[z * N + x];
      if (x < N - 1) v = Math.min(v, dist[z * N + x + 1] + c1);
      if (z < N - 1) { v = Math.min(v, dist[(z + 1) * N + x] + c1); if (x < N - 1) v = Math.min(v, dist[(z + 1) * N + x + 1] + c2); if (x > 0) v = Math.min(v, dist[(z + 1) * N + x - 1] + c2); }
      dist[z * N + x] = v;
    }
    const data = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) data[i] = Math.min(255, Math.round(dist[i] / 6 * 255));
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDist: { value: null }, uTime: { value: 0 }, uSpan: { value: N / DF }, uOff: { value: DF_MARGIN + this.half },
      uDeep: { value: new THREE.Color('#2C86C2') }, uMid: { value: new THREE.Color('#3DBFD6') }, uShallow: { value: new THREE.Color('#9BE6DE') }, uFoam: { value: new THREE.Color('#ffffff') },
      uRain: { value: 0 }, uSun: { value: 1 }, uNight: { value: 0 }, uIce: { value: 0 },
    }]);
    uniforms.uDist.value = tex;
    const mat = new THREE.ShaderMaterial({
      uniforms, fog: true, transparent: true, depthWrite: false,
      vertexShader: `varying vec2 vXZ;
#include <common>
#include <fog_pars_vertex>
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vXZ = wp.xz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D uDist; uniform float uTime, uSpan, uOff, uRain, uSun, uNight, uIce; uniform vec3 uDeep, uMid, uShallow, uFoam; varying vec2 vXZ;
#include <common>
#include <fog_pars_fragment>
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
// animated cellular pattern: bright where two cells meet, like light focused by ripples on a sandy floor
float caustic(vec2 p, float t){
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 19.7));
    o = 0.5 + 0.42 * sin(t * (0.6 + o * 0.5) + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return 1.0 - smoothstep(0.0, 0.16, d2 - d1);
}
void main(){
  vec2 uv = (vXZ + uOff) / uSpan;
  float d = texture2D(uDist, uv).r * 6.0;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) d = 6.0;
  float n = vnoise(vXZ * 0.8 + vec2(uTime * 0.05, uTime * 0.03));
  float dn = d + (n - 0.5) * 0.5;
  // three bands of colour: clear lagoon over the sand, turquoise, then deep blue
  vec3 c = mix(uShallow, uMid, smoothstep(0.15, 1.6, dn));
  c = mix(c, uDeep, smoothstep(1.4, 4.2, dn));
  // a darker drop-off line where the sand shelf ends
  c *= 1.0 - 0.08 * smoothstep(1.0, 1.5, dn) * (1.0 - smoothstep(1.5, 2.6, dn));
  // soft light streaks drifting across the surface
  float streak = smoothstep(0.62, 0.72, vnoise(vec2(vXZ.x * 0.35 + uTime * 0.08, vXZ.y * 1.4)));
  c = mix(c, c * 1.1 + 0.03, streak * 0.45 * smoothstep(0.5, 2.0, d));
  // caustics in the shallows
  float shallow = 1.0 - smoothstep(0.3, 2.2, d);
  float ca = caustic(vXZ * 1.1, uTime * 0.9) * 0.6 + caustic(vXZ * 1.9 + 3.1, -uTime * 1.1) * 0.4;
  c += vec3(0.9, 1.0, 0.95) * ca * shallow * 0.15 * (0.35 + 0.65 * uSun) * (1.0 - uIce);
  // waves rolling in: two broken foam lines that run up the beach and fall back
  float run = 0.5 + 0.5 * sin(uTime * 0.7 + n * 3.0);
  float line1 = abs(d - (0.28 + 0.22 * run));
  float line2 = abs(d - mod(0.9 - uTime * 0.18 + n * 0.4, 1.3) - 0.35);
  float brk = smoothstep(0.35, 0.65, vnoise(vXZ * 3.0 + vec2(uTime * 0.2, 0.0)));
  float foamLine = (1.0 - smoothstep(0.025, 0.055, line1)) * (0.6 + 0.4 * brk);
  foamLine = max(foamLine, (1.0 - smoothstep(0.015, 0.05, line2)) * brk * 0.6 * (1.0 - smoothstep(0.6, 1.6, d)));
  // wet glossy band and foam right at the shoreline
  float edge = 1.0 - smoothstep(0.05, 0.13 + 0.05 * sin(uTime * 1.3 + n * 6.0), d);
  float lace = (1.0 - smoothstep(0.1, 0.3, d)) * step(0.55, vnoise(vXZ * 6.0 + uTime * 0.3)) * 0.5;
  // sun glints on open water
  float glint = step(0.93, vnoise(vXZ * 3.2 + vec2(uTime * 0.6, -uTime * 0.4))) * step(0.93, vnoise(vXZ * 2.1 - vec2(uTime * 0.3, uTime * 0.5)));
  // rain rings
  vec2 cell = floor(vXZ * 2.5);
  float h = hash(cell);
  float ring = fract(uTime * 0.9 + h);
  float rd = length(fract(vXZ * 2.5) - 0.5);
  float drop = step(abs(rd - ring * 0.45), 0.035) * (1.0 - ring) * step(h, max(uRain - 0.25, 0.0) * 0.8);
  c *= 1.0 - uRain * 0.15;
  float foam = max(edge * 0.95, max(foamLine, max(lace, max(drop * 0.7, glint * uSun * 0.8 * smoothstep(1.0, 2.5, d)))));
  c = mix(c, uFoam, foam);
  c = mix(c, vec3(0.86, 0.92, 0.96), uIce * 0.35);
  c = mix(c, c * vec3(0.22, 0.3, 0.55), uNight * 0.85);
  // see-through over the sand, opaque out at sea
  float alpha = mix(0.4, 0.95, smoothstep(0.05, 2.4, d));
  gl_FragColor = vec4(c, max(alpha, foam));
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.TW + 300, this.TW + 300).rotateX(-Math.PI / 2), mat);
    mesh.position.y = WATER_Y;
    mesh.renderOrder = 1;
    return { mesh, uniforms };
  }
}
