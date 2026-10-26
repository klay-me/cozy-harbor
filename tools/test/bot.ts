import { Game } from '../../src/sim/game';
import { BUILDINGS, BuildingId, TECH_IDS, TECHS, GOOD_IDS, TierId } from '../../src/sim/data';
import { Tile } from '../../src/sim/world';

// map id (default: the fixed map) or a numeric seed for a random map
const arg = process.argv[2] ?? 'haven';
const g = new Game(isNaN(Number(arg)) ? arg as any : Number(arg));
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
  ['church', () => g.pop.peasant >= 50 && g.gold > 700 ? 1 : 0],
  ['market', () => 1 + Math.floor(houses().length / 14)],
  ['warehouse', () => Math.floor(houses().length / 18)],
  ['tavern', () => g.era >= 2 && g.pop.worker > 0 ? 1 + Math.floor(houses().length / 16) : 0],
  ['guild', () => g.pop.worker > 30 ? 1 : 0],
  ['smithy', () => g.pop.worker > 30 ? 1 : 0],
  ['park', () => g.era >= 3 ? Math.floor(houses().length / 12) : 0],
  ['school', () => g.era >= 3 ? 1 + Math.floor(houses().length / 25) : 0],
  ['clinic', () => g.era === 3 ? 1 + Math.floor(houses().length / 25) - n('herbalist') : 0],
  ['greenhouse', () => g.era >= 3 ? Math.floor(houses().length / 20) : 0],
  ['university', () => g.pop.technician > 20 ? 1 : 0],
  ['heatplant', () => g.pop.technician > 40 ? Math.floor(houses().length / 20) : 0],
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
  for (const [f, r] of Object.entries(g.heatBase)) if (f !== 'power') dem[f] = (dem[f] ?? 0) + (r as number) * 0.5;
  if (!(g.heatNeed as any).firewood) dem.firewood = (dem.firewood ?? 0) + 1;
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
    if (g.power.use > g.power.gen * 0.95 || n('steelworks') > n('coalplant') * 2) {
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
  if (g.gold < 300) for (const k of GOOD_IDS) if (g.storage[k] > g.cap * 0.6) g.sell(k, Math.floor(g.storage[k] - g.cap * 0.4));
  for (const k of ['planks', 'bricks', 'steel', 'tools', 'cement'] as const) if (g.storage[k] < 6 && g.gold > 1500) g.buy(k, 10);
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
  // expand roads when out of space
  if (spots('house').length < 3 && ringR < 6) { ringR++; gridRoads(ringR); }
  if (t % 60 === 0) for (const b of g.buildings.values()) if (!b.connected && b.type !== 'house') connect(b);
  for (const x of g.toasts.splice(0)) if (x.kind !== 'info' || x.text.startsWith('进入') || x.text.startsWith('研究')) L(`  [${(g.time / 60).toFixed(1)}m] ${x.text}`);
  if (t % 120 === 0 || g.era !== lastEra) {
    lastEra = g.era;
    const st = Object.fromEntries(GOOD_IDS.filter(k => g.storage[k] > 0.5).map(k => [k, Math.round(g.storage[k])]));
    L(`t=${(g.time / 60).toFixed(0)}m y${g.year} ${g.season} era${g.era} gold=${Math.round(g.gold)} net=${Math.round(g.taxRate - g.upkeepRate)} pop=${JSON.stringify(g.pop)} happy=${g.happyAvg.toFixed(0)} pol=${g.pollutionAvg.toFixed(1)} power=${g.power.gen.toFixed(0)}/${g.power.use.toFixed(0)} rp=${g.research.rate.toFixed(0)} cap=${g.cap} q=${g.questIndex}`);
    L('   store', JSON.stringify(st));
    const wf = Object.fromEntries(Object.entries(g.workforce).map(([k, v]) => [k, `${v.have}/${v.need}`]));
    L('   workforce', JSON.stringify(wf), 'houses', houses().length, 'blds', JSON.stringify(Object.fromEntries(Object.keys(built).map(k => [k, n(k as BuildingId)]))));
    const bad = [...g.buildings.values()].filter(b => b.type !== 'house' && b.status && !b.status.startsWith('运转') && !b.status.startsWith('研究') && !b.status.startsWith('发电') && b.status !== '').map(b => b.type + ':' + b.status);
    if (bad.length) L('   issues', [...new Set(bad)].join(' | '));
  }
}
L('techs', JSON.stringify(g.research.levels));
import { writeFileSync } from 'fs';
if (process.argv[4]) writeFileSync(process.argv[4], g.serialize());
