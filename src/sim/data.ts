// All gameplay numbers live here. Rates are per game-minute unless noted; the UI shows them per day
// (one day = DAY_LENGTH seconds = 4 game-minutes).
// See the design document for the reasoning behind each system.

// ---------- goods ----------
export type GoodId =
  | 'wood' | 'planks' | 'fish' | 'veg' | 'grain' | 'wool'
  | 'firewood' | 'clay' | 'bricks' | 'flour' | 'bread' | 'cloth' | 'clothes' | 'ore' | 'tools'
  | 'coal' | 'steel' | 'cans' | 'beer'
  | 'cement' | 'appliances';
export const GOOD_IDS: GoodId[] = ['wood', 'planks', 'fish', 'veg', 'grain', 'wool', 'firewood', 'clay', 'bricks', 'flour', 'bread', 'cloth', 'clothes', 'ore', 'tools', 'coal', 'steel', 'cans', 'beer', 'cement', 'appliances'];
/** price: what the harbour trader pays per unit; buying costs BUY_MARKUP times as much */
export const GOODS: Record<GoodId, { name: string; era: Era; price: number }> = {
  wood: { name: '木材', era: 1, price: 2 }, planks: { name: '木板', era: 1, price: 4 }, fish: { name: '鱼', era: 1, price: 3 }, veg: { name: '蔬菜', era: 1, price: 2 }, grain: { name: '小麦', era: 1, price: 2 }, wool: { name: '羊毛', era: 1, price: 3 },
  firewood: { name: '柴火', era: 1, price: 3 }, clay: { name: '黏土', era: 2, price: 2 }, bricks: { name: '砖', era: 2, price: 6 }, flour: { name: '面粉', era: 2, price: 4 }, bread: { name: '面包', era: 2, price: 7 },
  cloth: { name: '布', era: 2, price: 6 }, clothes: { name: '衣服', era: 2, price: 10 }, ore: { name: '铁矿石', era: 2, price: 5 }, tools: { name: '工具', era: 2, price: 12 },
  coal: { name: '煤', era: 3, price: 5 }, steel: { name: '钢', era: 3, price: 15 }, cans: { name: '罐头', era: 3, price: 12 }, beer: { name: '啤酒', era: 3, price: 8 },
  cement: { name: '水泥', era: 4, price: 14 }, appliances: { name: '电器', era: 4, price: 25 },
};
export const BUY_MARKUP = 2.5;

// ---------- food ----------
/** fill: how much hunger one unit stills (饱食); joy: how much people like it */
export type FoodId = 'fish' | 'veg' | 'bread' | 'cans';
export const FOODS: Record<FoodId, { fill: number; joy: number }> = {
  fish: { fill: 1, joy: 1 }, veg: { fill: 1, joy: 1 }, bread: { fill: 2, joy: 1.5 }, cans: { fill: 3, joy: 1.5 },
};
export const FOOD_IDS = Object.keys(FOODS) as FoodId[];
export const isFood = (g: string): g is FoodId => g in FOODS;

// ---------- eras ----------
export type Era = 1 | 2 | 3 | 4;
export interface EraDef { name: string; short: string; need: { tier?: TierId; pop?: number; building?: BuildingId }; desc: string }
export const ERAS: Record<Era, EraDef> = {
  1: { name: '田园时代', short: '田园', need: {}, desc: '伐木、捕鱼、种麦、牧羊。' },
  2: { name: '手工业时代', short: '手工业', need: { tier: 'peasant', pop: 60, building: 'church' }, desc: '砖瓦、面包、衣服、铁器，冬天要烧柴取暖。' },
  3: { name: '工业时代', short: '工业', need: { tier: 'worker', pop: 120, building: 'smithy' }, desc: '煤、钢、电，污染开始出现。' },
  4: { name: '现代城市', short: '现代', need: { tier: 'technician', pop: 150, building: 'townhall' }, desc: '清洁能源，治理污染，让城市更幸福。' },
};

// ---------- people ----------
export type TierId = 'peasant' | 'worker' | 'technician' | 'citizen';
export const TIER_IDS: TierId[] = ['peasant', 'worker', 'technician', 'citizen'];
export type ServiceId = 'market' | 'tavern' | 'church' | 'school' | 'clinic' | 'hospital' | 'park' | 'theatre';
export const SERVICES: Record<ServiceId, string> = {
  market: '集市', tavern: '酒馆', church: '教堂', school: '学校', clinic: '诊所', hospital: '医院', park: '公园', theatre: '剧院',
};
/** protection a building can give its surroundings (not a happiness need, but it keeps disasters small) */
export type ProtectId = 'health' | 'fire' | 'police';
export const PROTECTS: Record<ProtectId, string> = { health: '医疗', fire: '消防', police: '治安' };
export type Fuel = GoodId | 'power';
export interface TierDef {
  name: string;
  era: Era;
  cap: number;                               // residents per house
  tax: number;                               // gold per resident per minute at happiness 100
  foods: FoodId[];                           // what they will eat; more kinds in stock = happier
  hunger: number;                            // 饱食 per resident per day
  comforts: Partial<Record<GoodId, number>>;   // per resident per minute; happiness only
  services: ServiceId[];
  fuel: Fuel;                                 // winter heating
  upgrade?: { to: TierId; cost: Cost };
}
export const TIERS: Record<TierId, TierDef> = {
  peasant: { name: '农民', era: 1, cap: 4, tax: 2.0, foods: ['fish', 'veg'], hunger: 0.6, comforts: {}, services: ['market'], fuel: 'firewood', upgrade: { to: 'worker', cost: { gold: 50, bricks: 4 } } },
  worker: { name: '工人', era: 2, cap: 8, tax: 3.6, foods: ['fish', 'veg', 'bread'], hunger: 0.7, comforts: { clothes: 0.03 }, services: ['market', 'tavern', 'church'], fuel: 'firewood', upgrade: { to: 'technician', cost: { gold: 150, steel: 4 } } },
  technician: { name: '技工', era: 3, cap: 12, tax: 5.6, foods: ['fish', 'bread', 'cans'], hunger: 0.8, comforts: { clothes: 0.03, beer: 0.035 }, services: ['tavern', 'school', 'clinic'], fuel: 'coal', upgrade: { to: 'citizen', cost: { gold: 300, cement: 6 } } },
  citizen: { name: '市民', era: 4, cap: 16, tax: 8.5, foods: ['veg', 'bread', 'cans'], hunger: 0.9, comforts: { clothes: 0.03, appliances: 0.02 }, services: ['school', 'hospital', 'park', 'theatre'], fuel: 'power' },
};
/** winter fuel per resident per minute at cold factor 1; power is in units of the grid */
export const HEAT_PER_RESIDENT = 0.04;
export const POWER_HEAT_PER_RESIDENT = 0.2;

// ---------- buildings ----------
export type Cost = { gold: number } & Partial<Record<GoodId, number>>;
export type BuildingId =
  | 'road' | 'house' | 'depot' | 'warehouse'
  // era 1
  | 'lumberjack' | 'sawmill' | 'fishery' | 'garden' | 'farm' | 'sheepfarm' | 'market' | 'church' | 'study' | 'herbalist' | 'firestation'
  // era 2
  | 'firewood' | 'police' | 'claypit' | 'brickworks' | 'mill' | 'bakery' | 'weaver' | 'tailor' | 'ironmine' | 'smithy' | 'tavern' | 'park' | 'guild'
  // era 3
  | 'coalmine' | 'steelworks' | 'cannery' | 'brewery' | 'coalplant' | 'heatplant' | 'school' | 'clinic' | 'townhall' | 'university'
  // era 4
  | 'cementworks' | 'appliances' | 'windturbine' | 'solar' | 'hydro' | 'purifier' | 'recycler' | 'hospital' | 'theatre' | 'lab';

export type Category = 'road' | 'home' | 'raw' | 'craft' | 'power' | 'public';
export type Need = 'water' | 'river' | 'forest' | 'iron' | 'coal';

export interface BuildingDef {
  name: string;
  desc: string;
  era: Era;
  research?: TechId;
  size: [number, number];
  cost: Cost;
  upkeep: number;                 // gold per minute
  category: Category;
  model: string;                  // model name in town.glb
  hotkey?: string;
  workers?: { tier: TierId; n: number };
  cycle?: number;                 // seconds per production cycle
  input?: Partial<Record<GoodId, number>>;  // consumed per cycle
  output?: GoodId;
  outQty?: number;                // produced per cycle (default 1)
  research_pts?: number;          // research points per minute when fully staffed
  power?: number;                 // power used while working
  powerGen?: number;              // power produced at full output
  powerKind?: 'coal' | 'wind' | 'solar' | 'hydro';
  pollution?: number;             // strength at the building (negative cleans)
  radius?: number;                // service / search / heating radius in tiles
  service?: ServiceId;
  heating?: boolean;              // district heating plant
  protects?: ProtectId;           // health, fire or police cover within radius
  storage?: number;
  needs?: Need;
  buildable?: boolean;
}

const B = (d: BuildingDef) => d;
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  road: B({ name: '道路', desc: '连接建筑与港口。按住拖动可以一次修一段。也能架桥跨过河流和湖泊（每格 12 金币 + 1 木板），但不能跨海。', era: 1, size: [1, 1], cost: { gold: 2 }, upkeep: 0, category: 'road', model: '', hotkey: 'R' }),
  house: B({ name: '住宅', desc: '居民的家。满足需求、住得开心，就能升级为更高的阶层。', era: 1, size: [2, 2], cost: { gold: 40, planks: 2 }, upkeep: 0, category: 'home', model: 'house', hotkey: 'H' }),
  depot: B({ name: '港口', desc: '城镇的起点，存放所有货物。', era: 1, size: [3, 3], cost: { gold: 0 }, upkeep: 0, category: 'public', model: 'depot', storage: 60, buildable: false }),
  warehouse: B({ name: '仓库', desc: '每座仓库让每种货物的存储上限增加 40。', era: 1, size: [3, 2], cost: { gold: 100, planks: 6 }, upkeep: 5, category: 'public', model: 'warehouse', storage: 40 }),

  // ---- era 1 ----
  lumberjack: B({ name: '伐木场', desc: '砍伐附近的树木，周围树越多效率越高，还会慢慢补种树苗。只要金币就能建。', era: 1, size: [2, 2], cost: { gold: 60 }, upkeep: 5, category: 'raw', model: 'lumberjack', workers: { tier: 'peasant', n: 4 }, cycle: 15, output: 'wood', radius: 3, needs: 'forest' }),
  sawmill: B({ name: '锯木厂', desc: '把木材加工成木板。', era: 1, size: [3, 2], cost: { gold: 100, planks: 4 }, upkeep: 10, category: 'craft', model: 'sawmill', workers: { tier: 'peasant', n: 6 }, cycle: 15, input: { wood: 1 }, output: 'planks' }),
  fishery: B({ name: '渔场', desc: '必须紧挨水边。为居民提供鱼。', era: 1, size: [3, 2], cost: { gold: 80, planks: 2 }, upkeep: 5, category: 'raw', model: 'fishery', workers: { tier: 'peasant', n: 3 }, cycle: 20, output: 'fish', needs: 'water' }),
  garden: B({ name: '菜园', desc: '种蔬菜，和鱼一样能填饱肚子。冬天不长菜，记得秋天多囤一些。', era: 1, size: [3, 3], cost: { gold: 80, planks: 3 }, upkeep: 4, category: 'raw', model: 'garden', workers: { tier: 'peasant', n: 4 }, cycle: 15, output: 'veg' }),
  herbalist: B({ name: '草药铺', desc: '医疗覆盖：范围内的病人好得快，瘟疫不容易扩散。', era: 1, size: [2, 2], cost: { gold: 120, planks: 6 }, upkeep: 5, category: 'public', model: 'herbalist', workers: { tier: 'peasant', n: 2 }, radius: 8, protects: 'health' }),
  firestation: B({ name: '消防队', desc: '消防覆盖：范围内着火的建筑很快就能扑灭；没有覆盖的火会把房子烧光。', era: 1, size: [3, 2], cost: { gold: 150, planks: 8 }, upkeep: 5, category: 'public', model: 'firestation', workers: { tier: 'peasant', n: 3 }, radius: 9, protects: 'fire' }),
  farm: B({ name: '麦田', desc: '种植小麦。冬天休耕。', era: 1, size: [4, 4], cost: { gold: 100, planks: 4 }, upkeep: 10, category: 'raw', model: 'farm', workers: { tier: 'peasant', n: 4 }, cycle: 30, output: 'grain' }),
  sheepfarm: B({ name: '牧羊场', desc: '养羊产羊毛，织布的原料。', era: 1, size: [4, 3], cost: { gold: 120, planks: 4 }, upkeep: 8, category: 'raw', model: 'sheepfarm', workers: { tier: 'peasant', n: 3 }, cycle: 30, output: 'wool' }),
  market: B({ name: '集市', desc: '覆盖范围内的住宅满足"集市"需求。', era: 1, size: [3, 3], cost: { gold: 120, planks: 6 }, upkeep: 6, category: 'public', model: 'market', radius: 9, service: 'market' }),
  church: B({ name: '教堂', desc: '小镇的精神中心。工人需要它；建成后才能进入手工业时代。', era: 1, size: [3, 4], cost: { gold: 400, planks: 24 }, upkeep: 10, category: 'public', model: 'church', radius: 11, service: 'church' }),
  study: B({ name: '村塾', desc: '产生研究点，解锁田园时代的研究。', era: 1, size: [2, 2], cost: { gold: 150, planks: 8 }, upkeep: 5, category: 'public', model: 'study', workers: { tier: 'peasant', n: 2 }, research_pts: 6 }),

  // ---- era 2 ----
  police: B({ name: '巡警所', desc: '治安覆盖：住户不开心时容易有小偷和闹事，巡警能管住他们。', era: 2, size: [2, 2], cost: { gold: 250, planks: 6, bricks: 6 }, upkeep: 12, category: 'public', model: 'police', workers: { tier: 'worker', n: 2 }, radius: 10, protects: 'police' }),
  firewood: B({ name: '柴火坊', desc: '把木材劈成柴火。气温低于 8°C 住宅就要烧柴取暖。', era: 1, size: [2, 2], cost: { gold: 80, planks: 4 }, upkeep: 3, category: 'craft', model: 'woodshed', workers: { tier: 'peasant', n: 2 }, cycle: 20, input: { wood: 1 }, output: 'firewood', outQty: 2, pollution: 2 }),
  claypit: B({ name: '黏土坑', desc: '在河岸或湖边挖黏土。', era: 2, size: [3, 3], cost: { gold: 100, planks: 4 }, upkeep: 6, category: 'raw', model: 'claypit', workers: { tier: 'peasant', n: 4 }, cycle: 20, output: 'clay', needs: 'water', pollution: 2 }),
  brickworks: B({ name: '砖厂', desc: '把黏土烧成砖，手工业时代的主要建材。', era: 2, size: [3, 2], cost: { gold: 150, planks: 6 }, upkeep: 8, category: 'craft', model: 'brickworks', workers: { tier: 'peasant', n: 6 }, cycle: 20, input: { clay: 1 }, output: 'bricks', pollution: 10 }),
  mill: B({ name: '磨坊', desc: '把小麦磨成面粉。', era: 2, size: [2, 2], cost: { gold: 150, planks: 8 }, upkeep: 8, category: 'craft', model: 'mill', workers: { tier: 'worker', n: 4 }, cycle: 30, input: { grain: 1 }, output: 'flour' }),
  bakery: B({ name: '面包房', desc: '用面粉烤面包。', era: 2, size: [2, 2], cost: { gold: 150, planks: 6, bricks: 4 }, upkeep: 8, category: 'craft', model: 'bakery', workers: { tier: 'worker', n: 4 }, cycle: 30, input: { flour: 1 }, output: 'bread', pollution: 2 }),
  weaver: B({ name: '织布厂', desc: '把羊毛织成布。', era: 2, size: [3, 2], cost: { gold: 200, planks: 6, bricks: 4 }, upkeep: 10, category: 'craft', model: 'weaver', workers: { tier: 'worker', n: 6 }, cycle: 30, input: { wool: 1 }, output: 'cloth', pollution: 5 }),
  tailor: B({ name: '裁缝铺', desc: '用布做衣服。', era: 2, size: [2, 2], cost: { gold: 150, planks: 4, bricks: 4 }, upkeep: 8, category: 'craft', model: 'tailor', workers: { tier: 'worker', n: 4 }, cycle: 30, input: { cloth: 1 }, output: 'clothes' }),
  ironmine: B({ name: '铁矿', desc: '必须建在铁矿脉上。', era: 2, size: [2, 2], cost: { gold: 200, planks: 8 }, upkeep: 10, category: 'raw', model: 'mine', workers: { tier: 'worker', n: 6 }, cycle: 20, output: 'ore', needs: 'iron', pollution: 10 }),
  smithy: B({ name: '铁匠铺', desc: '用铁矿石和木材打造工具；建成后才能进入工业时代。', era: 2, size: [2, 2], cost: { gold: 250, planks: 6, bricks: 6 }, upkeep: 10, category: 'craft', model: 'smithy', workers: { tier: 'worker', n: 6 }, cycle: 30, input: { ore: 1, wood: 1 }, output: 'tools', pollution: 10 }),
  tavern: B({ name: '酒馆', desc: '工人和技工下班后的去处。', era: 2, size: [3, 2], cost: { gold: 200, planks: 10 }, upkeep: 15, category: 'public', model: 'tavern', radius: 9, service: 'tavern' }),
  park: B({ name: '公园', desc: '减少附近的污染，让附近住户更开心。', era: 2, size: [3, 3], cost: { gold: 100, bricks: 2 }, upkeep: 5, category: 'public', model: 'park', radius: 4, service: 'park', pollution: -15 }),
  guild: B({ name: '工匠行会', desc: '产生研究点，解锁手工业时代的研究。', era: 2, size: [3, 2], cost: { gold: 300, planks: 10, bricks: 10 }, upkeep: 20, category: 'public', model: 'guild', workers: { tier: 'worker', n: 4 }, research_pts: 12 }),

  // ---- era 3 ----
  coalmine: B({ name: '煤矿', desc: '必须建在煤矿脉上。', era: 3, size: [2, 2], cost: { gold: 300, bricks: 10, tools: 4 }, upkeep: 14, category: 'raw', model: 'mine', workers: { tier: 'worker', n: 8 }, cycle: 15, output: 'coal', needs: 'coal', pollution: 25 }),
  steelworks: B({ name: '炼钢厂', desc: '用铁矿石和煤炼钢，污染很重。', era: 3, size: [4, 4], cost: { gold: 600, bricks: 20, tools: 8 }, upkeep: 24, category: 'craft', model: 'factory', workers: { tier: 'worker', n: 8 }, cycle: 30, input: { ore: 1, coal: 1 }, output: 'steel', pollution: 40 }),
  cannery: B({ name: '罐头厂', desc: '用鱼和钢做罐头。', era: 3, size: [3, 2], cost: { gold: 400, bricks: 10, tools: 4, steel: 4 }, upkeep: 18, category: 'craft', model: 'cannery', workers: { tier: 'worker', n: 6 }, cycle: 60, input: { fish: 3, steel: 1 }, output: 'cans', outQty: 3, power: 4, pollution: 15 }),
  brewery: B({ name: '啤酒厂', desc: '用小麦酿啤酒。', era: 3, size: [2, 2], cost: { gold: 300, bricks: 10, tools: 2 }, upkeep: 14, category: 'craft', model: 'brewery', workers: { tier: 'technician', n: 6 }, cycle: 30, input: { grain: 1 }, output: 'beer', pollution: 5 }),
  coalplant: B({ name: '燃煤电厂', desc: '烧煤发电，便宜稳定，但污染最重。', era: 3, research: 'steam', size: [4, 4], cost: { gold: 800, bricks: 20, tools: 6 }, upkeep: 30, category: 'power', model: 'powerplant', workers: { tier: 'worker', n: 6 }, cycle: 30, input: { coal: 1 }, powerGen: 20, powerKind: 'coal', pollution: 50 }),
  heatplant: B({ name: '煤炉房', desc: '集中供暖：半径内的住宅冬天不必各自烧燃料，比分散取暖省 30% 的煤。', era: 3, research: 'central', size: [2, 2], cost: { gold: 400, bricks: 12, steel: 4 }, upkeep: 20, category: 'power', model: 'heatplant', workers: { tier: 'technician', n: 4 }, radius: 6, heating: true, pollution: 20 }),
  school: B({ name: '学校', desc: '技工和市民需要它。', era: 3, size: [3, 3], cost: { gold: 400, bricks: 12 }, upkeep: 20, category: 'public', model: 'school', radius: 10, service: 'school' }),
  clinic: B({ name: '诊所', desc: '技工需要它；同时提供医疗覆盖。', era: 3, size: [2, 2], cost: { gold: 400, bricks: 10, steel: 2 }, upkeep: 20, category: 'public', model: 'clinic', radius: 9, service: 'clinic', protects: 'health' }),
  townhall: B({ name: '市政厅', desc: '建成后才能进入现代城市时代。', era: 3, size: [4, 3], cost: { gold: 1200, bricks: 30, steel: 10 }, upkeep: 40, category: 'public', model: 'townhall' }),
  university: B({ name: '大学', desc: '产生研究点，解锁工业时代的研究。', era: 3, size: [4, 4], cost: { gold: 800, bricks: 20, steel: 6 }, upkeep: 35, category: 'public', model: 'university', workers: { tier: 'technician', n: 6 }, research_pts: 24 }),

  // ---- era 4 ----
  cementworks: B({ name: '水泥厂', desc: '用黏土和煤做水泥，现代建筑的建材。', era: 4, size: [3, 3], cost: { gold: 800, bricks: 20, steel: 10 }, upkeep: 24, category: 'craft', model: 'factory_small', workers: { tier: 'technician', n: 8 }, cycle: 30, input: { clay: 1, coal: 1 }, output: 'cement', power: 6, pollution: 30 }),
  appliances: B({ name: '电器厂', desc: '用钢和工具造电器，市民的舒适品。', era: 4, size: [4, 3], cost: { gold: 1000, steel: 10, cement: 10 }, upkeep: 31, category: 'craft', model: 'plant_modern', workers: { tier: 'citizen', n: 8 }, cycle: 60, input: { steel: 1, tools: 1 }, output: 'appliances', power: 10, pollution: 15 }),
  windturbine: B({ name: '风车', desc: '无污染发电。没风时减半，雷雨天停机。', era: 4, research: 'wind', size: [2, 2], cost: { gold: 300, steel: 4, cement: 2 }, upkeep: 8, category: 'power', model: 'windturbine', powerGen: 6, powerKind: 'wind' }),
  solar: B({ name: '太阳能板', desc: '无污染发电，只在白天工作，阴雨天减半。', era: 4, research: 'solar', size: [3, 3], cost: { gold: 400, steel: 6 }, upkeep: 8, category: 'power', model: 'solar', powerGen: 8, powerKind: 'solar' }),
  hydro: B({ name: '水电站', desc: '必须建在内陆河湖边，稳定无污染，造价高。', era: 4, research: 'hydro', size: [3, 3], cost: { gold: 1500, steel: 10, cement: 20 }, upkeep: 30, category: 'power', model: 'hydro', workers: { tier: 'technician', n: 4 }, powerGen: 30, powerKind: 'hydro', needs: 'river' }),
  purifier: B({ name: '净化厂', desc: '大幅降低周围的污染。', era: 4, research: 'purify', size: [3, 2], cost: { gold: 800, steel: 10, cement: 6 }, upkeep: 30, category: 'power', model: 'purifier', workers: { tier: 'technician', n: 4 }, radius: 6, power: 8, pollution: -40 }),
  recycler: B({ name: '回收站', desc: '回收垃圾，产出少量钢，顺便减少污染。', era: 4, size: [3, 3], cost: { gold: 600, steel: 6, cement: 6 }, upkeep: 18, category: 'craft', model: 'recycler', workers: { tier: 'citizen', n: 4 }, cycle: 60, output: 'steel', power: 4, pollution: -10 }),
  hospital: B({ name: '医院', desc: '市民需要它；同时提供大范围医疗覆盖。', era: 4, size: [4, 3], cost: { gold: 1000, cement: 10, steel: 6 }, upkeep: 40, category: 'public', model: 'hospital', radius: 12, service: 'hospital', protects: 'health' }),
  theatre: B({ name: '剧院', desc: '市民需要它。', era: 4, size: [4, 4], cost: { gold: 1200, cement: 12 }, upkeep: 40, category: 'public', model: 'theatre', radius: 12, service: 'theatre' }),
  lab: B({ name: '研究所', desc: '产生大量研究点，包括无限研究。', era: 4, size: [2, 2], cost: { gold: 1500, cement: 10, steel: 10 }, upkeep: 50, category: 'public', model: 'lab', workers: { tier: 'citizen', n: 6 }, research_pts: 40 }),
};

export const BUILD_MENU: { cat: Category; name: string }[] = [
  { cat: 'road', name: '道路' },
  { cat: 'home', name: '住宅' },
  { cat: 'raw', name: '原料' },
  { cat: 'craft', name: '加工' },
  { cat: 'power', name: '能源' },
  { cat: 'public', name: '公共' },
];
export const menuItems = (cat: Category) => (Object.keys(BUILDINGS) as BuildingId[]).filter(b => BUILDINGS[b].category === cat && BUILDINGS[b].buildable !== false);

// ---------- research ----------
export type TechId =
  | 'rotation' | 'nets' | 'axes' | 'hearth' | 'shepherd' | 'granary' | 'woodland'
  | 'brickhearth' | 'irontools' | 'loom' | 'kiln' | 'storehouse' | 'festival' | 'hedges'
  | 'steam' | 'central' | 'filter' | 'canning' | 'mechanize' | 'vaccine'
  | 'wind' | 'solar' | 'hydro' | 'purify' | 'planning' | 'automation'
  | 'inf_prod' | 'inf_clean';
export type Branch = 'prod' | 'life' | 'env';
export const BRANCHES: Record<Branch, string> = { prod: '生产', life: '民生', env: '环境' };
export interface TechEffect {
  prod?: Partial<Record<BuildingId, number>>;  // production multiplier added (0.2 = +20%)
  prodAll?: number;
  workersLess?: Partial<Record<BuildingId, number>>;
  heating?: number;            // fuel use multiplier added (-0.1 = 10% less)
  storage?: number;
  happiness?: number;
  parkRadius?: number;
  pollution?: number;          // pollution multiplier added for polluters
  sickness?: number;
  forestNeed?: number;         // trees needed for a full-speed lumberjack
}
export interface TechDef { name: string; era: Era; branch: Branch; cost: number; desc: string; effect: TechEffect; infinite?: boolean }
export const TECHS: Record<TechId, TechDef> = {
  rotation: { name: '轮作', era: 1, branch: 'prod', cost: 40, desc: '麦田产量 +20%', effect: { prod: { farm: 0.2 } } },
  nets: { name: '大渔网', era: 1, branch: 'prod', cost: 40, desc: '渔场产量 +20%', effect: { prod: { fishery: 0.2 } } },
  axes: { name: '精制斧头', era: 1, branch: 'prod', cost: 30, desc: '伐木场产量 +25%', effect: { prod: { lumberjack: 0.25 } } },
  shepherd: { name: '牧羊犬', era: 1, branch: 'prod', cost: 40, desc: '牧羊场产量 +25%', effect: { prod: { sheepfarm: 0.25 } } },
  hearth: { name: '火塘', era: 1, branch: 'life', cost: 30, desc: '冬季取暖燃料 -10%', effect: { heating: -0.1 } },
  granary: { name: '粮仓', era: 1, branch: 'life', cost: 50, desc: '每种货物存储上限 +20', effect: { storage: 20 } },
  woodland: { name: '护林', era: 1, branch: 'env', cost: 40, desc: '伐木场只需 7 棵树就能满效率（原为 10 棵）', effect: { forestNeed: 7 } },
  brickhearth: { name: '砖砌壁炉', era: 2, branch: 'life', cost: 100, desc: '冬季取暖燃料再 -20%', effect: { heating: -0.2 } },
  irontools: { name: '铁制工具', era: 2, branch: 'prod', cost: 120, desc: '伐木场、黏土坑、铁矿、煤矿各少需 1 个工人', effect: { workersLess: { lumberjack: 1, claypit: 1, ironmine: 1, coalmine: 1 } } },
  loom: { name: '改良织机', era: 2, branch: 'prod', cost: 100, desc: '织布厂和裁缝铺产量 +25%', effect: { prod: { weaver: 0.25, tailor: 0.25 } } },
  kiln: { name: '大窑炉', era: 2, branch: 'prod', cost: 100, desc: '砖厂产量 +25%', effect: { prod: { brickworks: 0.25 } } },
  storehouse: { name: '仓储', era: 2, branch: 'life', cost: 80, desc: '每种货物存储上限 +30', effect: { storage: 30 } },
  festival: { name: '节庆', era: 2, branch: 'life', cost: 120, desc: '所有住户幸福度 +5', effect: { happiness: 5 } },
  hedges: { name: '绿篱', era: 2, branch: 'env', cost: 80, desc: '公园覆盖半径 +2', effect: { parkRadius: 2 } },
  steam: { name: '蒸汽机', era: 3, branch: 'prod', cost: 200, desc: '解锁燃煤电厂', effect: {} },
  central: { name: '集中供暖', era: 3, branch: 'life', cost: 200, desc: '解锁煤炉房', effect: {} },
  filter: { name: '烟囱过滤', era: 3, branch: 'env', cost: 300, desc: '所有建筑污染 -25%', effect: { pollution: -0.25 } },
  canning: { name: '罐装工艺', era: 3, branch: 'prod', cost: 250, desc: '罐头厂产量 +25%', effect: { prod: { cannery: 0.25 } } },
  mechanize: { name: '机械化', era: 3, branch: 'prod', cost: 350, desc: '所有生产建筑产量 +10%', effect: { prodAll: 0.1 } },
  vaccine: { name: '疫苗', era: 3, branch: 'life', cost: 250, desc: '冬天生病的人数减半', effect: { sickness: -0.5 } },
  wind: { name: '风力发电', era: 4, branch: 'env', cost: 400, desc: '解锁风车', effect: {} },
  solar: { name: '光伏', era: 4, branch: 'env', cost: 500, desc: '解锁太阳能板', effect: {} },
  hydro: { name: '水利工程', era: 4, branch: 'prod', cost: 500, desc: '解锁水电站', effect: {} },
  purify: { name: '空气净化', era: 4, branch: 'env', cost: 600, desc: '解锁净化厂', effect: {} },
  planning: { name: '城市规划', era: 4, branch: 'life', cost: 600, desc: '公园覆盖半径 +2，所有住户幸福度 +5', effect: { parkRadius: 2, happiness: 5 } },
  automation: { name: '自动化', era: 4, branch: 'prod', cost: 700, desc: '炼钢厂、水泥厂、电器厂、罐头厂各少需 2 个工人', effect: { workersLess: { steelworks: 2, cementworks: 2, appliances: 2, cannery: 2 } } },
  inf_prod: { name: '精益生产', era: 4, branch: 'prod', cost: 800, desc: '每级所有生产 +2%，可无限研究', effect: { prodAll: 0.02 }, infinite: true },
  inf_clean: { name: '绿色工艺', era: 4, branch: 'env', cost: 800, desc: '每级所有污染 -2%，可无限研究', effect: { pollution: -0.02 }, infinite: true },
};
export const TECH_IDS = Object.keys(TECHS) as TechId[];

// ---------- start ----------
export const START = { gold: 1500, goods: { planks: 40, wood: 6, fish: 16 } as Partial<Record<GoodId, number>> };
export const REFUND = 0.5;
/** a road tile over a river or lake */
export const BRIDGE_COST: Cost = { gold: 12, planks: 1 };
export const MAP_SIZE = 64;
// ---------- disasters & unrest (chances are per building per day) ----------
export const FIRE = { house: 0.007, other: 0.005, polluter: 0.012, coverMul: 0.4, burnSecs: 45, putOutSecs: 8, spread: 0.35 };
export const PLAGUE = { perDay: 0.12, winterMul: 2, sickShare: 0.6, spreadPerSec: 0.025, cureCovered: 25, cureBare: 90, leavePerSec: 0.012 };
export const CRIME = { below: 45, perHouseDay: 0.05, coverMul: 0.15 };
export const STRIKE = { below: 35, debtDays: 2, secs: 40 };
/** happiness lost while wages are unpaid: base + per day in debt, capped */
export const DEBT = { base: 8, perDay: 4, max: 20 };
export const HUNGER = { hungrySecs: 20, leaveSecs: 60 };

// ---------- temperature ----------
/** mid-season temperatures in °C */
export const SEASON_TEMP = [13, 25, 12, -6];
/** homes need heating below this */
export const HEAT_BELOW = 8;
/** each year the cold season bites a little harder (°C per year, capped) */
export const COLDER_PER_YEAR = 1.5, COLDER_MAX = 12;
/** how hard homes must be heated: 0 when mild, 1 at -6 °C, more below */
export const coldness = (t: number) => Math.max(0, (HEAT_BELOW - t) / 14);
export const POLLUTION_RADIUS = 5;

// ---------- weather ----------
export type WeatherId = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';
export interface WeatherDef {
  name: string;
  effect: string;
  duration: [number, number];
  next: Partial<Record<WeatherId, number>>;
  prod: Partial<Record<BuildingId, number>>;
  wind: number;                   // wind turbine output factor
  sun: number;                    // solar output factor in daylight
}
export const WEATHER_TEMP: Record<WeatherId, number> = { sunny: 1.5, cloudy: 0, rain: -3, storm: -4, fog: -1, snow: -3 };
export const WEATHER: Record<WeatherId, WeatherDef> = {
  sunny: { name: '晴', effect: '一切正常', duration: [90, 150], next: { cloudy: 5, fog: 1, rain: 2, sunny: 2 }, prod: {}, wind: 0.6, sun: 1 },
  cloudy: { name: '多云', effect: '风力充足', duration: [60, 100], next: { sunny: 3.5, rain: 4, storm: 1, fog: 1.5 }, prod: {}, wind: 1, sun: 0.6 },
  rain: { name: '下雨', effect: '麦田 +25%，污染 -20%', duration: [50, 90], next: { cloudy: 4, storm: 2.5, sunny: 2, rain: 1.5 }, prod: { farm: 1.25 }, wind: 1, sun: 0.5 },
  storm: { name: '雷雨', effect: '麦田 +25%，渔船停航，风车停机', duration: [30, 50], next: { rain: 6, cloudy: 4 }, prod: { farm: 1.25, fishery: 0 }, wind: 0, sun: 0.3 },
  fog: { name: '起雾', effect: '渔场 -40%，污染影响 +20%', duration: [40, 70], next: { sunny: 5, cloudy: 5 }, prod: { fishery: 0.6 }, wind: 0.4, sun: 0.5 },
  snow: { name: '下雪', effect: '伐木场 -30%', duration: [50, 90], next: { cloudy: 4, sunny: 3, snow: 3 }, prod: { lumberjack: 0.7 }, wind: 0.8, sun: 0.4 },
};

// ---------- calendar ----------
export const DAY_LENGTH = 240;
/** per-minute rate -> per-day */
export const PER_DAY = DAY_LENGTH / 60;
/** default days per season; players can pick 3, 4 or 6 in the menu */
export const SEASON_DAYS = 4;
export const SEASON_DAY_OPTIONS = [3, 4, 6];
export const START_HOUR = 8;
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_IDS: SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];
export interface SeasonDef { name: string; effect: string; prod: Partial<Record<BuildingId, number>>; weather: Partial<Record<WeatherId, WeatherId>> }
export const SEASONS: Record<SeasonId, SeasonDef> = {
  spring: { name: '春', effect: '万物生长', prod: {}, weather: { snow: 'rain' } },
  summer: { name: '夏', effect: '麦田和菜园 +20%，天干容易着火', prod: { farm: 1.2, garden: 1.2 }, weather: { snow: 'sunny' } },
  autumn: { name: '秋', effect: '丰收季，麦田和菜园 +40%，记得囤粮和燃料', prod: { farm: 1.4, garden: 1.4 }, weather: { snow: 'rain' } },
  winter: { name: '冬', effect: '麦田、菜园和牧羊场停产，渔场 -30%，住宅要取暖', prod: { farm: 0, garden: 0, sheepfarm: 0, fishery: 0.7 }, weather: { rain: 'snow', storm: 'snow' } },
};
