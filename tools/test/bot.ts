import { Game } from '../../src/sim/game';
import { BUILDINGS, BuildingId, TECH_IDS, TECHS, GOOD_IDS, GOODS, TierId } from '../../src/sim/data';
import { Tile } from '../../src/sim/world';

// map id (default: the fixed map) or a numeric seed for a random map
const arg = process.argv[2] ?? 'haven';
// BOT_MODE=sandbox for the old endless game
const g = new Game(isNaN(Number(arg)) ? arg as any : Number(arg), (process.env.BOT_MODE as any) ?? 'survival');
const W = g.W, d = g.world.depot;
const L = (...a: any[]) => console.log(...a);
// grid roads every 5 tiles around the depot
const ox = d.x + 1, oz = d.z - 1;
function gridRoads(r: number) {
  const free = (p: [number, number][]) => p.filter(([a, b]) => !g.world.deposit(a, b));
  for (let k = -r; k <= r; k++) {
    const x = ox + k * 5, z = oz - k * 5;
    g.placeRoads(free(g.roadPath(x, oz, x, Math.max(1, oz - r * 5)).filter(([a, b]) => g.roadTileOk(a, b))));
    if (z > 0) g.placeRoads(free(g.roadPath(ox - r * 5, z, ox + r * 5, z)));
  }
  g.placeRoads(free(g.roadPath(ox - r * 5, oz, ox + r * 5, oz)));
}
gridRoads(2);
// like a player, keep ore veins free for mines
function onOre(type: BuildingId, x: number, z: number) {
  if (BUILDINGS[type].needs === 'iron' || BUILDINGS[type].needs === 'coal') return false;
  const [w, h] = BUILDINGS[type].size;
  for (let j = 0; j < Math.max(w, h); j++) for (let i = 0; i < Math.max(w, h); i++) if (g.world.deposit(x + i, z + j)) return true;
  return false;
}
function spots(type: BuildingId) {
  const [w, h] = BUILDINGS[type].size;
  const seen = new Set<number>();
  const out: [number, number, number][] = [];
  for (let k = 0; k < W * W; k++) {
    if (!g.netRoads[k]) continue;
    const rx = k % W, rz = (k / W) | 0;
    for (let z = rz - h; z <= rz + 1; z++) for (let x = rx - w; x <= rx + 1; x++) {
      const key = z * W + x;
      if (seen.has(key)) continue;
      seen.add(key);
      if (x < 0 || z < 0 || onOre(type, x, z) || !g.canPlace(type, x, z).ok) continue;
      out.push([x, z, Math.hypot(x - d.x, z - d.z)]);
    }
  }
  out.sort((a, b) => a[2] - b[2]);
  return out;
}
function farSpots(type: BuildingId) {
  const [w, h] = BUILDINGS[type].size;
  const out: [number, number, number][] = [];
  for (let z = 0; z < W - h; z++) for (let x = 0; x < W - w; x++) {
    if (onOre(type, x, z) || !g.canPlace(type, x, z).ok) continue;
    out.push([x, z, Math.hypot(x - d.x, z - d.z)]);
  }
  return out.sort((a, b) => a[2] - b[2]);
}
// spots where a building could not be connected to the roads: don't pay for the same mistake again
const unreachable = new Set<string>();
function placeConnected(type: BuildingId, cands: [number, number, number][]) {
  for (const [x, z] of cands.filter(([x, z]) => !unreachable.has(`${type},${x},${z}`)).slice(0, 6)) {
    // like a player, turn the building so its front faces the water or a road
    if (!g.place(type, x, z, g.bestRot(type, x, z, 0))) continue;
    const b = g.at(x, z)!;
    connect(b);
    if (b.connected) { built[type] = (built[type] ?? 0) + 1; return true; }
    unreachable.add(`${type},${x},${z}`);
    g.demolish(x, z);
  }
  return false;
}
function connect(b: any) {
  if (b.connected) return;
  // BFS over buildable tiles from the building's edge to the road network
  const prev = new Int32Array(W * W).fill(-2);
  const q: number[] = [];
  g.forEdge(b, (x, z) => { if (g.world.inside(x, z)) { const k = z * W + x; if (g.netRoads[k]) { q.length = 0; } if (g.roadTileOk(x, z) || g.netRoads[k]) { prev[k] = -1; q.push(k); } } });
  let hit = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi];
    if (g.netRoads[k]) { hit = k; break; }
    const x = k % W, z = (k / W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!g.world.inside(nx, nz)) continue;
      const nk = nz * W + nx;
      if (prev[nk] !== -2) continue;
      if (!g.roadTileOk(nx, nz) && !g.netRoads[nk]) continue;
      if (g.world.deposit(nx, nz) && !g.netRoads[nk]) continue;   // keep roads off ore veins
      prev[nk] = k; q.push(nk);
    }
  }
  if (hit < 0) return;
  const path: [number, number][] = [];
  for (let k = hit; k >= 0; k = prev[k]) path.push([k % W, (k / W) | 0]);
  g.placeRoads(path);
}
let built: Record<string, number> = {};
function build(type: BuildingId) {
  if (!g.unlocked(type) || !g.canAfford(BUILDINGS[type].cost)) return false;
  if (type === 'lumberjack') {
    const [w, h] = BUILDINGS[type].size;
    const c: [number, number, number][] = [];
    for (let z = 0; z < W - h; z++) for (let x = 0; x < W - w; x++) {
      if (onOre(type, x, z) || !g.canPlace(type, x, z).ok) continue;
      let near = false;
      for (let j = -4; j < h + 4 && !near; j++) for (let i = -4; i < w + 4; i++) if (g.world.inside(x + i, z + j) && g.netRoads[(z + j) * W + x + i]) { near = true; break; }
      if (!near) continue;
      let t = 0;
      for (let j = -3; j < h + 3; j++) for (let i = -3; i < w + 3; i++) if (g.world.inside(x + i, z + j) && g.world.trees[(z + j) * W + x + i] && g.occ[(z + j) * W + x + i] === 0) t++;
      c.push([x, z, -Math.min(t, 14) * 3 + Math.hypot(x - d.x, z - d.z) * 0.5]);
    }
    return placeConnected(type, c.sort((a, b) => a[2] - b[2]));
  }
  const s = spots(type);
  if (s.length) { const ok = g.place(type, s[0][0], s[0][1]); if (ok) built[type] = (built[type] ?? 0) + 1; return ok; }
  return placeConnected(type, farSpots(type));
}
const n = (t: BuildingId) => g.count(t);
const houses = () => [...g.buildings.values()].filter(b => b.type === 'house');

// the producer of a good the player would pick: the highest unlocked level of its line
const producersOf: Record<string, BuildingId[]> = {};
for (const [k, d] of Object.entries(BUILDINGS)) if (d.output && k !== 'recycler') (producersOf[d.output] ??= []).push(k as BuildingId);
const producerOf = new Proxy({} as Partial<Record<string, BuildingId>>, {
  get: (_t, good: string) => {
    const list = producersOf[good];
    if (!list) return undefined;
    return list.find(b => g.unlocked(b) && !(BUILDINGS[b].upgrade && g.unlocked(BUILDINGS[b].upgrade!.to))) ?? list[0];
  },
});
function rates() {
  const prod: Record<string, number> = {}, dem: Record<string, number> = {};
  for (const b of g.buildings.values()) {
    const d = BUILDINGS[b.type];
    if (!d.cycle) continue;
    const f = 60 / d.cycle * (1 + (g.mods.prod[b.type] ?? 0) + g.mods.prodAll) * (b.type === 'lumberjack' ? b.env : 1);
    if (d.output) prod[d.output] = (prod[d.output] ?? 0) + (d.outQty ?? 1) * f;
    for (const [k, v] of Object.entries(d.input ?? {})) dem[k] = (dem[k] ?? 0) + (v as number) * f;
  }
  for (const t of ['peasant', 'worker', 'technician', 'citizen'] as TierId[]) {
    const T = (require as any) ? null : null;
  }
  return { prod, dem };
}
import { TIERS, FOODS, TIER_IDS as TIER_IDS_ } from '../../src/sim/data';
const plain: [BuildingId, () => number][] = [
  ['study', () => 1],
  ['firestation', () => houses().length >= 6 ? 1 + Math.floor(houses().length / 16) : 0],
  ['herbalist', () => houses().length >= 8 && g.era < 3 ? 1 + Math.floor(houses().length / 18) : 0],
  ['police', () => g.era >= 2 ? Math.floor(houses().length / 20) : 0],
  ['church', () => g.pop.peasant >= 50 ? 1 : 0],
  ['market', () => 1 + Math.floor(houses().length / 14)],
  ['warehouse', () => Math.floor(houses().length / (g.mode === 'survival' && g.gold > 3000 ? 8 : 18))],
  ['tavern', () => g.era >= 2 && g.pop.worker > 0 ? 1 + Math.floor(houses().length / 16) : 0],
  ['guild', () => g.pop.worker > 30 ? 1 : 0],
  ['smithy', () => g.pop.worker > 30 ? 1 : 0],
  ['park', () => g.era >= 3 ? Math.floor(houses().length / 12) : 0],
  ['school', () => g.era >= 3 ? 1 + Math.floor(houses().length / 25) : 0],
  ['clinic', () => g.era === 3 ? 1 + Math.floor(houses().length / 25) - n('herbalist') : 0],
  ['greenhouse', () => g.era >= 3 ? Math.floor(houses().length / 20) : 0],
  ['university', () => g.pop.technician > 20 ? 1 : 0],
  ['heatplant', () => g.pop.technician > 40 || (g.mode === 'survival' && g.era >= 3) ? Math.ceil(houses().length / 18) : 0],
  ['townhall', () => g.pop.technician > 100 ? 1 : 0],
  ['hospital', () => g.era >= 4 ? 1 + Math.floor(houses().length / 30) : 0],
  ['theatre', () => g.era >= 4 ? 1 + Math.floor(houses().length / 30) : 0],
  ['purifier', () => g.pollutionAvg > 10 ? 1 + Math.floor(g.pop.citizen / 100) : 0],
  ['lab', () => g.pop.citizen > 50 ? 1 : 0],
  ['ironmine', () => g.era >= 2 && g.pop.worker > 10 ? 1 : 0],
  ['compost', () => g.era >= 2 ? Math.floor((n('garden') + n('vegfield') + n('farm') + n('greenhouse')) / 4) : 0],
];
function demandRates() {
  const { prod, dem } = rates();
  for (const t of ['peasant', 'worker', 'technician', 'citizen'] as TierId[]) {
    const T = TIERS[t];
    // plan one tier ahead so chains exist before the upgrade
    const n = g.pop[t] + 8;
    if (T.era > g.era) continue;
    for (const [k, v] of Object.entries(T.comforts)) dem[k] = (dem[k] ?? 0) + n * (v as number);
    const foods = T.foods.filter(f => g.unlocked(producerOf[f] as any));
    for (const f of foods) dem[f] = (dem[f] ?? 0) + n * T.hunger / 4 / foods.length / FOODS[f].fill * (g.season === 'summer' || g.season === 'autumn' ? 2.2 : 1.4) * (f === 'fish' ? 1.4 : 1);
  }
  for (const [f, r] of Object.entries(g.heatBase)) if (f !== 'power') dem[f] = (dem[f] ?? 0) + (r as number) * (g.mode === 'survival' ? 0.5 + g.chill(g.dayF) * 1.2 : 0.5);
  if (!(g.heatNeed as any).firewood) dem.firewood = (dem.firewood ?? 0) + 1;
  // the winters outgrow firewood: lay in coal ahead of time
  if (g.era >= 2 && g.mode === 'survival') dem.coal = (dem.coal ?? 0) + ((g.heatBase as any).firewood ?? 0) * 0.6 * (0.3 + g.chill(g.dayF));
  // building materials: a steady trickle
  dem.planks = (dem.planks ?? 0) + 3;
  if (g.era >= 2) dem.bricks = (dem.bricks ?? 0) + 3;
  if (g.era >= 3) { dem.steel = (dem.steel ?? 0) + 1.5; dem.tools = (dem.tools ?? 0) + 1; }
  if (g.era >= 4) dem.cement = (dem.cement ?? 0) + 2;
  return { prod, dem };
}
let ringR = 2;
const minutes = Number(process.argv[3] ?? 120);
let lastEra = 1;
for (let t = 0; t < minutes * 60; t += 10) {
  g.advance(10);
  // BOT_RICH=1: a player who never runs out of money (to test the late climate past the bot's weak economy)
  if (process.env.BOT_RICH && g.gold < 5000) g.gold = 5000;
  if (g.over && !g.won) { L(`GAME OVER day ${g.day + 1}: ${g.over.reason} hope=${g.hope.toFixed(0)} disc=${g.discontent.toFixed(0)} deaths=${g.deaths}`); break; }
  if (g.over?.won) { L(`WON day ${g.day + 1}: ${g.over.reason}`); g.continueEndless(); }
  // research cheapest available
  if (!g.research.current) {
    const opts = TECH_IDS.filter(x => g.canResearch(x)).sort((a, b) => (g.techCost(a) - g.techCost(b)) || (TECHS[a].era - TECHS[b].era));
    // prefer unlock techs
    const unlock = opts.find(x => ['steam', 'central', 'wind', 'solar', 'purify', 'hydro'].includes(x));
    g.setResearch(unlock ?? opts[0] ?? null);
  }
  {
    const { prod, dem } = demandRates();
    const deficits = Object.keys(dem).filter(k => (prod[k] ?? 0) < dem[k] * 1.05 && producerOf[k] && g.unlocked(producerOf[k]!) && g.canAfford(BUILDINGS[producerOf[k]!].cost))
      .sort((a, b) => (prod[a] ?? 0) / dem[a] - (prod[b] ?? 0) / dem[b]);
    for (const k of deficits.slice(0, 3)) {
      // coal: a mine on a vein if one is free, kilns only otherwise
      if (k === 'coal' && g.unlocked('coalmine') && g.canAfford(BUILDINGS.coalmine.cost) && g.workforce.worker.have - g.workforce.worker.need >= g.workersFor('coalmine') && build('coalmine')) continue;
      const t = producerOf[k]!;
      if (g.gold - BUILDINGS[t].cost.gold < 80) continue;
      const wk = BUILDINGS[t].workers;
      if (wk && g.workforce[wk.tier].have - g.workforce[wk.tier].need < g.workersFor(t)) {
        // no spare hands: grow the tier instead
        continue;
      }
      build(t);
    }
    if (n('sawmill') === 0 && g.count('lumberjack') > 0) build('sawmill');
    if (g.storage.planks < 8 && n('sawmill') < 1 + Math.floor(houses().length / 25)) build('sawmill');
    for (const [t, f] of plain) if (n(t) < f() && g.gold - BUILDINGS[t].cost.gold > 150 && g.taxRate - g.upkeepRate > BUILDINGS[t].upkeep * 0.5) build(t);
    // power
    if (g.power.must > g.power.gen * 0.95 || (g.power.boostRatio < 0.5 && g.gold > 2500) || n('steelworks') > n('coalplant') * 2) {
      if (g.era >= 4 && g.unlocked('windturbine')) build(n('windturbine') <= n('solar') ? 'windturbine' : 'solar'); else build('coalplant');
    }
    if (g.unlocked('coalplant') && n('coalplant') === 0 && n('steelworks') === 0 && g.era >= 3) build('coalplant');
    if (g.era >= 3 && n('steelworks') === 0) build('steelworks');
    // houses when everyone is fed and there is spare work
    const hs = houses();
    const full = hs.every(h => h.residents >= TIERS[h.tier].cap * 0.9);
    const short = TIER_IDS_.some(t => g.workforce[t].need > g.workforce[t].have) && g.foodDays() > 2;
    if ((hs.length < 6 || short || (full && g.happyAvg > 55)) && g.storage.planks >= (short || hs.length < 6 ? 2 : 6) && (g.era < 2 || g.storage.bricks > 6 || hs.length < 20) && g.gold > 60) build('house');
  }
  // trade: sell surplus when short of gold, buy building materials when stuck
  if (!g.harbourFrozen) {
  if (g.gold < 300) for (const k of GOOD_IDS) if (g.storage[k] > g.cap * 0.6) g.sell(k, Math.floor(g.storage[k] - g.cap * 0.4));
  // deep in debt: sell down to a quarter of storage, and stop building houses below
  if (g.gold < 0) for (const k of GOOD_IDS) if (g.storage[k] > g.cap * 0.25) g.sell(k, Math.floor(g.storage[k] - g.cap * 0.25));
  if (g.heatingOn) for (const k of ['firewood', 'coal'] as const) if (g.heatNeed[k] && g.storage[k] < 10 && g.gold > 200) g.buy(k, 20);
  for (const k of ['planks', 'bricks', 'steel', 'tools', 'cement'] as const) if (GOODS[k].era <= g.era && g.storage[k] < 6 && g.gold > 1500) g.buy(k, 10);
  // hungry: buy what each tier eats
  if (g.foodDays() < 1.5 && g.gold > 300) for (const t of TIER_IDS_) if (g.pop[t]) for (const f of TIERS[t].foods) if (GOODS[f].era <= g.era && g.storage[f] < 15) g.buy(f, g.gold > 3000 ? Math.floor(g.cap * 0.5) : 15);
  // survival: stock up on food before winter while the harbour is open
  if (g.mode === 'survival' && g.season === 'autumn' && !g.harbourFrozen && g.gold > 3000) for (const t of TIER_IDS_) if (g.pop[t]) for (const f of TIERS[t].foods) if (GOODS[f].era <= g.era && g.storage[f] < g.cap * 0.7) g.buy(f, Math.floor(g.cap * 0.8 - g.storage[f]));
  }
  // upgrades: keep some lower tier as workforce
  const maxShare: Record<TierId, number> = { peasant: g.era >= 2 ? 0.5 : 0, worker: g.era >= 3 ? 0.55 : 0, technician: g.era >= 4 ? 0.5 : 0, citizen: 0 };
  for (const b of houses()) {
    const hs = houses(), same = hs.filter(h => h.tier === b.tier).length;
    if (!g.upgradeBlock(b)) {
      // check workforce of current tier isn't starved
      const wf = g.workforce[b.tier];
      if (wf.have - b.residents >= wf.need + 4) g.upgrade(b, true);
    }
  }
  // upgrade workplaces and public buildings when rich
  if (g.gold > 900) for (const b of g.buildings.values()) if (b.type !== 'house' && BUILDINGS[b.type].upgrade && !g.upgradeBlock(b)) {
    const wk = BUILDINGS[BUILDINGS[b.type].upgrade!.to].workers;
    if (wk && g.workforce[wk.tier].have - g.workforce[wk.tier].need < wk.n) continue;
    if (g.upgrade(b, true)) { built[g.at(b.x, b.z)!.type] = 1; break; }
  }
  // like a player who watches the coverage overlay: put a herbalist or fire station next to uncovered homes
  if (t % 20 === 0) for (const [prot, type] of [['health', 'herbalist'], ['fire', 'firestation']] as const) {
    const bare = houses().filter(h => h.connected && h.residents > 0 && !h.protect.has(prot));
    if (!bare.length || !g.canAfford(BUILDINGS[type].cost) || g.gold < BUILDINGS[type].cost.gold + 60) continue;
    // the spot that covers the most bare homes
    const r = BUILDINGS[type].radius ?? 6;
    const best = spots(type).slice(0, 400).map(([x, z]) => [x, z, bare.filter(h => Math.hypot(h.x - x, h.z - z) < r).length] as const).sort((a, b) => b[2] - a[2])[0];
    if (process.env.BOT_DEBUG) L('cover', prot, bare.length, best);
    if (best && best[2] >= 2 && g.place(type, best[0], best[1])) built[type] = (built[type] ?? 0) + 1;
  }
  // society (laws, priority, warming huts, events, feasts); BOT_NOSOC=1 plays without them
  if (!process.env.BOT_NOSOC) {
    const sign = (id: any, when: boolean) => { if (when && !g.lawBlock(id)) g.signLaw(id); };
    sign('cemetery', g.deaths > 0 && g.gold > 400);
    sign('extrabeds', g.beds.need > g.beds.have);
    sign('vespers', g.hope < 60);
    sign('warmwear', g.heatingOn && g.temp < -8 && g.taxRate - g.upkeepRate > 40);
    sign('ration', g.foodDays() < 0.8 && g.pop.peasant + g.pop.worker > 40);
    sign('extshift', g.happyAvg > 70 && g.discontent < 25);
    for (const b of g.buildings.values()) if (['firewood', 'coalmine', 'charcoal', 'fishery', 'fishpier', 'fishport', 'heatplant', 'bakery', 'greenhouse', 'cannery'].includes(b.type)) b.priority = true;
    if (g.card) {
      const c = g.card;
      if (c.kind === 'refugees') g.answerCard(houses().length && c.data.n <= 20 ? 0 : 1);
      else if (c.kind === 'order') g.answerCard(g.storage[c.data.good as GoodId] >= c.data.n * 0.6 ? 0 : 1);
      else g.answerCard(0);
    }
    if (g.order) g.deliverOrder();
    if (t % 30 === 0 && g.beds.need > g.beds.have * 1.1) build(g.era >= 4 ? 'hospital' : g.era >= 3 ? 'clinic' : 'herbalist');
    if (g.hope < 45 && g.gold > 400 && !g.feastBlock()) g.holdFeast();
    if (!g.funeralBlock()) g.holdFuneral();
    // warming huts beside workplaces left in the cold
    if (t % 30 === 0 && g.heatingOn && g.temp < -8 && g.gold > 200) {
      const cold = [...g.buildings.values()].filter(b => BUILDINGS[b.type].workers && !g.warmSite(b) && b.connected);
      const r = BUILDINGS.warmhut.radius!;
      const best = cold.length ? spots('warmhut').slice(0, 400).map(([x, z]) => [x, z, cold.filter(b => Math.hypot(b.x + b.w / 2 - x - 1, b.z + b.h / 2 - z - 1) < r).length] as const).sort((a, b) => b[2] - a[2])[0] : undefined;
      if (best && best[2] >= 2 && g.place('warmhut', best[0], best[1])) built.warmhut = (built.warmhut ?? 0) + 1;
    }
  }
  // expand roads when out of space
  if (spots('house').length < 3 && ringR < 6) { ringR++; gridRoads(ringR); }
  if (t % 60 === 0) for (const b of g.buildings.values()) if (!b.connected && b.type !== 'house') connect(b);
  for (const x of g.toasts.splice(0)) if (x.kind !== 'info' || x.text.startsWith('进入') || x.text.startsWith('研究')) L(`  [${(g.time / 60).toFixed(1)}m] ${x.text}`);
  if (t % 120 === 0 || g.era !== lastEra) {
    lastEra = g.era;
    const st = Object.fromEntries(GOOD_IDS.filter(k => g.storage[k] > 0.5).map(k => [k, Math.round(g.storage[k])]));
    L(`t=${(g.time / 60).toFixed(0)}m y${g.year} ${g.season} era${g.era} gold=${Math.round(g.gold)} net=${Math.round(g.taxRate - g.upkeepRate)} pop=${JSON.stringify(g.pop)} happy=${g.happyAvg.toFixed(0)} pol=${g.pollutionAvg.toFixed(1)} power=${g.power.gen.toFixed(0)}/${g.power.must.toFixed(0)}+${g.power.boost.toFixed(0)}(${Math.round(g.power.boostRatio*100)}%) day=${g.day + 1} ${g.seasonName()} blz=${g.blizzard?1:0} t=${g.temp.toFixed(0)} hope=${g.hope.toFixed(0)} disc=${g.discontent.toFixed(0)} deaths=${g.deaths} rp=${g.research.rate.toFixed(0)} cap=${g.cap} q=${g.questIndex}`);
    L('   store', JSON.stringify(st));
    const wf = Object.fromEntries(Object.entries(g.workforce).map(([k, v]) => [k, `${v.have}/${v.need}`]));
    L('   bare', 'health', houses().filter(h => h.residents && !h.protect.has('health')).length, 'fire', houses().filter(h => h.residents && !h.protect.has('fire')).length, 'plague', houses().filter(h => h.plague > 0).length);
    L('   workforce', JSON.stringify(wf), 'houses', houses().length, 'blds', JSON.stringify(Object.fromEntries(Object.keys(built).map(k => [k, n(k as BuildingId)]))));
    const bad = [...g.buildings.values()].filter(b => b.type !== 'house' && b.status && !b.status.startsWith('运转') && !b.status.startsWith('研究') && !b.status.startsWith('发电') && b.status !== '').map(b => b.type + ':' + b.status);
    if (bad.length) L('   issues', [...new Set(bad)].join(' | '));
  }
}
L('techs', JSON.stringify(g.research.levels));
import { writeFileSync } from 'fs';
if (process.argv[4]) writeFileSync(process.argv[4], g.serialize());
