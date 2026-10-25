import { World, Tile } from './world';
import {
  BUILDINGS, BuildingId, GOOD_IDS, GoodId, GOODS, TIERS, TierId, ServiceId, SERVICES,
  UPGRADE_COST, START, REFUND, MAP_SIZE, WEATHER, WeatherId,
} from './data';

export interface Bld {
  id: number;
  type: BuildingId;
  x: number; z: number; w: number; h: number;
  variant: number;
  // production
  progress: number;
  staff: number;      // 0..1 share of required workers present
  env: number;        // 0..1 environment factor (trees nearby)
  working: boolean;
  status: string;
  connected: boolean;
  // housing
  tier: TierId;
  residents: number;
  happy: number;
  needs: { label: string; value: number }[];
  growT: number;
}

export interface ProdEvent { id: number; good: GoodId; n: number }
export interface Toast { text: string; kind: 'info' | 'warn' | 'good' }

export interface Quest { text: string; reward: number; planks?: number; done: (g: Game) => boolean }
export const QUESTS: Quest[] = [
  { text: '修路连通港口，建 3 座农舍', reward: 300, planks: 10, done: g => g.count('house', true) >= 3 },
  { text: '在水边建一座渔场', reward: 200, planks: 6, done: g => g.count('fishery', true) >= 1 },
  { text: '建一座集市，覆盖住宅', reward: 200, done: g => g.count('market', true) >= 1 },
  { text: '人口达到 40', reward: 300, done: g => g.pop.peasant + g.pop.worker >= 40 },
  { text: '建伐木场和锯木厂，自产木板', reward: 300, done: g => g.count('lumberjack', true) >= 1 && g.count('sawmill', true) >= 1 },
  { text: '把一座农舍升级为工人住宅', reward: 300, done: g => [...g.buildings.values()].some(b => b.type === 'house' && b.tier === 'worker') },
  { text: '建立面包链：麦田 → 磨坊 → 面包房', reward: 400, done: g => g.count('farm', true) >= 1 && g.count('mill', true) >= 1 && g.count('bakery', true) >= 1 },
  { text: '建一座酒馆', reward: 300, done: g => g.count('tavern', true) >= 1 },
  { text: '工人达到 80 人', reward: 0, done: g => g.pop.worker >= 80 },
];

const STEP = 0.25;

export class Game {
  world: World;
  W: number;
  occ: Int32Array;               // 0 empty, -1 road, >0 building id
  buildings = new Map<number, Bld>();
  nextId = 1;
  gold = START.gold;
  storage: Record<GoodId, number>;
  supply: Record<GoodId, number>;
  cap = 0;
  time = 0;
  speed = 1;
  questIndex = 0;
  pop = { peasant: 0, worker: 0 };
  workforce = { peasant: { have: 0, need: 0 }, worker: { have: 0, need: 0 } };
  taxRate = 0;
  upkeepRate = 0;
  netRoads = new Uint8Array(0);
  // change counters for the renderer
  bVersion = 0; rVersion = 0; tVersion = 0;
  events: ProdEvent[] = [];
  sfx: string[] = [];
  weather = { cur: 'sunny' as WeatherId, prev: 'sunny' as WeatherId, blend: 1, left: 120 };
  toasts: Toast[] = [];
  private acc = 0;
  private questT = 0;

  constructor(seed: number) {
    this.world = new World(MAP_SIZE, seed);
    this.W = MAP_SIZE;
    this.occ = new Int32Array(this.W * this.W);
    this.storage = {} as any; this.supply = {} as any;
    GOOD_IDS.forEach(g => { this.storage[g] = START.goods[g] ?? 0; this.supply[g] = 1; });
    const d = this.world.depot;
    this.addBuilding('depot', d.x, d.z);
    this.refresh();
  }

  // ---------- queries ----------
  count(type: BuildingId, connected = false) {
    let n = 0;
    this.buildings.forEach(b => { if (b.type === type && (!connected || b.connected)) n++; });
    return n;
  }
  at(x: number, z: number): Bld | undefined {
    if (!this.world.inside(x, z)) return;
    const o = this.occ[z * this.W + x];
    return o > 0 ? this.buildings.get(o) : undefined;
  }
  isRoad(x: number, z: number) { return this.world.inside(x, z) && this.occ[z * this.W + x] === -1; }
  center(b: Bld) { return { x: b.x + b.w / 2, z: b.z + b.h / 2 }; }
  sizeOf(type: BuildingId) { return BUILDINGS[type].size; }
  canAfford(c: { gold: number; planks?: number }) { return this.gold >= c.gold && this.storage.planks >= (c.planks ?? 0); }

  canPlace(type: BuildingId, x: number, z: number): { ok: boolean; reason?: string } {
    const def = BUILDINGS[type];
    const [w, h] = def.size;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, tz = z + j;
      if (!this.world.inside(tx, tz)) return { ok: false, reason: '超出地图' };
      const t = this.world.tile(tx, tz);
      if (t === Tile.Water) return { ok: false, reason: '不能建在水上' };
      if (t === Tile.Rock) return { ok: false, reason: '岩石地无法建造' };
      if (this.occ[tz * this.W + tx] !== 0) return { ok: false, reason: '这里已经有东西了' };
    }
    if (def.needs === 'water' && !this.touchesWater(x, z, w, h)) return { ok: false, reason: '渔场必须紧挨水边' };
    if (!this.canAfford(def.cost)) return { ok: false, reason: this.gold < def.cost.gold ? '金币不够' : '木板不够' };
    return { ok: true };
  }

  touchesWater(x: number, z: number, w: number, h: number) {
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      if (i >= 0 && i < w && j >= 0 && j < h) continue;
      if (this.world.tile(x + i, z + j) === Tile.Water) return true;
    }
    return false;
  }

  treesAround(b: Bld, r: number) {
    const c = this.center(b);
    let n = 0;
    for (let z = Math.floor(c.z - r - 1); z <= c.z + r; z++) for (let x = Math.floor(c.x - r - 1); x <= c.x + r; x++) {
      if (!this.world.inside(x, z)) continue;
      const i = z * this.W + x;
      if (this.world.trees[i] && this.occ[i] === 0 && Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) <= r + 0.5) n++;
    }
    return n;
  }

  // ---------- actions ----------
  place(type: BuildingId, x: number, z: number): boolean {
    const chk = this.canPlace(type, x, z);
    if (!chk.ok) { this.notify(chk.reason!, 'warn'); return false; }
    const def = BUILDINGS[type];
    this.gold -= def.cost.gold;
    this.storage.planks -= def.cost.planks ?? 0;
    this.addBuilding(type, x, z);
    this.refresh();
    this.sfx.push('place');
    return true;
  }

  private addBuilding(type: BuildingId, x: number, z: number) {
    const [w, h] = BUILDINGS[type].size;
    const id = this.nextId++;
    const b: Bld = {
      id, type, x, z, w, h, variant: (x * 7 + z * 13) % 4,
      progress: 0, staff: 0, env: 1, working: false, status: '', connected: false,
      tier: 'peasant', residents: 0, happy: 0, needs: [], growT: 0,
    };
    this.buildings.set(id, b);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (z + j) * this.W + x + i;
      this.occ[k] = id;
      if (this.world.trees[k]) { this.world.trees[k] = 0; this.tVersion++; }
    }
    this.bVersion++;
    return b;
  }

  roadPath(ax: number, az: number, bx: number, bz: number) {
    const out: [number, number][] = [];
    const sx = Math.sign(bx - ax) || 1, sz = Math.sign(bz - az) || 1;
    const horizFirst = Math.abs(bx - ax) >= Math.abs(bz - az);
    if (horizFirst) {
      for (let x = ax; x !== bx + sx; x += sx) out.push([x, az]);
      for (let z = az + sz; z !== bz + sz; z += sz) out.push([bx, z]);
    } else {
      for (let z = az; z !== bz + sz; z += sz) out.push([ax, z]);
      for (let x = ax + sx; x !== bx + sx; x += sx) out.push([x, bz]);
    }
    return out;
  }
  roadTileOk(x: number, z: number) {
    if (!this.world.inside(x, z)) return false;
    const t = this.world.tile(x, z);
    return t !== Tile.Water && t !== Tile.Rock && this.occ[z * this.W + x] === 0;
  }
  placeRoads(tiles: [number, number][]) {
    let n = 0;
    const cost = BUILDINGS.road.cost.gold;
    for (const [x, z] of tiles) {
      if (!this.roadTileOk(x, z)) continue;
      if (this.gold < cost) { this.notify('金币不够，路没修完', 'warn'); break; }
      this.gold -= cost;
      const k = z * this.W + x;
      this.occ[k] = -1;
      if (this.world.trees[k]) { this.world.trees[k] = 0; this.tVersion++; }
      n++;
    }
    if (n) { this.rVersion++; this.refresh(); this.sfx.push('road'); }
    return n;
  }

  demolish(x: number, z: number) {
    if (!this.world.inside(x, z)) return false;
    const k = z * this.W + x, o = this.occ[k];
    if (o === -1) { this.occ[k] = 0; this.rVersion++; this.refresh(); this.sfx.push('demolish'); return true; }
    if (o > 0) {
      const b = this.buildings.get(o)!;
      if (b.type === 'depot') { this.notify('港口不能拆除', 'warn'); return false; }
      const c = BUILDINGS[b.type].cost;
      this.gold += Math.floor(c.gold * REFUND);
      this.storage.planks = Math.min(this.cap, this.storage.planks + Math.floor((c.planks ?? 0) * REFUND));
      for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) this.occ[(b.z + j) * this.W + b.x + i] = 0;
      this.buildings.delete(o);
      this.bVersion++;
      this.sfx.push('demolish');
      this.refresh();
      return true;
    }
    return false;
  }

  upgradeBlock(b: Bld): string | null {
    if (b.type !== 'house' || b.tier !== 'peasant') return '无法升级';
    if (!b.connected) return '还没连上道路';
    if (b.happy < 0.99) return '先满足农民的全部需求';
    if (b.residents < TIERS.peasant.cap) return '等住满 4 位农民';
    if (!this.canAfford(UPGRADE_COST)) return `需要 ${UPGRADE_COST.gold} 金币和 ${UPGRADE_COST.planks} 木板`;
    return null;
  }
  upgrade(b: Bld, quiet = false) {
    const block = this.upgradeBlock(b);
    if (block) { if (!quiet) this.notify(block, 'warn'); return false; }
    this.gold -= UPGRADE_COST.gold;
    this.storage.planks -= UPGRADE_COST.planks;
    b.tier = 'worker';
    this.bVersion++;
    this.sfx.push('upgrade');
    if (!quiet) this.notify('一户人家搬进了工人住宅', 'good');
    return true;
  }
  upgradeAll() {
    let n = 0;
    this.buildings.forEach(b => { if (b.type === 'house' && b.tier === 'peasant' && this.upgrade(b, true)) n++; });
    this.notify(n ? `${n} 户人家搬进了工人住宅` : '现在没有可以升级的农舍', n ? 'good' : 'info');
    return n;
  }

  notify(text: string, kind: Toast['kind'] = 'info') {
    this.toasts.push({ text, kind });
    if (kind === 'warn') this.sfx.push('error');
  }

  // ---------- network & storage ----------
  refresh() {
    const W = this.W;
    // storage cap
    this.cap = 0;
    this.buildings.forEach(b => { this.cap += BUILDINGS[b.type].storage ?? 0; });
    // roads reachable from hubs (depot and warehouses)
    const net = new Uint8Array(W * W);
    const q: number[] = [];
    const seed = (x: number, z: number) => {
      if (this.isRoad(x, z) && !net[z * W + x]) { net[z * W + x] = 1; q.push(z * W + x); }
    };
    this.buildings.forEach(b => {
      if (b.type !== 'depot' && b.type !== 'warehouse') return;
      this.forEdge(b, seed);
    });
    while (q.length) {
      const k = q.pop()!, x = k % W, z = (k / W) | 0;
      seed(x + 1, z); seed(x - 1, z); seed(x, z + 1); seed(x, z - 1);
    }
    this.netRoads = net;
    this.buildings.forEach(b => {
      if (b.type === 'depot' || b.type === 'warehouse') { b.connected = true; return; }
      let ok = false;
      this.forEdge(b, (x, z) => { if (net[z * W + x]) ok = true; else { const o = this.at(x, z); if (o && (o.type === 'depot' || o.type === 'warehouse')) ok = true; } });
      b.connected = ok;
      if (BUILDINGS[b.type].needs === 'forest') b.env = Math.min(1, this.treesAround(b, BUILDINGS[b.type].radius!) / 10);
    });
  }
  forEdge(b: Bld, fn: (x: number, z: number) => void) {
    for (let i = 0; i < b.w; i++) { fn(b.x + i, b.z - 1); fn(b.x + i, b.z + b.h); }
    for (let j = 0; j < b.h; j++) { fn(b.x - 1, b.z + j); fn(b.x + b.w, b.z + j); }
  }
  covered(b: Bld, svc: ServiceId) {
    const c = this.center(b);
    for (const s of this.buildings.values()) {
      const d = BUILDINGS[s.type];
      if (d.service !== svc || !s.connected) continue;
      const sc = this.center(s);
      if (Math.hypot(sc.x - c.x, sc.z - c.z) <= d.radius!) return true;
    }
    return false;
  }

  // ---------- simulation ----------
  update(realDt: number) {
    this.acc += Math.min(realDt, 0.25) * this.speed;
    while (this.acc >= STEP) { this.acc -= STEP; this.step(STEP); }
  }

  private step(dt: number) {
    this.time += dt;
    this.stepWeather(dt);
    // population & workforce
    this.pop.peasant = 0; this.pop.worker = 0;
    this.buildings.forEach(b => { if (b.type === 'house') this.pop[b.tier] += b.residents; });
    const remain = { peasant: this.pop.peasant, worker: this.pop.worker };
    this.workforce.peasant = { have: this.pop.peasant, need: 0 };
    this.workforce.worker = { have: this.pop.worker, need: 0 };
    let upkeep = 0;
    // production
    for (const b of this.buildings.values()) {
      const def = BUILDINGS[b.type];
      upkeep += def.upkeep;
      if (!def.output) continue;
      const wk = def.workers!;
      this.workforce[wk.tier].need += wk.n;
      const got = b.connected ? Math.min(wk.n, remain[wk.tier]) : 0;
      remain[wk.tier] -= got;
      b.staff = got / wk.n;
      if (!b.connected) { b.status = '没有连上道路'; b.working = false; continue; }
      if (def.needs === 'forest') {
        const t = this.treesAround(b, def.radius!);
        b.env = t < 3 ? 0 : Math.min(1, t / 10);
        if (b.env === 0) { b.status = '附近树木太少'; b.working = false; continue; }
      }
      if (b.staff === 0) { b.status = `缺少${TIERS[wk.tier].name}`; b.working = false; continue; }
      const wf = WEATHER[this.weather.cur].prod[b.type] ?? 1;
      if (wf === 0) { b.status = `${WEATHER[this.weather.cur].name}，暂停作业`; b.working = false; continue; }
      const out = def.output;
      if (b.progress >= 1) {
        if (def.input && this.storage[def.input] < 1) { b.status = `缺少${GOODS[def.input].name}`; b.working = false; continue; }
        if (this.storage[out] >= this.cap - 0.001) { b.status = '仓库已满'; b.working = false; continue; }
        if (def.input) this.storage[def.input] -= 1;
        this.storage[out] = Math.min(this.cap, this.storage[out] + 1);
        b.progress -= 1;
        this.events.push({ id: b.id, good: out, n: 1 });
      }
      b.progress = Math.min(1, b.progress + (dt / def.cycle!) * b.staff * b.env * wf);
      b.working = true;
      b.status = wf !== 1 && b.staff >= 1 ? `运转中（${WEATHER[this.weather.cur].name} ${wf > 1 ? '+' : ''}${Math.round((wf - 1) * 100)}%）` : b.staff < 1 ? `工人不足 (${Math.round(b.staff * wk.n)}/${wk.n})` : (def.input && this.storage[def.input] < 1 && b.progress > 0.9 ? `缺少${GOODS[def.input].name}` : '运转中');
    }
    // consumption
    const demand: Partial<Record<GoodId, number>> = {};
    (['peasant', 'worker'] as TierId[]).forEach(t => {
      for (const [g, r] of Object.entries(TIERS[t].goods)) demand[g as GoodId] = (demand[g as GoodId] ?? 0) + this.pop[t] * (r as number) / 60 * dt;
    });
    GOOD_IDS.forEach(g => {
      const d = demand[g];
      if (!d) { this.supply[g] += (1 - this.supply[g]) * Math.min(1, dt / 4); return; }
      const ratio = Math.min(1, this.storage[g] / d);
      this.storage[g] = Math.max(0, this.storage[g] - d * ratio);
      this.supply[g] += (ratio - this.supply[g]) * Math.min(1, dt / 4);
    });
    // houses
    let tax = 0;
    for (const b of this.buildings.values()) {
      if (b.type !== 'house') continue;
      const T = TIERS[b.tier];
      b.needs = [];
      for (const g of Object.keys(T.goods) as GoodId[]) b.needs.push({ label: GOODS[g].name, value: this.storage[g] >= 1 ? 1 : this.supply[g] });
      for (const s of T.services) b.needs.push({ label: SERVICES[s], value: b.connected && this.covered(b, s) ? 1 : 0 });
      const f = b.needs.reduce((a, n) => a + n.value, 0) / b.needs.length;
      b.happy = b.connected ? f : 0;
      const target = b.connected ? Math.max(1, Math.round(T.cap * f)) : 0;
      b.growT += dt;
      if (b.residents < target && b.growT >= 4) { b.residents++; b.growT = 0; }
      else if (b.residents > target && b.growT >= 8) { b.residents--; b.growT = 0; }
      if (b.residents === target) b.growT = Math.min(b.growT, 4);
      b.status = !b.connected ? '没有连上道路' : f >= 0.99 ? '生活美满' : '有需求没被满足';
      tax += b.residents * T.tax * (0.4 + 0.6 * b.happy);
    }
    this.taxRate = tax;
    this.upkeepRate = upkeep;
    this.gold += (tax - upkeep) / 60 * dt;
    // quests
    this.questT += dt;
    if (this.questT >= 1) {
      this.questT = 0;
      const q = QUESTS[this.questIndex];
      if (q && q.done(this)) {
        this.gold += q.reward;
        if (q.planks) this.storage.planks = Math.min(this.cap, this.storage.planks + q.planks);
        this.questIndex++;
        this.sfx.push('quest');
        const reward = [q.reward ? `${q.reward} 金币` : '', q.planks ? `${q.planks} 木板` : ''].filter(Boolean).join('、');
        this.notify(reward ? `目标完成：${q.text}　奖励 ${reward}` : `目标完成：${q.text}`, 'good');
        if (this.questIndex >= QUESTS.length) this.notify('小镇已经成长为热闹的港口城市了！', 'good');
      }
    }
  }

  private stepWeather(dt: number) {
    const w = this.weather;
    w.blend = Math.min(1, w.blend + dt / 10);
    w.left -= dt;
    if (w.left > 0) return;
    const opts = Object.entries(WEATHER[w.cur].next) as [WeatherId, number][];
    let r = Math.random() * opts.reduce((a, [, v]) => a + v, 0);
    let next = opts[0][0];
    for (const [k, v] of opts) { r -= v; if (r <= 0) { next = k; break; } }
    this.setWeather(next);
  }
  setWeather(next: WeatherId) {
    const w = this.weather;
    const [a, b] = WEATHER[next].duration;
    w.left = a + Math.random() * (b - a);
    if (next === w.cur) return;
    w.prev = w.cur; w.cur = next; w.blend = 0;
    const d = WEATHER[next];
    this.notify(`天气转为${d.name}${d.effect !== '一切正常' ? `：${d.effect}` : ''}`, 'info');
  }

  // ---------- save ----------
  serialize() {
    const roads: number[] = [];
    this.occ.forEach((o, i) => { if (o === -1) roads.push(i); });
    return JSON.stringify({
      v: 1, seed: this.world.seed, weather: this.weather.cur, gold: this.gold, time: this.time, quest: this.questIndex, storage: this.storage, roads,
      b: [...this.buildings.values()].filter(b => b.type !== 'depot').map(b => [b.type, b.x, b.z, b.tier, b.residents, b.progress]),
    });
  }
  static load(json: string): Game | null {
    try {
      const s = JSON.parse(json);
      if (s.v !== 1) return null;
      const g = new Game(s.seed);
      g.gold = s.gold; g.time = s.time; g.questIndex = s.quest;
      if (s.weather && s.weather in WEATHER) { g.weather.cur = g.weather.prev = s.weather; }
      GOOD_IDS.forEach(k => { g.storage[k] = s.storage[k] ?? 0; });
      for (const i of s.roads) { g.occ[i] = -1; g.world.trees[i] = 0; }
      for (const [type, x, z, tier, res, prog] of s.b) {
        const b = g.addBuilding(type, x, z);
        b.tier = tier; b.residents = res; b.progress = prog;
      }
      g.rVersion++; g.tVersion++;
      g.refresh();
      return g;
    } catch { return null; }
  }
}
