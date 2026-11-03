import type { GameState } from "@civ/core";
import { advanceInfo, type AdvanceInfoHit, type AdvanceInfoView } from "@civ/renderer-api";
import { drawText, drawTextWrapped, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, drawEntering, drawSmallPicture, hideArtUnder } from "../widgets.js";
import { drawModalFrame, drawModalPanel, drawModalTitle, fitText } from "./newtech.js";

/**
 * The window of more about an advance, opened by the info mark of its row in the research list (asked for
 * 2026-11-03: "a more info icon to show a new window with description, historical context and full unlocks and next
 * tech possible"), in the New Technology window's parchment and gold: the advance's name in the title strip, the
 * user's picture of it in a gold frame (`advanceInfoPicture`: the apps lay it there) beside what it is, its era,
 * what it needs and where it stands for us; its history; all it unlocks, each with its small picture; and the
 * advances it leads to, each with what else it waits for. The close box, Esc, Enter or a click off it go back.
 */

type Rect = { x: number; y: number; w: number; h: number };
const W = 288;
const H = 184;
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });

export function advanceInfoRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - W) / 2), y: Math.floor((SCREEN_H - H) / 2), w: W, h: H };
}

function layout(o: Rect) {
  const frame = at(o, 5, 19, 60, 60);
  return {
    title: at(o, 3, 3, W - 6, 13),
    close: at(o, W - 15, 5, 9, 9),
    frame,
    picture: { x: frame.x + 2, y: frame.y + 2, w: frame.w - 4, h: frame.h - 4 },
    desc: at(o, 68, 19, W - 73, 60),
    history: at(o, 5, 82, W - 10, 42),
    unlocks: at(o, 5, 127, 170, 52),
    leads: at(o, 178, 127, W - 183, 52),
  };
}

/** Where the advance's picture goes, inside its frame, on a screen `screenW` wide. */
export function advanceInfoPicture(screenW = SCREEN_W): Rect {
  return layout(advanceInfoRect(screenW)).picture;
}

/** The text in a panel starts under its heading strip. */
const TEXT_TOP = 13;
/** A line of what it unlocks: its picture this big, the words after it. */
const PIC_W = 14;
const PIC_H = 12;

// The New Technology window's colours.
const GOLD_DARK = () => shade("wheat", 0);
const GOLD_LIGHT = () => shade("wheat", 4);
const BROWN = () => shade("hide", 0);
const BROWN_DIM = () => shade("hide", 3);
const BED = () => shade("town", 1);
const NAVY_INK = () => shade("azure", 1);

/** The close box (a little round it counts too) or any point off the window: both go back. */
export function advanceInfoHit(_view: AdvanceInfoView, px: number, py: number, screenW = SCREEN_W): AdvanceInfoHit | null {
  const o = advanceInfoRect(screenW);
  const l = layout(o);
  if (px >= l.close.x - 3 && px < l.close.x + l.close.w + 3 && py >= l.title.y && py < l.title.y + l.title.h) return "close";
  return px < o.x || px >= o.x + o.w || py < o.y || py >= o.y + o.h ? "close" : null;
}

export function drawAdvanceInfo(s: Surface, state: GameState, view: AdvanceInfoView): void {
  dimScreen(s);
  const enter = view.enter ?? 1;
  if (enter < 1) { drawEntering(s, enter, advanceInfoRect(s.width), (t) => drawNow(t, state, view)); return; }
  drawNow(s, state, view);
}

function drawNow(s: Surface, state: GameState, view: AdvanceInfoView): void {
  const info = advanceInfo(state, view.advance);
  const o = advanceInfoRect(s.width);
  const l = layout(o);
  hideArtUnder(s, o);
  drawModalFrame(s, o);
  drawModalTitle(s, l, "bulb", info.name);

  // The picture's gold frame and the bed under it (seen only until the picture has loaded).
  const { frame, picture: p } = l;
  s.rect(frame.x, frame.y, frame.w, frame.h, GOLD_DARK());
  s.frame(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, GOLD_LIGHT());
  s.rect(p.x, p.y, p.w, p.h, BED());

  // What it is, then its era and what it needs, then where it stands for us.
  const d = l.desc;
  drawModalPanel(s, d, "Description");
  const tw = d.w - 10;
  const lines = wrapText(info.text, tw).slice(0, 3);
  lines.forEach((line, i) => drawText(s, d.x + 5, d.y + TEXT_TOP + i * FONT_HEIGHT, line, BROWN()));
  const ty = d.y + TEXT_TOP + lines.length * FONT_HEIGHT + 2;
  drawText(s, d.x + 5, ty, fitText(`${info.era}. ${info.needs}.`, tw), BROWN_DIM());
  drawText(s, d.x + 5, ty + FONT_HEIGHT, fitText(info.standing, tw), NAVY_INK());

  drawModalPanel(s, l.history, "History");
  drawTextWrapped(s, l.history.x + 5, l.history.y + TEXT_TOP, l.history.w - 10, info.history, BROWN(), 3);

  drawModalPanel(s, l.unlocks, "Unlocks");
  drawUnlocks(s, l.unlocks, info.unlocks);

  drawModalPanel(s, l.leads, "Leads to");
  drawLeads(s, l.leads, info.leads);
}

/**
 * All it unlocks, a line each with its small picture: in one column, a long line wrapping onto the next; with more
 * than three, in two columns, each line cut to its column.
 */
function drawUnlocks(s: Surface, b: Rect, unlocks: ReturnType<typeof advanceInfo>["unlocks"]): void {
  const x0 = b.x + 5;
  const top = b.y + TEXT_TOP;
  const bottom = b.y + b.h - 3;
  if (!unlocks.length) { drawText(s, x0, top + 2, "Nothing of its own", BROWN_DIM()); return; }
  if (unlocks.length <= 3) {
    let y = top;
    unlocks.forEach((u, i) => {
      // Lines it may take, leaving a line for each still to come.
      const room = Math.floor((bottom - y - 2 - (unlocks.length - i - 1) * PIC_H) / FONT_HEIGHT);
      if (room < 1) return;
      drawSmallPicture(s, u.picture, x0, y, PIC_W, PIC_H);
      const n = drawTextWrapped(s, x0 + PIC_W + 3, y + 2, b.w - 10 - PIC_W - 3, u.text, BROWN(), room);
      y += Math.max(PIC_H, 2 + n * FONT_HEIGHT + 1);
    });
    return;
  }
  const colW = Math.floor((b.w - 10) / 2);
  const rows = Math.floor((bottom - top) / PIC_H);
  const cells = rows * 2;
  const shown = unlocks.length > cells ? unlocks.slice(0, cells - 1) : unlocks;
  shown.forEach((u, i) => {
    const x = x0 + Math.floor(i / rows) * colW;
    const y = top + (i % rows) * PIC_H;
    drawSmallPicture(s, u.picture, x, y, PIC_W, PIC_H);
    drawText(s, x + PIC_W + 3, y + 2, fitText(u.text, colW - PIC_W - 5), BROWN());
  });
  if (shown.length < unlocks.length) {
    const i = shown.length;
    drawText(s, x0 + Math.floor(i / rows) * colW + PIC_W + 3, top + (i % rows) * PIC_H + 2, `and ${unlocks.length - i} more`, BROWN_DIM());
  }
}

/** How many lines the "Leads to" panel holds. */
export const LEADS_ROWS = 4;

/**
 * The advances it leads to, a line each with what else each waits for after it in dim ink; more than the panel's
 * lines hold, their names as one list wrapping over them.
 */
function drawLeads(s: Surface, b: Rect, leads: ReturnType<typeof advanceInfo>["leads"]): void {
  const x0 = b.x + 5;
  const w = b.w - 10;
  const top = b.y + TEXT_TOP;
  if (!leads.length) { drawText(s, x0, top, "Nothing further", BROWN_DIM()); return; }
  if (leads.length > LEADS_ROWS) {
    drawTextWrapped(s, x0, top, w, leads.map((l) => l.name).join(", "), BROWN(), LEADS_ROWS);
    return;
  }
  leads.forEach((lead, i) => {
    const y = top + i * (FONT_HEIGHT + 1);
    const name = fitText(lead.name, w);
    drawText(s, x0, y, name, BROWN());
    const room = w - textWidth(name) - 4;
    if (lead.also && room > 16) drawText(s, x0 + textWidth(name) + 4, y, fitText(lead.also, room), BROWN_DIM());
  });
}

/** How wide the "Leads to" panel's lines run. */
export const LEADS_TEXT_W = W - 183 - 10;
