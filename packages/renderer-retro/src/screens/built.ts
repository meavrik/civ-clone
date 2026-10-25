import type { GameState } from "@civ/core";
import { BUILT_BUTTONS, builtCard, buildingArt, PICTURES, type BuiltHit, type BuiltView, type IconName } from "@civ/renderer-api";
import { drawSpaced, drawText, drawTextLarge, FONT_HEIGHT, spacedWidth, textWidth, wrapText } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { C, shade, slotColor } from "../palette.js";
import { rasterize } from "../pictures.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, hideArtUnder, drawEntering, drawStone, INK, speckle } from "../widgets.js";
import { drawModalName, drawModalTitle, drawWindowButton, modalHit } from "./newtech.js";

/**
 * The Building Completed window, after the user's template (2026-10-24), made a small window over the
 * game as the New Technology window is (asked for the same day: "a modal opened on top of the game"):
 * the game's stone with a navy title strip (the hammer, BUILDING COMPLETED, a close box), the name
 * large over the city that built it, the user's picture of it on a slate bed (a spot in `Surface.art`:
 * the apps lay the picture there, as it is), a parchment panel with its description, its effects on
 * the city and its upkeep, then View City on the stone and Continue in gold. Centred on the screen it
 * opens over (`builtRect`, smaller than the New Technology window.s since 2026-10-24).
 */

type Rect = { x: number; y: number; w: number; h: number };
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
/** The window's size: smaller than the New Technology window's since 2026-10-24 (asked for: "minimize the building complete window"). */
const WIN = { w: 204, h: 128 };
/** The window, centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function builtRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - WIN.w) / 2), y: Math.floor((SCREEN_H - WIN.h) / 2), ...WIN };
}
/** Where each part of the window stands, the window's top left at `o`: the picture at the left, the words beside it, the buttons along the foot. */
function layout(o: Rect) {
  const frame = at(o, 5, 44, 54, 54);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    name: at(o, 5, 17, o.w - 10, 25),
    frame,
    picture: { x: frame.x + 3, y: frame.y + 3, w: frame.w - 6, h: frame.h - 6 },
    info: at(o, 63, 44, o.w - 68, 64),
    buttons: [at(o, 6, o.h - 17, 92, 12), at(o, o.w - 6 - 92, o.h - 17, 92, 12)],
  };
}
/** Where the building's picture goes, on a screen `screenW` wide: its drawing fills this box, centred in the frame. */
export function builtPicture(screenW = SCREEN_W): Rect {
  return layout(builtRect(screenW)).picture;
}
/** How wide the description's lines may run (three of them fit). */
export const BUILT_TEXT_W = builtRect().w - 68 - 12;
/** An effect's icon box. */
const BOX = 11;

// Colours, all from the palette's ramps: the template's navy, gold, slate and parchment.
const NAVY = () => shade("azure", 0);
const GOLD_DARK = () => shade("wheat", 0);
const GOLD_LIGHT = () => shade("wheat", 4);
const GOLD_INK = () => shade("wheat", 6);
const PARCHMENT = () => shade("hide", 7);
const PARCHMENT_DARK = () => shade("hide", 6);
const RULE = () => shade("panel", 2);
const QUIET = () => shade("panel", 2);

/** What lies under a point: a button (View City on the left, Continue on the right), the close box (a little round it counts too), or nothing. */
export function builtHit(_view: BuiltView, px: number, py: number, screenW = SCREEN_W): BuiltHit | null {
  return modalHit(layout(builtRect(screenW)), px, py, "city");
}

/** A parchment panel ringed in the stone's dark edge. */
function parchment(s: Surface, b: { x: number; y: number; w: number; h: number }): void {
  s.frame(b.x, b.y, b.w, b.h, RULE());
  speckle(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, PARCHMENT_DARK(), PARCHMENT(), PARCHMENT());
}

/** An effect: its icon in a small raised box, its words beside it. */
function effect(s: Surface, x: number, y: number, icon: IconName, text: string): void {
  drawStone(s, x, y, BOX, BOX);
  drawIcon(s, icon, x + Math.floor((BOX - ICON) / 2), y + Math.floor((BOX - ICON) / 2) + 1);
  drawText(s, x + BOX + 4, y + 2, text, INK);
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

export function drawBuilt(s: Surface, state: GameState, view: BuiltView): void {
  dimScreen(s);
  const enter = view.enter ?? 1;
  if (enter < 1) { drawEntering(s, enter, builtRect(s.width), (t) => drawBuiltNow(t, state, view)); return; }
  drawBuiltNow(s, state, view);
}

function drawBuiltNow(s: Surface, state: GameState, view: BuiltView): void {
  const card = builtCard(state, view);
  if (!card) return;
  const o = builtRect(s.width);
  const l = layout(o);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  s.frame(o.x, o.y, o.w, o.h, C.BLACK!);
  hideArtUnder(s, o);
  drawStone(s, o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  drawModalTitle(s, l, "shield", card.title, C.BLACK!);

  // The name, large, over the city that built it.
  drawStone(s, l.name.x, l.name.y, l.name.w, l.name.h, true);
  drawModalName(s, l.name, card.name, card.where, NAVY(), INK, false);

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
    // No picture of the user's yet (Barracks, Granary, the Great Library): the city view's drawn one, enlarged.
    const pic = PICTURES[id];
    const owner = state.cities.find((c) => c.id === view.city)?.owner ?? 0;
    if (pic) drawEnlarged(s, l.picture, rasterize(pic, slotColor(state.players[owner]!.color)), pic.w + 2, pic.h + 2);
  }

  // What it is, what it does for the city, and its upkeep along the bottom (no heading: the window is small).
  const { info } = l;
  parchment(s, info);
  const x = info.x + 6;
  let y = info.y + 4;
  for (const line of wrapText(card.text, BUILT_TEXT_W).slice(0, 3)) { drawText(s, x, y, line, INK); y += FONT_HEIGHT; }
  const upkeepY = info.y + info.h - 2 - FONT_HEIGHT;
  y += 2;
  s.hline(x - 1, y, info.w - 10, RULE());
  y += 2;
  const rows = Math.max(0, Math.floor((upkeepY - 1 - y) / (BOX + 1)));
  card.effects.slice(0, rows).forEach((e, i) => effect(s, x, y + i * (BOX + 1), e.icon, e.text));
  drawIcon(s, "coin", x, upkeepY);
  drawText(s, x + ICON + 3, upkeepY, card.upkeep ? `Upkeep ${card.upkeep} gold a turn` : "No upkeep", QUIET());

  l.buttons.forEach((b, i) => drawWindowButton(s, b, BUILT_BUTTONS[i]!, i === view.selected));
}
