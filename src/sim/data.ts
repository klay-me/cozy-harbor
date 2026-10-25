// All gameplay numbers live here. Rates are per game-minute unless noted.

export type GoodId = 'wood' | 'planks' | 'fish' | 'grain' | 'flour' | 'bread';
export const GOOD_IDS: GoodId[] = ['wood', 'planks', 'fish', 'grain', 'flour', 'bread'];
export const GOODS: Record<GoodId, { name: string }> = {
  wood: { name: '木材' },
  planks: { name: '木板' },
  fish: { name: '鱼' },
  grain: { name: '小麦' },
  flour: { name: '面粉' },
  bread: { name: '面包' },
};

export type TierId = 'peasant' | 'worker';
export type ServiceId = 'market' | 'tavern';
export const SERVICES: Record<ServiceId, string> = { market: '集市', tavern: '酒馆' };

export interface TierDef {
  name: string;
  cap: number;              // residents per house
  tax: number;              // gold per resident per minute at full happiness
  goods: Partial<Record<GoodId, number>>; // consumption per resident per minute
  services: ServiceId[];
}
export const TIERS: Record<TierId, TierDef> = {
  peasant: { name: '农民', cap: 4, tax: 1.2, goods: { fish: 0.075 }, services: ['market'] },
  worker: { name: '工人', cap: 8, tax: 2.6, goods: { fish: 0.075, bread: 0.05 }, services: ['market', 'tavern'] },
};
// cost of turning a peasant house into a worker house
export const UPGRADE_COST = { gold: 50, planks: 6 };

export type BuildingId =
  | 'road' | 'house' | 'depot' | 'warehouse'
  | 'lumberjack' | 'sawmill' | 'fishery' | 'farm' | 'mill' | 'bakery'
  | 'market' | 'tavern';

export type Category = 'road' | 'home' | 'prod' | 'public';

export interface BuildingDef {
  name: string;
  desc: string;
  size: [number, number];
  cost: { gold: number; planks?: number };
  upkeep: number;           // gold per minute
  category: Category;
  hotkey?: string;
  workers?: { tier: TierId; n: number };
  cycle?: number;           // seconds per unit of output
  input?: GoodId;
  output?: GoodId;
  radius?: number;          // service radius or resource search radius
  service?: ServiceId;
  storage?: number;         // storage capacity added per good
  needs?: 'water' | 'forest';
  buildable?: boolean;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  road: { name: '道路', desc: '连接建筑与港口。按住拖动可以一次修一段。', size: [1, 1], cost: { gold: 2 }, upkeep: 0, category: 'road', hotkey: 'R' },
  house: { name: '农舍', desc: '居民的家。满足需求后人口会增长，还能升级为工人住宅。', size: [2, 2], cost: { gold: 40, planks: 2 }, upkeep: 0, category: 'home', hotkey: 'H' },
  depot: { name: '港口', desc: '城镇的起点，存放所有货物。', size: [3, 3], cost: { gold: 0 }, upkeep: 0, category: 'public', storage: 60, buildable: false },
  warehouse: { name: '仓库', desc: '每座仓库让每种货物的存储上限增加 40。', size: [2, 2], cost: { gold: 100, planks: 6 }, upkeep: 5, category: 'public', storage: 40 },
  lumberjack: { name: '伐木场', desc: '砍伐附近的树木。周围树越多效率越高。', size: [2, 2], cost: { gold: 50, planks: 2 }, upkeep: 5, category: 'prod', workers: { tier: 'peasant', n: 4 }, cycle: 15, output: 'wood', radius: 3, needs: 'forest' },
  sawmill: { name: '锯木厂', desc: '把木材加工成建造用的木板。', size: [2, 2], cost: { gold: 100, planks: 4 }, upkeep: 10, category: 'prod', workers: { tier: 'peasant', n: 6 }, cycle: 15, input: 'wood', output: 'planks' },
  fishery: { name: '渔场', desc: '必须紧挨水边。为居民提供鱼。', size: [2, 2], cost: { gold: 80, planks: 2 }, upkeep: 5, category: 'prod', workers: { tier: 'peasant', n: 3 }, cycle: 20, output: 'fish', needs: 'water' },
  farm: { name: '麦田', desc: '种植小麦，供给磨坊。', size: [3, 3], cost: { gold: 100, planks: 4 }, upkeep: 10, category: 'prod', workers: { tier: 'peasant', n: 4 }, cycle: 30, output: 'grain' },
  mill: { name: '磨坊', desc: '把小麦磨成面粉。需要工人。', size: [2, 2], cost: { gold: 150, planks: 8 }, upkeep: 15, category: 'prod', workers: { tier: 'worker', n: 4 }, cycle: 30, input: 'grain', output: 'flour' },
  bakery: { name: '面包房', desc: '用面粉烤面包，工人离不开它。', size: [2, 2], cost: { gold: 150, planks: 8 }, upkeep: 15, category: 'prod', workers: { tier: 'worker', n: 4 }, cycle: 30, input: 'flour', output: 'bread' },
  market: { name: '集市', desc: '覆盖范围内的住宅满足"集市"需求。', size: [2, 2], cost: { gold: 120, planks: 6 }, upkeep: 10, category: 'public', radius: 9, service: 'market' },
  tavern: { name: '酒馆', desc: '工人下班后的去处。覆盖范围内满足"酒馆"需求。', size: [2, 2], cost: { gold: 200, planks: 10 }, upkeep: 20, category: 'public', radius: 9, service: 'tavern' },
};

export const BUILD_MENU: { cat: Category; name: string; items: BuildingId[] }[] = [
  { cat: 'road', name: '道路', items: ['road'] },
  { cat: 'home', name: '住宅', items: ['house'] },
  { cat: 'prod', name: '生产', items: ['fishery', 'lumberjack', 'sawmill', 'farm', 'mill', 'bakery'] },
  { cat: 'public', name: '公共', items: ['market', 'tavern', 'warehouse'] },
];

export const START = { gold: 1500, goods: { planks: 30, wood: 6, fish: 16 } as Partial<Record<GoodId, number>> };
export const REFUND = 0.5;
export const MAP_SIZE = 56;
