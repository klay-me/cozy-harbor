// Small ground detail: swaying grass tufts, seasonal wildflowers, pebbles and shoreline reeds.
// Placement is deterministic per tile and refreshed when buildings or roads change.
import * as THREE from 'three';
import type { Game } from '../sim/game';
import { Tile } from '../sim/world';
import { ramp } from './toon';
import { ENV, worldMaterial } from './shared';
import type { Terrain } from './terrain';

const hash = (x: number, z: number, k: number) => { const h = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };

/** a tuft: four thin blades leaning outwards; `shade` runs from dark roots to light tips */
function tuftGeometry() {
  const pos: number[] = [], shade: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4 * (i % 2), lean = 0.05 + 0.03 * (i % 2);
    const cx = Math.cos(a), cz = Math.sin(a), h = 0.16 + 0.06 * ((i * 7) % 3) / 2;
    const w = 0.035;
    pos.push(cx * 0.02 - cz * w, 0, cz * 0.02 + cx * w, cx * 0.02 + cz * w, 0, cz * 0.02 - cx * w, cx * lean, h, cz * lean);
    shade.push(0.78, 0.78, 1.18);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1));
  return g;
}

function flowerGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.IcosahedronGeometry(0.035, 0);
    s.scale(1, 0.6, 1);
    s.translate(Math.cos(i * 2.1) * 0.05, 0.1 + i * 0.025, Math.sin(i * 2.1) * 0.05);
    parts.push(s.toNonIndexed());
  }
  const pos: number[] = [];
  for (const p of parts) pos.push(...(p.getAttribute('position').array as Float32Array));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  return g;
}

function pebbleGeometry() {
  const g = new THREE.IcosahedronGeometry(0.06, 0).toNonIndexed();
  g.scale(1.2, 0.55, 1);
  g.translate(0, 0.02, 0);
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.getAttribute('position').count * 3).fill(0.78), 3));
  return g;
}

const FLOWER_COLS = ['#FF9FB2', '#FFE07A', '#FFFFFF', '#C7A6F2', '#FF7A6E', '#9DD3FF'].map(c => new THREE.Color(c));

export class Decor {
  private tufts: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private pebbles: THREE.InstancedMesh;
  private flowerScale = { value: 1 };
  group = new THREE.Group();

  constructor(private game: Game, private terrain: Terrain, private half: number) {
    const W = game.W;
    // tufts and reeds share a wind-swayed material coloured from the season's grass colour
    const tm = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, vertexColors: true, side: THREE.DoubleSide });
    const grassU = terrain.terrainU.uGrass;
    tm.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, ENV, { uGrass: grassU });
      sh.vertexShader = 'attribute float shade;\nuniform vec3 uGrass;\nuniform float uTime, uSnow;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  vec3 ip = instanceMatrix[3].xyz;
  float sway = sin(uTime * 1.8 + ip.x * 0.6 + ip.z * 0.4) * 0.5 + sin(uTime * 3.1 + ip.x * 1.7) * 0.2;
  transformed.x += sway * position.y * 0.35;
  transformed.z += sway * position.y * 0.15;`)
        .replace('#include <color_vertex>', `
  vColor = uGrass * shade;
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor.rgb;
  #endif
  vColor = mix(vColor, vec3(0.95, 0.97, 1.0), uSnow * 0.85 * smoothstep(0.9, 1.2, shade));`);
    };
    this.tufts = new THREE.InstancedMesh(tuftGeometry(), tm, W * W * 5);
    this.tufts.receiveShadow = true;
    this.tufts.frustumCulled = false;
    // flowers shrink away through autumn and are gone in winter
    const fm = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, vertexColors: true });
    const fs = this.flowerScale;
    fm.onBeforeCompile = sh => {
      sh.uniforms.uFlower = fs;
      sh.vertexShader = 'uniform float uFlower;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed *= uFlower;');
    };
    this.flowers = new THREE.InstancedMesh(flowerGeometry(), fm, W * W);
    this.flowers.frustumCulled = false;
    this.pebbles = new THREE.InstancedMesh(pebbleGeometry(), worldMaterial(), W * W);
    this.pebbles.receiveShadow = true;
    this.pebbles.frustumCulled = false;
    this.group.add(this.tufts, this.flowers, this.pebbles);
    this.group.userData.world = true;
  }

  /** flowers by season: 1 in spring, fading through autumn, none in winter */
  setSeason(seasonPos: number) {
    const s = seasonPos % 4;
    const v = s < 2 ? 1 - Math.max(0, s - 1) * 0.25 : s < 3 ? 0.75 - (s - 2) * 0.75 : s > 3.8 ? (s - 3.8) * 5 : 0;
    this.flowerScale.value = Math.max(0.001, v);
    this.flowers.visible = v > 0.01;
  }

  sync() {
    const g = this.game, W = g.W, t = this.terrain;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    let nt = 0, nf = 0, np = 0;
    const waterNear = (x: number, z: number) => {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (g.world.tile(x + dx, z + dz) === Tile.Water) return true;
      return false;
    };
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const tile = g.world.tile(x, z);
      if (tile === Tile.Water || tile === Tile.Rock) continue;
      if (g.occ[z * W + x] !== 0) continue;
      const bx = x + 0.5 - this.half, bz = z + 0.5 - this.half;
      const shore = waterNear(x, z);
      const meadow = Math.sin(x * 0.37 + Math.sin(z * 0.21) * 2) * Math.cos(z * 0.29 + x * 0.11);
      if (tile === Tile.Grass || shore) {
        const n = shore ? 4 : 2 + Math.floor(hash(x, z, 1) * 4);
        for (let i = 0; i < n; i++) {
          let px = bx + (hash(x, z, 10 + i) - 0.5) * 0.9, pz = bz + (hash(x, z, 20 + i) - 0.5) * 0.9;
          let reed = false;
          if (shore && i < 3) {
            // reeds lean out toward the water's edge
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.world.tile(x + dx, z + dz) === Tile.Water) { px = bx + dx * 0.42 + (hash(x, z, 30 + i) - 0.5) * 0.5 * (dx === 0 ? 1 : 0.2); pz = bz + dz * 0.42 + (hash(x, z, 40 + i) - 0.5) * 0.5 * (dz === 0 ? 1 : 0.2); reed = true; break; }
          }
          const y = t.height(px, pz);
          if (y < -0.3) continue;
          const sc = reed ? 1.4 + hash(x, z, 50 + i) * 0.6 : 0.8 + hash(x, z, 60 + i) * 0.6;
          V.set(px, y, pz);
          Q.setFromAxisAngle(up, hash(x, z, 70 + i) * 6.28);
          S.set(reed ? 0.8 : sc, reed ? sc * 2.2 : sc, reed ? 0.8 : sc);
          M.compose(V, Q, S);
          this.tufts.setMatrixAt(nt, M);
          const v = reed ? 0.82 : 0.9 + hash(x, z, 80 + i) * 0.2;
          this.tufts.setColorAt(nt, col.setRGB(v * (reed ? 0.95 : 1), v, v * (reed ? 0.8 : 1)));
          nt++;
        }
      }
      if (tile === Tile.Grass && hash(x, z, 2) < 0.12 + Math.max(0, meadow) * 0.5) {
        const k = 1 + Math.floor(hash(x, z, 3) * 2);
        for (let i = 0; i < k; i++) {
          const px = bx + (hash(x, z, 90 + i) - 0.5) * 0.8, pz = bz + (hash(x, z, 95 + i) - 0.5) * 0.8;
          M.compose(V.set(px, t.height(px, pz), pz), Q.setFromAxisAngle(up, hash(x, z, 99 + i) * 6), S.set(1, 1, 1));
          this.flowers.setMatrixAt(nf, M);
          this.flowers.setColorAt(nf, FLOWER_COLS[Math.floor(hash(x, z, 4 + i) * FLOWER_COLS.length)]);
          nf++;
        }
      }
      if ((tile === Tile.Sand && hash(x, z, 5) < 0.55) || (tile === Tile.Grass && hash(x, z, 5) < 0.04)) {
        const k = tile === Tile.Sand ? 1 + Math.floor(hash(x, z, 6) * 3) : 1;
        for (let i = 0; i < k; i++) {
          const px = bx + (hash(x, z, 110 + i) - 0.5) * 0.85, pz = bz + (hash(x, z, 120 + i) - 0.5) * 0.85;
          const s = 0.6 + hash(x, z, 130 + i) * 0.9;
          M.compose(V.set(px, t.height(px, pz), pz), Q.setFromAxisAngle(up, hash(x, z, 140 + i) * 6), S.set(s, s, s));
          this.pebbles.setMatrixAt(np, M);
          const gv = 0.85 + hash(x, z, 150 + i) * 0.3;
          this.pebbles.setColorAt(np, col.setRGB(gv, gv * 0.98, gv * 0.94));
          np++;
        }
      }
    }
    for (const [m, n] of [[this.tufts, nt], [this.flowers, nf], [this.pebbles, np]] as const) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
