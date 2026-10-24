import type { GameState } from "@civ/core";
import { AUDIENCE_CHOICES, leaderTitle, realmName, type DiplomacyView } from "@civ/renderer-api";
import { drawSpaced, drawText, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, drawCloseBox, drawEntering, drawStone, INK, TITLE_H } from "../widgets.js";

/**
 * The audience with a foreign leader, after the user's mock-up (2026-10-22), as a window over the map
 * since 2026-10-24 (asked for: "all screen windows should be a modal style and not take 100% of the
 * screen", the encounter and diplomacy window named): the game darkened behind it, the realm's name in
 * gold on a navy title strip with a close box (Esc: back a screen, or farewell), room on the stone for
 * the user's picture of the leader in their palace (`audiencePicture`: the apps lay the picture itself
 * over the canvas there, as it is, since the palette cannot hold it; beneath, a dusk sky), then a navy
 * panel with the leader's name and their words, and our choices as up to four of the game's stone
 * buttons. A civilization's card (`DiplomacyView.card`) shows the leader's portrait at the left
 * (`cardPicture`) with the card's lines beside it. The window grows into place like the others (`enter`).
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

/** Where each part of the window stands, the window's top left at `o`. */
function layout(o: Rect) {
  return {
    title: at(o, 2, 2, o.w - 4, TITLE_H),
    close: { x: o.x + o.w - 3 - (TITLE_H - 2), y: o.y + 3, w: TITLE_H - 2, h: TITLE_H - 2 },
    /** The leader's picture (16 by 9, as the pictures are), in the middle under the title. */
    scene: at(o, 36, 15, 192, 108),
    /** The leader's portrait on a civilization's card, at the left; the card's lines beside it. */
    portrait: at(o, 8, 15, 94, 118),
    cardText: at(o, 110, 17, o.w - 118, 106),
    panel: at(o, 2, 125, o.w - 4, 27),
    rows: [o.y + 154, o.y + 169],
  };
}

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
function buttonRects(o: Rect, n: number): Rect[] {
  const l = layout(o);
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
  return buttonRects(audienceRect(screenW), view.choices?.length ?? 0).findIndex((b) => inRect(b, px, py));
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
  const l = layout(o);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  s.frame(o.x, o.y, o.w, o.h, C.BLACK!);
  drawStone(s, o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  // The realm's name in gold on navy, the close box at the strip's end.
  s.rect(l.title.x, l.title.y, l.title.w, l.title.h, NAVY());
  drawSpaced(s, o.x + o.w / 2, l.title.y + 2, realmName(state, view.player), GOLD_INK());
  drawCloseBox(s, l.close.x, l.close.y);
  if (view.card) drawCard(s, l, view.card);
  else drawScene(s, l.scene);
  framed(s, l.panel, NAVY());
  const lines = wrapText(view.line, l.panel.w - 16).slice(0, 2);
  if (view.card) lines.forEach((t, i) => drawText(s, o.x + Math.floor((o.w - textWidth(t)) / 2), l.panel.y + 6 + i * FONT_HEIGHT, t, C.WHITE!));
  else {
    drawSpaced(s, o.x + o.w / 2, l.panel.y + 3, leaderTitle(state, view.player), GOLD_INK());
    lines.forEach((t, i) => drawText(s, o.x + Math.floor((o.w - textWidth(t)) / 2), l.panel.y + 11 + i * FONT_HEIGHT, t, C.WHITE!));
  }
  const choices = view.choices ?? [];
  buttonRects(o, choices.length).forEach((b, i) => drawChoice(s, b, choices[i]!, i === (view.selected ?? 0)));
}

/** A civilization's card: a sunken frame for the leader's portrait (a dusk sky beneath, seen until it loads), its lines beside it. */
function drawCard(s: Surface, l: ReturnType<typeof layout>, lines: string[]): void {
  const p = l.portrait;
  framed(s, { x: p.x - 2, y: p.y - 2, w: p.w + 4, h: p.h + 4 }, shade("azure", 1));
  sky(s, p);
  let y = l.cardText.y;
  const room = Math.floor(l.cardText.h / FONT_HEIGHT);
  const wrapped = lines.flatMap((line, i) => wrapText(line, l.cardText.w).map((w, j) => ({ w, first: i > 0 && j === 0 })));
  for (const { w, first } of wrapped.slice(0, room)) {
    if (first) y += 2;
    drawText(s, l.cardText.x, y, w, INK);
    y += FONT_HEIGHT;
  }
}

/** The leader's picture's place: a thin dark frame round a dusk sky (seen only until the picture has loaded). */
function drawScene(s: Surface, b: Rect): void {
  s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, shade("panel", 1));
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

/** A choice: the game's stone, raised, its words in ink; the lit one framed in gold. */
function drawChoice(s: Surface, b: Rect, label: string, lit: boolean): void {
  if (lit) s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, GOLD_INK());
  drawStone(s, b.x, b.y, b.w, b.h);
  drawText(s, b.x + Math.floor((b.w - textWidth(label)) / 2), b.y + 3, label, INK);
}
