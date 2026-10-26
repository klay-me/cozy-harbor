// Fixed, hand-designed maps. Each map is a grid of characters, one string per row (row 0 = north),
// so it can be edited by hand and read by any engine.
//   .  grass        :  sand         ^  rock (nothing can be built)
//   ~  sea          =  river / lake (can be bridged; "inland water")
//   t  round tree   p  pine tree    (on grass)
//   i  iron ore     c  coal          (each vein is made of 2x2 patches, on grass)
//   H  the harbour  (3x3; its middle bottom tile must face the sea)
import { HARBOR_ROWS } from './harbor';

export type MapId = 'harbor';
export interface MapDef { name: string; desc: string; rows: string[] }
export const MAPS: Record<MapId, MapDef> = {
  harbor: { name: '暖港湾', desc: '南面海湾里的小港口。西边隔着清溪是大片森林和铁矿，北边山脚下有煤，东边是开阔的草原和长长的海岸。', rows: HARBOR_ROWS },
};
export const DEFAULT_MAP: MapId = 'harbor';
export const isMapId = (s: unknown): s is MapId => typeof s === 'string' && s in MAPS;
