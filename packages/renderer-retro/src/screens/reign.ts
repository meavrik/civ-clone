import type { GameState } from "@civ/core";
import { REIGN_BUTTON, reignCard, type ReignHit, type ReignView } from "@civ/renderer-api";
import { drawText, FONT_HEIGHT, wrapText } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, drawEntering, hideArtUnder } from "../widgets.js";
import { drawModalFrame, drawModalName, drawModalPanel, drawModalTitle, drawWindowButton, fitText } from "./newtech.js";
import { drawPortraitSky } from "./setup.js";

/**
 * The window a new game opens with over the map (asked for 2026-10-26, in place of a plain message with
 * the trait's line): the New Technology window's parchment and gold, a little larger. Under the title the
 * people's name large over their leader and the year; our leader's portrait in a gold frame ringed in the
 * civilization's colour (`reignPicture`: the apps lay the user's picture there, as it is, on the setup
 * cards' sky); beside it the people in a sentence and, under the trait's name, what the tribe brings, a
 * line each with its icon; Begin in gold. Centred on the screen it opens over.
 */

type Rect = { x: number; y: number; w: number; h: number };
const WIN = { w: 248, h: 151 };
/** The window centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function reignRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - WIN.w) / 2), y: Math.floor((SCREEN_H - WIN.h) / 2), ...WIN };
}
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
const HEAD_H = 10;
const BUTTON = { w: 108, h: 13 };
/** Where each part of the window stands, the window's top left at `o`. */
function layout(o: Rect) {
  const frame = at(o, 5, 47, 82, 82);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    name: at(o, 5, 18, o.w - 10, 27),
    frame,
    picture: { x: frame.x + 3, y: frame.y + 3, w: frame.w - 6, h: frame.h - 6 },
    desc: at(o, 90, 47, o.w - 95, 40),
    bonus: at(o, 90, 89, o.w - 95, 40),
    button: at(o, Math.floor((o.w - BUTTON.w) / 2), o.h - 18, BUTTON.w, BUTTON.h),
  };
}
/** Where the leader's portrait goes (square, as the portraits are), inside its frame, on a screen `screenW` wide. */
export function reignPicture(screenW = SCREEN_W): Rect {
  return layout(reignRect(screenW)).picture;
}
/** How wide the description's lines may run (three of them fit). */
export const REIGN_TEXT_W = WIN.w - 95 - 10;
/** How wide a bonus may run beside its icon. */
export const REIGN_BONUS_W = WIN.w - 95 - 5 - ICON - 3 - 5;
/** Lines the bonuses' panel holds. */
export const REIGN_BONUS_ROWS = 3;

const GOLD_DARK = () => shade("wheat", 0);
const GOLD_LIGHT = () => shade("wheat", 4);
const BROWN = () => shade("hide", 0);
const BROWN_DIM = () => shade("hide", 3);

/** What lies under a point: Begin, the close box (a little round it counts too), or nothing. */
export function reignHit(_view: ReignView, px: number, py: number, screenW = SCREEN_W): ReignHit | null {
  const l = layout(reignRect(screenW));
  const b = l.button;
  if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return "begin";
  if (px >= l.close.x - 3 && px < l.close.x + l.close.w + 3 && py >= l.title.y && py < l.title.y + l.title.h) return "close";
  return null;
}

export function drawReign(s: Surface, state: GameState, view: ReignView): void {
  dimScreen(s);
  const enter = view.enter ?? 1;
  if (enter < 1) { drawEntering(s, enter, reignRect(s.width), (t) => drawReignNow(t, state)); return; }
  drawReignNow(s, state);
}

function drawReignNow(s: Surface, state: GameState): void {
  const card = reignCard(state);
  const o = reignRect(s.width);
  const l = layout(o);
  hideArtUnder(s, o);
  drawModalFrame(s, o);
  drawModalTitle(s, l, "crown", "A New Civilization");

  // The people's name, large, over their leader and the year between two gold rules.
  drawModalPanel(s, l.name);
  s.frame(l.name.x + 1, l.name.y + 1, l.name.w - 2, l.name.h - 2, GOLD_LIGHT());
  drawModalName(s, l.name, card.name, card.under, BROWN(), BROWN_DIM(), true);

  // The portrait's gold frame, ringed inside in the civilization's colour, and the sky it stands on.
  const { frame, picture: p } = l;
  s.rect(frame.x, frame.y, frame.w, frame.h, GOLD_DARK());
  s.frame(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, GOLD_LIGHT());
  s.frame(p.x - 1, p.y - 1, p.w + 2, p.h + 2, slotColor(card.band));
  drawPortraitSky(s, p);

  // The people in a sentence.
  drawModalPanel(s, l.desc, "The People");
  wrapText(card.text, REIGN_TEXT_W).slice(0, 3).forEach((line, i) => drawText(s, l.desc.x + 5, l.desc.y + HEAD_H + 3 + i * FONT_HEIGHT, line, BROWN()));

  // What the tribe brings, under its trait's name: a line each with its icon, a long one running on below.
  drawModalPanel(s, l.bonus, card.trait ?? "Bonuses");
  const x = l.bonus.x + 5;
  let row = 0;
  for (const b of card.bonuses) {
    const lines = wrapText(b.text, REIGN_BONUS_W);
    lines.forEach((line, i) => {
      if (row >= REIGN_BONUS_ROWS) return;
      const y = l.bonus.y + HEAD_H + 2 + row * (FONT_HEIGHT + 1);
      if (i === 0) drawIcon(s, b.icon, x, y);
      const last = row === REIGN_BONUS_ROWS - 1 && i < lines.length - 1;
      drawText(s, x + ICON + 3, y, last ? fitText(`${line} ${lines.slice(i + 1).join(" ")}`, REIGN_BONUS_W) : line, BROWN());
      row++;
    });
  }

  drawWindowButton(s, l.button, REIGN_BUTTON, true);
}
