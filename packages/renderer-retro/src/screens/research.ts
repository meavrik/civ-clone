import { advance, advancesFor, BUILDINGS, UNIT_TYPES, WONDERS, type GameState } from "@civ/core";
import {
  researchBand,
  researchHint,
  researchOutlook,
  researchRows,
  researchTarget,
  researchTitle,
  techDetails,
  techIcons,
  type ResearchHit,
  type ResearchRow,
  type ResearchView,
  type TechLink,
  type TechStatus,
  PICTURES,
} from "@civ/renderer-api";
import { drawText, drawTextWrapped, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { drawIcon, drawIconLine, drawIconsWrapped, ICON, iconLineWidth } from "../icons.js";
import { unitSprite } from "../overlays.js";
import { drawPicture } from "../pictures.js";
import { SPRITE_CLEAR } from "../sprites/sheet.js";
import { C, shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawBox, drawButton, drawStone, drawTitleStrip, FADED, GOLD, GOOD, INK, NOTE, TITLE_H } from "../widgets.js";

/**
 * The research panel, built round the choice: under the title a band with the
 * research under way (or what the advance just found brings); on the left the
 * list of what can be researched now, what comes later and what is
 * discovered; on the right a card for the selected advance (what it brings,
 * what it needs, what it opens the way to, each of those a link to its own
 * card); along the bottom what to do next and the buttons.
 */

const BAND_Y = TITLE_H + 3;
const LIST = { x: 2, y: 27, w: 114, h: 158 };
const CARD = { x: 118, y: 27, w: SCREEN_W - 120, h: 158 };
const ROW = FONT_HEIGHT + 1;
/** Rows of the list on view at once. */
export const RESEARCH_LIST_ROWS = Math.floor((LIST.h - 4) / ROW);
const SCROLL_W = 5;
const BUTTON_Y = SCREEN_H - 13;

/** Labels for the advances whose names are too wide for a row; the card gives the full name. */
const SHORT: Record<string, string> = {
  genetic_engineering: "Genetic Eng.",
  theory_of_gravity: "Gravity",
  ceremonial_burial: "Cer. Burial",
  industrialization: "Industry",
  horseback_riding: "Horseback",
  the_corporation: "Corporation",
  mass_production: "Mass Prod.",
  advanced_flight: "Adv. Flight",
  superconductor: "Supercond.",
  nuclear_fission: "Fission",
  bridge_building: "Bridges",
  bronze_working: "Bronze",
  atomic_theory: "Atomic Th.",
  nuclear_power: "Nuclear Pwr",
  animal_husbandry: "Husbandry",
  renewable_energy: "Renewables",
  artificial_intelligence: "A.I.",
  quantum_computing: "Quantum",
  construction: "Construct.",
  mobile_phones: "Phones",
};

export function techLabel(node: { id: string; name: string }): string {
  return SHORT[node.id] ?? node.name;
}

const label = (id: string): string => techLabel({ id, name: advance(id).name });

/** Text colour on the stone for an advance in each state. */
const INK_OF: Record<TechStatus, number> = { known: GOOD, researching: shade("azure", 2), available: INK, locked: FADED };

/** A tick, 6 wide and 4 high. */
function tick(s: Surface, x: number, y: number, color: number): void {
  for (const [dx, dy] of [[0, 1], [1, 2], [2, 3], [3, 2], [4, 1], [5, 0], [1, 3], [2, 2]] as const) s.set(x + dx, y + dy, color);
}

/** A small diamond: brought within reach by the advance just found. */
function spark(s: Surface, x: number, y: number): void {
  for (let k = 0; k < 4; k++) s.hline(x + 3 - k, y + k, 1 + 2 * k, C.BLACK!);
  for (let k = 0; k < 3; k++) s.hline(x + 3 - k, y + 6 - k, 1 + 2 * k, C.BLACK!);
  for (let k = 0; k < 3; k++) s.hline(x + 3 - k, y + 1 + k, 1 + 2 * k, C.YELLOW!);
  for (let k = 0; k < 2; k++) s.hline(x + 3 - k, y + 5 - k, 1 + 2 * k, C.YELLOW!);
}

/** The mark before an advance's name: a bulb for the research under way, a tick when discovered. */
function mark(s: Surface, status: TechStatus, x: number, y: number, on: boolean): void {
  if (status === "researching") drawIcon(s, "bulb", x, y);
  else if (status === "known") tick(s, x + 1, y + 2, on ? C.WHITE! : GOOD);
}

// ---- the list --------------------------------------------------------------------------

function listRowY(i: number, top: number): number {
  return LIST.y + 2 + (i - top) * ROW;
}

function scrollBar(rows: number, top: number): { x: number; y: number; h: number; thumbY: number; thumbH: number } {
  const x = LIST.x + LIST.w - 2 - SCROLL_W;
  const y = LIST.y + 2;
  const h = RESEARCH_LIST_ROWS * ROW;
  const thumbH = Math.max(4, Math.round((h * RESEARCH_LIST_ROWS) / rows));
  const thumbY = y + Math.round(((h - thumbH) * top) / Math.max(1, rows - RESEARCH_LIST_ROWS));
  return { x, y, h, thumbY, thumbH };
}

function drawList(s: Surface, state: GameState, view: ResearchView, rows: ResearchRow[]): void {
  drawStone(s, LIST.x, LIST.y, LIST.w, LIST.h, true);
  const scrolls = rows.length > RESEARCH_LIST_ROWS;
  const right = LIST.x + LIST.w - 2 - (scrolls ? SCROLL_W + 1 : 0);
  rows.forEach((row, i) => {
    if (i < view.top || i >= view.top + RESEARCH_LIST_ROWS) return;
    const y = listRowY(i, view.top);
    if (row.kind === "header") {
      drawText(s, LIST.x + 4, y, row.text, DIM);
      const end = LIST.x + 6 + textWidth(row.text);
      if (end < right - 2) s.hline(end, y + 4, right - 2 - end, shade("panel", 2));
      return;
    }
    const sel = row.id === view.selected;
    if (sel) s.rect(LIST.x + 2, y - 1, right - LIST.x - 2, ROW, shade("azure", 2));
    mark(s, row.status, LIST.x + 4, y, sel);
    if (row.unlocked) spark(s, LIST.x + 4, y);
    const ink = sel ? C.WHITE! : row.fresh ? GOLD : INK_OF[row.status];
    drawText(s, LIST.x + 14, y, label(row.id), ink);
    // What it brings, as pictures, for what is still to come.
    if (row.group !== "known") {
      const icons = techIcons(state, row.id);
      icons.forEach((icon, k) => drawIcon(s, icon, right - 1 - (icons.length - k) * (ICON + 1), y));
    }
  });
  if (scrolls) {
    const b = scrollBar(rows.length, view.top);
    s.rect(b.x, b.y, SCROLL_W, b.h, shade("panel", 3));
    s.rect(b.x, b.thumbY, SCROLL_W, b.thumbH, shade("azure", 2));
  }
}

// ---- the card --------------------------------------------------------------------------

interface Rect { x: number; y: number; w: number; h: number; id: string }

/**
 * The card for the selected advance. Drawn when `s` is given; either way it
 * returns where its links lie, so drawing and hit-testing agree.
 */
function card(s: Surface | null, state: GameState, view: ResearchView): Rect[] {
  const links: Rect[] = [];
  const d = techDetails(state, view.selected);
  const fresh = view.discovered.includes(view.selected);
  const x0 = CARD.x + 5;
  const w = CARD.w - 10;
  const bottom = CARD.y + CARD.h - 3;
  if (s) {
    drawStone(s, CARD.x, CARD.y, CARD.w, CARD.h);
    const strip = d.status === "known" ? shade("grass", 1) : d.status === "locked" ? shade("panel", 1) : shade("azure", 1);
    drawTitleStrip(s, CARD.x + 2, CARD.y + 2, CARD.w - 4, d.name, { color: strip });
  }
  let y = CARD.y + TITLE_H + 5;
  const standing = fresh ? "Just discovered!" : d.standing;
  const ink = fresh ? GOLD : d.status === "available" ? NOTE : d.status === "researching" ? shade("azure", 2) : d.status === "known" ? GOOD : DIM;
  // Text wraps the same whether drawn or only measured, so the links land where they are drawn.
  const wrapped = (tx: number, ty: number, tw: number, text: string, color: number, max: number): number =>
    s ? drawTextWrapped(s, tx, ty, tw, text, color, max) : Math.min(max, wrapText(text, tw).length);
  y += wrapped(x0, y, w, standing, ink, 2) * FONT_HEIGHT + 2;
  const groove = (): void => {
    if (s) {
      s.hline(CARD.x + 3, y, CARD.w - 6, shade("panel", 2));
      s.hline(CARD.x + 3, y + 1, CARD.w - 6, shade("panel", 7));
    }
    y += 4;
  };
  groove();

  // What it brings.
  const labelW = Math.max(0, ...d.rows.map((r) => textWidth(r.label))) + 4;
  for (const row of d.rows) {
    if (y > bottom - 3 * ROW) break;
    if (s) {
      drawIcon(s, row.icon, x0, y);
      drawText(s, x0 + ICON + 2, y, row.label, DIM);
    }
    y += wrapped(x0 + ICON + 2 + labelW, y, w - ICON - 2 - labelW, row.items.join(", "), INK, 2) * FONT_HEIGHT + 1;
  }
  if (!d.rows.length) {
    if (s) drawText(s, x0, y, d.opens.length ? "Nothing by itself: it leads on." : "Nothing of its own.", DIM);
    y += ROW;
  }
  groove();

  // What it needs and what it opens the way to, each a link to its own card.
  const linkAt = (lx: number, ly: number, l: TechLink): number => {
    const text = label(l.id);
    const lw = 9 + textWidth(text);
    if (s) {
      mark(s, l.status, lx, ly, false);
      drawText(s, lx + 9, ly, text, INK_OF[l.status]);
      if (l.id === view.selected) s.hline(lx + 9, ly + FONT_HEIGHT, lw - 9, INK);
    }
    links.push({ x: lx, y: ly - 1, w: lw, h: ROW, id: l.id });
    return lx + lw;
  };
  const head = (text: string): void => { if (s) drawText(s, x0, y, text, DIM); };
  const col = x0 + Math.max(textWidth("Needs"), textWidth("Opens")) + 6;
  head("Needs");
  if (!d.needs.length) { if (s) drawText(s, col, y, "nothing: a first advance", DIM); }
  else {
    let x = col;
    for (const n of d.needs) x = linkAt(x, y, n) + 8;
  }
  y += ROW + 2;
  if (d.opens.length) {
    head("Opens");
    for (const o of d.opens) {
      if (y > bottom - ROW) break;
      const end = linkAt(col, y, o);
      // What else it waits for, so the advances ahead show what they need.
      if (s && o.status === "locked") {
        const also = o.also.length ? `with ${o.also.map(label).join(", ")}` : "then ready";
        drawTextWrapped(s, end + 5, y, CARD.x + CARD.w - 5 - end - 5, also, DIM, 1);
      }
      y += ROW;
    }
  }
  if (s) showcase(s, state, view.selected, y, bottom);
  return links;
}

/**
 * What the advance brings, as the city view draws it, standing on a strip of
 * grass along the bottom of the card where there is room: its wonders, then
 * its buildings, then its units.
 */
function showcase(s: Surface, state: GameState, id: string, top: number, bottom: number): void {
  const owner = state.players[state.currentPlayer]!.color;
  type Item = { w: number; h: number; draw: (x: number, ground: number) => void };
  const items: Item[] = [];
  for (const b of [...WONDERS.filter((w) => w.requires === id), ...BUILDINGS.filter((b) => b.requires === id)]) {
    const pic = PICTURES[b.id];
    if (pic) items.push({ w: pic.w, h: pic.h, draw: (x, ground) => drawPicture(s, pic, x, ground, slotColor(owner)) });
  }
  for (const u of UNIT_TYPES.filter((t) => t.requires === id)) {
    const sprite = unitSprite(u.id, slotColor(owner));
    items.push({ w: sprite.width, h: sprite.height, draw: (x, ground) => s.blit(sprite, x, ground - sprite.height, SPRITE_CLEAR) });
  }
  const gap = 8;
  const room = CARD.w - 16;
  const shown: Item[] = [];
  let w = 0;
  for (const it of items) {
    if (w + it.w + (shown.length ? gap : 0) > room) break;
    w += it.w + (shown.length ? gap : 0);
    shown.push(it);
  }
  if (!shown.length) return;
  const h = Math.max(...shown.map((it) => it.h));
  const ground = bottom - 2;
  if (ground - h - 4 < top) return; // no room under the links
  s.rect(CARD.x + 6, ground, CARD.w - 12, 2, shade("grass", 4));
  let x = CARD.x + Math.floor((CARD.w - w) / 2);
  for (const it of shown) { it.draw(x, ground); x += it.w + gap; }
}

// ---- the band, buttons and the whole panel ----------------------------------------------

function drawBand(s: Surface, state: GameState, view: ResearchView): void {
  const band = researchBand(state, view);
  if (band !== null) {
    drawIconsWrapped(s, 6, BAND_Y, SCREEN_W - 12, band, view.discovered.length ? GOLD : NOTE, 1);
    return;
  }
  const o = researchOutlook(state);
  drawIcon(s, "bulb", 6, BAND_Y);
  drawText(s, 6 + ICON + 2, BAND_Y, label(o.id!), INK);
  const after = `${o.have}/${o.cost}  {hourglass}${o.turns ?? "-"}`;
  const aw = iconLineWidth(after);
  const bx = 112;
  drawBox(s, bx, BAND_Y, SCREEN_W - 8 - aw - 6 - bx, 8, o.have, o.cost, C.LCYAN!);
  drawIconLine(s, SCREEN_W - 6 - aw, BAND_Y, after, DIM);
}

interface Button { x: number; w: number; label: string; hit: ResearchHit; primary: boolean }

function buttons(state: GameState, view: ResearchView): Button[] {
  const out: Button[] = [];
  let x = SCREEN_W - 6;
  const add = (text: string, hit: ResearchHit, primary = false): void => {
    const w = textWidth(text) + 12;
    x -= w;
    out.push({ x, w, label: text, hit, primary });
    x -= 4;
  };
  if (view.closable) add("Close", { kind: "close" });
  const target = researchTarget(state, view);
  if (target) add(target === view.selected ? "Research" : `Research ${label(target)}`, { kind: "research" }, true);
  return out;
}

export function drawResearch(s: Surface, state: GameState, view: ResearchView): void {
  const rows = researchRows(state, view);
  s.fill(C.BLACK!);
  const known = state.players[state.currentPlayer]!.advances.length;
  drawTitleStrip(s, 0, 0, SCREEN_W, researchTitle(state, view), { right: `${known}/${advancesFor(state).length}`, ...(view.discovered.length ? { color: shade("azure", 2) } : {}) });
  drawStone(s, 0, TITLE_H, SCREEN_W, SCREEN_H - TITLE_H);
  drawBand(s, state, view);
  drawList(s, state, view, rows);
  card(s, state, view);
  const bs = buttons(state, view);
  for (const b of bs) drawButton(s, b.x, BUTTON_Y, b.w, 11, b.label, true, b.primary);
  const hint = researchHint(state, view);
  const room = Math.min(SCREEN_W, ...bs.map((b) => b.x)) - 10;
  if (textWidth(hint) <= room) drawText(s, 6, BUTTON_Y + 2, hint, view.choosing ? NOTE : DIM);
}

/** What lies under a point of the research panel. */
export function researchHit(state: GameState, view: ResearchView, px: number, py: number): ResearchHit | null {
  for (const b of buttons(state, view)) if (px >= b.x && px < b.x + b.w && py >= BUTTON_Y && py < BUTTON_Y + 11) return b.hit;
  const rows = researchRows(state, view);
  if (px >= LIST.x && px < LIST.x + LIST.w && py >= LIST.y && py < LIST.y + LIST.h) {
    if (rows.length > RESEARCH_LIST_ROWS) {
      const b = scrollBar(rows.length, view.top);
      if (px >= b.x - 1) return py < b.thumbY ? { kind: "scroll", by: -RESEARCH_LIST_ROWS } : py >= b.thumbY + b.thumbH ? { kind: "scroll", by: RESEARCH_LIST_ROWS } : null;
    }
    const i = view.top + Math.floor((py - (LIST.y + 1)) / ROW);
    const row = i < view.top + RESEARCH_LIST_ROWS ? rows[i] : undefined;
    return row?.kind === "advance" ? { kind: "row", id: row.id } : null;
  }
  for (const l of card(null, state, view)) if (px >= l.x && px < l.x + l.w && py >= l.y && py < l.y + l.h) return { kind: "link", id: l.id };
  return null;
}
