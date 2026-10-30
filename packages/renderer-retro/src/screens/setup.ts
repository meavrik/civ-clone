import { TRIBE_COLUMNS, type SetupCard, type SetupCards } from "@civ/renderer-api";
import { drawTextCentered, FONT_HEIGHT, wrapText } from "../font.js";
import { drawIconLine, wrapIcons } from "../icons.js";
import { C, shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { DIM, drawButton, drawStone, drawWindow, INK, NOTE } from "../widgets.js";
import { drawStars } from "./title.js";

/**
 * The setup questions with portraits (`setupCards`), on the opening's night sky under the question:
 * difficulty as a row of tall cards, the panel under them saying what the level changes; the tribes as a
 * grid of small cards beside a panel with the selected leader large and what the tribe brings. The
 * portraits are the user's pictures as they are, which the apps lay over the canvas where this screen
 * leaves room for them (`setupPictureSpots`); here only the sky behind them is drawn.
 */

interface Box { x: number; y: number; w: number; h: number }
interface SetupLayout {
  cards: Box[];
  /** Where each card's portrait goes. */
  insets: Box[];
  panel: Box;
}

const TOP = 13;
/** Difficulty's cards and the panel under them. */
const ROW = { w: 60, h: 80, gap: 4, panel: 65 };
/** The tribes' grid, beside the panel. */
const GRID = { cols: TRIBE_COLUMNS, w: 52, h: 35, gap: 1 };

function layout(cards: SetupCards): SetupLayout {
  const n = cards.cards.length;
  const out: Box[] = [];
  const insets: Box[] = [];
  if (!cards.grid) {
    const x0 = Math.floor((SCREEN_W - (n * ROW.w + (n - 1) * ROW.gap)) / 2);
    const top = TOP + Math.max(0, Math.floor((SCREEN_H - 2 - TOP - (ROW.h + 2 + ROW.panel)) / 2));
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (ROW.w + ROW.gap);
      out.push({ x, y: top, w: ROW.w, h: ROW.h });
      insets.push({ x: x + 3, y: top + 3, w: ROW.w - 6, h: 52 });
    }
    return { cards: out, insets, panel: { x: 4, y: top + ROW.h + 2, w: SCREEN_W - 8, h: ROW.panel } };
  }
  const cols = Math.max(1, cards.columns);
  for (let i = 0; i < n; i++) {
    const x = 3 + (i % cols) * (GRID.w + GRID.gap);
    const y = TOP + Math.floor(i / cols) * (GRID.h + 1);
    out.push({ x, y, w: GRID.w, h: GRID.h });
    insets.push({ x: x + 12, y: y + 2, w: 28, h: 24 });
  }
  const px = 3 + GRID.cols * GRID.w + (GRID.cols - 1) * GRID.gap + 4;
  return { cards: out, insets, panel: { x: px, y: TOP, w: SCREEN_W - 3 - px, h: SCREEN_H - 2 - TOP } };
}

/** Where each portrait goes, in screen pixels: every card's, then for the tribes the selected one's large in the panel. */
export function setupPictureSpots(cards: SetupCards, selected: number): { portrait: string; x: number; y: number; w: number; h: number }[] {
  const l = layout(cards);
  const spots = cards.cards.map((c, i) => ({ portrait: c.portrait, ...l.insets[i]! }));
  const card = cards.cards[selected];
  if (cards.grid && card) spots.push({ portrait: card.portrait, ...panelInset(l.panel) });
  return spots;
}

/** The large portrait's place in the tribes' panel. */
function panelInset(b: Box): Box {
  return { x: b.x + Math.floor((b.w - 54) / 2), y: b.y + 16, w: 54, h: 52 };
}

/**
 * A Choose button at the foot of the panel, for the phone (asked for 2026-10-25), where no pointer lights
 * a card on its way: a tap lights a card and tells of it, Choose (or a second tap) picks it. The web
 * game draws none: its pointer lights the cards and a click picks.
 */
const CHOOSE = { w: 72, h: 21 };

/** Where the panel's Choose button stands. */
export function setupChooseRect(cards: SetupCards): Box {
  const p = layout(cards).panel;
  return { x: p.x + p.w - 6 - CHOOSE.w, y: p.y + p.h - 5 - CHOOSE.h, w: CHOOSE.w, h: CHOOSE.h };
}

/** Whether a point lies on the panel's Choose button. */
export function setupChooseAt(cards: SetupCards, px: number, py: number): boolean {
  const b = setupChooseRect(cards);
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;
}

/** The panel's Choose button, lit: it picks the card the panel tells of. */
export function drawSetupChoose(s: Surface, cards: SetupCards): void {
  const b = setupChooseRect(cards);
  drawButton(s, b.x, b.y, b.w, b.h, "Choose", true, true, 2);
}

/** The card under a point, or -1. */
export function setupCardAt(cards: SetupCards, px: number, py: number): number {
  return layout(cards).cards.findIndex((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h);
}

/** A setup question as cards: the selected one lit and told of in the panel; `at` twinkles the stars. */
export function drawSetupScreen(s: Surface, cards: SetupCards, selected: number, at: number): void {
  s.fill(C.BLACK!);
  drawStars(s, at);
  drawTextCentered(s, SCREEN_W / 2, 3, cards.title, shade("sand", 7));
  const l = layout(cards);
  cards.cards.forEach((card, i) => drawCard(s, card, l.cards[i]!, l.insets[i]!, !cards.grid, i === selected));
  const card = cards.cards[selected];
  if (card) (cards.grid ? drawSidePanel : drawPanel)(s, card, l.panel);
}

function drawCard(s: Surface, card: SetupCard, b: Box, inset: Box, large: boolean, lit: boolean): void {
  if (lit) {
    s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.WHITE!);
    s.rect(b.x, b.y, b.w, b.h, shade("azure", 2));
    s.frame(b.x, b.y, b.w, b.h, shade("azure", 5));
  } else drawStone(s, b.x, b.y, b.w, b.h);
  if (card.band !== undefined) s.rect(b.x + 1, b.y + 1, b.w - 2, 1, slotColor(card.band));
  drawPortrait(s, card, inset);
  const ink = lit ? C.WHITE! : INK;
  if (!large) {
    drawTextCentered(s, b.x + b.w / 2, inset.y + inset.h, card.label, ink);
    return;
  }
  const y = inset.y + inset.h + 3;
  drawTextCentered(s, b.x + b.w / 2, y, card.label, ink);
  if (card.note) drawTextCentered(s, b.x + b.w / 2, y + FONT_HEIGHT, card.note, lit ? shade("azure", 7) : DIM);
}

/** A portrait's place: a soft sky framed (in the tribe's colour if it has one); the portrait itself is laid over it. */
function drawPortrait(s: Surface, card: SetupCard, b: Box): void {
  s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, card.band !== undefined ? slotColor(card.band) : C.BLACK!);
  drawPortraitSky(s, b);
}

/** A sky-blue ground behind a portrait, lighter toward the foot, dithered between its bands. */
export function drawPortraitSky(s: Surface, b: Box): void {
  const k = s.k;
  const tones = [shade("sky", 2), shade("sky", 3), shade("sky", 4), shade("sky", 5)];
  for (let fy = 0; fy < b.h * k; fy++) {
    const f = (fy / (b.h * k)) * (tones.length - 1);
    const a = Math.floor(f);
    for (let fx = 0; fx < b.w * k; fx++) {
      const up = f - a > ((fx + fy * 2) % 4) / 4 + 0.125;
      s.fset(b.x * k + fx, b.y * k + fy, tones[Math.min(tones.length - 1, a + (up ? 1 : 0))]!);
    }
  }
}

/** Under difficulty's cards: the level's name, then what it changes. */
function drawPanel(s: Surface, card: SetupCard, b: Box): void {
  drawWindow(s, b.x, b.y, b.w, b.h, card.heading, card.right ? { right: card.right } : {});
  drawLines(s, card, b.x + 8, b.y + 16, b.w - 14, b.y + b.h - 1);
}

/** Beside the tribes: the tribe's name, its leader large and named, the trait picked out, then the rest. */
function drawSidePanel(s: Surface, card: SetupCard, b: Box): void {
  drawWindow(s, b.x, b.y, b.w, b.h, card.heading, { centred: true });
  const inset = panelInset(b);
  drawPortrait(s, card, inset);
  let y = inset.y + inset.h + 4;
  if (card.subtitle) { drawTextCentered(s, b.x + b.w / 2, y, card.subtitle, INK); y += FONT_HEIGHT + 4; }
  drawLines(s, card, b.x + 6, y, b.w - 11, b.y + b.h - 1);
}

/** The card's lead line (in the note colour) and lines, wrapped to `width`, stopping at `bottom`. */
function drawLines(s: Surface, card: SetupCard, x: number, top: number, width: number, bottom: number): void {
  let y = top;
  const lines: [string, number][] = [...(card.lead ? [[card.lead, NOTE] as [string, number]] : []), ...card.lines.map((l) => [l, INK] as [string, number])];
  for (const [line, ink] of lines) {
    for (const part of line.includes("{") ? wrapIcons(line, width) : wrapText(line, width)) {
      if (y + FONT_HEIGHT > bottom) return;
      drawIconLine(s, x, y, part, ink);
      y += FONT_HEIGHT + 1;
    }
  }
}
