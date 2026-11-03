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
  artLot,
  PICTURES,
} from "@civ/renderer-api";
import { drawText, drawTextWrapped, FONT_HEIGHT, textWidth, wrapText } from "../font.js";
import { drawIcon, drawIconLine, drawIconsWrapped, drawMark, ICON, iconLineWidth } from "../icons.js";
import { drawUnitFigure } from "../overlays.js";
import { drawBuilding } from "../pictures.js";
import { TILE } from "../tiles.js";
import { C, shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, dimScreen, hideArtUnder, drawBox, drawButton, drawCloseBox, drawStone, drawTitleStrip, FADED, GOLD, GOOD, INK, NOTE, TITLE_H } from "../widgets.js";

/**
 * The research panel, built round the choice: under the title a band with the
 * research under way (or what the advance just found brings); on the left the
 * list of what can be researched now, what comes later and what is
 * discovered; on the right a card for the selected advance (what it brings,
 * what it needs, what it opens the way to, each of those a link to its own
 * card); along the bottom what to do next and the buttons.
 */

type Box = { x: number; y: number; w: number; h: number };
/** The panel is a window over the game (asked for 2026-10-24: "should not take 100% of the screen"), this big. */
const WIN = { w: 300, h: 188 };
/** The window, centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function researchRect(screenW = SCREEN_W): Box {
  return { x: Math.floor((screenW - WIN.w) / 2), y: Math.floor((SCREEN_H - WIN.h) / 2), ...WIN };
}
/** Where the window's parts stand: the band under the title strip, the list at the left, the card at the right, the buttons along the foot. */
interface Layout { o: Box; band: number; list: Box; card: Box; buttonY: number; close: Box }
function layout(screenW = SCREEN_W): Layout {
  const o = researchRect(screenW);
  const top = o.y + 2 + TITLE_H + 14;
  const h = o.y + o.h - 16 - top;
  return {
    o,
    band: o.y + 2 + TITLE_H + 3,
    list: { x: o.x + 2, y: top, w: 110, h },
    card: { x: o.x + 114, y: top, w: o.w - 116, h },
    buttonY: o.y + o.h - 14,
    close: { x: o.x + o.w - 3 - (TITLE_H - 2), y: o.y + 3, w: TITLE_H - 2, h: TITLE_H - 2 },
  };
}
const ROW = FONT_HEIGHT + 1;
/** Rows of the list on view at once. */
export const RESEARCH_LIST_ROWS = Math.floor((layout().list.h - 4) / ROW);
const SCROLL_W = 5;

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

/** A tick, 6 wide and 4 high: an advance discovered. */
function tick(s: Surface, x: number, y: number): void {
  drawMark(s, "tick", x * 2, y * 2);
}

/** A small diamond in a 7x7 box: brought within reach by the advance just found. */
function spark(s: Surface, x: number, y: number): void {
  drawMark(s, "new", x * 2 + 2, y * 2 + 2);
}

/** The mark before an advance's name: a bulb for the research under way, a tick when discovered. */
function mark(s: Surface, status: TechStatus, x: number, y: number, on: boolean): void {
  if (status === "researching") drawIcon(s, "bulb", x, y);
  else if (status === "known") tick(s, x + 1, y + 2);
}

// ---- the list --------------------------------------------------------------------------

function listRowY(i: number, top: number, L: Layout): number {
  return L.list.y + 2 + (i - top) * ROW;
}

function scrollBar(rows: number, top: number, L: Layout): { x: number; y: number; h: number; thumbY: number; thumbH: number } {
  const x = L.list.x + L.list.w - 2 - SCROLL_W;
  const y = L.list.y + 2;
  const h = RESEARCH_LIST_ROWS * ROW;
  const thumbH = Math.max(4, Math.round((h * RESEARCH_LIST_ROWS) / rows));
  const thumbY = y + Math.round(((h - thumbH) * top) / Math.max(1, rows - RESEARCH_LIST_ROWS));
  return { x, y, h, thumbY, thumbH };
}

function drawList(s: Surface, state: GameState, view: ResearchView, rows: ResearchRow[], L: Layout): void {
  drawStone(s, L.list.x, L.list.y, L.list.w, L.list.h, true);
  const scrolls = rows.length > RESEARCH_LIST_ROWS;
  const right = L.list.x + L.list.w - 2 - (scrolls ? SCROLL_W + 1 : 0);
  rows.forEach((row, i) => {
    if (i < view.top || i >= view.top + RESEARCH_LIST_ROWS) return;
    const y = listRowY(i, view.top, L);
    if (row.kind === "header") {
      drawText(s, L.list.x + 4, y, row.text, DIM);
      const end = L.list.x + 6 + textWidth(row.text);
      if (end < right - 2) s.hline(end, y + 4, right - 2 - end, shade("panel", 2));
      return;
    }
    const sel = row.id === view.selected;
    if (sel) s.rect(L.list.x + 2, y - 1, right - L.list.x - 2, ROW, shade("azure", 2));
    mark(s, row.status, L.list.x + 4, y, sel);
    if (row.unlocked) spark(s, L.list.x + 4, y);
    const ink = sel ? C.WHITE! : row.fresh ? GOLD : INK_OF[row.status];
    drawText(s, L.list.x + 14, y, label(row.id), ink);
    // What it brings, as pictures, for what is still to come.
    if (row.group !== "known") {
      const icons = techIcons(state, row.id);
      icons.forEach((icon, k) => drawIcon(s, icon, right - 1 - (icons.length - k) * (ICON + 1), y));
    }
  });
  if (scrolls) {
    const b = scrollBar(rows.length, view.top, L);
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
function card(s: Surface | null, state: GameState, view: ResearchView, L: Layout): Rect[] {
  const links: Rect[] = [];
  const d = techDetails(state, view.selected);
  const fresh = view.discovered.includes(view.selected);
  const x0 = L.card.x + 5;
  const w = L.card.w - 10;
  const bottom = L.card.y + L.card.h - 3;
  if (s) {
    drawStone(s, L.card.x, L.card.y, L.card.w, L.card.h);
    const strip = d.status === "known" ? shade("grass", 1) : d.status === "locked" ? shade("panel", 1) : shade("azure", 1);
    drawTitleStrip(s, L.card.x + 2, L.card.y + 2, L.card.w - 4, d.name, { color: strip });
  }
  let y = L.card.y + TITLE_H + 5;
  const standing = fresh ? "Just discovered!" : d.standing;
  const ink = fresh ? GOLD : d.status === "available" ? NOTE : d.status === "researching" ? shade("azure", 2) : d.status === "known" ? GOOD : DIM;
  // Text wraps the same whether drawn or only measured, so the links land where they are drawn.
  const wrapped = (tx: number, ty: number, tw: number, text: string, color: number, max: number): number =>
    s ? drawTextWrapped(s, tx, ty, tw, text, color, max) : Math.min(max, wrapText(text, tw).length);
  y += wrapped(x0, y, w, standing, ink, 2) * FONT_HEIGHT + 2;
  const groove = (): void => {
    if (s) {
      s.hline(L.card.x + 3, y, L.card.w - 6, shade("panel", 2));
      s.hline(L.card.x + 3, y + 1, L.card.w - 6, shade("panel", 7));
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
        drawTextWrapped(s, end + 5, y, L.card.x + L.card.w - 5 - end - 5, also, DIM, 1);
      }
      y += ROW;
    }
  }
  if (s) showcase(s, state, view.selected, y, bottom, L);
  return links;
}

/**
 * What the advance brings, as the city view draws it, standing on a strip of
 * grass along the bottom of the card where there is room: its wonders, then
 * its buildings, then its units.
 */
function showcase(s: Surface, state: GameState, id: string, top: number, bottom: number, L: Layout): void {
  const owner = state.players[state.currentPlayer]!.color;
  type Item = { w: number; h: number; draw: (x: number, ground: number) => void };
  const items: Item[] = [];
  for (const b of [...WONDERS.filter((w) => w.requires === id), ...BUILDINGS.filter((b) => b.requires === id)]) {
    const pic = PICTURES[b.id];
    if (!pic) continue;
    const { w, h } = artLot(b.id, pic);
    items.push({ w, h, draw: (x, ground) => drawBuilding(s, b.id, pic, x, ground, w, h, slotColor(owner)) });
  }
  for (const u of UNIT_TYPES.filter((t) => t.requires === id)) {
    items.push({ w: TILE, h: TILE, draw: (x, ground) => drawUnitFigure(s, u.id, x, ground - TILE, slotColor(owner)) });
  }
  const gap = 8;
  const room = L.card.w - 16;
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
  s.rect(L.card.x + 6, ground, L.card.w - 12, 2, shade("grass", 4));
  let x = L.card.x + Math.floor((L.card.w - w) / 2);
  for (const it of shown) { it.draw(x, ground); x += it.w + gap; }
}

// ---- the band, buttons and the whole panel ----------------------------------------------

function drawBand(s: Surface, state: GameState, view: ResearchView, L: Layout): void {
  const band = researchBand(state, view);
  if (band !== null) {
    drawIconsWrapped(s, L.o.x + 6, L.band, L.o.w - 12, band, view.discovered.length ? GOLD : NOTE, 1);
    return;
  }
  const o = researchOutlook(state);
  drawIcon(s, "bulb", L.o.x + 6, L.band);
  drawText(s, L.o.x + 6 + ICON + 2, L.band, label(o.id!), INK);
  const after = `${o.have}/${o.cost}  {hourglass}${o.turns ?? "-"}`;
  const aw = iconLineWidth(after);
  const bx = L.o.x + 112;
  drawBox(s, bx, L.band, L.o.x + L.o.w - 8 - aw - 6 - bx, 8, o.have, o.cost, C.LCYAN!);
  drawIconLine(s, L.o.x + L.o.w - 6 - aw, L.band, after, DIM);
}

interface Button { x: number; w: number; label: string; hit: ResearchHit; primary: boolean }

function buttons(state: GameState, view: ResearchView, L: Layout): Button[] {
  const out: Button[] = [];
  let x = L.o.x + L.o.w - 6;
  const add = (text: string, hit: ResearchHit, primary = false): void => {
    const w = textWidth(text) + 12;
    x -= w;
    out.push({ x, w, label: text, hit, primary });
    x -= 4;
  };
  const target = researchTarget(state, view);
  if (target) add(target === view.selected ? "Research" : `Research ${label(target)}`, { kind: "research" }, true);
  return out;
}

/** The panel: a window over the game it opened on (darkened), centred on the screen it is drawn on. */
export function drawResearch(s: Surface, state: GameState, view: ResearchView): void {
  const rows = researchRows(state, view);
  const L = layout(s.width);
  const o = L.o;
  dimScreen(s);
  // The window on the game, a shadow under it.
  s.rect(o.x + 3, o.y + o.h, o.w, 2, C.BLACK!);
  s.rect(o.x + o.w, o.y + 3, 2, o.h - 1, C.BLACK!);
  s.frame(o.x, o.y, o.w, o.h, C.BLACK!);
  hideArtUnder(s, o);
  drawStone(s, o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  const known = state.players[state.currentPlayer]!.advances.length;
  // The count of advances at the strip's right, and when the panel may be left a close box after it (in place of a Close button, 2026-10-24).
  const count = `${known}/${advancesFor(state).length}`;
  drawTitleStrip(s, o.x + 2, o.y + 2, o.w - 4, researchTitle(state, view), view.discovered.length ? { color: shade("azure", 2) } : {});
  const close = closeBox(view, L);
  drawText(s, (close ? close.x - 4 : o.x + o.w - 6) - textWidth(count), o.y + 4, count, shade("azure", 7));
  if (close) drawCloseBox(s, close.x, close.y);
  drawBand(s, state, view, L);
  drawList(s, state, view, rows, L);
  card(s, state, view, L);
  const bs = buttons(state, view, L);
  for (const b of bs) drawButton(s, b.x, L.buttonY, b.w, 11, b.label, true, b.primary);
  const hint = researchHint(state, view);
  const room = Math.min(o.x + o.w, ...bs.map((b) => b.x)) - o.x - 10;
  if (textWidth(hint) <= room) drawText(s, o.x + 6, L.buttonY + 2, hint, view.choosing ? NOTE : DIM);
}

/** The close box in the title strip, when the panel may be left. */
function closeBox(view: ResearchView, L: Layout): Box | null {
  return view.closable ? L.close : null;
}

/** What lies under a point of the research panel, on a screen `screenW` wide. */
export function researchHit(state: GameState, view: ResearchView, px: number, py: number, screenW = SCREEN_W): ResearchHit | null {
  const L = layout(screenW);
  const close = closeBox(view, L);
  if (close && px >= close.x - 3 && px < close.x + close.w + 3 && py >= L.o.y + 2 && py < L.o.y + 2 + TITLE_H) return { kind: "close" };
  for (const b of buttons(state, view, L)) if (px >= b.x && px < b.x + b.w && py >= L.buttonY && py < L.buttonY + 11) return b.hit;
  const rows = researchRows(state, view);
  if (px >= L.list.x && px < L.list.x + L.list.w && py >= L.list.y && py < L.list.y + L.list.h) {
    if (rows.length > RESEARCH_LIST_ROWS) {
      const b = scrollBar(rows.length, view.top, L);
      if (px >= b.x - 1) return py < b.thumbY ? { kind: "scroll", by: -RESEARCH_LIST_ROWS } : py >= b.thumbY + b.thumbH ? { kind: "scroll", by: RESEARCH_LIST_ROWS } : null;
    }
    const i = view.top + Math.floor((py - (L.list.y + 1)) / ROW);
    const row = i < view.top + RESEARCH_LIST_ROWS ? rows[i] : undefined;
    return row?.kind === "advance" ? { kind: "row", id: row.id } : null;
  }
  for (const l of card(null, state, view, L)) if (px >= l.x && px < l.x + l.w && py >= l.y && py < l.y + l.h) return { kind: "link", id: l.id };
  return null;
}
