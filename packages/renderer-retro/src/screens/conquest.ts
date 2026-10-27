import type { GameState } from "@civ/core";
import { conquestCard, type ConquestCard, type ConquestHit, type ConquestView } from "@civ/renderer-api";
import { drawText, drawTextLarge, drawTextWrapped, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { C, shade } from "../palette.js";
import { SCREEN_W, type Surface } from "../surface.js";
import { dimScreen, drawEntering, drawStone, hideArtUnder, INK, speckle, SQUARE_PIC } from "../widgets.js";
import { builtPlace, drawSquareRing, drawWindowPoint, type BuiltPlace } from "./built.js";
import { drawModalTitle, drawWindowButton, fitText, modalHit } from "./newtech.js";
import { drawSquarePicture } from "./square.js";

/**
 * The window that tells of a city taken (asked for 2026-10-27): a small window by the city on the map,
 * as the Building Completed window stands (`builtPlace`: above the square, else below or beside it,
 * its point reaching to the square, which stays lit while the rest darkens). The square itself as the
 * map draws it, twice the size, in a sunken frame (our flag over the walls now, or theirs; bare ground
 * where a city was razed), the city's name large over who took it from whom, a line in the mood of
 * the news, and on parchment what changed hands. Won, a navy strip with crossed swords and gold, and
 * View City and Continue on a city we hold; lost, a mourning strip of black with a frowning face, the
 * name, words and the ring round the square in dark red, and only the close box (Enter, Esc or a click
 * go on).
 */

type Rect = { x: number; y: number; w: number; h: number };
const at = (o: Rect, x: number, y: number, w: number, h: number): Rect => ({ x: o.x + x, y: o.y + y, w, h });
/** The window's width; its height follows its lines and buttons (`conquestSize`). */
const WIN_W = 200;
/** A line on the parchment. */
const LINE = FONT_HEIGHT + 1;
/** Lines of the mood's words beside the picture. */
const WORD_LINES = 2;

/** The window's size for its card: a line of parchment a fact (one at least), and room for the buttons when it has them. */
function conquestSize(card: ConquestCard): { w: number; h: number } {
  const facts = Math.max(1, card.facts.length) * LINE + 4;
  return { w: WIN_W, h: 60 + facts + (card.buttons.length ? 20 : 5) };
}

/** Where each part of the window stands, its top left at `o`. */
function layout(o: Rect, card: ConquestCard) {
  const frame = at(o, 5, 19, SQUARE_PIC + 6, SQUARE_PIC + 6);
  const facts = at(o, 5, 60, o.w - 10, Math.max(1, card.facts.length) * LINE + 4);
  return {
    title: at(o, 3, 3, o.w - 6, 13),
    close: at(o, o.w - 15, 5, 9, 9),
    frame,
    picture: { x: frame.x + 3, y: frame.y + 3, w: SQUARE_PIC, h: SQUARE_PIC },
    name: at(o, frame.w + 10, 17, o.w - frame.w - 15, 21),
    words: at(o, frame.w + 10, 40, o.w - frame.w - 15, WORD_LINES * FONT_HEIGHT),
    facts,
    buttons: card.buttons.length ? [at(o, 5, o.h - 16, 77, 12), at(o, o.w - 5 - 77, o.h - 16, 77, 12)] : [],
  };
}

/** Where the window stands on a screen `screenW` wide, by the city's square when the view gives it. */
export function conquestPlace(state: GameState, view: ConquestView, screenW = SCREEN_W): BuiltPlace {
  return builtPlace(screenW, view.square, conquestSize(conquestCard(state, view)));
}

/** What lies under a point: View City or Continue, the close box (a little round it counts too), the city pointed at (View City, when the window offers it), or nothing. */
export function conquestHit(state: GameState, view: ConquestView, px: number, py: number, screenW = SCREEN_W): ConquestHit | null {
  const card = conquestCard(state, view);
  const l = layout(builtPlace(screenW, view.square, conquestSize(card)).win, card);
  const hit = modalHit(l, px, py, "city");
  if (hit) return hit;
  const q = view.square;
  if (card.buttons.length && q && px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h) return "city";
  return null;
}

// Colours from the palette's ramps: triumph in navy and gold, mourning in black with dark red.
const NAVY = () => shade("azure", 0);
const MOURNING = () => shade("brick", 1);
const MOURNING_EDGE = () => shade("brick", 4);
const MOURNING_STRIP = () => shade("stone", 0);
const MOURNING_INK = () => shade("stone", 6);
const PARCHMENT = () => shade("hide", 7);
const PARCHMENT_DARK = () => shade("hide", 6);
const RULE = () => shade("panel", 2);

export function drawConquest(s: Surface, state: GameState, view: ConquestView): void {
  const card = conquestCard(state, view);
  // The city stays lit, ringed (gold for a triumph, red for a loss), while the rest darkens.
  dimScreen(s, view.square);
  const place = builtPlace(s.width, view.square, conquestSize(card));
  if (view.square && place.side) {
    drawSquareRing(s, view.square);
    if (!card.won) s.frame(view.square.x - 1, view.square.y - 1, view.square.w + 2, view.square.h + 2, MOURNING_EDGE());
  }
  const enter = view.enter ?? 1;
  if (enter < 1) { drawEntering(s, enter, place.bounds, (t) => drawConquestNow(t, state, view, card, place), place.tip ?? undefined); return; }
  drawConquestNow(s, state, view, card, place);
}

function drawConquestNow(s: Surface, state: GameState, view: ConquestView, card: ConquestCard, place: BuiltPlace): void {
  const o = place.win;
  const l = layout(o, card);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  s.frame(o.x, o.y, o.w, o.h, C.BLACK!);
  hideArtUnder(s, place.bounds);
  drawStone(s, o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  drawWindowPoint(s, place);
  if (card.won) drawModalTitle(s, l, "swords", card.title, C.BLACK!);
  else drawModalTitle(s, l, "unhappy", card.title, C.BLACK!, MOURNING_STRIP(), MOURNING_INK());

  // The city's square as the map draws it, sunk into the stone.
  const { frame } = l;
  s.frame(frame.x, frame.y, frame.w, frame.h, RULE());
  s.frame(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, card.won ? shade("wheat", 4) : MOURNING_EDGE());
  s.rect(frame.x + 2, frame.y + 2, frame.w - 4, frame.h - 4, C.BLACK!);
  drawSquarePicture(s, state, view.event.x, view.event.y, l.picture.x, l.picture.y);

  // The name, large where it fits, over who took it from whom.
  const { name } = l;
  const big = card.name.toUpperCase();
  const scale = textWidth(big) * 2 <= name.w ? 2 : 1;
  const ink = card.won ? NAVY() : MOURNING();
  drawTextLarge(s, name.x, name.y + (scale === 2 ? 0 : 3), big, ink, scale);
  drawText(s, name.x, name.y + 13, fitText(card.where, name.w), INK);
  // The mood's words, cheering or mourning.
  const words = l.words;
  const lines = wrapText(card.words, words.w);
  drawTextWrapped(s, words.x, words.y + (lines.length < WORD_LINES ? FONT_HEIGHT >> 1 : 0), words.w, card.words, ink, WORD_LINES);

  // What changed hands, a line each.
  const { facts } = l;
  s.frame(facts.x, facts.y, facts.w, facts.h, RULE());
  speckle(s, facts.x + 1, facts.y + 1, facts.w - 2, facts.h - 2, PARCHMENT_DARK(), PARCHMENT(), PARCHMENT());
  card.facts.forEach((f, i) => {
    const y = facts.y + 2 + i * LINE;
    drawIcon(s, f.icon, facts.x + 4, y);
    drawText(s, facts.x + 4 + ICON + 3, y, fitText(f.text, facts.w - ICON - 12), INK);
  });

  l.buttons.forEach((b, i) => drawWindowButton(s, b, card.buttons[i]!, i === view.selected));
}
