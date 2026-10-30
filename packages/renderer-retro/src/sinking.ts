import { hash, unitArt, unitArtPlace } from "@civ/renderer-api";
import { drawShield, drawUnit, SHIELD_AT, shieldHoles, STACK_SHIFT } from "./overlays.js";
import { C, shade } from "./palette.js";
import { darker } from "./sprites/index.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { Surface } from "./surface.js";

/**
 * A ship going down on deep water (`MainScreenView.sinking`; asked for 2026-10-27: "when ship sinks - show it
 * sinking in water - with message above it"). The ship as the map draws it, owner's shield and all, rocks on
 * the swell, then tips bow up and slips under its waterline (the foot of its picture), stern first, foam where
 * the hull meets the water; bubbles rise and rings spread where it went down. Drawn on the fine grid, column by
 * column (a tilt is each column of the picture let down a whole pixel more than the next), everything placed by
 * a hash, never the game's RNG, so a frame at `t` is always the same picture. The words above it are the map's
 * callout. A ship the user drew a picture of (`unitArt`) goes the same way as its picture, tipped and let down
 * whole (`ArtSpot.turn`, `water`), its shield staying on the water while it rocks.
 */

/** The share of the show spent rocking, and where the last of the ship has gone under. */
const ROCK = 0.16;
const UNDER = 0.72;
/** How far the ship tips as it goes: fine pixels down per pixel along it, the stern going first. */
const TIP = 0.45;
/** Bubbles that rise where it went down, and the rings that spread from it. */
const BUBBLES = 12;
const RINGS = [0.5, 0.62, 0.76];
const RING_LIFE = 0.24;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

type Clip = { x0: number; y0: number; x1: number; y1: number };

/**
 * The ship of `type` sinking at `t` (0..1) on the square whose top left is screen (sx, sy), in its owner's
 * `color`, a second shield behind for its cargo (`stacked`), on the map's view from (`left`, `top`) on.
 */
export function drawSinking(s: Surface, sx: number, sy: number, type: string, color: number, stacked: boolean, t: number, left = 0, top = 0, flip = false): void {
  if (unitArt(type)) { sinkPicture(s, sx, sy, type, color, stacked, t, left, top, flip); return; }
  const k = s.k;
  const n = 16 * k;
  const clip: Clip = { x0: left * k, y0: top * k, x1: s.fw, y1: s.fh };
  const ship = new Surface(16, 16, undefined, k);
  ship.fill(SPRITE_CLEAR);
  drawUnit(ship, { type, order: { kind: "none" } }, 0, 0, color, stacked);
  // The picture's extent; its foot is the waterline.
  let x0 = n, x1 = -1, y0 = n, y1 = -1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (ship.data[y * n + x] !== SPRITE_CLEAR) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return;
  const water = y1 + 1;
  const mid = (x0 + x1) / 2;
  const fx = sx * k, fy = sy * k;
  const put = (x: number, y: number, c: number) => {
    const px = fx + x, py = fy + y;
    if (px >= clip.x0 && py >= clip.y0 && px < clip.x1 && py < clip.y1) s.fset(px, py, c);
  };

  if (t < UNDER) {
    // How far each column has gone down: a sway while it rocks, then a fall that quickens, the stern first.
    const { sway, drop, tip } = motion(t, water - y0, x1 - mid);
    const down = (x: number) => Math.round(drop + tip * (mid - x));
    const foam: number[] = [];
    for (let x = x0; x <= x1; x++) {
      const d = down(x);
      let wet = false;
      for (let y = y0; y <= y1; y++) {
        const c = ship.data[y * n + x]!;
        if (c === SPRITE_CLEAR) continue;
        if (y + d >= water) { wet = true; continue; }
        put(x + sway, y + d, c);
      }
      if (wet) foam.push(x + sway);
    }
    // Foam along the waterline where the hull goes in, spilling a pixel or two either side.
    if (foam.length) {
      const a = Math.min(...foam) - 2, b = Math.max(...foam) + 2;
      const frame = Math.floor(t * 40);
      for (let x = a; x <= b; x++) {
        const h = hash(x, frame, 71);
        if ((x < a + 2 || x > b - 2) && h < 0.5) continue;
        put(x, water - 1, h < 0.6 ? C.WHITE! : shade("ice", 6));
        if (h > 0.8) put(x, water - 2, C.WHITE!);
      }
    }
  }

  drawRipples(t, mid, water, fx, fy, put);
}

/** How the ship moves at `t`: tipped (pixels down per pixel along it, the stern first), let down and swayed (fine pixels). */
function motion(t: number, height: number, half: number): { tip: number; drop: number; sway: number } {
  if (t < ROCK) {
    const r = t / ROCK;
    return { tip: 0.07 * Math.sin(r * Math.PI * 3), drop: 0, sway: Math.round(Math.sin(r * Math.PI * 2)) };
  }
  const u = (t - ROCK) / (UNDER - ROCK);
  return { tip: TIP * Math.min(1, u * 1.6), drop: u ** 1.6 * (height + TIP * half + 2), sway: 0 };
}

/**
 * A ship the user drew a picture of going down: the picture (as it is, laid over the canvas) swayed, tipped
 * about its foot and let down under its waterline; the shield stays on the water, shown through it, while it
 * rocks; foam along the waterline as it goes in, then the rings and bubbles.
 */
function sinkPicture(s: Surface, sx: number, sy: number, type: string, color: number, stacked: boolean, t: number, left: number, top: number, flip: boolean): void {
  const k = s.k;
  const place = unitArtPlace({ id: type, unit: true, x: sx, y: sy, w: 16, h: 16 })!;
  const water = place.y + place.h;
  const room = { x: left, y: top, w: s.width - left, h: s.height - top };
  const put = (x: number, y: number, c: number) => {
    if (x >= left * k && y >= top * k && x < s.fw && y < s.fh) s.fset(x, y, c);
  };
  const fx = sx * k, fy = sy * k;
  const mid = (place.x - sx + place.w / 2) * k;
  const line = (water - sy) * k;
  if (t < UNDER) {
    const m = motion(t, place.h * k, (place.w * k) / 2);
    const afloat = t < ROCK;
    s.art.push({
      id: type, unit: true, x: sx + m.sway / k, y: sy + m.drop / k, w: 16, h: 16, clip: room,
      turn: (-Math.atan(m.tip) * 180) / Math.PI,
      // Facing left it goes down mirrored, its stern (now on the right) first.
      ...(flip ? { flip: true } : {}),
      // Rocking, it keeps its shield showing through; going down, nothing of it below the waterline.
      ...(afloat ? { holes: shieldHoles(sx, sy, stacked) } : { water }),
    });
    if (afloat) {
      if (stacked) drawShield(s, sx, sy, SHIELD_AT + STACK_SHIFT, SHIELD_AT + STACK_SHIFT, darker(color), darker(color), -1);
      drawShield(s, sx, sy, SHIELD_AT, SHIELD_AT, color, darker(color));
    }
    // Foam along the waterline where the hull meets the water, once it starts to go.
    if (t > 0) {
      const a = Math.round((place.x - sx) * k) - 2, b = Math.round((place.x - sx + place.w) * k) + 2;
      const frame = Math.floor(t * 40);
      for (let x = a; x <= b; x++) {
        const h = hash(x, frame, 71);
        if ((x < a + 2 || x > b - 2) && h < 0.5) continue;
        put(fx + x, fy + line - 1, h < 0.6 ? C.WHITE! : shade("ice", 6));
        if (h > 0.8) put(fx + x, fy + line - 2, C.WHITE!);
      }
    }
  }
  drawRipples(t, mid, line, fx, fy, (x, y, c) => put(fx + x, fy + y, c));
}

/** The rings spreading where a ship went down (its middle `mid`, its waterline `water`, fine pixels of its square) and the bubbles rising. */
function drawRipples(t: number, mid: number, water: number, fx: number, fy: number, put: (x: number, y: number, c: number) => void): void {
  // Rings spreading from where it went down, thinning as they grow.
  const cy = water - 1;
  for (const start of RINGS) {
    const a = (t - start) / RING_LIFE;
    if (a < 0 || a > 1) continue;
    const rx = 3 + a * 13, ry = Math.max(1, rx / 3.5);
    const steps = Math.ceil(rx * 6);
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const x = Math.round(mid + Math.cos(ang) * rx), y = Math.round(cy + Math.sin(ang) * ry);
      if (BAYER[((fy + y) & 3) * 4 + ((fx + x) & 3)]! < a * 0.9) continue;
      put(x, y, a < 0.5 ? C.WHITE! : shade("ice", 6));
    }
  }
  // Bubbles, each rising a few pixels from the water and bursting.
  for (let i = 0; i < BUBBLES; i++) {
    const born = 0.3 + hash(i, 1, 73) * 0.62;
    const a = (t - born) / 0.09;
    if (a < 0 || a > 1) continue;
    const x = Math.round(mid + (hash(i, 2, 73) - 0.5) * 14);
    const y = Math.round(cy - a * 4);
    if (a < 0.8) put(x, y, C.WHITE!);
    else for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) put(x + dx, y + dy, shade("ice", 7));
  }
}
