import type { GameState } from "@civ/core";
import { buildingArt, PICTURES, type TechGift } from "@civ/renderer-api";
import { drawText, drawTextLarge, FONT_HEIGHT, textWidth, textWidthLarge } from "../font.js";
import { drawIconLarge } from "../icons.js";
import { drawUnitFigure } from "../overlays.js";
import { C, shade, slotColor } from "../palette.js";
import { drawEnlarged, rasterize } from "../pictures.js";
import type { Surface } from "../surface.js";
import { speckle } from "../widgets.js";
import { fitText } from "./newtech.js";

/**
 * What an advance brings, framed (asked for 2026-11-03: "tech improvement images - too small. place inside frames
 * with badge title", then "images are too big - reduce size": the bed was 40 high, frames up to 64 wide): its
 * government's crown, its wonders, buildings and units, each on a slate bed (the Building Completed window's) with
 * the user's picture as large as it fits, its name on a badge across the frame's foot, each frame as wide as its
 * name wants. The research window's rows and the whole panel's card share them.
 */
export const GIFT_BED_H = 22;
const BADGE_H = 9;
/** A frame's height, its edge included. */
export const GIFT_FRAME_H = GIFT_BED_H + BADGE_H + 2;
const MIN_W = 30;
const MAX_W = 52;
/** The narrow frame counting what did not fit. */
const MORE_W = 22;
const GAP = 3;

/** A frame: `gift` null for the one counting the `more` that did not fit. */
export interface GiftFrame { x: number; y: number; w: number; gift: TechGift | null; more: number }

/**
 * Frames for `gifts` along a strip `room` wide from `x` (from its left, or `centre`d in it); when they do not all
 * fit, as many as fit with a narrow frame after them counting the rest.
 */
export function giftFrames(gifts: TechGift[], x: number, y: number, room: number, centre = false): GiftFrame[] {
  if (!gifts.length) return [];
  const widths = gifts.map((g) => Math.max(MIN_W, Math.min(MAX_W, textWidth(g.name) + 8)));
  const span = (k: number, more: boolean): number =>
    widths.slice(0, k).reduce((a, w) => a + w, 0) + (more ? MORE_W : 0) + GAP * Math.max(0, k + (more ? 1 : 0) - 1);
  let n = gifts.length;
  if (span(n, false) > room) {
    n--;
    while (n > 0 && span(n, true) > room) n--;
  }
  const more = n < gifts.length;
  let fx = x + (centre ? Math.max(0, Math.floor((room - span(n, more)) / 2)) : 0);
  const out: GiftFrame[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: fx, y, w: widths[i]!, gift: gifts[i]!, more: 0 });
    fx += widths[i]! + GAP;
  }
  if (more) out.push({ x: fx, y, w: MORE_W, gift: null, more: gifts.length - n });
  return out;
}

/** Each kind's frame and badge: a government in green, wonders in gold, buildings in brown and parchment, units in navy. */
const LOOK: Record<TechGift["kind"] | "more", { edge: () => number; badge: () => number; ink: () => number }> = {
  government: { edge: () => shade("grass", 0), badge: () => shade("grass", 2), ink: () => C.WHITE! },
  wonder: { edge: () => shade("wheat", 1), badge: () => shade("wheat", 4), ink: () => shade("hide", 0) },
  building: { edge: () => shade("hide", 1), badge: () => shade("hide", 6), ink: () => shade("hide", 0) },
  unit: { edge: () => shade("azure", 0), badge: () => shade("azure", 1), ink: () => C.WHITE! },
  more: { edge: () => shade("hide", 3), badge: () => shade("hide", 5), ink: () => shade("hide", 0) },
};

export function drawGiftFrame(s: Surface, state: GameState, f: GiftFrame): void {
  const look = LOOK[f.gift?.kind ?? "more"];
  s.frame(f.x, f.y, f.w, GIFT_FRAME_H, look.edge());
  const bed = { x: f.x + 1, y: f.y + 1, w: f.w - 2, h: GIFT_BED_H };
  speckle(s, bed.x, bed.y, bed.w, bed.h, shade("steel", 3), shade("steel", 4), shade("steel", 4));
  s.hline(bed.x, bed.y, bed.w, shade("steel", 2));
  s.vline(bed.x, bed.y, bed.h, shade("steel", 2));
  // The badge across its foot, the name in its middle.
  const by = bed.y + bed.h;
  s.rect(bed.x, by, bed.w, BADGE_H, look.badge());
  s.hline(bed.x, by, bed.w, look.edge());
  const name = fitText(f.gift ? f.gift.name : "more", bed.w - 3);
  drawText(s, bed.x + Math.floor((bed.w - textWidth(name)) / 2), by + 1, name, look.ink());
  const g = f.gift;
  if (!g) {
    const count = `+${f.more}`;
    drawTextLarge(s, bed.x + Math.floor((bed.w - textWidthLarge(count)) / 2), bed.y + Math.floor((bed.h - 2 * FONT_HEIGHT) / 2) + 1, count, shade("steel", 7));
    return;
  }
  if (g.kind === "government") {
    drawIconLarge(s, "crown", bed.x + Math.floor((bed.w - 16) / 2), bed.y + Math.floor((bed.h - 16) / 2));
    return;
  }
  const owner = slotColor(state.players[state.currentPlayer]!.color);
  if (g.kind === "unit") {
    // The unit standing on the bed's floor (a unit fills the lower part of its square), kept inside the bed.
    const t = Math.min(bed.w, bed.h + 4);
    drawUnitFigure(s, g.id, bed.x + Math.floor((bed.w - t) / 2), bed.y + bed.h - t, owner, { clip: bed }, t);
    return;
  }
  // The user's picture of it, as large as it fits; else the city view's drawn one, enlarged.
  const room = { x: bed.x + 1, y: bed.y + 1, w: bed.w - 2, h: bed.h - 2 };
  const pic = PICTURES[g.id];
  if (buildingArt(g.id)) s.art.push({ id: g.id, ...room, middle: true });
  else if (pic) drawEnlarged(s, room, rasterize(pic, owner), pic.w + 2, pic.h + 2);
}
