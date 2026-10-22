import { civ, type GameState } from "@civ/core";
import { AUDIENCE_CHOICES, leaderTitle, LEADER_PORTRAITS, realmName, type DiplomacyView } from "@civ/renderer-api";
import { drawText, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { C, shade } from "../palette.js";
import { RULER_SHEET, spriteSurface } from "../sprites/index.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { SCREEN_W, type Surface } from "../surface.js";
import { drawStone, INK } from "../widgets.js";

/**
 * The audience with a foreign leader, after the user's mock-up (2026-10-22): the realm's name in gold on a
 * navy strip, room on stone for the user's picture of the leader in their palace (`AUDIENCE_PICTURE`: the
 * apps lay the picture itself over the canvas there, as it is, since this screen's 256 colours cannot hold
 * it; beneath, the leader's portrait stands in), then a navy panel with the leader's name, their words and
 * our choices as up to four of the game's stone buttons.
 */

const TITLE = { y: 0, h: 12 };
/** Where the leader's picture goes (16 by 9, as the pictures are), centred between the title and the panel. */
export const AUDIENCE_PICTURE = { x: 48, y: 12, w: 224, h: 126 } as const;
const SCENE = AUDIENCE_PICTURE;
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

/** Capitals spread a pixel apart, centred on `cx`. */
function drawSpaced(s: Surface, cx: number, y: number, text: string, color: number): void {
  const caps = text.toUpperCase();
  const w = [...caps].reduce((n, ch) => n + textWidth(ch) + 1, -1);
  let x = Math.floor(cx - w / 2);
  for (const ch of caps) x = drawText(s, x, y, ch, color) + 1;
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
  drawScene(s, state, view.player);
  framed(s, 0, PANEL.y, SCREEN_W, PANEL.h, NAVY());
  drawSpaced(s, SCREEN_W / 2, PANEL.y + 3, leaderTitle(state, view.player), GOLD_INK());
  wrapText(view.line, SCREEN_W - 20).slice(0, 2).forEach((l, i) => drawText(s, Math.floor((SCREEN_W - textWidth(l)) / 2), PANEL.y + 11 + i * FONT_HEIGHT, l, C.WHITE!));
  const choices = view.choices ?? [];
  buttonRects(choices.length).forEach((b, i) => drawChoice(s, b, choices[i]!, i === (view.selected ?? 0)));
}

/** What lies under the leader's picture: their portrait on a dusk sky (seen until the picture has loaded). */
function drawScene(s: Surface, state: GameState, player: number): void {
  const name = LEADER_PORTRAITS[civ(state.players[player]!.civ).id];
  const k = s.k;
  for (let fy = 0; fy < SCENE.h * k; fy++) {
    const f = (fy / (SCENE.h * k)) * 3;
    for (let fx = 0; fx < SCENE.w * k; fx++) s.fset(SCENE.x * k + fx, SCENE.y * k + fy, shade("azure", Math.floor(f + ((fx + fy) % 2) * 0.5)));
  }
  const portrait = name ? spriteSurface(RULER_SHEET, name) : null;
  if (portrait) s.fblit(portrait, (SCENE.x + SCENE.w - 70) * k, (SCENE.y + SCENE.h) * k - portrait.fh, SPRITE_CLEAR);
}

/** A choice: the game's stone, raised, its words in ink; the lit one framed in gold. */
function drawChoice(s: Surface, b: { x: number; y: number; w: number; h: number }, label: string, lit: boolean): void {
  if (lit) s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, GOLD_INK());
  drawStone(s, b.x, b.y, b.w, b.h);
  drawText(s, b.x + Math.floor((b.w - textWidth(label)) / 2), b.y + 3, label, INK);
}
