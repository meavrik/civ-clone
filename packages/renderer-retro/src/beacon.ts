import { activeBeacon } from "@civ/renderer-api";
import { mixColor, shade } from "./palette.js";
import type { Surface } from "./surface.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/** The ring at the unit's feet: half its width and height in screen pixels (a flat ellipse, as a circle on the ground looks). */
const RX = 8.5;
const RY = 3.5;
/** How much wider the ripple is than the ring as it fades out. */
const SPREAD = 1.3;

type Rect = { x: number; y: number; w: number; h: number };

/**
 * The beacon at the feet of the unit in play on the square at (x, y) (`activeBeacon`, `ms` into it), on the canvas
 * under the unit's picture: a pool of gold light lying on the ground (the ground's own colours warmed toward gold,
 * through the Bayer dither, brightest in the middle), a gold ring round it, and a ripple of pale gold leaving the
 * ring, spreading and thinning out. Only inside `clip` (the map's view). On a city's square (`inCity`) no pool: its
 * dither would speckle the city's picture, which shows what is drawn over its square through holes.
 */
export function drawBeacon(s: Surface, x: number, y: number, ms: number, clip: Rect, inCity = false): void {
  const { pool, ripple } = activeBeacon(ms);
  const k = s.k;
  const cx = (x + 8) * k;
  const cy = (y + 15) * k - 1;
  const rx = RX * k, ry = RY * k;
  const x0 = Math.max(clip.x * k, Math.floor(cx - rx * (1 + SPREAD)) - 2);
  const x1 = Math.min((clip.x + clip.w) * k, Math.ceil(cx + rx * (1 + SPREAD)) + 2);
  const y0 = Math.max(clip.y * k, Math.floor(cy - ry * (1 + SPREAD)) - 2);
  const y1 = Math.min((clip.y + clip.h) * k, Math.ceil(cy + ry * (1 + SPREAD)) + 2);
  const gold = shade("wheat", 7);
  const ring = shade("wheat", 4 + Math.round(3 * pool));
  const pale = shade("sand", 7);
  // The ripple's ellipse, and how much of it still shows.
  const grow = ripple === null ? 0 : 1 + SPREAD * (1 - (1 - ripple) ** 2);
  const show = ripple === null ? 0 : (1 - ripple) * 0.95;
  for (let fy = y0; fy < y1; fy++)
    for (let fx = x0; fx < x1; fx++) {
      const px = fx + 0.5 - cx, py = fy + 0.5 - cy;
      const dither = BAYER[(fy & 3) * 4 + (fx & 3)]!;
      // Distance from an ellipse's edge, in fine pixels (its value over its slope).
      const edge = (ex: number, ey: number) => {
        const f = (px / ex) ** 2 + (py / ey) ** 2 - 1;
        const slope = 2 * Math.hypot(px / (ex * ex), py / (ey * ey));
        return slope > 0 ? f / slope : -Infinity;
      };
      if (show > 0 && Math.abs(edge(rx * grow, ry * grow)) < 0.9 && dither < show) { s.fset(fx, fy, pale); continue; }
      const d = edge(rx, ry);
      if (Math.abs(d) < 0.75) { s.fset(fx, fy, ring); continue; }
      if (d < 0 && !inCity) {
        const r2 = (px / rx) ** 2 + (py / ry) ** 2;
        const light = (0.3 + 0.4 * pool) * (1 - r2);
        if (dither < light) s.fset(fx, fy, mixColor(s.fget(fx, fy), gold, 0.55));
      }
    }
}
