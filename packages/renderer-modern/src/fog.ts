import { fogLevel, hash, makeFogPatch, type Explored, type FogPatch, type Lifting } from "@civ/renderer-api";
import type { WorldMap } from "@civ/core";
import type { Context2D, Gradient } from "./context.js";
import { addPolys, region, sampleField } from "./contour.js";
import { CLOUDS, TILE } from "./theme.js";

/**
 * Clouds over unexplored squares (the fog field is `fogLevel`): a dark body,
 * solid on an unexplored square and thinning in bands into an explored square
 * beside one, with broad, faint light and dark billows placed by world
 * position and kept inside the thick part of the fog. The squares in view are
 * gathered and each layer is painted at once, so no seams show between
 * squares and the billows run on across them. Fog lifting off a square just
 * explored is laid over the rest: that square's body and its drift into its
 * neighbours, fading out together.
 */

/** Fog levels where the body thickens, and how opaque each band adds; the last band is solid. */
const BANDS = [[0.06, 0.18], [0.2, 0.22], [0.36, 0.28], [0.52, 0.35], [0.68, 0.45], [0.84, 1]] as const;
/** How thick the fog must be for billows to show. */
const THICK = 0.5;
/** Billows per square: [dark?, salt]; their place and size come from the square's position. */
const BILLOWS = [[0, 51], [1, 52]] as const;

interface Shapes {
  /** Polygons per band, in BANDS order. */
  body: number[][][];
  /** Where the fog is thick enough for billows. */
  thick: number[][];
}

interface Square {
  x: number;
  y: number;
  /** Map square, for placing billows. */
  mx: number;
  my: number;
  /** Null for a wholly fogged square. */
  s: Shapes | null;
}

const SQUARE = [[0, 0, 1, 0, 1, 1, 0, 1]];
const cache = new Map<string, Shapes>();

function edgeShapes(p: FogPatch): Shapes {
  const hit = cache.get(p.key);
  if (hit) return hit;
  const fog = sampleField((u, v) => fogLevel(p, u, v));
  const out = { body: BANDS.map(([level]) => region(fog, level, false)), thick: region(fog, THICK, false) };
  if (cache.size > 4096) cache.clear();
  cache.set(p.key, out);
  return out;
}

/** Gathers the fog of the squares drawn, then paints it all at once. */
export class Clouds {
  private squares: Square[] = [];
  /** Squares fog is lifting off, with the drift into their neighbours, by how much fog is left. */
  private lifting = new Map<number, Square[]>();

  /** The fog of the square drawn at (x, y), if it has any: all of an unexplored square, the drifting edge of an explored one beside it. */
  add(x: number, y: number, p: FogPatch): void {
    if (p.cover[4]! >= 1) this.squares.push({ x, y, mx: p.x, my: p.y, s: null });
    else if (p.edge) this.squares.push({ x, y, mx: p.x, my: p.y, s: edgeShapes(p) });
  }

  /**
   * Fog `cover` (1..0) still lifting off map square (mx, my), drawn at (x, y):
   * over it, and drifting into its explored neighbours, except those at least
   * as fogged (their own fog covers that). Squares lifting together are
   * painted as one layer, so where they meet the fog does not double up.
   */
  lift(x: number, y: number, mx: number, my: number, cover: number, map: WorldMap, explored: Explored, lifting: Lifting): void {
    const group = this.lifting.get(cover) ?? [];
    this.lifting.set(cover, group);
    group.push({ x, y, mx, my, s: null });
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const ny = my + oy;
        if ((!ox && !oy) || ny < 0 || ny >= map.height) continue;
        const nx = (((mx + ox) % map.width) + map.width) % map.width;
        if (!explored[ny * map.width + nx] || (lifting.get(ny * map.width + nx) ?? 0) >= cover) continue;
        const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        cov[(1 - oy) * 3 + (1 - ox)] = 1;
        group.push({ x: x + ox * TILE, y: y + oy * TILE, mx: nx, my: ny, s: edgeShapes(makeFogPatch(map.width, nx, ny, cov)) });
      }
  }

  paint(ctx: Context2D): void {
    const all = this.squares;
    const lifting = this.lifting;
    this.squares = [];
    this.lifting = new Map();
    // Bodies first, lifting ones too, then the billows over all of them, so the billows run on unbroken.
    body(ctx, all, 1);
    for (const [cover, squares] of lifting) body(ctx, squares, cover);
    billows(ctx, all);
  }
}

/** Paint the body of the fog of some squares, all at `alpha`. */
function body(ctx: Context2D, squares: Square[], alpha: number): void {
  if (!squares.length) return;
  ctx.save();
  ctx.fillStyle = CLOUDS.base;
  BANDS.forEach(([, a], b) => {
    ctx.globalAlpha = a * alpha;
    ctx.beginPath();
    for (const { x, y, s } of squares) addPolys(ctx, x, y, s ? s.body[b]! : b === BANDS.length - 1 ? SQUARE : []);
    ctx.fill();
  });
  ctx.restore();
}

/** Soft billows over the fog of some squares, inside its thick part only. */
function billows(ctx: Context2D, squares: Square[]): void {
  if (!squares.length) return;
  ctx.save();
  ctx.beginPath();
  for (const { x, y, s } of squares) addPolys(ctx, x, y, s ? s.thick : SQUARE);
  ctx.clip();
  for (const { x, y, mx, my } of squares)
    for (const [dark, salt] of BILLOWS) {
      const bx = x + hash(mx, my, salt) * TILE;
      const by = y + hash(mx, my, salt + 10) * TILE;
      const r = Math.round(4 + hash(mx, my, salt + 20) * 2) * (TILE / 4);
      ctx.translate(bx, by);
      ctx.fillStyle = billow(ctx, dark, r);
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.translate(-bx, -by);
    }
  ctx.restore();
}

const gradients = new Map<string, Gradient>();
let gradientCtx: Context2D | null = null;

/** A soft round billow of radius r centred on the origin, light or dark; kept per context. */
function billow(ctx: Context2D, dark: number, r: number): Gradient {
  if (gradientCtx !== ctx) { gradients.clear(); gradientCtx = ctx; }
  const key = `${dark}:${r}`;
  let g = gradients.get(key);
  if (!g) {
    const [from, to] = dark ? CLOUDS.dark : CLOUDS.light;
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    gradients.set(key, g);
  }
  return g;
}
