import { World, Tile } from './world';
import {
  BUILDINGS, BuildingId, BuildingDef, GOOD_IDS, GoodId, GOODS, TIERS, TIER_IDS, TierId, ServiceId, SERVICES, Cost,
  START, REFUND, BUY_MARKUP, MAP_SIZE, WEATHER, WeatherId, Era, ERAS, TECHS, TECH_IDS, TechId, TechEffect,
  HEAT_PER_RESIDENT, POWER_HEAT_PER_RESIDENT, coldFactor, POLLUTION_RADIUS,
  DAY_LENGTH, SEASON_DAYS, START_HOUR, SEASONS, SEASON_IDS, SeasonId,
} from './data';

export interface Bld {
  id: number;
  type: BuildingId;
  x: number; z: number; w: number; h: number;
  variant: number;
  // production
  progress: number;
  loaded: boolean;    // inputs for the current cycle have been taken
  staff: number;      // 0..1 share of required workers present
  env: number;        // 0..1 environment factor (trees nearby, pollution on farms)
  working: boolean;
  status: string;
  connected: boolean;
  gen: number;        // power produced this step
  // housing
  tier: TierId;
  residents: number;
  sick: number;
  happy: number;      // 0..1
  parts: { label: string; value: number; max: number }[];
  needs: { label: string; value: number }[];
  warm: number;       // 0..1
  cover: Set<ServiceId>;   // services reaching this house (cached on refresh)
  heaters: Bld[];          // heating plants in range (cached on refresh)
  coldT: number;
  growT: number;
}

export interface ProdEvent { id: number; good: GoodId; n: number }
export interface Toast { text: string; kind: 'info' | 'warn' | 'good' }

export interface Quest { text: string; reward: Cost; done: (g: Game) => boolean }
export const QUESTS: Quest[] = [
  { text: '修路连通港口，建 3 座住宅', reward: { gold: 300, planks: 10 }, done: g => g.count('house', true) >= 3 },
  { text: '在水边建一座渔场', reward: { gold: 200, planks: 6 }, done: g => g.count('fishery', true) >= 1 },
  { text: '建一座集市，覆盖住宅', reward: { gold: 200 }, done: g => g.count('market', true) >= 1 },
  { text: '建伐木场和锯木厂，自产木板', reward: { gold: 300 }, done: g => g.count('lumberjack', true) >= 1 && g.count('sawmill', true) >= 1 },
  { text: '建一座村塾，开始研究', reward: { gold: 200, planks: 6 }, done: g => g.count('study', true) >= 1 },
  { text: '农民达到 60 人，并建起教堂', reward: { gold: 500 }, done: g => g.era >= 2 },
  { text: '建柴火坊：入冬前要囤好柴火', reward: { gold: 300 }, done: g => g.count('firewood', true) >= 1 },
  { text: '黏土坑 → 砖厂，自产砖', reward: { gold: 300 }, done: g => g.count('claypit', true) >= 1 && g.count('brickworks', true) >= 1 },
  { text: '把一户农民升级为工人', reward: { gold: 300, bricks: 6 }, done: g => g.pop.worker > 0 },
  { text: '建立面包链：麦田 → 磨坊 → 面包房', reward: { gold: 400 }, done: g => g.count('mill', true) >= 1 && g.count('bakery', true) >= 1 },
  { text: '在铁矿脉上建铁矿，再建铁匠铺', reward: { gold: 500 }, done: g => g.count('ironmine', true) >= 1 && g.count('smithy', true) >= 1 },
  { text: '工人达到 120 人，进入工业时代', reward: { gold: 800 }, done: g => g.era >= 3 },
  { text: '研究蒸汽机，建燃煤电厂', reward: { gold: 600 }, done: g => g.count('coalplant', true) >= 1 },
  { text: '建炼钢厂，自产钢', reward: { gold: 600 }, done: g => g.count('steelworks', true) >= 1 },
  { text: '技工达到 150 人并建成市政厅', reward: { gold: 1500 }, done: g => g.era >= 4 },
  { text: '建一座清洁能源发电站', reward: { gold: 1000 }, done: g => g.count('windturbine', true) + g.count('solar', true) + g.count('hydro', true) >= 1 },
  { text: '市民达到 200 人', reward: { gold: 2000 }, done: g => g.pop.citizen >= 200 },
  { text: '城里的平均污染降到 10 以下（有 100 位市民时）', reward: { gold: 2000 }, done: g => g.pop.citizen >= 100 && g.pollutionAvg < 10 },
];

const STEP = 0.25;
const PROD_CATS = new Set(['raw', 'craft']);

type Mods = Required<Omit<TechEffect, 'prod' | 'workersLess'>> & { prod: Partial<Record<BuildingId, number>>; workersLess: Partial<Record<BuildingId, number>> };
const emptyMods = (): Mods => ({ prod: {}, workersLess: {}, prodAll: 0, heating: 0, storage: 0, happiness: 0, parkRadius: 0, pollution: 0, sickness: 0, forestNeed: 10 });

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
  era: Era = 1;
  questIndex = 0;
  pop: Record<TierId, number> = { peasant: 0, worker: 0, technician: 0, citizen: 0 };
  workforce = {} as Record<TierId, { have: number; need: number }>;
  taxRate = 0;
  upkeepRate = 0;
  power = { gen: 0, use: 0, ratio: 1 };
  research = { current: null as TechId | null, points: 0, rate: 0, levels: {} as Partial<Record<TechId, number>>, saved: {} as Partial<Record<TechId, number>> };
  mods = emptyMods();
  pollution: Float32Array;
  pollutionAvg = 0;
  happyAvg = 0;
  /** fuel the town burns per minute in winter, by fuel */
  heatNeed: Partial<Record<GoodId | 'power', number>> = {};
  netRoads = new Uint8Array(0);
  // change counters for the renderer
  bVersion = 0; rVersion = 0; tVersion = 0; pVersion = 0;
  events: ProdEvent[] = [];
  sfx: string[] = [];
  weather = { cur: 'sunny' as WeatherId, prev: 'sunny' as WeatherId, blend: 1, left: 120 };
  toasts: Toast[] = [];
  private acc = 0;
  private slowT = 0;
  private flags = new Set<string>();

  constructor(seed: number) {
    this.world = new World(MAP_SIZE, seed);
    this.W = MAP_SIZE;
    this.occ = new Int32Array(this.W * this.W);
    this.pollution = new Float32Array(this.W * this.W);
    this.storage = {} as any; this.supply = {} as any;
    GOOD_IDS.forEach(g => { this.storage[g] = START.goods[g] ?? 0; this.supply[g] = 1; });
    TIER_IDS.forEach(t => { this.workforce[t] = { have: 0, need: 0 }; });
    const d = this.world.depot;
    this.addBuilding('depot', d.x, d.z);
    this.refresh();
  }

  // ---------- calendar ----------
  get totalHours() { return START_HOUR + (this.time / DAY_LENGTH) * 24; }
  get hour() { return this.totalHours % 24; }
  get day() { return Math.floor(this.totalHours / 24); }
  get seasonPos() { return (this.totalHours / 24) / SEASON_DAYS; }
  get season(): SeasonId { return SEASON_IDS[Math.floor(this.seasonPos) % 4]; }
  get year() { return Math.floor(this.seasonPos / 4) + 1; }
  get night() {
    const h = this.hour;
    if (h >= 6.5 && h <= 18) return 0;
    if (h > 18 && h < 20.5) return (h - 18) / 2.5;
    if (h >= 4.5 && h < 6.5) return 1 - (h - 4.5) / 2;
    return 1;
  }
  /** winter heating only matters once firewood exists */
  get heatingOn() { return this.season === 'winter' && this.era >= 2; }
  get cold() { return coldFactor(this.year); }
  prodFactor(type: BuildingId) {
    return (WEATHER[this.weather.cur].prod[type] ?? 1) * (SEASONS[this.season].prod[type] ?? 1);
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
  has(t: TechId) { return (this.research.levels[t] ?? 0) > 0; }
  unlocked(type: BuildingId) {
    const d = BUILDINGS[type];
    return d.era <= this.era && (!d.research || this.has(d.research));
  }
  lockReason(type: BuildingId) {
    const d = BUILDINGS[type];
    if (d.era > this.era) return `${ERAS[d.era].name}解锁`;
    if (d.research && !this.has(d.research)) return `需要研究「${TECHS[d.research].name}」`;
    return '';
  }
  workersFor(type: BuildingId) {
    const w = BUILDINGS[type].workers;
    if (!w) return 0;
    return Math.max(1, w.n - (this.mods.workersLess[type] ?? 0));
  }
  missing(c: Cost): string | null {
    if (this.gold < c.gold) return '金币不够';
    for (const k of GOOD_IDS) if ((c[k] ?? 0) > this.storage[k] + 1e-6) return `${GOODS[k].name}不够`;
    return null;
  }
  canAfford(c: Cost) { return this.missing(c) === null; }
  private pay(c: Cost) {
    this.gold -= c.gold;
    for (const k of GOOD_IDS) if (c[k]) this.storage[k] -= c[k]!;
  }
  private gain(c: Cost, f = 1) {
    this.gold += Math.floor(c.gold * f);
    for (const k of GOOD_IDS) if (c[k]) this.storage[k] = Math.min(this.cap, this.storage[k] + Math.floor(c[k]! * f));
  }

  canPlace(type: BuildingId, x: number, z: number): { ok: boolean; reason?: string } {
    const def = BUILDINGS[type];
    if (!this.unlocked(type)) return { ok: false, reason: this.lockReason(type) };
    const [w, h] = def.size;
    let dep = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, tz = z + j;
      if (!this.world.inside(tx, tz)) return { ok: false, reason: '超出地图' };
      const t = this.world.tile(tx, tz);
      if (t === Tile.Water) return { ok: false, reason: '不能建在水上' };
      if (t === Tile.Rock) return { ok: false, reason: '岩石地无法建造' };
      if (this.occ[tz * this.W + tx] !== 0) return { ok: false, reason: '这里已经有东西了' };
      const d = this.world.deposit(tx, tz);
      if ((def.needs === 'iron' && d === 1) || (def.needs === 'coal' && d === 2)) dep++;
    }
    if (def.needs === 'water' && !this.touchesWater(x, z, w, h)) return { ok: false, reason: `${def.name}必须紧挨水边` };
    if (def.needs === 'river' && !this.touchesWater(x, z, w, h, true)) return { ok: false, reason: `${def.name}必须紧挨河流或湖泊` };
    if (def.needs === 'iron' && dep < 2) return { ok: false, reason: '必须建在铁矿脉上' };
    if (def.needs === 'coal' && dep < 2) return { ok: false, reason: '必须建在煤矿脉上' };
    const m = this.missing(def.cost);
    if (m) return { ok: false, reason: m };
    return { ok: true };
  }

  touchesWater(x: number, z: number, w: number, h: number, inland = false) {
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      if (i >= 0 && i < w && j >= 0 && j < h) continue;
      if (this.world.tile(x + i, z + j) === Tile.Water && (!inland || !this.world.isOcean(x + i, z + j))) return true;
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
  pollutionAt(x: number, z: number) {
    const xi = Math.max(0, Math.min(this.W - 1, Math.floor(x))), zi = Math.max(0, Math.min(this.W - 1, Math.floor(z)));
    return this.pollution[zi * this.W + xi];
  }
  radiusOf(b: Bld | BuildingId) {
    const t = typeof b === 'string' ? b : b.type;
    const r = BUILDINGS[t].radius ?? 0;
    return t === 'park' ? r + this.mods.parkRadius : r;
  }

  // ---------- actions ----------
  place(type: BuildingId, x: number, z: number): boolean {
    const chk = this.canPlace(type, x, z);
    if (!chk.ok) { this.notify(chk.reason!, 'warn'); return false; }
    this.pay(BUILDINGS[type].cost);
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
      progress: 0, loaded: false, staff: 0, env: 1, working: false, status: '', connected: false, gen: 0,
      tier: 'peasant', residents: 0, sick: 0, happy: 0, parts: [], needs: [], warm: 1, coldT: 0, growT: 0, cover: new Set(), heaters: [],
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
      this.gain(BUILDINGS[b.type].cost, REFUND);
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
    if (b.type !== 'house') return '无法升级';
    const up = TIERS[b.tier].upgrade;
    if (!up) return '已经是最高阶层';
    const next = TIERS[up.to];
    if (next.era > this.era) return `${ERAS[next.era].name}才能升级为${next.name}`;
    if (!b.connected) return '还没连上道路';
    if (b.happy < 0.8) return `幸福度要达到 80（现在 ${Math.round(b.happy * 100)}）`;
    if (b.residents < TIERS[b.tier].cap) return `等住满 ${TIERS[b.tier].cap} 位${TIERS[b.tier].name}`;
    const m = this.missing(up.cost);
    if (m) return m;
    return null;
  }
  upgrade(b: Bld, quiet = false) {
    const block = this.upgradeBlock(b);
    if (block) { if (!quiet) this.notify(block, 'warn'); return false; }
    const up = TIERS[b.tier].upgrade!;
    this.pay(up.cost);
    b.tier = up.to;
    this.bVersion++;
    this.sfx.push('upgrade');
    if (!quiet) this.notify(`一户人家成为了${TIERS[up.to].name}`, 'good');
    return true;
  }
  upgradeAll(tier?: TierId) {
    let n = 0;
    this.buildings.forEach(b => { if (b.type === 'house' && (!tier || b.tier === tier) && this.upgrade(b, true)) n++; });
    this.notify(n ? `${n} 户人家升级了` : '现在没有可以升级的住宅', n ? 'good' : 'info');
    return n;
  }

  // ---------- harbour trade ----------
  buyPrice(g: GoodId) { return Math.ceil(GOODS[g].price * BUY_MARKUP); }
  sell(g: GoodId, n: number) {
    n = Math.min(n, Math.floor(this.storage[g]));
    if (n <= 0) { this.notify(`仓库里没有${GOODS[g].name}`, 'warn'); return 0; }
    this.storage[g] -= n;
    this.gold += n * GOODS[g].price;
    this.sfx.push('coin');
    return n;
  }
  buy(g: GoodId, n: number) {
    if (GOODS[g].era > this.era) { this.notify(`${ERAS[GOODS[g].era].name}才有商船运${GOODS[g].name}`, 'warn'); return 0; }
    n = Math.min(n, Math.floor(this.cap - this.storage[g]), Math.floor(this.gold / this.buyPrice(g)));
    if (n <= 0) { this.notify(this.storage[g] >= this.cap - 1 ? '仓库已满' : '金币不够', 'warn'); return 0; }
    this.storage[g] += n;
    this.gold -= n * this.buyPrice(g);
    this.sfx.push('coin');
    return n;
  }

  // ---------- research ----------
  techLevel(t: TechId) { return this.research.levels[t] ?? 0; }
  techCost(t: TechId) { return Math.round(TECHS[t].cost * Math.pow(1.5, TECHS[t].infinite ? this.techLevel(t) : 0)); }
  canResearch(t: TechId) {
    const d = TECHS[t];
    return d.era <= this.era && (d.infinite || !this.has(t));
  }
  setResearch(t: TechId | null) {
    if (t && !this.canResearch(t)) return false;
    const r = this.research;
    if (t !== r.current) {
      // switching keeps what was already learned on the old topic
      if (r.current && r.points > 0) r.saved[r.current] = r.points;
      r.points = t ? r.saved[t] ?? 0 : 0;
      if (t) delete r.saved[t];
    }
    r.current = t;
    return true;
  }
  private recomputeMods() {
    const m = emptyMods();
    for (const t of TECH_IDS) {
      const lv = this.techLevel(t);
      if (!lv) continue;
      const e = TECHS[t].effect;
      for (const [k, v] of Object.entries(e.prod ?? {})) m.prod[k as BuildingId] = (m.prod[k as BuildingId] ?? 0) + v! * lv;
      for (const [k, v] of Object.entries(e.workersLess ?? {})) m.workersLess[k as BuildingId] = (m.workersLess[k as BuildingId] ?? 0) + v! * lv;
      m.prodAll += (e.prodAll ?? 0) * lv;
      m.heating += (e.heating ?? 0) * lv;
      m.storage += (e.storage ?? 0) * lv;
      m.happiness += (e.happiness ?? 0) * lv;
      m.parkRadius += (e.parkRadius ?? 0) * lv;
      m.pollution += (e.pollution ?? 0) * lv;
      m.sickness += (e.sickness ?? 0) * lv;
      if (e.forestNeed) m.forestNeed = Math.min(m.forestNeed, e.forestNeed);
    }
    m.pollution = Math.max(-0.9, m.pollution);
    this.mods = m;
  }

  notify(text: string, kind: Toast['kind'] = 'info') {
    this.toasts.push({ text, kind });
    if (kind === 'warn') this.sfx.push('error');
  }
  private once(key: string, text: string, kind: Toast['kind'] = 'info') {
    if (this.flags.has(key)) return;
    this.flags.add(key);
    this.notify(text, kind);
  }

  // ---------- network & storage ----------
  refresh() {
    const W = this.W;
    this.recomputeMods();
    let hubs = 0;
    this.cap = 0;
    this.buildings.forEach(b => { const s = BUILDINGS[b.type].storage; if (s) { this.cap += s; hubs++; } });
    this.cap += this.mods.storage;
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
    });
    void hubs;
    // cache which services and heating plants reach each house
    const cov = [...this.buildings.values()].filter(s => BUILDINGS[s.type].service || BUILDINGS[s.type].heating);
    this.buildings.forEach(b => {
      if (b.type !== 'house') return;
      b.cover = new Set(); b.heaters = [];
      const c = this.center(b);
      for (const s of cov) {
        if (!s.connected) continue;
        const sc = this.center(s);
        if (Math.hypot(sc.x - c.x, sc.z - c.z) > this.radiusOf(s)) continue;
        const d = BUILDINGS[s.type];
        if (d.service) b.cover.add(d.service);
        if (d.heating) b.heaters.push(s);
      }
    });
  }
  forEdge(b: Bld, fn: (x: number, z: number) => void) {
    for (let i = 0; i < b.w; i++) { fn(b.x + i, b.z - 1); fn(b.x + i, b.z + b.h); }
    for (let j = 0; j < b.h; j++) { fn(b.x - 1, b.z + j); fn(b.x + b.w, b.z + j); }
  }
  /** a building of `pred` with radius covering b's centre */
  private within(b: Bld, pred: (s: Bld, d: BuildingDef) => boolean) {
    const c = this.center(b);
    for (const s of this.buildings.values()) {
      const d = BUILDINGS[s.type];
      if (!s.connected || !pred(s, d)) continue;
      const sc = this.center(s);
      if (Math.hypot(sc.x - c.x, sc.z - c.z) <= this.radiusOf(s)) return s;
    }
    return undefined;
  }
  covered(b: Bld, svc: ServiceId) { return b.type === 'house' ? b.cover.has(svc) : !!this.within(b, (_s, d) => d.service === svc); }
  heatedBy(b: Bld) { return b.heaters.find(s => s.working && this.buildings.has(s.id)); }

  // ---------- simulation ----------
  update(realDt: number) {
    this.acc += Math.min(realDt, 0.25) * this.speed;
    while (this.acc >= STEP) { this.acc -= STEP; this.step(STEP); }
  }

  /** advance the simulation by `seconds` of game time without the frame cap (used by tests) */
  advance(seconds: number) { for (let t = 0; t < seconds; t += STEP) this.step(STEP); }

  private step(dt: number) {
    this.time += dt;
    this.stepWeather(dt);
    this.slowT += dt;
    if (this.slowT >= 1) { this.slowT = 0; this.replant(); this.computePollution(); this.checkEra(); this.checkQuest(); }

    // ---- population & workforce (sick people stay home)
    TIER_IDS.forEach(t => { this.pop[t] = 0; });
    const remain = {} as Record<TierId, number>;
    TIER_IDS.forEach(t => { remain[t] = 0; });
    this.buildings.forEach(b => { if (b.type === 'house') { this.pop[b.tier] += b.residents; remain[b.tier] += Math.max(0, b.residents - b.sick); } });
    TIER_IDS.forEach(t => { this.workforce[t] = { have: remain[t], need: 0 }; });

    const broke = this.gold < 0;
    if (broke) this.once('broke', '金库空了！先别建新东西：在仓库面板卖掉多余的货物，或拆掉闲置的建筑', 'warn');
    else this.flags.delete('broke');
    const powerRatio = this.power.ratio;
    let upkeep = 0, gen = 0, use = 0, rp = 0;
    const W = WEATHER[this.weather.cur];

    for (const b of this.buildings.values()) {
      const def = BUILDINGS[b.type];
      upkeep += def.upkeep;
      b.gen = 0;
      if (b.type === 'house' || b.type === 'road') continue;
      // staffing
      if (def.workers) {
        const need = this.workersFor(b.type);
        this.workforce[def.workers.tier].need += need;
        const got = b.connected ? Math.min(need, remain[def.workers.tier]) : 0;
        remain[def.workers.tier] -= got;
        b.staff = got / need;
      } else b.staff = b.connected ? 1 : 0;
      if (!def.workers && !def.powerGen && !def.cycle && !def.heating && def.pollution === undefined) { b.working = b.connected; b.status = b.connected ? '' : '没有连上道路'; continue; }
      if (!b.connected) { b.status = '没有连上道路'; b.working = false; continue; }
      if (b.staff === 0) { b.status = `缺少${TIERS[def.workers!.tier].name}`; b.working = false; continue; }
      const staffNote = b.staff < 1 ? `工人不足 (${Math.round(b.staff * this.workersFor(b.type))}/${this.workersFor(b.type)})` : '';

      // weather-driven generators
      if (def.powerKind === 'wind' || def.powerKind === 'solar' || def.powerKind === 'hydro') {
        let f = 1;
        if (def.powerKind === 'wind') f = W.wind;
        if (def.powerKind === 'solar') f = W.sun * (1 - this.night) * (this.season === 'winter' ? 0.7 : 1);
        b.gen = def.powerGen! * f * b.staff;
        gen += b.gen;
        b.working = b.gen > 0.01;
        b.status = b.working ? `发电 ${b.gen.toFixed(1)}` : def.powerKind === 'solar' ? '夜里不发电' : '没有风';
        continue;
      }
      // research buildings
      if (def.research_pts) {
        b.working = true;
        rp += def.research_pts * b.staff;
        b.status = staffNote || `研究 ${(def.research_pts * b.staff).toFixed(0)} 点/分`;
        continue;
      }
      // heating plants work whenever staffed; their coal is billed in the heating step
      if (def.heating) { b.working = true; b.status = staffNote || (this.heatingOn ? '供暖中' : '待命（冬天供暖）'); continue; }
      // cleaners
      if (!def.cycle) {
        let pf = 1;
        if (def.power) { use += def.power; pf = powerRatio; }
        b.working = pf > 0.05;
        b.status = staffNote || (b.working ? (pf < 0.99 ? `电力不足 (${Math.round(pf * 100)}%)` : '运转中') : '没有电');
        continue;
      }

      // ---- production cycle (coal plants are a cycle with no output)
      const wf = this.prodFactor(b.type);
      if (wf === 0) {
        b.status = (SEASONS[this.season].prod[b.type] === 0) ? `${SEASONS[this.season].name}季休耕` : `${W.name}，暂停作业`;
        b.working = false; continue;
      }
      if (def.needs === 'forest') {
        const t = this.treesAround(b, def.radius!);
        b.env = t < 3 ? 0 : Math.min(1, t / this.mods.forestNeed);
        if (b.env === 0) { b.status = '附近树木太少'; b.working = false; continue; }
      } else if (b.type === 'farm' || b.type === 'fishery' || b.type === 'sheepfarm') {
        const c = this.center(b), p = this.pollutionAt(c.x, c.z);
        b.env = 1 - Math.min(0.5, Math.max(0, (p - 20) / 80));
      } else b.env = 1;
      const out = def.output;
      if (out && this.storage[out] >= this.cap - 0.001) { b.status = '仓库已满'; b.working = false; continue; }
      if (!b.loaded) {
        const lack = Object.entries(def.input ?? {}).find(([g, n]) => this.storage[g as GoodId] < (n as number));
        if (lack) { b.status = `缺少${GOODS[lack[0] as GoodId].name}`; b.working = false; continue; }
        for (const [g, n] of Object.entries(def.input ?? {})) this.storage[g as GoodId] -= n as number;
        b.loaded = true;
      }
      let pf = 1;
      if (def.power) { use += def.power * b.staff; pf = powerRatio; if (pf < 0.05) { b.status = '没有电'; b.working = false; continue; } }
      if (def.powerGen) { b.gen = def.powerGen * b.staff; gen += b.gen; }
      const mult = (1 + (this.mods.prod[b.type] ?? 0) + (PROD_CATS.has(def.category) ? this.mods.prodAll : 0));
      b.progress += (dt / def.cycle) * b.staff * b.env * wf * pf * mult;
      if (b.progress >= 1) {
        b.progress -= 1;
        b.loaded = false;
        if (out) {
          const n = def.outQty ?? 1;
          this.storage[out] = Math.min(this.cap, this.storage[out] + n);
          this.events.push({ id: b.id, good: out, n });
        }
      }
      b.working = true;
      const pct = Math.round((wf * b.env * mult - 1) * 100);
      b.status = staffNote || (pf < 0.99 ? `电力不足 (${Math.round(pf * 100)}%)` : def.powerGen ? `发电 ${b.gen.toFixed(0)}` : Math.abs(pct) >= 1 ? `运转中（${pct > 0 ? '+' : ''}${pct}%）` : '运转中');
    }

    // ---- consumption of goods
    const demand: Partial<Record<GoodId, number>> = {};
    TIER_IDS.forEach(t => {
      const T = TIERS[t];
      for (const [g, r] of [...Object.entries(T.essentials), ...Object.entries(T.comforts)]) demand[g as GoodId] = (demand[g as GoodId] ?? 0) + this.pop[t] * (r as number) / 60 * dt;
    });
    GOOD_IDS.forEach(g => {
      const d = demand[g];
      if (!d) { this.supply[g] += (1 - this.supply[g]) * Math.min(1, dt / 4); return; }
      const ratio = Math.min(1, this.storage[g] / d);
      this.storage[g] = Math.max(0, this.storage[g] - d * ratio);
      this.supply[g] += (ratio - this.supply[g]) * Math.min(1, dt / 4);
    });

    // ---- winter heating: work out what every house burns, then draw it from storage
    const heat = this.heatingOn, heatMul = Math.max(0.2, 1 + this.mods.heating) * this.cold;
    const fuelNeed: Partial<Record<GoodId | 'power', number>> = {};
    const houseFuel = new Map<Bld, [GoodId | 'power', number]>();
    for (const b of this.buildings.values()) {
      if (b.type !== 'house' || !b.residents) continue;
      let fuel: GoodId | 'power' = TIERS[b.tier].fuel;
      let rate = b.residents * (fuel === 'power' ? POWER_HEAT_PER_RESIDENT : HEAT_PER_RESIDENT) * heatMul;
      if (fuel !== 'power' && this.heatedBy(b)) { fuel = 'coal'; rate *= 0.7; }
      houseFuel.set(b, [fuel, rate]);
      fuelNeed[fuel] = (fuelNeed[fuel] ?? 0) + rate;
    }
    this.heatNeed = fuelNeed;
    const fuelOk: Partial<Record<GoodId | 'power', number>> = {};
    for (const [f, rate] of Object.entries(fuelNeed) as [GoodId | 'power', number][]) {
      if (!heat) { fuelOk[f] = 1; continue; }
      if (f === 'power') { use += rate; fuelOk[f] = powerRatio; continue; }
      const d = rate / 60 * dt;
      const r = Math.min(1, this.storage[f] / d);
      this.storage[f] = Math.max(0, this.storage[f] - d * r);
      fuelOk[f] = r;
    }

    this.power = { gen, use, ratio: use > 0 ? Math.min(1, gen / use) : 1 };
    if (use > gen + 0.01 && use > 0) this.once('power', '电力不足：用电建筑只能按比例运转，多建发电站吧', 'warn');
    else this.flags.delete('power');

    // ---- houses: happiness, growth, sickness, tax
    let tax = 0, happySum = 0, houses = 0, coldHouses = 0;
    const comfortSupply = (gs: GoodId[]) => gs.length ? gs.reduce((a, g) => a + (this.storage[g] >= 1 ? 1 : this.supply[g]), 0) / gs.length : 1;
    for (const b of this.buildings.values()) {
      if (b.type !== 'house') continue;
      const T = TIERS[b.tier];
      const ess = Object.keys(T.essentials) as GoodId[], com = Object.keys(T.comforts) as GoodId[];
      const essV = comfortSupply(ess), comV = comfortSupply(com);
      const svc = T.services.map(s => b.connected && this.covered(b, s) ? 1 : 0);
      const svcV = svc.reduce((a: number, v) => a + v, 0) / T.services.length;
      const c = this.center(b);
      const pol = this.pollutionAt(c.x, c.z);
      const park = this.covered(b, 'park') ? 4 : 0;
      const envV = Math.max(0, 1 - pol / 60);
      // warmth eases towards the share of fuel that arrived
      const hf = houseFuel.get(b);
      const warmGoal = heat && hf ? (fuelOk[hf[0]] ?? 1) : 1;
      b.warm += (warmGoal - b.warm) * Math.min(1, dt / 3);
      b.parts = [
        { label: '必需品', value: essV * 30, max: 30 },
        { label: '舒适品', value: comV * 20, max: 20 },
        { label: '公共服务', value: svcV * 20, max: 20 },
        { label: '环境', value: Math.min(15, envV * 15 + park), max: 15 },
        { label: '温暖', value: b.warm * 15, max: 15 },
      ];
      b.needs = [
        ...ess.map(g => ({ label: GOODS[g].name, value: this.storage[g] >= 1 ? 1 : this.supply[g] })),
        ...com.map(g => ({ label: GOODS[g].name, value: this.storage[g] >= 1 ? 1 : this.supply[g] })),
        ...T.services.map((s, i) => ({ label: SERVICES[s], value: svc[i] })),
      ];
      let happy = b.parts.reduce((a, p) => a + p.value, 0) + this.mods.happiness;
      happy = Math.max(0, Math.min(100, happy));
      b.happy = b.connected ? happy / 100 : 0;
      // the cold: sickness after 30 s, people leave after 90 s
      if (heat && b.warm < 0.5 && b.residents) {
        b.coldT += dt; coldHouses++;
      } else b.coldT = Math.max(0, b.coldT - dt * (this.covered(b, 'clinic') || this.covered(b, 'hospital') ? 3 : 1.5));
      const sickShare = b.coldT > 30 ? 0.5 * Math.max(0.1, 1 + this.mods.sickness) : 0;
      b.sick = Math.min(b.residents, Math.round(b.residents * sickShare));
      // growth
      const hp = b.happy * 100;
      let target = !b.connected ? 0 : hp >= 60 ? T.cap : Math.max(1, Math.round(T.cap * Math.max(0.25, (hp - 10) / 50)));
      if (essV < 0.3) target = Math.min(target, Math.ceil(T.cap / 2));
      if (b.coldT > 90) target = Math.min(target, Math.max(0, b.residents - 1));
      if (hp < 20 && b.connected) target = Math.min(target, Math.max(1, b.residents - 1));
      b.growT += dt;
      if (b.residents < target && b.growT >= 4) { b.residents++; b.growT = 0; }
      else if (b.residents > target && b.growT >= 6) { b.residents--; b.growT = 0; }
      if (b.residents === target) b.growT = Math.min(b.growT, 4);
      b.status = !b.connected ? '没有连上道路' : b.coldT > 30 ? '天太冷，有人生病了' : b.warm < 0.5 && heat ? '家里没有燃料取暖' : hp >= 80 ? '生活美满' : hp >= 50 ? '还算满意' : '日子不好过';
      tax += (b.residents - b.sick) * T.tax * (hp / 100) * (hp > 80 ? 1.2 : 1);
      happySum += hp; houses++;
    }
    this.happyAvg = houses ? happySum / houses : 0;
    if (coldHouses > 0) this.once('cold' + this.year, `有 ${coldHouses} 户人家没有燃料取暖！快补充${this.era >= 3 ? '柴火或煤' : '柴火'}`, 'warn');

    // ---- research
    this.research.rate = rp;
    const cur = this.research.current;
    if (cur && rp > 0) {
      this.research.points += rp / 60 * dt;
      if (this.research.points >= this.techCost(cur)) {
        this.research.points = 0;
        this.research.levels[cur] = this.techLevel(cur) + 1;
        this.recomputeMods(); this.refresh();
        this.sfx.push('quest');
        this.notify(`研究完成：${TECHS[cur].name}${TECHS[cur].infinite ? ` ${this.techLevel(cur)} 级` : ''} — ${TECHS[cur].desc}`, 'good');
        if (!TECHS[cur].infinite) this.research.current = null;
        this.bVersion++;
      }
    }

    this.taxRate = tax;
    this.upkeepRate = upkeep;
    this.gold += (tax - upkeep) / 60 * dt;
  }

  /** lumberjacks replant: now and then a sapling appears on open grass in their range */
  private replant() {
    for (const b of this.buildings.values()) {
      if (b.type !== 'lumberjack' || !b.working) continue;
      if (Math.random() > 0.08) continue;
      const r = BUILDINGS.lumberjack.radius!, c = this.center(b);
      if (this.treesAround(b, r) >= 14) continue;
      for (let tries = 0; tries < 8; tries++) {
        const x = Math.floor(c.x + (Math.random() * 2 - 1) * (r + 0.5)), z = Math.floor(c.z + (Math.random() * 2 - 1) * (r + 0.5));
        if (!this.world.inside(x, z)) continue;
        const k = z * this.W + x;
        if (this.world.tile(x, z) !== Tile.Grass || this.occ[k] !== 0 || this.world.trees[k] || this.world.deposits[k]) continue;
        if (Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) > r + 0.5) continue;
        this.world.trees[k] = Math.random() < 0.5 ? 1 : 2;
        this.tVersion++;
        break;
      }
    }
  }

  private computePollution() {
    const W = this.W, target = new Float32Array(W * W);
    const wx = this.weather.cur === 'rain' || this.weather.cur === 'storm' ? 0.8 : this.weather.cur === 'fog' ? 1.2 : 1;
    const dirty = Math.max(0.1, 1 + this.mods.pollution);
    for (const b of this.buildings.values()) {
      const d = BUILDINGS[b.type];
      if (!d.pollution) continue;
      const clean = d.pollution < 0;
      if (!b.working && !(b.type === 'park' && b.connected)) continue;
      const s = clean ? d.pollution : d.pollution * dirty * wx * Math.max(0.3, b.staff);
      const R = clean ? Math.max(this.radiusOf(b), 3) : POLLUTION_RADIUS + Math.max(b.w, b.h) / 2;
      const c = this.center(b);
      for (let z = Math.floor(c.z - R); z <= c.z + R; z++) for (let x = Math.floor(c.x - R); x <= c.x + R; x++) {
        if (!this.world.inside(x, z)) continue;
        const dist = Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z);
        if (dist > R) continue;
        target[z * W + x] += s * (1 - dist / (R + 1));
      }
    }
    let changed = 0;
    for (let i = 0; i < W * W; i++) {
      const t = Math.max(0, target[i]);
      const v = this.pollution[i] + (t - this.pollution[i]) * 0.25;
      changed += Math.abs(v - this.pollution[i]);
      this.pollution[i] = v < 0.05 ? 0 : v;
    }
    if (changed > 0.5) this.pVersion++;
    let s = 0, n = 0;
    for (const b of this.buildings.values()) if (b.type === 'house' && b.residents) { const c = this.center(b); s += this.pollutionAt(c.x, c.z) * b.residents; n += b.residents; }
    this.pollutionAvg = n ? s / n : 0;
  }

  /** progress towards the next era, as parts the UI can show */
  eraGoal() {
    if (this.era >= 4) return null;
    const next = (this.era + 1) as Era, need = ERAS[next].need;
    const parts: { label: string; have: number; need: number }[] = [];
    if (need.tier) parts.push({ label: `${TIERS[need.tier].name}人口`, have: this.pop[need.tier], need: need.pop! });
    if (need.building) parts.push({ label: `建成${BUILDINGS[need.building].name}`, have: this.count(need.building, true) ? 1 : 0, need: 1 });
    return { era: next, parts, done: parts.every(p => p.have >= p.need) };
  }
  private checkEra() {
    const g = this.eraGoal();
    if (!g || !g.done) return;
    this.era = g.era;
    this.sfx.push('season');
    this.notify(`进入${ERAS[g.era].name}！${ERAS[g.era].desc}`, 'good');
    this.bVersion++;
  }
  private checkQuest() {
    const q = QUESTS[this.questIndex];
    if (!q || !q.done(this)) return;
    this.gain(q.reward);
    this.questIndex++;
    this.sfx.push('quest');
    const reward = [q.reward.gold ? `${q.reward.gold} 金币` : '', ...GOOD_IDS.filter(k => q.reward[k]).map(k => `${q.reward[k]} ${GOODS[k].name}`)].filter(Boolean).join('、');
    this.notify(reward ? `目标完成：${q.text}　奖励 ${reward}` : `目标完成：${q.text}`, 'good');
  }

  private lastSeason: SeasonId | null = null;
  private stepWeather(dt: number) {
    const s = this.season;
    if (this.lastSeason && s !== this.lastSeason) {
      this.notify(`${s === 'spring' ? `第 ${this.year} 年，` : ''}${SEASONS[s].name}天到了：${SEASONS[s].effect}`, 'good');
      if (s === 'autumn' && this.era >= 2) this.notify(`冬天快到了：今年冬天大约要烧 ${Math.ceil(this.winterFuelEstimate())} 份燃料`, 'info');
      this.sfx.push('season');
      const mapped = SEASONS[s].weather[this.weather.cur];
      if (mapped) this.setWeather(mapped);
    }
    this.lastSeason = s;
    const w = this.weather;
    w.blend = Math.min(1, w.blend + dt / 10);
    w.left -= dt;
    if (w.left > 0) return;
    const opts = Object.entries(WEATHER[w.cur].next) as [WeatherId, number][];
    let r = Math.random() * opts.reduce((a, [, v]) => a + v, 0);
    let next = opts[0][0];
    for (const [k, v] of opts) { r -= v; if (r <= 0) { next = k; break; } }
    next = SEASONS[this.season].weather[next] ?? next;
    this.setWeather(next);
  }
  /** stored fuel units the whole winter will burn at the current population */
  winterFuelEstimate() {
    const minutes = DAY_LENGTH * SEASON_DAYS / 60;
    let n = 0;
    for (const [f, r] of Object.entries(this.heatNeed)) if (f !== 'power') n += r! * minutes;
    return n;
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
      v: 2, seed: this.world.seed, weather: this.weather.cur, gold: this.gold, time: this.time, quest: this.questIndex, era: this.era,
      research: { current: this.research.current, points: this.research.points, levels: this.research.levels, saved: this.research.saved },
      storage: this.storage, roads,
      b: [...this.buildings.values()].filter(b => b.type !== 'depot').map(b => [b.type, b.x, b.z, b.tier, b.residents, b.progress]),
    });
  }
  static load(json: string): Game | null {
    try {
      const s = JSON.parse(json);
      if (s.v !== 2) return null;
      const g = new Game(s.seed);
      g.gold = s.gold; g.time = s.time; g.questIndex = s.quest; g.era = s.era ?? 1;
      if (s.research) { g.research.current = s.research.current; g.research.points = s.research.points; g.research.levels = s.research.levels ?? {}; g.research.saved = s.research.saved ?? {}; }
      if (s.weather && s.weather in WEATHER) { g.weather.cur = g.weather.prev = s.weather; }
      GOOD_IDS.forEach(k => { g.storage[k] = s.storage[k] ?? 0; });
      for (const i of s.roads) { g.occ[i] = -1; g.world.trees[i] = 0; }
      for (const [type, x, z, tier, res, prog] of s.b) {
        if (!(type in BUILDINGS)) continue;
        const b = g.addBuilding(type, x, z);
        b.tier = tier; b.residents = res; b.progress = prog;
      }
      g.rVersion++; g.tVersion++;
      g.refresh();
      g.lastSeason = g.season;
      // settle the derived state (staffing, power, pollution) before the first frame
      for (let i = 0; i < 12; i++) { g.step(STEP); }
      for (let i = 0; i < 8; i++) g.computePollution();
      g.toasts.length = 0; g.sfx.length = 0; g.events.length = 0;
      return g;
    } catch { return null; }
  }
}
