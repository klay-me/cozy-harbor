// Tile map: terrain types, trees, ore. Either read from a fixed map (sim/maps) or generated from a seed.
import { MAPS, MapId } from './maps';

export enum Tile { Grass = 0, Sand = 1, Water = 2, Rock = 3 }

export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number) {
  return vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 13) * 0.15;
}

export class World {
  readonly W: number;
  readonly tiles: Uint8Array;
  readonly trees: Uint8Array;   // 0 none, 1 round tree, 2 pine
  readonly depot: { x: number; z: number };
  /** 0 none, 1 iron ore, 2 coal */
  readonly deposits: Uint8Array;
  /** 1 for water connected to the sea, 0 for rivers and lakes */
  readonly ocean: Uint8Array;
  /** 2x2 mineral patches (top-left corner) */
  readonly patches: { x: number; z: number; kind: number }[] = [];

  /** a fixed map by id, or a random map of size W from a seed */
  constructor(W: number, readonly seed: number, readonly mapId?: MapId) {
    const rows = mapId ? MAPS[mapId].rows : null;
    if (rows) W = rows.length;
    this.W = W;
    this.tiles = new Uint8Array(W * W);
    this.trees = new Uint8Array(W * W);
    this.deposits = new Uint8Array(W * W);
    this.ocean = new Uint8Array(W * W);
    if (rows) { this.depot = this.readRows(rows); return; }
    const r = rng(seed);
    const coastBase = W * 0.7;
    const riverX0 = W * (0.55 + r() * 0.12);
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x;
      const coast = coastBase + (fbm(x * 0.06, 3.3, seed) - 0.5) * 14;
      const rx = riverX0 + Math.sin(z * 0.13 + seed) * 4 + (fbm(z * 0.08, 9.1, seed) - 0.5) * 6;
      const lakeD = Math.hypot(x - W * 0.2, z - W * 0.22) - 3.5 - fbm(x * 0.2, z * 0.2, seed + 3) * 3;
      let t: Tile = Tile.Grass;
      if (z > coast || Math.abs(x - rx) < 1.3 || lakeD < 0) t = Tile.Water;
      else {
        const m = fbm(x * 0.09, z * 0.09, seed + 21);
        const edge = Math.min(x, W - 1 - x, z) ;
        if (m > 0.66 && z < W * 0.5 && edge < 12) t = Tile.Rock;
        if (edge < 2 && m > 0.5) t = Tile.Rock;
      }
      this.tiles[i] = t;
    }
    // beaches next to water
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (this.tiles[i] !== Tile.Grass) continue;
      let near = false;
      for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < W && nz < W && this.tiles[nz * W + nx] === Tile.Water && nz > W * 0.55) { near = true; break; }
      }
      if (near) this.tiles[i] = Tile.Sand;
    }
    // depot on the coast, left of centre
    let dx = Math.floor(W * 0.36), dz = 0;
    for (let tries = 0; tries < 30; tries++) {
      let found = -1;
      for (let z = W - 4; z > 4; z--) {
        if (this.areaLand(dx, z, 3, 3) && this.tiles[(z + 3) * W + dx + 1] === Tile.Water) { found = z; break; }
      }
      if (found > 0) { dz = found; break; }
      dx++;
    }
    this.depot = { x: dx, z: dz };
    // forests
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (this.tiles[i] !== Tile.Grass) continue;
      const f = fbm(x * 0.11 + 40, z * 0.11, seed + 5);
      const nearDepot = Math.hypot(x - dx - 1, z - dz - 1) < 7;
      if (!nearDepot && (f > 0.56 || (f > 0.5 && r() < 0.4)) ) this.trees[i] = r() < 0.55 ? 1 : 2;
      else if (!nearDepot && r() < 0.025) this.trees[i] = 1;
    }
    this.markOcean();
    this.placeDeposits(r);
  }

  /** parse a fixed map (legend in sim/maps/index.ts); returns the harbour's top-left corner */
  private readRows(rows: string[]) {
    const W = this.W;
    let depot: { x: number; z: number } | null = null;
    rows.forEach((row, z) => {
      if (row.length !== W) throw new Error(`map row ${z} has ${row.length} tiles, expected ${W}`);
      for (let x = 0; x < W; x++) {
        const ch = row[x], i = z * W + x;
        this.tiles[i] = ch === '~' || ch === '=' ? Tile.Water : ch === '^' ? Tile.Rock : ch === ':' ? Tile.Sand : Tile.Grass;
        if (ch === '~') this.ocean[i] = 1;
        if (ch === 't') this.trees[i] = 1; else if (ch === 'p') this.trees[i] = 2;
        if (ch === 'i') this.deposits[i] = 1; else if (ch === 'c') this.deposits[i] = 2;
        if (ch === 'H' && !depot) depot = { x, z };
      }
    });
    // ore patches: 2x2 blocks, read left to right, top to bottom
    const used = new Uint8Array(W * W);
    for (let z = 0; z < W - 1; z++) for (let x = 0; x < W - 1; x++) {
      const kind = this.deposits[z * W + x];
      if (!kind || used[z * W + x]) continue;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) used[(z + j) * W + x + i] = 1;
      this.patches.push({ x, z, kind });
    }
    if (!depot) throw new Error('map has no harbour (H)');
    return depot;
  }

  /** flood fill from the southern sea edge so rivers and lakes count as inland water */
  private markOcean() {
    const W = this.W, N = W * W;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // distance (in tiles) from each water tile to the nearest land
    const dist = new Int32Array(N).fill(1 << 20);
    const q: number[] = [];
    for (let i = 0; i < N; i++) if (this.tiles[i] !== Tile.Water) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, z = (i / W) | 0;
      for (const [dx, dz] of nb) {
        const nx = x + dx, nz = z + dz;
        if (!this.inside(nx, nz)) continue;
        const k = nz * W + nx;
        if (dist[k] > dist[i] + 1) { dist[k] = dist[i] + 1; q.push(k); }
      }
    }
    // the sea: open water reachable from the southern edge without squeezing through a narrow channel
    const open: number[] = [];
    for (let x = 0; x < W; x++) { const i = (W - 1) * W + x; if (this.tiles[i] === Tile.Water) { this.ocean[i] = 1; open.push(i); } }
    for (let h = 0; h < open.length; h++) {
      const i = open[h], x = i % W, z = (i / W) | 0;
      for (const [dx, dz] of nb) {
        const nx = x + dx, nz = z + dz;
        if (!this.inside(nx, nz)) continue;
        const k = nz * W + nx;
        if (this.ocean[k] || dist[k] < 3) continue;
        this.ocean[k] = 1; open.push(k);
      }
    }
    // then the shallow band along the coast (not into rivers: only tiles touching the open sea twice over)
    for (let pass = 0; pass < 2; pass++) {
      const add: number[] = [];
      for (let i = 0; i < N; i++) {
        if (this.ocean[i] || this.tiles[i] !== Tile.Water) continue;
        const x = i % W, z = (i / W) | 0;
        let n = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.inside(x + dx, z + dz) && this.ocean[(z + dz) * W + x + dx]) n++;
        if (n >= 3) add.push(i);
      }
      for (const i of add) this.ocean[i] = 1;
    }
  }

  /** mineral veins: a few 2x2 patches each, exactly the size of a mine */
  private placeDeposits(r: () => number) {
    const W = this.W;
    const want: [number, number, number][] = [
      [1, W * 0.18, W * 0.42], [1, W * 0.8, W * 0.2],
      [2, W * 0.45, W * 0.1], [2, W * 0.12, W * 0.08],
    ];
    const free = (x: number, z: number) => {
      if (!this.areaLand(x, z, 2, 2) || Math.hypot(x - this.depot.x, z - this.depot.z) < 10) return false;
      for (let j = -1; j < 3; j++) for (let i = -1; i < 3; i++) if (this.inside(x + i, z + j) && this.deposits[(z + j) * W + x + i]) return false;
      return true;
    };
    for (const [kind, cx, cz] of want) {
      // the vein's first patch near the target, then up to two more close by
      let placed = 0, ax = cx, az = cz;
      for (let n = 0; n < 3; n++) {
        let best = -1, bestD = 1e9;
        for (let z = 1; z < W * 0.6; z++) for (let x = 1; x < W - 3; x++) {
          if (!free(x, z)) continue;
          const d = Math.hypot(x + 1 - ax, z + 1 - az) + r() * 1.5 + (n > 0 && Math.hypot(x + 1 - ax, z + 1 - az) < 3 ? 5 : 0);
          if (d < bestD) { bestD = d; best = z * W + x; }
        }
        if (best < 0 || (n > 0 && bestD > 8)) break;
        const bx = best % W, bz = (best / W) | 0;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const k = (bz + j) * W + bx + i;
          this.deposits[k] = kind; this.trees[k] = 0;
          if (this.tiles[k] === Tile.Sand) this.tiles[k] = Tile.Grass;
        }
        this.patches.push({ x: bx, z: bz, kind });
        placed++;
        if (n === 0) { ax = bx + 1; az = bz + 1; }
      }
      void placed;
    }
  }

  inside(x: number, z: number) { return x >= 0 && z >= 0 && x < this.W && z < this.W; }
  tile(x: number, z: number): Tile { return this.inside(x, z) ? this.tiles[z * this.W + x] : Tile.Water; }
  deposit(x: number, z: number) { return this.inside(x, z) ? this.deposits[z * this.W + x] : 0; }
  isOcean(x: number, z: number) { return this.inside(x, z) ? this.ocean[z * this.W + x] === 1 : true; }
  areaLand(x: number, z: number, w: number, h: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = this.tile(x + i, z + j);
      if (t === Tile.Water || t === Tile.Rock || !this.inside(x + i, z + j)) return false;
    }
    return true;
  }
}
