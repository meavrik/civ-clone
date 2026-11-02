import { ownerLine, type SquareCard, type SquareFact } from "@civ/renderer-api";
import { drawSmallCaps, drawText, drawTextLarge, FONT_HEIGHT, smallCapsWidth, SMALL_CAPS_HEIGHT, textWidth, textWidthLarge } from "./font.js";
import { drawIcon, drawIconLine, ICON, iconLineWidth, wrapIcons } from "./icons.js";
import { drawShield } from "./overlays.js";
import { shade, slotColor } from "./palette.js";
import { darker } from "./sprites/index.js";
import { BAD, GOOD, INK, speckle } from "./stone.js";
import type { Surface } from "./surface.js";

/**
 * The square's window's card (`MenuState.card`, `terrainInfo`; redone 2026-11-02, asked for: "still not good. rethink
 * this modal window layout", after a labelled table): under the title strip, the square as the map draws it in a sunk
 * frame, beside it what it yields in large figures, a line of its moves and defence and a few words on the terrain in
 * dim ink; under that one parchment panel, as the Building Completed window's, holding the facts in groups, each group
 * under a small heading in brown capitals with a rule running on from it, each fact a line of its own: its icon (a
 * unit's owner's shield), its name in black, and in a column of their own what it means, in grey, green for good news,
 * red for a warning. Laid at the font's size on every screen (the phone's large words would not fit it).
 */

/** The square's picture (twice a map square) and its sunk frame. */
export const CARD_PIC = 32;
const FRAME = CARD_PIC + 4;
/** The stone's margin round the card's parts. */
const PAD = 6;
/** Where the yields and the lines beside the picture start, from the card's left. */
const STATS_X = PAD + FRAME + 7;
/** The yields' row (large figures), then the moves' line and the terrain's words under it. */
const YIELD_H = 14;
const LINE = FONT_HEIGHT;
/** The panel: its margin from the card's sides, its padding inside, a fact's row, a group's heading and the gap after a group. */
const PANEL_IN = 5;
const ROW = FONT_HEIGHT;
const HEADING = SMALL_CAPS_HEIGHT + 3;
const GROUP_GAP = 3;
/** Between a fact's icon and its name, and between the names' column and the notes'. */
const ICON_GAP = 3;
const NOTE_GAP = 8;
/** The card's width: at least this, and no wider than this unless the screen asks it narrower (the notes wrap). */
export const CARD_MIN_W = 184;
export const CARD_MAX_W = 236;
/** A card standing beside its square narrows to this at the least. */
export const CARD_NARROW_W = 160;

/** Parchment and its inks, from the palette's ramps: the Building Completed window's panel. */
const PARCHMENT = () => shade("hide", 7);
const PARCHMENT_DARK = () => shade("hide", 6);
const EDGE = () => shade("panel", 2);
const HEAD_INK = () => shade("hide", 2);
const RULE = () => shade("hide", 5);
const NOTE_INK = () => shade("panel", 1);
const QUIET_INK = () => shade("panel", 2);
const WORDS_INK = () => shade("panel", 1);

function toneInk(tone: SquareFact["tone"]): number {
  return tone === "good" ? GOOD : tone === "bad" ? BAD : tone === "quiet" ? QUIET_INK() : NOTE_INK();
}

const yieldCells = (card: SquareCard): [Parameters<typeof drawIcon>[1], number][] => [["food", card.yields.food], ["shield", card.yields.shields], ["trade", card.yields.trade]];
const YIELD_STEP = ICON + 3;
const YIELD_GAP = 10;
/** The yields' row: each its icon and its figure, large. */
function yieldsWidth(card: SquareCard): number {
  return yieldCells(card).reduce((w, [, n], i) => w + YIELD_STEP + textWidthLarge(String(n)) + (i ? YIELD_GAP : 0), 0);
}

function movesLine(card: SquareCard): string {
  return `{boot} ${card.moves} move${card.moves === 1 ? "" : "s"}${card.defence ? `  {tower} +${card.defence}% defence` : ""}`;
}

/** The widest fact name, which sets where the notes' column starts. */
function namesWidth(card: SquareCard): number {
  return Math.max(0, ...card.groups.flatMap((g) => g.facts.map((f) => textWidth(f.name))));
}

/** The width the card would take with nothing wrapped. */
export function cardNeed(card: SquareCard): number {
  const head = STATS_X + Math.max(yieldsWidth(card), iconLineWidth(movesLine(card)), card.owner ? iconLineWidth(ownerLine(card.owner)) : 0) + PAD;
  const notes = Math.max(0, ...card.groups.flatMap((g) => g.facts.map((f) => (f.note ? iconLineWidth(f.note) : 0))));
  const facts = 2 * (PAD - 1 + PANEL_IN) + ICON + ICON_GAP + namesWidth(card) + NOTE_GAP + notes;
  return Math.max(head, facts);
}

/** The card laid out `w` wide: the terrain's words wrapped beside the picture, each fact's note wrapped in its column, and the heights. */
export interface CardLayout {
  w: number;
  words: string[];
  headH: number;
  noteX: number;
  groups: { title: string; dy: number; facts: { fact: SquareFact; dy: number; notes: string[] }[] }[];
  panelH: number;
  h: number;
}

export function cardLayout(card: SquareCard, w: number): CardLayout {
  const words = wrapIcons(card.text, w - STATS_X - PAD);
  const headH = Math.max(FRAME, YIELD_H + (card.owner ? 2 : 1) * LINE + 2 + words.length * LINE);
  // The notes' column starts past the longest name, as far left as it may.
  const inner = w - 2 * (PAD - 1 + PANEL_IN);
  const noteX = ICON + ICON_GAP + namesWidth(card) + NOTE_GAP;
  const noteW = Math.max(40, inner - noteX);
  let dy = PANEL_IN - 2;
  const groups = card.groups.map((g, i) => {
    if (i) dy += GROUP_GAP;
    const top = dy;
    dy += HEADING;
    const facts = g.facts.map((fact) => {
      const notes = fact.note ? wrapIcons(fact.note, noteW) : [];
      const at = dy;
      dy += Math.max(1, notes.length) * ROW;
      return { fact, dy: at, notes };
    });
    return { title: g.title, dy: top, facts };
  });
  const panelH = groups.length ? dy + PANEL_IN - 3 : 0;
  return { w, words, headH, noteX, groups, panelH, h: headH + (panelH ? 6 + panelH : 0) };
}

/**
 * The card with its top left at (x, y), `w` wide; `square` paints the map square's picture at a screen point
 * (`CARD_PIC` a side), else the frame holds black.
 */
export function drawSquareCard(s: Surface, card: SquareCard, x: number, y: number, w: number, square?: (s: Surface, x: number, y: number) => void): void {
  const l = cardLayout(card, w);
  // The square in a dark frame, sunk into the stone: shade along the top and left, light along the foot and right.
  const fx = x + PAD - 1;
  const fy = y;
  s.frame(fx, fy, FRAME, FRAME, shade("panel", 2));
  s.hline(fx, fy + FRAME, FRAME + 1, shade("panel", 7));
  s.rect(fx + FRAME, fy, 1, FRAME + 1, shade("panel", 7));
  s.frame(fx + 1, fy + 1, FRAME - 2, FRAME - 2, INK);
  if (square) square(s, fx + 2, fy + 2);
  else s.rect(fx + 2, fy + 2, CARD_PIC, CARD_PIC, INK);

  // Beside it: the yields large, each icon level with the middle of its figure; the moves and defence, whose it is, and
  // the terrain's words in dim ink.
  let cx = x + STATS_X;
  yieldCells(card).forEach(([icon, n], i) => {
    if (i) cx += YIELD_GAP;
    drawIcon(s, icon, cx, y + 3);
    // A yield of nothing fades, so the ones that count stand out.
    cx = drawTextLarge(s, cx + YIELD_STEP, y + 1, String(n), n ? INK : QUIET_INK());
  });
  let ly = y + YIELD_H;
  drawIconLine(s, x + STATS_X, ly, movesLine(card), INK);
  if (card.owner) {
    ly += LINE;
    const o = card.owner;
    const after = drawIconLine(s, x + STATS_X, ly, `{${o.icon}} ${o.name}`, INK);
    if (o.note) drawText(s, after, ly, `, ${o.note}`, toneInk(o.tone));
  }
  l.words.forEach((line, i) => drawText(s, x + STATS_X, ly + LINE + 2 + i * LINE, line, WORDS_INK()));

  if (!l.panelH) return;
  // The panel of facts.
  const px = x + PAD - 1;
  const py = y + l.headH + 6;
  const pw = w - 2 * (PAD - 1);
  s.frame(px, py, pw, l.panelH, EDGE());
  speckle(s, px + 1, py + 1, pw - 2, l.panelH - 2, PARCHMENT_DARK(), PARCHMENT(), PARCHMENT());
  const ix = px + PANEL_IN;
  const right = px + pw - PANEL_IN;
  for (const g of l.groups) {
    // The heading in small brown capitals, a rule running on from it to the panel's edge.
    const hy = py + g.dy;
    drawSmallCaps(s, ix, hy, g.title.toUpperCase(), HEAD_INK());
    const rx = ix + smallCapsWidth(g.title.toUpperCase()) + 3;
    s.hline(rx, hy + 1, right - rx, RULE());
    for (const { fact, dy, notes } of g.facts) {
      const ry = py + dy;
      if (fact.shield !== undefined) {
        // A unit's owner's shield in the icon's place, in the middle of its room.
        const fill = slotColor(fact.shield);
        drawShield(s, ix, ry, 4, 3, fill, darker(fill));
      } else drawIcon(s, fact.icon, ix, ry);
      drawText(s, ix + ICON + ICON_GAP, ry, fact.name, INK);
      notes.forEach((line, k) => drawIconLine(s, ix + l.noteX, ry + k * ROW, line, toneInk(fact.tone)));
    }
  }
}
