import { setupPicture, type SetupCard, type SetupCards, type SetupGround } from "@civ/renderer-api";
import { drawTextCentered, FONT_HEIGHT, wrapText } from "../font.js";
import { drawIconLine, wrapIcons } from "../icons.js";
import { C, shade, slotColor } from "../palette.js";
import { drawPicture, drawPictureFine } from "../pictures.js";
import { drawShield, SHIELD_AT } from "../overlays.js";
import { CITY_SHEET, darker, spriteSurface, TERRAIN_SHEET } from "../sprites/index.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawStone, drawWindow, INK } from "../widgets.js";
import { drawStars } from "./title.js";

/**
 * The setup questions with pictures (`setupCards`): on the opening's night sky, the question across
 * the top, a card for each choice (a row of tall cards, or the tribes' grid of small ones, their
 * emblems as fine as the map's art), and under them a panel saying what the selected card means.
 */

interface Box { x: number; y: number; w: number; h: number }
interface SetupLayout {
  cards: Box[];
  /** Where each card's picture goes. */
  insets: Box[];
  panel: Box;
  /** The tribes' grid: small cards with fine pictures; else tall cards. */
  grid: boolean;
}

const TOP = 13;
/** The panel under the cards. */
const PANEL_H = 56;

function layout(cards: SetupCards): SetupLayout {
  const n = cards.cards.length;
  const cols = Math.max(1, cards.columns);
  const rows = Math.ceil(n / cols);
  const grid = rows > 1;
  const gap = grid ? 2 : 4;
  const w = grid ? 60 : Math.min(60, Math.floor((SCREEN_W - 8 - gap * (cols - 1)) / cols));
  const h = grid ? 31 : 124;
  const x0 = Math.floor((SCREEN_W - (cols * w + (cols - 1) * gap)) / 2);
  // Cards and panel together, as high on the screen as they fit centred under the question.
  const top = Math.max(TOP, TOP + Math.floor((SCREEN_H - 2 - TOP - (rows * (h + 1) + 2 + PANEL_H)) / 2));
  const out: Box[] = [];
  const insets: Box[] = [];
  for (let i = 0; i < n; i++) {
    // The last row of a grid sits centred under the others.
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const rx = x0 + Math.floor(((cols - inRow) * (w + gap)) / 2);
    const x = rx + (i % cols) * (w + gap);
    const y = top + r * (h + 1);
    out.push({ x, y, w, h });
    insets.push(grid ? { x: x + 17, y: y + 3, w: 26, h: 19 } : { x: x + 3, y: y + 3, w: w - 6, h: 86 });
  }
  return { cards: out, insets, panel: { x: 4, y: top + rows * (h + 1) + 2, w: SCREEN_W - 8, h: PANEL_H }, grid };
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
  cards.cards.forEach((card, i) => drawCard(s, card, l.cards[i]!, l.insets[i]!, l.grid, i === selected));
  const card = cards.cards[selected];
  if (card) drawPanel(s, card, l.panel, l.grid);
}

function drawCard(s: Surface, card: SetupCard, b: Box, inset: Box, grid: boolean, lit: boolean): void {
  if (lit) {
    s.frame(b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.WHITE!);
    s.rect(b.x, b.y, b.w, b.h, shade("azure", 2));
    s.frame(b.x, b.y, b.w, b.h, shade("azure", 5));
  } else drawStone(s, b.x, b.y, b.w, b.h);
  if (card.band !== undefined) {
    s.rect(b.x + 1, b.y + 1, b.w - 2, 1, slotColor(card.band));
    s.frame(inset.x - 1, inset.y - 1, inset.w + 2, inset.h + 2, slotColor(card.band));
  }
  drawArt(s, card, inset, !grid);
  const ink = lit ? C.WHITE! : INK;
  if (grid) {
    drawTextCentered(s, b.x + b.w / 2, inset.y + inset.h, card.label, ink);
    return;
  }
  let y = inset.y + inset.h + 4;
  for (const line of wrapText(card.label, b.w - 4)) { drawTextCentered(s, b.x + b.w / 2, y, line, ink); y += FONT_HEIGHT; }
  if (card.note) for (const line of wrapText(card.note, b.w - 4)) { drawTextCentered(s, b.x + b.w / 2, y, line, lit ? shade("azure", 7) : DIM); y += FONT_HEIGHT; }
}

/** A card's picture in its inset: sky and ground with the picture standing on it (large, or fine), or the towns. */
function drawArt(s: Surface, card: SetupCard, b: Box, large: boolean): void {
  const art = card.art;
  if (art.kind === "towns") { drawTowns(s, art.slots, b); return; }
  sky(s, b);
  const k = s.k;
  const groundH = large ? 4 : 1;
  ground(s, b, art.ground, groundH);
  const pic = setupPicture(art.id);
  const owner = slotColor(art.slot);
  if (large) drawPicture(s, pic, b.x + Math.floor((b.w - pic.w) / 2), b.y + b.h - Math.ceil(groundH / 2), owner);
  else drawPictureFine(s, pic, b.x * k + Math.floor((b.w * k - pic.w) / 2), (b.y + b.h) * k - 1, owner);
}

/** A day sky, darker at the top, dithered between its bands. */
function sky(s: Surface, b: Box): void {
  const k = s.k;
  const tones = [shade("sky", 2), shade("sky", 3), shade("sky", 4), shade("sky", 5), shade("sky", 6)];
  for (let fy = 0; fy < b.h * k; fy++) {
    const f = (fy / (b.h * k)) * (tones.length - 1);
    const a = Math.floor(f);
    for (let fx = 0; fx < b.w * k; fx++) {
      const up = f - a > ((fx + fy * 2) % 4) / 4 + 0.125;
      s.fset(b.x * k + fx, b.y * k + fy, tones[Math.min(tones.length - 1, a + (up ? 1 : 0))]!);
    }
  }
}

const GROUNDS: Record<SetupGround, [string, number, number]> = { grass: ["grass", 4, 2], sand: ["dune", 5, 3], water: ["ocean", 4, 2] };

/** The ground along the bottom of an inset, `h` screen pixels: a lit top edge over its body. */
function ground(s: Surface, b: Box, g: SetupGround, h: number): void {
  const [ramp, top, body] = GROUNDS[g];
  const k = s.k;
  const y = (b.y + b.h - h) * k;
  s.frect(b.x * k, y, b.w * k, h * k, shade(ramp, body));
  s.frect(b.x * k, y, b.w * k, 1, shade(ramp, top));
}

/** Where the towns stand in a tall card's inset (54 by 86), for each count. */
const TOWN_SPOTS: Record<number, [number, number][]> = {
  3: [[5, 10], [33, 34], [10, 62]],
  4: [[4, 8], [34, 16], [6, 58], [34, 64]],
  5: [[4, 6], [34, 8], [19, 35], [4, 64], [34, 64]],
  6: [[4, 6], [34, 6], [4, 35], [34, 35], [4, 64], [34, 64]],
  7: [[4, 4], [34, 4], [19, 24], [4, 44], [34, 44], [19, 66], [2, 68]],
};

/** A patch of the map's grassland, a town for each civilization on it, each flying its colour. */
function drawTowns(s: Surface, slots: number[], b: Box): void {
  const patch = Surface.fine(b.w, b.h);
  const spots = TOWN_SPOTS[slots.length] ?? TOWN_SPOTS[7]!.slice(0, slots.length);
  // Grassland, and woods on a few squares no town stands on.
  const taken = (tx: number, ty: number) => spots.slice(0, slots.length).some(([x, y]) => x < tx * 16 + 16 && x + 16 > tx * 16 && y < ty * 16 + 16 && y + 16 > ty * 16);
  for (let ty = 0; ty * 16 < b.h; ty++)
    for (let tx = 0; tx * 16 < b.w; tx++) {
      const wood = (tx * 7 + ty * 5) % 4 === 1 && !taken(tx, ty) && tx * 16 + 16 <= b.w && ty * 16 + 16 <= b.h;
      const tile = spriteSurface(TERRAIN_SHEET, wood ? "forest" : "grassland");
      if (tile) patch.blit(tile, tx * 16, ty * 16, SPRITE_CLEAR);
    }
  slots.forEach((slot, i) => {
    const [x, y] = spots[i] ?? [0, 0];
    const town = spriteSurface(CITY_SHEET, "ancient-town", slotColor(slot));
    if (town) patch.blit(town, x, y, SPRITE_CLEAR);
    // The owner's shield in the corner, as the map shows a city's.
    drawShield(patch, x, y, SHIELD_AT, SHIELD_AT, slotColor(slot), darker(slotColor(slot)));
  });
  s.blit(patch, b.x, b.y);
}

/** What the selected card means: a window with its heading, the big picture for a tribe, the lines beside. */
function drawPanel(s: Surface, card: SetupCard, b: Box, grid: boolean): void {
  drawWindow(s, b.x, b.y, b.w, b.h, card.heading, card.right ? { right: card.right } : {});
  let x = b.x + 8;
  if (grid && card.art.kind === "picture") {
    const inset = { x: b.x + 5, y: b.y + 15, w: 50, h: 38 };
    s.frame(inset.x - 1, inset.y - 1, inset.w + 2, inset.h + 2, card.band !== undefined ? slotColor(card.band) : C.BLACK!);
    drawArt(s, card, inset, true);
    x = inset.x + inset.w + 7;
  }
  const width = b.x + b.w - 6 - x;
  let y = b.y + 16;
  for (const line of card.lines) {
    for (const part of wrapIcons(line, width)) {
      if (y + FONT_HEIGHT > b.y + b.h - 1) return;
      drawIconLine(s, x, y, part, INK);
      y += FONT_HEIGHT + 1;
    }
  }
}
