// Production-chain arithmetic for the UI: what one building makes in a day, and how many
// other buildings or residents that output keeps going (at full staff, before bonuses).
import {
  BUILDINGS, BuildingId, GoodId, GOODS, TIERS, TIER_IDS, DAY_LENGTH, PER_DAY, FOODS, isFood,
  HEAT_PER_RESIDENT,
} from '../sim/data';

export const outPerDay = (t: BuildingId) => {
  const d = BUILDINGS[t];
  return d.cycle && d.output ? (d.outQty ?? 1) * DAY_LENGTH / d.cycle : 0;
};
export const inPerDay = (t: BuildingId): [GoodId, number][] => {
  const d = BUILDINGS[t];
  return d.cycle ? (Object.entries(d.input ?? {}) as [GoodId, number][]).map(([g, n]) => [g, n * DAY_LENGTH / d.cycle!]) : [];
};
const producers = (g: GoodId) => (Object.keys(BUILDINGS) as BuildingId[]).filter(t => BUILDINGS[t].output === g && t !== 'recycler');
const consumers = (g: GoodId) => (Object.keys(BUILDINGS) as BuildingId[]).filter(t => BUILDINGS[t].input?.[g]);
const fmt = (n: number) => n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();

/** lines like "可供 2 座锯木厂", "可喂饱 20 位农民" for a building's output */
export function supplies(t: BuildingId): string[] {
  const d = BUILDINGS[t], g = d.output;
  if (!g) return [];
  const per = outPerDay(t), out: string[] = [];
  for (const c of consumers(g)) {
    const need = inPerDay(c).find(([k]) => k === g)?.[1] ?? 0;
    if (need) out.push(`可供 ${fmt(per / need)} 座${BUILDINGS[c].name}`);
  }
  if (isFood(g)) {
    for (const tier of TIER_IDS) if (TIERS[tier].foods.includes(g)) out.push(`单吃它能喂饱 ${fmt(per * FOODS[g].fill / TIERS[tier].hunger)} 位${TIERS[tier].name}`);
  }
  for (const tier of TIER_IDS) {
    const r = TIERS[tier].comforts[g];
    if (r) out.push(`够 ${fmt(per / (r * PER_DAY))} 位${TIERS[tier].name}使用`);
    if (TIERS[tier].fuel === g) out.push(`-6°C 时够 ${fmt(per / (HEAT_PER_RESIDENT * PER_DAY))} 位${TIERS[tier].name}取暖`);
  }
  return out;
}

/** lines like "原料要 0.5 座伐木场供应" for a building's inputs */
export function needs(t: BuildingId): string[] {
  return inPerDay(t).map(([g, n]) => {
    const p = producers(g)[0];
    const per = p ? outPerDay(p) : 0;
    return per ? `${GOODS[g].name}每天 ${fmt(n)}，约要 ${fmt(n / per)} 座${BUILDINGS[p].name}供应` : `${GOODS[g].name}每天 ${fmt(n)}`;
  });
}

/** one-line summary for tooltips */
export function chainSummary(t: BuildingId): string {
  const d = BUILDINGS[t];
  if (!d.output) return '';
  const ins = inPerDay(t).map(([g, n]) => `${fmt(n)} ${GOODS[g].name}`).join(' + ');
  return `每天${ins ? `用 ${ins} ` : ''}产出 ${fmt(outPerDay(t))} ${GOODS[d.output].name}（满员）。${supplies(t).slice(0, 3).join('，')}`;
}
