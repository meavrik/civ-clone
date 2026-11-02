import { hash, hutArtPlace, sackedHut, sackFall, sackLength, type ArtBox, type ArtSpot, type HutKind, type Sacking } from "@civ/renderer-api";
import { C, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * A village being sacked (`MainScreenView.sacking`, `sack.ts` in renderer-api; asked for 2026-11-02: "when unit enter a
 * village hut - add a sack village animation"). The hut's picture is shaken a pixel sideways after each blow and, once
 * the blows are done, tottered and let down under its foot (`sackHut`); on the canvas (`drawSack`) chips of what it is
 * made of fly off at each blow, a cloud of dust billows along its foot as it goes, smoke and embers rise after, and what
 * it held bursts out with the last blow, in front of the dust and smoke (gold coins arcing out and landing about its
 * foot, glinting; a scroll rising over it among sparkles). Drawn on the fine grid after the units, under the pictures:
 * the hut, holed where they cross it, stands behind them; the unit stands in front. Placed by the moment and hashes,
 * never the game's RNG.
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/** Chips knocked off at each blow: so many, flying so long. */
const CHIPS = 6;
const CHIP_MS = 380;
/** What each kind of hut is made of: the chips' two inks (straw, timber, mud brick, hide, stone). */
const CHIP_INKS: Record<HutKind, [string, number][]> = {
  thatch: [["wheat", 4], ["dune", 1]],
  timber: [["hide", 1], ["mound", 4]],
  adobe: [["dune", 0], ["dune", 3]],
  tent: [["hide", 2], ["hide", 5]],
  cottage: [["rock", 1], ["rock", 4]],
};

/** A chip, two pixels square with a corner gone, the gone corner turning round as it tumbles. */
const SPLINTER = [[".c", "cc"], ["c.", "cc"], ["cc", "c."], ["cc", ".c"]];

/** A coin seen face on, turning, edge on, and lying on the ground: outline, light, gold, shade. */
const COIN_FACE = [".oooo.", "ollmmo", "olmmdo", "ommmdo", "omddoo", ".oooo."];
const COIN_TURN = [".oo.", "olmo", "olmo", "omdo", "omdo", ".oo."];
const COIN_EDGE = ["oo", "lo", "mo", "mo", "do", "oo"];
const COIN_FLAT = [".ommo.", "ollmdo", ".oddo."];
const COIN_SPIN = [COIN_FACE, COIN_TURN, COIN_EDGE, COIN_TURN];
/** Coins leave one after another, so far apart. */
const COIN_GAP_MS = 35;

/** A scroll of learning: its rolls (dark, light), the sheet, its writing, its outline. */
const SCROLL = [
  "oRrrrrrrRo",
  ".oppppppo.",
  ".opqqqqpo.",
  ".oppppppo.",
  ".opqqqppo.",
  ".oppppppo.",
  "oRrrrrrrRo",
];
const SCROLL_RISE_MS = 450;
const SPARKLES = 7;

/** Dust along the hut's foot as it goes down, and the wisps of smoke and the embers after. */
const PUFFS = 10;
const DUST_MS = 950;
const WISPS = 3;
const WISP_EVERY_MS = 90;
const WISP_MS = 650;
const EMBERS = 9;
const EMBER_MS = 480;

/** Lay a picture of characters (`.` clear) with its top left at fine (x, y), each character `n` fine pixels square, in `inks`. */
function lay(rows: readonly string[], inks: Record<string, number>, x: number, y: number, n: number, put: (x: number, y: number, c: number) => void, skip?: (x: number, y: number) => boolean): void {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === ".") return;
    for (let b = 0; b < n; b++)
      for (let a = 0; a < n; a++) {
        const px = Math.round(x) + i * n + a, py = Math.round(y) + j * n + b;
        if (!skip?.(px, py)) put(px, py, inks[ch]!);
      }
  }));
}

/** The hut's picture box on a square at (x, y) of size `t`: its picture's, or the drawn huts' room. */
function hutBox(kind: HutKind, x: number, y: number, t: number): ArtBox {
  return hutArtPlace({ id: kind, hut: true, x, y, w: t, h: t }) ?? { x: x + t * 0.15, y: y + t * 0.3, w: t * 0.7, h: t * 0.67 };
}

/** The hut's picture as it stands `sack.ms` in: shaken sideways (a pixel or so), let down under its foot, nothing of it showing below. */
export function sackHut(spot: ArtSpot, sack: Sacking): void {
  const box = hutArtPlace(spot);
  if (!box) return;
  const { shake, down } = sackedHut(sack);
  const foot = box.y + box.h;
  const room = spot.clip ?? { x: spot.x - spot.w, y: spot.y - spot.h, w: spot.w * 3, h: spot.h * 2 };
  // Whole fine pixels sideways, a little more on larger squares.
  spot.x += Math.round(shake * 2 * (spot.w / 16)) / 2;
  spot.y += down * (box.h + 1);
  spot.clip = { x: room.x, y: room.y, w: room.w, h: Math.max(0, Math.min(room.y + room.h, foot) - room.y) };
}

/**
 * The sack on the square whose top left is screen (sx, sy), `t` pixels a side, a village of `kind`, on the map's view
 * from (`left`, `top`) on, the unit standing aside on the left (`away` 1: the coins fly mostly right) or the right (-1):
 * the chips, the dust, the smoke and embers, the loot.
 */
export function drawSack(s: Surface, sack: Sacking, sx: number, sy: number, kind: HutKind, t: number, left = 0, top = 0, away: 1 | -1 = 1): void {
  const k = s.k;
  // Distances are given in fine pixels of the original's 16-pixel square.
  const z = t / 16;
  const box = hutBox(kind, sx, sy, t);
  const bx = box.x * k, by = box.y * k, bw = box.w * k, bh = box.h * k;
  const mid = bx + bw / 2, foot = by + bh;
  const put = (x: number, y: number, c: number) => {
    const px = Math.round(x), py = Math.round(y);
    if (px >= left * k && py >= top * k && px < s.fw && py < s.fh) s.fset(px, py, c);
  };
  const ms = sack.ms;
  // The loot and the chips grow with the square: a fine pixel of theirs two on squares of 28 pixels and more.
  const n = z >= 1.75 ? 2 : 1;
  const fall = sackFall(sack.blows);
  const end = sackLength(sack.blows);

  // Chips of the hut flying off at each blow, falling back.
  const inks = CHIP_INKS[kind].map(([ramp, n]) => shade(ramp, n));
  sack.blows.forEach((at, b) => {
    const a = (ms - at) / CHIP_MS;
    if (a < 0 || a >= 1) return;
    const sec = (ms - at) / 1000;
    for (let i = 0; i < CHIPS; i++) {
      const x0 = mid + (hash(b, i, 81) - 0.5) * bw * 0.7, y0 = by + bh * (0.15 + 0.45 * hash(b, i, 82));
      const vx = (hash(b, i, 83) - 0.5) * 80, vy = -(30 + 45 * hash(b, i, 84));
      const x = x0 + vx * sec * z, y = y0 + (vy * sec + 130 * sec * sec) * z;
      const c = inks[i % inks.length]!;
      // A splinter turning end over end.
      lay(SPLINTER[(Math.floor(a * 8) + i) % SPLINTER.length]!, { c }, x, y, n, put);
    }
  });

  // Dust billowing along the foot as the hut goes down, rising, spreading and thinning away.
  const dust = [shade("dune", 2), shade("mound", 6), shade("mound", 4)];
  for (let i = 0; i < PUFFS; i++) {
    const a = (ms - fall - hash(i, 1, 85) * 120) / DUST_MS;
    if (a < 0 || a >= 1) continue;
    const x0 = bx - bw * 0.1 + bw * 1.2 * (i / (PUFFS - 1));
    const px = x0 + (x0 - mid) * 0.45 * a, py = foot - z - 10 * z * a * (0.5 + hash(i, 2, 85));
    const r = (2 + 4.5 * Math.sqrt(a)) * z * (0.7 + 0.6 * hash(i, 3, 85));
    const thin = (1 - a) ** 0.7 * 0.95;
    for (let dy = -Math.ceil(r); dy <= r; dy++)
      for (let dx = -Math.ceil(r); dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const qx = Math.round(px + dx), qy = Math.round(py + dy);
        if (BAYER[(qy & 3) * 4 + (qx & 3)]! < thin) put(qx, qy, dust[(i + (dy < 0 ? 0 : 1)) % dust.length]!);
      }
  }

  // Smoke rising in wisps from where it stood, swaying and thinning; embers flying up among it.
  const smoke = [shade("rock", 1), shade("rock", 2), shade("steel", 5)];
  for (let w = 0; w < WISPS; w++) {
    const x0 = mid + (w - (WISPS - 1) / 2) * bw * 0.28;
    for (let born = fall + 250 + w * 30; born < end - 200; born += WISP_EVERY_MS) {
      const a = (ms - born) / WISP_MS;
      if (a < 0 || a >= 1) continue;
      const px = x0 + Math.sin(a * Math.PI * 1.5 + w * 2) * 2 * z, py = foot - 2 * z - 16 * z * a;
      const r = (1 + 2 * a) * z;
      const thin = 0.75 * (1 - a);
      for (let dy = -Math.ceil(r); dy <= r; dy++)
        for (let dx = -Math.ceil(r); dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const qx = Math.round(px + dx), qy = Math.round(py + dy);
          if (BAYER[(qy & 3) * 4 + (qx & 3)]! < thin) put(qx, qy, smoke[a < 0.3 ? 0 : a < 0.65 ? 1 : 2]!);
        }
    }
  }
  // What it held, over its dust and smoke.
  const last = sack.blows[sack.blows.length - 1] ?? 0;
  if (sack.loot?.kind === "coins") drawCoins(sack.loot.count, ms - last, mid, foot, bh, z, n, away, put);
  if (sack.loot?.kind === "scroll") drawScroll(ms - last, ms, end, mid, by, z, n, put);
  for (let i = 0; i < EMBERS; i++) {
    const born = fall + 80 + hash(i, 1, 86) * (end - fall - EMBER_MS - 80);
    const a = (ms - born) / EMBER_MS;
    if (a < 0 || a >= 1) continue;
    const px = mid + (hash(i, 2, 86) - 0.5) * bw * 0.8 + Math.sin(a * 7 + i) * z, py = foot - 2 * z - 12 * z * a * (0.7 + 0.6 * hash(i, 3, 86));
    // Bright as it leaves, dimming to red, flickering out.
    if (a > 0.6 && hash(i, Math.floor(ms / 50), 87) < a - 0.4) continue;
    put(px, py, a < 0.3 ? C.YELLOW! : a < 0.65 ? C.ORANGE! : C.RED!);
  }
}

/**
 * Gold coins bursting out of the hut's door from the last blow (`el` ms after it), one after another, spinning as they
 * arc out, most of them `away` from the unit, and land about its foot, where they lie glinting.
 */
function drawCoins(count: number, el: number, mid: number, foot: number, bh: number, z: number, n: number, away: number, put: (x: number, y: number, c: number) => void): void {
  const inks: Record<string, number> = { o: shade("mound", 0), l: shade("wheat", 7), m: shade("wheat", 4), d: shade("mound", 3) };
  const g = 320;
  for (let i = 0; i < count; i++) {
    const sec = (el - i * COIN_GAP_MS) / 1000;
    if (sec < 0) continue;
    const x0 = mid + (hash(i, 1, 88) - 0.5) * 4 * z, y0 = foot - bh * 0.25;
    // Out away from the unit, one in three the other way, some further than others.
    const vx = (i % 3 === 2 ? -away : away) * (8 + 26 * hash(i, 2, 88)), vy = -(70 + 40 * hash(i, 3, 88));
    const ground = foot - (1 + 5 * hash(i, 4, 88)) * z;
    const land = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, (ground - y0) / z))) / g;
    const tt = Math.min(sec, land);
    const x = x0 + vx * tt * z, y = sec < land ? y0 + (vy * tt + (g / 2) * tt * tt) * z : ground;
    const sprite = sec < land ? COIN_SPIN[(Math.floor(sec * 16) + i) % COIN_SPIN.length]! : COIN_FLAT;
    const w = sprite[0]!.length * n, h = sprite.length * n;
    lay(sprite, inks, x - w / 2, y - h, n, put);
    // Lying, now and then it catches the light.
    if (sec >= land && hash(i, Math.floor(el / 90), 89) < 0.18) lay(["w"], { w: C.WHITE! }, x - w / 2 + 2 * n, y - h + n, n, put);
  }
}

/** A scroll rising out of the hut's roof from the last blow (`el` ms after it), hovering over it among sparkles until the end. */
function drawScroll(el: number, ms: number, end: number, mid: number, roof: number, z: number, n: number, put: (x: number, y: number, c: number) => void): void {
  if (el < 0) return;
  const inks: Record<string, number> = { R: shade("rock", 4), r: shade("rock", 5), p: shade("rock", 7), q: shade("mound", 0), o: shade("mound", 2) };
  const rise = Math.min(1, el / SCROLL_RISE_MS);
  const eased = 1 - (1 - rise) ** 3;
  const h = SCROLL.length * n, w = SCROLL[0]!.length * n;
  const x = Math.round(mid - w / 2), y = Math.round(roof + 4 * z - eased * 12 * z + (rise >= 1 ? Math.sin((el - SCROLL_RISE_MS) / 160) * n : 0)) - h;
  // Its last moments, it fades through the dither.
  const fade = Math.max(0, (ms - (end - 200)) / 200);
  lay(SCROLL, inks, x, y, n, put, (px, py) => BAYER[(py & 3) * 4 + (px & 3)]! < fade);
  // Sparkles twinkling round it: a cross of light, gone in a moment.
  for (let i = 0; i < SPARKLES; i++) {
    const slot = Math.floor((el + hash(i, 1, 90) * 300) / 300);
    const a = ((el + hash(i, 1, 90) * 300) % 300) / 300;
    if (a > 0.45) continue;
    const ang = hash(i, slot, 91) * Math.PI * 2, d = (6 + 4 * hash(i, slot, 92)) * z;
    const px = mid + Math.cos(ang) * d, py = y + h / 2 + Math.sin(ang) * d * 0.7;
    lay(a < 0.3 ? [".r.", "rcr", ".r."] : ["c"], { c: a < 0.2 ? C.WHITE! : C.YELLOW!, r: shade("wheat", 7) }, px - (a < 0.3 ? n : 0), py - (a < 0.3 ? n : 0), n, put);
  }
}

