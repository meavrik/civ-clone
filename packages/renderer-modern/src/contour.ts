import type { Context2D } from "./context.js";
import { TILE } from "./theme.js";

/**
 * Filling the parts of a square where a smooth field passes a level: the
 * field is sampled on a grid and each region is one path of per-cell
 * polygons (marching squares), filled at once so no seams show between cells.
 * Shapes are in square units, 0..1 from the square's north-west corner.
 */

const STEPS = 12;

/** A field sampled on the grid over a square, `f(u, v)` with u, v from 0 to 1. */
export function sampleField(f: (u: number, v: number) => number): Float64Array {
  const g = new Float64Array((STEPS + 1) * (STEPS + 1));
  for (let j = 0; j <= STEPS; j++)
    for (let i = 0; i <= STEPS; i++) g[j * (STEPS + 1) + i] = f(i / STEPS, j / STEPS);
  return g;
}

/**
 * The part of the square where the field is below `level` (or at or above it,
 * if `!below`): one polygon per cell the edge passes through, and one
 * rectangle per run of cells wholly inside.
 */
export function region(g: Float64Array, level: number, below: boolean): number[][] {
  const inside = (v: number) => (below ? v < level : v >= level);
  const polys: number[][] = [];
  for (let cj = 0; cj < STEPS; cj++) {
    let run = -1;
    const closeRun = (end: number) => {
      if (run >= 0) polys.push([run / STEPS, cj / STEPS, end / STEPS, cj / STEPS, end / STEPS, (cj + 1) / STEPS, run / STEPS, (cj + 1) / STEPS]);
      run = -1;
    };
    for (let ci = 0; ci < STEPS; ci++) {
      const corners = [[ci, cj], [ci + 1, cj], [ci + 1, cj + 1], [ci, cj + 1]] as const;
      const vals = corners.map(([i, j]) => g[j * (STEPS + 1) + i]!);
      const ins = vals.map(inside);
      if (ins.every(Boolean)) {
        if (run < 0) run = ci;
        continue;
      }
      closeRun(ci);
      if (!ins.some(Boolean)) continue;
      const pts: number[] = [];
      for (let k = 0; k < 4; k++) {
        const [px, py] = corners[k]!;
        const [qx, qy] = corners[(k + 1) % 4]!;
        const vp = vals[k]!;
        const vq = vals[(k + 1) % 4]!;
        if (ins[k]) pts.push(px / STEPS, py / STEPS);
        if (ins[k] !== ins[(k + 1) % 4]) {
          const t = (level - vp) / (vq - vp);
          pts.push((px + (qx - px) * t) / STEPS, (py + (qy - py) * t) / STEPS);
        }
      }
      polys.push(pts);
    }
    closeRun(STEPS);
  }
  return polys;
}

/** Where the field crosses `level`, as segments: each cell joins its crossings in pairs. */
export function contour(g: Float64Array, level: number): number[] {
  const out: number[] = [];
  for (let cj = 0; cj < STEPS; cj++)
    for (let ci = 0; ci < STEPS; ci++) {
      const corners = [[ci, cj], [ci + 1, cj], [ci + 1, cj + 1], [ci, cj + 1]] as const;
      const vals = corners.map(([i, j]) => g[j * (STEPS + 1) + i]!);
      const pts: number[] = [];
      for (let k = 0; k < 4; k++) {
        const vp = vals[k]!;
        const vq = vals[(k + 1) % 4]!;
        if (vp < level === vq < level) continue;
        const [px, py] = corners[k]!;
        const [qx, qy] = corners[(k + 1) % 4]!;
        const t = (level - vp) / (vq - vp);
        pts.push((px + (qx - px) * t) / STEPS, (py + (qy - py) * t) / STEPS);
      }
      for (let k = 0; k + 3 < pts.length; k += 4) out.push(pts[k]!, pts[k + 1]!, pts[k + 2]!, pts[k + 3]!);
    }
  return out;
}

/** Add polygons in square units to the current path, over the square at (x, y). */
export function addPolys(ctx: Context2D, x: number, y: number, polys: number[][]): void {
  for (const poly of polys) {
    ctx.moveTo(x + poly[0]! * TILE, y + poly[1]! * TILE);
    for (let k = 2; k < poly.length; k += 2) ctx.lineTo(x + poly[k]! * TILE, y + poly[k + 1]! * TILE);
    ctx.closePath();
  }
}

/** Trace polygons in square units as a new path over the square at (x, y). */
export function tracePolys(ctx: Context2D, x: number, y: number, polys: number[][]): void {
  ctx.beginPath();
  addPolys(ctx, x, y, polys);
}
