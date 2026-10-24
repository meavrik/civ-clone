import type { GameState } from "@civ/core";
import { NEW_TECH_BUTTONS, newTechCard, type IconName, type NewTechHit, type NewTechView, type Unlock } from "@civ/renderer-api";
import { drawSpaced, drawText, drawTextLarge, drawTextWrapped, FONT_HEIGHT, spacedWidth, textWidth, wrapText } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { unitSprite } from "../overlays.js";
import { C, shade, slotColor } from "../palette.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { drawEntering, drawStone, INK, speckle } from "../widgets.js";

/**
 * The New Technology window, after the user's template (2026-10-23), made a small window over the game
 * (asked for 2026-10-24: "should be a modal opened on top of the game and not a full screen window"):
 * a navy title strip with the bulb and a close box, the advance's name large over its era, the user's
 * picture of it in a gold frame (`newTechPicture`: the apps lay the picture itself over the canvas there,
 * as it is), beside parchment panels saying what it is (and what it needed) and what it unlocks, then
 * the buttons: View Tech Tree on the stone, Continue in gold. Centred on the screen it opens over.
 */

type Rect = { x: number; y: number; w: number; h: number };
/** The window's size: the Building Completed window shares it (`modalRect`). */
const MODAL = { w: 236, h: 147 };
/** A small window centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function modalRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - MODAL.w) / 2), y: Math.floor((SCREEN_H - MODAL.h) / 2), ...MODAL };
}
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
const HEAD_H = 10;
/** Where each part of the window stands, the window's top left at `o`. */
function layout(o: Rect) {
  const frame = at(o, 5, 47, 78, 78);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    name: at(o, 5, 18, o.w - 10, 27),
    frame,
    picture: { x: frame.x + 2, y: frame.y + 2, w: frame.w - 4, h: frame.h - 4 },
    desc: at(o, 86, 47, o.w - 91, 43),
    unlocks: at(o, 86, 92, o.w - 91, 33),
    buttons: [at(o, 6, 129, 108, 13), at(o, o.w - 6 - 108, 129, 108, 13)],
  };
}
/** Where the advance's picture goes (square, as the pictures are), inside its frame, on a screen `screenW` wide. */
export function newTechPicture(screenW = SCREEN_W): Rect {
  return layout(modalRect(screenW)).picture;
}
/** How wide the description's lines may run (three of them fit). */
export const NEW_TECH_TEXT_W = MODAL.w - 91 - 10;
/** An unlock's box: as big as a unit standing in it. */
const BOX = 16;

// Colours, all from the palette's ramps: the template's navy, gold, parchment and brown ink.
const NAVY = () => shade("azure", 0);
const GOLD_DARK = () => shade("wheat", 0);
const GOLD_LIGHT = () => shade("wheat", 4);
const GOLD_INK = () => shade("wheat", 6);
const PARCHMENT = () => shade("hide", 7);
const STRIP = () => shade("hide", 6);
const BROWN = () => shade("hide", 0);
const BROWN_DIM = () => shade("hide", 3);
const BED = () => shade("town", 1);

/** What lies under a point: a button (View Tech Tree on the left, Continue on the right), the close box (a little round it counts too), or nothing. */
export function newTechHit(_view: NewTechView, px: number, py: number, screenW = SCREEN_W): NewTechHit | null {
  return modalHit(layout(modalRect(screenW)), px, py, "tree");
}

/** The hit test both small windows share: the first button, Continue, or the close box. */
export function modalHit<F extends string>(l: { title: Rect; close: Rect; buttons: Rect[] }, px: number, py: number, first: F): F | "continue" | "close" | null {
  const i = l.buttons.findIndex((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h);
  if (i >= 0) return i === 0 ? first : "continue";
  if (px >= l.close.x - 3 && px < l.close.x + l.close.w + 3 && py >= l.title.y && py < l.title.y + l.title.h) return "close";
  return null;
}

/** A parchment panel in a thin gold frame, a heading strip across its top when it has one. */
function panel(s: Surface, b: { x: number; y: number; w: number; h: number }, heading?: string): void {
  s.frame(b.x, b.y, b.w, b.h, GOLD_DARK());
  speckle(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, STRIP(), PARCHMENT(), PARCHMENT());
  if (!heading) return;
  s.rect(b.x + 1, b.y + 1, b.w - 2, HEAD_H, STRIP());
  s.hline(b.x + 1, b.y + 1 + HEAD_H, b.w - 2, GOLD_DARK());
  // A small gold stud at either end of the strip.
  for (const x of [b.x + 3, b.x + b.w - 6]) {
    s.rect(x, b.y + 4, 3, 3, GOLD_LIGHT());
    s.frame(x, b.y + 4, 3, 3, GOLD_DARK());
  }
  const w = spacedWidth(heading);
  drawSpaced(s, b.x + 9 + Math.floor(w / 2), b.y + 2, heading, BROWN());
}

/** Text cut to a width, with a full stop where it was cut. */
function fit(text: string, w: number): string {
  if (textWidth(text) <= w) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}.`) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}.`;
}

/** A small sunken box with what it holds: a unit standing in it, else the icon of its kind. */
function itemBox(s: Surface, x: number, y: number, size: number, icon: Unlock["icon"], unit: string | undefined, owner: number): void {
  s.frame(x, y, size, size, BROWN_DIM());
  s.rect(x + 1, y + 1, size - 2, size - 2, shade("earth", 7));
  if (unit) s.blit(unitSprite(unit, owner), x, y, SPRITE_CLEAR);
  else drawIcon(s, icon, x + Math.floor((size - ICON) / 2), y + Math.floor((size - ICON) / 2));
}

/**
 * The unlocks in their panel: one or two side by side, each in its box with its name (and kind, when
 * alone); more than two named in a line or two of text (the research panel shows them whole).
 */
function drawUnlocks(s: Surface, panelRect: Rect, unlocks: Unlock[], leads: boolean, owner: number): void {
  const top = panelRect.y + HEAD_H + 3;
  const x0 = panelRect.x + 4;
  if (unlocks.length > 2) {
    drawTextWrapped(s, x0 + 1, top, panelRect.w - 10, unlocks.map((u) => u.name).join(", "), BROWN(), 2);
    return;
  }
  const colW = Math.floor((panelRect.w - 8) / Math.max(1, unlocks.length));
  unlocks.forEach((u, i) => {
    const x = x0 + i * colW;
    itemBox(s, x, top, BOX, u.icon, u.unit, owner);
    const room = colW - BOX - 6;
    const end = drawText(s, x + BOX + 4, top + 4, fit(u.name, room), BROWN());
    if (unlocks.length === 1 && !leads && end + 4 + textWidth(u.kind) <= x + BOX + 4 + room) drawText(s, end + 4, top + 4, u.kind, BROWN_DIM());
  });
}

/** A raised button: the game's stone, or gold for the one that goes on; the lit one ringed in brown (the Building Completed window's too). */
export function drawWindowButton(s: Surface, b: { x: number; y: number; w: number; h: number }, label: string, gold: boolean, lit: boolean): void {
  if (lit) s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, BROWN());
  if (gold) {
    speckle(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, shade("wheat", 3), shade("wheat", 5), shade("wheat", 6));
    s.hline(b.x, b.y, b.w, shade("wheat", 7));
    s.vline(b.x, b.y, b.h, shade("wheat", 7));
    s.hline(b.x + 1, b.y + b.h - 1, b.w - 1, shade("dune", 0));
    s.vline(b.x + b.w - 1, b.y + 1, b.h - 1, shade("dune", 0));
  } else drawStone(s, b.x, b.y, b.w, b.h);
  drawSpaced(s, b.x + Math.floor(b.w / 2), b.y + 3, label, gold ? BROWN() : INK);
}

/** The window's frame: tan stone inside a brown and gold border, studs at the corners, a shadow under it on the game. */
function drawFrame(s: Surface, o: Rect): void {
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  speckle(s, o.x, o.y, o.w, o.h, shade("earth", 6), shade("earth", 7), shade("hide", 6));
  s.frame(o.x, o.y, o.w, o.h, BROWN());
  s.frame(o.x + 1, o.y + 1, o.w - 2, o.h - 2, GOLD_LIGHT());
  s.frame(o.x + 2, o.y + 2, o.w - 4, o.h - 4, GOLD_DARK());
  for (const [x, y] of [[o.x, o.y], [o.x + o.w - 7, o.y], [o.x, o.y + o.h - 7], [o.x + o.w - 7, o.y + o.h - 7]] as const) {
    s.rect(x, y, 7, 7, GOLD_LIGHT());
    s.frame(x, y, 7, 7, BROWN());
    s.frame(x + 2, y + 2, 3, 3, GOLD_DARK());
  }
}

/** A window's navy title strip: an icon, the title spaced in gold, and the close box. */
export function drawModalTitle(s: Surface, l: { title: Rect; close: Rect }, icon: IconName, title: string, edge = GOLD_DARK()): void {
  const { title: t, close } = l;
  s.rect(t.x, t.y, t.w, t.h, NAVY());
  s.frame(t.x, t.y, t.w, t.h, edge);
  drawIcon(s, icon, t.x + 5, t.y + 3);
  drawSpaced(s, t.x + Math.floor(t.w / 2), t.y + 3, title, GOLD_INK());
  s.frame(close.x, close.y, close.w, close.h, GOLD_LIGHT());
  for (let i = 0; i < close.w - 4; i++) {
    s.set(close.x + 2 + i, close.y + 2 + i, GOLD_INK());
    s.set(close.x + close.w - 3 - i, close.y + 2 + i, GOLD_INK());
  }
}

/** The name large over a smaller line (an era, a city), in a sunken panel across the window. */
export function drawModalName(s: Surface, b: Rect, name: string, under: string, ink: number, underInk: number, spaced: boolean): void {
  const big = name.toUpperCase();
  const scale = textWidth(big) * 2 <= b.w - 12 ? 2 : 1;
  drawTextLarge(s, b.x + Math.floor((b.w - textWidth(big) * scale) / 2), b.y + 1 + (scale === 2 ? 0 : 4), big, ink, scale);
  const mid = b.x + Math.floor(b.w / 2);
  if (!spaced) { drawText(s, mid - Math.floor(textWidth(under) / 2), b.y + 17, under, underInk); return; }
  const w = spacedWidth(under);
  drawSpaced(s, mid, b.y + 17, under, underInk);
  for (const x of [mid - Math.ceil(w / 2) - 6 - 30, mid + Math.ceil(w / 2) + 6]) s.hline(x, b.y + 21, 30, GOLD_DARK());
}

export function drawNewTech(s: Surface, state: GameState, view: NewTechView): void {
  const enter = view.enter ?? 1;
  if (enter < 1) { drawEntering(s, enter, modalRect(s.width), (t) => drawNewTechNow(t, state, view)); return; }
  drawNewTechNow(s, state, view);
}

function drawNewTechNow(s: Surface, state: GameState, view: NewTechView): void {
  const card = newTechCard(state, view.advance);
  const owner = slotColor(state.players[state.currentPlayer]!.color);
  const o = modalRect(s.width);
  const l = layout(o);
  drawFrame(s, o);
  drawModalTitle(s, l, "bulb", "New Technology");

  // The name, large, over its era between two gold rules.
  panel(s, l.name);
  s.frame(l.name.x + 1, l.name.y + 1, l.name.w - 2, l.name.h - 2, GOLD_LIGHT());
  drawModalName(s, l.name, card.name, card.era, BROWN(), BROWN_DIM(), true);

  // The picture's frame and the bed beneath it (seen only until the picture has loaded).
  const { frame, picture: p } = l;
  s.rect(frame.x, frame.y, frame.w, frame.h, GOLD_DARK());
  s.frame(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, GOLD_LIGHT());
  s.rect(p.x, p.y, p.w, p.h, BED());
  drawIcon(s, "bulb", p.x + Math.floor((p.w - ICON) / 2), p.y + Math.floor((p.h - ICON) / 2));

  // What it is, and what it needed, in a line under that.
  panel(s, l.desc, "Description");
  const lines = wrapText(card.text, NEW_TECH_TEXT_W).slice(0, 3);
  lines.forEach((line, i) => drawText(s, l.desc.x + 5, l.desc.y + HEAD_H + 3 + i * FONT_HEIGHT, line, BROWN()));
  const needs = card.needs.length ? `Needs ${card.needs.map((n) => n.name).join(", ")}` : "One of the first discoveries";
  if (lines.length < 3) drawText(s, l.desc.x + 5, l.desc.y + HEAD_H + 3 + lines.length * FONT_HEIGHT, fit(needs, NEW_TECH_TEXT_W), BROWN_DIM());

  panel(s, l.unlocks, card.leads ? "Leads to" : "Unlocks");
  drawUnlocks(s, l.unlocks, card.unlocks, card.leads, owner);

  l.buttons.forEach((b, i) => drawWindowButton(s, b, NEW_TECH_BUTTONS[i]!, i === 1, i === view.selected));
}
