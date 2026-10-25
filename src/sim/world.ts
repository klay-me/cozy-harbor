// Tile map: terrain types, trees, and procedural generation from a seed.

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

  constructor(W: number, readonly seed: number) {
    this.W = W;
    this.tiles = new Uint8Array(W * W);
    this.trees = new Uint8Array(W * W);
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
  }

  inside(x: number, z: number) { return x >= 0 && z >= 0 && x < this.W && z < this.W; }
  tile(x: number, z: number): Tile { return this.inside(x, z) ? this.tiles[z * this.W + x] : Tile.Water; }
  areaLand(x: number, z: number, w: number, h: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = this.tile(x + i, z + j);
      if (t === Tile.Water || t === Tile.Rock || !this.inside(x + i, z + j)) return false;
    }
    return true;
  }
}
