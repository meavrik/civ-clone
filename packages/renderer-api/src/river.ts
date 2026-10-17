import { getTile, Terrain, type WorldMap } from "@civ/core";
import { knownSquare, type Explored } from "./coast.js";
import { hash } from "./hash.js";

/**
 * Rivers that meander instead of running straight to the middle of each
 * square edge. A river square has a meeting point near its centre and runs
 * a curve from it to each river or sea neighbour (north, east, south, west).
 * Each curve crosses the shared border at a point picked by that border, so
 * both squares meet there, and leaves it square to the border, so the line
 * flows on without a kink; the wiggles fade out at both ends. A river widens
 * as it nears the sea, and the sea square beside it carries the mouth on
 * through whatever shore spills into it (renderers draw strokes on land only).
 * Neighbours the player has not explored (`explored`, when given) are left
 * out, so a river stops short of the fog instead of hinting at what lies there.
 */

/** One run of river across a square: points in square units (0..1 from its north-west corner) and the width at each, 1 being a renderer's usual river. */
export interface RiverStroke {
  pts: number[];
  widths: number[];
}

export interface RiverShape {
  strokes: RiverStroke[];
  /** Identifies the shape within its square, for caching drawn squares. */
  key: string;
}

/** North, east, south, west: the mask bits 1, 2, 4, 8. */
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
/** Width where a river reaches its square's edge on the sea, and at the end of its mouth. */
const MOUTH_START = 1.5;
const MOUTH_END = 2.3;

const isSea = (map: WorldMap, x: number, y: number) => getTile(map, x, y)?.terrain === Terrain.Ocean;

/** Which of the four (known) neighbours a river here flows to: other river squares and the sea, as N=1 E=2 S=4 W=8. */
export function riverLinks(map: WorldMap, x: number, y: number, explored?: Explored): number {
  let mask = 0;
  DIRS.forEach(([dx, dy], d) => {
    const n = getTile(map, x + dx, y + dy);
    if (n && (n.river || n.terrain === Terrain.Ocean) && knownSquare(map, explored, x + dx, y + dy)) mask |= 1 << d;
  });
  return mask;
}

/** Where a river crosses the border on side `d` of square (x, y), in that square's units; both squares of the border get the same point. */
export function riverCrossing(map: WorldMap, x: number, y: number, d: number): [number, number] {
  // A border is named by the square south or east of it.
  const across = d === 0 || d === 2;
  const ex = (((x + (d === 1 ? 1 : 0)) % map.width) + map.width) % map.width;
  const ey = y + (d === 2 ? 1 : 0);
  const t = 0.5 + (hash(ex, ey, across ? 11 : 12) - 0.5) * 0.36;
  return d === 0 ? [t, 0] : d === 1 ? [1, t] : d === 2 ? [t, 1] : [0, t];
}

/** The meeting point of a square's river branches, a little off its centre. */
function meeting(x: number, y: number): [number, number] {
  return [0.5 + (hash(x, y, 13) - 0.5) * 0.3, 0.5 + (hash(x, y, 14) - 0.5) * 0.3];
}

function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

const STEPS = 14;

/**
 * A curve from `from` to `to`, leaving along `start` and arriving along `end`
 * (unit vectors), with a sideways wiggle that fades to nothing, and flat, at both ends.
 */
function meander(from: [number, number], start: [number, number], to: [number, number], end: [number, number], seed: [number, number, number], width: (t: number) => number): RiverStroke {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const p1: [number, number] = [from[0] + start[0] * len * 0.4, from[1] + start[1] * len * 0.4];
  const p2: [number, number] = [to[0] - end[0] * len * 0.4, to[1] - end[1] * len * 0.4];
  const amp = 0.05 + 0.07 * hash(seed[0], seed[1], seed[2]);
  const freq = 0.7 + 0.7 * hash(seed[0], seed[1], seed[2] + 1);
  const phase = hash(seed[0], seed[1], seed[2] + 2);
  const pts: number[] = [];
  const widths: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const s = 1 - t;
    const bx = s * s * s * from[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * to[0];
    const by = s * s * s * from[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * to[1];
    const [tx, ty] = norm(
      3 * s * s * (p1[0] - from[0]) + 6 * s * t * (p2[0] - p1[0]) + 3 * t * t * (to[0] - p2[0]),
      3 * s * s * (p1[1] - from[1]) + 6 * s * t * (p2[1] - p1[1]) + 3 * t * t * (to[1] - p2[1]),
    );
    const off = amp * Math.sin(Math.PI * t) ** 3 * Math.sin(2 * Math.PI * (freq * t + phase));
    pts.push(bx - ty * off, by + tx * off);
    widths.push(width(t));
  }
  return { pts, widths };
}

/**
 * The river strokes drawn on square (x, y): the branches of a river square,
 * or the mouths a sea square carries for the rivers reaching it. Null when
 * there are none.
 */
export function riverShape(map: WorldMap, x: number, y: number, explored?: Explored): RiverShape | null {
  const tile = getTile(map, x, y);
  if (!tile) return null;
  const wx = (((x % map.width) + map.width) % map.width);
  if (tile.terrain === Terrain.Ocean) {
    const strokes: RiverStroke[] = [];
    let mask = 0;
    DIRS.forEach(([dx, dy], d) => {
      const n = getTile(map, x + dx, y + dy);
      if (!n || n.terrain === Terrain.Ocean || !n.river || !knownSquare(map, explored, x + dx, y + dy)) return;
      mask |= 1 << d;
      const c = riverCrossing(map, x, y, d);
      const inward: [number, number] = [-dx, -dy];
      const to: [number, number] = [c[0] + inward[0] * 0.55, c[1] + inward[1] * 0.55];
      strokes.push(meander(c, inward, to, inward, [wx, y, 40 + d * 3], (t) => MOUTH_START + (MOUTH_END - MOUTH_START) * t));
    });
    return strokes.length ? { strokes, key: `m${mask}` } : null;
  }
  if (!tile.river) return null;
  const links = riverLinks(map, x, y, explored);
  const node = meeting(wx, y);
  const ends = DIRS.map((_, d) => (links & (1 << d) ? riverCrossing(map, x, y, d) : null));
  const open = ends.flatMap((e, d) => (e ? [d] : []));
  if (!open.length) {
    // A spring or a pond with no river beside it: a short broad pool.
    return { strokes: [{ pts: [node[0] - 0.13, node[1], node[0] + 0.13, node[1]], widths: [1.7, 1.7] }], key: "r0" };
  }
  let sea = 0;
  const strokes = open.map((d) => {
    const c = ends[d]!;
    const [dx, dy] = DIRS[d]!;
    const toSea = isSea(map, x + dx, y + dy);
    if (toSea) sea |= 1 << d;
    // A river straight through leaves the meeting point along one line; where branches join, each heads for its own border.
    const other = open.length === 2 ? ends[open[0] === d ? open[1]! : open[0]!]! : null;
    const start = other ? norm(c[0] - other[0], c[1] - other[1]) : norm(c[0] - node[0], c[1] - node[1]);
    return meander(node, start, c, [dx, dy], [wx, y, 20 + d * 3], (t) => (toSea ? 1 + (MOUTH_START - 1) * Math.max(0, (t - 0.4) / 0.6) : 1));
  });
  return { strokes, key: `r${links}:${sea}` };
}

/** Distance from point (u, v) to a stroke, in square units, and the stroke's width there. */
export function strokeDistance(s: RiverStroke, u: number, v: number): { dist: number; width: number } {
  let best = Infinity;
  let width = 1;
  for (let k = 0; k + 3 < s.pts.length; k += 2) {
    const ax = s.pts[k]!;
    const ay = s.pts[k + 1]!;
    const bx = s.pts[k + 2]!;
    const by = s.pts[k + 3]!;
    const vx = bx - ax;
    const vy = by - ay;
    const l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((u - ax) * vx + (v - ay) * vy) / l2)) : 0;
    const d = Math.hypot(u - ax - vx * t, v - ay - vy * t);
    if (d < best) {
      best = d;
      const w0 = s.widths[k / 2]!;
      width = w0 + (s.widths[k / 2 + 1]! - w0) * t;
    }
  }
  return { dist: best, width };
}
