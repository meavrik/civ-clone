import type { WorldMap } from "@civ/core";
import { knownSquare, type Explored } from "./coast.js";
import { valueNoise } from "./hash.js";

/**
 * Fog over the squares a player has not explored. An unexplored square is
 * all fog; an explored square beside one has fog drifting a little way in
 * from that side, thickest at the border (so it meets the fogged square
 * without a seam) and thinning to nothing before the centre, with a
 * ragged edge. Corners round off: fog reaches in by distance to the nearest
 * unexplored square. Everything here depends on the explored flags and
 * world position only, never on what lies under the fog.
 */

/** The 3x3 block around a square, row by row from the north-west; index 4 is the square itself. */
export interface FogPatch {
  x: number;
  y: number;
  /** Map width, for wrapping the noise. */
  width: number;
  /** Which squares of the block the player has not explored. Off the map counts as explored (the edge of the world stays plain). */
  unknown: boolean[];
  /** The square is explored but borders an unexplored one, so fog drifts into it. */
  edge: boolean;
  /** Identifies the block, for caching drawn squares. */
  key: string;
}

export function fogPatch(map: WorldMap, explored: Explored, x: number, y: number): FogPatch {
  const unknown: boolean[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy;
      unknown.push(yy >= 0 && yy < map.height && !knownSquare(map, explored, x + dx, yy));
    }
  const edge = !unknown[4] && unknown.some(Boolean);
  const mask = unknown.reduce((m, u, i) => m | (u ? 1 << i : 0), 0);
  return { x, y, width: map.width, unknown, edge, key: `${map.width}:${x},${y}:${mask}` };
}

/** How thick the fog is at (u, v), each 0..1 across the patch's square: 1 on an unexplored square, 0 clear. */
export function fogLevel(p: FogPatch, u: number, v: number): number {
  if (p.unknown[4]) return 1;
  let d = Infinity;
  for (let k = 0; k < 9; k++) {
    if (!p.unknown[k]) continue;
    const c = (k % 3) - 1;
    const r = Math.floor(k / 3) - 1;
    const dx = Math.max(c - u, 0, u - (c + 1));
    const dy = Math.max(r - v, 0, v - (r + 1));
    d = Math.min(d, Math.hypot(dx, dy));
  }
  if (d === Infinity) return 0;
  const wx = p.x + u;
  const wy = p.y + v;
  // How far in it reaches, a third to just under half a square (the centre stays clear), varies along the edge.
  const reach = 0.3 + 0.18 * (valueNoise(wx, wy, 0.9, p.width, 31) * 0.5 + 0.5);
  let e = 1 - d / reach;
  if (e <= 0) return 0;
  // Wisps: pushed in and out most halfway, never at the border itself.
  e += (0.45 * valueNoise(wx, wy, 3.5, p.width, 32) + 0.2 * valueNoise(wx, wy, 8, p.width, 33)) * 4 * e * (1 - e);
  e = Math.max(0, Math.min(1, e));
  return e * e * (3 - 2 * e);
}

/** Brightness 0..1 of the cloud texture at world position (wx, wy) in squares, wrapping with the map. */
export function cloudTone(wx: number, wy: number, width: number): number {
  const n = 0.55 * valueNoise(wx, wy, 1.1, width, 41) + 0.3 * valueNoise(wx, wy, 2.6, width, 42) + 0.15 * valueNoise(wx, wy, 6, width, 43);
  return Math.max(0, Math.min(1, 0.5 + 0.6 * n));
}
