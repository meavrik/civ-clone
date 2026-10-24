import {
  building,
  buyCost,
  cityFocus,
  cityTileYield,
  CITY_RADIUS,
  computeCity,
  cityCulture,
  cityYieldGovernment,
  cityFoci,
  cultureRate,
  foodKept,
  formatYear,
  getTile,
  nextBorderLevel,
  productionName,
  slotAvailable,
  slotInLand,
  Terrain,
  tileYield,
  turnToYear,
  wonder,
  type City,
  type CityFocus,
  type CityReport,
  type GameState,
} from "@civ/core";
import { citizenNote, citizenRole, citizenRow, CITIZENS_HINT, cityControlNote, cityLook, cityUnits, fieldSides, FOCUS_CORNERS, isWorker, MOOD_STAGE_ICONS, type CitizenMood, type IconName } from "@civ/renderer-api";
import { drawText, drawTextCentered, drawTextWrapped, FONT_HEIGHT, textWidth } from "../font.js";
import { drawFortress, drawGrassShield, drawIrrigation, drawMine, drawPollution, drawRailroad, drawRoad, unitSprite } from "../overlays.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { drawSpecial, fogSquare, terrainSquare, TILE } from "../tiles.js";
import { BAD, DIM, drawButton, drawCloseBox, drawStone, drawTitleStrip, drawWindow, FADED, GOLD, GOOD, INK, NOTE, stipple, TITLE_H } from "../widgets.js";
import { CITIZEN_H, CITIZEN_W, drawCitizen } from "../citizens.js";
import { drawIcon, drawIconFine, drawIconLine, ICON, iconInk, iconLineWidth } from "../icons.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { drawCity } from "./map-city.js";
import { playerColor } from "./main.js";

/** Height of a box's title strip and the line under it. */
const BOX_HEAD = TITLE_H + 1;

/**
 * City screen (320x200): stone windows on black, each with a blue title strip.
 *   title (View and the close box at its end), Happy and the citizens   across the top
 *   resources | map (the focus toggles in its corners) | improvements
 *   food store | units | production
 * No bar along the bottom (asked for 2026-10-24: its buttons became the icons above).
 */
const TOP = { y: 1, h: 28 };
const ROW1 = { y: 30, h: 84 };
const ROW2 = { y: 116, h: 83 };
const LEFT = { x: 1, w: 106 };
const MID = { x: 108, w: 84 };
const RIGHT = { x: 193, w: 126 };

export const CITY_MAP_X = MID.x + 2;
export const CITY_MAP_Y = ROW1.y + 2;

import type { CityButton, CityScreenView } from "@civ/renderer-api";

type Rect = { x: number; y: number; w: number; h: number };
const inRect = (b: Rect, px: number, py: number) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

/** The close box at the title strip's right end, as every window has, and View (the city's picture) beside it. */
const EXIT: Rect = { x: LEFT.x + SCREEN_W - 2 - 3 - (TITLE_H - 2), y: TOP.y + 3, w: TITLE_H - 2, h: TITLE_H - 2 };
const VIEW: Rect = { x: EXIT.x - 2 - EXIT.w, y: EXIT.y, w: EXIT.w, h: EXIT.h };

/** The row of citizens: Happy's face first, then each person standing on the top window's bottom edge, the specialists after a gap. */
const ROW_Y = TOP.y + TOP.h - 1 - CITIZEN_H;
const HAPPY: Rect = { x: 4, y: ROW_Y + 2, w: ICON + 2, h: ICON + 2 };
const ROW_X = HAPPY.x + HAPPY.w + 4;

/** The production box's buttons, under its title strip; View in the title strip; Happy before the citizens. */
const CITY_BUTTONS: Partial<Record<CityButton, Rect>> = {
  change: { x: RIGHT.x + 3, y: ROW2.y + BOX_HEAD + 2, w: 50, h: 11 },
  buy: { x: RIGHT.x + RIGHT.w - 51, y: ROW2.y + BOX_HEAD + 2, w: 48, h: 11 },
  view: VIEW,
  happy: HAPPY,
};

export function cityButtonAt(px: number, py: number): CityButton | null {
  for (const [id, b] of Object.entries(CITY_BUTTONS) as [CityButton, Rect][]) if (inRect(b, px, py)) return id;
  return null;
}

/** The close box leaves the city. */
export function cityExitHit(px: number, py: number): boolean {
  return inRect(EXIT, px, py);
}

/** The square of the map's corner holding a focus toggle (`FOCUS_CORNERS`, clockwise from the top left). */
function focusCorner(i: number): Rect {
  const [tx, ty] = ([[0, 0], [4, 0], [4, 4], [0, 4]] as const)[i]!;
  return { x: CITY_MAP_X + tx * TILE, y: CITY_MAP_Y + ty * TILE, w: TILE, h: TILE };
}

/** The focus toggle under a point: the map's four corners, which hold no square a city works. */
export function cityFocusAt(px: number, py: number): CityFocus | null {
  const i = FOCUS_CORNERS.findIndex((_, k) => inRect(focusCorner(k), px, py));
  return i >= 0 ? FOCUS_CORNERS[i]!.focus : null;
}

export function citySlotAt(px: number, py: number): number | null {
  const tx = Math.floor((px - CITY_MAP_X) / TILE);
  const ty = Math.floor((py - CITY_MAP_Y) / TILE);
  if (tx < 0 || tx > 4 || ty < 0 || ty > 4) return null;
  const dx = tx - 2;
  const dy = ty - 2;
  const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
  return slot >= 0 ? slot : null;
}

/** Top-left of the i-th unit's sprite in the units box (`cityUnits`); what it costs is drawn under it. */
export function cityUnitSlot(i: number): { x: number; y: number } {
  return { x: MID.x + 3 + (i % 4) * 20, y: ROW2.y + BOX_HEAD + 3 + Math.floor(i / 4) * 27 };
}
const UNIT_SLOTS = 8;

/** The unit under a point in the units box, sprite or cost: clicking it wakes it and takes it to the map. */
export function cityUnitAt(state: GameState, view: CityScreenView, px: number, py: number): number | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return null;
  const units = cityUnits(state, city).slice(0, UNIT_SLOTS);
  for (let i = 0; i < units.length; i++) {
    const { x, y } = cityUnitSlot(i);
    if (px >= x - 1 && px < x + 19 && py >= y - 1 && py < y + 26) return units[i]!.unit.id;
  }
  return null;
}

const SPECIALIST_GAP = 5;
/** The row keeps clear of the note beside it up to here, closing up for a big city. */
const ROW_END = 200;

/** Where each person of the row (`citizenRow`) stands, and how far apart they stand. */
function citizenSpots(row: readonly CitizenMood[]): { xs: number[]; pitch: number } {
  const gap = row.some(isWorker) && row.some((w) => !isWorker(w)) ? SPECIALIST_GAP : 0;
  const pitch = Math.max(3, Math.min(CITIZEN_W + 2, Math.floor((ROW_END - ROW_X - gap) / Math.max(1, row.length))));
  const xs: number[] = [];
  let x = ROW_X;
  row.forEach((who, i) => {
    if (i > 0 && !isWorker(who) && isWorker(row[i - 1]!)) x += gap;
    xs.push(x);
    x += pitch;
  });
  return { xs, pitch };
}

/** The person under a point in the row of citizens: a click changes their job (the web app's `changeCitizen`). */
export function cityCitizenAt(state: GameState, view: CityScreenView, px: number, py: number): number | null {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city || py < ROW_Y - 1 || py >= TOP.y + TOP.h) return null;
  const { xs, pitch } = citizenSpots(citizenRow(state, city));
  for (let i = xs.length - 1; i >= 0; i--) if (px >= xs[i]! - 1 && px < xs[i]! + Math.max(pitch, CITIZEN_W) - 1) return i;
  return null;
}

/** A unit away from the city: every other pixel of its square goes back to stone. */
function ghost(s: Surface, x: number, y: number): void {
  for (let dy = 0; dy < TILE; dy++) for (let dx = dy & 1; dx < TILE; dx += 2) stipple(s, x + dx, y + dy, 1, 1, "panel");
}

function say(s: Surface, x: number, y: number, text: string, color: number): number {
  return drawText(s, x, y, text, color);
}
const LABEL = DIM;

/** One of the city screen's boxes: a window with its title strip. */
function drawBox(s: Surface, x: number, y: number, w: number, h: number, title = "", right = ""): void {
  drawWindow(s, x, y, w, h, title, right ? { right } : {});
}

/**
 * A worked square's yield in the City Resources box's own icons, straight on the ground (they carry
 * their outlines): food along the top half, shields then trade along the bottom, one row centred when
 * the other is empty. A row too long for the square closes up until its icons overlap.
 */
function yieldIcons(s: Surface, x: number, y: number, food: number, shields: number, trade: number): void {
  const half = (TILE * s.k) / 2;
  // A margin at each side, so a square's row never runs on into its neighbour's.
  const margin = 2;
  const side = TILE * s.k - 2 * margin;
  const rows: IconName[][] = [Array<IconName>(food).fill("food"), [...Array<IconName>(shields).fill("shield"), ...Array<IconName>(trade).fill("trade")]].filter((r) => r.length > 0);
  rows.forEach((icons, r) => {
    const fy = y * s.k + (rows.length === 1 ? half / 2 : r * half);
    const inks = icons.map(iconInk);
    const natural = inks.reduce((t, k) => t + k.w, 0) + icons.length - 1;
    const widest = Math.max(...inks.map((k) => k.w));
    const step = natural <= side ? null : (side - widest) / (icons.length - 1);
    let at = step === null ? Math.floor((side - natural) / 2) : 0;
    icons.forEach((icon, i) => {
      const ink = inks[i]!;
      drawIconFine(s, icon, x * s.k + margin + (step === null ? at : Math.round(i * step)) - ink.x, fy);
      at += ink.w + 1;
    });
  });
}

/**
 * Icons in a row no wider than `w`, the groups a few pixels apart; when they do not
 * fit side by side they overlap, as the original's city screen stacks its goods.
 */
function iconRow(s: Surface, x: number, y: number, w: number, groups: [IconName, number][]): void {
  const shown = groups.filter(([, n]) => n > 0);
  const n = shown.reduce((t, [, k]) => t + k, 0);
  if (n === 0) return;
  const gap = 3;
  const room = w - ICON - gap * (shown.length - 1);
  const step = n > 1 ? Math.min(ICON + 1, room / (n - 1)) : 0;
  let at = 0;
  shown.forEach(([icon, k], g) => {
    for (let i = 0; i < k; i++, at++) drawIcon(s, icon, x + Math.round(at * step) + g * gap, y);
  });
}

/**
 * A slot's goods: one icon, or when a slot stands for more than one a stack of them, each a fine pixel
 * up and right of the one under it, up to three deep (asked for 2026-10-24, in place of a "{shield}=2" key).
 */
function drawStack(s: Surface, icon: IconName, x: number, y: number, n: number): void {
  for (let i = Math.min(3, n) - 1; i >= 0; i--) drawIconFine(s, icon, x * s.k + i, y * s.k - i);
}

/** The room a box leaves for its store between `top` and `bottom`: inside its frame, a few pixels in from every side. */
function storeRegion(box: { x: number; w: number }, top: number, bottom: number): Rect {
  const pad = 4;
  return { x: box.x + pad, y: top + pad, w: box.w - 2 * pad, h: bottom - top - 2 * pad };
}

/** A store's slots: ten across (the boxes count in tens), each an icon's size, a pixel apart. */
const STORE_COLS = 10;
const SLOT_PITCH = ICON + 1;

/**
 * How a store of `box` goods fills its slots in a region: one slot for `per` goods (more than one only
 * when the box has more goods than the region has slots), `rows` of STORE_COLS, the grid's top left at
 * (x, y) so that it stands in the middle of the region, the same room either side and above as below.
 */
export function storeLayout(region: Rect, box: number): { per: number; slots: number; rows: number; x: number; y: number } {
  const maxRows = Math.max(1, Math.floor((region.h + 1) / SLOT_PITCH));
  const per = Math.max(1, Math.ceil(box / (STORE_COLS * maxRows)));
  const slots = Math.ceil(box / per);
  const rows = Math.ceil(slots / STORE_COLS);
  const w = STORE_COLS * SLOT_PITCH - 1;
  const h = rows * SLOT_PITCH - 1;
  return { per, slots, rows, x: region.x + Math.floor((region.w - w) / 2), y: region.y + Math.floor((region.h - h) / 2) };
}

/**
 * A store of goods (food toward the next citizen, shields toward the build) as empty slots waiting to
 * be filled, `have` of them holding the icon (a stack of them when a slot stands for more than one).
 * The first `keep` goods' slots (what a Granary keeps when the city grows) are edged in gold.
 */
function drawStore(s: Surface, region: Rect, icon: IconName, have: number, box: number, keep = 0): void {
  const { per, slots, x, y } = storeLayout(region, box);
  const filled = Math.min(slots, Math.floor(have / per));
  const kept = Math.floor(keep / per);
  for (let i = 0; i < slots; i++) {
    const sx = x + (i % STORE_COLS) * SLOT_PITCH;
    const sy = y + Math.floor(i / STORE_COLS) * SLOT_PITCH;
    s.rect(sx, sy, ICON, ICON, shade("panel", 4));
    const edge = i < kept ? shade("wheat", 1) : shade("panel", 3);
    s.frect(sx * s.k, sy * s.k, ICON * s.k, 1, edge);
    s.frect(sx * s.k, (sy + ICON) * s.k - 1, ICON * s.k, 1, edge);
    s.frect(sx * s.k, sy * s.k, 1, ICON * s.k, edge);
    s.frect((sx + ICON) * s.k - 1, sy * s.k, 1, ICON * s.k, edge);
    if (i < filled) drawStack(s, icon, sx, sy, per);
  }
}

/**
 * The resources box: a row for each of food, shields and trade, then for each share of the trade
 * (tax, luxuries, science): its name, its icons, and at the right what is left or lost. The map's
 * squares carry the same icons; the buildings' upkeep heads the improvements.
 */
function drawResources(s: Surface, r: CityReport): void {
  drawBox(s, LEFT.x, ROW1.y, LEFT.w, ROW1.h, "City Resources");
  const lx = LEFT.x + 3;
  const rx = lx + textWidth("Shields") + 4;
  const rw = LEFT.x + LEFT.w - 15 - rx;
  const num = (y: number, text: string, color: number) => say(s, LEFT.x + LEFT.w - 3 - textWidth(text), y, text, color);
  let y = ROW1.y + BOX_HEAD + 3;
  const line = (label: string, groups: [IconName, number][]) => {
    say(s, lx, y, label, LABEL);
    iconRow(s, rx, y, rw, groups);
  };
  const surplus = Math.max(0, r.foodSurplus);
  line("Food", [["food", r.food - surplus], ["food", surplus]]);
  num(y, `${r.foodSurplus > 0 ? "+" : ""}${r.foodSurplus}`, r.foodSurplus < 0 ? BAD : r.foodSurplus > 0 ? GOOD : INK);
  y += 10;
  // Shields that go to unit support, and trade lost to corruption, stand apart at the end of their row.
  const upkeep = Math.min(r.shields, r.unitShields);
  line("Shields", [["shield", r.shields - upkeep], ["shield", upkeep]]);
  if (r.unitShields) num(y, `-${r.unitShields}`, BAD);
  y += 10;
  line("Trade", [["trade", r.trade - r.corruption], ["trade", r.corruption]]);
  if (r.corruption) num(y, `-${r.corruption}`, BAD);
  y += 10;
  // Where the trade goes, a row each, always in the same places.
  for (const [label, icon, n] of [["Tax", "coin", r.tax], ["Lux", "gem", r.lux], ["Sci", "bulb", r.science]] as const) {
    line(label, [[icon, n]]);
    y += 10;
  }
  const extra = [r.routes ? `Routes +${r.routes}` : "", r.influence ? `Influence +${r.influence}` : "", r.pollution > 0 ? `{pollution} ${r.pollution}%` : ""].filter(Boolean);
  if (extra.length) drawIconLine(s, lx, y, extra.join("  "), LABEL);
}

/**
 * The Happy panel, in the resources box's place (the original's Happy button): the people after each
 * stage of the reckoning (born, luxuries, buildings, soldiers, wonders), each stage marked by its icon,
 * faded when it moved nobody. The same person stands in the same place on every row, so one can be followed.
 */
function drawMoods(s: Surface, city: City, r: CityReport): void {
  drawBox(s, LEFT.x, ROW1.y, LEFT.w, ROW1.h, "Citizens");
  const rowH = Math.floor((ROW1.h - BOX_HEAD - 2) / r.moods.length);
  const x0 = LEFT.x + 3 + ICON + 3;
  const room = LEFT.x + LEFT.w - 3 - CITIZEN_W - x0;
  r.moods.forEach((m, i) => {
    const y = ROW1.y + BOX_HEAD + 1 + i * rowH;
    const prev = r.moods[i - 1];
    const moved = !prev || prev.happy !== m.happy || prev.content !== m.content || prev.unhappy !== m.unhappy;
    const ix = LEFT.x + 3;
    const iy = y + Math.floor((rowH - ICON) / 2);
    drawIcon(s, MOOD_STAGE_ICONS[m.stage], ix, iy);
    if (!moved) for (let dy = 0; dy < ICON; dy++) for (let dx = dy & 1; dx < ICON; dx += 2) stipple(s, ix + dx, iy + dy, 1, 1, "panel");
    const n = m.happy + m.content + m.unhappy;
    const step = n > 1 ? Math.min(CITIZEN_W + 1, room / (n - 1)) : 0;
    let k = 0;
    const people = (mood: "happy" | "content" | "unhappy", count: number) => {
      for (let j = 0; j < count; j++, k++) drawCitizen(s, x0 + Math.round(k * step), y + rowH - CITIZEN_H, mood, city.id, k);
    };
    people("happy", m.happy);
    people("content", m.content);
    people("unhappy", m.unhappy);
  });
}

export function drawCityScreen(s: Surface, state: GameState, view: CityScreenView): void {
  const city = state.cities.find((c) => c.id === view.city);
  if (!city) return;
  const player = state.players[city.owner]!;
  const r = computeCity(state, city);
  s.fill(C.BLACK!);

  // Title and citizens; the strip turns red while the city riots.
  drawBox(s, LEFT.x, TOP.y, SCREEN_W - 2, TOP.h);
  drawTitleStrip(s, LEFT.x + 2, TOP.y + 2, SCREEN_W - 6, `${city.name} (Pop ${city.size})   ${formatYear(turnToYear(state.turn))}`, { centred: true, ...(r.disorder ? { color: C.RED! } : {}) });
  // The way out, and the city's picture, at the strip's end.
  drawButton(s, VIEW.x, VIEW.y, VIEW.w, VIEW.h, "");
  drawIconFine(s, "city", VIEW.x * s.k + 1, VIEW.y * s.k + 1);
  drawCloseBox(s, EXIT.x, EXIT.y);
  // Happy: the citizens' feelings stage by stage, lit while that panel is up.
  if (view.happy) s.rect(HAPPY.x, HAPPY.y, HAPPY.w, HAPPY.h, shade("azure", 2));
  else if (view.hoverControl === "happy") s.rect(HAPPY.x, HAPPY.y, HAPPY.w, HAPPY.h, shade("panel", 7));
  drawIcon(s, "happy", HAPPY.x + 1, HAPPY.y + 1);
  // Each citizen a person of their own (`citizenLook`), standing on the window's bottom edge; the one
  // under the pointer lit, and told of beside the row (a click changes their job).
  const row = citizenRow(state, city);
  const { xs, pitch } = citizenSpots(row);
  const lit = view.hover !== undefined && view.hover < row.length ? view.hover : null;
  if (lit !== null) s.rect(xs[lit]! - 1, ROW_Y - 1, Math.max(pitch, CITIZEN_W) + 1, CITIZEN_H + 1, shade("panel", 7));
  row.forEach((who, i) => drawCitizen(s, xs[i]!, ROW_Y, who, city.id, i));
  // The city's standing, as it is now: riots, a festival, or one lost happy citizen from riots.
  const standing = r.disorder ? (["CIVIL DISORDER", BAD] as const) : r.celebration ? (["CELEBRATING", GOOD] as const) : r.unhappy > 0 && r.unhappy === r.happy ? (["UNREST", GOLD] as const) : null;
  const standX = standing ? SCREEN_W - 6 - textWidth(standing[0]) : SCREEN_W - 4;
  if (standing) say(s, standX, TOP.y + BOX_HEAD + 4, standing[0], standing[1]);
  const noteX = (xs.length ? xs[xs.length - 1]! + pitch : ROW_X) + 6;
  // Beside the row: what is pointed at (a big city's row leaves room for who a citizen is only), else
  // the latest word, else the hint.
  const room = standX - 6 - noteX;
  const control = view.hoverControl !== undefined ? cityControlNote(state, city, view.hoverControl) : null;
  const [note, ink] =
    lit !== null ? [textWidth(citizenNote(row[lit]!)) <= room ? citizenNote(row[lit]!) : citizenRole(row[lit]!), INK]
    : control ? [control, INK]
    : view.message ? [view.message, NOTE]
    : [CITIZENS_HINT, FADED];
  if (textWidth(note) <= room) say(s, noteX, TOP.y + BOX_HEAD + 4, note, ink);
  else drawTextWrapped(s, noteX, TOP.y + BOX_HEAD + 4, room, note, ink, 1);

  if (view.happy) drawMoods(s, city, r);
  else drawResources(s, r);
  let y = 0;

  // Resource map.
  drawBox(s, MID.x, ROW1.y, MID.w, ROW1.h);
  const me = state.players[state.currentPlayer]!;
  s.rect(CITY_MAP_X - 1, CITY_MAP_Y - 1, 82, 82, C.BLACK!);
  for (let ty = 0; ty < 5; ty++)
    for (let tx = 0; tx < 5; tx++) {
      const dx = tx - 2;
      const dy = ty - 2;
      const px = CITY_MAP_X + tx * TILE;
      const py = CITY_MAP_Y + ty * TILE;
      const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
      const mx = city.x + dx;
      const my = city.y + dy;
      const tile = getTile(state.map, mx, my);
      if (slot < 0 || !tile) {
        s.rect(px, py, TILE, TILE, C.BLACK!);
        continue;
      }
      const wx = (mx + state.map.width) % state.map.width;
      const fog = fogSquare(state.map, me.explored, wx, my);
      if (!me.explored[my * state.map.width + wx]) {
        s.blit(fog!, px, py);
        continue;
      }
      const ground = terrainSquare(state.map, wx, my, me.explored);
      s.blit(ground, px, py);
      if (tile.irrigation) drawIrrigation(s, px, py, ground, tile.terrain, wx, my, fieldSides(state.map, me.explored, wx, my));
      if (tile.grassShield && tile.terrain === Terrain.Grassland) drawGrassShield(s, px, py, ground);
      drawRoad(s, px, py, state.map, me.explored, wx, my, ground);
      drawRailroad(s, px, py, state.map, me.explored, wx, my);
      if (tile.mine) drawMine(s, px, py);
      if (tile.special) drawSpecial(s, px, py, tile);
      if (tile.fortress) drawFortress(s, px, py);
      if (tile.pollution) drawPollution(s, px, py);
      if (fog) s.blit(fog, px, py, SPRITE_CLEAR);
      const worked = slot === 0 || city.worked.includes(slot);
      if (worked) {
        const y = cityTileYield(state, city, slot) ?? tileYield(state, tile, slot === 0, cityYieldGovernment(state, city), city.owner);
        if (slot === 0) drawCity(s, px, py - 1, city, cityLook(state, city), playerColor(state, city.owner));
        yieldIcons(s, px, py, y.food, y.shields, y.trade);
      } else if (!slotInLand(state, city, slot)) {
        // Beyond the city's border (or on a rival's land): shaded, it cannot be worked.
        for (let yy = 0; yy < TILE; yy++) for (let xx = (yy & 1); xx < TILE; xx += 2) s.set(px + xx, py + yy, C.BLACK!);
      } else if (!slotAvailable(state, city, slot)) {
        // Hatch tiles another city works or a foreign unit stands on.
        for (let k = 0; k < TILE; k += 2) s.set(px + k, py + (k % 4 === 0 ? 0 : 1) + ((k * 7) % TILE), C.LRED!);
      }
    }
  // The city's border, where its land meets squares it cannot work.
  const inLand = (dx: number, dy: number): boolean | null => {
    const slot = CITY_RADIUS.findIndex(([ox, oy]) => ox === dx && oy === dy);
    return slot < 0 || !getTile(state.map, city.x + dx, city.y + dy) ? null : slotInLand(state, city, slot);
  };
  const edge = playerColor(state, city.owner);
  for (let ty = 0; ty < 5; ty++)
    for (let tx = 0; tx < 5; tx++) {
      if (inLand(tx - 2, ty - 2) !== true) continue;
      const px = CITY_MAP_X + tx * TILE;
      const py = CITY_MAP_Y + ty * TILE;
      if (inLand(tx - 1, ty - 2) === false) s.rect(px + TILE - 1, py, 1, TILE, edge);
      if (inLand(tx - 3, ty - 2) === false) s.rect(px, py, 1, TILE, edge);
      if (inLand(tx - 2, ty - 1) === false) s.rect(px, py + TILE - 1, TILE, 1, edge);
      if (inLand(tx - 2, ty - 3) === false) s.rect(px, py, TILE, 1, edge);
    }

  // The focus toggles in the map's corners: lit for each focus the city works for (any of them together).
  const foci = cityFoci(state, city);
  FOCUS_CORNERS.forEach(({ focus, icon }, i) => drawFocusToggle(s, focusCorner(i), icon, foci.includes(focus), view.hoverControl === focus));

  // Improvements, wonders in yellow, each building with its upkeep.
  drawBox(s, RIGHT.x, ROW1.y, RIGHT.w, ROW1.h, "Improvements", r.buildingUpkeep ? `Upkeep ${r.buildingUpkeep}$` : "");
  const lines = [
    ...city.wonders.map((w) => ({ name: wonder(w).name, color: GOLD, upkeep: 0 })),
    ...city.buildings.map((b) => ({ name: building(b).name, color: INK, upkeep: building(b).upkeep })),
  ];
  // The last line is the city's culture, unless borders never grow (old saves).
  const fit = Math.floor((ROW1.h - BOX_HEAD - 4) / FONT_HEIGHT) - (state.fixedBorders ? 0 : 1);
  const shown = lines.length > fit ? lines.slice(0, fit - 1) : lines;
  y = ROW1.y + BOX_HEAD + 3;
  for (const l of shown) {
    say(s, RIGHT.x + 4, y, l.name, l.color);
    if (l.upkeep) say(s, RIGHT.x + RIGHT.w - 4 - textWidth(`${l.upkeep}$`), y, `${l.upkeep}$`, LABEL);
    y += FONT_HEIGHT;
  }
  if (shown.length < lines.length) say(s, RIGHT.x + 4, y, `and ${lines.length - shown.length} more`, LABEL);
  if (!lines.length) say(s, RIGHT.x + 4, y, "None yet", LABEL);
  // Culture toward the level where the border grows next (and, in old saves, what a turn adds).
  if (!state.fixedBorders) {
    const cy = ROW1.y + ROW1.h - 3 - FONT_HEIGHT;
    const next = nextBorderLevel(state, city);
    drawIconLine(s, RIGHT.x + 4, cy, `{culture} Culture ${cityCulture(state, city)}${next === null ? "" : `/${next}`}`, INK);
    if (state.accruedCulture) {
      const gain = `+${cultureRate(state, city)}`;
      say(s, RIGHT.x + RIGHT.w - 4 - textWidth(gain), cy, gain, GOOD);
    }
  }

  // Food store, filling toward the next citizen; a Granary's half (or a trait's share) above its line.
  drawBox(s, LEFT.x, ROW2.y, LEFT.w, ROW2.h, "Food", `${city.food}/${r.foodBox}`);
  const kept = foodKept(state, city, r.foodBox);
  const keptBy = city.buildings.some((b) => building(b).granary) ? "Granary" : "Kept";
  const footY = ROW2.y + ROW2.h - 10;
  drawStore(s, storeRegion(LEFT, ROW2.y + BOX_HEAD + 1, footY - 1), "food", city.food, r.foodBox, kept);
  const grow = r.foodSurplus > 0 ? Math.ceil(Math.max(0, r.foodBox - city.food) / r.foodSurplus) : null;
  const growX = say(s, LEFT.x + 4, footY, r.foodSurplus < 0 ? "Starving!" : grow === null ? "Not growing" : `Grows in ${grow} turn${grow === 1 ? "" : "s"}`, r.foodSurplus < 0 ? BAD : LABEL);
  // The gold-edged slots are what the Granary keeps (or a trait's share): named in gold, room allowing.
  const keyX = LEFT.x + LEFT.w - 4;
  if (kept > 0 && keyX - textWidth(keptBy) > growX + 4) say(s, keyX - textWidth(keptBy), footY, keptBy, GOLD);

  // Units in the city, then those it supports elsewhere (half hidden in the stone), each with what
  // it costs the city: a shield beyond the free ones, food for settlers.
  const units = cityUnits(state, city);
  drawBox(s, MID.x, ROW2.y, MID.w, ROW2.h, "Units", String(units.length));
  units.slice(0, UNIT_SLOTS).forEach(({ unit, here, shields, food }, i) => {
    const { x: ux, y: uy } = cityUnitSlot(i);
    s.blit(unitSprite(unit.type, playerColor(state, unit.owner)), ux, uy, SPRITE_CLEAR);
    if (!here) ghost(s, ux, uy);
    let ix = ux;
    if (shields) { drawIcon(s, "shield", ix, uy + 17); ix += ICON; }
    if (food) drawIcon(s, "food", ix, uy + 17);
  });
  if (units.length > UNIT_SLOTS) say(s, MID.x + MID.w - 4 - textWidth(`+${units.length - UNIT_SLOTS}`), ROW2.y + ROW2.h - 10, `+${units.length - UNIT_SLOTS}`, LABEL);

  // Production: what is being built, its shields as icons, how long, and the price to buy it now.
  const p = city.production;
  drawBox(s, RIGHT.x, ROW2.y, RIGHT.w, ROW2.h, productionName(p), `${city.shields}/${r.productionCost}`);
  const cost = buyCost(state, city);
  const change = CITY_BUTTONS.change!;
  const buy = CITY_BUTTONS.buy!;
  drawButton(s, change.x, change.y, change.w, change.h, "Change");
  drawButton(s, buy.x, buy.y, buy.w, buy.h, "Buy", cost > 0 && player.gold >= cost);
  // The shields' slots between the buttons and the foot, beside the unit being built.
  const by = ROW2.y + ROW2.h - 10;
  const top = change.y + change.h;
  let region = storeRegion(RIGHT, top, by - 1);
  if (p.kind === "unit") {
    s.blit(unitSprite(p.id, playerColorOf(state, city.owner)), RIGHT.x + 4, top + Math.floor((by - 1 - top - TILE) / 2), SPRITE_CLEAR);
    region = { ...region, x: region.x + 18, w: region.w - 18 };
  }
  drawStore(s, region, "shield", city.shields, r.productionCost);
  const turns = r.shieldSurplus > 0 ? Math.ceil(Math.max(0, r.productionCost - city.shields) / r.shieldSurplus) : null;
  say(s, RIGHT.x + 4, by, turns === null ? "Never" : `${turns} turn${turns === 1 ? "" : "s"}`, LABEL);
  const price = cost ? `Buy ${cost}$` : "Complete";
  say(s, RIGHT.x + RIGHT.w - 4 - textWidth(price), by, price, cost && player.gold >= cost ? GOLD : LABEL);

}

/**
 * A focus toggle in a corner of the map: the focus's icon on a dark tile, lit blue with a bright edge
 * when the city works for it, faded when it does not, a shade lighter under the pointer.
 */
function drawFocusToggle(s: Surface, b: Rect, icon: IconName, on: boolean, hover: boolean): void {
  const k = s.k;
  const x = b.x + 1;
  const y = b.y + 1;
  const w = b.w - 2;
  const h = b.h - 2;
  const ground = on ? shade("azure", 2) : hover ? shade("panel", 2) : shade("panel", 1);
  s.rect(x, y, w, h, ground);
  const edge = on ? shade("azure", 7) : shade("panel", 3);
  s.frect(x * k, y * k, w * k, 1, edge);
  s.frect(x * k, (y + h) * k - 1, w * k, 1, edge);
  s.frect(x * k, y * k, 1, h * k, edge);
  s.frect((x + w) * k - 1, y * k, 1, h * k, edge);
  const ix = b.x + (b.w - ICON) / 2;
  const iy = b.y + (b.h - ICON) / 2;
  drawIcon(s, icon, ix, iy);
  // Off: every other pixel of the icon back to the tile, so the lit ones stand out.
  if (!on) for (let yy = 0; yy < ICON * k; yy++) for (let xx = yy & 1; xx < ICON * k; xx += 2) s.fset(ix * k + xx, iy * k + yy, ground);
}

function playerColorOf(state: GameState, owner: number): number {
  return playerColor(state, owner);
}

export type { City };
