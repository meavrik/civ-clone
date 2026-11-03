import { advance, RESOURCE_BY_ID, type GameState } from "@civ/core";
import { resourcesView, type ResourceStatus } from "@civ/renderer-api";
import { drawText, FONT_HEIGHT, textWidth } from "../font.js";
import { drawIcon } from "../icons.js";
import { drawUnitFigure } from "../overlays.js";
import { C, shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, type Surface } from "../surface.js";
import { drawResourceIcon } from "../tiles.js";
import { DIM, drawPage, drawSwatch, FADED, GOOD, INK, BAD } from "../widgets.js";
import { playerColor } from "./main.js";

/**
 * Advisors > Resources (redone 2026-10-31, asked for: "improve the resources main window"; it was the report page's
 * rows of grey words): a band for each strategic resource, its picture (the user's resource icon; a dark slot with a
 * question mark while it is unseen) on a sunken tile, its name and a badge of how we stand with it in the badge's own
 * colour (held green, traded in blue, wanting a road amber, traded away or none grey, unseen dark), a line of where it
 * lies or what is missing, and the units that need it as their pictures, those we could build but for it lit, the rest
 * faded; under them our trades, each with the other civilization's shield and the gold a turn it brings or costs, and
 * the trades' gold a turn all told. `resourcesView` in renderer-api says what; this lays it out.
 */

const TOP = 20;
const BAND = 25;
/** Room kept under the bands for the trades: their heading and three rows, above the page's hint. */
const TRADES_ROOM = 46;
const ICON_X = 10;
const TEXT_X = 34;
/** The units' pictures stand right of the words, 17 pixels apart, at most `UNITS_SHOWN`. */
const UNITS_SHOWN = 5;
const UNIT_STEP = 17;

/** The badge's colour, by how we stand with the resource. */
function badgeColor(status: ResourceStatus): { fill: number; ink: number } {
  switch (status) {
    case "held": return { fill: shade("leaf", 2), ink: C.WHITE! };
    case "imported": return { fill: shade("azure", 2), ink: C.WHITE! };
    case "road": return { fill: C.BROWN!, ink: C.WHITE! };
    case "away": return { fill: shade("panel", 2), ink: C.WHITE! };
    case "none": return { fill: shade("panel", 3), ink: shade("panel", 7) };
    case "unseen": return { fill: shade("panel", 0), ink: shade("panel", 5) };
  }
}

/** A badge: its word in capitals on a plate of its colour, a pixel of room above and below the letters set at `y`. */
function badge(s: Surface, x: number, y: number, word: string, status: ResourceStatus): number {
  const { fill, ink } = badgeColor(status);
  const text = word.toUpperCase();
  const w = textWidth(text) + 6;
  s.rect(x, y - 1, w, FONT_HEIGHT + 2, fill);
  drawText(s, x + 3, y, text, ink);
  return w;
}

/** A sunken tile 18 pixels a side, dark inside: the resource's picture on it. */
function tile(s: Surface, x: number, y: number): void {
  s.rect(x, y, 18, 18, shade("panel", 1));
  s.hline(x, y + 17, 18, shade("panel", 6));
  s.vline(x + 17, y, 18, shade("panel", 6));
  s.rect(x + 1, y + 1, 16, 16, shade("panel", 0));
}

/** Text cut to `w` pixels, an ellipsis where it was cut. */
function fit(text: string, w: number): string {
  if (textWidth(text) <= w) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}...`) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

export function drawResourcesAdvisor(s: Surface, state: GameState): void {
  const view = resourcesView(state);
  drawPage(s, "Strategic Resources", view.hint ? `${view.hint}   (any key)` : "(any key)");
  if (view.none) { drawText(s, 12, 26, view.none, DIM); return; }
  const me = state.currentPlayer;
  const color = playerColor(state, me);
  const unitsX = SCREEN_W - 10 - UNITS_SHOWN * UNIT_STEP;
  // Six resources since save version 53 (Elephants): the bands close up a little to leave the trades their rows.
  const band = Math.min(BAND, Math.floor((SCREEN_H - TOP - TRADES_ROOM) / Math.max(1, view.entries.length)));
  view.entries.forEach((e, i) => {
    const y = TOP + 2 + i * band;
    if (i) s.hline(8, y - 3, SCREEN_W - 16, shade("panel", 3));
    // The resource's picture, or a question mark while it is unseen.
    tile(s, ICON_X, y);
    if (e.status !== "unseen") drawResourceIcon(s, RESOURCE_BY_ID[e.id]?.special.name ?? e.id, ICON_X + 1, y + 1);
    else drawText(s, ICON_X + 7, y + 5, "?", shade("panel", 5));
    // Its name and its badge, the line of where it stands under them.
    const lacking = e.status === "none" || e.status === "away" || e.status === "unseen";
    drawText(s, TEXT_X, y + 1, e.id, lacking ? FADED : INK);
    badge(s, TEXT_X + textWidth(e.id) + 5, y + 1, e.badge, e.status);
    const tone = e.status === "road" ? BAD : lacking ? FADED : DIM;
    drawText(s, TEXT_X, y + 11, fit(e.detail, unitsX - TEXT_X - 6), tone);
    // The units that need it, those we could build but for it lit, the rest faded; more than fit, the last slot says how many more.
    const over = e.units.length > UNITS_SHOWN;
    const shown = e.units.slice(0, over ? UNITS_SHOWN - 1 : UNITS_SHOWN);
    shown.forEach((u, k) => {
      const ux = unitsX + k * UNIT_STEP;
      const lit = e.buildable.includes(u) && !lacking;
      drawUnitFigure(s, u, ux, y + 2, color, lit ? {} : { dim: true });
    });
    if (over) {
      const more = `+${e.units.length - shown.length}`;
      drawText(s, unitsX + shown.length * UNIT_STEP + Math.floor((UNIT_STEP - textWidth(more)) / 2), y + 6, more, FADED);
    }
  });
  // Our trades, and the gold a turn they bring all told.
  let y = TOP + view.entries.length * band + 2;
  s.hline(8, y - 3, SCREEN_W - 16, shade("panel", 2));
  drawText(s, 12, y, "Trades", DIM);
  if (view.income) {
    const total = `${view.income > 0 ? "+" : ""}${view.income} gold a turn`;
    drawIcon(s, "coin", SCREEN_W - 12 - textWidth(total) - 10, y);
    drawText(s, SCREEN_W - 12 - textWidth(total), y, total, view.income > 0 ? GOOD : BAD);
  }
  y += FONT_HEIGHT + 1;
  if (!view.trades.length) {
    drawText(s, 20, y, state.players[me]!.advances.includes("currency") ? "None yet: trade with a leader in an audience." : `None: trading needs ${advance("currency").name}.`, FADED);
    return;
  }
  // Rows down to the page's hint along its foot.
  const room = Math.floor((SCREEN_H - 16 - y) / FONT_HEIGHT);
  const list = view.trades.length > room ? view.trades.slice(0, room - 1) : view.trades;
  for (const t of list) {
    drawSwatch(s, 12, y, slotColor(t.slot));
    drawText(s, 22, y, fit(t.text, SCREEN_W - 100), INK);
    if (t.gold) {
      const g = `${t.gold > 0 ? "+" : ""}${t.gold} a turn`;
      drawText(s, SCREEN_W - 12 - textWidth(g), y, g, t.gold > 0 ? GOOD : BAD);
    }
    y += FONT_HEIGHT;
  }
  if (list.length < view.trades.length) drawText(s, 22, y, `and ${view.trades.length - list.length} more`, FADED);
}
