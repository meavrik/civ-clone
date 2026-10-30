import { FOUNDING, hash, moveArt, type MainScreenView } from "@civ/renderer-api";
import { drawSpacedRinged, drawTextLargeRinged, FONT_HEIGHT, textWidthLarge } from "./font.js";
import { C, DIMMED, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * A city founded by the viewer, made a moment (asked for 2026-10-29: "for new settlement epic effect - add zoom and some
 * effect and delay to let the player see the new settlement establishment"; the timeline is renderer-api's
 * `foundingMoment`). Over the map as drawn, its founders' show standing on the city's square (a picture the apps lay
 * over the canvas): the view blown up about the city, which glides to the middle as it comes closer (pictures and
 * all); dusk falling round it through the Bayer dither, deeper further out, the founders in a pool of light; once their
 * flag unfurls, rays of gold turning slowly behind it and sparks drifting up; then the city's name in large gold
 * capitals under them, letter by letter, over "A NEW CITY". Everything placed by hashes and the moment's time, never
 * the game's RNG, so a frame is always the same picture. All of it is drawn under the pictures, so the founders stand
 * in front of the light.
 */

type Founding = NonNullable<MainScreenView["founding"]>;
type Rect = { x: number; y: number; w: number; h: number };

/** The dither dusk and light fall through, as the fog's edge does. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
/** Where the city's square settles in the view as it glides in: across the middle, a little below half way down (the flag rises above it). */
const SETTLE_DOWN = 0.56;
/** The pool of light round the founders, in squares: its middle above the square's foot, its reach either way; dusk falls beyond it, deeper past `DEEP`. */
const POOL = { up: 0.6, across: 1.05, high: 1.0, edge: 0.55, deep: 1.7 };
/** The light behind the flag, in squares from the square's foot and middle; its rays and how far they reach. */
const FLAG = { across: 0.22, up: 0.95 };
const RAYS = 14;
const RAY_HALF = 0.075;
const SPARKS = 28;

export function drawFounding(s: Surface, f: Founding, view: Rect, zoomed: number): void {
  const spot = s.art.find((a) => a.unit && a.id === f.id);
  if (!spot) return;
  const k = s.k;
  // Closer by the moment's glide: to `FOUNDING.zoom` times the map at 1x, from the zoom it is drawn at.
  const scale = 1 + (Math.max(1, FOUNDING.zoom / zoomed) - 1) * f.zoom;
  const from = { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 };
  const to = { x: from.x + (view.x + view.w / 2 - from.x) * f.zoom, y: from.y + (view.y + view.h * SETTLE_DOWN - from.y) * f.zoom };
  magnifyAbout(s, view, from, to, scale);
  const founders = s.art.find((a) => a.unit && a.id === f.id);
  const S = spot.w * scale;
  const cx = to.x;
  const foot = to.y + S / 2;
  const clip = { x0: view.x * k, y0: view.y * k, x1: (view.x + view.w) * k, y1: (view.y + view.h) * k };

  // Dusk round a pool of light on the founders; pictures out in the dark darken with it once it is half fallen.
  const pool = { x: cx * k, y: (foot - POOL.up * S) * k, rx: POOL.across * S * k, ry: POOL.high * S * k };
  const reach = (x: number, y: number) => Math.sqrt(((x - pool.x) / pool.rx) ** 2 + ((y - pool.y) / pool.ry) ** 2);
  if (f.zoom > 0) {
    // Each column's share of the distance, worked out once.
    const across = new Float64Array(clip.x1 - clip.x0);
    for (let x = clip.x0; x < clip.x1; x++) across[x - clip.x0] = ((x - pool.x) / pool.rx) ** 2;
    for (let y = clip.y0; y < clip.y1; y++) {
      const row = y * s.fw;
      const down = ((y - pool.y) / pool.ry) ** 2;
      const dither = (y & 3) * 4;
      for (let x = clip.x0; x < clip.x1; x++) {
        const d2 = across[x - clip.x0]! + down;
        if (d2 < 1) continue;
        const d = Math.sqrt(d2);
        const b = BAYER[dither + (x & 3)]!;
        const i = row + x;
        if (b < f.zoom * Math.min(1, (d - 1) / POOL.edge)) s.data[i] = DIMMED[s.data[i]!]!;
        if (d > POOL.deep && b < f.zoom * Math.min(1, (d - POOL.deep) / POOL.edge)) s.data[i] = DIMMED[s.data[i]!]!;
      }
    }
    if (f.zoom >= 0.5) for (const a of s.art) if (a !== founders && reach((a.x + a.w / 2) * k, (a.y + a.h / 2) * k) > 1.2) a.dim = true;
  }

  if (f.glory > 0) {
    // Rays of gold turning slowly behind the flag, a glow at their heart.
    const ox = (cx + FLAG.across * S) * k, oy = (foot - FLAG.up * S) * k;
    const R = (1.25 + 0.55 * f.glory) * S * k;
    const halo = 0.42 * S * k;
    const turn = f.ms * 0.00012;
    const step = (Math.PI * 2) / RAYS;
    const x0 = Math.max(clip.x0, Math.floor(ox - R)), x1 = Math.min(clip.x1, Math.ceil(ox + R));
    const y0 = Math.max(clip.y0, Math.floor(oy - R)), y1 = Math.min(clip.y1, Math.ceil(oy + R));
    const inks = [shade("wheat", 5), shade("wheat", 6), shade("wheat", 7)] as const;
    // Worked out a screen pixel at a time (two fine pixels square), each fine pixel dithered.
    for (let by = y0 - (y0 & 1); by < y1; by += 2) {
      const dy2 = (by + 1 - oy) ** 2;
      for (let bx = x0 - (x0 & 1); bx < x1; bx += 2) {
        const r2 = (bx + 1 - ox) ** 2 + dy2;
        if (r2 >= R * R) continue;
        const r = Math.sqrt(r2);
        const glow = Math.max(0, 1 - r / halo);
        let v = f.glory * glow;
        // Only where a ray could show more than the glow is the angle worked out.
        if (f.glory * 0.8 * (1 - r / R) > v) {
          const a = (Math.atan2(by + 1 - oy, bx + 1 - ox) - turn) / step;
          const off = Math.abs(a - Math.round(a)) * step;
          v = Math.max(v, f.glory * Math.max(0, 1 - off / RAY_HALF) * (1 - r / R) * 0.8);
        }
        if (v <= 0) continue;
        const ink = r < halo * 0.6 ? inks[2] : v > 0.45 ? inks[1] : inks[0];
        for (let y = Math.max(by, y0); y < Math.min(by + 2, y1); y++)
          for (let x = Math.max(bx, x0); x < Math.min(bx + 2, x1); x++) if (BAYER[(y & 3) * 4 + (x & 3)]! < v) s.data[y * s.fw + x] = ink;
      }
    }
    // Sparks drifting up round the founders, white as they rise, gold as they fade.
    for (let i = 0; i < SPARKS; i++) {
      if (hash(i, 9, 61) > f.glory) continue;
      const life = (f.ms / 1700 + hash(i, 1, 61)) % 1;
      if (life > 0.85) continue;
      const x = (cx + (hash(i, 2, 61) - 0.5) * 2.4 * S + Math.sin(life * 7 + i) * 0.06 * S) * k;
      const y = (foot - (0.1 + life * 1.8) * S) * k;
      const colour = life < 0.35 ? C.WHITE! : life < 0.65 ? C.YELLOW! : shade("wheat", 6);
      const r = life < 0.5 ? 2 : 1;
      for (let d = -r; d <= r; d++) {
        dot(s, x + d, y, colour, clip);
        dot(s, x, y + d, colour, clip);
      }
    }
  }

  if (f.title > 0) {
    // The city's name under the founders, letter by letter, over the words that say what it is.
    const words = f.city.toUpperCase();
    const shown = words.slice(0, Math.max(1, Math.ceil(words.length * Math.min(1, f.title * 1.6))));
    const w = textWidthLarge(words, 2);
    const x = Math.round(Math.max(view.x + 2, Math.min(view.x + view.w - w - 2, cx - w / 2)));
    const y = Math.round(Math.min(view.y + view.h - 2 * FONT_HEIGHT - FONT_HEIGHT - 6, foot + 3));
    drawTextLargeRinged(s, x, y, shown, shade("wheat", 7), shade("hide", 0), 2);
    if (f.title >= 1) drawSpacedRinged(s, Math.round(cx), y + 2 * FONT_HEIGHT + 3, "A NEW CITY", shade("hide", 7), shade("hide", 0));
  }
}

/** A fine pixel inside `clip`. */
function dot(s: Surface, x: number, y: number, colour: number, clip: { x0: number; y0: number; x1: number; y1: number }): void {
  const fx = Math.round(x), fy = Math.round(y);
  if (fx >= clip.x0 && fy >= clip.y0 && fx < clip.x1 && fy < clip.y1) s.data[fy * s.fw + fx] = colour;
}

/**
 * The view blown up `scale` times about screen point `from`, which lands on `to`: each fine pixel from the nearest of
 * the view as drawn (its edges held where the glide reaches past them), and the pictures laid over it moved and grown
 * the same, each still shown inside the view only.
 */
function magnifyAbout(s: Surface, view: Rect, from: { x: number; y: number }, to: { x: number; y: number }, scale: number): void {
  if (scale === 1 && from.x === to.x && from.y === to.y) return;
  const k = s.k;
  const x0 = view.x * k, y0 = view.y * k, w = view.w * k, h = view.h * k;
  const copy = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) copy.set(s.data.subarray((y0 + y) * s.fw + x0, (y0 + y) * s.fw + x0 + w), y * w);
  const fx = from.x * k - x0, fy = from.y * k - y0, tx = to.x * k - x0, ty = to.y * k - y0;
  const cols = new Int32Array(w);
  for (let x = 0; x < w; x++) cols[x] = Math.max(0, Math.min(w - 1, Math.floor(fx + (x + 0.5 - tx) / scale)));
  for (let y = 0; y < h; y++) {
    const from = Math.max(0, Math.min(h - 1, Math.floor(fy + (y + 0.5 - ty) / scale))) * w;
    const row = (y0 + y) * s.fw + x0;
    for (let x = 0; x < w; x++) s.data[row + x] = copy[from + cols[x]!]!;
  }
  s.art = s.art.map((a) => ({ ...moveArt(a, from.x, from.y, to.x, to.y, scale), ...(a.clip ? { clip: a.clip } : {}) }));
}
