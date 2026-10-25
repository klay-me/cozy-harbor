// Maps game objects to the Blender-made models loaded in assets.ts.
import { BUILDINGS, BuildingId, TierId } from '../sim/data';
import { getModel, hasModel, Model } from './assets';
export type { Model, ModelGeo, AnimPart } from './assets';

export function model(type: BuildingId, tier: TierId, variant: number): Model {
  if (type === 'house') return getModel(`house_${tier}_${variant % 4}`);
  const name = BUILDINGS[type].model || type;
  return getModel(hasModel(name) ? name : 'warehouse');
}
