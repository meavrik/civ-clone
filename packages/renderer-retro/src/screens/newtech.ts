import type { GameState } from "@civ/core";
import { NEW_TECH_BUTTONS, newTechCard, type NewTechHit, type NewTechView, type Unlock } from "@civ/renderer-api";
import { drawSpaced, drawText, drawTextLarge, FONT_HEIGHT, spacedWidth, textWidth, wrapText } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { unitSprite } from "../overlays.js";
import { shade, slotColor } from "../palette.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { drawStone, INK, speckle } from "../widgets.js";

/**
 * The New Technology window, after the user's template (2026-10-23): a navy title strip with the bulb
 * and a close box, the advance's name large over its era, the user's picture of it in a gold frame
 * (`NEW_TECH_PICTURE`: the apps lay the picture itself over the canvas there, as it is), beside
 * parchment panels saying what it is and what it unlocks, what it needed along the bottom, then the
 * buttons: View Tech Tree on the stone, Continue in gold.
 */

const TITLE = { x: 3, y: 3, w: SCREEN_W - 6, h: 13 };
const CLOSE = { x: TITLE.x + TITLE.w - 12, y: TITLE.y + 2, w: 9, h: 9 };
const NAME = { x: 5, y: 18, w: SCREEN_W - 10, h: 27 };
const FRAME = { x: 5, y: 47, w: 108, h: 108 };
/** Where the advance's picture goes (square, as the pictures are), inside its frame. */
export const NEW_TECH_PICTURE = { x: FRAME.x + 2, y: FRAME.y + 2, w: FRAME.w - 4, h: FRAME.h - 4 } as const;
const DESC = { x: 116, y: 47, w: SCREEN_W - 121, h: 41 };
/** How wide the description's lines may run (three of them fit). */
export const NEW_TECH_TEXT_W = DESC.w - 10;
const UNLOCKS = { x: 116, y: 90, w: SCREEN_W - 121, h: 65 };
const NEEDS = { x: 5, y: 158, w: SCREEN_W - 10, h: 24 };
const BUTTON = { y: 185, w: 112, h: 13 };
const HEAD_H = 10;
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

/** The buttons: View Tech Tree on the left, Continue on the right. */
function buttonRects(): { x: number; y: number; w: number; h: number }[] {
  return [
    { x: 9, y: BUTTON.y, w: BUTTON.w, h: BUTTON.h },
    { x: SCREEN_W - 9 - BUTTON.w, y: BUTTON.y, w: BUTTON.w, h: BUTTON.h },
  ];
}

/** What lies under a point: a button, the close box (a little round it counts too), or nothing. */
export function newTechHit(_view: NewTechView, px: number, py: number): NewTechHit | null {
  const i = buttonRects().findIndex((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h);
  if (i >= 0) return i === 0 ? "tree" : "continue";
  if (px >= CLOSE.x - 3 && px < CLOSE.x + CLOSE.w + 3 && py >= TITLE.y && py < TITLE.y + TITLE.h) return "close";
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

/** The unlocks, a row each with its name (and kind, in one column), in two columns when there are more than three. */
function drawUnlocks(s: Surface, unlocks: Unlock[], leads: boolean, owner: number): void {
  const top = UNLOCKS.y + HEAD_H + 3;
  const pitch = BOX + 1;
  const rows = Math.floor((UNLOCKS.y + UNLOCKS.h - 1 - top) / pitch);
  const cols = unlocks.length > rows ? 2 : 1;
  const colW = Math.floor((UNLOCKS.w - 8) / cols);
  const slots = rows * cols;
  const shown = unlocks.length > slots ? unlocks.slice(0, slots - 1) : unlocks;
  shown.forEach((u, i) => {
    const x = UNLOCKS.x + 4 + Math.floor(i / rows) * colW;
    const y = top + (i % rows) * pitch;
    itemBox(s, x, y, BOX, u.icon, u.unit, owner);
    const room = colW - BOX - 6;
    const name = fit(u.name, room);
    const end = drawText(s, x + BOX + 4, y + 4, name, BROWN());
    if (cols === 1 && !leads && end + 4 + textWidth(u.kind) <= x + BOX + 4 + room) drawText(s, end + 4, y + 4, u.kind, BROWN_DIM());
  });
  if (shown.length < unlocks.length) {
    const i = shown.length;
    drawText(s, UNLOCKS.x + 4 + Math.floor(i / rows) * colW + BOX + 4, top + (i % rows) * pitch + 4, `and ${unlocks.length - i} more`, BROWN_DIM());
  }
}

/** A raised button: the game's stone, or gold for the one that goes on; the lit one ringed in brown. */
function drawButton(s: Surface, b: { x: number; y: number; w: number; h: number }, label: string, gold: boolean, lit: boolean): void {
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

/** The window's frame: tan stone inside a brown and gold border, studs at the corners. */
function drawFrame(s: Surface): void {
  speckle(s, 0, 0, SCREEN_W, SCREEN_H, shade("earth", 6), shade("earth", 7), shade("hide", 6));
  s.frame(0, 0, SCREEN_W, SCREEN_H, BROWN());
  s.frame(1, 1, SCREEN_W - 2, SCREEN_H - 2, GOLD_LIGHT());
  s.frame(2, 2, SCREEN_W - 4, SCREEN_H - 4, GOLD_DARK());
  for (const [x, y] of [[0, 0], [SCREEN_W - 7, 0], [0, SCREEN_H - 7], [SCREEN_W - 7, SCREEN_H - 7]] as const) {
    s.rect(x, y, 7, 7, GOLD_LIGHT());
    s.frame(x, y, 7, 7, BROWN());
    s.frame(x + 2, y + 2, 3, 3, GOLD_DARK());
  }
}

export function drawNewTech(s: Surface, state: GameState, view: NewTechView): void {
  const card = newTechCard(state, view.advance);
  const owner = slotColor(state.players[state.currentPlayer]!.color);
  drawFrame(s);

  // The title strip: the bulb, NEW TECHNOLOGY in gold, the close box.
  s.rect(TITLE.x, TITLE.y, TITLE.w, TITLE.h, NAVY());
  s.frame(TITLE.x, TITLE.y, TITLE.w, TITLE.h, GOLD_DARK());
  drawIcon(s, "bulb", TITLE.x + 5, TITLE.y + 3);
  drawSpaced(s, SCREEN_W / 2, TITLE.y + 3, "New Technology", GOLD_INK());
  s.frame(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, GOLD_LIGHT());
  for (let i = 0; i < CLOSE.w - 4; i++) {
    s.set(CLOSE.x + 2 + i, CLOSE.y + 2 + i, GOLD_INK());
    s.set(CLOSE.x + CLOSE.w - 3 - i, CLOSE.y + 2 + i, GOLD_INK());
  }

  // The name, large, over its era between two gold rules.
  panel(s, NAME);
  s.frame(NAME.x + 1, NAME.y + 1, NAME.w - 2, NAME.h - 2, GOLD_LIGHT());
  const name = card.name.toUpperCase();
  const scale = textWidth(name) * 2 <= NAME.w - 12 ? 2 : 1;
  drawTextLarge(s, NAME.x + Math.floor((NAME.w - textWidth(name) * scale) / 2), NAME.y + 1 + (scale === 2 ? 0 : 4), name, BROWN(), scale);
  const eraW = spacedWidth(card.era);
  const mid = Math.floor(SCREEN_W / 2);
  drawSpaced(s, mid, NAME.y + 17, card.era, BROWN_DIM());
  for (const x of [mid - Math.ceil(eraW / 2) - 6 - 40, mid + Math.ceil(eraW / 2) + 6]) s.hline(x, NAME.y + 21, 40, GOLD_DARK());

  // The picture's frame and the bed beneath it (seen only until the picture has loaded).
  s.rect(FRAME.x, FRAME.y, FRAME.w, FRAME.h, GOLD_DARK());
  s.frame(FRAME.x + 1, FRAME.y + 1, FRAME.w - 2, FRAME.h - 2, GOLD_LIGHT());
  const p = NEW_TECH_PICTURE;
  s.rect(p.x, p.y, p.w, p.h, BED());
  drawIcon(s, "bulb", p.x + Math.floor((p.w - ICON) / 2), p.y + Math.floor((p.h - ICON) / 2));

  panel(s, DESC, "Description");
  wrapText(card.text, NEW_TECH_TEXT_W).slice(0, 3)
    .forEach((line, i) => drawText(s, DESC.x + 5, DESC.y + HEAD_H + 4 + i * FONT_HEIGHT, line, BROWN()));

  panel(s, UNLOCKS, card.leads ? "Leads to" : "Unlocks");
  drawUnlocks(s, card.unlocks, card.leads, owner);

  panel(s, NEEDS, "Prerequisites");
  const rowY = NEEDS.y + HEAD_H + 3;
  if (!card.needs.length) drawText(s, NEEDS.x + 8, rowY + 1, "None: one of the first discoveries", BROWN_DIM());
  card.needs.forEach((n, i) => {
    const x = NEEDS.x + 8 + i * Math.floor(NEEDS.w / 2);
    itemBox(s, x, rowY, 10, "bulb", undefined, owner);
    drawText(s, x + 14, rowY + 1, n.name, BROWN());
  });

  buttonRects().forEach((b, i) => drawButton(s, b, NEW_TECH_BUTTONS[i]!, i === 1, i === view.selected));
}
