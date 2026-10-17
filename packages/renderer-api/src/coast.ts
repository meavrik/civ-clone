import { getTile, NEIGHBOURS, Terrain, type WorldMap } from "@civ/core";

/**
 * Shorelines that wander across square borders instead of following them.
 *
 * Every square gets a depth: 0 land, 1 coastal water (land among its eight
 * neighbours), 2 deep water (none). Interpolating those depths between square
 * centres and adding smooth noise gives one field over the whole map; the
 * shore is where it crosses 0.5 and the edge of deep water where it crosses
 * 1.5. A square's centre always keeps its own kind (the noise stays well
 * under 0.5), so the game still reads square by square; only the borders
 * move. The noise is keyed by world position and wraps east-west with the
 * map, so neighbouring squares agree along their shared edge.
 */

export const LAND = 0;
export const COASTAL = 1;
export const DEEP = 2;

/** The shore: field values below this are land. */
export const SHORE = 0.5;
/** The edge of deep water. */
export const DEEP_EDGE = 1.5;

/** Depth class of a square: land, water touching land, or open sea. Squares off the top or bottom count as their nearest row. */
export function waterDepth(map: WorldMap, x: number, y: number): number {
  const t = getTile(map, x, Math.max(0, Math.min(map.height - 1, y)));
  if (!t || t.terrain !== Terrain.Ocean) return LAND;
  for (const [dx, dy] of NEIGHBOURS) {
    const n = getTile(map, x + dx, y + dy);
    if (n && n.terrain !== Terrain.Ocean) return COASTAL;
  }
  return DEEP;
}

/** Open sea: water with no land among its eight neighbours. */
export function isDeepWater(map: WorldMap, x: number, y: number): boolean {
  return waterDepth(map, x, y) === DEEP;
}

/** The 3x3 block around a square, row by row from the north-west; index 4 is the square itself. */
export interface CoastPatch {
  x: number;
  y: number;
  /** Map width, for wrapping the noise. */
  width: number;
  depth: number[];
  /** Terrain of each square in the block. */
  terrain: Terrain[];
  /** Some neighbour has another depth, so the square's borders are blended. */
  mixed: boolean;
  /** Identifies the block's contents, for caching drawn squares. */
  key: string;
}

export function coastPatch(map: WorldMap, x: number, y: number): CoastPatch {
  const depth: number[] = [];
  const terrain: Terrain[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      depth.push(waterDepth(map, x + dx, y + dy));
      terrain.push(getTile(map, x + dx, Math.max(0, Math.min(map.height - 1, y + dy)))?.terrain ?? Terrain.Ocean);
    }
  const own = depth[4]!;
  const mixed = depth.some((d) => d !== own);
  return { x, y, width: map.width, depth, terrain, mixed, key: `${map.width}:${x},${y}:${depth.join("")}:${terrain.join(",")}` };
}

/** Tiny deterministic hash for lattice values (never the game RNG). */
function hash(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in -1..1 with `f` lattice points per square, wrapping every `width` squares. */
function noise(wx: number, wy: number, f: number, width: number, salt: number): number {
  const period = Math.round(width * f);
  const gx = wx * f;
  const gy = wy * f;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const tx = gx - ix;
  const ty = gy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const a = hash(x0, iy, salt);
  const b = hash(x1, iy, salt);
  const c = hash(x0, iy + 1, salt);
  const d = hash(x1, iy + 1, salt);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}

/**
 * How far a shore strays from the square border at (wx, wy), in field units
 * (one unit is a square's width). Some stretches of coast are smooth, others
 * ragged, set by a slow noise.
 */
export function shoreNoise(wx: number, wy: number, width: number): number {
  const rough = 0.4 + 0.6 * (noise(wx, wy, 0.3, width, 7) * 0.5 + 0.5);
  const bays = 0.11 * noise(wx, wy, 0.8, width, 4);
  return bays + rough * (0.15 * noise(wx, wy, 1.6, width, 1) + 0.08 * noise(wx, wy, 3.2, width, 2) + 0.04 * noise(wx, wy, 7, width, 3));
}

/** The four squares around point (u, v) of the patch's square and the point's place between their centres. */
function cell(u: number, v: number): { cols: [number, number]; rows: [number, number]; fx: number; fy: number } {
  const east = u >= 0.5;
  const south = v >= 0.5;
  return {
    cols: [1, east ? 2 : 0],
    rows: [1, south ? 2 : 0],
    fx: east ? u - 0.5 : 0.5 - u,
    fy: south ? v - 0.5 : 0.5 - v,
  };
}

/** The field at (u, v), each 0..1 across the patch's square from its north-west corner. */
export function coastLevel(p: CoastPatch, u: number, v: number): number {
  const { cols, rows, fx, fy } = cell(u, v);
  const at = (c: number, r: number) => p.depth[r * 3 + c]!;
  const top = at(cols[0], rows[0]) * (1 - fx) + at(cols[1], rows[0]) * fx;
  const bottom = at(cols[0], rows[1]) * (1 - fx) + at(cols[1], rows[1]) * fx;
  const base = top * (1 - fy) + bottom * fy;
  return base + shoreNoise(p.x + u, p.y + v, p.width);
}

/**
 * Which land square of the patch (index 0..8) the point (u, v) belongs to:
 * the patch's own square if it is land, else the land neighbour that weighs
 * most there. -1 when no land is near.
 */
export function landOwner(p: CoastPatch, u: number, v: number): number {
  if (p.depth[4] === LAND) return 4;
  const { cols, rows, fx, fy } = cell(u, v);
  let best = -1;
  let bestW = -1;
  for (const [c, wc] of [[cols[0], 1 - fx], [cols[1], fx]] as const)
    for (const [r, wr] of [[rows[0], 1 - fy], [rows[1], fy]] as const) {
      const i = r * 3 + c;
      if (p.depth[i] !== LAND || wc * wr <= bestW) continue;
      best = i;
      bestW = wc * wr;
    }
  if (best >= 0) return best;
  // Noise can carry land a little past the cell; fall back to the nearest land neighbour.
  let bestD = Infinity;
  for (let i = 0; i < 9; i++) {
    if (p.depth[i] !== LAND) continue;
    const d = Math.hypot(u - ((i % 3) - 0.5), v - (Math.floor(i / 3) - 0.5));
    if (d < bestD) { best = i; bestD = d; }
  }
  return best;
}
