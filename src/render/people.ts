// Life in town: villagers walking the roads (commutes, errands, evening walks), carts hauling
// goods to storage, idle shoppers at markets and fishing boats heading out to sea.
// Purely visual: the simulation does not depend on any of this.
import * as THREE from 'three';
import type { Game, Bld } from '../sim/game';
import type { GoodId } from '../sim/data';
import { BUILDINGS, familyOf } from '../sim/data';
import { getModel } from './assets';
import { worldMaterial } from './shared';
import { outlineMat } from './toon';
import type { Terrain } from './terrain';
import { WATER_Y } from './terrain';

const MAX_WALK = 220, MAX_CART = 40, MAX_BOAT = 24;
const CLOTHES = ['#F2766B', '#6FA8DC', '#8FCF6F', '#F7B955', '#B58BD8', '#F2A5C0', '#5FB7B0', '#EFE6D2'].map(c => new THREE.Color(c));
const CARGO: Record<GoodId, THREE.Color> = {
  wood: new THREE.Color('#B87A48'), planks: new THREE.Color('#F2CF93'), fish: new THREE.Color('#8CC8EA'),
  veg: new THREE.Color('#8FCF6F'), grain: new THREE.Color('#F2CF5B'), flour: new THREE.Color('#FFF6E3'), bread: new THREE.Color('#D9944F'),
  wool: new THREE.Color('#FFFAF0'), firewood: new THREE.Color('#A86E44'), clay: new THREE.Color('#D98A5F'), bricks: new THREE.Color('#D9674F'),
  cloth: new THREE.Color('#E9B8D6'), clothes: new THREE.Color('#7FB6E0'), ore: new THREE.Color('#8C8F9C'), tools: new THREE.Color('#C9CCD6'),
  coal: new THREE.Color('#4A4752'), steel: new THREE.Color('#B9C2CF'), cans: new THREE.Color('#F2766B'), beer: new THREE.Color('#F2C14E'),
  cement: new THREE.Color('#C9C4BB'), appliances: new THREE.Color('#F2F4F8'),
};
const HEADS = ['villager_head', 'villager_head_straw', 'villager_head_cap', 'villager_head_bun'];

interface Walker {
  pts: THREE.Vector2[]; i: number; s: number; speed: number;
  head: number; tint: number; phase: number;
  cart?: GoodId;
  idle?: { cx: number; cz: number; r: number; until: number; pause: number };
  x: number; z: number; yaw: number;
}
interface Boat { fishery: number; home: THREE.Vector2; out: THREE.Vector2; t: number; x: number; z: number; yaw: number; phase: number }

type DoorFn = (b: Bld) => THREE.Vector2;
type FacingFn = (b: Bld) => number;

export class People {
  private walkers: Walker[] = [];
  private boats = new Map<number, Boat>();
  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh[] = [];
  private carts: THREE.InstancedMesh;
  private cargo: THREE.InstancedMesh;
  private boatMesh: THREE.InstancedMesh;
  private group = new THREE.Group();
  private pathCache = new Map<string, [number, number][] | null>();
  private cacheKey = '';
  private lastHour = -1;
  private errandAcc = 0;
  private pending: { at: number; a: Bld; b: Bld; head: number }[] = [];

  constructor(scene: THREE.Scene, private game: Game, private half: number, private door: DoorFn, private facing: FacingFn, private terrain: Terrain) {
    const mat = worldMaterial();
    const inst = (name: string, n: number, lw: number, cast = true) => {
      const m = getModel(name);
      const body = new THREE.InstancedMesh(m.body, mat, n);
      const line = new THREE.InstancedMesh(m.line, outlineMat(lw), n);
      line.instanceMatrix = body.instanceMatrix;
      body.castShadow = cast;
      body.frustumCulled = line.frustumCulled = false;
      body.count = line.count = 0;
      this.group.add(body, line);
      return body;
    };
    this.bodies = inst('villager_body', MAX_WALK, 0.012);
    this.bodies.setColorAt(0, CLOTHES[0]);
    for (const h of HEADS) this.heads.push(inst(h, MAX_WALK, 0.012));
    this.carts = inst('cart', MAX_CART, 0.012);
    this.cargo = inst('cart_cargo', MAX_CART, 0.012);
    this.cargo.setColorAt(0, CARGO.wood);
    this.boatMesh = inst('boat', MAX_BOAT, 0.018);
    this.group.userData.world = true;
    scene.add(this.group);
  }

  dispose(scene: THREE.Scene) { scene.remove(this.group); }

  // ---------- paths ----------
  private roadNeighbours(b: Bld): number[] {
    const g = this.game, out: number[] = [];
    g.forEdge(b, (x, z) => { if (g.world.inside(x, z) && g.netRoads[z * g.W + x]) out.push(z * g.W + x); });
    return out;
  }
  private route(a: Bld, b: Bld): [number, number][] | null {
    const key = `${a.id}>${b.id}`;
    if (this.pathCache.has(key)) return this.pathCache.get(key)!;
    const g = this.game, W = g.W;
    const starts = this.roadNeighbours(a), goals = new Set(this.roadNeighbours(b));
    let res: [number, number][] | null = null;
    if (starts.length && goals.size) {
      const prev = new Int32Array(W * W).fill(-2);
      const q: number[] = [];
      for (const s of starts) { prev[s] = -1; q.push(s); }
      let found = -1;
      for (let h = 0; h < q.length; h++) {
        const k = q[h];
        if (goals.has(k)) { found = k; break; }
        const x = k % W, z = (k / W) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
          const n = nz * W + nx;
          if (prev[n] !== -2 || !g.netRoads[n]) continue;
          prev[n] = k; q.push(n);
        }
      }
      if (found >= 0) {
        res = [];
        for (let k = found; k !== -1; k = prev[k]) res.push([k % W, (k / W) | 0]);
        res.reverse();
      }
    }
    this.pathCache.set(key, res);
    return res;
  }
  private trip(a: Bld, b: Bld): THREE.Vector2[] | null {
    const r = this.route(a, b);
    if (!r) return null;
    const pts = [this.door(a)];
    for (const [x, z] of r) pts.push(new THREE.Vector2(x + 0.5 - this.half, z + 0.5 - this.half));
    pts.push(this.door(b));
    return pts;
  }

  private spawn(a: Bld, b: Bld, opts: Partial<Walker> = {}) {
    if (this.walkers.length >= MAX_WALK) return;
    if (opts.cart && this.walkers.filter(w => w.cart).length >= MAX_CART) return;
    const pts = this.trip(a, b);
    if (!pts || pts.length < 2) return;
    this.walkers.push({
      pts, i: 0, s: 0, speed: 0.9 + Math.random() * 0.35, head: Math.floor(Math.random() * 4), tint: Math.floor(Math.random() * CLOTHES.length),
      phase: Math.random() * 6, x: pts[0].x, z: pts[0].y, yaw: 0, ...opts,
    });
  }

  /** a production building finished a unit: send a cart to the nearest storage */
  produced(b: Bld, good: GoodId) {
    const g = this.game, c = g.center(b);
    let best: Bld | null = null, bd = 1e9;
    for (const s of g.buildings.values()) {
      if (!BUILDINGS[s.type].storage) continue;
      const sc = g.center(s), d = Math.hypot(sc.x - c.x, sc.z - c.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (best && Math.random() < 0.8) this.spawn(b, best, { cart: good, speed: 0.75, head: 2 });
  }

  update(dt: number, gameDt: number) {
    const g = this.game;
    const key = `${g.bVersion}:${g.rVersion}`;
    if (key !== this.cacheKey) { this.pathCache.clear(); this.cacheKey = key; }
    this.schedule(gameDt);
    this.move(gameDt);
    this.updateBoats(gameDt);
    this.draw();
  }

  // ---------- who goes where ----------
  private schedule(gameDt: number) {
    const g = this.game;
    const h = g.hour, hourInt = Math.floor(h);
    const houses: Bld[] = [], works: Bld[] = [], fun: Bld[] = [];
    for (const b of g.buildings.values()) {
      if (!b.connected) continue;
      if (b.type === 'house' && b.residents > 0) houses.push(b);
      else if (b.type === 'market' || b.type === 'tavern' || b.type === 'bakery' || b.type === 'church' || b.type === 'park' || b.type === 'theatre' || b.type === 'school') fun.push(b);
      if (b.staff > 0) works.push(b);
    }
    if (!houses.length) return;
    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    // commutes at 6:00 and 17:00, spread over the next two hours via a delay queue
    if (hourInt !== this.lastHour) {
      if (hourInt === 6 || hourInt === 17) {
        for (const w of works) {
          const n = Math.max(1, Math.round(w.staff * 3));
          for (let k = 0; k < n; k++) {
            const home = pick(houses);
            const head = w.type === 'farm' ? 1 : 2;
            this.pending.push({ at: g.time + Math.random() * 40, a: hourInt === 6 ? home : w, b: hourInt === 6 ? w : home, head });
          }
        }
      }
      this.lastHour = hourInt;
    }
    this.pending = this.pending.filter(p => {
      if (g.time < p.at) return true;
      if (g.buildings.has(p.a.id) && g.buildings.has(p.b.id)) this.spawn(p.a, p.b, { head: p.head });
      return false;
    });
    // errands through the day, evening outings, quiet nights
    const pop = g.pop.peasant + g.pop.worker + g.pop.technician + g.pop.citizen;
    const rate = h < 5.5 || h > 22 ? 0.02 : h < 8 ? 0.4 : h < 17 ? 0.7 : h < 21 ? 0.9 : 0.25;
    this.errandAcc += gameDt * rate * Math.min(pop, 160) / 40;
    while (this.errandAcc >= 1) {
      this.errandAcc -= 1;
      const home = pick(houses);
      const dest = fun.length && Math.random() < 0.65 ? pick(fun) : pick(houses);
      if (dest !== home) Math.random() < 0.5 ? this.spawn(home, dest) : this.spawn(dest, home);
    }
    // shoppers milling around each market during the day
    for (const m of g.buildings.values()) {
      if (m.type !== 'market' || !m.connected) continue;
      const want = h > 7.5 && h < 19.5 ? 4 : 0;
      const have = this.walkers.filter(w => w.idle && w.idle.cx === g.center(m).x - this.half).length;
      if (have < want && this.walkers.length < MAX_WALK) {
        const c = g.center(m);
        const cx = c.x - this.half, cz = c.z - this.half;
        this.walkers.push({ pts: [], i: 0, s: 0, speed: 0.4, head: Math.floor(Math.random() * 4), tint: Math.floor(Math.random() * CLOTHES.length), phase: 0,
          x: cx + (Math.random() - 0.5) * 1.2, z: cz + (Math.random() - 0.5) * 1.2, yaw: Math.random() * 6,
          idle: { cx, cz, r: 0.75, until: g.time + 40 + Math.random() * 60, pause: Math.random() * 2 } });
      }
    }
  }

  private move(dt: number) {
    const g = this.game;
    this.walkers = this.walkers.filter(w => {
      if (w.idle) {
        if (g.time > w.idle.until || g.hour > 20) return false;
        if (w.idle.pause > 0) { w.idle.pause -= dt; return true; }
        if (!w.pts.length) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * w.idle.r;
          w.pts = [new THREE.Vector2(w.x, w.z), new THREE.Vector2(w.idle.cx + Math.cos(a) * r, w.idle.cz + Math.sin(a) * r)];
          w.i = 0; w.s = 0;
        }
      }
      if (w.i >= w.pts.length - 1) {
        if (w.idle) { w.pts = []; w.idle.pause = 1 + Math.random() * 3; return true; }
        return false;
      }
      let step = w.speed * dt;
      while (step > 0 && w.i < w.pts.length - 1) {
        const a = w.pts[w.i], b = w.pts[w.i + 1];
        const len = a.distanceTo(b);
        const left = len - w.s;
        if (step < left) { w.s += step; step = 0; }
        else { step -= left; w.i++; w.s = 0; }
      }
      const a = w.pts[Math.min(w.i, w.pts.length - 1)], b = w.pts[Math.min(w.i + 1, w.pts.length - 1)];
      const len = Math.max(1e-4, a.distanceTo(b));
      const dx = (b.x - a.x) / len, dz = (b.y - a.y) / len;
      const lane = w.idle ? 0 : 0.2;
      w.x = a.x + dx * w.s - dz * lane;
      w.z = a.y + dz * w.s + dx * lane;
      if (len > 1e-3) {
        const target = Math.atan2(dx, dz);
        let d = target - w.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        w.yaw += d * Math.min(1, dt * 10);
      }
      w.phase += dt * w.speed * (w.cart ? 6 : 9);
      return true;
    });
  }

  private updateBoats(dt: number) {
    const g = this.game;
    const seen = new Set<number>();
    for (const f of g.buildings.values()) {
      if (familyOf(f.type) !== 'fishery') continue;
      seen.add(f.id);
      let b = this.boats.get(f.id);
      if (!b) {
        const c = g.center(f), cx = c.x - this.half, cz = c.z - this.half;
        const yaw = this.facing(f);
        const dir = new THREE.Vector2(Math.sin(yaw), Math.cos(yaw));
        const home = new THREE.Vector2(cx, cz).addScaledVector(dir, 1.9);
        b = { fishery: f.id, home, out: home.clone(), t: Math.random() * 30, x: home.x, z: home.y, yaw: Math.atan2(dir.x, dir.y), phase: Math.random() * 6 };
        this.pickFishingSpot(b, dir);
        this.boats.set(f.id, b);
      }
      const active = f.working && g.night < 0.7;
      b.t += dt * (active ? 1 : 0);
      b.phase += dt;
      // 0..1 out, hold, back: a 40 second loop
      const cyc = (b.t % 40) / 40;
      const k = cyc < 0.35 ? cyc / 0.35 : cyc < 0.65 ? 1 : 1 - (cyc - 0.65) / 0.35;
      const e = k * k * (3 - 2 * k);
      const nx = b.home.x + (b.out.x - b.home.x) * e, nz = b.home.y + (b.out.y - b.home.y) * e;
      if (Math.hypot(nx - b.x, nz - b.z) > 1e-3) b.yaw = Math.atan2(nx - b.x, nz - b.z);
      b.x = nx; b.z = nz;
      if (cyc > 0.99 && Math.random() < 0.5) {
        const dir = b.out.clone().sub(b.home).normalize();
        this.pickFishingSpot(b, dir);
      }
    }
    for (const id of [...this.boats.keys()]) if (!seen.has(id)) this.boats.delete(id);
  }
  private pickFishingSpot(b: Boat, dir: THREE.Vector2) {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 1.6;
      const r = 3 + Math.random() * 5;
      const x = b.home.x + Math.cos(a) * r, z = b.home.y + Math.sin(a) * r;
      if (this.terrain.land(x, z) < 0.35 && this.terrain.land((x + b.home.x) / 2, (z + b.home.y) / 2) < 0.45) { b.out.set(x, z); return; }
    }
    b.out.copy(b.home);
  }

  // ---------- rendering ----------
  private draw() {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
    const headCount = [0, 0, 0, 0];
    let nb = 0, nc = 0;
    const scale = 0.82;
    for (const w of this.walkers) {
      const hop = Math.abs(Math.sin(w.phase)) * (w.idle && w.idle.pause > 0 ? 0 : 0.07);
      const squash = 1 - 0.07 * Math.cos(w.phase * 2) * (w.idle && w.idle.pause > 0 ? 0 : 1);
      E.set(0, w.yaw, Math.sin(w.phase) * 0.06);
      Q.setFromEuler(E);
      V.set(w.x, hop, w.z);
      S.set(scale * (2 - squash), scale * squash, scale * (2 - squash));
      M.compose(V, Q, S);
      this.bodies.setMatrixAt(nb, M);
      this.bodies.setColorAt(nb, CLOTHES[w.tint]);
      nb++;
      const hm = this.heads[w.head];
      hm.setMatrixAt(headCount[w.head]++, M);
      if (w.cart) {
        // cart rolls in front of the walker
        V.set(w.x + Math.sin(w.yaw) * 0.38, 0, w.z + Math.cos(w.yaw) * 0.38);
        Q.setFromEuler(E.set(0, w.yaw + Math.PI / 2, 0));
        S.set(1, 1, 1);
        M.compose(V, Q, S);
        this.carts.setMatrixAt(nc, M);
        this.cargo.setMatrixAt(nc, M);
        this.cargo.setColorAt(nc, CARGO[w.cart]);
        nc++;
      }
    }
    const fix = (m: THREE.InstancedMesh, n: number) => {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      const line = this.group.children[this.group.children.indexOf(m) + 1] as THREE.InstancedMesh;
      line.count = n;
    };
    fix(this.bodies, nb);
    this.heads.forEach((h, i) => fix(h, headCount[i]));
    fix(this.carts, nc);
    fix(this.cargo, nc);
    let n = 0;
    for (const b of this.boats.values()) {
      Q.setFromEuler(E.set(Math.sin(b.phase * 1.4) * 0.05, b.yaw, Math.sin(b.phase * 1.1) * 0.07));
      V.set(b.x, WATER_Y + 0.02 + Math.sin(b.phase * 1.8) * 0.03, b.z);
      M.compose(V, Q, S.set(1, 1, 1));
      this.boatMesh.setMatrixAt(n++, M);
    }
    fix(this.boatMesh, n);
  }
}
