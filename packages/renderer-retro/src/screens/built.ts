import type { GameState } from "@civ/core";
import { BUILT_BUTTONS, builtCard, buildingArt, PICTURES, type BuiltHit, type BuiltView, type IconName } from "@civ/renderer-api";
import { drawText, drawTextLarge, FONT_HEIGHT, textWidth } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { C, shade, slotColor } from "../palette.js";
import { rasterize } from "../pictures.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, hideArtUnder, drawEntering, drawStone, INK, speckle } from "../widgets.js";
import { VIEW_Y } from "./main.js";
import { drawModalTitle, drawWindowButton, modalHit } from "./newtech.js";

/**
 * The Building Completed window, after the user's template (2026-10-24), a small window over the game:
 * the game's stone with a navy title strip (the shield, BUILDING COMPLETED, a close box), the user's
 * picture of it on a slate bed (a spot in `Surface.art`: the apps lay the picture there, as it is), its
 * name large over the city that built it, what it does for the city and its upkeep on parchment, then
 * View City on the stone and Continue in gold. Smaller since 2026-10-25 and standing by its city (asked
 * for: "smaller, and placed above the relevant built city with an arrow"): over the map it stands above
 * the city's square (`BuiltView.square`), else below or beside it, a point of the window's stone reaching
 * to the square, which stays lit in a gold ring while the rest darkens; elsewhere (a wonder over its
 * city's picture) it is centred. Its sentence of description (`BuiltCard.text`) went to make it small:
 * the effects say what it does in numbers.
 */

type Rect = { x: number; y: number; w: number; h: number };
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
/** The window's size (204x128 until 2026-10-25). */
const WIN = { w: 168, h: 88 };
/** How far the point reaches from the window's edge toward the city's ring. */
const POINT = 6;
/** The ring round the city's square: black outside, gold within. */
const RING = 2;

type Side = "above" | "below" | "right" | "left";
/** Where the window stands: its rect, the side of the city it stands on and where its point ends (null when centred). */
export interface BuiltPlace {
  win: Rect;
  side: Side | null;
  /** The point's tip, on the ring's edge. */
  tip: { x: number; y: number } | null;
  /** The window and its point together (what grows on opening). */
  bounds: Rect;
}

/** The window (of `size`, the Building Completed window's by default) on a screen `screenW` wide: by the city's square when given, else centred. */
export function builtPlace(screenW = SCREEN_W, square?: Rect, size: { w: number; h: number } = WIN): BuiltPlace {
  const { w, h } = size;
  const centred = { win: { x: Math.floor((screenW - w) / 2), y: Math.floor((SCREEN_H - h) / 2), w, h }, side: null, tip: null };
  if (!square) return { ...centred, bounds: centred.win };
  const cx = square.x + (square.w >> 1);
  const cy = square.y + (square.h >> 1);
  // Clear of the menu bar, the shadow (2 pixels down and right) on the screen.
  const top = VIEW_Y + 1;
  const xIn = (x: number) => Math.max(1, Math.min(screenW - w - 3, x));
  const yIn = (y: number) => Math.max(top, Math.min(SCREEN_H - h - 3, y));
  // The point's foot along the window's edge, kept off its corners.
  const along = (c: number, from: number, len: number) => Math.max(from + POINT + 2, Math.min(from + len - POINT - 3, c));
  const reach = RING + POINT;
  const above = square.y - reach - h;
  if (above >= top) {
    const win = { x: xIn(cx - (w >> 1)), y: above, w, h };
    return { win, side: "above", tip: { x: along(cx, win.x, w), y: square.y - RING - 1 }, bounds: { ...win, h: h + POINT } };
  }
  const below = square.y + square.h + reach;
  if (below + h + 2 <= SCREEN_H) {
    const win = { x: xIn(cx - (w >> 1)), y: below, w, h };
    return { win, side: "below", tip: { x: along(cx, win.x, w), y: square.y + square.h + RING }, bounds: { ...win, y: below - POINT, h: h + POINT } };
  }
  const right = square.x + square.w + reach;
  if (right + w + 2 <= screenW) {
    const win = { x: right, y: yIn(cy - (h >> 1)), w, h };
    return { win, side: "right", tip: { x: square.x + square.w + RING, y: along(cy, win.y, h) }, bounds: { ...win, x: right - POINT, w: w + POINT } };
  }
  const left = square.x - reach - w;
  if (left >= 1) {
    const win = { x: left, y: yIn(cy - (h >> 1)), w, h };
    return { win, side: "left", tip: { x: square.x - RING - 1, y: along(cy, win.y, h) }, bounds: { ...win, w: w + POINT } };
  }
  return { ...centred, bounds: centred.win };
}

/** The centred window on a screen `screenW` wide (a wonder's, over its city's picture). */
export function builtRect(screenW = SCREEN_W, square?: Rect): Rect {
  return builtPlace(screenW, square).win;
}

/** Where each part of the window stands, the window's top left at `o`: the picture at the left, the words beside it, the buttons along the foot. */
function layout(o: Rect) {
  const frame = at(o, 5, 19, 42, 42);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    frame,
    picture: { x: frame.x + 3, y: frame.y + 3, w: frame.w - 6, h: frame.h - 6 },
    name: at(o, 51, 17, o.w - 56, 21),
    info: at(o, 49, 40, o.w - 54, 30),
    buttons: [at(o, 5, o.h - 16, 77, 12), at(o, o.w - 5 - 77, o.h - 16, 77, 12)],
  };
}
/** Where the building's picture goes, on a screen `screenW` wide, the window by `square` if given: its drawing fills this box, centred in the frame. */
export function builtPicture(screenW = SCREEN_W, square?: Rect): Rect {
  return layout(builtRect(screenW, square)).picture;
}

// Colours, all from the palette's ramps: the template's navy, gold, slate and parchment.
const NAVY = () => shade("azure", 0);
const GOLD = () => shade("wheat", 6);
const PARCHMENT = () => shade("hide", 7);
const PARCHMENT_DARK = () => shade("hide", 6);
const RULE = () => shade("panel", 2);
const QUIET = () => shade("panel", 2);
const STONE = () => shade("panel", 5);

/** What lies under a point: a button (View City on the left, Continue on the right), the close box (a little round it counts too), the city pointed at (View City), or nothing. */
export function builtHit(view: BuiltView, px: number, py: number, screenW = SCREEN_W): BuiltHit | null {
  const hit = modalHit(layout(builtRect(screenW, view.square)), px, py, "city");
  if (hit) return hit;
  const q = view.square;
  if (q && px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h) return "city";
  return null;
}

/** A parchment panel ringed in the stone's dark edge. */
function parchment(s: Surface, b: Rect): void {
  s.frame(b.x, b.y, b.w, b.h, RULE());
  speckle(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, PARCHMENT_DARK(), PARCHMENT(), PARCHMENT());
}

/** Text cut to a width, with a full stop where it was cut. */
function fit(text: string, w: number): string {
  if (textWidth(text) <= w) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}.`) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}.`;
}

/** A drawn picture's pixels (`rasterize`, `gw` by `gh`, -1 clear) as large as whole blocks fit in the picture's box, in its middle. */
function drawEnlarged(s: Surface, b: Rect, px: Int16Array, gw: number, gh: number): void {
  const k = Math.max(1, Math.floor(Math.min(b.w / gw, b.h / gh)));
  const x0 = b.x + Math.floor((b.w - gw * k) / 2);
  const y0 = b.y + Math.floor((b.h - gh * k) / 2);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const c = px[j * gw + i]!;
      if (c >= 0) s.rect(x0 + i * k, y0 + j * k, k, k, c);
    }
}

/** The city's square ringed: black outside, gold within, so it shows on any ground (the conquest window's too). */
export function drawSquareRing(s: Surface, q: Rect): void {
  s.frame(q.x - 2, q.y - 2, q.w + 4, q.h + 4, C.BLACK!);
  s.frame(q.x - 1, q.y - 1, q.w + 2, q.h + 2, GOLD());
}

/**
 * The window's point: a wedge of its stone, rimmed in black, from its edge (joining the stone through
 * the frame) to the tip on the city's ring, narrowing a pixel a side each step.
 */
export function drawWindowPoint(s: Surface, p: BuiltPlace): void {
  const { side, tip, win } = p;
  if (!side || !tip) return;
  // Step i from the window's edge (0, the frame's line) to the tip (POINT).
  for (let i = 0; i <= POINT; i++) {
    const half = POINT - i;
    const span = (c: number, r: number, color: number) => {
      if (side === "above" || side === "below") {
        const y = side === "above" ? win.y + win.h - 1 + i : win.y - i;
        s.hline(c - r, y, 2 * r + 1, color);
      } else {
        const x = side === "left" ? win.x + win.w - 1 + i : win.x - i;
        s.vline(x, c - r, 2 * r + 1, color);
      }
    };
    const c = side === "above" || side === "below" ? tip.x : tip.y;
    span(c, half, C.BLACK!);
    if (half >= 1) span(c, half - 1, STONE());
  }
}

export function drawBuilt(s: Surface, state: GameState, view: BuiltView): void {
  // The city stays lit, ringed, while the rest darkens.
  dimScreen(s, view.square);
  const place = builtPlace(s.width, view.square);
  if (view.square && place.side) drawSquareRing(s, view.square);
  const enter = view.enter ?? 1;
  // Opening, the window grows out of its point (the city), or about its middle.
  if (enter < 1) { drawEntering(s, enter, place.bounds, (t) => drawBuiltNow(t, state, view, place), place.tip ?? undefined); return; }
  drawBuiltNow(s, state, view, place);
}

function drawBuiltNow(s: Surface, state: GameState, view: BuiltView, place: BuiltPlace): void {
  const card = builtCard(state, view);
  if (!card) return;
  const o = place.win;
  const l = layout(o);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  s.frame(o.x, o.y, o.w, o.h, C.BLACK!);
  hideArtUnder(s, place.bounds);
  drawStone(s, o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  drawWindowPoint(s, place);
  drawModalTitle(s, l, "shield", card.title, C.BLACK!);

  // The picture's slate bed, sunk into the stone (seen bare only until the picture has loaded).
  const { frame } = l;
  s.frame(frame.x, frame.y, frame.w, frame.h, RULE());
  speckle(s, frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, shade("steel", 3), shade("steel", 4), shade("steel", 4));
  s.hline(frame.x + 1, frame.y + 1, frame.w - 2, shade("steel", 3));
  s.vline(frame.x + 1, frame.y + 1, frame.h - 2, shade("steel", 3));
  const id = view.production.id;
  // The picture itself is laid over the canvas once the window stands whole (it would cover the window growing).
  if (buildingArt(id)) { if ((view.enter ?? 1) >= 1) s.art.push({ id, ...l.picture, middle: true }); }
  else {
    // No picture of the user's: the city view's drawn one, enlarged.
    const pic = PICTURES[id];
    const owner = state.cities.find((c) => c.id === view.city)?.owner ?? 0;
    if (pic) drawEnlarged(s, l.picture, rasterize(pic, slotColor(state.players[owner]!.color)), pic.w + 2, pic.h + 2);
  }

  // The name, large where it fits, over the city that built it.
  const { name } = l;
  const big = card.name.toUpperCase();
  const scale = textWidth(big) * 2 <= name.w ? 2 : 1;
  drawTextLarge(s, name.x, name.y + (scale === 2 ? 0 : 3), big, NAVY(), scale);
  drawText(s, name.x, name.y + 13, card.where, INK);

  // What it does for the city, a line each, and its upkeep last (none for a wonder or a part).
  const { info } = l;
  parchment(s, info);
  const x = info.x + 4;
  const rows: { icon: IconName; text: string; ink: number }[] = card.effects.map((e) => ({ ...e, ink: INK }));
  const upkeep = card.upkeep ? [{ icon: "coin" as IconName, text: `Upkeep ${card.upkeep} gold a turn`, ink: QUIET() }] : [];
  const lines = [...rows.slice(0, 3 - upkeep.length), ...upkeep];
  lines.forEach((r, i) => {
    const y = info.y + 2 + i * (FONT_HEIGHT + 1);
    drawIcon(s, r.icon, x, y);
    drawText(s, x + ICON + 3, y, fit(r.text, info.w - ICON - 10), r.ink);
  });

  l.buttons.forEach((b, i) => drawWindowButton(s, b, BUILT_BUTTONS[i]!, i === view.selected));
}
