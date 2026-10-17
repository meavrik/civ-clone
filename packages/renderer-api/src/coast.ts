import { getTile, NEIGHBOURS, Terrain, type WorldMap } from "@civ/core";
import { valueNoise } from "./hash.js";

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
 *
 * Squares the player has not explored (`explored`, when given) are left out
 * of the blend, so nothing under the fog shows at the edge of known land:
 * the field interpolates between the known squares only, and a square's
 * depth counts only the land it knows of.
 */

export const LAND = 0;
export const COASTAL = 1;
export const DEEP = 2;
/** Depth of a square the player has not explored, in a patch. */
export const UNKNOWN = -1;

/** The shore: field values below this are land. */
export const SHORE = 0.5;
/** The edge of deep water. */
export const DEEP_EDGE = 1.5;

/** A player's explored flags, one per square (`player.explored`). */
export type Explored = ArrayLike<number>;

const clampY = (map: WorldMap, y: number) => Math.max(0, Math.min(map.height - 1, y));

/** Whether the player knows square (x, y); squares off the top or bottom count as their nearest row. */
export function knownSquare(map: WorldMap, explored: Explored | undefined, x: number, y: number): boolean {
  return !explored || explored[clampY(map, y) * map.width + (((x % map.width) + map.width) % map.width)] !== 0;
}

/** Depth class of a square: land, water touching (known) land, or open sea. Squares off the top or bottom count as their nearest row. */
export function waterDepth(map: WorldMap, x: number, y: number, explored?: Explored): number {
  const t = getTile(map, x, clampY(map, y));
  if (!t || t.terrain !== Terrain.Ocean) return LAND;
  for (const [dx, dy] of NEIGHBOURS) {
    const n = getTile(map, x + dx, y + dy);
    if (n && n.terrain !== Terrain.Ocean && knownSquare(map, explored, x + dx, y + dy)) return COASTAL;
  }
  return DEEP;
}

/** Open sea: water with no (known) land among its eight neighbours. */
export function isDeepWater(map: WorldMap, x: number, y: number, explored?: Explored): boolean {
  return waterDepth(map, x, y, explored) === DEEP;
}

/** The 3x3 block around a square, row by row from the north-west; index 4 is the square itself. */
export interface CoastPatch {
  x: number;
  y: number;
  /** Map width, for wrapping the noise. */
  width: number;
  /** Depth of each square in the block, UNKNOWN where the player has not explored. */
  depth: number[];
  /** Terrain of each square in the block (Ocean where unknown). */
  terrain: Terrain[];
  /** Some known neighbour has another depth, so the square's borders are blended. */
  mixed: boolean;
  /** Identifies the block's contents, for caching drawn squares. */
  key: string;
}

export function coastPatch(map: WorldMap, x: number, y: number, explored?: Explored): CoastPatch {
  const depth: number[] = [];
  const terrain: Terrain[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const known = (dx === 0 && dy === 0) || knownSquare(map, explored, x + dx, y + dy);
      depth.push(known ? waterDepth(map, x + dx, y + dy, explored) : UNKNOWN);
      terrain.push(known ? getTile(map, x + dx, clampY(map, y + dy))?.terrain ?? Terrain.Ocean : Terrain.Ocean);
    }
  const own = depth[4]!;
  const mixed = depth.some((d) => d !== own && d !== UNKNOWN);
  return { x, y, width: map.width, depth, terrain, mixed, key: `${map.width}:${x},${y}:${depth.join(",")}:${terrain.join(",")}` };
}

/**
 * How far a shore strays from the square border at (wx, wy), in field units
 * (one unit is a square's width). Some stretches of coast are smooth, others
 * ragged, set by a slow noise.
 */
export function shoreNoise(wx: number, wy: number, width: number): number {
  const rough = 0.4 + 0.6 * (valueNoise(wx, wy, 0.3, width, 7) * 0.5 + 0.5);
  const bays = 0.11 * valueNoise(wx, wy, 0.8, width, 4);
  return bays + rough * (0.15 * valueNoise(wx, wy, 1.6, width, 1) + 0.08 * valueNoise(wx, wy, 3.2, width, 2) + 0.04 * valueNoise(wx, wy, 7, width, 3));
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
  let sum = 0;
  let weight = 0;
  for (const [c, wc] of [[cols[0], 1 - fx], [cols[1], fx]] as const)
    for (const [r, wr] of [[rows[0], 1 - fy], [rows[1], fy]] as const) {
      const d = p.depth[r * 3 + c]!;
      if (d === UNKNOWN) continue;
      sum += d * wc * wr;
      weight += wc * wr;
    }
  // The square itself always counts, with at least a quarter of the weight.
  return sum / weight + shoreNoise(p.x + u, p.y + v, p.width);
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
