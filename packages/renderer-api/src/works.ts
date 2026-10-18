import { getTile, NEIGHBOURS, type WorldMap } from "@civ/core";
import { knownSquare, type Explored } from "./coast.js";
import { hash } from "./hash.js";

/**
 * Roads, railroads and irrigated fields across square borders, for drawing only.
 *
 * Roads wander like country tracks. Each square has a meeting point near its
 * centre, and the road between two squares runs from one meeting point to the
 * other in a gentle bend or an S (the original joins all eight neighbours). The
 * course is keyed by the pair of squares and laid from the same end whichever
 * square draws it, so each draws the whole course clipped to itself and the two
 * halves meet at the border. A diagonal course passes the corner it shares with
 * two other squares; they draw their part of it too, or the road would pinch
 * there. Only squares the viewer has explored count, so nothing under the fog shows.
 */

/** A road's course: a polyline as x, y pairs, in squares from the drawing square's top-left corner (its centre is 0.5, 0.5). */
export type Course = number[];

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

/** How far a meeting point strays from the square's centre, and how far a course bows and snakes off the straight line, in squares. */
const STRAY = 0.09;
const BOW = 0.2;
const SNAKE = 0.1;
/** Points on a course between its two meeting points. */
const STEPS = 12;

/** Meeting point of the square `dx, dy` from (x, y), in the frame of (x, y). */
function meetingPoint(width: number, x: number, y: number, dx: number, dy: number): [number, number] {
  const wx = (((x + dx) % width) + width) % width;
  return [0.5 + dx + (hash(wx, y + dy, 400) * 2 - 1) * STRAY, 0.5 + dy + (hash(wx, y + dy, 401) * 2 - 1) * STRAY];
}

/**
 * The course between two squares, given as offsets from (x, y), laid from the
 * one first in the map's row order whichever square asks. It bows to one side
 * (sin²) and snakes (sin·sin 2t), both flat at the ends, so a road leaves each
 * meeting point straight toward the next.
 */
function course(width: number, x: number, y: number, a: readonly [number, number], b: readonly [number, number]): Course {
  const index = ([dx, dy]: readonly [number, number]) => (y + dy) * width + ((((x + dx) % width) + width) % width);
  const [first, second] = index(a) < index(b) ? [a, b] : [b, a];
  const [px, py] = meetingPoint(width, x, y, first[0], first[1]);
  const [qx, qy] = meetingPoint(width, x, y, second[0], second[1]);
  const bow = (hash(index(first), index(second), 410) * 2 - 1) * BOW;
  const snake = (hash(index(first), index(second), 411) * 2 - 1) * SNAKE;
  const ex = qx - px;
  const ey = qy - py;
  const len = Math.hypot(ex, ey);
  const nx = -ey / len;
  const ny = ex / len;
  const out: Course = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const s = Math.sin(Math.PI * t);
    const off = bow * s * s + snake * s * Math.sin(2 * Math.PI * t);
    out.push(px + ex * t + nx * off, py + ey * t + ny * off);
  }
  return out;
}

/** What of a road (or railroad) crosses a square: its courses, or the patch of a road square with no links. */
export interface RoadWays {
  /** Same key, same picture: the square, whether it has the road, and its linked neighbours. */
  key: string;
  courses: Course[];
  /** Where a road square with no links has its patch (its meeting point), else null. */
  patch: [number, number] | null;
}

/**
 * The road (or railroad) across square (x, y): the courses to each linked
 * neighbour when the square has it, and the course across each corner whose two
 * neighbours beside it both have one (they are linked diagonally). Null when
 * none crosses the square.
 */
export function roadWays(map: WorldMap, explored: Explored | undefined, x: number, y: number, rail = false): RoadWays | null {
  const t = getTile(map, x, y);
  const self = !!t && (rail ? t.railroad : t.road);
  const mask = roadMask(map, explored, x, y, rail);
  const courses: Course[] = [];
  if (self)
    NEIGHBOURS.forEach((n, i) => {
      if (mask & (1 << i)) courses.push(course(map.width, x, y, [0, 0], n));
    });
  for (const [a, b] of CORNERS) if (mask & (1 << a) && mask & (1 << b)) courses.push(course(map.width, x, y, NEIGHBOURS[a]!, NEIGHBOURS[b]!));
  if (!courses.length && !self) return null;
  return { key: `${x},${y},${self ? 1 : 0},${mask}`, courses, patch: courses.length ? null : meetingPoint(map.width, x, y, 0, 0) };
}

/** Nearest point of a course to (u, v): how far off it is, and how far along the course from its start, in squares. */
export function courseGap(c: Course, u: number, v: number): { gap: number; along: number; length: number } {
  let gap = Infinity;
  let along = 0;
  let run = 0;
  for (let k = 0; k + 3 < c.length; k += 2) {
    const ax = c[k]!;
    const ay = c[k + 1]!;
    const ex = c[k + 2]! - ax;
    const ey = c[k + 3]! - ay;
    const l2 = ex * ex + ey * ey;
    const l = Math.sqrt(l2);
    const t = Math.max(0, Math.min(1, ((u - ax) * ex + (v - ay) * ey) / l2));
    const d = Math.hypot(u - ax - ex * t, v - ay - ey * t);
    if (d < gap) {
      gap = d;
      along = run + l * t;
    }
    run += l;
  }
  return { gap, along, length: run };
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
