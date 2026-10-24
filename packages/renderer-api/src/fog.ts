import type { GameState, WorldMap } from "@civ/core";
import { knownSquare, type Explored } from "./coast.js";
import { valueNoise } from "./hash.js";
import type { UnitMotion } from "./motion.js";

/**
 * Fog over the squares a player has not explored. An unexplored square is
 * all fog; an explored square beside one has fog drifting a little way in
 * from that side, thickest at the border (so it meets the fogged square
 * without a seam) and thinning to nothing before the centre, with a ragged
 * edge. Corners round off: fog reaches in by distance to the fogged square.
 * A square the player has just explored still carries some fog while it
 * lifts (`FogLifter`), and its drift into its neighbours thins with it.
 * Everything here depends on the explored flags and world position only,
 * never on what lies under the fog.
 */

/** The 3x3 block around a square, row by row from the north-west; index 4 is the square itself. */
export interface FogPatch {
  x: number;
  y: number;
  /** Map width, for wrapping the noise. */
  width: number;
  /** Fog on each square of the block: 1 unexplored, 0 explored, in between while it lifts. Off the map counts as explored (the edge of the world stays plain). */
  cover: number[];
  /** Not wholly fogged, but fog drifts into it or still lifts off it. */
  edge: boolean;
  /** Identifies the block, for caching drawn squares. */
  key: string;
}

/** Fog left on squares just explored, by square index (y * width + x): 1 down to 0. */
export type Lifting = ReadonlyMap<number, number>;

/** Steps fog cover is rounded to, so drawn squares can be cached while it lifts. */
const COVER_STEPS = 32;

/** A patch from given cover values (see `FogPatch.cover`). */
export function makeFogPatch(width: number, x: number, y: number, cover: number[]): FogPatch {
  const c = cover.map((v) => Math.round(Math.max(0, Math.min(1, v)) * COVER_STEPS) / COVER_STEPS);
  const edge = c[4]! < 1 && c.some((v) => v > 0);
  return { x, y, width, cover: c, edge, key: `${width}:${x},${y}:${c.map((v) => v * COVER_STEPS).join(",")}` };
}

export function fogPatch(map: WorldMap, explored: Explored, x: number, y: number, lifting?: Lifting): FogPatch {
  const cover: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy;
      if (yy < 0 || yy >= map.height) { cover.push(0); continue; }
      const xx = (((x + dx) % map.width) + map.width) % map.width;
      cover.push(knownSquare(map, explored, xx, yy) ? lifting?.get(yy * map.width + xx) ?? 0 : 1);
    }
  return makeFogPatch(map.width, x, y, cover);
}

/**
 * The shade over squares the player has explored but does not see now (the
 * area it observes, core's `visible`: its land and a square beyond, and round
 * its units), as a patch like the fog's: 1 on a square out of sight, 0 on one
 * in sight, and the shade drifting a little way into a square in sight beside
 * one, its edge ragged as the fog's (`fogLevel`). Unexplored squares count as
 * out of sight (the fog covers them anyway); off the map as in sight.
 */
export function sightPatch(map: WorldMap, visible: Explored, x: number, y: number): FogPatch {
  const cover: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy;
      if (yy < 0 || yy >= map.height) { cover.push(0); continue; }
      const xx = (((x + dx) % map.width) + map.width) % map.width;
      cover.push(visible[yy * map.width + xx] ? 0 : 1);
    }
  return makeFogPatch(map.width, x, y, cover);
}

/**
 * How thick the fog is at (u, v), each 0..1 across the patch's square: 1 on
 * an unexplored square, 0 clear. `soft` (0..1) narrows the band where fog
 * drifting in from a neighbour fades, for a crisper edge.
 */
export function fogLevel(p: FogPatch, u: number, v: number, soft = 1): number {
  if (p.cover[4]! >= 1) return 1;
  let best = p.cover[4]!;
  const wx = p.x + u;
  const wy = p.y + v;
  // How far in it reaches, a third to just under half a square (the centre stays clear), varies along the edge.
  const reach = 0.3 + 0.18 * (valueNoise(wx, wy, 0.9, p.width, 31) * 0.5 + 0.5);
  const wisp = 0.35 * valueNoise(wx, wy, 3.5, p.width, 32) + 0.08 * valueNoise(wx, wy, 8, p.width, 33);
  for (let k = 0; k < 9; k++) {
    const cover = p.cover[k]!;
    if (k === 4 || cover <= best) continue;
    const c = (k % 3) - 1;
    const r = Math.floor(k / 3) - 1;
    const d = Math.hypot(Math.max(c - u, 0, u - (c + 1)), Math.max(r - v, 0, v - (r + 1)));
    let e = 1 - d / reach;
    if (e <= 0) continue;
    // Wisps: pushed in and out most halfway, never at the border itself.
    e = Math.max(0, Math.min(1, e + wisp * 4 * e * (1 - e)));
    e = Math.max(0, Math.min(1, (e - (1 - soft) / 2) / soft));
    best = Math.max(best, cover * e * e * (3 - 2 * e));
  }
  return best;
}

/** Brightness 0..1 of the cloud texture at world position (wx, wy) in squares, wrapping with the map: broad, slow billows. */
export function cloudTone(wx: number, wy: number, width: number): number {
  const n = 0.65 * valueNoise(wx, wy, 0.8, width, 41) + 0.35 * valueNoise(wx, wy, 1.9, width, 42);
  return Math.max(0, Math.min(1, 0.5 + 0.7 * n));
}

const NONE: Lifting = new Map();

/**
 * Fog lifting off squares as the player explores them, for the main map (a
 * UI side channel like `MotionPlayer`, never read by the game). Each frame
 * it compares the viewer's explored flags with the last frame's. A square
 * newly explored keeps its fog while one of the viewer's units is still
 * sliding toward it (so a long march does not clear the way ahead of the
 * unit), then the fog fades over `ms`. A new game, a loaded one or another
 * viewer starts afresh, with nothing lifting.
 */
export class FogLifter {
  private known: Uint8Array | null = null;
  private map: WorldMap | null = null;
  private viewer = -1;
  /** Squares fading, and when they began to. */
  private fading = new Map<number, number>();
  /** Squares explored but waiting for a sliding unit to come near. */
  private waiting = new Set<number>();

  constructor(private readonly ms = 700) {}

  /** Fog left on squares just explored, now; `moving` are the units sliding this frame (`view.moving`). */
  update(state: GameState, now: number, moving: readonly UnitMotion[] = []): Lifting {
    const viewer = state.currentPlayer;
    const explored = state.players[viewer]?.explored;
    if (!explored) return NONE;
    const { map } = state;
    if (this.map !== map || this.viewer !== viewer || !this.known || this.known.length !== explored.length) {
      this.map = map;
      this.viewer = viewer;
      this.known = Uint8Array.from(explored);
      this.fading.clear();
      this.waiting.clear();
      return NONE;
    }
    for (let i = 0; i < explored.length; i++)
      if (explored[i] && !this.known[i]) {
        this.known[i] = 1;
        this.waiting.add(i);
      }
    if (!this.waiting.size && !this.fading.size) return NONE;
    const mine = moving.filter((m) => m.owner === viewer);
    for (const i of this.waiting) {
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      const near = mine.some((m) => {
        const dx = Math.abs(m.x - x);
        return Math.max(Math.min(dx, map.width - dx), Math.abs(m.y - y)) <= 2.5;
      });
      if (mine.length && !near) continue;
      this.waiting.delete(i);
      this.fading.set(i, now);
    }
    const out = new Map<number, number>();
    for (const [i, t0] of this.fading) {
      const f = 1 - (now - t0) / this.ms;
      if (f <= 0) { this.fading.delete(i); continue; }
      out.set(i, f * f * (3 - 2 * f));
    }
    for (const i of this.waiting) out.set(i, 1);
    return out;
  }

  /** Whether any fog is still lifting (keep drawing frames). */
  busy(): boolean {
    return this.fading.size > 0 || this.waiting.size > 0;
  }
}
