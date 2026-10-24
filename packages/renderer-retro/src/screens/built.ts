import type { GameState } from "@civ/core";
import { BUILT_BUTTONS, builtCard, buildingArt, PICTURES, type BuiltHit, type BuiltView, type IconName } from "@civ/renderer-api";
import { drawSpaced, drawText, drawTextLarge, FONT_HEIGHT, spacedWidth, textWidth, wrapText } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { C, shade, slotColor } from "../palette.js";
import { rasterize } from "../pictures.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { drawStone, INK, speckle } from "../widgets.js";
import { drawWindowButton } from "./newtech.js";

/**
 * The Building Completed window, after the user's template (2026-10-24): the game's stone with a navy
 * title strip (the hammer, BUILDING COMPLETED, a close box), the name large over the city that built
 * it, the user's picture of it on a slate bed (a spot in `Surface.art`: the apps lay the picture
 * there, as it is), a parchment panel with its description and its effects on the city, its upkeep
 * along a strip, then View City on the stone and Continue in gold.
 */

const TITLE = { x: 3, y: 3, w: SCREEN_W - 6, h: 13 };
const CLOSE = { x: TITLE.x + TITLE.w - 12, y: TITLE.y + 2, w: 9, h: 9 };
const NAME = { x: 5, y: 18, w: SCREEN_W - 10, h: 27 };
const FRAME = { x: 5, y: 47, w: 120, h: 108 };
/** Where the building's picture goes: its drawing fills this box, centred in the frame. */
export const BUILT_PICTURE = { x: FRAME.x + 8, y: FRAME.y + 8, w: FRAME.w - 16, h: FRAME.h - 16 } as const;
const INFO = { x: 128, y: 47, w: SCREEN_W - 133, h: 108 };
/** How wide the description's lines may run (three of them fit). */
export const BUILT_TEXT_W = INFO.w - 12;
const UPKEEP = { x: 5, y: 158, w: SCREEN_W - 10, h: 15 };
const BUTTON = { y: 178, w: 120, h: 15 };
/** An effect's icon box. */
const BOX = 11;

// Colours, all from the palette's ramps: the template's navy, gold, slate and parchment.
const NAVY = () => shade("azure", 0);
const GOLD_DARK = () => shade("wheat", 0);
const GOLD_LIGHT = () => shade("wheat", 4);
const GOLD_INK = () => shade("wheat", 6);
const PARCHMENT = () => shade("hide", 7);
const PARCHMENT_DARK = () => shade("hide", 6);
const RULE = () => shade("panel", 2);
const QUIET = () => shade("panel", 2);

/** The buttons: View City on the left, Continue on the right. */
function buttonRects(): { x: number; y: number; w: number; h: number }[] {
  return [
    { x: 9, y: BUTTON.y, w: BUTTON.w, h: BUTTON.h },
    { x: SCREEN_W - 9 - BUTTON.w, y: BUTTON.y, w: BUTTON.w, h: BUTTON.h },
  ];
}

/** What lies under a point: a button, the close box (a little round it counts too), or nothing. */
export function builtHit(_view: BuiltView, px: number, py: number): BuiltHit | null {
  const i = buttonRects().findIndex((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h);
  if (i >= 0) return i === 0 ? "city" : "continue";
  if (px >= CLOSE.x - 3 && px < CLOSE.x + CLOSE.w + 3 && py >= TITLE.y && py < TITLE.y + TITLE.h) return "close";
  return null;
}

/** A parchment panel ringed in the stone's dark edge. */
function parchment(s: Surface, b: { x: number; y: number; w: number; h: number }): void {
  s.frame(b.x, b.y, b.w, b.h, RULE());
  speckle(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, PARCHMENT_DARK(), PARCHMENT(), PARCHMENT());
}

/** A heading in spaced capitals from `x`, a rule under it across the panel; returns the y below. */
function heading(s: Surface, x: number, y: number, text: string): number {
  drawSpaced(s, x + Math.ceil(spacedWidth(text) / 2), y, text, INK);
  s.hline(x - 1, y + FONT_HEIGHT + 1, INFO.w - 10, RULE());
  return y + FONT_HEIGHT + 4;
}

/** An effect: its icon in a small raised box, its words beside it. */
function effect(s: Surface, x: number, y: number, icon: IconName, text: string): void {
  drawStone(s, x, y, BOX, BOX);
  drawIcon(s, icon, x + Math.floor((BOX - ICON) / 2), y + Math.floor((BOX - ICON) / 2) + 1);
  drawText(s, x + BOX + 4, y + 2, text, INK);
}

/** A drawn picture's pixels (`rasterize`, `gw` by `gh`, -1 clear) as large as whole blocks fit in the picture's box, in its middle. */
function drawEnlarged(s: Surface, px: Int16Array, gw: number, gh: number): void {
  const b = BUILT_PICTURE;
  const k = Math.max(1, Math.floor(Math.min(b.w / gw, b.h / gh)));
  const x0 = b.x + Math.floor((b.w - gw * k) / 2);
  const y0 = b.y + Math.floor((b.h - gh * k) / 2);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const c = px[j * gw + i]!;
      if (c >= 0) s.rect(x0 + i * k, y0 + j * k, k, k, c);
    }
}

export function drawBuilt(s: Surface, state: GameState, view: BuiltView): void {
  const card = builtCard(state, view);
  if (!card) return;
  s.fill(C.BLACK!);
  drawStone(s, 0, 0, SCREEN_W, SCREEN_H);

  // The title strip: the hammer, the title in gold, the close box.
  s.rect(TITLE.x, TITLE.y, TITLE.w, TITLE.h, NAVY());
  s.frame(TITLE.x, TITLE.y, TITLE.w, TITLE.h, C.BLACK!);
  drawIcon(s, "shield", TITLE.x + 5, TITLE.y + 3);
  drawSpaced(s, SCREEN_W / 2, TITLE.y + 3, card.title, GOLD_INK());
  s.frame(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, GOLD_LIGHT());
  for (let i = 0; i < CLOSE.w - 4; i++) {
    s.set(CLOSE.x + 2 + i, CLOSE.y + 2 + i, GOLD_INK());
    s.set(CLOSE.x + CLOSE.w - 3 - i, CLOSE.y + 2 + i, GOLD_INK());
  }

  // The name, large, over the city that built it.
  drawStone(s, NAME.x, NAME.y, NAME.w, NAME.h, true);
  const name = card.name.toUpperCase();
  const scale = textWidth(name) * 2 <= NAME.w - 12 ? 2 : 1;
  drawTextLarge(s, NAME.x + Math.floor((NAME.w - textWidth(name) * scale) / 2), NAME.y + 1 + (scale === 2 ? 0 : 4), name, NAVY(), scale);
  drawText(s, NAME.x + Math.floor((NAME.w - textWidth(card.where)) / 2), NAME.y + 17, card.where, INK);

  // The picture's slate bed, sunk into the stone (seen bare only until the picture has loaded).
  s.frame(FRAME.x, FRAME.y, FRAME.w, FRAME.h, RULE());
  speckle(s, FRAME.x + 1, FRAME.y + 1, FRAME.w - 2, FRAME.h - 2, shade("steel", 3), shade("steel", 4), shade("steel", 4));
  s.hline(FRAME.x + 1, FRAME.y + 1, FRAME.w - 2, shade("steel", 3));
  s.vline(FRAME.x + 1, FRAME.y + 1, FRAME.h - 2, shade("steel", 3));
  const id = view.production.id;
  if (buildingArt(id)) s.art.push({ id, ...BUILT_PICTURE, middle: true });
  else {
    // No picture of the user's yet (Barracks, Granary, the Great Library): the city view's drawn one, enlarged.
    const pic = PICTURES[id];
    const owner = state.cities.find((c) => c.id === view.city)?.owner ?? 0;
    if (pic) drawEnlarged(s, rasterize(pic, slotColor(state.players[owner]!.color)), pic.w + 2, pic.h + 2);
  }

  // What it is, and what it does for the city.
  parchment(s, INFO);
  const x = INFO.x + 6;
  let y = heading(s, x, INFO.y + 3, "Description");
  for (const line of wrapText(card.text, BUILT_TEXT_W).slice(0, 3)) { drawText(s, x, y, line, INK); y += FONT_HEIGHT; }
  for (const line of card.more.flatMap((m) => wrapText(m, BUILT_TEXT_W)).slice(0, 2)) { drawText(s, x, y, line, QUIET()); y += FONT_HEIGHT; }
  y = heading(s, x, y + 3, "City Effects");
  const rows = Math.floor((INFO.y + INFO.h - 2 - y) / (BOX + 1));
  card.effects.slice(0, rows).forEach((e, i) => effect(s, x, y + i * (BOX + 1), e.icon, e.text));

  // The upkeep along its strip.
  parchment(s, UPKEEP);
  drawIcon(s, "coin", UPKEEP.x + 6, UPKEEP.y + 4);
  const upkeep = card.upkeep ? `Upkeep: ${card.upkeep} gold / turn` : "Upkeep: none";
  drawSpaced(s, UPKEEP.x + 20 + Math.ceil(spacedWidth(upkeep) / 2), UPKEEP.y + 4, upkeep, INK);

  buttonRects().forEach((b, i) => drawWindowButton(s, b, BUILT_BUTTONS[i]!, i === 1, i === view.selected));
}
