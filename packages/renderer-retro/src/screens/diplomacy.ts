import type { GameState } from "@civ/core";
import { AUDIENCE_CHOICES, leaderTitle, realmName, type DiplomacyView } from "@civ/renderer-api";
import { drawSpaced, drawText, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_W, type Surface } from "../surface.js";
import { drawStone, INK } from "../widgets.js";

/**
 * The audience with a foreign leader, after the user's mock-up (2026-10-22): the realm's name in gold on a
 * navy strip, room on stone for the user's picture of the leader in their palace (`AUDIENCE_PICTURE`: the
 * apps lay the picture itself over the canvas there, as it is, since this screen's 256 colours cannot hold
 * it; beneath, a dusk sky), then a navy panel with the leader's name, their words and
 * our choices as up to four of the game's stone buttons.
 */

const TITLE = { y: 0, h: 12 };
/** Where the leader's picture goes (16 by 9, as the pictures are), centred between the title and the panel. */
export const AUDIENCE_PICTURE = { x: 48, y: 12, w: 224, h: 126 } as const;
const SCENE = AUDIENCE_PICTURE;
/** Where the leader's portrait goes on a civilization's card (`DiplomacyView.card`): at the left of the stone, the card's lines beside it. */
export const CARD_PICTURE = { x: 10, y: 16, w: 94, h: 118 } as const;
const CARD_TEXT = { x: 114, y: 18, w: SCREEN_W - 114 - 8 };
const PANEL = { y: 138, h: 62 };
const BUTTON_H = 13;

const NAVY = () => shade("azure", 0);
const GOLD_INK = () => shade("wheat", 6);

/** A box framed in stone: lit along the top and left, shaded along the bottom and right, `fill` inside. */
function framed(s: Surface, x: number, y: number, w: number, h: number, fill: number): void {
  s.rect(x, y, w, h, shade("panel", 3));
  s.hline(x, y, w, shade("panel", 6));
  s.vline(x, y, h, shade("panel", 6));
  s.hline(x, y + h - 1, w, shade("panel", 1));
  s.vline(x + w - 1, y, h, shade("panel", 1));
  s.rect(x + 2, y + 2, w - 4, h - 4, fill);
}

/** Where each of `n` choices sits: one row for one or two, two rows for three or four. */
function buttonRects(n: number): { x: number; y: number; w: number; h: number }[] {
  const w = 150, gap = 8, left = Math.floor((SCREEN_W - (2 * w + gap)) / 2);
  const rows = n <= 2 ? [178] : [169, 184];
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < Math.min(n, AUDIENCE_CHOICES); i++) {
    const row = Math.floor(i / 2);
    const inRow = Math.min(2, n - row * 2);
    const x = inRow === 1 ? Math.floor((SCREEN_W - w) / 2) : left + (i % 2) * (w + gap);
    out.push({ x, y: rows[row]!, w, h: BUTTON_H });
  }
  return out;
}

/** The choice under a point, or -1. */
export function diplomacyChoiceAt(view: DiplomacyView, px: number, py: number): number {
  return buttonRects(view.choices?.length ?? 0).findIndex((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h);
}

export function drawDiplomacyScreen(s: Surface, state: GameState, view: DiplomacyView): void {
  s.fill(C.BLACK!);
  framed(s, 0, TITLE.y, SCREEN_W, TITLE.h, NAVY());
  drawSpaced(s, SCREEN_W / 2, TITLE.y + 2, realmName(state, view.player), GOLD_INK());
  drawStone(s, 0, SCENE.y, SCREEN_W, SCENE.h);
  if (view.card) drawCard(s, view.card);
  else drawScene(s);
  framed(s, 0, PANEL.y, SCREEN_W, PANEL.h, NAVY());
  drawSpaced(s, SCREEN_W / 2, PANEL.y + 3, leaderTitle(state, view.player), GOLD_INK());
  wrapText(view.line, SCREEN_W - 20).slice(0, 2).forEach((l, i) => drawText(s, Math.floor((SCREEN_W - textWidth(l)) / 2), PANEL.y + 11 + i * FONT_HEIGHT, l, C.WHITE!));
  const choices = view.choices ?? [];
  buttonRects(choices.length).forEach((b, i) => drawChoice(s, b, choices[i]!, i === (view.selected ?? 0)));
}

/** A civilization's card: a sunken frame for the leader's portrait (a dusk sky beneath, seen until it loads), its lines beside it. */
function drawCard(s: Surface, lines: string[]): void {
  const p = CARD_PICTURE;
  framed(s, p.x - 2, p.y - 2, p.w + 4, p.h + 4, shade("azure", 1));
  const k = s.k;
  for (let fy = 0; fy < p.h * k; fy++) {
    const f = (fy / (p.h * k)) * 3;
    for (let fx = 0; fx < p.w * k; fx++) s.fset(p.x * k + fx, p.y * k + fy, shade("azure", Math.floor(f + ((fx + fy) % 2) * 0.5)));
  }
  let y = CARD_TEXT.y;
  const room = Math.floor((SCENE.y + SCENE.h - 4 - y) / FONT_HEIGHT);
  const wrapped = lines.flatMap((l, i) => wrapText(l, CARD_TEXT.w).map((w, j) => ({ w, first: i > 0 && j === 0 })));
  for (const { w, first } of wrapped.slice(0, room)) {
    if (first) y += 2;
    drawText(s, CARD_TEXT.x, y, w, INK);
    y += FONT_HEIGHT;
  }
}

/** What lies under the leader's picture: a dusk sky (seen only until the picture has loaded). */
function drawScene(s: Surface): void {
  const k = s.k;
  for (let fy = 0; fy < SCENE.h * k; fy++) {
    const f = (fy / (SCENE.h * k)) * 3;
    for (let fx = 0; fx < SCENE.w * k; fx++) s.fset(SCENE.x * k + fx, SCENE.y * k + fy, shade("azure", Math.floor(f + ((fx + fy) % 2) * 0.5)));
  }
}

/** A choice: the game's stone, raised, its words in ink; the lit one framed in gold. */
function drawChoice(s: Surface, b: { x: number; y: number; w: number; h: number }, label: string, lit: boolean): void {
  if (lit) s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, GOLD_INK());
  drawStone(s, b.x, b.y, b.w, b.h);
  drawText(s, b.x + Math.floor((b.w - textWidth(label)) / 2), b.y + 3, label, INK);
}
