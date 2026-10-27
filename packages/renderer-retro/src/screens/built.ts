import type { GameState } from "@civ/core";
import { BUILT_BUTTONS, builtCard, buildingArt, PICTURES, type BuiltHit, type BuiltView } from "@civ/renderer-api";
import { drawText, spacedWidth, textWidth } from "../font.js";
import { C, shade, slotColor } from "../palette.js";
import { rasterize } from "../pictures.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, hideArtUnder, drawEntering, drawStone, speckle } from "../widgets.js";
import { VIEW_Y } from "./main.js";
import { drawModalTitle, drawWindowButton, fitText, modalHit } from "./newtech.js";

/**
 * The Building Completed window, after the user's template (2026-10-24), a small window over the game:
 * the game's stone with a navy title strip (the shield, the news, a close box), the user's picture of
 * it on a slate bed (a spot in `Surface.art`: the apps lay the picture there, as it is), then View City
 * on the stone and Continue in gold. Smaller since 2026-10-25 and standing by its city (asked for:
 * "smaller, and placed above the relevant built city with an arrow"): over the map it stands above the
 * city's square (`BuiltView.square`), else below or beside it, a point of the window's stone reaching to
 * the square, which stays lit in a gold ring while the rest darkens; elsewhere (a wonder over its city's
 * picture) it is centred. Simpler since 2026-10-27 (asked for: "place all the text in the title -
 * <building> is completed in <city name> - smaller image and modal"): the title is the one line of words,
 * "Temple is completed in Rome", the window as wide as it needs, the picture small at the left with the
 * buttons beside it; the name, the city and the effects on parchment are gone.
 */

type Rect = { x: number; y: number; w: number; h: number };
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
/** The picture's room (36 square until 2026-10-27), and its slate bed's round it. */
const PIC = 28;
const BED = PIC + 6;
/** The buttons beside the picture, as wide as the longer label needs. */
const BUTTON_W = Math.max(...BUILT_BUTTONS.map((b) => spacedWidth(b))) + 14;
const BUTTON_H = 12;
const BUTTON_GAP = 4;
/** The title strip's room besides its words: the strip's inset, the shield at its left and the close box at its right, the same each side. */
const TITLE_ROOM = 2 * (3 + 17);
/** The window's least width: the bed and both buttons beside it. */
const MIN_W = 5 + BED + 8 + 2 * BUTTON_W + BUTTON_GAP + 8;
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

/** A window of `size` (the Building Completed window's, the conquest window's) on a screen `screenW` wide: by the city's square when given, else centred. */
export function builtPlace(screenW: number, square: Rect | undefined, size: { w: number; h: number }): BuiltPlace {
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

/** The window's size: as wide as its title's words need (no less than the picture and buttons, no wider than the screen `screenW`). */
function builtSize(title: string, screenW: number): { w: number; h: number } {
  return { w: Math.min(screenW - 6, Math.max(MIN_W, textWidth(title) + TITLE_ROOM)), h: 19 + BED + 5 };
}

/** Where the window stands on a screen `screenW` wide, by the city's square when the view gives it, else centred (a wonder's, over its city's picture). */
function placeOf(state: GameState, view: BuiltView, screenW: number): BuiltPlace {
  return builtPlace(screenW, view.square, builtSize(builtCard(state, view)?.title ?? "", screenW));
}

/** The window on a screen `screenW` wide. */
export function builtRect(state: GameState, view: BuiltView, screenW = SCREEN_W): Rect {
  return placeOf(state, view, screenW).win;
}

/** Where each part of the window stands, the window's top left at `o`: the title strip, the picture's bed at the left and the buttons beside it. */
function layout(o: Rect) {
  const bed = at(o, 5, 19, BED, BED);
  // The buttons in the middle of the room right of the bed, level with its middle.
  const room = bed.x + BED;
  const x = room + Math.floor((o.x + o.w - 5 - room - (2 * BUTTON_W + BUTTON_GAP)) / 2);
  const y = bed.y + ((BED - BUTTON_H) >> 1);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    bed,
    picture: { x: bed.x + 3, y: bed.y + 3, w: PIC, h: PIC },
    buttons: [{ x, y, w: BUTTON_W, h: BUTTON_H }, { x: x + BUTTON_W + BUTTON_GAP, y, w: BUTTON_W, h: BUTTON_H }],
  };
}
/** Where the building's picture goes on a screen `screenW` wide: its drawing fills this box, centred in the bed. */
export function builtPicture(state: GameState, view: BuiltView, screenW = SCREEN_W): Rect {
  return layout(builtRect(state, view, screenW)).picture;
}

// Colours, all from the palette's ramps: the template's gold and slate.
const GOLD = () => shade("wheat", 6);
const RULE = () => shade("panel", 2);
const STONE = () => shade("panel", 5);

/** What lies under a point: a button (View City on the left, Continue on the right), the close box (a little round it counts too), the city pointed at (View City), or nothing. */
export function builtHit(state: GameState, view: BuiltView, px: number, py: number, screenW = SCREEN_W): BuiltHit | null {
  const hit = modalHit(layout(builtRect(state, view, screenW)), px, py, "city");
  if (hit) return hit;
  const q = view.square;
  if (q && px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h) return "city";
  return null;
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
  const place = placeOf(state, view, s.width);
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
  // The news in ordinary letters (a sentence, not the strip's spaced capitals), gold in the middle of the strip.
  drawModalTitle(s, l, "shield", "", C.BLACK!);
  const { title: t } = l;
  const words = fitText(card.title, t.w - TITLE_ROOM + 6);
  drawText(s, t.x + Math.floor((t.w - textWidth(words)) / 2), t.y + 3, words, GOLD());

  // The picture's slate bed, sunk into the stone (seen bare only until the picture has loaded).
  const { bed } = l;
  s.frame(bed.x, bed.y, bed.w, bed.h, RULE());
  speckle(s, bed.x + 1, bed.y + 1, bed.w - 2, bed.h - 2, shade("steel", 3), shade("steel", 4), shade("steel", 4));
  s.hline(bed.x + 1, bed.y + 1, bed.w - 2, shade("steel", 3));
  s.vline(bed.x + 1, bed.y + 1, bed.h - 2, shade("steel", 3));
  const id = view.production.id;
  // The picture itself is laid over the canvas once the window stands whole (it would cover the window growing).
  if (buildingArt(id)) { if ((view.enter ?? 1) >= 1) s.art.push({ id, ...l.picture, middle: true }); }
  else {
    // No picture of the user's: the city view's drawn one, enlarged.
    const pic = PICTURES[id];
    const owner = state.cities.find((c) => c.id === view.city)?.owner ?? 0;
    if (pic) drawEnlarged(s, l.picture, rasterize(pic, slotColor(state.players[owner]!.color)), pic.w + 2, pic.h + 2);
  }

  l.buttons.forEach((b, i) => drawWindowButton(s, b, BUILT_BUTTONS[i]!, i === view.selected));
}
