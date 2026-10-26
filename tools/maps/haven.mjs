// Draws the fixed map "晴岚湾" (src/sim/maps/haven.ts): a 128x128 coast framed by the 云岭 range in
// the north, with a river, a mountain lake, sea cliffs, a lighthouse cape and a mesa. The output is two
// plain character grids (tiles and heights) plus a short landmark list, so the map can be hand-edited
// afterwards and read by any engine (legend in src/sim/maps/index.ts).
// Usage: node tools/maps/haven.mjs [preview.png]   (the preview needs python3 + Pillow)
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const W = 128, SEED = 3107;
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
/** sharp ridges for mountain crests */
const ridged = (x, y, s) => { const a = 1 - Math.abs(vnoise(x, y, s) * 2 - 1), b = 1 - Math.abs(vnoise(x * 2.3, y * 2.3, s + 5) * 2 - 1); return a * a * 0.7 + b * b * 0.3; };
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDist = (px, pz, [ax, az], [bx, bz]) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};
/** distance to a polyline and how far along it the nearest point is (0..1) */
const lineInfo = (px, pz, pts) => {
  let d = 1e9, at = 0, len = 0;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  for (let i = 1; i < pts.length; i++) {
    const s = segDist(px, pz, pts[i - 1], pts[i]);
    if (s < d) { d = s; const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz))); at = (lens[i - 1] + t * (lens[i] - lens[i - 1])) / len; }
  }
  return { d, at };
};

// ---------------- the shapes ----------------
/** the island is a rounded square (a superellipse) with two shallow bays: 渔人湾 in the west and 白沙湾 in the east; the south-east corner is 灯塔岬 */
const C = 64, R = 54;
const coastR = (x, z) => R + (fbm(Math.atan2(z - C, x - C) * 3 + 10, 3.3, SEED) - 0.5) * 4
  - 8 * bump(z, 88, 5.5) * sstep(36, 18, x)      // 渔人湾
  - 6 * bump(z, 62, 5) * sstep(92, 110, x)       // 白沙湾
  + 2.5 * bump(x, 104, 5) * sstep(96, 110, z);   // 灯塔岬 pokes out a little
const isSea = (x, z) => ((Math.abs(x - C) / coastR(x, z)) ** 6 + (Math.abs(z - C) / coastR(x, z)) ** 6) > 1;
/** 云岭: the northern range; a pass at x≈70 opens into 北谷 (the coal valley) */
const ridgeZ = x => 24 + (fbm(x * 0.07, 1.7, SEED + 9) - 0.5) * 8 + 6 * bump(x, 106, 11) + 5 * bump(x, 18, 9) - 3 * bump(x, 52, 8);
const VALLEY = { x: 71, z: 18, rx: 9, rz: 4 };
const inValley = (x, z) => ((x - VALLEY.x) / VALLEY.rx) ** 2 + ((z - VALLEY.z) / VALLEY.rz) ** 2 < 1 + (fbm(x * 0.3, z * 0.3, SEED + 4) - 0.5) * 0.5;
const PASS = [[71, 19], [70, 24], [72, 31]];
/** 玉带河 falls out of the range into 镜湖, then winds south past the riverside wood into the harbour bay */
const RIVER = [[34, 12], [36, 18], [38, 22], [40, 24], [41, 33], [45, 40], [44, 46], [39, 51], [37, 57], [40, 63], [45, 67], [46, 73], [43, 79], [46, 85], [49, 92], [50, 100], [52, 110], [53, 122]];
const LAKE = { x: 41, z: 32, rx: 7.5, rz: 5 };
/** 鹿溪: a brook from the eastern range down to 东湾; the second river you will have to bridge */
const BROOK = [[100, 27], [97, 35], [101, 45], [98, 56], [104, 68], [103, 80], [104, 90]];
/** 望台丘: a flat-topped mesa on the east meadow, with an old watchtower on top */
const MESA = { x: 86, z: 52, r: 4.2 };
/** small crags in the western woods (one carries standing stones) */
const CRAGS = [[22, 48, 2.4], [14, 72, 2.0], [28, 82, 1.6], [60, 47, 1.4], [98, 62, 1.5], [70, 34, 1.2]];
/** 荷塘: a lily pond on the meadow */
const POND = { x: 73, z: 58, r: 2.6 };
/** offshore: 鸥岛 (gull isle) and a few sea stacks */
const STACKS = [[112, 122, 1.4], [104, 124, 1.0], [4, 58, 1.3], [124, 44, 1.2], [30, 124, 1.0]];
/** where sea cliffs replace beaches */
const isCliff = (x, z) => (z > 100 && x > 28 && x < 42) || (z > 98 && x > 96) || (x > 104 && z > 28 && z < 50) || (x > 104 && z > 76 && z < 90) || (x < 24 && z > 30 && z < 52);

/** ore veins: 2x2 patches (top-left corners). Iron for era 2, coal for era 3. */
const VEINS = [
  { kind: 'i', name: '河西铁矿', at: [[36, 90], [39, 93], [35, 94]] },   // just across the river: the first bridge
  { kind: 'i', name: '西林铁矿', at: [[18, 56], [22, 58]] },             // deep in the western woods
  { kind: 'i', name: '鹿溪铁矿', at: [[107, 36], [109, 40]] },            // across the brook, later
  { kind: 'c', name: '望台煤矿', at: [[83, 58], [87, 59]] },             // at the foot of the mesa, the first coal
  { kind: 'c', name: '北谷煤矿', at: [[66, 17], [70, 18], [74, 18]] },    // up the pass into the valley
  { kind: 'c', name: '西坡煤矿', at: [[18, 30], [21, 32]] },              // the far north-west
];

// ---------------- rasterise tiles ----------------
const T = Array.from({ length: W }, () => Array(W).fill('.'));
const K = Array.from({ length: W }, () => Array(W).fill(''));   // what made a rock tile: m(ountain) c(liff) s(mesa) k(crag) i(sle)
const get = (x, z) => (x >= 0 && z >= 0 && x < W && z < W) ? T[z][x] : '~';
const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < W && z < W) T[z][x] = c; };
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  const n = fbm(x * 0.2, z * 0.2, SEED + 3);
  let c = '.', k = '';
  // mountains: the northern range and the western wall
  if (z < ridgeZ(x) && !inValley(x, z) && lineInfo(x, z, PASS).d > 2.2) { c = '^'; k = 'm'; }
  if (Math.hypot(x - MESA.x, z - MESA.z) < MESA.r + (n - 0.5) * 1.6) { c = '^'; k = 's'; }
  for (const [cx, cz, r] of CRAGS) if (Math.hypot(x - cx, z - cz) < r + (n - 0.5) * 1.5) { c = '^'; k = 'k'; }
  // inland water
  const rv = lineInfo(x, z, RIVER);
  const rw = 0.9 + rv.at * 1.5 + (n - 0.5) * 0.5;
  if (rv.d < rw) { c = '='; k = ''; }
  const bk = lineInfo(x, z, BROOK);
  if (bk.d < 0.7 + bk.at * 0.8 + (n - 0.5) * 0.3) { c = '='; k = ''; }
  if (Math.hypot(x - POND.x, (z - POND.z) * 1.3) < POND.r + (n - 0.5) * 1.2) { c = '='; k = ''; }
  if (((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2 < 1 + (n - 0.5) * 0.6) { c = '='; k = ''; }
  // the sea
  if (isSea(x, z)) {
    c = '~'; k = '';
    for (const [sx, sz, r] of STACKS) if (Math.hypot(x - sx, z - sz) < r) { c = '^'; k = 'i'; }
  }
  T[z][x] = c; K[z][x] = k;
}
// where the river and the brook meet the sea, it is sea
for (let pass = 0; pass < 3; pass++) for (let z = 0; z < W; z++) for (let x = 0; x < W; x++)
  if (T[z][x] === '=' && (get(x, z + 1) === '~' || get(x + 1, z) === '~' || get(x - 1, z) === '~')) T[z][x] = '~';
// shore: sea cliffs on the headlands and the north-east shore, beaches elsewhere
const nearSea = (x, z, r) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dz) <= r + 0.2 && get(x + dx, z + dz) === '~' && z + dz < W) return true; return false; };
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  if (T[z][x] !== '.') continue;
  if (isCliff(x, z) && nearSea(x, z, 3)) { T[z][x] = '^'; K[z][x] = 'c'; }
  else if (nearSea(x, z, 1)) T[z][x] = ':';
}
// a second row of sand on the wide beaches
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++)
  if (T[z][x] === '.' && nearSea(x, z, 2) && fbm(x * 0.15, z * 0.15, SEED + 30) > 0.5) T[z][x] = 'b';
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (T[z][x] === 'b') T[z][x] = ':';

// the harbour: a 3x3 on the bay shore whose middle bottom faces open water, as close to the bay's middle as possible
let depot = null;
for (let dx = 0; dx < 10 && !depot; dx++) for (const sx of [65 + dx, 65 - dx]) {
  for (let z = W - 4; z > 60; z--) {
    let land = true;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if ('.:'.indexOf(get(sx + i, z + j)) < 0) land = false;
    if (land && get(sx + 1, z + 3) === '~') { depot = [sx, z]; break; }
  }
  if (depot) break;
}
if (!depot) throw new Error('no harbour spot');

// ---------------- heights (rock only) ----------------
// distance from each rock tile to the nearest buildable or water tile, per kind of rock
const N = W * W, dist = new Float32Array(N).fill(1e9);
{
  const q = [];
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) if (T[z][x] !== '^') { dist[z * W + x] = 0; q.push(z * W + x); }
  // two-pass chamfer (good enough and deterministic)
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    let v = dist[z * W + x];
    if (x > 0) v = Math.min(v, dist[z * W + x - 1] + 1);
    if (z > 0) { v = Math.min(v, dist[(z - 1) * W + x] + 1); if (x > 0) v = Math.min(v, dist[(z - 1) * W + x - 1] + 1.414); if (x < W - 1) v = Math.min(v, dist[(z - 1) * W + x + 1] + 1.414); }
    dist[z * W + x] = v;
  }
  for (let z = W - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
    let v = dist[z * W + x];
    if (x < W - 1) v = Math.min(v, dist[z * W + x + 1] + 1);
    if (z < W - 1) { v = Math.min(v, dist[(z + 1) * W + x] + 1); if (x < W - 1) v = Math.min(v, dist[(z + 1) * W + x + 1] + 1.414); if (x > 0) v = Math.min(v, dist[(z + 1) * W + x - 1] + 1.414); }
    dist[z * W + x] = v;
  }
  void q;
}
const H = new Float32Array(N);   // in world units
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  if (T[z][x] !== '^') continue;
  const d = dist[z * W + x], k = K[z][x], i = z * W + x;
  if (k === 'm') {
    // foothills rise quickly, then sharp crests and peaks; higher in the north-east massif
    const crest = ridged(x * 0.09, z * 0.09, SEED + 40);
    const peakAmp = 0.85 + 0.3 * bump(x, 106, 14) + 0.15 * bump(x, 18, 10) + 0.2 * vnoise(x * 0.12, z * 0.12, SEED + 41);
    let h = (1 - Math.exp(-d / 5)) * 3.4 * peakAmp + crest * Math.min(1, d / 4) * 3.2 * peakAmp;
    if (d < 1.5) h = Math.min(h, 0.9 + d * 0.5);   // a low rim so the slopes start at the foot
    H[i] = Math.min(8.75, h);
  } else if (k === 'c') H[i] = 1.6 + fbm(x * 0.2, z * 0.2, SEED + 50) * 0.9;  // cliff tops, flat and grassy
  else if (k === 's') H[i] = d < 1.2 ? 1.4 : 1.9;                               // the mesa: flat top, steep sides
  else if (k === 'k') H[i] = 0.5 + Math.min(1.2, d * 0.45);
  else if (k === 'i') H[i] = 0.9 + Math.min(1.4, d * 0.7);
}
// cliff tiles touching a mountain blend into it
// the lake shore under the range: a sheer drop for the waterfall
const FALLS = { x: 44, z: 23 };

// ---------------- trees ----------------
const rnd = (x, z, s) => hash(x, z, SEED + s);
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  const c = T[z][x];
  if (Math.hypot(x - depot[0] - 1, z - depot[1] - 1) < 8) continue;
  const f = fbm(x * 0.11 + 40, z * 0.11, SEED + 5), r = rnd(x, z, 1);
  if (c === '^') {
    // pines climb the lower mountain slopes; a few on cliff tops and the isle
    const h = H[z * W + x], k = K[z][x];
    let p = 0;
    if (k === 'm') p = h < 2.6 ? 0.55 : h < 3.6 ? 0.22 : 0;
    if (k === 'c' || k === 'i') p = f > 0.5 ? 0.35 : 0.05;
    if (k === 'k') p = 0.3;
    if (r < p) T[z][x] = 'P';
    continue;
  }
  if (c !== '.') continue;
  let nearRock = false;
  for (let dz = -2; dz <= 2 && !nearRock; dz++) for (let dx = -2; dx <= 2; dx++) if (get(x + dx, z + dz) === '^' && z + dz >= 0 && K[z + dz]?.[x + dx] === 'm') { nearRock = true; break; }
  let p = 0.015;
  if (x < 38 && z > 30 && z < 98) p = f > 0.44 ? 0.88 : 0.3;                              // 西林 the deep western woods
  if (lineInfo(x, z, [[46, 62], [50, 80], [56, 98]]).d < 4.5 && x > 44) p = f > 0.38 ? 0.82 : 0.4; // 河畔林 east bank of the river
  if (Math.hypot(x - 82, z - 100) < 4.5) p = 0.75;                                         // 小橡林 a grove east of the harbour
  if (x >= 56 && x < 96 && z >= 28 && z < 72) p = f > 0.64 ? 0.55 : 0.012;               // 东原 open meadow
  if (Math.hypot(x - 52, z - 36) < 7) p = 0.65;                                           // 湖东林 the lake wood
  if (lineInfo(x, z, BROOK).d < 3.5) p = Math.max(p, f > 0.45 ? 0.5 : 0.1);               // trees along the brook
  if (x > 100 && z > 26 && z < 84) p = Math.max(p, f > 0.5 ? 0.6 : 0.15);               // 东岸林 the east shore
  if (inValley(x, z)) p = 0.08;
  if (nearRock) p = Math.max(p, 0.6);
  if (r < p) T[z][x] = (nearRock || z < 40 || rnd(x, z, 2) < (x < 38 ? 0.45 : 0.3)) ? 'p' : 't';
}
// keep the start meadow open: farmland and room for the first village
for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
  if ((T[z][x] === 't' || T[z][x] === 'p') && x > 56 && x < 78 && z > 92 && z < 120 && Math.hypot(x - 82, z - 100) > 4.5) T[z][x] = '.';
}
// ore veins: clear the ground under each patch
for (const v of VEINS) for (const [x, z] of v.at) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
  const c = get(x + i, z + j);
  if (c === '=' || c === '~' || c === '^' || c === 'P' || c === ':') throw new Error(`${v.name} patch ${x},${z} is on ${c}`);
  set(x + i, z + j, v.kind);
}
for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) set(depot[0] + i, depot[1] + j, 'H');

// ---------------- landmarks (decoration only, all on rock or water) ----------------
const topOf = (cx, cz, r, kind) => {  // the highest rock tile of a kind near a point
  let best = null, bh = -1;
  for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!'^P'.includes(get(x, z)) || K[z][x] !== kind) continue;
    const h = H[z * W + x] - Math.hypot(x - cx, z - cz) * 0.05;
    if (h > bh) { bh = h; best = [x, z]; }
  }
  return best;
};
const capeTip = (() => { let b = null; for (let z = W - 1; z > 80 && !b; z--) for (let x = 96; x < 118; x++) if (K[z][x] === 'c') { b = [x, z]; break; } return b; })();
const mesaTop = [MESA.x, MESA.z];
const LANDMARKS = [
  { kind: 'lighthouse', name: '灯塔岬灯塔', at: [capeTip[0], capeTip[1] - 1] },
  { kind: 'tower', name: '望台丘古塔', at: mesaTop },
  { kind: 'stones', name: '西林石阵', at: [CRAGS[0][0], CRAGS[0][1]] },
  { kind: 'falls', name: '镜湖瀑布', at: [FALLS.x, FALLS.z] },
  { kind: 'wreck', name: '渔人湾沉船', at: [13, 88] },
];
for (const l of LANDMARKS) {
  const [x, z] = l.at, c = get(x, z);
  if (l.kind === 'wreck' ? c !== '~' : l.kind === 'falls' ? false : !'^P'.includes(c)) throw new Error(`${l.name} at ${x},${z} is on ${c}`);
  if (T[z][x] === 'P') T[z][x] = '^';
}
// the falls drop from a ledge of the range into the lake's north shore: make sure that ledge is high rock
{
  const { x, z } = FALLS;
  for (let j = -2; j <= 0; j++) for (let i = -1; i <= 1; i++) {
    const k = (z + j) * W + x + i;
    if (T[z + j][x + i] === '=' || T[z + j][x + i] === '~') continue;
    T[z + j][x + i] = '^'; K[z + j][x + i] = 'm'; H[k] = Math.max(H[k], 2.2 - j * 0.6);
  }
}

// ---------------- output ----------------
const rows = T.map(r => r.join(''));
const q36 = h => Math.max(0, Math.min(35, Math.round(h * 4))).toString(36);
const hrows = Array.from({ length: W }, (_, z) => Array.from({ length: W }, (_, x) => '^P'.includes(T[z][x]) ? q36(H[z * W + x]) : '0').join(''));
const out = `// 晴岚湾 — the fixed map. Generated by tools/maps/haven.mjs, then free to hand-edit.
// Legend in ./index.ts. ${W}x${W}, row 0 is the north edge; the sea is to the south and east.
export const HAVEN_ROWS = [
${rows.map(r => `  '${r}',`).join('\n')}
];
// Height of rock tiles in quarter units, one base-36 digit per tile (0..z = 0..8.75). Ground you can build on is 0.
export const HAVEN_HEIGHT = [
${hrows.map(r => `  '${r}',`).join('\n')}
];
export const HAVEN_LANDMARKS: { kind: string; name: string; x: number; z: number }[] = [
${LANDMARKS.map(l => `  { kind: '${l.kind}', name: '${l.name}', x: ${l.at[0]}, z: ${l.at[1]} },`).join('\n')}
];
`;
writeFileSync(new URL('../../src/sim/maps/haven.ts', import.meta.url), out);
const counts = {}; for (const r of rows) for (const ch of r) counts[ch] = (counts[ch] ?? 0) + 1;
console.log('depot', depot, counts);

if (process.argv[2]) {
  // a shaded overview: tile colours, hill shading from the heights, tree dots and labels
  const LABELS = [
    ['云岭', 30, 14], ['北谷', VALLEY.x, VALLEY.z], ['镜湖', LAKE.x, LAKE.z], ['玉带河', 37, 64], ['西林', 22, 76],
    ['东原', 76, 44], ['望台丘', MESA.x, MESA.z - 6], ['鹿溪', 95, 72], ['暖港', 66, 112], ['渔人湾', 10, 96],
    ['灯塔岬', 108, 112], ['白沙湾', 116, 70],
  ];
  const py = `
import sys, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
d=json.loads(sys.stdin.read()); rows=d['rows']; H=d['h']; W=len(rows); s=8
col={'.':(146,198,104),':':(238,220,168),'~':(52,124,196),'=':(86,170,222),'^':(150,144,134),'P':(150,144,134),'t':(146,198,104),'p':(146,198,104),'i':(196,96,70),'c':(52,50,56),'H':(226,74,60)}
im=Image.new('RGB',(W*s,W*s)); px=im.load()
def h(x,z):
  x=max(0,min(W-1,int(x))); z=max(0,min(W-1,int(z))); return H[z*W+x]
for Z in range(W*s):
  for X in range(W*s):
    x,z=X/s,Z/s; ch=rows[int(z)][int(x)]
    c=col[ch]
    if ch=='~':
      dd=0
      for r in range(1,6):
        if any(rows[min(W-1,max(0,int(z)+dz))][min(W-1,max(0,int(x)+dx))] not in '~' for dx in (-r,0,r) for dz in (-r,0,r)): break
        dd=r
      c=tuple(int(a+(b-a)*dd/5) for a,b in zip((96,186,226),(36,96,170)))
    hh=h(x,z)
    if ch in '^P':
      dx=h(x+1,z)-h(x-1,z); dz=h(x,z+1)-h(x,z-1)
      shade=max(0.55,min(1.35,1+(-dx-dz)*0.22))
      base=(150,144,134) if hh>0.9 else (128,170,96)
      if hh>5.6: base=(238,240,244)
      elif hh>1.2 and hh<2.4 and abs(dx)+abs(dz)<0.6: base=(120,160,92)
      c=tuple(min(255,int(v*shade*(0.85+hh*0.03))) for v in base)
    px[X,Z]=c
dr=ImageDraw.Draw(im)
for z,r in enumerate(rows):
  for x,ch in enumerate(r):
    if ch in 'tpP':
      cx,cz=x*s+4,z*s+4
      fill=(54,120,58) if ch=='t' else (34,88,64)
      dr.ellipse((cx-3,cz-3,cx+3,cz+3),fill=fill)
font=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',22)
for name,x,z in d['labels']:
  w=dr.textlength(name,font=font)
  dr.text((x*s-w/2,z*s-11),name,font=font,fill=(255,255,255),stroke_width=3,stroke_fill=(40,50,60))
for l in d['marks']:
  x,z=l['at']; dr.ellipse((x*s-6,z*s-6,x*s+14,z*s+14),outline=(255,230,120),width=3)
im.save(sys.argv[1])`;
  const h = Array.from(H, (v, i) => '^P'.includes(rows[(i / W) | 0][i % W]) ? v : 0);
  execFileSync('python3', ['-c', py, process.argv[2]], { input: JSON.stringify({ rows, h, labels: LABELS, marks: LANDMARKS }), maxBuffer: 1 << 26 });
}
