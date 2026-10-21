import { LAND, type CoastPatch } from "./coast.js";
import { valueNoise } from "./hash.js";

/**
 * Where land of one kind meets land of another, the line between them
 * wanders across the square border, as shores do. Every point is pushed by
 * a smooth noise of its world position before it is placed in a square
 * (domain warping): neighbouring squares push the same points the same way,
 * so they agree on the line, corners included, and the push stays well
 * under half a square, so a square's middle is always its own.
 */

/** How far a point may be pushed along each axis, in squares. */
export const BLEND_REACH = 0.32;

/**
 * The push at world point (wx, wy), wrapping with the map: slow bends across squares, smaller
 * wiggles, and a ragged fringe a few pixels deep where specks of each ground stray into the other.
 */
export function blendWarp(wx: number, wy: number, width: number): [number, number] {
  const n = (salt: number) =>
    0.45 * valueNoise(wx, wy, 1.3, width, salt) + 0.25 * valueNoise(wx, wy, 3.7, width, salt + 1) +
    0.17 * valueNoise(wx, wy, 9, width, salt + 2) + 0.13 * valueNoise(wx, wy, 23, width, salt + 3);
  return [BLEND_REACH * n(41), BLEND_REACH * n(51)];
}

/**
 * The square of patch `p` (index 0..8) whose ground shows at (u, v), each
 * 0..1 across the patch's square: the square the pushed point falls in, when
 * the player knows it and it is land; -1 otherwise.
 */
export function groundOwner(p: CoastPatch, u: number, v: number): number {
  const [dx, dy] = blendWarp(p.x + u, p.y + v, p.width);
  const i = (Math.floor(v + dy) + 1) * 3 + Math.floor(u + dx) + 1;
  return p.depth[i] === LAND ? i : -1;
}
