import type { GameState } from "@civ/core";
import { AUDIENCE_CHOICES, leaderTitle, MOOD_WORDS, realmName, type CardSection, type DiplomacyView, type LeaderMood } from "@civ/renderer-api";
import { drawSpaced, drawText, FONT_HEIGHT, spacedWidth, textWidth, wrapText } from "../font.js";
import { drawIconLine, iconLineWidth, wrapIcons } from "../icons.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, hideArtUnder, drawCloseBox, drawEntering, drawStone, DIM, INK, litStone, TITLE_H } from "../widgets.js";

/**
 * The audience with a foreign leader, after the user's mock-up (2026-10-22), as a window over the map
 * since 2026-10-24 (asked for: "all screen windows should be a modal style and not take 100% of the
 * screen", the encounter and diplomacy window named): the game darkened behind it, the realm's name in
 * gold on a navy title strip with a close box (Esc: back a screen, or farewell), room on the stone for
 * the user's picture of the leader in their palace (`audiencePicture`: the apps lay the picture itself
 * over the canvas there, as it is, since the palette cannot hold it; beneath, a dusk sky), then a navy
 * panel with the leader's name and their words, and our choices as up to four of the game's stone
 * buttons. A civilization's card (`DiplomacyView.card`) shows the leader's portrait at the left
 * (`cardPicture`) with the card's sections beside it (since 2026-10-29, asked for: "split to sections of
 * civ stats etc. improve content design": each a heading ruled across in the stone's dim ink over its rows
 * of icons and words), the line and its one row of buttons lower down to give them room. The window grows
 * into place like the others (`enter`).
 */

type Rect = { x: number; y: number; w: number; h: number };
const WIN = { w: 264, h: 186 };
const BUTTON_H = 13;
const BUTTON_W = 120;
const BUTTON_GAP = 8;

/** The window, centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function audienceRect(screenW = SCREEN_W): Rect {
  return { x: Math.floor((screenW - WIN.w) / 2), y: Math.floor((SCREEN_H - WIN.h) / 2), ...WIN };
}
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });

/**
 * Where each part of the window stands, the window's top left at `o`. A card with no more than two choices
 * (`low`) has the line and its one row of buttons lower down, the room above for its sections.
 */
function layout(o: Rect, low = false) {
  const panelY = low ? 140 : 125;
  return {
    title: at(o, 2, 2, o.w - 4, TITLE_H),
    close: { x: o.x + o.w - 3 - (TITLE_H - 2), y: o.y + 3, w: TITLE_H - 2, h: TITLE_H - 2 },
    /** The leader's picture (16 by 9, as the pictures are), in the middle under the title. */
    scene: at(o, 36, 15, 192, 108),
    /** The leader's portrait on a civilization's card, at the left; the card's lines beside it. */
    portrait: at(o, 8, 15, 94, 118),
    cardText: at(o, 110, 15, o.w - 116, panelY - 17),
    panel: at(o, 2, panelY, o.w - 4, 27),
    rows: low ? [o.y + 169, o.y + 169] : [o.y + 154, o.y + 169],
  };
}

/** Whether a view lays its line and buttons low: a card with no more than two choices. */
const lowFor = (view: DiplomacyView): boolean => view.card !== undefined && (view.choices?.length ?? 0) <= 2;

/** Where the leader's picture goes, on a screen `screenW` wide. */
export function audiencePicture(screenW = SCREEN_W): Rect {
  return layout(audienceRect(screenW)).scene;
}

/** Where the leader's portrait goes on a civilization's card, on a screen `screenW` wide. */
export function cardPicture(screenW = SCREEN_W): Rect {
  return layout(audienceRect(screenW)).portrait;
}

const NAVY = () => shade("azure", 0);
const GOLD_INK = () => shade("wheat", 6);

/**
 * The window's colours by the leader's mood (asked for 2026-10-24, "indication for the leader mood,
 * like frame or background colour"): the title strip and the panel are filled with it, the picture
 * is framed in a lighter shade, and the mood's word stands at the strip's left in its light ink.
 * Deep green for a friendly leader, amber for a wary one, dark red for a hostile one; navy with no mood.
 */
function moodColours(mood: LeaderMood | undefined): { fill: number; frame: number; ink: number } {
  switch (mood) {
    case "friendly": return { fill: shade("leaf", 2), frame: shade("leaf", 5), ink: shade("leaf", 7) };
    case "wary": return { fill: shade("hide", 2), frame: shade("hide", 5), ink: shade("hide", 6) };
    case "hostile": return { fill: shade("brick", 1), frame: shade("brick", 4), ink: shade("brick", 6) };
    default: return { fill: NAVY(), frame: shade("panel", 1), ink: GOLD_INK() };
  }
}

/** A box framed in stone: lit along the top and left, shaded along the bottom and right, `fill` inside. */
function framed(s: Surface, b: Rect, fill: number): void {
  s.rect(b.x, b.y, b.w, b.h, shade("panel", 3));
  s.hline(b.x, b.y, b.w, shade("panel", 6));
  s.vline(b.x, b.y, b.h, shade("panel", 6));
  s.hline(b.x, b.y + b.h - 1, b.w, shade("panel", 1));
  s.vline(b.x + b.w - 1, b.y, b.h, shade("panel", 1));
  s.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, fill);
}

/** Where each of `n` choices sits in the window: one row for one or two, two rows for three or four. */
function buttonRects(o: Rect, n: number, low = false): Rect[] {
  const l = layout(o, low);
  const left = o.x + Math.floor((o.w - (2 * BUTTON_W + BUTTON_GAP)) / 2);
  const out: Rect[] = [];
  for (let i = 0; i < Math.min(n, AUDIENCE_CHOICES); i++) {
    const row = Math.floor(i / 2);
    const inRow = Math.min(2, n - row * 2);
    const x = inRow === 1 ? o.x + Math.floor((o.w - BUTTON_W) / 2) : left + (i % 2) * (BUTTON_W + BUTTON_GAP);
    out.push({ x, y: l.rows[n <= 2 ? 0 : row]!, w: BUTTON_W, h: BUTTON_H });
  }
  return out;
}

const inRect = (b: Rect, px: number, py: number) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

/** The choice under a point, or -1. */
export function diplomacyChoiceAt(view: DiplomacyView, px: number, py: number, screenW = SCREEN_W): number {
  return buttonRects(audienceRect(screenW), view.choices?.length ?? 0, lowFor(view)).findIndex((b) => inRect(b, px, py));
}

/** Whether a point lies on the window's close box (a little round it counts too). */
export function diplomacyCloseAt(px: number, py: number, screenW = SCREEN_W): boolean {
  const l = layout(audienceRect(screenW));
  return px >= l.close.x - 3 && px < l.close.x + l.close.w + 3 && py >= l.title.y && py < l.title.y + l.title.h;
}

export function drawDiplomacyScreen(s: Surface, state: GameState, view: DiplomacyView): void {
  dimScreen(s);
  const enter = view.enter ?? 1;
  if (enter < 1) { drawEntering(s, enter, audienceRect(s.width), (t) => drawNow(t, state, view)); return; }
  drawNow(s, state, view);
}

function drawNow(s: Surface, state: GameState, view: DiplomacyView): void {
  const o = audienceRect(s.width);
  const low = lowFor(view);
  const l = layout(o, low);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  s.frame(o.x, o.y, o.w, o.h, C.BLACK!);
  hideArtUnder(s, o);
  drawStone(s, o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  // The realm's name in gold on the mood's colour, the mood's word at the strip's left, the close box at its end.
  const m = moodColours(view.mood);
  s.rect(l.title.x, l.title.y, l.title.w, l.title.h, m.fill);
  let left = l.title.x + 4;
  if (view.mood) {
    const word = MOOD_WORDS[view.mood].toUpperCase();
    const w = spacedWidth(word);
    drawSpaced(s, left + Math.ceil(w / 2), l.title.y + 2, word, m.ink);
    left += w + 6;
  }
  drawSpaced(s, Math.floor((left + l.close.x - 4) / 2), l.title.y + 2, realmName(state, view.player), GOLD_INK());
  drawCloseBox(s, l.close.x, l.close.y);
  if (view.card) drawCard(s, l, view.card, m.fill);
  else drawScene(s, l.scene, m.frame);
  framed(s, l.panel, m.fill);
  const lines = wrapText(view.line, l.panel.w - 16).slice(0, 2);
  if (view.card) lines.forEach((t, i) => drawText(s, o.x + Math.floor((o.w - textWidth(t)) / 2), l.panel.y + 6 + i * FONT_HEIGHT, t, C.WHITE!));
  else {
    drawSpaced(s, o.x + o.w / 2, l.panel.y + 3, leaderTitle(state, view.player), GOLD_INK());
    lines.forEach((t, i) => drawText(s, o.x + Math.floor((o.w - textWidth(t)) / 2), l.panel.y + 11 + i * FONT_HEIGHT, t, C.WHITE!));
  }
  const choices = view.choices ?? [];
  buttonRects(o, choices.length, low).forEach((b, i) => drawChoice(s, b, choices[i]!, i === (view.selected ?? 0)));
}

/**
 * A civilization's card: a sunken frame (in the mood's colour) for the leader's portrait (a dusk sky
 * beneath, seen until it loads), its sections beside it, each a heading ruled across in dim ink over its
 * rows, as many as fit.
 */
function drawCard(s: Surface, l: ReturnType<typeof layout>, sections: CardSection[], frame: number): void {
  const p = l.portrait;
  framed(s, { x: p.x - 2, y: p.y - 2, w: p.w + 4, h: p.h + 4 }, frame);
  sky(s, p);
  const { x, w } = l.cardText;
  const bottom = l.cardText.y + l.cardText.h;
  let y = l.cardText.y;
  sections.forEach((sec, i) => {
    if (i) y += 3;
    if (y + 2 * FONT_HEIGHT > bottom) return;
    drawText(s, x, y, sec.title, DIM);
    const end = x + textWidth(sec.title) + 3;
    if (end < x + w) s.hline(end, y + 4, x + w - end, shade("panel", 2));
    y += FONT_HEIGHT + 1;
    for (const row of sec.lines.flatMap((line) => cardRows(line, w - 3))) {
      if (y + FONT_HEIGHT > bottom) return;
      drawIconLine(s, x + 3 + row.indent, y, row.text, INK);
      y += FONT_HEIGHT;
    }
  });
}

/**
 * A card line as the rows it takes: a line that opens with an icon and goes on in words wraps its words
 * under themselves, clear of the icon; any other wraps as icon lines do (`wrapIcons`).
 */
function cardRows(line: string, w: number): { text: string; indent: number }[] {
  const lead = /^(\{\w+\} )([^{]*)$/.exec(line);
  if (!lead) return wrapIcons(line, w).map((text) => ({ text, indent: 0 }));
  const indent = iconLineWidth(lead[1]!);
  return wrapText(lead[2]!, w - indent).map((text, i) => (i ? { text, indent } : { text: lead[1]! + text, indent: 0 }));
}

/** The leader's picture's place: a frame two pixels thick in the mood's colour round a dusk sky (seen only until the picture has loaded). */
function drawScene(s: Surface, b: Rect, frame: number): void {
  s.frame(b.x - 2, b.y - 2, b.w + 4, b.h + 4, frame);
  s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, frame);
  sky(s, b);
}

/** A dusk sky, dithered from navy to blue down the box. */
function sky(s: Surface, b: Rect): void {
  const k = s.k;
  for (let fy = 0; fy < b.h * k; fy++) {
    const f = (fy / (b.h * k)) * 3;
    for (let fx = 0; fx < b.w * k; fx++) s.fset(b.x * k + fx, b.y * k + fy, shade("azure", Math.floor(f + ((fx + fy) % 2) * 0.5)));
  }
}

/** A choice: the game's stone, raised, its words in ink; the lit one warmed as every lit button is (`litStone`). */
function drawChoice(s: Surface, b: Rect, label: string, lit: boolean): void {
  if (lit) litStone(s, b.x, b.y, b.w, b.h);
  else drawStone(s, b.x, b.y, b.w, b.h);
  drawText(s, b.x + Math.floor((b.w - textWidth(label)) / 2), b.y + 3, label, INK);
}
