import type { GameState } from "@civ/core";
import { BUILT_BUTTON, builtCard, buildingArt, PICTURES, type BuiltCard, type BuiltHit, type BuiltView, type IconName } from "@civ/renderer-api";
import { drawText, FONT_HEIGHT, spacedWidth, textWidth } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { C, shade, slotColor } from "../palette.js";
import { rasterize } from "../pictures.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, hideArtUnder, drawEntering, drawStone, INK, speckle } from "../widgets.js";
import { VIEW_Y } from "./main.js";
import { drawModalTitle, drawWindowButton, fitText, modalHit } from "./newtech.js";

/**
 * The Building Completed window, after the user's template (2026-10-24), a small window over the game:
 * the game's stone with a navy title strip (the shield, the news, a close box), the user's picture of
 * it on a slate bed (a spot in `Surface.art`: the apps lay the picture there, as it is), what it does on
 * parchment beside it, and View City in gold. Smaller since 2026-10-25 and standing by its city (asked for:
 * "smaller, and placed above the relevant built city with an arrow"): over the map it stands above the
 * city's square (`BuiltView.square`), else below or beside it, a point of the window's stone reaching to
 * the square, which stays lit in a gold ring while the rest darkens; elsewhere (a wonder over its city's
 * picture) it is centred. Simpler since 2026-10-27 (asked for: "place all the text in the title -
 * <building> is completed in <city name> - smaller image and modal"): the title says what and where,
 * "Temple is completed in Rome", the window as wide as it needs, the picture small at the left, the name
 * and the city line gone; the effects and upkeep stay beside the picture ("keep the building benefits").
 * One button, View City (the build menu over the map, Continue, went the same day: "enter the city view
 * to select the next building"); the close box and Esc go into the city too.
 */

type Rect = { x: number; y: number; w: number; h: number };
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
/** The picture's room (36 square until 2026-10-27), and its slate bed's round it. */
const PIC = 28;
const BED = PIC + 6;
/** The button along the foot. */
const BUTTON_W = spacedWidth(BUILT_BUTTON) + 24;
const BUTTON_H = 12;
/** The title strip's room besides its words: the strip's inset, the shield at its left and the close box at its right, the same each side. */
const TITLE_ROOM = 2 * (3 + 17);
/** Where the effects' parchment starts, right of the bed. */
const INFO_X = 5 + BED + 4;
/** A line of the effects, and how many fit beside the picture. */
const LINE = FONT_HEIGHT + 1;
const LINES = 3;
/** Room on a line besides its words: the parchment's edge and padding, the icon and the gap after it. */
const LINE_ROOM = 4 + ICON + 3 + 4;
/** The window's least width. */
const MIN_W = 140;
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

type InfoLine = { icon: IconName; text: string; quiet?: boolean };
/** What it does for the city, a line each, and its upkeep last (none for a wonder or a part), as many as fit. */
function infoLines(card: BuiltCard): InfoLine[] {
  const upkeep: InfoLine[] = card.upkeep ? [{ icon: "coin", text: `Upkeep ${card.upkeep} gold a turn`, quiet: true }] : [];
  return [...card.effects.slice(0, LINES - upkeep.length), ...upkeep];
}

/** The window's size: as wide as its title and its effects need (no less than `MIN_W`, no wider than the screen `screenW`). */
function builtSize(card: BuiltCard | null, screenW: number): { w: number; h: number } {
  const title = card ? textWidth(card.title) + TITLE_ROOM : 0;
  const info = card ? INFO_X + LINE_ROOM + Math.max(0, ...infoLines(card).map((l) => textWidth(l.text))) + 5 : 0;
  return { w: Math.min(screenW - 6, Math.max(MIN_W, title, info)), h: 19 + BED + 4 + BUTTON_H + 5 };
}

/** Where the window stands on a screen `screenW` wide, by the city's square when the view gives it, else centred (a wonder's, over its city's picture). */
function placeOf(state: GameState, view: BuiltView, screenW: number): BuiltPlace {
  return builtPlace(screenW, view.square, builtSize(builtCard(state, view), screenW));
}

/** The window on a screen `screenW` wide. */
export function builtRect(state: GameState, view: BuiltView, screenW = SCREEN_W): Rect {
  return placeOf(state, view, screenW).win;
}

/** Where each part of the window stands, the window's top left at `o`: the title strip, the picture's bed at the left, the effects beside it, the button along the foot. */
function layout(o: Rect) {
  const bed = at(o, 5, 19, BED, BED);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    bed,
    picture: { x: bed.x + 3, y: bed.y + 3, w: PIC, h: PIC },
    info: at(o, INFO_X, 19, o.w - INFO_X - 5, BED),
    buttons: [at(o, (o.w - BUTTON_W) >> 1, o.h - 5 - BUTTON_H, BUTTON_W, BUTTON_H)],
  };
}
/** Where the building's picture goes on a screen `screenW` wide: its drawing fills this box, centred in the bed. */
export function builtPicture(state: GameState, view: BuiltView, screenW = SCREEN_W): Rect {
  return layout(builtRect(state, view, screenW)).picture;
}

// Colours, all from the palette's ramps: the template's gold, slate and parchment.
const GOLD = () => shade("wheat", 6);
const PARCHMENT = () => shade("hide", 7);
const PARCHMENT_DARK = () => shade("hide", 6);
const RULE = () => shade("panel", 2);
const QUIET = () => shade("panel", 2);
const STONE = () => shade("panel", 5);

/** What lies under a point: the button (View City), the close box (a little round it counts too), the city pointed at (View City), or nothing. */
export function builtHit(state: GameState, view: BuiltView, px: number, py: number, screenW = SCREEN_W): BuiltHit | null {
  const hit = modalHit(layout(builtRect(state, view, screenW)), px, py, "city");
  if (hit === "city" || hit === "close") return hit;
  const q = view.square;
  if (q && px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h) return "city";
  return null;
}

/** A parchment panel ringed in the stone's dark edge. */
function parchment(s: Surface, b: Rect): void {
  s.frame(b.x, b.y, b.w, b.h, RULE());
  speckle(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, PARCHMENT_DARK(), PARCHMENT(), PARCHMENT());
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

  // What it does for the city, a line each, its upkeep last, in the middle of the parchment's height.
  const { info } = l;
  parchment(s, info);
  const lines = infoLines(card);
  const top = info.y + ((info.h - lines.length * LINE) >> 1);
  lines.forEach((r, i) => {
    const y = top + i * LINE;
    drawIcon(s, r.icon, info.x + 4, y);
    drawText(s, info.x + 4 + ICON + 3, y, fitText(r.text, info.w - LINE_ROOM), r.quiet ? QUIET() : INK);
  });

  // The one way on, lit as the choice Enter takes.
  drawWindowButton(s, l.buttons[0]!, BUILT_BUTTON, true);
}
