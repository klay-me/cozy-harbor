// Fixed, hand-designed maps. Each map is a grid of characters, one string per row (row 0 = north),
// so it can be edited by hand and read by any engine.
//   .  grass        :  sand         ^  rock (nothing can be built)
//   ~  sea          =  river / lake (can be bridged; "inland water")
//   t  round tree   p  pine tree    (on grass)
//   P  pine tree on rock (mountain slopes, cliff tops)
//   i  iron ore     c  coal          (each vein is made of 2x2 patches, on grass)
//   H  the harbour  (3x3; its middle bottom tile must face the sea)
// Optional `height`: same grid, one base-36 digit per tile = height of rock in quarter units (0..z = 0..8.75).
// Optional `landmarks`: decorative set pieces (lighthouse, tower, stones, falls, wreck) on tiles nothing can use.
import { HARBOR_ROWS } from './harbor';
import { HAVEN_ROWS, HAVEN_HEIGHT, HAVEN_LANDMARKS } from './haven';

export type MapId = 'harbor' | 'haven';
export interface Landmark { kind: string; name: string; x: number; z: number }
export interface MapDef { name: string; desc: string; rows: string[]; height?: string[]; landmarks?: Landmark[] }
export const MAPS: Record<MapId, MapDef> = {
  harbor: { name: '暖港湾', desc: '南面海湾里的小港口。西边隔着清溪是大片森林和铁矿，北边山脚下有煤，东边是开阔的草原和长长的海岸。', rows: HARBOR_ROWS },
  haven: {
    name: '晴岚湾',
    desc: '云岭脚下的海湾。港口在暖港湾最里面；过玉带河是西林和铁矿，沿山口上北谷挖煤，东原留给后来的大城，灯塔岬守着东南的海。',
    rows: HAVEN_ROWS, height: HAVEN_HEIGHT, landmarks: HAVEN_LANDMARKS,
  },
};
export const DEFAULT_MAP: MapId = 'haven';
export const isMapId = (s: unknown): s is MapId => typeof s === 'string' && s in MAPS;
