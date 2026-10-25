// Maps game objects to the Blender-made models loaded in assets.ts.
import type { BuildingId } from '../sim/data';
import { getModel, Model } from './assets';
export type { Model, ModelGeo, AnimPart } from './assets';

export function model(type: BuildingId, tier: 'peasant' | 'worker', variant: number): Model {
  if (type === 'house') return getModel(`house_${tier}_${variant % 4}`);
  return getModel(type);
}
