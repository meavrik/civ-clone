import { Terrain } from "@civ/core";
import { coastLevel, COASTAL, DEEP_EDGE, LAND, SHORE, type CoastPatch } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { SEA, TERRAIN, TILE } from "./theme.js";

/**
 * Shores that wander across square borders (the field is `coastLevel`):
 * the field is sampled on a grid over the square and each region is filled
 * as one path of per-cell polygons (marching squares), so no seams show
 * between cells. Shapes are cached by the square's neighbourhood.
 */

const STEPS = 12;
/** Field values where the pale shallows give way to deeper shallows, and those to the open water of a coast. */
const SURF_BAND = 0.62;
const SHALLOWS = 0.8;

interface Layer {
  color: string;
  /** Polygons as flat x,y lists in square units (0..1). */
  polys: number[][];
  /** Drawn only inside these polygons. */
  clip?: number[][];
}

interface Shapes {
  fills: Layer[];
  /** The shore line, as x0,y0,x1,y1 segments in square units. */
  surf: number[];
}

const cache = new Map<string, Shapes>();

function sample(p: CoastPatch): Float64Array {
  const g = new Float64Array((STEPS + 1) * (STEPS + 1));
  for (let j = 0; j <= STEPS; j++)
    for (let i = 0; i <= STEPS; i++) g[j * (STEPS + 1) + i] = coastLevel(p, i / STEPS, j / STEPS);
  return g;
}

/** The part of the square where the field is below `level` (or at or above it, if `!below`), one polygon per cell. */
function region(g: Float64Array, level: number, below: boolean, keep?: (ci: number, cj: number) => boolean): number[][] {
  const inside = (v: number) => (below ? v < level : v >= level);
  const polys: number[][] = [];
  for (let cj = 0; cj < STEPS; cj++)
    for (let ci = 0; ci < STEPS; ci++) {
      if (keep && !keep(ci, cj)) continue;
      const corners = [[ci, cj], [ci + 1, cj], [ci + 1, cj + 1], [ci, cj + 1]] as const;
      const vals = corners.map(([i, j]) => g[j * (STEPS + 1) + i]!);
      const ins = vals.map(inside);
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
  return polys;
}

/** Where the field crosses `level`, as segments: each cell joins its crossings in pairs. */
function contour(g: Float64Array, level: number): number[] {
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

/**
 * Which land neighbour each part of a water square takes its colour from:
 * per quadrant, the land square sharing an edge with it (split along the
 * diagonal when both edge squares are land), else the land square at its
 * corner. The same choice as `landOwner`, as polygons in square units.
 */
function landRegions(p: CoastPatch): Map<number, number[][]> {
  const out = new Map<number, number[][]>();
  const add = (k: number, poly: number[]) => {
    const list = out.get(k) ?? [];
    list.push(poly);
    out.set(k, list);
  };
  for (const qx of [0, 1])
    for (const qy of [0, 1]) {
      const a = 3 + qx * 2; // the neighbour west or east
      const b = qy * 6 + 1; // north or south
      const d = qy * 6 + qx * 2; // the corner
      const ox = qx;
      const oy = qy;
      const land = (k: number) => p.depth[k] === LAND;
      if (land(a) && land(b)) {
        add(a, [0.5, 0.5, ox, oy, ox, 0.5]);
        add(b, [0.5, 0.5, 0.5, oy, ox, oy]);
      } else {
        const k = land(a) ? a : land(b) ? b : land(d) ? d : -1;
        if (k >= 0) add(k, [0.5, 0.5, ox, 0.5, ox, oy, 0.5, oy]);
      }
    }
  return out;
}

function shapes(p: CoastPatch): Shapes {
  const hit = cache.get(p.key);
  if (hit) return hit;
  const g = sample(p);
  const own = p.depth[4]!;
  const fills: Layer[] = [];
  if (own === LAND) {
    fills.push({ color: SEA.shallow, polys: region(g, SHORE, false) });
    fills.push({ color: SEA.shelf, polys: region(g, SURF_BAND, false) });
    fills.push({ color: TERRAIN[Terrain.Ocean].base, polys: region(g, SHALLOWS, false) });
  } else if (own === COASTAL) {
    fills.push({ color: SEA.deep.base, polys: region(g, DEEP_EDGE, false) });
    fills.push({ color: SEA.shelf, polys: region(g, SHALLOWS, true) });
    fills.push({ color: SEA.shallow, polys: region(g, SURF_BAND, true) });
    // Land spilling in from the neighbours: the largest share is laid first and whole, the others over it inside their own parts.
    const land = region(g, SHORE, true);
    const owners = [...landRegions(p)].sort((m, n) => n[1].length - m[1].length);
    owners.forEach(([k, clip], i) => fills.push({ color: TERRAIN[p.terrain[k]!].base, polys: land, ...(i ? { clip } : {}) }));
  } else {
    fills.push({ color: TERRAIN[Terrain.Ocean].base, polys: region(g, DEEP_EDGE, true) });
  }
  const out = { fills: fills.filter((f) => f.polys.length), surf: own === LAND || own === COASTAL ? contour(g, SHORE) : [] };
  if (cache.size > 4096) cache.clear();
  cache.set(p.key, out);
  return out;
}

function tracePolys(ctx: Context2D, x: number, y: number, polys: number[][]): void {
  ctx.beginPath();
  for (const poly of polys) {
    ctx.moveTo(x + poly[0]! * TILE, y + poly[1]! * TILE);
    for (let k = 2; k < poly.length; k += 2) ctx.lineTo(x + poly[k]! * TILE, y + poly[k + 1]! * TILE);
    ctx.closePath();
  }
}

/** Blend a square's shore and the edge of deep water across its borders, over its base terrain. */
export function paintCoast(ctx: Context2D, x: number, y: number, p: CoastPatch): void {
  if (!p.mixed) return;
  const { fills, surf } = shapes(p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, TILE, TILE);
  ctx.clip();
  for (const f of fills) {
    if (f.clip) {
      ctx.save();
      tracePolys(ctx, x, y, f.clip);
      ctx.clip();
    }
    tracePolys(ctx, x, y, f.polys);
    ctx.fillStyle = f.color;
    ctx.fill();
    if (f.clip) ctx.restore();
  }
  if (surf.length) {
    ctx.beginPath();
    for (let k = 0; k < surf.length; k += 4) {
      ctx.moveTo(x + surf[k]! * TILE, y + surf[k + 1]! * TILE);
      ctx.lineTo(x + surf[k + 2]! * TILE, y + surf[k + 3]! * TILE);
    }
    ctx.strokeStyle = SEA.surf;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}
