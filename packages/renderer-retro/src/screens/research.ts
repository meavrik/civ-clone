import { advance, advancesFor, type GameState } from "@civ/core";
import {
  buildingArt,
  hiddenChoices,
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
  type TechGift,
  type TechLink,
  type TechStatus,
  PICTURES,
} from "@civ/renderer-api";
import { drawText, drawTextLarge, drawTextWrapped, FONT_HEIGHT, textWidth, textWidthLarge, wrapText } from "../font.js";
import { drawIcon, drawIconLine, drawIconsWrapped, drawMark, ICON, iconLineWidth } from "../icons.js";
import { drawUnitFigure } from "../overlays.js";
import { drawEnlarged, rasterize } from "../pictures.js";
import { C, shade, slotColor } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, dimScreen, hideArtUnder, drawBox, drawButton, drawCloseBox, drawStone, drawTitleStrip, FADED, GOLD, GOOD, INK, NOTE, speckle, TITLE_H } from "../widgets.js";
import { fitText } from "./newtech.js";

/**
 * The research panel, built round the choice: under the title a band with the
 * research under way (or what the advance just found brings); on the left the
 * list of what can be researched now, what comes later and what is
 * discovered; on the right a card for the selected advance (what it brings,
 * its wonders, buildings and units framed with their pictures, then what it
 * needs and what it opens the way to, each of those a link to its own card);
 * along the bottom the buttons.
 *
 * Brief (`ResearchView.brief`, since 2026-11-03, asked for: "too big. minimize - show more details only if
 * player choose to", "show less options for next research"): a smaller window, the best few choices and the
 * card's frames and gains only; Details (or D) opens the whole panel, Less goes back.
 */

type Box = { x: number; y: number; w: number; h: number };
/** The panel is a window over the game (asked for 2026-10-24: "should not take 100% of the screen"), this big with details... */
const WIN = { w: 300, h: 188 };
/** ...and this big brief. */
const BRIEF_WIN = { w: 248, h: 138 };
/** The window, centred on a screen `screenW` wide (the phone's map is wider than 320). */
export function researchRect(screenW = SCREEN_W, brief = false): Box {
  const win = brief ? BRIEF_WIN : WIN;
  return { x: Math.floor((screenW - win.w) / 2), y: Math.floor((SCREEN_H - win.h) / 2), ...win };
}
/**
 * Where the window's parts stand: the band under the title strip, the list at the left (`rows` of it on view), the
 * card at the right, the buttons along the foot.
 */
interface Layout { o: Box; brief: boolean; band: number; list: Box; rows: number; card: Box; buttonY: number; close: Box }
function layout(screenW = SCREEN_W, brief = false): Layout {
  const o = researchRect(screenW, brief);
  const top = o.y + 2 + TITLE_H + 14;
  const h = o.y + o.h - 16 - top;
  const listW = brief ? 96 : 110;
  return {
    o,
    brief,
    band: o.y + 2 + TITLE_H + 3,
    list: { x: o.x + 2, y: top, w: listW, h },
    rows: Math.floor((h - 4) / ROW),
    card: { x: o.x + listW + 4, y: top, w: o.w - listW - 6, h },
    buttonY: o.y + o.h - 14,
    close: { x: o.x + o.w - 3 - (TITLE_H - 2), y: o.y + 3, w: TITLE_H - 2, h: TITLE_H - 2 },
  };
}
const ROW = FONT_HEIGHT + 1;
/** Rows of the list on view at once, with details (brief, the few choices always fit). */
export const RESEARCH_LIST_ROWS = layout().rows;
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
  const h = L.rows * ROW;
  const thumbH = Math.max(4, Math.round((h * L.rows) / rows));
  const thumbY = y + Math.round(((h - thumbH) * top) / Math.max(1, rows - L.rows));
  return { x, y, h, thumbY, thumbH };
}

/** The brief list's last line, under its choices, when it leaves some out: a click on it shows them all. */
function moreLine(state: GameState, view: ResearchView, rows: ResearchRow[], L: Layout): { y: number; text: string } | null {
  const hidden = hiddenChoices(state, view);
  if (!hidden || rows.length >= view.top + L.rows) return null;
  return { y: listRowY(rows.length, view.top, L), text: `+${hidden} more choices` };
}

function drawList(s: Surface, state: GameState, view: ResearchView, rows: ResearchRow[], L: Layout): void {
  drawStone(s, L.list.x, L.list.y, L.list.w, L.list.h, true);
  const scrolls = rows.length > L.rows;
  const right = L.list.x + L.list.w - 2 - (scrolls ? SCROLL_W + 1 : 0);
  const more = moreLine(state, view, rows, L);
  if (more) drawText(s, L.list.x + 14, more.y, more.text, NOTE);
  rows.forEach((row, i) => {
    if (i < view.top || i >= view.top + L.rows) return;
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

// ---- the frames of what an advance brings -----------------------------------------------

/**
 * Its wonders, buildings and units, each in a frame with its picture and its name on a badge across the frame's
 * foot (asked for 2026-11-03: "tech improvement images - too small. place inside frames with badge title"; they
 * had stood small on a strip of grass along the card's foot, where the links left room). Frames share the card's
 * width, one or two at their widest, more narrower; past what fits, the last frame counts the rest.
 */
const FRAME_PIC = 40;
const BADGE_H = 10;
const FRAME_H = FRAME_PIC + BADGE_H + 2;
const FRAME_MIN_W = 40;
const FRAME_MAX_W = 64;
const FRAME_GAP = 4;

/** A frame: `gift` null for the last one when they do not all fit, counting the `more` left out (itself among them). */
interface GiftFrame { x: number; y: number; w: number; gift: TechGift | null; more: number }

function giftFrames(gifts: TechGift[], x: number, y: number, room: number): GiftFrame[] {
  if (!gifts.length) return [];
  const fit = Math.max(1, Math.floor((room + FRAME_GAP) / (FRAME_MIN_W + FRAME_GAP)));
  const n = Math.min(gifts.length, fit);
  const w = Math.min(FRAME_MAX_W, Math.floor((room - (n - 1) * FRAME_GAP) / n));
  const x0 = x + Math.floor((room - (n * w + (n - 1) * FRAME_GAP)) / 2);
  return Array.from({ length: n }, (_, i) => {
    const over = gifts.length > n && i === n - 1;
    return { x: x0 + i * (w + FRAME_GAP), y, w, gift: over ? null : gifts[i]!, more: over ? gifts.length - i : 0 };
  });
}

/** Each kind's frame and badge: wonders in gold, buildings in parchment, units in the title strips' navy. */
const FRAME_LOOK: Record<TechGift["kind"] | "more", { edge: () => number; badge: () => number; ink: () => number }> = {
  wonder: { edge: () => shade("wheat", 1), badge: () => shade("wheat", 4), ink: () => shade("hide", 0) },
  building: { edge: () => shade("hide", 1), badge: () => shade("hide", 7), ink: () => shade("hide", 0) },
  unit: { edge: () => shade("azure", 0), badge: () => shade("azure", 1), ink: () => C.WHITE! },
  more: { edge: () => shade("panel", 1), badge: () => shade("panel", 4), ink: () => INK },
};

function drawFrame(s: Surface, state: GameState, f: GiftFrame): void {
  const look = FRAME_LOOK[f.gift?.kind ?? "more"];
  // A slate bed (the Building Completed window's) inside the frame's edge, lit along its top and left.
  s.frame(f.x, f.y, f.w, FRAME_H, look.edge());
  const bed = { x: f.x + 1, y: f.y + 1, w: f.w - 2, h: FRAME_PIC };
  speckle(s, bed.x, bed.y, bed.w, bed.h, shade("steel", 3), shade("steel", 4), shade("steel", 4));
  s.hline(bed.x, bed.y, bed.w, shade("steel", 2));
  s.vline(bed.x, bed.y, bed.h, shade("steel", 2));
  // The badge across its foot, the name in its middle.
  const by = bed.y + bed.h;
  s.rect(bed.x, by, bed.w, BADGE_H, look.badge());
  s.hline(bed.x, by, bed.w, look.edge());
  const name = fitText(f.gift ? f.gift.name : "more", bed.w - 4);
  drawText(s, bed.x + Math.floor((bed.w - textWidth(name)) / 2), by + 2, name, look.ink());
  const g = f.gift;
  if (!g) {
    const count = `+${f.more}`;
    drawTextLarge(s, bed.x + Math.floor((bed.w - textWidthLarge(count)) / 2), bed.y + Math.floor((bed.h - 2 * FONT_HEIGHT) / 2), count, shade("steel", 7));
    return;
  }
  const owner = slotColor(state.players[state.currentPlayer]!.color);
  if (g.kind === "unit") {
    // The unit standing on the bed's floor, its square as tall as the bed.
    const t = Math.min(bed.w, FRAME_PIC);
    drawUnitFigure(s, g.id, bed.x + Math.floor((bed.w - t) / 2), bed.y + bed.h - t, owner, {}, t);
    return;
  }
  // The user's picture of it, as large as it fits; else the city view's drawn one, enlarged.
  const room = { x: bed.x + 2, y: bed.y + 2, w: bed.w - 4, h: bed.h - 4 };
  const pic = PICTURES[g.id];
  if (buildingArt(g.id)) s.art.push({ id: g.id, ...room, middle: true });
  else if (pic) drawEnlarged(s, room, rasterize(pic, owner), pic.w + 2, pic.h + 2);
}

// ---- the card --------------------------------------------------------------------------

interface Rect { x: number; y: number; w: number; h: number; id: string }

/**
 * The card for the selected advance. Drawn when `s` is given; either way it returns where its links lie (and,
 * brief, the frame counting what did not fit, a way to the details), so drawing and hit-testing agree.
 */
function card(s: Surface | null, state: GameState, view: ResearchView, L: Layout): { links: Rect[]; more: Box | null } {
  const links: Rect[] = [];
  let more: Box | null = null;
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
  y += wrapped(x0, y, w, standing, ink, L.brief ? 1 : 2) * FONT_HEIGHT + 2;
  const groove = (): void => {
    if (s) {
      s.hline(L.card.x + 3, y, L.card.w - 6, shade("panel", 2));
      s.hline(L.card.x + 3, y + 1, L.card.w - 6, shade("panel", 7));
    }
    y += 4;
  };
  if (L.brief) y += 1;
  else groove();

  // What it brings: its wonders, buildings and units framed, then the rest a line each.
  const frames = giftFrames(d.gifts, x0, y, w);
  if (frames.length) {
    if (s) for (const f of frames) drawFrame(s, state, f);
    const over = frames.find((f) => !f.gift);
    if (over && L.brief) more = { x: over.x, y: over.y, w: over.w, h: FRAME_H };
    y += FRAME_H + 3;
  }
  const others = d.rows.filter((r) => !r.pictured);
  // With details the links below keep their room.
  const end = L.brief ? bottom : bottom - 3 * ROW;
  const labelW = Math.max(0, ...others.map((r) => textWidth(r.label))) + 4;
  for (const row of others) {
    const lines = Math.min(2, Math.floor((end - y) / FONT_HEIGHT));
    if (lines < 1) break;
    if (s) {
      drawIcon(s, row.icon, x0, y);
      drawText(s, x0 + ICON + 2, y, row.label, DIM);
    }
    y += wrapped(x0 + ICON + 2 + labelW, y, w - ICON - 2 - labelW, row.items.join(", "), INK, lines) * FONT_HEIGHT + 1;
  }
  if (!d.rows.length) {
    const lines = Math.max(1, Math.floor((end - y) / FONT_HEIGHT));
    const leads = L.brief && d.opens.length ? `Nothing by itself: it leads to ${d.opens.map((o) => o.name).join(", ")}.` : d.opens.length ? "Nothing by itself: it leads on." : "Nothing of its own.";
    y += wrapped(x0, y, w, leads, DIM, lines) * FONT_HEIGHT + 1;
  }
  if (L.brief) return { links, more };
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
  return { links, more };
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
  const bx = L.card.x;
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
  // At the left, the way between the brief panel and the whole one.
  const toggle = L.brief ? "Details" : "Less";
  out.push({ x: L.o.x + 6, w: textWidth(toggle) + 12, label: toggle, hit: { kind: "details" }, primary: false });
  return out;
}

/** The panel: a window over the game it opened on (darkened), centred on the screen it is drawn on. */
export function drawResearch(s: Surface, state: GameState, view: ResearchView): void {
  const rows = researchRows(state, view);
  const L = layout(s.width, view.brief === true);
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
  // What to do next, between the buttons where it fits.
  const hint = researchHint(state, view);
  const left = Math.max(...bs.filter((b) => b.hit.kind === "details").map((b) => b.x + b.w)) + 6;
  const right = Math.min(o.x + o.w, ...bs.filter((b) => b.hit.kind !== "details").map((b) => b.x)) - 4;
  if (textWidth(hint) <= right - left) drawText(s, left, L.buttonY + 2, hint, view.choosing ? NOTE : DIM);
}

/** The close box in the title strip, when the panel may be left. */
function closeBox(view: ResearchView, L: Layout): Box | null {
  return view.closable ? L.close : null;
}

/** What lies under a point of the research panel, on a screen `screenW` wide. */
export function researchHit(state: GameState, view: ResearchView, px: number, py: number, screenW = SCREEN_W): ResearchHit | null {
  const L = layout(screenW, view.brief === true);
  const close = closeBox(view, L);
  if (close && px >= close.x - 3 && px < close.x + close.w + 3 && py >= L.o.y + 2 && py < L.o.y + 2 + TITLE_H) return { kind: "close" };
  for (const b of buttons(state, view, L)) if (px >= b.x && px < b.x + b.w && py >= L.buttonY && py < L.buttonY + 11) return b.hit;
  const rows = researchRows(state, view);
  if (px >= L.list.x && px < L.list.x + L.list.w && py >= L.list.y && py < L.list.y + L.list.h) {
    if (rows.length > L.rows) {
      const b = scrollBar(rows.length, view.top, L);
      if (px >= b.x - 1) return py < b.thumbY ? { kind: "scroll", by: -L.rows } : py >= b.thumbY + b.thumbH ? { kind: "scroll", by: L.rows } : null;
    }
    const i = view.top + Math.floor((py - (L.list.y + 1)) / ROW);
    const row = i < view.top + L.rows ? rows[i] : undefined;
    if (row?.kind === "advance") return { kind: "row", id: row.id };
    return i === rows.length && moreLine(state, view, rows, L) ? { kind: "details" } : null;
  }
  const c = card(null, state, view, L);
  for (const l of c.links) if (px >= l.x && px < l.x + l.w && py >= l.y && py < l.y + l.h) return { kind: "link", id: l.id };
  if (c.more && px >= c.more.x && px < c.more.x + c.more.w && py >= c.more.y && py < c.more.y + c.more.h) return { kind: "details" };
  return null;
}
