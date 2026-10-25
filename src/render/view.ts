// Scene orchestration: buildings, roads, trees, lamps, placement preview, picking and
// floating text. Terrain/water, sky/weather/seasons and people live in their own modules.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Game, Bld } from '../sim/game';
import { Tile } from '../sim/world';
import { BUILDINGS, BuildingId, GOODS } from '../sim/data';
import { outlineMat, ramp } from './toon';
import { model, ModelGeo } from './models';
import { getModel } from './assets';
import { CameraRig } from './camera';
import { ENV, worldMaterial } from './shared';
import { Terrain } from './terrain';
import { Env } from './env';
import { People } from './people';
import { Decor } from './decor';
import { Smoke } from './smoke';

interface BView { group: THREE.Group; tier: string; smoke: THREE.Vector3[]; smokeT: number; spins: { o: THREE.Object3D; axis: 'x' | 'z' }[]; bobs: THREE.Object3D[]; born: number; b: Bld }

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  env: Env;
  private game!: Game;
  private terrain!: Terrain;
  private people: People | null = null;
  private decor: Decor | null = null;
  private smoke: Smoke | null = null;
  private pVersion = -1;
  private deposits: THREE.InstancedMesh[] = [];
  private worldMat = worldMaterial();
  private ghostMat = worldMaterial({ transparent: true, opacity: 0.8 });
  private roadMat: THREE.MeshToonMaterial;
  private views = new Map<number, BView>();
  private bVersion = -1; private rVersion = -1; private tVersion = -1;
  private trees: THREE.InstancedMesh[] = [];
  private roads!: THREE.InstancedMesh;
  private lamps!: THREE.InstancedMesh;
  private lampLine!: THREE.InstancedMesh;
  private ghost = new THREE.Group();
  private ghostFoot!: THREE.Mesh;
  private ghostRoads!: THREE.InstancedMesh;
  private floatLayer: HTMLElement;
  private floats: { el: HTMLElement; pos: THREE.Vector3; t: number }[] = [];
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private time = 0;
  half = 0;
  onThunder: (delay: number) => void = () => {};

  constructor(container: HTMLElement, floatLayer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.floatLayer = floatLayer;
    this.rig = new CameraRig(innerWidth / innerHeight);
    this.scene.fog = new THREE.Fog(0xd6eef7, 45, 120);
    this.env = new Env(this.scene);
    this.env.onThunder = d => this.onThunder(d);
    // roads: toon slab that keeps a little colour under snow
    this.roadMat = new THREE.MeshToonMaterial({ color: '#E8D2A2', gradientMap: ramp });
    this.roadMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, ENV);
      sh.fragmentShader = 'uniform float uSnow, uWet;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93,0.95,0.98), uSnow * 0.55);\n diffuseColor.rgb *= 1.0 - uWet * 0.2;');
    };
    // glow at night
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      this.rig.camera.aspect = innerWidth / innerHeight;
      this.rig.camera.updateProjectionMatrix();
    });
  }

  // ---------- world setup ----------
  setGame(game: Game) {
    for (const o of [...this.scene.children]) if (o.userData.world) this.scene.remove(o);
    this.views.clear();
    this.bVersion = this.rVersion = this.tVersion = -1;
    this.game = game;
    this.half = game.W / 2;
    this.terrain = new Terrain(game.world);
    this.add(this.terrain.terrain);
    this.add(this.terrain.water);
    this.decor = new Decor(game, this.terrain, this.half);
    this.add(this.decor.group);
    this.buildTrees();
    this.buildRocks();
    this.buildDeposits();
    this.smoke = new Smoke(this.scene);
    this.pVersion = -1;
    this.buildRoads();
    this.buildGhost();
    this.people = new People(this.scene, game, this.half, b => this.door(b), b => this.facing(b), this.terrain);
    const d = game.world.depot;
    this.rig.target.set(d.x + 1.5 - this.half, 0, d.z - 1 - this.half);
    this.rig.jumpTo(this.rig.target.x, this.rig.target.z);
    this.rig.bounds = this.half;
    if (innerWidth / innerHeight < 1) this.rig.zoom(1.5);
  }
  private add<T extends THREE.Object3D>(o: T) { o.userData.world = true; this.scene.add(o); return o; }

  private instanced(geo: ModelGeo, n: number, lw: number, cast = true) {
    const m = new THREE.InstancedMesh(geo.body, this.worldMat, n);
    const l = new THREE.InstancedMesh(geo.line, outlineMat(lw), n);
    l.instanceMatrix = m.instanceMatrix;
    m.castShadow = cast; m.receiveShadow = true;
    m.frustumCulled = l.frustumCulled = false;
    this.add(m); this.add(l);
    return [m, l] as const;
  }

  private buildTrees() {
    const max = this.game.W * this.game.W;
    this.trees = ['tree_round', 'tree_pine', 'bush'].map(n => {
      const [m, l] = this.instanced(getModel(n), max, 0.02);
      m.userData.line = l;
      return m;
    });
  }
  private syncTrees() {
    const { world, W } = this.game;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const n = [0, 0, 0];
    const put = (k: number, x: number, z: number, r: number, s: number) => {
      V.set(x, 0, z);
      Q.setFromAxisAngle(up, r * 6.28);
      S.set(s, s * (0.9 + ((r * 13) % 1) * 0.3), s);
      M.compose(V, Q, S);
      this.trees[k].setMatrixAt(n[k]++, M);
    };
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const t = world.trees[z * W + x];
      const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, r = h - Math.floor(h);
      const wx = x + 0.5 - this.half, wz = z + 0.5 - this.half;
      if (t) {
        put(t - 1, wx + (r - 0.5) * 0.3, wz + (((r * 7) % 1) - 0.5) * 0.3, r, 0.85 + r * 0.5);
        if (r > 0.7) put(2, wx + 0.35, wz - 0.3, r * 3 % 1, 0.7 + r * 0.3);
      } else if (world.tile(x, z) === Tile.Grass && this.game.occ[z * W + x] === 0 && r < 0.04) {
        put(2, wx, wz, r * 5 % 1, 0.8);
      }
    }
    this.trees.forEach((m, i) => { m.count = n[i]; (m.userData.line as THREE.InstancedMesh).count = n[i]; m.instanceMatrix.needsUpdate = true; });
    this.colorTrees();
    this.syncDeposits();
    this.decor?.sync();
  }

  private buildRocks() {
    const { world, W } = this.game;
    const cells: [number, number][] = [];
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (world.tile(x, z) === Tile.Rock && (x + z * 3) % 2 === 0) cells.push([x, z]);
    if (!cells.length) return;
    const [m] = this.instanced(getModel('rock'), cells.length, 0.025);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    cells.forEach(([x, z], i) => {
      const wx = x + 0.5 - this.half, wz = z + 0.5 - this.half;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 7 + z) % 6);
      const s = 1.0 + ((x * 13 + z * 7) % 5) * 0.15;
      M.compose(new THREE.Vector3(wx, this.terrain.height(wx, wz) - 0.1, wz), Q, new THREE.Vector3(s, s, s));
      m.setMatrixAt(i, M);
    });
  }

  /** little ore and coal outcrops on mineral veins that nothing is built on */
  private buildDeposits() {
    const { world, W } = this.game;
    this.deposits = ['ore_iron', 'ore_coal'].map(n => {
      const [m, l] = this.instanced(getModel(n), W * W, 0.015);
      m.userData.line = l;
      return m;
    });
  }
  private syncDeposits() {
    const { world, W, occ } = this.game;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    const n = [0, 0];
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const k = z * W + x, d = world.deposits[k];
      if (!d || occ[k] !== 0 || (x * 5 + z * 3) % 2) continue;
      const wx = x + 0.5 - this.half, wz = z + 0.5 - this.half;
      const s = 0.9 + ((x * 13 + z * 7) % 5) * 0.1;
      M.compose(new THREE.Vector3(wx, this.terrain.height(wx, wz), wz), Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 3 + z * 5) % 6), S.set(s, s, s));
      this.deposits[d - 1].setMatrixAt(n[d - 1]++, M);
    }
    this.deposits.forEach((m, i) => { m.count = n[i]; (m.userData.line as THREE.InstancedMesh).count = n[i]; m.instanceMatrix.needsUpdate = true; });
  }
  /** trees in smog wither towards brown */
  private colorTrees() {
    const g = this.game, C = new THREE.Color(), M = new THREE.Matrix4(), P = new THREE.Vector3();
    for (const m of this.trees) {
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, M);
        P.setFromMatrixPosition(M);
        const p = g.pollutionAt(P.x + this.half, P.z + this.half);
        const w = Math.min(0.85, Math.max(0, (p - 15) / 50));
        m.setColorAt(i, C.setRGB(1, 1 - w, 1));
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  setPollutionView(on: boolean) { this.terrain.terrainU.uPollOn.value = on ? 1 : 0; }

  private buildRoads() {
    const W = this.game.W;
    const g = new THREE.BoxGeometry(1, 0.06, 1);
    g.translate(0, 0.03, 0);
    this.roads = this.add(new THREE.InstancedMesh(g, this.roadMat, W * W));
    this.roads.receiveShadow = true;
    this.roads.frustumCulled = false;
    this.roads.count = 0;
    const [lm, ll] = this.instanced(getModel('lamp'), 600, 0.012);
    this.lamps = lm; this.lampLine = ll;
    lm.count = ll.count = 0;
  }
  private syncRoads() {
    const { W, occ } = this.game;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
    let n = 0, nl = 0;
    for (let i = 0; i < W * W; i++) if (occ[i] === -1) {
      const x = i % W, z = (i / W) | 0;
      const wx = x + 0.5 - this.half, wz = z + 0.5 - this.half;
      M.makeTranslation(wx, 0, wz);
      this.roads.setMatrixAt(n++, M);
      // a street lamp on every few road tiles, on a side without road
      if ((x * 7 + z * 13) % 5 === 0 && nl < 600) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= W || occ[nz * W + nx] === -1) continue;
          M.compose(new THREE.Vector3(wx + dx * 0.44, 0, wz + dz * 0.44), Q.identity(), S);
          this.lamps.setMatrixAt(nl++, M);
          break;
        }
      }
    }
    this.roads.count = n;
    this.roads.instanceMatrix.needsUpdate = true;
    this.lamps.count = this.lampLine.count = nl;
    this.lamps.instanceMatrix.needsUpdate = true;
  }

  private buildGhost() {
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.ghostFoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.5, depthWrite: false }));
    this.ghostFoot.position.y = 0.07;
    this.ghostFoot.renderOrder = 2;
    this.add(this.ghost);
    this.ghost.add(this.ghostFoot);
    this.ghostRoads = this.add(new THREE.InstancedMesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), new THREE.MeshBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.6, depthWrite: false }), 400));
    this.ghostRoads.count = 0;
    this.ghostRoads.frustumCulled = false;
    this.ghostRoads.renderOrder = 2;
  }

  // ---------- buildings ----------
  facing(b: Pick<Bld, 'x' | 'z' | 'w' | 'h' | 'type'>): number {
    const g = this.game;
    const sides: [number, number[][]][] = [
      [0, Array.from({ length: b.w }, (_, i) => [b.x + i, b.z + b.h])],
      [Math.PI / 2, Array.from({ length: b.h }, (_, j) => [b.x + b.w, b.z + j])],
      [Math.PI, Array.from({ length: b.w }, (_, i) => [b.x + i, b.z - 1])],
      [-Math.PI / 2, Array.from({ length: b.h }, (_, j) => [b.x - 1, b.z + j])],
    ];
    const wantWater = b.type === 'fishery' || b.type === 'depot';
    let best = 0, bestScore = -1;
    for (const [yaw, cells] of sides) {
      let s = 0;
      for (const [x, z] of cells) s += wantWater ? (g.world.tile(x, z) === Tile.Water ? 1 : 0) : (g.isRoad(x, z) ? 1 : 0);
      if (s > bestScore) { bestScore = s; best = yaw; }
    }
    return bestScore > 0 ? best : 0;
  }
  /** where people enter and leave a building: the middle of an edge that touches a road */
  door(b: Bld): THREE.Vector2 {
    const g = this.game;
    const c = g.center(b);
    const cx = c.x - this.half, cz = c.z - this.half;
    let best: THREE.Vector2 | null = null, bd = 1e9;
    g.forEdge(b, (x, z) => {
      if (!g.isRoad(x, z)) return;
      const rx = x + 0.5 - this.half, rz = z + 0.5 - this.half;
      // point halfway between the wall and the road tile centre
      const px = Math.max(b.x - this.half, Math.min(b.x + b.w - this.half, rx));
      const pz = Math.max(b.z - this.half, Math.min(b.z + b.h - this.half, rz));
      const d = Math.hypot(rx - cx, rz - cz);
      if (d < bd) { bd = d; best = new THREE.Vector2((px + rx) / 2, (pz + rz) / 2); }
    });
    if (best) return best;
    const yaw = this.facing(b);
    return new THREE.Vector2(cx + Math.sin(yaw) * (b.h / 2 + 0.2), cz + Math.cos(yaw) * (b.h / 2 + 0.2));
  }

  private makeView(b: Bld): BView {
    const m = model(b.type, b.tier, b.variant);
    const group = new THREE.Group();
    const body = new THREE.Mesh(m.body, this.worldMat);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body, new THREE.Mesh(m.line, outlineMat(0.022)));
    const v: BView = { group, tier: b.tier, born: this.time, b, spins: [], bobs: [], smoke: m.smoke.map(p => new THREE.Vector3(...p)), smokeT: Math.random() };
    for (const a of m.anims) {
      const o = new THREE.Group();
      const ab = new THREE.Mesh(a.geo.body, this.worldMat);
      ab.castShadow = true;
      o.add(ab, new THREE.Mesh(a.geo.line, outlineMat(0.018)));
      o.position.set(...a.at);
      o.userData.base = o.position.y;
      group.add(o);
      if (a.kind === 'bob') v.bobs.push(o); else v.spins.push({ o, axis: a.kind === 'spinX' ? 'x' : 'z' });
    }
    const c = this.game.center(b);
    group.position.set(c.x - this.half, 0, c.z - this.half);
    group.rotation.y = this.facing(b);
    this.add(group);
    return v;
  }
  private syncBuildings() {
    const g = this.game;
    for (const [id, v] of this.views) {
      const b = g.buildings.get(id);
      if (!b) { this.scene.remove(v.group); this.views.delete(id); continue; }
      if (b.tier !== v.tier) { this.scene.remove(v.group); this.views.set(id, this.makeView(b)); }
    }
    for (const b of g.buildings.values()) if (!this.views.has(b.id)) this.views.set(b.id, this.makeView(b));
  }

  // ---------- tool preview ----------
  showGhost(type: BuildingId | null, x = 0, z = 0, ok = true) {
    this.ghost.visible = !!type;
    const U = this.terrain.terrainU;
    if (!type) { U.uRangeOn.value = 0; return; }
    const def = BUILDINGS[type];
    const [w, h] = def.size;
    const key = type === 'house' ? 'house-peasant-0' : type;
    if (this.ghost.userData.key !== key) {
      this.ghost.children.filter(c => c !== this.ghostFoot).forEach(c => this.ghost.remove(c));
      if (type !== 'road') {
        const m = model(type, 'peasant', 0);
        this.ghost.add(new THREE.Mesh(m.body, this.ghostMat), new THREE.Mesh(m.line, outlineMat(0.022)));
        for (const a of m.anims) {
          const am = new THREE.Mesh(a.geo.body, this.ghostMat);
          am.position.set(...a.at);
          this.ghost.add(am);
        }
      }
      this.ghost.userData.key = key;
    }
    this.ghostFoot.scale.set(w, 1, h);
    this.ghostMat.color.setHex(ok ? 0xffffff : 0xff8a80);
    (this.ghostFoot.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0x7ee08a : 0xff7a6e);
    this.ghost.position.set(x + w / 2 - this.half, 0, z + h / 2 - this.half);
    this.ghost.rotation.y = this.facing({ x, z, w, h, type });
    if (def.radius) {
      U.uRangeOn.value = 1;
      U.uRange.value.set(x + w / 2 - this.half, z + h / 2 - this.half, def.radius + (def.service ? 0 : 0.5));
    } else U.uRangeOn.value = 0;
  }
  showRoadPath(tiles: [number, number][] | null, okFn?: (x: number, z: number) => boolean) {
    const M = new THREE.Matrix4();
    let n = 0;
    if (tiles) for (const [x, z] of tiles) {
      if (n >= 400) break;
      if (okFn && !okFn(x, z)) continue;
      M.makeTranslation(x + 0.5 - this.half, 0.04, z + 0.5 - this.half);
      this.ghostRoads.setMatrixAt(n++, M);
    }
    this.ghostRoads.count = n;
    this.ghostRoads.instanceMatrix.needsUpdate = true;
  }
  setGrid(on: boolean) { if (this.terrain) this.terrain.terrainU.uGrid.value = on ? 1 : 0; }
  select(b: Bld | null) {
    const U = this.terrain.terrainU;
    const s = U.uSel.value;
    if (!b) { s.set(0, 0, 0, 0); if (!this.ghost.visible) U.uRangeOn.value = 0; return; }
    const c = this.game.center(b);
    s.set(c.x - this.half, c.z - this.half, b.w, b.h);
    const r = BUILDINGS[b.type].radius;
    if (r) { U.uRangeOn.value = 1; U.uRange.value.set(c.x - this.half, c.z - this.half, this.game.radiusOf(b) + (BUILDINGS[b.type].service ? 0 : 0.5)); }
    else if (!this.ghost.visible) U.uRangeOn.value = 0;
  }

  private groundAt(clientX: number, clientY: number) {
    const v = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(v, this.rig.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, p) ? p : null;
  }
  /** drag the map so the ground point under the cursor stays under the cursor */
  panGrab(x0: number, y0: number, x1: number, y1: number) {
    const a = this.groundAt(x0, y0), b = this.groundAt(x1, y1);
    if (!a || !b) return;
    const dx = a.x - b.x, dz = a.z - b.z;
    if (Math.hypot(dx, dz) > 30) return;
    this.rig.shift(dx, dz);
  }

  pick(clientX: number, clientY: number): { x: number; z: number } | null {
    const v = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(v, this.rig.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return null;
    return { x: Math.floor(p.x + this.half), z: Math.floor(p.z + this.half) };
  }

  floatText(b: Bld, text: string) {
    if (this.floats.length > 40) return;
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    this.floatLayer.appendChild(el);
    const c = this.game.center(b);
    this.floats.push({ el, pos: new THREE.Vector3(c.x - this.half, 1.8, c.z - this.half), t: 0 });
  }

  weatherMix() { return this.env.mix(); }

  /** chimneys: factories smoke while working, homes when cooking (mornings, evenings) or heating */
  private puff(v: BView, gameDt: number) {
    const b = v.b, g = this.game, d = BUILDINGS[b.type];
    let rate = 0, grey = 0.15, size = 1;
    if (b.type === 'house') {
      if (!b.residents) return;
      const h = g.hour;
      const cooking = (h > 6 && h < 8.5) || (h > 17.5 && h < 20);
      rate = g.heatingOn ? (b.warm > 0.4 ? 0.9 : 0) : cooking ? 0.5 : 0.06;
      grey = g.era >= 3 ? 0.35 : 0.1;
      size = 0.75;
    } else {
      if (!b.working) return;
      const pol = d.pollution ?? 0;
      rate = 0.8 + Math.max(0, pol) / 25;
      grey = Math.min(1, 0.12 + Math.max(0, pol) / 45) * Math.max(0.3, 1 + g.mods.pollution);
      size = 0.9 + Math.max(0, pol) / 60;
    }
    v.smokeT += gameDt * rate;
    if (v.smokeT < 1) return;
    v.smokeT -= 1;
    const p = v.smoke[Math.floor(Math.random() * v.smoke.length)].clone();
    p.multiply(v.group.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), v.group.rotation.y).add(v.group.position);
    this.smoke!.emit(p.x, p.y, p.z, grey, size);
  }

  render(dt: number, gameDt: number) {
    const g = this.game;
    this.time += dt;
    if (g.bVersion !== this.bVersion) { this.syncBuildings(); this.bVersion = g.bVersion; this.tVersion = -1; }
    if (g.rVersion !== this.rVersion) { this.syncRoads(); this.rVersion = g.rVersion; this.tVersion = -1; }
    if (g.tVersion !== this.tVersion) { this.syncTrees(); this.tVersion = g.tVersion; }
    if (g.pVersion !== this.pVersion) { this.terrain.setPollution(g.pollution); this.colorTrees(); this.pVersion = g.pVersion; }
    for (const ev of g.events.splice(0)) {
      const b = g.buildings.get(ev.id);
      if (!b) continue;
      this.floatText(b, `+${ev.n} ${GOODS[ev.good].name}`);
      this.people?.produced(b, ev.good);
    }
    for (const v of this.views.values()) {
      const age = this.time - v.born;
      if (age < 0.6) {
        const k = age / 0.6, q = k - 1;
        const s = 1 + 2.4 * q * q * q + 1.4 * q * q;
        v.group.scale.set(Math.min(1, k * 2), Math.max(0.01, s), Math.min(1, k * 2));
      } else if (v.group.scale.y !== 1) v.group.scale.set(1, 1, 1);
      for (const s of v.spins) {
        if (!v.b.working) continue;
        const sp = v.b.type === 'sawmill' ? (s.axis === 'z' ? 7 : 1.4) : 1.4;
        if (s.axis === 'z') s.o.rotation.z -= gameDt * sp; else s.o.rotation.x -= gameDt * sp;
      }
      if (v.smoke.length && gameDt > 0) this.puff(v, gameDt);
      for (const o of v.bobs) { o.position.y = o.userData.base + Math.sin(this.time * 1.8 + v.b.id) * 0.03; o.rotation.z = Math.sin(this.time * 1.3 + v.b.id) * 0.06; }
    }
    this.rig.update(dt);
    this.decor?.setSeason(g.seasonPos);
    this.env.update(dt, g, this.rig.target, this.terrain, this.scene.fog as THREE.Fog);
    this.people?.update(dt, gameDt);
    this.smoke?.update(dt);
    const v3 = new THREE.Vector3();
    this.floats = this.floats.filter(f => {
      f.t += dt;
      if (f.t > 1.4) { f.el.remove(); return false; }
      v3.copy(f.pos); v3.y += f.t * 0.9;
      v3.project(this.rig.camera);
      f.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * innerWidth}px, ${(-v3.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, (1.4 - f.t) * 2.5));
      return true;
    });
    const glow = ENV.uGlow.value;
    if (glow > 0.05) {
      this.bloom.strength = 0.25 + glow * 0.55;
      this.composer.render();
    } else this.renderer.render(this.scene, this.rig.camera);
  }
}
