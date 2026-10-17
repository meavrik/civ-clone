import { fogLevel, hash, type FogPatch } from "@civ/renderer-api";
import type { Context2D, Gradient } from "./context.js";
import { addPolys, region, sampleField } from "./contour.js";
import { CLOUDS, TILE } from "./theme.js";

/**
 * Clouds over unexplored squares (the fog field is `fogLevel`): a dark body,
 * solid on an unexplored square and thinning in bands into an explored square
 * beside one, with soft light and dark billows placed by world position and
 * kept inside the thick part of the fog. The squares in view are gathered and
 * each layer is painted at once, so no seams show between squares and the
 * billows run on across them.
 */

/** Fog levels where the body thickens, and how opaque each band adds; the last band is solid. */
const BANDS = [[0.06, 0.18], [0.2, 0.22], [0.36, 0.28], [0.52, 0.35], [0.68, 0.45], [0.84, 1]] as const;
/** How thick the fog must be for billows to show. */
const THICK = 0.5;
/** Billows per square: [kind, salt]; their place and size come from the square's position. */
const BILLOWS = [[0, 51], [1, 52], [0, 53]] as const;

interface Shapes {
  /** Polygons per band, in BANDS order. */
  body: number[][][];
  /** Where the fog is thick enough for billows. */
  thick: number[][];
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
  private squares: { x: number; y: number; p: FogPatch; s: Shapes | null }[] = [];

  /** The fog of the square drawn at (x, y), if it has any: all of an unexplored square, the drifting edge of an explored one beside it. */
  add(x: number, y: number, p: FogPatch): void {
    if (p.unknown[4]) this.squares.push({ x, y, p, s: null });
    else if (p.edge) this.squares.push({ x, y, p, s: edgeShapes(p) });
  }

  paint(ctx: Context2D): void {
    if (!this.squares.length) return;
    const all = this.squares;
    this.squares = [];
    ctx.save();
    ctx.fillStyle = CLOUDS.base;
    BANDS.forEach(([, alpha], b) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const { x, y, s } of all) addPolys(ctx, x, y, s ? s.body[b]! : b === BANDS.length - 1 ? SQUARE : []);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Billows, inside the thick fog only.
    ctx.beginPath();
    for (const { x, y, s } of all) addPolys(ctx, x, y, s ? s.thick : SQUARE);
    ctx.clip();
    for (const { x, y, p } of all)
      for (const [kind, salt] of BILLOWS) {
        const bx = x + hash(p.x, p.y, salt) * TILE;
        const by = y + hash(p.x, p.y, salt + 10) * TILE;
        const r = Math.round(2 + hash(p.x, p.y, salt + 20) * 2) * (TILE / 4);
        ctx.translate(bx, by);
        ctx.fillStyle = billow(ctx, kind, r);
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.translate(-bx, -by);
      }
    ctx.restore();
  }
}

const gradients = new Map<string, Gradient>();
let gradientCtx: Context2D | null = null;

/** A soft round billow of radius r centred on the origin, light (0) or dark (1); kept per context. */
function billow(ctx: Context2D, kind: number, r: number): Gradient {
  if (gradientCtx !== ctx) { gradients.clear(); gradientCtx = ctx; }
  const key = `${kind}:${r}`;
  let g = gradients.get(key);
  if (!g) {
    const [from, to] = kind ? CLOUDS.dark : CLOUDS.light;
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    gradients.set(key, g);
  }
  return g;
}
