import { nextFloat, nextInt, type RngState } from "../rng.js";
import { MAP_HEIGHT, MAP_WIDTH, Terrain, type Tile, type WorldMap } from "../types.js";

export interface MapGenOptions {
  /** 0..2 — original "land mass" setting (small / normal / large). */
  landMass?: 0 | 1 | 2;
  /** 0..2 — original "temperature" (cool / temperate / warm). */
  temperature?: 0 | 1 | 2;
  /** 0..2 — original "climate" (arid / normal / wet). */
  climate?: 0 | 1 | 2;
}

/**
 * Value-noise field with east-west wrap. Cheap and deterministic; good
 * enough to produce continents. Replace with a faithful port of the
 * original's random-walk landmass algorithm in a later phase.
 */
function noiseField(rng: RngState, w: number, h: number, cell: number): Float32Array {
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell) + 1;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = nextFloat(rng);
  const out = new Float32Array(w * h);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy);
    const ty = smooth(gy - y0);
    for (let x = 0; x < w; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx);
      const tx = smooth(gx - x0);
      const x1 = (x0 + 1) % gw;
      const y1 = Math.min(y0 + 1, gh - 1);
      const a = grid[y0 * gw + x0]!;
      const b = grid[y0 * gw + x1]!;
      const c = grid[y1 * gw + x0]!;
      const d = grid[y1 * gw + x1]!;
      out[y * w + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

export function generateMap(rng: RngState, opts: MapGenOptions = {}): WorldMap {
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const landMass = opts.landMass ?? 1;
  const temperature = opts.temperature ?? 1;
  const climate = opts.climate ?? 1;

  const elev = noiseField(rng, w, h, 10);
  const elev2 = noiseField(rng, w, h, 4);
  const moist = noiseField(rng, w, h, 8);
  const detail = noiseField(rng, w, h, 2);

  const seaLevel = [0.56, 0.5, 0.44][landMass]!;
  const tiles: Tile[] = new Array(w * h);

  for (let y = 0; y < h; y++) {
    // Polar rows are always ice; latitude 0 at the equator, 1 at the poles.
    const lat = Math.abs(y - (h - 1) / 2) / ((h - 1) / 2);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let e = elev[i]! * 0.7 + elev2[i]! * 0.3;
      // Push coasts away from the top/bottom edge so poles read as ice caps.
      e -= Math.max(0, lat - 0.85) * 2;
      const m = moist[i]! * 0.8 + detail[i]! * 0.2 + (climate - 1) * 0.12;
      const temp = (1 - lat) + (temperature - 1) * 0.15;

      let terrain: Terrain;
      if (y === 0 || y === h - 1) terrain = Terrain.Arctic;
      else if (e < seaLevel) terrain = Terrain.Ocean;
      else {
        const rel = (e - seaLevel) / (1 - seaLevel); // 0 coast .. 1 peak
        if (temp < 0.12) terrain = Terrain.Arctic;
        else if (temp < 0.25) terrain = Terrain.Tundra;
        else if (rel > 0.62 + detail[i]! * 0.1) terrain = Terrain.Mountains;
        else if (rel > 0.42 + detail[i]! * 0.1) terrain = Terrain.Hills;
        else if (temp > 0.8 && m < 0.32) terrain = Terrain.Desert;
        else if (temp > 0.78 && m > 0.72) terrain = Terrain.Jungle;
        else if (m > 0.74 && rel < 0.15) terrain = Terrain.Swamp;
        else if (m > 0.6) terrain = Terrain.Forest;
        else if (m < 0.42) terrain = Terrain.Plains;
        else terrain = Terrain.Grassland;
      }
      tiles[i] = { terrain, river: false, special: false };
    }
  }

  // Rivers: a few random walks downhill-ish from hills toward the sea.
  const riverCount = 12 + landMass * 4;
  for (let r = 0; r < riverCount; r++) {
    let x = nextInt(rng, w);
    let y = 2 + nextInt(rng, h - 4);
    const t = tiles[y * w + x]!;
    if (t.terrain !== Terrain.Hills && t.terrain !== Terrain.Grassland) continue;
    for (let step = 0; step < 12; step++) {
      const cur = tiles[y * w + x]!;
      if (cur.terrain === Terrain.Ocean || cur.terrain === Terrain.Arctic) break;
      if (cur.terrain === Terrain.Mountains) break;
      cur.river = true;
      const dir = nextInt(rng, 4);
      if (dir === 0) x = (x + 1) % w;
      else if (dir === 1) x = (x + w - 1) % w;
      else if (dir === 2) y = Math.min(h - 1, y + 1);
      else y = Math.max(0, y - 1);
    }
  }

  // Specials: roughly one in 16 land tiles, matching the original's density feel.
  for (const t of tiles) {
    if (t.terrain !== Terrain.Ocean && nextInt(rng, 16) === 0) t.special = true;
    else if (t.terrain === Terrain.Ocean && nextInt(rng, 24) === 0) t.special = true; // fish
  }

  return { width: w, height: h, tiles };
}
