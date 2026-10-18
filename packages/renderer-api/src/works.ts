import { getTile, NEIGHBOURS, type WorldMap } from "@civ/core";
import { knownSquare, type Explored } from "./coast.js";
import { hash } from "./hash.js";

/**
 * Roads, railroads and irrigated fields across square borders, for drawing only.
 *
 * A road runs from a square's centre to the centre of every neighbour with a
 * road (the original joins all eight), and each square draws the whole stroke
 * clipped to itself, so the two halves meet seamlessly at the border. A
 * diagonal stroke passes through the corner it shares with two other squares;
 * they draw their slivers of it too, or the road would pinch at the corner.
 * Only squares the viewer has explored count, so nothing under the fog shows.
 */

/** A straight stroke from (ax, ay) to (bx, by), in squares from the square's top-left corner (its centre is 0.5, 0.5). */
export type Stroke = readonly [number, number, number, number];

/** Neighbours of (x, y) with a road (or a railroad) the viewer knows of, bits in NEIGHBOURS order. */
export function roadMask(map: WorldMap, explored: Explored | undefined, x: number, y: number, rail = false): number {
  let mask = 0;
  NEIGHBOURS.forEach(([dx, dy], i) => {
    const n = getTile(map, x + dx, y + dy);
    if (n && (rail ? n.railroad : n.road) && knownSquare(map, explored, x + dx, y + dy)) mask |= 1 << i;
  });
  return mask;
}

/** The four corners, each with the two neighbours beside it (indices into NEIGHBOURS: north, west, east, south). */
const CORNERS: readonly (readonly [number, number])[] = [[1, 3], [1, 4], [6, 3], [6, 4]];

const strokeCache = new Map<number, Stroke[]>();

/**
 * The strokes of road across a square: to each linked neighbour's centre when
 * the square has the road itself (`self`), and across each corner whose two
 * neighbours beside it both have one (they are linked diagonally). Empty when
 * nothing crosses the square; a road square with no links has no strokes
 * either, and is drawn as a stub.
 */
export function roadStrokes(self: boolean, mask: number): Stroke[] {
  const key = (self ? 256 : 0) | mask;
  const hit = strokeCache.get(key);
  if (hit) return hit;
  const out: Stroke[] = [];
  if (self)
    NEIGHBOURS.forEach(([dx, dy], i) => {
      if (mask & (1 << i)) out.push([0.5, 0.5, 0.5 + dx, 0.5 + dy]);
    });
  for (const [a, b] of CORNERS) {
    if (!(mask & (1 << a)) || !(mask & (1 << b))) continue;
    const [ax, ay] = NEIGHBOURS[a]!;
    const [bx, by] = NEIGHBOURS[b]!;
    out.push([0.5 + ax, 0.5 + ay, 0.5 + bx, 0.5 + by]);
  }
  strokeCache.set(key, out);
  return out;
}

/** Distance from (u, v) to a stroke, in squares. */
export function strokeGap(s: Stroke, u: number, v: number): number {
  const [ax, ay, bx, by] = s;
  const ex = bx - ax;
  const ey = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * ex + (v - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(u - ax - ex * t, v - ay - ey * t);
}

/** Field sides: bits for the north, east, south and west neighbours. */
export const FIELD_N = 1;
export const FIELD_E = 2;
export const FIELD_S = 4;
export const FIELD_W = 8;

/** Which sides of square (x, y) border known irrigated land, where its fields run on to the edge (FIELD_* bits). */
export function fieldSides(map: WorldMap, explored: Explored | undefined, x: number, y: number): number {
  let sides = 0;
  const side = (dx: number, dy: number, bit: number) => {
    const n = getTile(map, x + dx, y + dy);
    if (n?.irrigation && knownSquare(map, explored, x + dx, y + dy)) sides |= bit;
  };
  side(0, -1, FIELD_N);
  side(1, 0, FIELD_E);
  side(0, 1, FIELD_S);
  side(-1, 0, FIELD_W);
  return sides;
}

/** A crop: which kind is planted on a plot (renderers give each its colours), and which way its rows run. */
export interface Plot {
  /** Index into the renderer's crops (0 ripe grain, 1 green shoots, 2 ploughed earth, 3 pale grain). */
  crop: number;
  /** Rows run east-west when true, north-south when false. */
  across: boolean;
}

/** An irrigated square's fields: a canal east-west through its middle, two plots either side of it. */
export interface Fields {
  /** North-west, north-east, south-west, south-east. */
  plots: Plot[];
  /** Where the north plots meet, then the south plots, as a share of the square's width. */
  splits: [number, number];
}

/** How likely each crop is: grain and green fields most of all, then bare ploughland. */
const CROP_WEIGHTS = [0.38, 0.32, 0.18, 0.12];

/**
 * The fields of an irrigated square. The canal through its middle meets the
 * canals of irrigated neighbours east and west, so farmland reads as rows of
 * fields along long ditches; the plots, their crops and the line between them
 * vary from square to square by position, so it reads as a patchwork.
 */
export function fieldLayout(x: number, y: number): Fields {
  const plots = [0, 1, 2, 3].map((k) => {
    let r = hash(x, y, 300 + k);
    let crop = 0;
    while (crop < CROP_WEIGHTS.length - 1 && r >= CROP_WEIGHTS[crop]!) r -= CROP_WEIGHTS[crop++]!;
    return { crop, across: hash(x, y, 310 + k) < 0.5 };
  });
  return { plots, splits: [0.3 + hash(x, y, 320) * 0.4, 0.3 + hash(x, y, 321) * 0.4] };
}
