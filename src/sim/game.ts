import { World, Tile } from './world';
import { MapId, isMapId } from './maps';
import {
  BUILDINGS, BuildingId, BuildingDef, GOOD_IDS, GoodId, GOODS, TIERS, TIER_IDS, TierId, ServiceId, SERVICES, Cost,
  START, REFUND, BUY_MARKUP, BRIDGE_COST, MAP_SIZE, WEATHER, WeatherId, Era, ERAS, TECHS, TECH_IDS, TechId, TechEffect,
  HEAT_PER_RESIDENT, POWER_HEAT_PER_RESIDENT, coldness, SEASON_TEMP, COLDER_PER_YEAR, COLDER_MAX, WEATHER_TEMP, POLLUTION_RADIUS,
  DAY_LENGTH, SEASON_DAYS, START_HOUR, SEASONS, SEASON_IDS, SeasonId,
  SERVICE_ALSO, familyOf, FOODS, FoodId, ProtectId, FIRE, PLAGUE, CRIME, STRIKE, HUNGER, PER_DAY, DEBT,
  ELEC_BOOST, LIGHT, COLD_STORE, SPOIL, SPOIL_SUMMER, COLD_SNAP, DIFFICULTY, DifficultyId,
  ModeId, MODES, SURVIVAL, FREEZE, BLIZZARD_OUTDOOR, OUTDOOR, CROP_TEMP, CROPS, SEA_ICE, MOOD, GLUT, HEAT_LADDER, HeatKind, COAL_SWITCH,
  WORK_CHILL, SICKBED, LAWS, LawId, LAW_FX, LAW_GAP, FEAST, FUNERAL, EVENTS, EventKind,
} from './data';

export interface Bld {
  id: number;
  type: BuildingId;
  x: number; z: number; w: number; h: number;
  rot: number;        // which way the front (door) faces: 0 south (+z), 1 east (+x), 2 north (−z), 3 west (−x); odd = footprint turned
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
  protect: Set<ProtectId>; // health / fire / police cover reaching this building (cached on refresh)
  fire: number;            // seconds it has been burning (0 = not on fire)
  strike: number;          // seconds of strike left
  hungerT: number;         // seconds the household has gone short of food
  fed: number;             // 0..1 share of hunger stilled
  plague: number;          // seconds since infection (0 = healthy)
  paused: boolean;         // closed by the player: no workers, quarter upkeep
  elecOff: boolean;        // the player switched off its optional power draw (no ELEC_BOOST)
  priority: boolean;       // marked by the player: staffed before everything else when hands are short
}

export interface ProdEvent { id: number; good: GoodId; n: number }
/** something happened (refugees at the harbour, a ship's order, a wreck in the ice) and the town must answer */
export interface EventCard { kind: EventKind; day: number; title: string; text: string; options: { label: string; note: string }[]; data: Record<string, any> }
/** an order taken from the trade ship: deliver `n` of `good` by day `due` */
export interface ShipOrder { good: GoodId; n: number; due: number; gold: number; bonus?: { good: GoodId; n: number } }
/**
 * cat decides where a message shows: 'action' answers what the player just did (near the build bar),
 * 'alert' is something happening in town (right-hand stack, click to look), 'milestone' is a big banner,
 * 'report' goes to the message log with a quiet line on the right.
 */
export type ToastCat = 'action' | 'alert' | 'milestone' | 'report';
export interface Toast { text: string; kind: 'info' | 'warn' | 'good'; cat: ToastCat; at?: { x: number; z: number }; icon?: string; day?: number; hour?: number }

export interface Quest { text: string; reward: Cost; done: (g: Game) => boolean }
export const QUESTS: Quest[] = [
  { text: '修路连通港口，建 3 座住宅', reward: { gold: 300, planks: 10 }, done: g => g.count('house', true) >= 3 },
  { text: '在水边建一座渔场', reward: { gold: 200, planks: 6 }, done: g => g.count('fishery', true) >= 1 },
  { text: '建一座集市，覆盖住宅', reward: { gold: 200 }, done: g => g.count('market', true) >= 1 },
  { text: '建伐木场和锯木厂，自产木板', reward: { gold: 300 }, done: g => g.count('lumberjack', true) >= 1 && g.count('sawmill', true) >= 1 },
  { text: '建一座菜园，让大家吃得更丰富', reward: { gold: 200, planks: 4 }, done: g => g.count('garden', true) >= 1 },
  { text: '建柴火坊：气温低于 8°C 就要烧柴', reward: { gold: 250 }, done: g => g.count('firewood', true) >= 1 },
  { text: '建消防队和草药铺，防火防病', reward: { gold: 300 }, done: g => g.count('firestation', true) >= 1 && g.count('herbalist', true) >= 1 },
  { text: '建一座村塾，开始研究', reward: { gold: 200, planks: 6 }, done: g => g.count('study', true) >= 1 },
  { text: '农民达到 60 人，并建起教堂', reward: { gold: 500 }, done: g => g.era >= 2 },
  { text: '建巡警所，管住小偷', reward: { gold: 300 }, done: g => g.count('police', true) >= 1 },
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

/**
 * Rolling book of what flowed in and out over the last minute of game time.
 * Keys: resource ('gold' or a good) | 'in' | 'out' | label.
 */
export class Ledger {
  private buckets: Map<string, number>[] = [new Map()];
  private age = 0;
  private span = 0;
  add(res: string, dir: 'in' | 'out', label: string, amt: number) {
    if (!(amt > 0)) return;
    const k = `${res}|${dir}|${label}`, b = this.buckets[this.buckets.length - 1];
    b.set(k, (b.get(k) ?? 0) + amt);
  }
  tick(dt: number) {
    this.age += dt;
    this.span = Math.min(60, this.span + dt);
    if (this.age >= 10) { this.age = 0; this.buckets.push(new Map()); if (this.buckets.length > 7) this.buckets.shift(); }
  }
  /** per-minute rates: res -> { in: {label: rate}, out: {label: rate} } */
  rates() {
    const out: Record<string, { in: Record<string, number>; out: Record<string, number> }> = {};
    // the oldest bucket is only partly inside the window
    const secs = Math.max(10, Math.min(60, (this.buckets.length - 1) * 10 + this.age));
    for (const b of this.buckets) for (const [k, v] of b) {
      const [res, dir, label] = k.split('|');
      const r = (out[res] ??= { in: {}, out: {} });
      r[dir as 'in' | 'out'][label] = (r[dir as 'in' | 'out'][label] ?? 0) + v * 60 / secs;
    }
    return out;
  }
  reset() { this.buckets = [new Map()]; this.age = 0; this.span = 0; }
}
const PROD_CATS = new Set(['raw', 'craft']);
/** building lines a compost heap helps, and the ones where pollution spoils the harvest */
const BOOSTED = new Set<BuildingId>(['garden', 'farm', 'greenhouse']);
const POLLUTION_HURTS = new Set<BuildingId>(['farm', 'fishery', 'sheepfarm']);

type Mods = Required<Omit<TechEffect, 'prod' | 'workersLess'>> & { prod: Partial<Record<BuildingId, number>>; workersLess: Partial<Record<BuildingId, number>> };
const emptyMods = (): Mods => ({ prod: {}, workersLess: {}, prodAll: 0, heating: 0, storage: 0, happiness: 0, parkRadius: 0, pollution: 0, sickness: 0, forestNeed: 10, heatLimit: 0, spoil: 0 });

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
  /**
   * The grid. `must` is what has to be fed (factories that need power, electric light, electric heating);
   * `boost` is optional draw (workshops' ELEC_BOOST, cold stores) that only gets what is left over.
   * ratio: share of `must` met; boostRatio: share of `boost` met; cold: share of storage kept cold.
   */
  power = { gen: 0, use: 0, ratio: 1, must: 0, boost: 0, boostRatio: 1, light: 0, cold: 0 };
  difficulty: DifficultyId = 'normal';
  /** 百日求生 (colder every day, a goal, can be lost) or the old endless sandbox */
  mode: ModeId = 'survival';
  /** 希望 and 不满, 0..100 (after 冰汽时代) */
  hope = MOOD.hope0;
  discontent = MOOD.disc0;
  /** the game ended: lost, or won (then it carries on as endless once the player closes the card) */
  over: { won: boolean; reason: string } | null = null;
  /** the 100 days were survived; the town is now in endless mode */
  won = false;
  /** people who froze, starved or died of plague (survival) */
  deaths = 0;
  /** the most people the town ever had */
  peakPop = 0;
  /** what the town lost over the current winter, for the spring report */
  winterLog = { deaths: 0, minTemp: 99, left: 0 };
  /** how much of each good was sold lately: the trade ship pays less for a glut */
  glut: Partial<Record<GoodId, number>> = {};
  research = { current: null as TechId | null, points: 0, rate: 0, levels: {} as Partial<Record<TechId, number>>, saved: {} as Partial<Record<TechId, number>> };
  mods = emptyMods();
  pollution: Float32Array;
  pollutionAvg = 0;
  happyAvg = 0;
  /** fuel the town burns per minute in winter, by fuel */
  heatNeed: Partial<Record<GoodId | 'power', number>> = {};
  /** what heating would burn per minute at coldness 1 (for the winter estimate) */
  heatBase: Partial<Record<GoodId | 'power', number>> = {};
  temp = 13;
  /** days per season (a setting) */
  seasonDays = SEASON_DAYS;
  ledger = new Ledger();
  /** 0..1 how well each tier was fed this step */
  fedRatio: Record<TierId, number> = { peasant: 1, worker: 1, technician: 1, citizen: 1 };
  /** days the treasury has been in the red */
  debtDays = 0;
  /** finished days: summaries for the ledger */
  days: { day: number; gold: number; pop: number; food: number }[] = [];
  private dayStart = { gold: START.gold, pop: 0 };
  private lastDay = 0;
  /** why people left today */
  flowLeft = { hunger: 0, cold: 0, plague: 0, fire: 0 };
  /** buildings currently burning, for the renderer */
  fires = new Set<number>();
  /** road tiles each street-served building reaches (cached on refresh) */
  reach = new Map<number, Uint8Array>();
  private toastAt: Record<string, number> = {};
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
  /** signed town laws (镇规) and the game day of the last signing */
  laws = new Set<LawId>();
  lawDay = -99;
  /** sick beds: seriously ill people under medical cover, and the beds the town has */
  beds = { need: 0, have: 0 };
  /** workplaces kept warm by a warming hut or district heat (refreshed each second) */
  private warmSites = new Set<number>();
  /** warming huts got their fuel last step */
  private hutOk = true;
  lastFeast = -99; lastFuneral = -99; deathsSinceFuneral = 0;
  /** an event waiting for an answer, and an accepted trade order */
  card: EventCard | null = null;
  order: ShipOrder | null = null;

  /** a fixed map by id, or a random map from a numeric seed (old saves) */
  constructor(map: MapId | number, mode: ModeId = 'survival') {
    this.mode = mode;
    this.world = typeof map === 'number' ? new World(MAP_SIZE, map) : new World(0, 0, map);
    this.W = this.world.W;
    this.occ = new Int32Array(this.W * this.W);
    this.pollution = new Float32Array(this.W * this.W);
    this.storage = {} as any; this.supply = {} as any;
    GOOD_IDS.forEach(g => { this.storage[g] = START.goods[g] ?? 0; this.supply[g] = 1; });
    TIER_IDS.forEach(t => { this.workforce[t] = { have: 0, need: 0 }; });
    const d = this.world.depot;
    this.addBuilding('depot', d.x, d.z, this.bestRot('depot', d.x, d.z));
    this.refresh();
    if (mode === 'survival') this.notify(`百日求生：撑过 ${SURVIVAL.days} 天。开头四季还正常，之后一年比一年冷，后来就没有夏天了，只剩短暂的回暖；暴风雪会越来越长，第 ${SURVIVAL.greatFrom} 天起还有一场大寒潮。顶栏的希望归零或不满到 100 就会失败`, 'info', { cat: 'milestone', icon: 'cold' });
  }

  // ---------- calendar ----------
  get totalHours() { return START_HOUR + (this.time / DAY_LENGTH) * 24; }
  get hour() { return this.totalHours % 24; }
  get day() { return Math.floor(this.totalHours / 24); }
  /** change the season length without jumping to another season */
  setSeasonDays(n: number) {
    const pos = this.seasonPos;
    this.seasonDays = n;
    this.time = (pos * 24 * n - START_HOUR) / 24 * DAY_LENGTH;
    this.lastDay = this.day; this.lastSeason = this.season;
  }
  get seasonPos() { return (this.totalHours / 24) / this.seasonDays; }
  /** days since the start, with the fraction */
  get dayF() { return this.totalHours / 24; }
  /** the season the calendar says */
  get calSeason(): SeasonId { return SEASON_IDS[Math.floor(this.seasonPos) % 4]; }
  /**
   * The season the town lives in. In survival the cold eats the calendar: a spring or autumn that is too cold
   * stays winter, and during the great cold everything is winter.
   */
  get season(): SeasonId { return this.seasonAt(this.seasonPos); }
  seasonAt(seasonPos: number): SeasonId {
    const i = Math.floor(seasonPos) % 4, cal = SEASON_IDS[i];
    if (this.mode !== 'survival') return cal;
    if (this.greatK(seasonPos * this.seasonDays) > 0.2) return 'winter';
    if ((cal === 'spring' || cal === 'autumn') && this.seasonMean(seasonPos) < SURVIVAL.winterBelow) return 'winter';
    return cal;
  }
  /** mid temperature of the season seasonPos falls in, without weather, day and night or cold snaps */
  seasonMean(seasonPos: number) {
    const mid = Math.floor(seasonPos) + 0.5;
    return SEASON_TEMP[Math.floor(mid) % 4] - (this.mode === 'survival' ? SURVIVAL.cool * this.chill(mid * this.seasonDays) : 0);
  }
  /** the season's name as players see it: a summer that never warms up is only a thaw */
  seasonName(seasonPos = this.seasonPos) {
    const s = this.seasonAt(seasonPos);
    if (this.mode === 'survival' && s === 'summer' && this.seasonMean(seasonPos) < SURVIVAL.thawBelow) return '回暖';
    return SEASONS[s].name;
  }
  get year() { return Math.floor(this.seasonPos / 4) + 1; }
  get night() {
    const h = this.hour;
    if (h >= 6.5 && h <= 18) return 0;
    if (h > 18 && h < 20.5) return (h - 18) / 2.5;
    if (h >= 4.5 && h < 6.5) return 1 - (h - 4.5) / 2;
    return 1;
  }
  get heatingOn() { return coldness(this.temp) > 0; }
  /** 饱食 the town eats per day, and how many days the food in store lasts */
  foodNeed() { return TIER_IDS.reduce((a, t) => a + this.pop[t] * TIERS[t].hunger, 0) * this.rationMul; }
  get rationMul() { return this.laws.has('ration') ? 1 - LAW_FX.ration : 1; }
  foodStock() { return (Object.keys(FOODS) as FoodId[]).reduce((a, f) => a + this.storage[f] * FOODS[f].fill, 0); }
  foodDays() { const n = this.foodNeed(); return n > 0 ? this.foodStock() / n : Infinity; }
  /** 0..1 how far through the current season */
  get seasonFrac() { return this.seasonPos % 1; }
  /** game seconds until the next season */
  get seasonLeft() { return (1 - this.seasonFrac) * this.seasonDays * DAY_LENGTH; }
  /** day of the current season, 1-based */
  get seasonDay() { return Math.floor(this.seasonFrac * this.seasonDays) + 1; }
  /** 0..1 how far the survival climate has cooled (all the way by the last day) */
  chill(dayF: number) { return Math.max(0, Math.min(1, dayF / SURVIVAL.days)); }
  /** 0..1 how deep into the great cold (大寒潮) this moment is */
  greatK(dayF: number) {
    if (this.mode !== 'survival') return 0;
    const a = SURVIVAL.greatFrom - 1, e = SURVIVAL.days;
    if (dayF < a) return 0;
    if (dayF < e) return Math.min(1, (dayF - a) / 0.6);
    return Math.max(0, 1 - (dayF - e) / SURVIVAL.greatEase);
  }
  get greatCold() { return this.greatK(this.dayF); }
  get greatTemp() { return SURVIVAL.greatTemp * (0.5 + 0.5 * DIFFICULTY[this.difficulty].snap); }
  /** temperature in °C: season curve, day and night, a climate that keeps cooling, cold snaps and the great cold */
  tempAt(seasonPos: number, hour: number) {
    const s = seasonPos - 0.5, i = Math.floor(s), f = s - i;
    const k = f * f * (3 - 2 * f);
    const a = SEASON_TEMP[((i % 4) + 4) % 4], b = SEASON_TEMP[(((i + 1) % 4) + 4) % 4];
    let t = a + (b - a) * k;
    const dayF = seasonPos * this.seasonDays;
    if (this.mode === 'survival') t -= SURVIVAL.cool * this.chill(dayF);
    else {
      const year = Math.floor(seasonPos / 4);
      t -= Math.min(COLDER_MAX, year * COLDER_PER_YEAR) * Math.max(0, Math.min(1, (12 - t) / 18));
    }
    const dn = Math.cos(((hour - 15) / 24) * Math.PI * 2);
    t += 4 * dn;
    t -= this.snapDrop(seasonPos);
    const g = this.greatK(dayF);
    if (g > 0) t += (this.greatTemp + 1.5 * dn - t) * g;
    return t;
  }
  /** how many winter days the cold snap (暴风雪) lasts in a given year: longer as the survival climate cools */
  snapLen(year: number) {
    if (this.mode !== 'survival') return 1;
    const winter = ((year - 1) * 4 + 3) * this.seasonDays;
    return Math.max(1, Math.min(SURVIVAL.blizzardMax, this.seasonDays - 1, 1 + Math.floor(this.chill(winter) * 3.2)));
  }
  /** the winter day (1-based) the cold snap starts on in a given year, or 0 for none */
  snapDay(year: number) {
    if (year < COLD_SNAP.fromYear) return 0;
    const len = this.snapLen(year);
    return Math.min(2 + (year * 5) % Math.max(1, this.seasonDays - 1), this.seasonDays - len + 1);
  }
  /** how many degrees the cold snap takes off at this point of the calendar (eases in and out over a few hours) */
  snapDrop(seasonPos: number) {
    if (Math.floor(seasonPos) % 4 !== 3) return 0;
    if (this.greatK(seasonPos * this.seasonDays) > 0) return 0;
    const year = Math.floor(seasonPos / 4) + 1, sd = this.snapDay(year);
    if (!sd) return 0;
    const len = this.snapLen(year);
    const d = (seasonPos % 1) * this.seasonDays - (sd - 1);
    if (d < 0 || d >= len) return 0;
    const k = Math.min(1, d / 0.15, (len - d) / 0.15);
    return k * Math.min(COLD_SNAP.maxDrop, COLD_SNAP.drop + (year - COLD_SNAP.fromYear) * COLD_SNAP.perYear) * DIFFICULTY[this.difficulty].snap;
  }
  get coldSnap() { return this.snapDrop(this.seasonPos) > 0; }
  /** a blizzard is raging: a cold snap or the great cold */
  get blizzard() { return this.coldSnap || this.greatCold > 0.5; }
  private calcTemp() {
    const w = this.weather;
    const wt = WEATHER_TEMP[w.prev] + (WEATHER_TEMP[w.cur] - WEATHER_TEMP[w.prev]) * w.blend;
    return this.tempAt(this.seasonPos, this.hour) + wt;
  }
  /** 0..1 how well crops grow at the current temperature (survival only) */
  cropFactor() {
    if (this.mode !== 'survival') return 1;
    return Math.max(0, Math.min(1, (this.temp - CROP_TEMP.zero) / (CROP_TEMP.full - CROP_TEMP.zero)));
  }
  /** 0..1 how much of the harbour is still open water (survival only) */
  seaOpen() {
    if (this.mode !== 'survival' || this.temp >= SEA_ICE.from) return 1;
    return Math.max(SEA_ICE.min, 1 - (1 - SEA_ICE.min) * (SEA_ICE.from - this.temp) / (SEA_ICE.from - SEA_ICE.iceAt));
  }
  prodFactor(type: BuildingId) {
    const f = familyOf(type), w = WEATHER[this.weather.cur].prod, s = SEASONS[this.season].prod;
    const ice = this.coldSnap ? COLD_SNAP.fishing[type] ?? 1 : f === 'fishery' ? this.seaOpen() : 1;
    let k = (w[type] ?? w[f] ?? 1) * (s[type] ?? s[f] ?? 1) * ice;
    if (this.blizzard && (OUTDOOR.has(type) || OUTDOOR.has(f))) k *= BLIZZARD_OUTDOOR;
    if (CROPS.has(f)) k *= this.cropFactor();
    return k;
  }
  /** the grid has a power station: optional draws (ELEC_BOOST, cold stores) switch on */
  get gridUp() { return this.era >= 3 && this.plants > 0; }
  /** working power stations last step (a solar farm at night still counts: the grid exists) */
  plants = 0;
  /** extra production share the grid gives this building right now */
  elecBoost(b: Bld) {
    const d = BUILDINGS[b.type];
    return d.elec && d.cycle && !b.elecOff && this.gridUp ? ELEC_BOOST * this.power.boostRatio : 0;
  }
  /** research bonus for a building (upgraded buildings share their line's bonus) */
  prodBonus(type: BuildingId) {
    const def = BUILDINGS[type];
    return (this.mods.prod[type] ?? this.mods.prod[familyOf(type)] ?? 0) + (PROD_CATS.has(def.category) ? this.mods.prodAll : 0);
  }
  /** compost heaps nearby (farms, gardens, greenhouses) */
  boostAt(b: Bld) {
    if (!BOOSTED.has(familyOf(b.type))) return 0;
    const s = this.within(b, (o, d) => !!d.boost && o.working);
    return s ? BUILDINGS[s.type].boost! * s.staff : 0;
  }
  /** a greenhouse keeps warm for free inside a heating plant's range */
  heatedSite(b: Bld) { return !!this.within(b, (o, d) => (!!d.heating || !!d.cogen) && o.working); }

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
  /** footprint, swapped when rotated a quarter turn */
  sizeOf(type: BuildingId, rot = 0): [number, number] { const [w, h] = BUILDINGS[type].size; return rot % 2 ? [h, w] : [w, h]; }
  /** top-left corner when the footprint is centred on the hovered tile */
  anchor(type: BuildingId, hx: number, hz: number, rot = 0) {
    const [w, h] = this.sizeOf(type, rot);
    return { x: hx - Math.floor((w - 1) / 2), z: hz - Math.floor((h - 1) / 2) };
  }
  /** the row of tiles just outside the front (door) side */
  frontCells(x: number, z: number, w: number, h: number, rot: number): [number, number][] {
    switch (rot & 3) {
      case 0: return Array.from({ length: w }, (_, i) => [x + i, z + h]);
      case 1: return Array.from({ length: h }, (_, j) => [x + w, z + j]);
      case 2: return Array.from({ length: w }, (_, i) => [x + i, z - 1]);
      default: return Array.from({ length: h }, (_, j) => [x - 1, z + j]);
    }
  }
  /** water buildings (fisheries, clay pits, hydro) want their front on the water; the rest want a road */
  frontsWater(type: BuildingId) { const n = BUILDINGS[type].needs; return n === 'water' || n === 'river' || type === 'depot'; }
  private frontScore(type: BuildingId, x: number, z: number, rot: number) {
    const [w, h] = this.sizeOf(type, rot);
    const inland = BUILDINGS[type].needs === 'river';
    let s = 0;
    for (const [cx, cz] of this.frontCells(x, z, w, h, rot)) {
      if (this.frontsWater(type)) { if (this.world.inside(cx, cz) && this.world.tile(cx, cz) === Tile.Water && (!inland || !this.world.isOcean(cx, cz))) s++; }
      else if (this.isRoad(cx, cz)) s++;
    }
    return s;
  }
  /** best way to face at a fixed corner, keeping the footprint's turn (parity) */
  bestRot(type: BuildingId, x: number, z: number, parity = 0) {
    const [dw, dh] = BUILDINGS[type].size;
    const opts = dw === dh ? [0, 1, 2, 3] : parity % 2 ? [1, 3] : [0, 2];
    let best = opts[0], bs = 0;
    for (const r of opts) { const s = this.frontScore(type, x, z, r); if (s > bs) { bs = s; best = r; } }
    return best;
  }
  /** automatic facing while placing: try all four directions around the hovered tile */
  autoRot(type: BuildingId, hx: number, hz: number) {
    let best = { rot: 0, ...this.anchor(type, hx, hz, 0) }, bs = 0;
    for (const r of [0, 1, 2, 3]) {
      const a = this.anchor(type, hx, hz, r), s = this.frontScore(type, a.x, a.z, r);
      if (s > bs) { bs = s; best = { rot: r, ...a }; }
    }
    return best;
  }
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
  private pay(c: Cost, label = '建造') {
    this.gold -= c.gold;
    this.ledger.add('gold', 'out', label, c.gold);
    for (const k of GOOD_IDS) if (c[k]) { this.storage[k] -= c[k]!; this.ledger.add(k, 'out', label, c[k]!); }
  }
  private gain(c: Cost, f = 1, label = '拆除返还') {
    this.gold += Math.floor(c.gold * f);
    this.ledger.add('gold', 'in', label, Math.floor(c.gold * f));
    const got: string[] = [];
    for (const k of GOOD_IDS) if (c[k]) {
      const n = Math.min(Math.ceil(c[k]! * f), Math.max(0, Math.floor(this.cap - this.storage[k])));
      this.storage[k] += n;
      this.ledger.add(k, 'in', label, n);
      if (n) got.push(`${n} ${GOODS[k].name}`);
    }
    return [Math.floor(c.gold * f) ? `${Math.floor(c.gold * f)} 金币` : '', ...got].filter(Boolean).join('、');
  }
  /** close or reopen a workplace */
  toggleElec(b: Bld) {
    if (!BUILDINGS[b.type].elec) return;
    b.elecOff = !b.elecOff;
    this.notify(b.elecOff ? `${BUILDINGS[b.type].name}断开了电：不再用电，也没有通电加成` : `${BUILDINGS[b.type].name}接通了电`, 'info');
  }
  togglePause(b: Bld) {
    if (!BUILDINGS[b.type].workers) return;
    b.paused = !b.paused;
    this.notify(b.paused ? `${BUILDINGS[b.type].name}暂停了：工人去别处干活，维护费只收 1/4` : `${BUILDINGS[b.type].name}重新开工`, 'info');
  }

  canPlace(type: BuildingId, x: number, z: number, rot = 0): { ok: boolean; reason?: string } {
    const def = BUILDINGS[type];
    if (!this.unlocked(type)) return { ok: false, reason: this.lockReason(type) };
    const [w, h] = this.sizeOf(type, rot);
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
    if (def.needs === 'iron' && dep < 4) return { ok: false, reason: '必须正好压在一块铁矿上（2×2 的矿点）' };
    if (def.needs === 'coal' && dep < 4) return { ok: false, reason: '必须正好压在一块煤矿上（2×2 的矿点）' };
    if (this.frontsWater(type) && !this.frontScore(type, x, z, rot)) return { ok: false, reason: `${def.name}的正面要朝向水面，按 F 转一下` };
    const m = this.missing(def.cost);
    if (m) return { ok: false, reason: m };
    return { ok: true };
  }

  /** room for a footprint, ignoring cost and unlocks (used when loading old saves) */
  canFit(type: BuildingId, x: number, z: number, rot = 0) {
    const [w, h] = this.sizeOf(type, rot);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, tz = z + j;
      if (!this.world.inside(tx, tz) || this.occ[tz * this.W + tx] !== 0) return false;
      const t = this.world.tile(tx, tz);
      if (t === Tile.Water || t === Tile.Rock) return false;
    }
    return true;
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
  /** rot left out = face the road (or water) automatically, keeping the unturned footprint */
  place(type: BuildingId, x: number, z: number, rot?: number): boolean {
    rot ??= this.bestRot(type, x, z, 0);
    const chk = this.canPlace(type, x, z, rot);
    if (!chk.ok) { this.notify(chk.reason!, 'warn'); return false; }
    this.pay(BUILDINGS[type].cost);
    this.addBuilding(type, x, z, rot);
    this.refresh();
    this.sfx.push('place');
    return true;
  }

  private addBuilding(type: BuildingId, x: number, z: number, rot = 0) {
    const [w, h] = this.sizeOf(type, rot);
    const id = this.nextId++;
    const b: Bld = {
      id, type, x, z, w, h, rot: rot & 3, variant: (x * 7 + z * 13) % 4,
      progress: 0, loaded: false, staff: 0, env: 1, working: false, status: '', connected: false, gen: 0,
      tier: 'peasant', residents: 0, sick: 0, happy: 0, parts: [], needs: [], warm: 1, coldT: 0, growT: 0, cover: new Set(), heaters: [], protect: new Set(), fire: 0, strike: 0, hungerT: 0, fed: 1, plague: 0, paused: false, elecOff: false, priority: false,
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
  /** rivers and lakes can be bridged; the sea cannot */
  isBridge(x: number, z: number) { return this.world.tile(x, z) === Tile.Water; }
  roadTileOk(x: number, z: number) {
    if (!this.world.inside(x, z)) return false;
    const t = this.world.tile(x, z);
    if (t === Tile.Rock || this.occ[z * this.W + x] !== 0) return false;
    if (t !== Tile.Water) return true;
    // bridges span rivers and lakes; never the sea or the shallows right beside it
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.world.tile(x + dx, z + dz) === Tile.Water && this.world.isOcean(x + dx, z + dz)) return false;
    return true;
  }
  placeRoads(tiles: [number, number][]) {
    let n = 0;
    for (const [x, z] of tiles) {
      if (!this.roadTileOk(x, z)) continue;
      const bridge = this.isBridge(x, z);
      const cost = bridge ? BRIDGE_COST : { gold: BUILDINGS.road.cost.gold };
      const m = this.missing(cost);
      if (m) { this.notify(`${m}，${bridge ? '桥' : '路'}没修完`, 'warn'); break; }
      this.pay(cost, bridge ? '修桥' : '修路');
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
      const back = this.gain(BUILDINGS[b.type].cost, REFUND);
      if (back) this.notify(`拆除返还：${back}`, 'info');
      this.remove(b);
      this.sfx.push('demolish');
      return true;
    }
    return false;
  }

  /** turn a placed building where it stands: square ones a quarter turn, others half a turn (the footprint stays) */
  turn(b: Bld) {
    const [dw, dh] = BUILDINGS[b.type].size;
    const step = dw === dh ? 1 : 2;
    let r = b.rot;
    for (let k = 0; k < 4; k += step) {
      r = (r + step) & 3;
      if (!this.frontsWater(b.type) || this.frontScore(b.type, b.x, b.z, r)) break;
    }
    if (r === b.rot) { this.notify(`${BUILDINGS[b.type].name}只能这样朝着水面`, 'warn'); return false; }
    b.rot = r;
    this.bVersion++;
    this.sfx.push('rotate');
    return true;
  }

  /** take a building off the map (demolished or burnt down) */
  private remove(b: Bld) {
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) this.occ[(b.z + j) * this.W + b.x + i] = 0;
    this.buildings.delete(b.id);
    this.bVersion++;
    this.refresh();
  }

  upgradeBlock(b: Bld): string | null {
    if (b.type !== 'house') return this.buildingUpgradeBlock(b);
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
  /**
   * The one problem worth a bubble over this building, most urgent first:
   * bad = something is going wrong, warn = it is stuck, good = good news (a house can upgrade).
   */
  alertOf(b: Bld): { icon: string; level: 'bad' | 'warn' | 'good'; tip: string } | null {
    if (b.type === 'depot') return null;
    if (b.fire > 0) return { icon: 'fire', level: 'bad', tip: '着火了' };
    if (b.type === 'house') {
      if (!b.residents && b.connected) return null;
      if (b.plague > 0) return { icon: 'sick', level: 'bad', tip: '闹瘟疫' };
      if (!b.connected) return { icon: 'noroad', level: 'warn', tip: '没有连上道路' };
      if (b.hungerT > HUNGER.hungrySecs) return { icon: 'hungry', level: 'bad', tip: '吃不饱' };
      if (b.sick > 0 && b.coldT > 0) return { icon: 'sick', level: 'warn', tip: '冻病了' };
      if (this.heatingOn && b.warm < 0.5) return { icon: 'cold', level: 'warn', tip: '没有燃料取暖' };
      if (TIERS[b.tier].upgrade && !this.upgradeBlock(b)) return { icon: 'up', level: 'good', tip: '可以升级' };
      return null;
    }
    const d = BUILDINGS[b.type];
    if (b.strike > 0) return { icon: 'strike', level: 'bad', tip: '罢工' };
    if (b.paused) return { icon: 'paused', level: 'warn', tip: '已暂停' };
    if (!b.connected) return { icon: 'noroad', level: 'warn', tip: '没有连上道路' };
    if (d.workers && b.staff === 0) return { icon: 'noworkers', level: 'warn', tip: b.status };
    const st = b.status;
    if (st === '仓库已满') return { icon: 'full', level: 'warn', tip: st };
    if (st === '没有电' || st.startsWith('电力不足')) return { icon: 'nopower', level: 'warn', tip: st };
    if (st.startsWith('缺少') || st === '附近树木太少') return { icon: 'noinput', level: 'warn', tip: st };
    return null;
  }
  /** why a workplace or public building cannot be upgraded right now (null = it can) */
  private buildingUpgradeBlock(b: Bld): string | null {
    const up = BUILDINGS[b.type].upgrade;
    if (!up) return '已经是最高级';
    const next = BUILDINGS[up.to];
    if (!this.unlocked(up.to)) return `${this.lockReason(up.to)}才能升级为${next.name}`;
    if (b.fire > 0) return '着火了，先救火';
    if (!this.upgradeFits(b, up.to)) return `${next.name}占 ${next.size[0]}×${next.size[1]}，周围要先空出地方`;
    return this.missing(up.cost);
  }
  /** where the next level stands: same facing, front edge kept in place, growing backwards */
  upgradeSpot(b: Bld, to: BuildingId) {
    const [w, h] = this.sizeOf(to, b.rot);
    const r = b.rot & 3;
    const x = r === 1 ? b.x + b.w - w : r === 3 ? b.x : b.x + Math.floor((b.w - w) / 2);
    const z = r === 0 ? b.z + b.h - h : r === 2 ? b.z : b.z + Math.floor((b.h - h) / 2);
    return { x, z, w, h };
  }
  private upgradeFits(b: Bld, to: BuildingId) {
    const { x, z, w, h } = this.upgradeSpot(b, to);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, tz = z + j;
      if (!this.world.inside(tx, tz)) return false;
      const t = this.world.tile(tx, tz), o = this.occ[tz * this.W + tx];
      if (t === Tile.Water || t === Tile.Rock || (o !== 0 && o !== b.id)) return false;
    }
    if (BUILDINGS[to].needs === 'water' && !this.touchesWater(x, z, w, h)) return false;
    return true;
  }
  upgrade(b: Bld, quiet = false) {
    const block = this.upgradeBlock(b);
    if (block) { if (!quiet) this.notify(block, 'warn'); return false; }
    if (b.type !== 'house') {
      const up = BUILDINGS[b.type].upgrade!, from = BUILDINGS[b.type].name;
      this.pay(up.cost, '建筑升级');
      for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) this.occ[(b.z + j) * this.W + b.x + i] = 0;
      const { x, z, w, h } = this.upgradeSpot(b, up.to);
      b.type = up.to; b.x = x; b.z = z; b.w = w; b.h = h; b.progress = 0; b.loaded = false;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = (b.z + j) * this.W + b.x + i;
        this.occ[k] = b.id;
        if (this.world.trees[k]) { this.world.trees[k] = 0; this.tVersion++; }
      }
      this.bVersion++;
      this.refresh();
      this.sfx.push('upgrade');
      if (!quiet) this.notify(`${from}升级为${BUILDINGS[up.to].name}`, 'good', { at: b });
      return true;
    }
    const up = TIERS[b.tier].upgrade!;
    this.pay(up.cost, '住宅升级');
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
  /** what the trade ship pays for one more unit: less the more was sold lately */
  sellPrice(g: GoodId) { return GOODS[g].price * Math.max(GLUT.floor, 1 - (this.glut[g] ?? 0) / GLUT.per); }
  /** in survival the harbour freezes over in a blizzard: no trade ship comes until it passes */
  get harbourFrozen() { return this.mode === 'survival' && this.blizzard; }
  sell(g: GoodId, n: number) {
    if (this.harbourFrozen) { this.notify('暴风雪里港口封冻了，商船进不来，等风雪过去吧', 'warn'); return 0; }
    n = Math.min(n, Math.floor(this.storage[g]));
    if (n <= 0) { this.notify(`仓库里没有${GOODS[g].name}`, 'warn'); return 0; }
    this.storage[g] -= n;
    // each unit sold lowers the price of the next a little
    let pay = 0;
    for (let i = 0; i < n; i++) { pay += this.sellPrice(g); this.glut[g] = (this.glut[g] ?? 0) + 1; }
    pay = Math.round(pay);
    this.gold += pay;
    this.ledger.add(g, 'out', '卖给商船', n); this.ledger.add('gold', 'in', '卖给商船', pay);
    this.sfx.push('coin');
    return n;
  }
  buy(g: GoodId, n: number) {
    if (this.harbourFrozen) { this.notify('暴风雪里港口封冻了，商船进不来，等风雪过去吧。所以风雪前要囤够燃料和食物', 'warn'); return 0; }
    if (GOODS[g].era > this.era) { this.notify(`${ERAS[GOODS[g].era].name}才有商船运${GOODS[g].name}`, 'warn'); return 0; }
    n = Math.min(n, Math.floor(this.cap - this.storage[g]), Math.floor(this.gold / this.buyPrice(g)));
    if (n <= 0) { this.notify(this.storage[g] >= this.cap - 1 ? '仓库已满' : '金币不够', 'warn'); return 0; }
    this.storage[g] += n;
    this.gold -= n * this.buyPrice(g);
    this.ledger.add(g, 'in', '向商船购买', n); this.ledger.add('gold', 'out', '向商船购买', n * this.buyPrice(g));
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
      m.heatLimit += (e.heatLimit ?? 0) * lv;
      m.spoil += (e.spoil ?? 0) * lv;
      if (e.forestNeed) m.forestNeed = Math.min(m.forestNeed, e.forestNeed);
    }
    m.pollution = Math.max(-0.9, m.pollution);
    this.mods = m;
  }

  notify(text: string, kind: Toast['kind'] = 'info', o: { cat?: ToastCat; at?: Bld | { x: number; z: number }; icon?: string } = {}) {
    const at = o.at && 'w' in o.at ? this.center(o.at as Bld) : o.at as { x: number; z: number } | undefined;
    this.toasts.push({ text, kind, cat: o.cat ?? 'action', at, icon: o.icon, day: this.day + 1, hour: this.hour });
    if (kind === 'warn') this.sfx.push(o.cat === 'alert' ? 'alert' : 'error');
  }
  /** something is going badly wrong: the music turns tense */
  get crisis() {
    if (this.fires.size) return true;
    for (const b of this.buildings.values()) if (b.plague > 0) return true;
    for (const t of TIER_IDS) if (this.pop[t] > 8 && this.fedRatio[t] < 0.6) return true;
    return this.debtDays >= STRIKE.debtDays;
  }
  private once(key: string, text: string, kind: Toast['kind'] = 'info', icon?: string) {
    if (this.flags.has(key)) return;
    this.flags.add(key);
    this.notify(text, kind, { cat: 'alert', icon });
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
      if (!BUILDINGS[b.type].storage) return;
      this.forEdge(b, seed);
    });
    while (q.length) {
      const k = q.pop()!, x = k % W, z = (k / W) | 0;
      seed(x + 1, z); seed(x - 1, z); seed(x, z + 1); seed(x, z - 1);
    }
    this.netRoads = net;
    this.buildings.forEach(b => {
      if (BUILDINGS[b.type].storage) { b.connected = true; return; }
      let ok = false;
      this.forEdge(b, (x, z) => { if (net[z * W + x]) ok = true; else { const o = this.at(x, z); if (o && BUILDINGS[o.type].storage) ok = true; } });
      b.connected = ok;
    });
    void hubs;
    // protection (health, fire, police) for every building
    this.reach.clear();
    for (const s of this.buildings.values()) if (s.connected && this.usesRoads(s.type)) this.reach.set(s.id, this.roadReach(s.x, s.z, s.w, s.h, this.roadRange(s.type)));
    const prot = [...this.buildings.values()].filter(s => BUILDINGS[s.type].protects && this.reach.has(s.id));
    this.buildings.forEach(b => {
      b.protect = new Set();
      for (const s of prot) if (s === b || this.touchesMask(b, this.reach.get(s.id)!)) b.protect.add(BUILDINGS[s.type].protects!);
    });
    // cache which services and heating plants reach each house
    const cov = [...this.buildings.values()].filter(s => BUILDINGS[s.type].service || BUILDINGS[s.type].heating || BUILDINGS[s.type].cogen);
    this.buildings.forEach(b => {
      if (b.type !== 'house') return;
      b.cover = new Set(); b.heaters = [];
      const c = this.center(b);
      for (const s of cov) {
        if (!s.connected) continue;
        const d = BUILDINGS[s.type];
        const m = this.reach.get(s.id);
        if (m) { if (!this.touchesMask(b, m)) continue; }
        else { const sc = this.center(s); if (Math.hypot(sc.x - c.x, sc.z - c.z) > this.radiusOf(s)) continue; }
        if (d.service) { b.cover.add(d.service); SERVICE_ALSO[d.service]?.forEach(x => b.cover.add(x)); }
        if (d.heating || d.cogen) b.heaters.push(s);
      }
    });
  }
  /** services spread along the streets (like Anno): road tiles reachable within the range */
  roadRange(type: BuildingId) { return Math.round((BUILDINGS[type].radius ?? 0) * 1.6); }
  usesRoads(type: BuildingId) { const d = BUILDINGS[type]; return !!(d.service && d.service !== 'park') || !!d.protects; }
  /** road tiles a building at (x,z,w,h) reaches; returns a mask (1 = reached) over the map */
  roadReach(x: number, z: number, w: number, h: number, range: number) {
    const W = this.W, mask = new Uint8Array(W * W), dist = new Int16Array(W * W).fill(-1), q: number[] = [];
    const seed = (tx: number, tz: number) => { if (this.isRoad(tx, tz)) { const k = tz * W + tx; if (dist[k] < 0) { dist[k] = 0; q.push(k); } } };
    for (let i = 0; i < w; i++) { seed(x + i, z - 1); seed(x + i, z + h); }
    for (let j = 0; j < h; j++) { seed(x - 1, z + j); seed(x + w, z + j); }
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi]; mask[k] = 1;
      if (dist[k] >= range) continue;
      const tx = k % W, tz = (k / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx, nz = tz + dz;
        if (!this.isRoad(nx, nz)) continue;
        const nk = nz * W + nx;
        if (dist[nk] >= 0) continue;
        dist[nk] = dist[k] + 1; q.push(nk);
      }
    }
    return mask;
  }
  /** does a building touch any reached road tile? */
  touchesMask(b: { x: number; z: number; w: number; h: number }, mask: Uint8Array) {
    const W = this.W;
    const at = (tx: number, tz: number) => this.world.inside(tx, tz) && mask[tz * W + tx] === 1;
    for (let i = 0; i < b.w; i++) if (at(b.x + i, b.z - 1) || at(b.x + i, b.z + b.h)) return true;
    for (let j = 0; j < b.h; j++) if (at(b.x - 1, b.z + j) || at(b.x + b.w, b.z + j)) return true;
    return false;
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
  covered(b: Bld, svc: ServiceId) { return b.type === 'house' ? b.cover.has(svc) : !!this.within(b, (_s, d) => !!d.service && (d.service === svc || !!SERVICE_ALSO[d.service]?.includes(svc))); }
  /** how a home keeps warm: its tier's fuel, district heat if a plant reaches it, coal once firewood can't cope */
  heatKind(b: Bld): HeatKind {
    const f = TIERS[b.tier].fuel;
    if (f === 'power') return 'power';
    if (this.heatedBy(b)) return 'district';
    const coal = this.storage.coal >= 1;
    if (f === 'coal') return coal || this.storage.firewood < 1 ? 'coal' : 'firewood';
    return coal && this.temp < this.heatLimit('firewood') + COAL_SWITCH ? 'coal' : 'firewood';
  }
  /** the coldest temperature a way of heating keeps a home fully warm at */
  heatLimit(k: HeatKind) { return HEAT_LADDER[k].limit - (k === 'firewood' || k === 'coal' ? this.mods.heatLimit - (this.laws.has('fuelsave') ? LAW_FX.fuelLimit : 0) : 0); }
  /** the most warmth (0..1) a way of heating can give at the current temperature */
  heatCap(k: HeatKind, t = this.temp) { return Math.max(0, Math.min(1, 1 - (this.heatLimit(k) - t) / HEAT_LADDER[k].fall)); }
  heatedBy(b: Bld) { return b.heaters.find(s => s.working && this.buildings.has(s.id)); }

  // ---------- work priority and cold workplaces ----------
  /** buildings in staffing order: the player's priority workplaces first */
  private staffOrder() {
    const first: Bld[] = [], rest: Bld[] = [];
    for (const b of this.buildings.values()) (b.priority ? first : rest).push(b);
    return first.length ? first.concat(rest) : rest;
  }
  togglePriority(b: Bld) {
    if (!BUILDINGS[b.type].workers) return;
    b.priority = !b.priority;
    this.notify(b.priority ? `${BUILDINGS[b.type].name}设为优先：缺人时先给它派工人` : `${BUILDINGS[b.type].name}取消优先`, 'info');
  }
  private refreshWarmSites() {
    this.warmSites.clear();
    if (!this.heatingOn) return;
    for (const b of this.buildings.values()) {
      if (!BUILDINGS[b.type].workers) continue;
      if (this.within(b, (o, d) => (!!d.workheat || !!d.heating || !!d.cogen) && o.working)) this.warmSites.add(b.id);
    }
  }
  /** share of a workplace's output lost to the cold (0 when a warming hut or district heat reaches it) */
  chillAt(b: Bld) {
    if (!this.heatingOn || this.warmSites.has(b.id)) return 0;
    const C = WORK_CHILL, k = Math.max(0, Math.min(1, (C.from - this.temp) / (C.from - C.full)));
    if (k <= 0) return 0;
    return Math.min(0.9, C.max * k * (OUTDOOR.has(familyOf(b.type)) ? C.outdoor : 1) * (this.laws.has('warmwear') ? LAW_FX.warmwear : 1));
  }
  warmSite(b: Bld) { return this.warmSites.has(b.id); }

  // ---------- town laws ----------
  /** why a law can't be signed now, or null */
  lawBlock(id: LawId): string | null {
    const L = LAWS[id];
    if (this.laws.has(id)) return '已经签署';
    if (L.era > this.era) return `${ERAS[L.era].name}解锁`;
    if (L.needs && !this.count(L.needs, true)) return `要先建${BUILDINGS[L.needs].name}`;
    const wait = this.lawDay + LAW_GAP - this.dayF;
    if (wait > 0) return `大家还在消化上一条镇规（${Math.ceil(wait * 24)} 小时后可以再签）`;
    if (L.sign?.gold && this.gold < L.sign.gold) return `要 ${L.sign.gold} 金币`;
    return null;
  }
  signLaw(id: LawId) {
    if (this.lawBlock(id)) return false;
    const L = LAWS[id];
    this.laws.add(id);
    this.lawDay = this.dayF;
    if (L.sign?.gold) { this.gold -= L.sign.gold; this.ledger.add('gold', 'out', '镇规·' + L.name, L.sign.gold); }
    if (L.sign?.hope) this.lift(L.sign.hope);
    if (L.sign?.disc) this.discontent = Math.min(100, this.discontent + L.sign.disc);
    this.notify(`签署了镇规「${L.name}」：${L.gain}；代价：${L.cost}`, 'info', { cat: 'milestone', icon: 'ledger' });
    this.sfx.push('quest');
    return true;
  }

  // ---------- feasts and funerals ----------
  feastBlock(): string | null {
    const wait = this.lastFeast + FEAST.gap - this.dayF;
    if (wait > 0) return `${Math.ceil(wait * 24)} 小时后才能再办`;
    if (this.gold < FEAST.gold) return `要 ${FEAST.gold} 金币`;
    if (this.foodStock() < this.feastFood()) return `要 ${Math.ceil(this.feastFood())} 份饱食的食物`;
    return null;
  }
  feastFood() { return Math.max(10, this.foodNeed() * FEAST.food); }
  holdFeast() {
    if (this.feastBlock()) return false;
    let need = this.feastFood();
    for (const f of Object.keys(FOODS) as FoodId[]) {
      if (need <= 0) break;
      const units = Math.min(this.storage[f], need / FOODS[f].fill);
      this.storage[f] -= units; need -= units * FOODS[f].fill;
      this.ledger.add(f, 'out', '节庆', units);
    }
    this.gold -= FEAST.gold; this.ledger.add('gold', 'out', '节庆', FEAST.gold);
    this.lift(FEAST.hope);
    this.discontent = Math.max(0, this.discontent - FEAST.disc);
    this.lastFeast = this.dayF;
    this.notify(`全城办了一场节庆：篝火、热汤和音乐（希望 +${FEAST.hope}，不满 -${FEAST.disc}）`, 'good', { cat: 'milestone', icon: 'star' });
    this.sfx.push('era');
    return true;
  }
  funeralBlock(): string | null {
    if (!this.laws.has('cemetery')) return '要先签署镇规「公墓」';
    if (!this.deathsSinceFuneral) return '上次葬礼以后没有人去世';
    const wait = this.lastFuneral + FUNERAL.gap - this.dayF;
    if (wait > 0) return `${Math.ceil(wait * 24)} 小时后才能再办`;
    if (this.gold < FUNERAL.gold) return `要 ${FUNERAL.gold} 金币`;
    if (this.storage.planks < FUNERAL.planks) return `要 ${FUNERAL.planks} 木板做棺木`;
    return null;
  }
  holdFuneral() {
    if (this.funeralBlock()) return false;
    const n = this.deathsSinceFuneral;
    this.gold -= FUNERAL.gold; this.ledger.add('gold', 'out', '葬礼', FUNERAL.gold);
    this.storage.planks -= FUNERAL.planks; this.ledger.add('planks', 'out', '葬礼', FUNERAL.planks);
    this.lift(FUNERAL.hope);
    this.discontent = Math.max(0, this.discontent - FUNERAL.disc);
    this.deathsSinceFuneral = 0;
    this.lastFuneral = this.dayF;
    this.notify(`为 ${n} 位逝者办了葬礼，大家一起送别（希望 +${FUNERAL.hope}，不满 -${FUNERAL.disc}）`, 'good', { cat: 'milestone', icon: 'star' });
    return true;
  }

  // ---------- events ----------
  /** the lowest class living in town: refugees and survivors join it */
  private baseTier(): TierId { return TIER_IDS.find(t => this.pop[t] > 0) ?? 'peasant'; }
  private roomFor(tier: TierId) {
    let n = 0;
    for (const b of this.buildings.values()) if (b.type === 'house' && b.tier === tier && b.connected) n += Math.max(0, TIERS[tier].cap - b.residents);
    return n;
  }
  /** move `n` people into homes with room; returns how many found a bed */
  private takeIn(tier: TierId, n: number) {
    let left = n;
    for (const b of this.buildings.values()) {
      if (left <= 0) break;
      if (b.type !== 'house' || b.tier !== tier || !b.connected) continue;
      const k = Math.min(left, TIERS[tier].cap - b.residents);
      if (k > 0) { b.residents += k; b.growT = 0; left -= k; }
    }
    return n - left;
  }
  private rollEvent() {
    const d = this.day + 1, pop = TIER_IDS.reduce((a, t) => a + this.pop[t], 0);
    const kinds: EventKind[] = [];
    if (!this.harbourFrozen && pop >= 10) kinds.push('refugees');
    if (!this.harbourFrozen && !this.order) kinds.push('order');
    if (this.season === 'winter' && d >= 15) kinds.push('wreck');
    if (!kinds.length) return;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (kind === 'refugees') {
      const tier = this.baseTier(), n = Math.round(5 + Math.random() * Math.min(30, pop * 0.06)), room = this.roomFor(tier);
      this.card = { kind, day: this.dayF, title: '港口来了难民', text: `${n} 个从北边逃难来的人挤在码头上，又冷又饿，有几个在咳嗽。他们求你收留。现在${TIERS[tier].name}的住宅还有 ${room} 个空位。`,
        options: [
          { label: '全部收留', note: `住进空房当${TIERS[tier].name}，希望 +6；没地方住的会离开；可能带来瘟疫` },
          { label: '只收健康的', note: `收留约一半，希望 +2` },
          { label: '拒绝', note: '希望 -4，不满 +3' },
        ], data: { n, tier } };
    } else if (kind === 'order') {
      const pool = GOOD_IDS.filter(g => GOODS[g].era <= this.era && !['wood', 'clay', 'ore', 'wool', 'grain', 'flour', 'cloth'].includes(g));
      const good = pool[Math.floor(Math.random() * pool.length)];
      const n = Math.max(10, Math.round((12 + this.era * 10) * (0.7 + Math.random() * 0.6) / Math.max(1, GOODS[good].price / 6)));
      const gold = Math.round(GOODS[good].price * n * 2.2 + 50);
      const rare = (['tools', 'steel', 'coal', 'cans'] as GoodId[]).filter(g => GOODS[g].era <= this.era && g !== good);
      const bonus = rare.length && Math.random() < 0.6 ? { good: rare[Math.floor(Math.random() * rare.length)], n: 8 + this.era * 2 } : undefined;
      const days = 3;
      this.card = { kind, day: this.dayF, title: '商船的订单', text: `商船船长想在 ${days} 天内收到 ${n} ${GOODS[good].name}（现在库存 ${Math.floor(this.storage[good])}）。按时交货付 ${gold} 金币${bonus ? `，外加 ${bonus.n} ${GOODS[bonus.good].name}` : ''}。`,
        options: [
          { label: '接单', note: `${days} 天内在「镇规」面板或这张卡片上交货；过期会让大家失望（希望 -2）` },
          { label: '不接', note: '没有影响' },
        ], data: { good, n, gold, bonus, days } };
    } else {
      this.card = { kind, day: this.dayF, title: '冰面上的沉船', text: '渔民在海冰上发现了一艘被冻住的货船。船上也许还有煤、钢材和金币，也许还有活人。可冰面随时会裂。',
        options: [
          { label: '派人去搜', note: '大概率找到物资或幸存者，也可能有人掉进冰窟窿' },
          { label: '不去', note: '没有影响' },
        ], data: {} };
    }
    this.notify(`${this.card.title}：在右边的卡片上做决定`, 'info', { cat: 'alert', icon: kind === 'order' ? 'box' : kind === 'wreck' ? 'cold' : 'people' });
    this.sfx.push('bell');
  }
  answerCard(i: number, lapsed = false) {
    const c = this.card;
    if (!c) return;
    this.card = null;
    const D = c.data;
    if (c.kind === 'refugees') {
      if (i === 2) {
        this.hope = Math.max(0, this.hope - 4); this.discontent = Math.min(100, this.discontent + 3);
        this.notify(lapsed ? '没人去码头接难民，他们在寒风里离开了（希望 -4，不满 +3）' : '你拒绝了难民，他们在寒风里离开了（希望 -4，不满 +3）', 'warn', { cat: 'alert', icon: 'people' });
        return;
      }
      const want = i === 0 ? D.n : Math.ceil(D.n / 2), got = this.takeIn(D.tier, want);
      const lift = Math.round((i === 0 ? 6 : 2) * got / want);
      this.lift(lift);
      if (!got) { this.notify('想收留难民，可城里没有空房：他们只好继续往南走了。多盖些房子', 'warn', { cat: 'alert', icon: 'people' }); return; }
      if (i === 0 && got > 0 && Math.random() < 0.35) {
        const hs = [...this.buildings.values()].filter(b => b.type === 'house' && b.residents > 0 && b.tier === D.tier);
        if (hs.length) hs[Math.floor(Math.random() * hs.length)].plague = 0.01;
        this.notify('有个难民带着病：瘟疫在城里传开了', 'warn', { cat: 'alert', icon: 'sick' });
      }
      this.notify(`收留了 ${got} 个难民${got < want ? `，另外 ${want - got} 人没地方住，只好离开（多盖些房子）` : ''}${lift ? `（希望 +${lift}）` : ''}`, 'good', { cat: 'milestone', icon: 'people' });
    } else if (c.kind === 'order') {
      if (i !== 0) { if (!lapsed) this.notify('你谢绝了商船的订单', 'info'); return; }
      this.order = { good: D.good, n: D.n, gold: D.gold, bonus: D.bonus, due: this.dayF + D.days };
      this.notify(`接下订单：${D.days} 天内交 ${D.n} ${GOODS[D.good as GoodId].name}`, 'info', { cat: 'alert', icon: 'box' });
    } else if (c.kind === 'wreck') {
      if (i !== 0) return;
      const r = Math.random();
      if (r < 0.55) {
        const coal = 15 + Math.round(Math.random() * 25), gold = 100 + Math.round(Math.random() * 150);
        this.storage.coal = Math.min(this.cap, this.storage.coal + coal); this.ledger.add('coal', 'in', '沉船', coal);
        this.gold += gold; this.ledger.add('gold', 'in', '沉船', gold);
        let steel = 0;
        if (this.era >= 2) { steel = 4 + Math.round(Math.random() * 6); this.storage.steel = Math.min(this.cap, this.storage.steel + steel); }
        this.notify(`搜船的人回来了：带回 ${coal} 煤、${gold} 金币${steel ? `、${steel} 钢材` : ''}`, 'good', { cat: 'milestone', icon: 'coal' });
      } else if (r < 0.8) {
        const got = this.takeIn(this.baseTier(), 4);
        this.lift(4);
        this.notify(`船舱里还有活人！救回 ${got || 4} 个幸存者${got < 4 ? '（没有空房，有人只好跟船走）' : ''}（希望 +4）`, 'good', { cat: 'milestone', icon: 'people' });
      } else {
        let n = 3;
        for (const b of this.buildings.values()) { if (n <= 0) break; if (b.type === 'house' && b.residents > 1) { b.residents--; n--; this.flowLeft.cold++; this.lost(); } }
        this.hope = Math.max(0, this.hope - 3);
        this.notify('冰面裂开了，有 3 个去搜船的人没能回来（希望 -3）', 'warn', { cat: 'alert', icon: 'cold' });
      }
    }
  }
  deliverOrder() {
    const o = this.order;
    if (!o || this.storage[o.good] < o.n) return false;
    this.storage[o.good] -= o.n; this.ledger.add(o.good, 'out', '商船订单', o.n);
    this.gold += o.gold; this.ledger.add('gold', 'in', '商船订单', o.gold);
    if (o.bonus) { this.storage[o.bonus.good] = Math.min(this.cap, this.storage[o.bonus.good] + o.bonus.n); this.ledger.add(o.bonus.good, 'in', '商船订单', o.bonus.n); }
    this.lift(2);
    this.order = null;
    this.notify(`订单交货了：收到 ${o.gold} 金币${o.bonus ? `和 ${o.bonus.n} ${GOODS[o.bonus.good].name}` : ''}（希望 +2）`, 'good', { cat: 'milestone', icon: 'gold' });
    this.sfx.push('quest');
    return true;
  }
  /** each new day: lapse unanswered cards and late orders, maybe start something new */
  private stepEvents() {
    if (this.card && this.dayF - this.card.day >= EVENTS.lapse) this.answerCard(this.card.options.length - 1, true);
    if (this.order && this.dayF > this.order.due) {
      this.hope = Math.max(0, this.hope - 2);
      this.notify(`没能按时交 ${this.order.n} ${GOODS[this.order.good].name}，商船失望地开走了（希望 -2）`, 'warn', { cat: 'alert', icon: 'box' });
      this.order = null;
    }
    if (!this.card && this.day + 1 >= EVENTS.from && !this.over && Math.random() < EVENTS.perDay) this.rollEvent();
  }

  /** what the next winter (or the great cold) will eat and burn, against what is in store */
  winterStock() {
    const [a, b] = this.winterSpan();
    const days = (b - a) * this.seasonDays;
    return { from: a, days, food: this.foodNeed() * days, foodHave: this.foodStock(), fuel: this.winterFuelEstimate(), fuelHave: this.storage.firewood + (this.era >= 2 ? this.storage.coal : 0) };
  }

  // ---------- simulation ----------
  update(realDt: number) {
    this.acc += Math.min(realDt, 0.25) * this.speed;
    while (this.acc >= STEP) { this.acc -= STEP; this.step(STEP); }
  }

  /** advance the simulation by `seconds` of game time without the frame cap (used by tests) */
  advance(seconds: number) { for (let t = 0; t < seconds; t += STEP) this.step(STEP); }

  private step(dt: number) {
    if (this.over && !this.over.won) return;
    this.time += dt;
    this.stepWeather(dt);
    this.temp = this.calcTemp();
    this.ledger.tick(dt);
    this.slowT += dt;
    if (this.slowT >= 1) { this.slowT = 0; this.replant(); this.computePollution(); this.checkEra(); this.checkQuest(); this.refreshWarmSites(); }

    // ---- population & workforce (sick people stay home)
    TIER_IDS.forEach(t => { this.pop[t] = 0; });
    const remain = {} as Record<TierId, number>;
    TIER_IDS.forEach(t => { remain[t] = 0; });
    this.buildings.forEach(b => {
      if (b.type !== 'house') return;
      this.pop[b.tier] += b.residents;
      // the sick stay home; hungry people only manage half a day's work
      const able = Math.max(0, b.residents - b.sick) * (b.hungerT > HUNGER.hungrySecs ? 0.5 : 1);
      remain[b.tier] += b.fire > 0 ? 0 : Math.floor(able);
    });
    TIER_IDS.forEach(t => { this.workforce[t] = { have: remain[t], need: 0 }; });

    const broke = this.gold < 0;
    if (broke) this.once('broke', '金库空了！工人领不到工钱会不开心，拖久了会罢工。卖掉多余的货物或拆掉闲置的建筑', 'warn', 'gold');
    else this.flags.delete('broke');
    const powerRatio = this.power.ratio, gridUp = this.gridUp, diff = DIFFICULTY[this.difficulty];
    let upkeep = 0, gen = 0, use = 0, boostUse = 0, coldCap = 0, rp = 0, plants = 0;
    const W = WEATHER[this.weather.cur];

    for (const b of this.staffOrder()) {
      const def = BUILDINGS[b.type];
      if (def.powerGen && b.connected && !b.paused) plants++;
      // idle workshops (no staff, no input, strike, fire) only cost a quarter
      const fee = (def.workers && (!b.working || b.paused) ? def.upkeep * 0.25 : def.upkeep) * diff.upkeep;
      upkeep += fee;
      this.ledger.add('gold', 'out', `维护·${def.name}`, fee / 60 * dt);
      b.gen = 0;
      if (b.type === 'house' || b.type === 'road') continue;
      if (b.paused) { b.staff = 0; b.working = false; b.status = '已暂停：工人去别处干活了'; continue; }
      // staffing
      if (def.workers) {
        const need = this.workersFor(b.type);
        this.workforce[def.workers.tier].need += need;
        const got = b.connected ? Math.min(need, remain[def.workers.tier]) : 0;
        remain[def.workers.tier] -= got;
        b.staff = got / need;
      } else b.staff = b.connected ? 1 : 0;
      // a powered warehouse is a cold store
      if (def.storage && def.elec && b.connected && gridUp && !b.elecOff) { boostUse += def.elec; coldCap += def.storage * this.power.boostRatio; }
      if (def.workheat) {
        b.working = b.connected && this.heatingOn && this.hutOk;
        b.status = !b.connected ? '没有连上道路' : !this.heatingOn ? '待命（天冷了才生火）' : this.hutOk ? '生着火：附近的工人不冻手' : '缺柴火，炉子灭了';
        continue;
      }
      if (!def.workers && !def.powerGen && !def.cycle && !def.heating && def.pollution === undefined) {
        b.working = b.connected;
        b.status = !b.connected ? '没有连上道路' : def.storage && def.elec && gridUp && !b.elecOff ? (this.power.boostRatio > 0.95 ? '通电冷藏：鱼、菜、面包坏得慢' : `冷藏电力不足 (${Math.round(this.power.boostRatio * 100)}%)`) : '';
        continue;
      }
      if (!b.connected) { b.status = '没有连上道路'; b.working = false; continue; }
      if (b.fire > 0) { b.status = '着火了！'; b.working = false; continue; }
      if (b.strike > 0) { b.strike = Math.max(0, b.strike - dt); b.status = `罢工中（还有 ${Math.ceil(b.strike)} 秒）`; b.working = false; continue; }
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
        const sp = SEASONS[this.season].prod;
        b.status = ((sp[b.type] ?? sp[familyOf(b.type)]) === 0) ? `${SEASONS[this.season].name}季休耕` : CROPS.has(familyOf(b.type)) && this.cropFactor() === 0 ? '太冷了，庄稼不长' : `${W.name}，暂停作业`;
        b.working = false; continue;
      }
      if (def.needs === 'forest') {
        const t = this.treesAround(b, def.radius!);
        b.env = t < 3 ? 0 : Math.min(1, t / this.mods.forestNeed);
        if (b.env === 0) { b.status = '附近树木太少'; b.working = false; continue; }
      } else if (POLLUTION_HURTS.has(familyOf(b.type))) {
        const c = this.center(b), p = this.pollutionAt(c.x, c.z);
        b.env = 1 - Math.min(0.5, Math.max(0, (p - 20) / 80));
      } else b.env = 1;
      const out = def.output;
      if (out && this.storage[out] >= this.cap - 0.001) { b.status = '仓库已满'; b.working = false; continue; }
      if (!b.loaded) {
        const input: Partial<Record<GoodId, number>> = { ...def.input };
        if (def.winterFuel && this.heatingOn && !this.heatedSite(b)) input.coal = (input.coal ?? 0) + def.winterFuel;
        const lack = Object.entries(input).find(([g, n]) => this.storage[g as GoodId] < (n as number));
        if (lack) { b.status = lack[0] === 'coal' && def.winterFuel && !def.input?.coal ? '天冷了，缺煤保温' : `缺少${GOODS[lack[0] as GoodId].name}`; b.working = false; continue; }
        for (const [g, n] of Object.entries(input)) { this.storage[g as GoodId] -= n as number; this.ledger.add(g, 'out', def.name, n as number); }
        b.loaded = true;
      }
      let pf = 1;
      if (def.power) { use += def.power * b.staff; pf = powerRatio; if (pf < 0.05) { b.status = '没有电'; b.working = false; continue; } }
      if (def.powerGen) { b.gen = def.powerGen * b.staff; gen += b.gen; }
      const eb = this.elecBoost(b);
      if (def.elec && gridUp && !b.elecOff) boostUse += def.elec * b.staff;
      const mult = 1 + this.prodBonus(b.type) + this.boostAt(b) + eb + (def.workers && this.laws.has('extshift') ? LAW_FX.prod : 0);
      const chill = def.workers ? this.chillAt(b) : 0;
      b.progress += (dt / def.cycle) * b.staff * b.env * wf * pf * mult * (1 - chill);
      if (b.progress >= 1) {
        b.progress -= 1;
        b.loaded = false;
        if (out) {
          const n = def.outQty ?? 1;
          this.ledger.add(out, 'in', def.name, Math.min(n, this.cap - this.storage[out]));
          this.storage[out] = Math.min(this.cap, this.storage[out] + n);
          this.events.push({ id: b.id, good: out, n });
        }
      }
      b.working = true;
      const pct = Math.round((wf * b.env * mult - 1) * 100);
      b.status = staffNote || (pf < 0.99 ? `电力不足 (${Math.round(pf * 100)}%)` : chill > 0.05 ? `天太冷，工人冻得干不动（-${Math.round(chill * 100)}%）` : def.powerGen ? `发电 ${b.gen.toFixed(0)}` : Math.abs(pct) >= 1 ? `运转中（${pct > 0 ? '+' : ''}${pct}%${eb > 0.01 ? '，通电' : ''}）` : '运转中');
    }

    // ---- food: each tier eats what it likes from the shared store, spread across the kinds in stock
    for (const t of [...TIER_IDS].reverse()) {
      const T = TIERS[t];
      let need = this.pop[t] * T.hunger * this.rationMul / DAY_LENGTH * dt;   // 饱食 this step
      if (need <= 0) { this.fedRatio[t] = 1; continue; }
      const want = need;
      for (let pass = 0; pass < 2 && need > 1e-9; pass++) {
        const avail = T.foods.filter(f => this.storage[f] > 1e-6);
        if (!avail.length) break;
        const share = need / avail.length;
        for (const f of avail) {
          const units = Math.min(this.storage[f], share / FOODS[f].fill);
          this.storage[f] -= units;
          need -= units * FOODS[f].fill;
          this.ledger.add(f, 'out', `${T.name}吃掉`, units);
        }
      }
      this.fedRatio[t] = Math.max(0, Math.min(1, 1 - need / want));
    }
    // ---- comforts (happiness only)
    const demand: Partial<Record<GoodId, number>> = {};
    const byTier: Partial<Record<GoodId, [TierId, number][]>> = {};
    TIER_IDS.forEach(t => {
      for (const [g, r] of Object.entries(TIERS[t].comforts)) {
        const d = this.pop[t] * (r as number) / 60 * dt;
        demand[g as GoodId] = (demand[g as GoodId] ?? 0) + d;
        (byTier[g as GoodId] ??= []).push([t, d]);
      }
    });
    GOOD_IDS.forEach(g => {
      const d = demand[g];
      if (!d) { this.supply[g] += ((this.storage[g] >= 1 ? 1 : 0) - this.supply[g]) * Math.min(1, dt / 4); return; }
      const ratio = Math.min(1, this.storage[g] / d);
      this.storage[g] = Math.max(0, this.storage[g] - d * ratio);
      for (const [t, dd] of byTier[g]!) this.ledger.add(g, 'out', `${TIERS[t].name}使用`, dd * ratio);
      this.supply[g] += (ratio - this.supply[g]) * Math.min(1, dt / 4);
    });

    // ---- winter heating: work out what every house burns, then draw it from storage
    const cold = coldness(this.temp);
    const heat = cold > 0, heatMul = Math.max(0.2, 1 + this.mods.heating) * cold;
    const heatBase: Partial<Record<GoodId | 'power', number>> = {};
    const fuelNeed: Partial<Record<GoodId | 'power', number>> = {};
    const houseFuel = new Map<Bld, [GoodId | 'power', number, HeatKind]>();
    for (const b of this.buildings.values()) {
      if (b.type !== 'house' || !b.residents) continue;
      const kind = this.heatKind(b), L = HEAT_LADDER[kind], fuel = L.fuel as GoodId | 'power';
      const base = b.residents * (fuel === 'power' ? POWER_HEAT_PER_RESIDENT : HEAT_PER_RESIDENT) * L.per * Math.max(0.2, 1 + this.mods.heating) * (this.laws.has('fuelsave') && fuel !== 'power' ? 1 - LAW_FX.fuelsave : 1);
      const rate = base * cold;
      houseFuel.set(b, [fuel, rate, kind]);
      fuelNeed[fuel] = (fuelNeed[fuel] ?? 0) + rate;
      heatBase[fuel] = (heatBase[fuel] ?? 0) + base;
    }
    // warming huts burn coal when there is some, else firewood
    let huts = 0;
    for (const b of this.buildings.values()) if (BUILDINGS[b.type].workheat && b.connected) huts++;
    const hutFuel: GoodId = this.era >= 2 && this.storage.coal >= 1 ? 'coal' : 'firewood';
    if (huts) {
      const base = huts * WORK_CHILL.hutFuel * (hutFuel === 'coal' ? HEAT_LADDER.coal.per : 1);
      fuelNeed[hutFuel] = (fuelNeed[hutFuel] ?? 0) + base * cold;
      heatBase[hutFuel] = (heatBase[hutFuel] ?? 0) + base;
    }
    this.heatNeed = fuelNeed;
    this.heatBase = heatBase;
    const fuelOk: Partial<Record<GoodId | 'power', number>> = {};
    for (const [f, rate] of Object.entries(fuelNeed) as [GoodId | 'power', number][]) {
      if (!heat) { fuelOk[f] = 1; continue; }
      if (f === 'power') { use += rate; fuelOk[f] = powerRatio; continue; }
      const d = rate / 60 * dt;
      const r = Math.min(1, this.storage[f] / d);
      this.storage[f] = Math.max(0, this.storage[f] - d * r);
      this.ledger.add(f, 'out', '取暖', d * r);
      fuelOk[f] = r;
    }
    this.hutOk = (fuelOk[hutFuel] ?? 1) > 0.3;

    // electric light for the tiers that want it, more after dark
    let light = 0;
    if (this.era >= 3) for (const t of TIER_IDS) light += this.pop[t] * (TIERS[t].light ?? 0);
    light *= LIGHT.day + (LIGHT.night - LIGHT.day) * this.night;
    use += light;
    const spare = Math.max(0, gen - use);
    this.plants = plants;
    this.power = {
      gen, use: use + boostUse, must: use, boost: boostUse, light,
      ratio: use > 0 ? Math.min(1, gen / use) : 1,
      boostRatio: boostUse > 0 ? Math.min(1, spare / boostUse) : 1,
      cold: this.cap > 0 ? Math.min(1, coldCap / this.cap) : 0,
    };
    if (use > gen + 0.01 && use > 0) this.throttle('power', 240, gen > 0.01 ? '停电了：发电跟不上，住户没有电灯、用电的工厂按比例减产。多建发电站，或者关掉一些工厂的通电增产' : '城里还没有电：技工和市民想要电灯，研究蒸汽机后建燃煤电厂吧', 'warn', undefined, 'power');
    if (gridUp && boostUse > 0 && this.power.boostRatio < 0.5) this.once('boost', '电不够分：工厂的通电增产和仓库冷藏只能用剩下的电。多建发电站，或在信息面板里关掉一些建筑的通电', 'info', 'power');
    else if (this.power.boostRatio > 0.9) this.flags.delete('boost');

    // ---- spoilage: fresh food rots in store; powered warehouses keep it cold
    const rot = diff.spoil * Math.max(0.1, 1 + this.mods.spoil) * (this.season === 'summer' ? SPOIL_SUMMER : 1) * (1 - COLD_STORE * this.power.cold);
    for (const [g, r] of Object.entries(SPOIL) as [GoodId, number][]) {
      const n = this.storage[g] * r * rot / 60 * dt;
      if (n <= 0) continue;
      this.storage[g] -= n;
      this.ledger.add(g, 'out', '腐烂', n);
    }

    // ---- houses: happiness, growth, sickness, tax
    let tax = 0, happySum = 0, houses = 0, coldHouses = 0, hungryHouses = 0;
    // sick beds: last step's patients share this step's beds
    let bedsHave = 0, bedsNeed = 0;
    for (const s of this.buildings.values()) {
      const d = BUILDINGS[s.type];
      if (!d.beds || !s.connected || s.paused || s.fire > 0) continue;
      bedsHave += d.beds * (d.workers ? s.staff : 1) * (this.laws.has('extrabeds') ? 1 + LAW_FX.beds : 1);
    }
    const bedShare = this.beds.need > 0 ? Math.min(1, bedsHave / this.beds.need) : 1;
    const lawHappy = (this.laws.has('ration') ? LAW_FX.rationHappy : 0) + (this.laws.has('fuelsave') ? LAW_FX.fuelHappy : 0) + (this.laws.has('curfew') ? LAW_FX.curfewHappy : 0);
    const beaten: Partial<Record<HeatKind, number>> = {};
    const comfortSupply = (gs: GoodId[]) => gs.length ? gs.reduce((a, g) => a + (this.storage[g] >= 1 ? 1 : this.supply[g]), 0) / gs.length : 1;
    for (const b of this.buildings.values()) {
      if (b.type !== 'house') continue;
      const T = TIERS[b.tier];
      const com = Object.keys(T.comforts) as GoodId[];
      // electric light counts as one more comfort once the town reaches the industrial era
      const lit = T.light && this.era >= 3 ? (this.power.gen > 0.01 ? this.power.ratio : 0) : -1;
      const comN = com.length + (lit >= 0 ? 1 : 0);
      const comV = comN ? (com.reduce((a, g) => a + (this.storage[g] >= 1 ? 1 : this.supply[g]), 0) + Math.max(0, lit)) / comN : 1;
      // food: how full they are, and how many of their favourite foods are on the shelf
      b.fed += (this.fedRatio[b.tier] - b.fed) * Math.min(1, dt / 2);
      const kinds = T.foods.filter(f => this.storage[f] >= 0.5);
      const joy = kinds.reduce((a, f) => a + FOODS[f].joy, 0) / T.foods.reduce((a, f) => a + FOODS[f].joy, 0);
      const foodV = b.fed * (0.55 + 0.45 * joy);
      const svc = T.services.map(s => b.connected && this.covered(b, s) ? 1 : 0);
      const svcV = svc.reduce((a: number, v) => a + v, 0) / T.services.length;
      const c = this.center(b);
      const pol = this.pollutionAt(c.x, c.z);
      const park = this.covered(b, 'park') ? 3 : 0;
      const envV = Math.max(0, 1 - pol / 60);
      // warmth eases towards the share of fuel that arrived
      const hf = houseFuel.get(b);
      const ok = hf ? (fuelOk[hf[0]] ?? 1) : 1;
      // a chilly evening without fuel is bearable; a freezing one is not
      // and however much fuel arrives, a stove can only hold off so much cold (the heating ladder)
      const warmGoal = heat && hf ? Math.min(ok + (1 - ok) * Math.max(0, 1 - cold * 2), this.heatCap(hf[2])) : 1;
      b.warm += (warmGoal - b.warm) * Math.min(1, dt / 3);
      if (heat && hf && b.residents && this.heatCap(hf[2]) < 0.6) beaten[hf[2]] = (beaten[hf[2]] ?? 0) + 1;
      const healthV = b.residents ? 1 - b.sick / b.residents : 1;
      const debtPen = this.gold < 0 ? Math.min(DEBT.max, DEBT.base + this.debtDays * DEBT.perDay) : 0;
      b.parts = [
        { label: '食物', value: foodV * 30, max: 30 },
        { label: '舒适品', value: comV * 15, max: 15 },
        { label: '公共服务', value: svcV * 20, max: 20 },
        { label: '环境', value: Math.min(10, envV * 10 + park), max: 10 },
        { label: '温暖', value: b.warm * 15, max: 15 },
        { label: '健康', value: healthV * 10, max: 10 },
      ];
      if (debtPen) b.parts.push({ label: '欠薪', value: -debtPen, max: 0 });
      if (lawHappy) b.parts.push({ label: '镇规', value: -lawHappy, max: 0 });
      if (b.fire > 0) b.parts.push({ label: '火灾', value: -40, max: 0 });
      b.needs = [
        ...T.foods.map(f => ({ label: GOODS[f].name, value: this.storage[f] >= 0.5 ? 1 : 0 })),
        ...com.map(g => ({ label: GOODS[g].name, value: this.storage[g] >= 1 ? 1 : this.supply[g] })),
        ...(lit >= 0 ? [{ label: '电灯', value: lit }] : []),
        ...T.services.map((s, i) => ({ label: SERVICES[s], value: svc[i] })),
      ];
      let happy = b.parts.reduce((a, p) => a + p.value, 0) + this.mods.happiness;
      happy = Math.max(0, Math.min(100, happy));
      b.happy = b.connected ? happy / 100 : 0;
      // hunger: short of food for a while -> weak; longer -> families leave
      if (b.residents && b.fed < 0.8) b.hungerT += dt; else b.hungerT = Math.max(0, b.hungerT - dt * 2);
      // the cold: sickness after 30 s, people leave after 90 s
      if (heat && b.warm < 0.5 && b.residents) {
        b.coldT += dt; coldHouses++;
      } else b.coldT = Math.max(0, b.coldT - dt * (b.protect.has('health') ? 3 : 1.5));
      const sickShare = Math.max(b.coldT > 30 ? 0.5 : 0, b.plague > 0 ? PLAGUE.sickShare : 0, b.hungerT > HUNGER.leaveSecs ? 0.3 : 0) * Math.max(0.1, 1 + this.mods.sickness);
      b.sick = Math.min(b.residents, Math.round(b.residents * sickShare));
      // the seriously ill (frostbite, plague) need a bed; without one some die (survival)
      const severe = b.coldT > 30 || b.plague > 0 ? b.sick : 0;
      const careOk = b.protect.has('health');
      if (careOk) bedsNeed += severe;
      if (severe && this.mode === 'survival') {
        const untreated = severe * (careOk ? 1 - bedShare : b.plague > 0 ? 0 : 1);
        if (untreated > 0 && Math.random() < untreated * SICKBED.die * dt) {
          b.residents--;
          if (b.plague > 0) this.flowLeft.plague++; else this.flowLeft.cold++;
          this.lost();
          if (careOk) this.throttle('beds', 90, `病床不够了：${Math.round(this.beds.need)} 个重病人只有 ${Math.round(bedsHave)} 张床，没床的人会死。多建草药铺或诊所，或签署「病房加床」`, 'warn', b, 'sick');
          else this.throttle('nocare', 90, '冻伤的病人没有医疗照顾，有人死了。在住宅附近建草药铺', 'warn', b, 'sick');
        }
      }
      // growth
      const hp = b.happy * 100;
      let target = !b.connected ? 0 : hp >= 60 ? T.cap : Math.max(1, Math.round(T.cap * Math.max(0.25, (hp - 10) / 50)));
            if (b.coldT > (this.mode === 'survival' ? FREEZE.after : 90)) target = Math.min(target, Math.max(0, b.residents - 1));
      // long hunger: the household shrinks to what the food can feed
      if (b.hungerT > HUNGER.leaveSecs) target = Math.min(target, b.fed < 0.05 ? 0 : Math.ceil(T.cap * Math.min(1, b.fed / 0.8)));
      if (hp < 20 && b.connected) target = Math.min(target, Math.max(1, b.residents - 1));
      if (b.fire > 0) target = b.residents;
      b.growT += dt;
      // nobody moves into a hungry, burning or sick street
      const pantry = T.foods.reduce((a, f) => a + this.storage[f] * FOODS[f].fill, 0);
      const welcoming = (b.fed >= 0.9 && pantry >= T.hunger * 2 || this.pop[b.tier] < 12 && b.hungerT < HUNGER.hungrySecs) && b.fire === 0 && b.plague === 0 && b.coldT < 30 && this.hope >= MOOD.noArrivals;
      if (b.residents < target && b.growT >= 4 && welcoming) { b.residents++; b.growT = 0; }
      else if (b.residents > target && b.growT >= (b.hungerT > HUNGER.leaveSecs ? (this.mode === 'survival' ? FREEZE.starveSecs : 12) : b.coldT > 90 && this.mode === 'survival' ? FREEZE.secs : 6)) { b.residents--; b.growT = 0; if (b.hungerT > HUNGER.leaveSecs) { this.flowLeft.hunger++; this.lost(); } else if (b.coldT > 90) { this.flowLeft.cold++; this.lost(); } }
      if (b.residents < 0) b.residents = 0;
      if (b.residents === target) b.growT = Math.min(b.growT, 4);
      b.status = !b.connected ? '没有连上道路' : b.fire > 0 ? '着火了！' : b.plague > 0 ? '闹瘟疫，有人病倒了' : b.hungerT > HUNGER.leaveSecs ? '饿得受不了，有人要搬走' : b.hungerT > HUNGER.hungrySecs ? '吃不饱，干活没力气' : b.coldT > 30 ? '天太冷，有人生病了' : b.warm < 0.5 && heat ? '家里没有燃料取暖' : this.gold < 0 ? '领不到工钱' : hp >= 80 ? '生活美满' : hp >= 50 ? '还算满意' : '日子不好过';
      const t1 = b.fire > 0 || b.hungerT > HUNGER.hungrySecs ? 0 : (b.residents - b.sick) * T.tax * diff.tax * (hp / 100) * (hp > 80 ? 1.2 : 1) * this.taxMood * (this.laws.has('vespers') ? 1 - LAW_FX.vespersTax : 1);
      tax += t1;
      this.ledger.add('gold', 'in', `${T.name}税收`, t1 / 60 * dt);
      happySum += hp; houses++;
      if (b.residents && b.hungerT > HUNGER.hungrySecs) hungryHouses++;
    }
    this.happyAvg = houses ? happySum / houses : 0;
    this.beds = { need: bedsNeed, have: bedsHave };
    this.stepMood(dt, houses ? coldHouses / houses : 0, houses ? hungryHouses / houses : 0);
    this.stepDisasters(dt);
    this.stepDay();
    // the cold has outgrown the way some homes heat: say what the next rung of the ladder is
    for (const [k, n] of Object.entries(beaten) as [HeatKind, number][]) {
      const next = k === 'firewood' ? (this.era >= 2 ? '建炭窑或煤矿，有煤以后住户会自动换成煤炉（能扛到 ' + Math.round(this.heatLimit('coal')) + '°C）' : '进入手工业时代就能烧煤') : k === 'coal' ? (this.era >= 3 ? '研究集中供暖建煤炉房，或在燃煤电厂旁边住（余热供暖，能扛到 ' + Math.round(this.heatLimit('district')) + '°C）' : '进入工业时代就能集中供暖') : '';
      if (next) this.throttle('beaten-' + k, 90, `太冷了：${n} 户人家的${HEAT_LADDER[k].name}只能扛到 ${Math.round(this.heatLimit(k))}°C，烧再多也暖不起来。${next}`, 'warn', undefined, 'cold');
    }
    if (coldHouses > 0) { if (this.mode === 'survival') this.throttle('coldHouses', 60, `有 ${coldHouses} 户人家没有燃料取暖，再冻下去会死人！快补充${this.era >= 3 ? '柴火或煤' : '柴火'}，或向商船买`, 'warn', undefined, 'cold'); else this.once('cold' + this.year, `有 ${coldHouses} 户人家没有燃料取暖！快补充${this.era >= 3 ? '柴火或煤' : '柴火'}`, 'warn', 'cold'); }

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
        this.notify(`研究完成：${TECHS[cur].name}${TECHS[cur].infinite ? ` ${this.techLevel(cur)} 级` : ''} — ${TECHS[cur].desc}`, 'good', { cat: 'milestone', icon: 'research' });
        if (!TECHS[cur].infinite) this.research.current = null;
        this.bVersion++;
      }
    }

    if (this.laws.has('warmwear')) { upkeep += LAW_FX.warmwearGold; this.ledger.add('gold', 'out', '镇规·发棉衣', LAW_FX.warmwearGold / 60 * dt); }
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

  /** a toast at most once every `gap` game seconds per key */
  private throttle(key: string, gap: number, text: string, kind: Toast['kind'] = 'warn', at?: Bld, icon?: string) {
    if ((this.toastAt[key] ?? -1e9) + gap > this.time) return false;
    this.toastAt[key] = this.time;
    this.notify(text, kind, { cat: 'alert', at, icon });
    return true;
  }
  private houseNear(b: Bld, r: number) {
    const c = this.center(b), out: Bld[] = [];
    for (const o of this.buildings.values()) {
      if (o === b) continue;
      const oc = this.center(o);
      if (Math.hypot(oc.x - c.x, oc.z - c.z) <= r) out.push(o);
    }
    return out;
  }

  // ---------- hope, discontent, and how the game ends ----------
  /** tax share left after discontent */
  get taxMood() { return 1 - MOOD.taxLoss * this.discontent / 100; }
  /** someone froze, starved or died of plague */
  private lost() {
    this.winterLog.left++;
    if (this.mode !== 'survival') return;
    this.deaths++; this.winterLog.deaths++; this.deathsSinceFuneral++;
    const share = MOOD.deathPop / Math.max(MOOD.deathPop, TIER_IDS.reduce((a, t) => a + this.pop[t], 0)) * (this.laws.has('cemetery') ? LAW_FX.cemetery : 1);
    this.hope = Math.max(0, this.hope - MOOD.deathHope * share);
    this.discontent = Math.min(100, this.discontent + MOOD.deathDisc * share);
  }
  private lift(hope: number) { this.hope = Math.min(100, this.hope + hope); }
  private wasBlizzard = false;
  /** where hope and discontent are heading, for the UI */
  moodTarget = { hope: MOOD.hope0, disc: MOOD.disc0 };
  private stepMood(dt: number, coldShare: number, hungryShare: number) {
    const pop = TIER_IDS.reduce((a, t) => a + this.pop[t], 0);
    this.peakPop = Math.max(this.peakPop, pop);
    this.winterLog.minTemp = Math.min(this.winterLog.minTemp, this.temp);
    const blz = this.blizzard;
    if (this.wasBlizzard && !blz && this.greatCold === 0) {
      this.lift(MOOD.stormHope);
      this.notify('暴风雪过去了！大家松了一口气（希望 +' + MOOD.stormHope + '）', 'good', { cat: 'milestone', icon: 'warm' });
    }
    this.wasBlizzard = blz;
    if (this.peakPop < 8) return;           // nobody to hope or complain yet
    const per = dt / DAY_LENGTH, M = MOOD;
    const dT = this.moodTarget.disc = Math.max(0, Math.min(100, Math.max(0, (M.calm - this.happyAvg) * M.discHappy) + coldShare * M.coldDisc + hungryShare * M.hungerDisc + (this.gold < 0 ? M.debtDisc : 0) + (this.laws.has('extshift') ? LAW_FX.shiftDisc : 0) + (this.laws.has('extrabeds') ? LAW_FX.bedsDisc : 0)));
    this.discontent += (dT - this.discontent) * Math.min(1, (dT > this.discontent ? M.discUp : M.discDown) * per);
    const hT = this.moodTarget.hope = Math.max(0, Math.min(100, M.hopeBase + (this.happyAvg - 50) * M.hopeHappy - (this.coldSnap ? M.blizzardHope : 0) - this.greatCold * M.greatHope + (this.laws.has('vespers') ? LAW_FX.vespersHope : 0)));
    this.hope += (hT - this.hope) * Math.min(1, M.hopeRate * per);
    if (this.mode !== 'survival' || this.over) return;
    if (this.discontent >= M.warnDisc) this.throttle('disc', 120, `不满已经到 ${Math.round(this.discontent)}：到 100 居民就会造反。让大家吃饱穿暖，别欠薪`, 'warn', undefined, 'strike');
    if (this.hope <= M.warnHope) this.throttle('hope', 120, `希望只剩 ${Math.round(this.hope)}：归零大家就会弃城出海。让日子好过些，撑过暴风雪会好起来`, 'warn', undefined, 'sick');
    const end = (won: boolean, reason: string) => { this.over = { won, reason }; this.speed = 0; this.sfx.push(won ? 'era' : 'season'); };
    if (this.discontent >= 100) end(false, '不满爆发了：居民涌上街头，把你赶下了台。');
    else if (this.hope <= 0) end(false, '人们失去了希望，一家家坐船离开了暖港。');
    else if (pop === 0) end(false, '暖港已经空无一人。');
    else if (!this.won && this.dayF >= SURVIVAL.days) {
      this.won = true;
      end(true, `暖港撑过了 ${SURVIVAL.days} 天和大寒潮！现在有 ${pop} 位居民${this.deaths ? `，一路上失去了 ${this.deaths} 人` : '，一个人都没有失去'}。`);
      this.notify(`撑过了 ${SURVIVAL.days} 天！之后是无尽模式：天不会再变暖，暴风雪每年都来`, 'good', { cat: 'milestone', icon: 'star' });
    }
  }
  /** close the end card: after a win the town carries on (endless) */
  continueEndless() { if (this.over?.won) { this.over = null; this.speed = 1; } }

  // ---------- fire, plague, crime and strikes ----------
  private stepDisasters(dt: number) {
    const day = dt / DAY_LENGTH * DIFFICULTY[this.difficulty].disaster;
    const settled = this.time > DAY_LENGTH * 2;       // a grace period at the start
    const wx = this.weather.cur;
    const wet = wx === 'rain' || wx === 'storm' || wx === 'snow';
    const fireMul = wet ? 0.3 : (this.season === 'summer' && wx === 'sunny') ? 1.7 : this.season === 'summer' ? 1.3 : 1;
    // fire
    this.fires.clear();
    for (const b of [...this.buildings.values()]) {
      const d = BUILDINGS[b.type];
      if (b.type === 'depot') continue;
      if (b.fire > 0) {
        b.fire += dt * (wet ? 0.7 : 1);
        if (b.protect.has('fire') && b.fire > FIRE.putOutSecs) { b.fire = 0; this.throttle('putout', 10, `消防队扑灭了${b.type === 'house' ? '住宅' : d.name}的火`, 'good', b, 'fire'); continue; }
        if (Math.random() < FIRE.spread * dt / FIRE.burnSecs) {
          const nb = this.houseNear(b, Math.max(b.w, b.h) / 2 + 2.2).filter(o => o.fire === 0 && o.type !== 'depot');
          if (nb.length) { const o = nb[Math.floor(Math.random() * nb.length)]; o.fire = 0.01; this.throttle('spread', 8, '火势蔓延到了隔壁！', 'warn', o, 'fire'); }
        }
        if (b.fire > FIRE.burnSecs) {
          if (b.type === 'house') this.flowLeft.fire += b.residents;
          this.notify(`${b.type === 'house' ? TIERS[b.tier].name + '的住宅' : d.name}被烧毁了${b.protect.has('fire') ? '' : '——那里没有消防队'}`, 'warn', { cat: 'alert', at: b, icon: 'fire' });
          this.sfx.push('demolish');
          this.remove(b);
          continue;
        }
        this.fires.add(b.id);
      } else if (settled && b.connected) {
        const base = b.type === 'house' ? FIRE.house * (b.tier === 'peasant' ? 1.2 : b.tier === 'worker' ? 1 : b.tier === 'technician' ? 0.6 : 0.4)
          : (d.pollution ?? 0) >= 10 ? FIRE.polluter : FIRE.other;
        if (Math.random() < base * fireMul * (b.protect.has('fire') ? FIRE.coverMul : 1) * day) {
          b.fire = 0.01;
          this.fires.add(b.id);
          this.notify(`${b.type === 'house' ? TIERS[b.tier].name + '的住宅' : d.name}着火了！${b.protect.has('fire') ? '消防队正在赶来' : '附近没有消防队，快想办法'}`, 'warn', { cat: 'alert', at: b, icon: 'fire' });
          this.sfx.push('bell');
        }
      }
    }
    // plague
    const houses = [...this.buildings.values()].filter(b => b.type === 'house' && b.residents > 0);
    const total = houses.reduce((a, b) => a + b.residents, 0);
    if (settled && !houses.some(h => h.plague > 0) && houses.length) {
      const dense = Math.max(0.3, Math.min(2, total / 200));
      if (Math.random() < PLAGUE.perDay * (this.season === 'winter' ? PLAGUE.winterMul : 1) * dense * day) {
        const h = houses[Math.floor(Math.random() * houses.length)];
        h.plague = 0.01;
        this.notify(`瘟疫爆发了！病人会传染给邻居。${h.protect.has('health') ? '草药铺正在治疗' : '那一带没有医疗覆盖'}`, 'warn', { cat: 'alert', at: h, icon: 'sick' });
        this.sfx.push('error');
      }
    }
    // an emptied house airs out: nobody left to be ill, so the plague there is over
    for (const h of this.buildings.values()) if (h.type === 'house' && h.plague > 0 && h.residents <= 0) h.plague = 0;
    for (const h of houses) {
      if (h.plague <= 0) continue;
      h.plague += dt;
      const cured = h.protect.has('health') ? PLAGUE.cureCovered : PLAGUE.cureBare;
      if (h.plague > cured) { h.plague = 0; continue; }
      if (!h.protect.has('health') && Math.random() < PLAGUE.leavePerSec * dt && h.residents > 0) { h.residents--; this.flowLeft.plague++; this.lost(); }
      for (const o of this.houseNear(h, 3.5)) {
        if (o.type !== 'house' || o.plague > 0 || !o.residents) continue;
        if (Math.random() < PLAGUE.spreadPerSec * dt * (o.protect.has('health') ? 0.2 : 1)) o.plague = 0.01;
      }
    }
    // crime: unhappy households steal when nobody keeps order
    if (this.era >= 2) {
      for (const h of houses) {
        if (h.happy * 100 >= CRIME.below) continue;
        if (Math.random() >= CRIME.perHouseDay * (h.protect.has('police') ? CRIME.coverMul : 1) * (this.laws.has('curfew') ? LAW_FX.curfew : 1) * day * (1 + (CRIME.below - h.happy * 100) / 20)) continue;
        const goods = GOOD_IDS.filter(g => this.storage[g] >= 6);
        if (goods.length && Math.random() < 0.7) {
          const g = goods[Math.floor(Math.random() * goods.length)];
          const n = Math.ceil(this.storage[g] * (0.05 + Math.random() * 0.1));
          this.storage[g] -= n;
          this.ledger.add(g, 'out', '被偷走', n);
          this.throttle('theft', 30, `小偷从仓库偷走了 ${n} ${GOODS[g].name}${h.protect.has('police') ? '' : '（那一带没有巡警）'}`, 'warn', h, 'thief');
        } else if (this.gold > 0) {
          const n = Math.min(this.gold, 20 + Math.round(Math.random() * 40));
          this.gold -= n;
          this.ledger.add('gold', 'out', '被偷走', n);
          this.throttle('theft', 30, `有人撬开了钱箱，丢了 ${n} 金币`, 'warn', h, 'thief');
        }
      }
    }
    // strikes: unpaid or very unhappy workers down tools
    const tierHappy: Partial<Record<TierId, [number, number]>> = {};
    for (const h of houses) { const a = (tierHappy[h.tier] ??= [0, 0]); a[0] += h.happy * 100 * h.residents; a[1] += h.residents; }
    const unpaid = this.gold < 0 && this.debtDays >= STRIKE.debtDays;
    for (const b of this.buildings.values()) {
      const wk = BUILDINGS[b.type].workers;
      if (!wk || b.strike > 0 || !b.working) continue;
      const th = tierHappy[wk.tier];
      const avg = th && th[1] ? th[0] / th[1] : 100;
      const angry = this.discontent >= MOOD.strikeAt;
      if (!unpaid && avg >= STRIKE.below && !angry) continue;
      if (Math.random() < (angry && !unpaid && avg >= STRIKE.below ? 0.3 : 0.6) * day) {
        b.strike = STRIKE.secs;
        this.throttle('strike', 20, `${BUILDINGS[b.type].name}的${TIERS[wk.tier].name}罢工了：${unpaid ? '已经好几天领不到工钱' : avg < STRIKE.below ? '日子过得太苦' : '全城不满情绪高涨'}`, 'warn', b, 'strike');
      }
    }
    // full storage stops workshops
    const stuck = [...this.buildings.values()].find(b => b.status === '仓库已满');
    if (stuck) {
      const out = BUILDINGS[stuck.type].output;
      this.throttle('full', 90, `${out ? GOODS[out].name : '货物'}堆满了仓库，${BUILDINGS[stuck.type].name}只好停工。多建仓库${this.era >= 2 ? '（或大型仓库）' : ''}，或者卖给商船`, 'warn', stuck, 'full');
    }
    // hunger and cold warnings
    for (const t of TIER_IDS) if (this.pop[t] && this.fedRatio[t] < 0.8) this.throttle('hunger', 40, `${TIERS[t].name}吃不饱了！多建渔场、菜园，或者向商船买食物`, 'warn', undefined, 'hungry');
  }

  /** at dawn of each new day: a short report and the debt clock */
  private stepDay() {
    const d = this.day;
    if (d === this.lastDay) return;
    const pop = TIER_IDS.reduce((a, t) => a + this.pop[t], 0);
    const dg = Math.round(this.gold - this.dayStart.gold), dp = pop - this.dayStart.pop;
    this.days.push({ day: this.lastDay + 1, gold: dg, pop, food: this.foodDays() });
    if (this.days.length > 30) this.days.shift();
    const left = this.flowLeft, lost = left.hunger + left.cold + left.plague + left.fire;
    const sv = this.mode === 'survival';
    const why = [left.hunger && `${sv ? '饿死' : '饿走'} ${left.hunger}`, left.cold && `${sv ? '冻死' : '冻走'} ${left.cold}`, left.plague && `${sv ? '病逝' : '病倒'} ${left.plague}`, left.fire && `火灾 ${left.fire}`].filter(Boolean).join('，');
    const fd = this.foodDays();
    this.notify(`第 ${this.lastDay + 1} 天结束：金币 ${dg >= 0 ? '+' : ''}${dg}，人口 ${pop}（${dp >= 0 ? '+' : ''}${dp}）${lost ? `，${sv ? '失去' : '离开'} ${lost} 人（${why}）` : ''}。食物${fd === Infinity ? '充足' : `还够吃 ${fd.toFixed(1)} 天`}`, lost || dg < 0 ? 'warn' : 'info', { cat: 'report', icon: 'ledger' });
    this.debtDays = this.gold < 0 ? this.debtDays + 1 : 0;
    if (this.debtDays >= 1) this.notify(`金库已经亏空 ${this.debtDays} 天：大家越来越不满${this.debtDays >= STRIKE.debtDays ? '，工人开始罢工' : '，明天起工人会罢工'}`, 'warn', { cat: 'alert', icon: 'strike' });
    this.flowLeft = { hunger: 0, cold: 0, plague: 0, fire: 0 };
    this.dayStart = { gold: this.gold, pop };
    for (const k of Object.keys(this.glut) as GoodId[]) this.glut[k]! *= 1 - GLUT.fade;
    // blizzards: warn the day before, announce it when it comes
    const snapOn = (day: number) => this.snapDrop((day + 0.5) / this.seasonDays);
    const run = (from: number) => { let n = 0; while (n < 9 && snapOn(from + n) > 0) n++; return n; };
    if (snapOn(d + 1) > 0 && !(snapOn(d) > 0)) this.notify(`暴风雪预警：明天起要刮 ${run(d + 1)} 天，气温骤降约 ${Math.round(snapOn(d + 1))}°C。取暖燃料要多烧好几成，田地、伐木场和黏土坑只能干两成半的活，港口结冰渔船大多出不了海${this.mode === 'survival' ? '，商船也进不来' : ''}。今天多囤柴火、煤和食物`, 'warn', { cat: 'alert', icon: 'cold' });
    if (snapOn(d) > 0 && !(snapOn(d - 1) > 0)) this.notify(`暴风雪来了！要刮 ${run(d)} 天，撑过去`, 'warn', { cat: 'milestone', icon: 'cold' });
    // the great cold
    if (this.mode === 'survival') {
      const shown = d + 1, G = SURVIVAL;
      if (shown >= G.greatWarn && shown < G.greatFrom) this.notify(`大寒潮还有 ${G.greatFrom - shown} 天：第 ${G.greatFrom} 天起气温会跌到 ${Math.round(this.greatTemp)}°C 上下，一直冻到第 ${G.days} 天以后。户外几乎停工、港口封冻（商船也来不了），要囤够 ${G.days - G.greatFrom + 2} 天的食物和燃料（大约是平常冬天的两三倍）`, 'warn', { cat: shown === G.greatWarn ? 'milestone' : 'alert', icon: 'cold' });
      if (shown === G.greatFrom) this.notify(`大寒潮来了！撑到第 ${G.days} 天`, 'warn', { cat: 'milestone', icon: 'cold' });
      if (shown > G.greatFrom && shown <= G.days) this.notify(`大寒潮第 ${shown - G.greatFrom + 1} 天：离第 ${G.days} 天还有 ${G.days - shown + 1} 天`, 'info', { cat: 'alert', icon: 'cold' });
    }
    this.stepEvents();
    this.lastDay = d;
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
    this.lift(MOOD.eraHope);
    this.sfx.push('era');
    this.notify(`进入${ERAS[g.era].name}！${ERAS[g.era].desc}`, 'good', { cat: 'milestone', icon: 'star' });
    this.bVersion++;
  }
  private checkQuest() {
    const q = QUESTS[this.questIndex];
    if (!q || !q.done(this)) return;
    this.gain(q.reward, 1, '目标奖励');
    this.questIndex++;
    this.lift(MOOD.questHope);
    this.sfx.push('quest');
    const reward = [q.reward.gold ? `${q.reward.gold} 金币` : '', ...GOOD_IDS.filter(k => q.reward[k]).map(k => `${q.reward[k]} ${GOODS[k].name}`)].filter(Boolean).join('、');
    this.notify(reward ? `目标完成：${q.text}　奖励 ${reward}` : `目标完成：${q.text}`, 'good', { cat: 'milestone', icon: 'check' });
  }

  private lastSeason: SeasonId | null = null;
  private lastCal: SeasonId | null = null;
  /** the stretch of winter ahead (or the one we are in), in seasonPos: [start, end] */
  winterSpan(): [number, number] {
    const q = 1 / (this.seasonDays * 4);   // a quarter of a day
    let p = this.seasonPos;
    for (let i = 0; i < 4 * 4 * this.seasonDays && this.seasonAt(p) !== 'winter'; i++) p += q;
    const start = p;
    for (let i = 0; i < 12 * 4 * this.seasonDays && this.seasonAt(p) === 'winter'; i++) p += q;
    return [start, p];
  }
  /** the autumn notice: how cold, how long, how many blizzard days, what to stock */
  winterForecast() {
    const [a, b] = this.winterSpan();
    const days = (b - a) * this.seasonDays;
    let min = 99, blz = 0;
    for (let p = a; p < b; p += 0.25 / this.seasonDays) {
      min = Math.min(min, this.tempAt(p, 5));
      if (this.snapDrop(p) > 0 || this.greatK(p * this.seasonDays) > 0.5) blz += 0.25;
    }
    const food = this.foodNeed() * days;
    return `冬天快到了：要冷 ${Math.round(days)} 天，最低约 ${Math.round(min)}°C${blz ? `，其中暴风雪 ${Math.round(blz)} 天` : ''}。田地会封冻，渔场减产。全城要吃约 ${Math.ceil(food)} 份饱食（现在库存 ${Math.floor(this.foodStock())}），还要烧约 ${Math.ceil(this.winterFuelEstimate())} 份燃料`;
  }
  private winterReport() {
    const w = this.winterLog, sv = this.mode === 'survival';
    const lost = sv ? w.deaths : w.left;
    if (sv && !lost) this.lift(MOOD.winterHope);
    this.notify(`熬过了这个冬天：最冷 ${Math.round(w.minTemp)}°C，${lost ? `${sv ? '失去了' : '走了'} ${lost} 人` : `${sv ? `一个人都没有失去（希望 +${MOOD.winterHope}）` : '一个人都没有走'}`}`, lost ? 'warn' : 'good', { cat: 'report', icon: 'warm' });
  }
  private stepWeather(dt: number) {
    const s = this.season, cal = this.calSeason;
    if (this.lastSeason && s !== this.lastSeason) {
      const thaw = this.seasonName() === '回暖';
      this.notify(`${cal === 'spring' ? `第 ${this.year} 年，` : ''}${thaw ? '回暖期到了：难得暖和几天，田地能长一点庄稼，抓紧囤粮和燃料' : `${SEASONS[s].name}天到了：${SEASONS[s].effect}`}`, 'good', { cat: 'milestone', icon: s });
      if (this.lastSeason === 'winter') this.winterReport();
      if (s === 'winter') this.winterLog = { deaths: 0, minTemp: 99, left: 0 };
      // the last mild season before a winter: what the winter will ask for
      if (s !== 'winter' && this.seasonAt(Math.floor(this.seasonPos) + 1.5) === 'winter') this.notify(this.winterForecast(), 'warn', { cat: 'alert', icon: 'cold' });
      this.sfx.push('season');
      const mapped = SEASONS[s].weather[this.weather.cur];
      if (mapped) this.setWeather(mapped);
    } else if (this.lastCal && cal !== this.lastCal && s === 'winter') {
      this.notify(`${cal === 'spring' ? `第 ${this.year} 年，本该是春天了` : cal === 'autumn' ? '本该是秋天了' : `本该是${SEASONS[cal].name}天了`}，可天还是冷得像冬天：田地照旧封冻`, 'warn', { cat: 'milestone', icon: 'cold' });
    }
    this.lastSeason = s; this.lastCal = cal;
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
    // average coldness over the coming winter, sampled through the days and nights
    const [start, end] = this.winterSpan();
    let c = 0, n = 0;
    for (let p = start; p < end; p += 0.02) { c += coldness(this.tempAt(p, (p * this.seasonDays * 24) % 24)); n++; }
    const minutes = (end - start) * this.seasonDays * DAY_LENGTH / 60;
    let tot = 0;
    for (const [f, r] of Object.entries(this.heatBase)) if (f !== 'power') tot += r! * (n ? c / n : 0) * minutes;
    return tot;
  }
  setWeather(next: WeatherId) {
    const w = this.weather;
    const [a, b] = WEATHER[next].duration;
    w.left = a + Math.random() * (b - a);
    if (next === w.cur) return;
    w.prev = w.cur; w.cur = next; w.blend = 0;
    const d = WEATHER[next];
    this.notify(`天气转为${d.name}${d.effect !== '一切正常' ? `：${d.effect}` : ''}`, 'info', { cat: 'report', icon: this.weather.cur });
  }

  // ---------- save ----------
  serialize() {
    const roads: number[] = [];
    this.occ.forEach((o, i) => { if (o === -1) roads.push(i); });
    return JSON.stringify({
      v: 2, rf: 1, seasonDays: this.seasonDays, diff: this.difficulty, mode: this.mode,
      mood: { hope: this.hope, disc: this.discontent, deaths: this.deaths, peak: this.peakPop, won: this.won, over: this.over, glut: this.glut, winter: this.winterLog },
      town: { laws: [...this.laws], lawDay: this.lawDay, feast: this.lastFeast, funeral: this.lastFuneral, mourn: this.deathsSinceFuneral, card: this.card, order: this.order }, seed: this.world.seed, map: this.world.mapId, weather: this.weather.cur, gold: this.gold, time: this.time, quest: this.questIndex, era: this.era,
      research: { current: this.research.current, points: this.research.points, levels: this.research.levels, saved: this.research.saved },
      storage: this.storage, roads,
      b: [...this.buildings.values()].filter(b => b.type !== 'depot').map(b => [b.type, b.x, b.z, b.tier, b.residents, b.progress, b.paused ? 1 : 0, b.rot, b.elecOff ? 1 : 0, b.priority ? 1 : 0]),
    });
  }
  static load(json: string): Game | null {
    try {
      const s = JSON.parse(json);
      if (s.v !== 2) return null;
      // saves from before 百日求生 carry on as the sandbox they were
      const g = new Game(isMapId(s.map) ? s.map : s.seed, s.mode in MODES ? s.mode : 'sandbox');
      if (s.mood) {
        const m = s.mood;
        g.hope = m.hope ?? g.hope; g.discontent = m.disc ?? g.discontent; g.deaths = m.deaths ?? 0; g.peakPop = m.peak ?? 0;
        g.won = !!m.won; g.over = m.over ?? null; g.glut = m.glut ?? {}; if (m.winter) g.winterLog = m.winter;
      }
      if (s.town) {
        const t = s.town;
        g.laws = new Set((t.laws ?? []).filter((k: string) => k in LAWS)); g.lawDay = t.lawDay ?? -99;
        g.lastFeast = t.feast ?? -99; g.lastFuneral = t.funeral ?? -99; g.deathsSinceFuneral = t.mourn ?? 0;
        g.card = t.card ?? null; g.order = t.order ?? null;
      }
      g.gold = s.gold; g.time = s.time; if (s.seasonDays) g.seasonDays = s.seasonDays; if (s.diff in DIFFICULTY) g.difficulty = s.diff; g.questIndex = s.quest; g.era = s.era ?? 1;
      if (s.research) { g.research.current = s.research.current; g.research.points = s.research.points; g.research.levels = s.research.levels ?? {}; g.research.saved = s.research.saved ?? {}; }
      if (s.weather && s.weather in WEATHER) { g.weather.cur = g.weather.prev = s.weather; }
      GOOD_IDS.forEach(k => { g.storage[k] = s.storage[k] ?? 0; });
      for (const i of s.roads) { g.occ[i] = -1; g.world.trees[i] = 0; }
      // buildings that grew since the save (each upgrade line now has one footprint) may not fit where they
      // stood: place everything else first, then try them again shifted by a tile
      const grown: typeof s.b = [];
      for (const [pass, list] of [[0, s.b], [1, grown]] as const) for (const [type, x0, z0, tier, res, prog, paused, rot, eoff, prio] of list) {
        if (!(type in BUILDINGS)) continue;
        const spot = (pass ? [[-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1]] : [[0, 0]]).find(([dx, dz]) => g.canFit(type, x0 + dx, z0 + dz, rot ?? 0));
        if (!spot) { if (!pass) grown.push([type, x0, z0, tier, res, prog, paused, rot, eoff, prio]); continue; }
        const x = x0 + spot[0], z = z0 + spot[1];
        // saves before free facing only stored the turn (0/1); pick the side facing the road like they used to
        const b = g.addBuilding(type, x, z, s.rf ? rot ?? 0 : g.bestRot(type, x, z, rot ?? 0));
        b.tier = tier; b.residents = res; b.progress = prog; b.paused = !!paused; b.elecOff = !!eoff; b.priority = !!prio;
      }
      g.rVersion++; g.tVersion++;
      g.refresh();
      g.lastSeason = g.season; g.lastCal = g.calSeason;
      g.lastDay = g.day;
      g.dayStart = { gold: g.gold, pop: 0 };
      // settle the derived state (staffing, power, pollution) before the first frame
      const over = g.over; g.over = null;
      for (let i = 0; i < 12; i++) { g.step(STEP); }
      g.over = over; if (over) g.speed = 0;
      for (let i = 0; i < 8; i++) g.computePollution();
      g.toasts.length = 0; g.sfx.length = 0; g.events.length = 0;
      return g;
    } catch { return null; }
  }
}
