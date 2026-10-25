// Procedural cute building models. Each model is centred on its footprint at y = 0,
// with +z as its front (fisheries and the harbour face the water that way).
import * as THREE from 'three';
import { P, merge, Box, Cyl, Ball, Gable, Part } from './toon';
import type { BuildingId } from '../sim/data';

const C = {
  cream: '#fff1d6', cream2: '#ffe6c4', wood: '#c98b5a', dark: '#7d5238', stone: '#d4cabb',
  win: '#567aa6', green: '#7cc36a', leaf: '#6dbb57', pine: '#4f9a5f', gold: '#f2cf5b',
  soil: '#a8774a', brick: '#d0705a', pink: '#ff9fb2', sky: '#8cc4ec',
};
export const ROOFS = ['#f2766b', '#6fa8dc', '#f7b955', '#8fcf6f'];

export interface ModelGeo { body: THREE.BufferGeometry; line: THREE.BufferGeometry }
export interface Model extends ModelGeo { anim?: { geo: ModelGeo; at: [number, number, number]; kind: 'spinZ' | 'bob' } }

const PI = Math.PI;
const front = (w: number, h: number, d: number, x: number, y: number, z: number, col: string) => P(Box(w, h, d), { col, at: [x, y, z] });
const roundWin = (x: number, y: number, z: number, r = 0.11) => P(Cyl(r, r, 0.05, 14), { col: C.win, at: [x, y, z], rot: [PI / 2, 0, 0], type: 'cyl' });
const bush = (x: number, z: number, r = 0.16) => [
  P(Ball(r, 10, 8), { col: C.green, at: [x, r * 0.9, z], type: 'sphere' }),
  P(Ball(0.05, 8, 6), { col: C.pink, at: [x + r * 0.5, r * 1.5, z + r * 0.4], type: 'sphere' }),
  P(Ball(0.05, 8, 6), { col: '#fff3a8', at: [x - r * 0.4, r * 1.6, z + r * 0.3], type: 'sphere' }),
];
const crate = (x: number, y: number, z: number, s = 0.26) => P(Box(s, s, s), { col: '#e0a668', at: [x, y + s / 2, z] });
const barrel = (x: number, z: number) => P(Cyl(0.13, 0.13, 0.3, 10), { col: C.wood, at: [x, 0.15, z], type: 'cyl' });
const slab = (w: number, d: number) => P(Box(w, 0.1, d), { col: C.stone, at: [0, 0.05, 0] });

function peasantHouse(roof: string): Model {
  return merge([
    slab(1.55, 1.4),
    front(1.2, 0.78, 1.0, 0, 0.49, -0.05, C.cream),
    P(Gable(0.78, 0.62, 1.28), { col: roof, at: [0, 1.19, -0.05], flat: true }),
    front(0.26, 0.42, 0.04, -0.27, 0.31, 0.47, C.dark),
    roundWin(0.25, 0.58, 0.46),
    front(0.16, 0.42, 0.16, 0.32, 1.35, -0.3, C.brick),
    ...bush(0.58, 0.55), ...bush(-0.62, 0.5, 0.12),
  ]);
}
function workerHouse(roof: string): Model {
  return merge([
    slab(1.6, 1.45),
    front(1.3, 1.2, 1.1, 0, 0.7, -0.05, C.cream2),
    front(1.34, 0.08, 1.14, 0, 0.72, -0.05, C.wood),
    P(Gable(0.84, 0.72, 1.36), { col: roof, at: [0, 1.66, -0.05], flat: true }),
    front(0.26, 0.42, 0.04, -0.3, 0.31, 0.52, C.dark),
    front(0.24, 0.24, 0.04, 0.3, 0.42, 0.52, C.win),
    front(0.22, 0.24, 0.04, -0.3, 1.0, 0.52, C.win),
    front(0.22, 0.24, 0.04, 0.3, 1.0, 0.52, C.win),
    front(0.5, 0.1, 0.14, 0.3, 0.84, 0.58, C.wood),
    P(Ball(0.06, 8, 6), { col: C.pink, at: [0.18, 0.93, 0.6], type: 'sphere' }),
    P(Ball(0.06, 8, 6), { col: '#fff3a8', at: [0.38, 0.93, 0.6], type: 'sphere' }),
    front(0.18, 0.5, 0.18, 0.36, 1.85, -0.35, C.brick),
    ...bush(0.66, 0.6, 0.13),
  ]);
}

const MODELS: Record<string, () => Model> = {
  depot: () => merge([
    P(Box(2.85, 0.16, 2.85), { col: C.stone, at: [0, 0.08, 0] }),
    front(1.8, 1.1, 1.3, -0.25, 0.71, -0.45, C.cream),
    P(Gable(0.78, 0.72, 2.05), { col: '#6fa8dc', at: [-0.25, 1.62, -0.45], rot: [0, PI / 2, 0], flat: true }),
    front(0.34, 0.55, 0.04, -0.25, 0.43, 0.22, C.dark),
    front(0.26, 0.26, 0.04, -0.85, 0.75, 0.22, C.win), front(0.26, 0.26, 0.04, 0.35, 0.75, 0.22, C.win),
    front(0.62, 1.7, 0.62, 0.95, 1.0, -0.75, C.cream2),
    P(Cyl(0, 0.52, 0.62, 4), { col: '#f2766b', at: [0.95, 2.16, -0.75], rot: [0, PI / 4, 0], type: 'cyl', flat: true }),
    roundWin(0.95, 1.45, -0.43, 0.13),
    P(Cyl(0.025, 0.025, 0.9, 6), { col: C.dark, at: [0.95, 2.85, -0.75], type: 'cyl' }),
    front(0.42, 0.26, 0.02, 1.17, 3.15, -0.75, '#f2766b'),
    crate(0.9, 0.16, 0.55), crate(1.18, 0.16, 0.72), crate(1.02, 0.42, 0.62, 0.22),
    barrel(-1.05, 0.75), barrel(-0.78, 0.92),
    P(Box(0.9, 0.08, 1.5), { col: C.wood, at: [-0.2, 0.12, 1.85] }),
    P(Cyl(0.06, 0.06, 0.6, 6), { col: C.dark, at: [-0.6, -0.1, 2.5], type: 'cyl' }),
    P(Cyl(0.06, 0.06, 0.6, 6), { col: C.dark, at: [0.2, -0.1, 2.5], type: 'cyl' }),
  ]),
  warehouse: () => merge([
    slab(1.75, 1.6),
    front(1.4, 0.9, 1.15, 0, 0.55, -0.1, '#e8866a'),
    P(Gable(0.66, 0.55, 1.55), { col: '#9a6241', at: [0, 1.27, -0.1], rot: [0, PI / 2, 0], flat: true }),
    front(0.52, 0.62, 0.04, 0, 0.41, 0.49, C.cream),
    front(0.04, 0.6, 0.04, 0, 0.41, 0.52, '#e8866a'),
    crate(0.6, 0.1, 0.62), crate(0.42, 0.1, 0.72, 0.2), crate(-0.6, 0.1, 0.65),
    P(Ball(0.14, 10, 8), { col: '#f3e1b4', at: [-0.35, 0.18, 0.7], scale: [1, 0.8, 1], type: 'sphere' }),
  ]),
  lumberjack: () => merge([
    slab(1.65, 1.55),
    front(1.0, 0.68, 0.9, -0.28, 0.44, -0.25, '#bf7d4c'),
    P(Gable(0.62, 0.46, 1.08), { col: C.green, at: [-0.28, 1.01, -0.25], flat: true }),
    front(0.24, 0.38, 0.04, -0.28, 0.29, 0.21, C.dark),
    ...[[0.45, 0.17, 0.32], [0.45, 0.17, 0.56], [0.45, 0.38, 0.44]].map(([x, y, z]) => P(Cyl(0.11, 0.11, 0.8, 10), { col: '#d79c68', at: [x, y, z], rot: [0, 0, PI / 2], type: 'cyl' })),
    P(Cyl(0.19, 0.22, 0.26, 12), { col: '#d79c68', at: [0.48, 0.13, -0.4], type: 'cyl' }),
    P(Box(0.04, 0.3, 0.04), { col: C.dark, at: [0.5, 0.36, -0.4], rot: [0, 0, 0.4] }),
    P(Box(0.14, 0.08, 0.03), { col: '#cfd6de', at: [0.56, 0.48, -0.4], rot: [0, 0, 0.4] }),
  ]),
  sawmill: () => ({
    ...merge([
      slab(1.7, 1.6),
      front(1.3, 0.72, 0.85, 0, 0.46, -0.3, '#efc996'),
      P(Gable(0.62, 0.42, 1.45), { col: '#e0735f', at: [0, 1.03, -0.3], rot: [0, PI / 2, 0], flat: true }),
      front(0.3, 0.4, 0.04, -0.35, 0.3, 0.14, C.dark),
      ...[0.13, 0.19, 0.25, 0.31].map((y, i) => P(Box(0.75, 0.05, 0.22), { col: i % 2 ? '#f2cf93' : '#e8bd80', at: [-0.3, y, 0.55] })),
      P(Box(0.5, 0.36, 0.3), { col: C.wood, at: [0.45, 0.18, 0.45] }),
    ]),
    anim: { geo: merge([P(Cyl(0.3, 0.3, 0.05, 18), { col: '#cfd6de', rot: [PI / 2, 0, 0], type: 'cyl' }), P(Cyl(0.06, 0.06, 0.08, 8), { col: C.dark, rot: [PI / 2, 0, 0], type: 'cyl' })]), at: [0.45, 0.5, 0.45], kind: 'spinZ' },
  }),
  fishery: () => ({
    ...merge([
      P(Box(1.4, 0.1, 1.2), { col: C.stone, at: [-0.1, 0.05, -0.15] }),
      front(0.9, 0.62, 0.8, -0.3, 0.41, -0.3, '#d6eef8'),
      P(Gable(0.56, 0.42, 0.98), { col: '#ef8f6f', at: [-0.3, 0.93, -0.3], flat: true }),
      front(0.22, 0.36, 0.04, -0.3, 0.28, 0.11, C.dark),
      P(Box(0.42, 0.06, 1.25), { col: C.wood, at: [0.45, 0.12, 0.55] }),
      P(Cyl(0.04, 0.04, 0.5, 6), { col: C.dark, at: [0.27, 0.0, 1.1], type: 'cyl' }),
      P(Cyl(0.04, 0.04, 0.5, 6), { col: C.dark, at: [0.63, 0.0, 1.1], type: 'cyl' }),
      P(Box(0.04, 0.55, 0.04), { col: C.dark, at: [-0.7, 0.3, 0.45] }), P(Box(0.04, 0.55, 0.04), { col: C.dark, at: [-0.1, 0.3, 0.45] }),
      P(Box(0.66, 0.04, 0.04), { col: C.dark, at: [-0.4, 0.56, 0.45] }),
      ...[-0.6, -0.42, -0.24].map(x => P(Ball(0.07, 8, 6), { col: '#f5a35c', at: [x, 0.43, 0.45], scale: [0.6, 1.4, 0.4], type: 'sphere' })),
    ]),
    anim: { geo: merge([
      P(Box(0.5, 0.12, 0.22), { col: '#f2766b', at: [0, 0.06, 0] }),
      P(Box(0.42, 0.04, 0.18), { col: C.wood, at: [0, 0.13, 0] }),
      P(Cyl(0.015, 0.015, 0.45, 5), { col: C.dark, at: [0, 0.35, 0], type: 'cyl' }),
      P(Gable(0.15, 0.3, 0.02), { col: '#fff8ea', at: [0.08, 0.38, 0], rot: [0, 0, -PI / 2], flat: true }),
    ]), at: [0.95, -0.05, 1.15], kind: 'bob' },
  }),
  farm: () => merge([
    front(0.82, 0.6, 0.72, -0.92, 0.32, -0.92, '#f08a6a'),
    P(Gable(0.5, 0.36, 0.86), { col: C.cream, at: [-0.92, 0.8, -0.92], flat: true }),
    front(0.24, 0.32, 0.04, -0.92, 0.18, -0.55, C.cream),
    P(Box(2.7, 0.06, 1.55), { col: C.soil, at: [0.05, 0.03, 0.62] }),
    ...[0.05, 0.33, 0.61, 0.89, 1.17].map(z => P(Box(2.5, 0.2, 0.17), { col: C.gold, at: [0.05, 0.14, z] })),
    P(Box(1.55, 0.06, 1.0), { col: C.soil, at: [0.62, 0.03, -0.78] }),
    ...[-1.08, -0.78, -0.48].map(z => P(Box(1.4, 0.16, 0.17), { col: '#a6d36b', at: [0.62, 0.11, z] })),
    P(Cyl(0.03, 0.03, 0.6, 5), { col: C.dark, at: [-1.15, 0.3, 0.2], type: 'cyl' }),
    P(Box(0.4, 0.04, 0.04), { col: C.dark, at: [-1.15, 0.45, 0.2] }),
    P(Ball(0.1, 10, 8), { col: '#f6d9a8', at: [-1.15, 0.66, 0.2], type: 'sphere' }),
    P(Cyl(0, 0.14, 0.12, 8), { col: C.gold, at: [-1.15, 0.78, 0.2], type: 'cyl' }),
  ]),
  mill: () => ({
    ...merge([
      slab(1.5, 1.5),
      P(Cyl(0.58, 0.66, 0.42, 12), { col: C.stone, at: [0, 0.31, 0], type: 'cyl' }),
      P(Cyl(0.36, 0.52, 1.35, 12), { col: C.cream, at: [0, 1.19, 0], type: 'cyl' }),
      P(Cyl(0, 0.46, 0.5, 12), { col: '#f2766b', at: [0, 2.11, 0], type: 'cyl' }),
      front(0.22, 0.34, 0.04, 0, 0.66, 0.6, C.dark),
      roundWin(0, 1.35, 0.44, 0.09),
      P(Ball(0.14, 10, 8), { col: '#f3e1b4', at: [0.55, 0.14, 0.55], scale: [1, 0.8, 1], type: 'sphere' }),
      P(Ball(0.12, 10, 8), { col: '#f3e1b4', at: [0.35, 0.12, 0.65], scale: [1, 0.8, 1], type: 'sphere' }),
    ]),
    anim: { geo: merge([
      P(Ball(0.1, 10, 8), { col: C.dark, type: 'sphere' }),
      ...[0, 1, 2, 3].map(i => P(Box(0.2, 0.85, 0.03), { col: '#fff8ea', at: [Math.sin(i * PI / 2) * 0.5, Math.cos(i * PI / 2) * 0.5, 0], rot: [0, 0, -i * PI / 2] })),
    ]), at: [0, 1.7, 0.5], kind: 'spinZ' },
  }),
  bakery: () => merge([
    slab(1.65, 1.5),
    front(1.3, 0.8, 1.05, 0, 0.5, -0.1, '#f7d9a6'),
    P(Gable(0.62, 0.5, 1.45), { col: '#d9644f', at: [0, 1.15, -0.1], rot: [0, PI / 2, 0], flat: true }),
    P(Cyl(0.15, 0.17, 0.75, 10), { col: C.brick, at: [0.42, 1.32, -0.35], type: 'cyl' }),
    front(0.26, 0.4, 0.04, -0.3, 0.3, 0.44, C.dark),
    front(0.32, 0.26, 0.04, 0.25, 0.52, 0.44, C.win),
    P(Box(0.95, 0.05, 0.32), { col: '#f08a7e', at: [0, 0.82, 0.58], rot: [0.35, 0, 0] }),
    P(Cyl(0.17, 0.17, 0.04, 16), { col: '#f2b25b', at: [0.55, 0.62, 0.52], rot: [PI / 2, 0, 0], type: 'cyl' }),
    P(Ball(0.09, 10, 8), { col: '#c9803e', at: [0.55, 0.62, 0.56], scale: [1.4, 0.8, 0.6], type: 'sphere' }),
    P(Box(0.4, 0.22, 0.25), { col: C.wood, at: [0.4, 0.11, 0.62] }),
    ...[0.3, 0.45].map(x => P(Ball(0.08, 10, 8), { col: '#d48c45', at: [x, 0.27, 0.62], scale: [1.4, 0.7, 0.8], type: 'sphere' })),
  ]),
  market: () => {
    const parts: Part[] = [P(Box(1.75, 0.08, 1.75), { col: '#efe2c8', at: [0, 0.04, 0] })];
    const stalls: [number, number, number, string][] = [[-0.45, -0.45, 0, '#f2766b'], [0.45, -0.45, 0, '#6fa8dc'], [-0.45, 0.45, PI, '#f7b955'], [0.45, 0.45, PI, '#8fcf6f']];
    for (const [x, z, r, col] of stalls) {
      const s = Math.cos(r);
      parts.push(P(Box(0.6, 0.28, 0.32), { col: C.wood, at: [x, 0.22, z] }));
      parts.push(P(Box(0.04, 0.6, 0.04), { col: C.dark, at: [x - 0.27, 0.38, z - 0.18 * s] }), P(Box(0.04, 0.6, 0.04), { col: C.dark, at: [x + 0.27, 0.38, z - 0.18 * s] }));
      parts.push(P(Box(0.7, 0.05, 0.5), { col, at: [x, 0.7, z + 0.02 * s], rot: [0.3 * s, 0, 0] }));
      ['#f5a35c', '#ff9fb2', '#a6d36b'].forEach((c, i) => parts.push(P(Ball(0.06, 8, 6), { col: c, at: [x - 0.15 + i * 0.15, 0.4, z], type: 'sphere' })));
    }
    parts.push(P(Cyl(0.12, 0.14, 0.2, 10), { col: C.stone, at: [0, 0.14, 0], type: 'cyl' }), P(Ball(0.16, 10, 8), { col: C.green, at: [0, 0.34, 0], type: 'sphere' }));
    return merge(parts);
  },
  tavern: () => merge([
    slab(1.7, 1.55),
    front(1.3, 0.95, 1.1, 0, 0.58, -0.1, '#f3e3c3'),
    front(1.34, 0.07, 1.14, 0, 0.6, -0.1, C.wood),
    front(0.07, 0.95, 0.04, -0.5, 0.58, 0.46, C.wood), front(0.07, 0.95, 0.04, 0.5, 0.58, 0.46, C.wood),
    P(Gable(0.62, 0.55, 1.45), { col: '#5fae6e', at: [0, 1.32, -0.1], rot: [0, PI / 2, 0], flat: true }),
    front(0.28, 0.44, 0.04, 0, 0.32, 0.46, C.dark),
    front(0.24, 0.22, 0.04, -0.28, 0.85, 0.46, C.win), front(0.24, 0.22, 0.04, 0.28, 0.85, 0.46, C.win),
    P(Box(0.04, 0.04, 0.3), { col: C.dark, at: [0.72, 0.95, 0.5] }),
    P(Box(0.26, 0.22, 0.03), { col: '#f2b25b', at: [0.72, 0.8, 0.62] }),
    barrel(0.5, 0.66), barrel(0.22, 0.7), barrel(-0.6, 0.65),
    P(Ball(0.06, 8, 6), { col: '#ffe08a', at: [-0.28, 1.05, 0.5], type: 'sphere' }),
  ]),
};

const cache = new Map<string, Model>();
export function model(type: BuildingId, tier: 'peasant' | 'worker', variant: number): Model {
  const key = type === 'house' ? `${type}-${tier}-${variant}` : type;
  let m = cache.get(key);
  if (!m) {
    m = type === 'house' ? (tier === 'worker' ? workerHouse(ROOFS[variant]) : peasantHouse(ROOFS[variant])) : MODELS[type]();
    cache.set(key, m);
  }
  return m;
}

export const TREE_ROUND = merge([
  P(Cyl(0.05, 0.08, 0.36, 6), { col: '#8a5d3f', at: [0, 0.18, 0], type: 'cyl' }),
  P(Ball(0.3, 12, 9), { col: C.leaf, at: [0, 0.55, 0], type: 'sphere' }),
  P(Ball(0.19, 10, 8), { col: '#80c865', at: [0.1, 0.78, 0.05], type: 'sphere' }),
]);
export const TREE_PINE = merge([
  P(Cyl(0.05, 0.07, 0.3, 6), { col: '#8a5d3f', at: [0, 0.15, 0], type: 'cyl' }),
  P(Cyl(0, 0.34, 0.5, 9), { col: C.pine, at: [0, 0.5, 0], type: 'cyl' }),
  P(Cyl(0, 0.27, 0.42, 9), { col: '#5bab69', at: [0, 0.74, 0], type: 'cyl' }),
  P(Cyl(0, 0.19, 0.34, 9), { col: '#68b876', at: [0, 0.96, 0], type: 'cyl' }),
]);
export const ROCK = merge([
  P(new THREE.DodecahedronGeometry(0.42, 0), { col: '#bdb6aa', at: [0, 0.2, 0], type: 'sphere', flat: true, scale: [1, 0.8, 1] }),
  P(new THREE.DodecahedronGeometry(0.26, 0), { col: '#ada597', at: [0.35, 0.12, 0.2], type: 'sphere', flat: true }),
  P(new THREE.DodecahedronGeometry(0.2, 0), { col: '#c9c2b6', at: [-0.3, 0.1, -0.25], type: 'sphere', flat: true }),
]);
