// Scene: terrain, water, trees, roads, buildings, ghost preview, overlays, floating text.
import * as THREE from 'three';
import { Game, Bld } from '../sim/game';
import { Tile } from '../sim/world';
import { BUILDINGS, BuildingId, GOODS } from '../sim/data';
import { toon, outlineMat, P, merge, Box } from './toon';
import { model, TREE_ROUND, TREE_PINE, ROCK, ModelGeo } from './models';
import { CameraRig } from './camera';

interface BView { group: THREE.Group; tier: string; spin?: THREE.Object3D; bob?: THREE.Object3D; born: number; b: Bld }

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  private game!: Game;
  private bodyMat = toon(0xffffff, { vertexColors: true });
  private ghostMat = toon(0xffffff, { vertexColors: true, transparent: true, opacity: 0.82 });
  private views = new Map<number, BView>();
  private bVersion = -1; private rVersion = -1; private tVersion = -1;
  private terrainU = {
    uGrid: { value: 0 }, uW: { value: 0 },
    uRange: { value: new THREE.Vector3(0, 0, 0) }, uRangeOn: { value: 0 },
    uSel: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  private waterU: Record<string, THREE.IUniform> = {};
  private trees: THREE.InstancedMesh[] = [];
  private treeLines: THREE.InstancedMesh[] = [];
  private roads!: THREE.InstancedMesh;
  private ghost = new THREE.Group();
  private ghostFoot!: THREE.Mesh;
  private ghostRoads!: THREE.InstancedMesh;
  private sun!: THREE.DirectionalLight;
  private clouds: THREE.Group[] = [];
  private floatLayer: HTMLElement;
  private floats: { el: HTMLElement; pos: THREE.Vector3; t: number }[] = [];
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private time = 0;
  half = 0;

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
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.rig.camera.aspect = innerWidth / innerHeight;
      this.rig.camera.updateProjectionMatrix();
    });
    this.buildSky();
  }

  // ---------- world setup ----------
  setGame(game: Game) {
    // clear previous world
    for (const o of [...this.scene.children]) if (o.userData.world) this.scene.remove(o);
    this.views.clear();
    this.bVersion = this.rVersion = this.tVersion = -1;
    this.game = game;
    this.half = game.W / 2;
    this.terrainU.uW.value = game.W;
    this.buildTerrain();
    this.buildWater();
    this.buildTrees();
    this.buildRocks();
    this.buildRoads();
    this.buildGhost();
    const d = game.world.depot;
    this.rig.target.set(d.x + 1.5 - this.half, 0, d.z - 1 - this.half);
    this.rig.jumpTo(this.rig.target.x, this.rig.target.z);
    this.rig.bounds = this.half;
    if (innerWidth / innerHeight < 1) this.rig.zoom(1.5);
  }
  private add(o: THREE.Object3D) { o.userData.world = true; this.scene.add(o); return o; }
  tileToWorld(x: number, z: number) { return new THREE.Vector3(x + 0.5 - this.half, 0, z + 0.5 - this.half); }

  private buildSky() {
    const top = new THREE.Color('#6cb4ec'), hor = new THREE.Color('#d6eef7');
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
      uniforms: { uTop: { value: top }, uHor: { value: hor } }, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 uTop,uHor;varying vec3 vD;\n#include <common>\nvoid main(){gl_FragColor=vec4(mix(uHor,uTop,pow(max(vD.y,0.0),0.6)),1.0);\n#include <colorspace_fragment>\n}',
    }));
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight(0xdcefff, 0x8c9a6a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    // clouds
    const cmat = toon('#ffffff', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.3 });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const k = 3 + (i % 3);
      for (let j = 0; j < k; j++) {
        const r = 1.6 + Math.random() * 1.4;
        const geo = new THREE.SphereGeometry(r, 16, 12);
        const m = new THREE.Mesh(geo, cmat);
        m.add(new THREE.Mesh(geo, outlineMat(0.08, '#9fb3cf')));
        m.position.set((j - k / 2) * 1.8, Math.random() * 0.8, Math.random());
        g.add(m);
      }
      g.scale.set(1, 0.6, 1);
      g.position.set((Math.random() - 0.5) * 140, 22 + Math.random() * 6, (Math.random() - 0.5) * 140);
      g.userData.v = 0.4 + Math.random() * 0.5;
      this.scene.add(g);
      this.clouds.push(g);
    }
  }

  private buildTerrain() {
    const { world, W } = this.game;
    const geo = new THREE.PlaneGeometry(W + 40, W + 40, W + 40, W + 40).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const cols: number[] = [];
    const cGrass = [new THREE.Color('#8fd16a'), new THREE.Color('#9fda76')];
    const cSand = new THREE.Color('#f5e1a8'), cRock = new THREE.Color('#bdb6aa'), cWet = new THREE.Color('#e3cd96');
    const c = new THREE.Color();
    const tileAt = (x: number, z: number) => {
      if (x < 0 || z < 0 || x >= W || z >= W) {
        // outside the map: keep the ocean south, grassy hills elsewhere
        const cz = Math.max(0, Math.min(W - 1, z)), cx = Math.max(0, Math.min(W - 1, x));
        return world.tile(cx, cz) === Tile.Water ? Tile.Water : Tile.Grass;
      }
      return world.tile(x, z);
    };
    for (let i = 0; i < pos.count; i++) {
      const vx = Math.round(pos.getX(i) + this.half), vz = Math.round(pos.getZ(i) + this.half);
      let water = 0, rock = 0, sand = 0;
      for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const t = tileAt(vx + dx, vz + dz);
        if (t === Tile.Water) water++; else if (t === Tile.Rock) rock++; else if (t === Tile.Sand) sand++;
      }
      let y = 0;
      if (water === 4) y = -0.7; else if (water > 0) y = -0.12;
      const outside = vx < 0 || vz < 0 || vx > W || vz > W;
      if (rock) y += rock * 0.22 + (Math.sin(vx * 1.7 + vz) * 0.5 + 0.5) * rock * 0.12;
      if (outside && water === 0) y += Math.min(4, (Math.max(-vx, vx - W, -vz) ) * 0.25) * (0.6 + 0.4 * Math.sin(vx * 0.4 + vz * 0.3));
      pos.setY(i, y);
      if (water === 4) c.copy(cWet);
      else if (rock >= 2) c.copy(cRock);
      else if (sand || water) c.copy(cSand);
      else c.copy(cGrass[(Math.floor(vx / 3) + Math.floor(vz / 3)) & 1]).lerp(cGrass[0], 0.5 + 0.5 * Math.sin(vx * 0.3 + vz * 0.21));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mat = toon(0xffffff, { vertexColors: true });
    const U = this.terrainU;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform float uGrid,uW,uRangeOn;uniform vec3 uRange;uniform vec4 uSel;varying vec3 vWP;\n' + sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec2 gp=vWP.xz+uW*0.5;
        vec2 f=abs(fract(gp)-0.5);
        float inMap=step(0.0,gp.x)*step(0.0,gp.y)*step(gp.x,uW)*step(gp.y,uW);
        float line=smoothstep(0.47,0.5,max(f.x,f.y));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0),line*0.28*uGrid*inMap*step(-0.05,vWP.y));
        float d=distance(vWP.xz,uRange.xy);
        float inside=1.0-smoothstep(uRange.z-0.06,uRange.z,d);
        float ring=smoothstep(uRange.z-0.18,uRange.z-0.06,d)*inside;
        gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.97,0.82),uRangeOn*(inside*0.18+ring*0.6));
        vec2 sd=abs(vWP.xz-uSel.xy)-uSel.zw*0.5;
        float edge=step(max(sd.x,sd.y),0.08)*step(-0.08,max(sd.x,sd.y));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.86,0.35),edge*step(0.01,uSel.z));`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.add(mesh);
  }

  private buildWater() {
    const { world, W } = this.game;
    // distance (in tiles) from each tile to the nearest land, for shore foam
    const dist = new Float32Array(W * W).fill(99);
    const q: number[] = [];
    for (let i = 0; i < W * W; i++) if (world.tiles[i] !== Tile.Water) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % W, z = (k / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
        const n = nz * W + nx;
        if (dist[n] > dist[k] + 1) { dist[n] = dist[k] + 1; q.push(n); }
      }
    }
    const data = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) data[i] = Math.min(255, (dist[i] / 5) * 255);
    const tex = new THREE.DataTexture(data, W, W, THREE.RedFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDist: { value: null }, uTime: { value: 0 }, uW: { value: W },
      uDeep: { value: new THREE.Color('#3f9fd8') }, uShallow: { value: new THREE.Color('#7fd6ef') }, uFoam: { value: new THREE.Color('#ffffff') },
    }]);
    this.waterU.uDist.value = tex;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterU, fog: true,
      vertexShader: `varying vec2 vXZ;
#include <common>
#include <fog_pars_vertex>
void main(){vec4 wp=modelMatrix*vec4(position,1.0);vXZ=wp.xz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D uDist;uniform float uTime,uW;uniform vec3 uDeep,uShallow,uFoam;varying vec2 vXZ;
#include <common>
#include <fog_pars_fragment>
void main(){
  vec2 uv=(vXZ+uW*0.5)/uW;
  float d=texture2D(uDist,uv).r;
  if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) d=1.0;
  vec3 c=mix(uShallow,uDeep,smoothstep(0.1,0.55,d));
  float wob=sin(vXZ.x*1.7+uTime*1.3)*0.025+sin(vXZ.y*1.9-uTime*1.1)*0.025;
  float foam=1.0-step(0.15+0.03*sin(uTime*1.6),d+wob);
  float band=step(0.88,sin(d*30.0-uTime*1.8))*step(d,0.4)*step(0.18,d);
  float rip=step(0.93,sin(vXZ.x*0.9+sin(vXZ.y*0.6+uTime*0.5)*2.2+uTime*0.6)*sin(vXZ.y*1.3-uTime*0.4))*smoothstep(0.3,0.7,d);
  c=mix(c,uFoam,max(foam,max(band*0.55,rip*0.6)));
  gl_FragColor=vec4(c,1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W + 300, W + 300).rotateX(-Math.PI / 2), mat);
    water.position.y = -0.28;
    this.add(water);
  }

  private instanced(geo: ModelGeo, n: number, lw: number, cast = true) {
    const m = new THREE.InstancedMesh(geo.body, this.bodyMat, n);
    const l = new THREE.InstancedMesh(geo.line, outlineMat(lw), n);
    l.instanceMatrix = m.instanceMatrix;
    m.castShadow = cast; m.receiveShadow = true;
    m.frustumCulled = l.frustumCulled = false;
    this.add(m); this.add(l);
    return [m, l] as const;
  }

  private buildTrees() {
    const { W } = this.game;
    const max = W * W;
    this.trees = []; this.treeLines = [];
    for (const g of [TREE_ROUND, TREE_PINE]) {
      const [m, l] = this.instanced(g, max, 0.022);
      this.trees.push(m); this.treeLines.push(l);
    }
  }
  private syncTrees() {
    const { world, W } = this.game;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const n = [0, 0];
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const t = world.trees[z * W + x];
      if (!t) continue;
      const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, r = h - Math.floor(h);
      V.set(x + 0.5 - this.half + (r - 0.5) * 0.3, 0, z + 0.5 - this.half + (((r * 7) % 1) - 0.5) * 0.3);
      Q.setFromAxisAngle(up, r * 6.28);
      const s = 0.8 + r * 0.5;
      S.set(s, s * (0.9 + ((r * 13) % 1) * 0.3), s);
      M.compose(V, Q, S);
      this.trees[t - 1].setMatrixAt(n[t - 1]++, M);
    }
    this.trees.forEach((m, i) => { m.count = n[i]; this.treeLines[i].count = n[i]; m.instanceMatrix.needsUpdate = true; });
  }

  private buildRocks() {
    const { world, W } = this.game;
    const cells: [number, number][] = [];
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (world.tile(x, z) === Tile.Rock && (x + z * 3) % 2 === 0) cells.push([x, z]);
    if (!cells.length) return;
    const [m] = this.instanced(ROCK, cells.length, 0.025);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    cells.forEach(([x, z], i) => {
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 7 + z) % 6);
      const s = 0.9 + ((x * 13 + z * 7) % 5) * 0.12;
      M.compose(new THREE.Vector3(x + 0.5 - this.half, 0.35, z + 0.5 - this.half), Q, new THREE.Vector3(s, s, s));
      m.setMatrixAt(i, M);
    });
  }

  private buildRoads() {
    const { W } = this.game;
    const g = merge([
      P(Box(1, 0.05, 1), { col: '#ecd5a0', at: [0, 0.025, 0] }),
    ]);
    this.roads = new THREE.InstancedMesh(g.body, this.bodyMat, W * W);
    this.roads.receiveShadow = true;
    this.roads.frustumCulled = false;
    this.roads.count = 0;
    this.add(this.roads);
  }
  private syncRoads() {
    const { W, occ } = this.game;
    const M = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < W * W; i++) if (occ[i] === -1) {
      M.makeTranslation((i % W) + 0.5 - this.half, 0, ((i / W) | 0) + 0.5 - this.half);
      this.roads.setMatrixAt(n++, M);
    }
    this.roads.count = n;
    this.roads.instanceMatrix.needsUpdate = true;
  }

  private buildGhost() {
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.ghostFoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.5, depthWrite: false }));
    this.ghostFoot.position.y = 0.07;
    this.ghostFoot.renderOrder = 2;
    this.add(this.ghost);
    this.ghost.add(this.ghostFoot);
    this.ghostRoads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), new THREE.MeshBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.6, depthWrite: false }), 400);
    this.ghostRoads.count = 0;
    this.ghostRoads.frustumCulled = false;
    this.ghostRoads.renderOrder = 2;
    this.add(this.ghostRoads);
  }

  // ---------- per-frame sync ----------
  private facing(b: Bld): number {
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

  private makeView(b: Bld): BView {
    const m = model(b.type, b.tier, b.variant);
    const group = new THREE.Group();
    const body = new THREE.Mesh(m.body, this.bodyMat);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body, new THREE.Mesh(m.line, outlineMat(0.028)));
    const v: BView = { group, tier: b.tier, born: this.time, b };
    if (m.anim) {
      const a = new THREE.Group();
      const ab = new THREE.Mesh(m.anim.geo.body, this.bodyMat);
      ab.castShadow = true;
      a.add(ab, new THREE.Mesh(m.anim.geo.line, outlineMat(0.022)));
      a.position.set(...m.anim.at);
      group.add(a);
      if (m.anim.kind === 'spinZ') v.spin = a; else v.bob = a;
    }
    const c = this.game.center(b);
    group.position.set(c.x - this.half, 0, c.z - this.half);
    group.rotation.y = this.facing(b);
    group.userData.world = true;
    this.scene.add(group);
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
    if (!type) { this.terrainU.uRangeOn.value = 0; return; }
    const def = BUILDINGS[type];
    const [w, h] = def.size;
    const key = type === 'house' ? 'house-peasant-0' : type;
    if (this.ghost.userData.key !== key) {
      this.ghost.children.filter(c => c !== this.ghostFoot).forEach(c => this.ghost.remove(c));
      if (type !== 'road') {
        const m = model(type, 'peasant', 0);
        this.ghost.add(new THREE.Mesh(m.body, this.ghostMat), new THREE.Mesh(m.line, outlineMat(0.028)));
        if (m.anim) {
          const a = new THREE.Mesh(m.anim.geo.body, this.ghostMat);
          a.position.set(...m.anim.at);
          this.ghost.add(a);
        }
      }
      this.ghost.userData.key = key;
    }
    this.ghostFoot.scale.set(w, 1, h);
    const col = ok ? 0x7ee08a : 0xff7a6e;
    this.ghostMat.color.setHex(ok ? 0xffffff : 0xff8a80);
    (this.ghostFoot.material as THREE.MeshBasicMaterial).color.setHex(col);
    this.ghost.position.set(x + w / 2 - this.half, 0, z + h / 2 - this.half);
    this.ghost.rotation.y = 0;
    if (type === 'fishery') {
      const fake = { x, z, w, h, type } as Bld;
      this.ghost.rotation.y = this.facing(fake);
    }
    if (def.radius) {
      this.terrainU.uRangeOn.value = 1;
      this.terrainU.uRange.value.set(x + w / 2 - this.half, z + h / 2 - this.half, def.radius + (def.service ? 0 : 0.5));
    } else this.terrainU.uRangeOn.value = 0;
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
  setGrid(on: boolean) { this.terrainU.uGrid.value = on ? 1 : 0; }
  select(b: Bld | null) {
    const s = this.terrainU.uSel.value;
    if (!b) { s.set(0, 0, 0, 0); if (!this.ghost.visible) this.terrainU.uRangeOn.value = 0; return; }
    const c = this.game.center(b);
    s.set(c.x - this.half, c.z - this.half, b.w, b.h);
    const r = BUILDINGS[b.type].radius;
    if (r) { this.terrainU.uRangeOn.value = 1; this.terrainU.uRange.value.set(c.x - this.half, c.z - this.half, r + (BUILDINGS[b.type].service ? 0 : 0.5)); }
    else if (!this.ghost.visible) this.terrainU.uRangeOn.value = 0;
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
    this.floats.push({ el, pos: new THREE.Vector3(c.x - this.half, 1.6, c.z - this.half), t: 0 });
  }

  render(dt: number) {
    const g = this.game;
    this.time += dt;
    if (g.bVersion !== this.bVersion) { this.syncBuildings(); this.bVersion = g.bVersion; }
    if (g.rVersion !== this.rVersion) { this.syncRoads(); this.rVersion = g.rVersion; }
    if (g.tVersion !== this.tVersion) { this.syncTrees(); this.tVersion = g.tVersion; }
    for (const ev of g.events.splice(0)) {
      const b = g.buildings.get(ev.id);
      if (b) this.floatText(b, `+${ev.n} ${GOODS[ev.good].name}`);
    }
    // building life
    for (const v of this.views.values()) {
      const age = this.time - v.born;
      if (age < 0.6) {
        const k = age / 0.6, q = k - 1;
        const s = 1 + 2.4 * q * q * q + 1.4 * q * q;
        v.group.scale.set(Math.min(1, k * 2), Math.max(0.01, s), Math.min(1, k * 2));
      } else if (v.group.scale.y !== 1) v.group.scale.set(1, 1, 1);
      if (v.spin && v.b.working) v.spin.rotation.z -= dt * (v.b.type === 'sawmill' ? 6 : 1.6) * g.speed;
      if (v.bob) { v.bob.position.y = -0.05 + Math.sin(this.time * 1.8 + v.b.id) * 0.04; v.bob.rotation.z = Math.sin(this.time * 1.3 + v.b.id) * 0.06; }
    }
    this.waterU.uTime.value = this.time;
    for (const c of this.clouds) { c.position.x += dt * c.userData.v; if (c.position.x > 90) c.position.x = -90; }
    this.rig.update(dt);
    // shadow follows the camera target
    const t = this.rig.target;
    this.sun.target.position.copy(t);
    this.sun.position.set(t.x - 18, 34, t.z + 22);
    // floating texts
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
    this.renderer.render(this.scene, this.rig.camera);
  }
}
