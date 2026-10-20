import { advance, advancesFor, type GameState } from "@civ/core";
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
  type ResearchView,
  type TechStatus,
} from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { bar, fillRound, measure, panel, paragraph, strokeRound, text } from "../draw.js";
import { drawIconLine, paintIcon } from "../icons.js";
import { H, TECH, UI, W } from "../theme.js";

/**
 * The research panel (the modern renderer's take on the retro one): the
 * research under way across the top, the list of what can be researched now,
 * what comes later and what is discovered on the left, and a card for the
 * selected advance on the right, its prerequisites and successors as links.
 */

const BAND_Y = 74;
const LIST = { x: 32, y: 104, w: 300, h: 404 };
const CARD = { x: 348, y: 104, w: W - 380, h: 404 };
const ROW = 22;
/** Rows of the list on view at once. */
export const RESEARCH_LIST_ROWS = Math.floor((LIST.h - 16) / ROW);
const BUTTON = { y: H - 76, h: 36 };
const SECTION = 26;

const INK_OF: Record<TechStatus, string> = { known: TECH.known.ink, researching: TECH.researching.edge, available: UI.ink, locked: TECH.locked.ink };

function drawList(ctx: Context2D, state: GameState, view: ResearchView): void {
  fillRound(ctx, LIST.x, LIST.y, LIST.w, LIST.h, 12, TECH.ground);
  const rows = researchRows(state, view);
  rows.forEach((row, i) => {
    if (i < view.top || i >= view.top + RESEARCH_LIST_ROWS) return;
    const y = LIST.y + 8 + (i - view.top) * ROW;
    if (row.kind === "header") {
      text(ctx, LIST.x + 14, y + 4, row.text.toUpperCase(), { size: 11, weight: "600", color: UI.dim });
      return;
    }
    const sel = row.id === view.selected;
    if (sel) fillRound(ctx, LIST.x + 6, y, LIST.w - 12, ROW - 2, 6, UI.panelLight);
    if (row.status === "researching") paintIcon(ctx, "bulb", LIST.x + 14, y + 2, 16);
    else if (row.status === "known") text(ctx, LIST.x + 16, y + 3, "✓", { size: 13, weight: "600", color: TECH.known.edge });
    else if (row.unlocked) text(ctx, LIST.x + 15, y + 3, "◆", { size: 12, color: TECH.fresh.fill });
    text(ctx, LIST.x + 38, y + 3, advance(row.id).name, { size: 14, weight: sel ? "600" : "normal", color: row.fresh ? UI.accent : INK_OF[row.status] });
    if (row.group !== "known") techIcons(state, row.id).forEach((icon, k, all) => paintIcon(ctx, icon, LIST.x + LIST.w - 18 - (all.length - k) * 20, y + 2, 16));
  });
}

interface Rect { x: number; y: number; w: number; h: number; id: string }

/** The card's links (prerequisites, successors) at fixed places, so drawing and hit-testing agree without measuring wrapped text. */
function cardLinks(ctx: Context2D, state: GameState, view: ResearchView): { needsY: number; opensY: number; links: Rect[] } {
  const d = techDetails(state, view.selected);
  const rowsH = Math.max(1, Math.min(4, d.rows.length)) * SECTION;
  const needsY = CARD.y + 100 + rowsH + 16;
  const opensY = needsY + SECTION;
  const links: Rect[] = [];
  let x = CARD.x + 110;
  for (const n of d.needs) {
    const w = measure(ctx, advance(n.id).name, 14) + 24;
    links.push({ x, y: needsY - 4, w, h: SECTION - 4, id: n.id });
    x += w + 12;
  }
  d.opens.slice(0, Math.floor((CARD.y + CARD.h - 12 - opensY) / SECTION)).forEach((o, i) => {
    links.push({ x: CARD.x + 110, y: opensY + i * SECTION - 4, w: measure(ctx, advance(o.id).name, 14) + 24, h: SECTION - 4, id: o.id });
  });
  return { needsY, opensY, links };
}

function drawCard(ctx: Context2D, state: GameState, view: ResearchView): void {
  const d = techDetails(state, view.selected);
  const fresh = view.discovered.includes(view.selected);
  panel(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 12, UI.card);
  const look = fresh ? TECH.fresh : TECH[d.status];
  fillRound(ctx, CARD.x + 16, CARD.y + 16, CARD.w - 32, 34, 8, look.fill);
  text(ctx, CARD.x + 30, CARD.y + 24, d.name, { size: 18, weight: "600", color: look.ink });
  const ink = fresh ? UI.accent : d.status === "available" || d.status === "researching" ? UI.info : d.status === "known" ? UI.ok : UI.dim;
  paragraph(ctx, CARD.x + 24, CARD.y + 62, CARD.w - 48, fresh ? "Just discovered!" : d.standing, { size: 14, color: ink }, 2);
  let y = CARD.y + 100;
  for (const row of d.rows.slice(0, 4)) {
    paintIcon(ctx, row.icon, CARD.x + 24, y, 18);
    text(ctx, CARD.x + 50, y + 1, row.label, { size: 13, color: UI.dim });
    paragraph(ctx, CARD.x + 150, y, CARD.w - 174, row.items.join(", "), { size: 14 }, 1);
    y += SECTION;
  }
  if (!d.rows.length) text(ctx, CARD.x + 24, y, d.opens.length ? "Nothing by itself: it leads on." : "Nothing of its own.", { size: 14, color: UI.dim });
  const { needsY, opensY, links } = cardLinks(ctx, state, view);
  text(ctx, CARD.x + 24, needsY, "Needs", { size: 13, color: UI.dim });
  if (!d.needs.length) text(ctx, CARD.x + 110, needsY, "nothing: a first advance", { size: 14, color: UI.dim });
  if (d.opens.length) text(ctx, CARD.x + 24, opensY, "Opens", { size: 13, color: UI.dim });
  const all = [...d.needs, ...d.opens];
  for (const l of links) {
    const link = all.find((a) => a.id === l.id)!;
    strokeRound(ctx, l.x + 0.5, l.y + 0.5, l.w - 1, l.h - 1, 6, TECH[link.status].edge);
    text(ctx, l.x + 12, l.y + 4, advance(l.id).name, { size: 14, color: INK_OF[link.status] });
    if (link.status === "locked" && d.opens.includes(link)) {
      const also = link.also.length ? `with ${link.also.map((a) => advance(a).name).join(", ")}` : "then ready";
      text(ctx, l.x + l.w + 12, l.y + 4, also, { size: 13, color: UI.dim });
    }
  }
}

interface Button { x: number; w: number; label: string; hit: ResearchHit; primary: boolean }

function buttons(ctx: Context2D, state: GameState, view: ResearchView): Button[] {
  const out: Button[] = [];
  let x = W - 32;
  const add = (label: string, hit: ResearchHit, primary = false): void => {
    const w = measure(ctx, label, 15, "600") + 36;
    x -= w;
    out.push({ x, w, label, hit, primary });
    x -= 12;
  };
  if (view.closable) add("Close", { kind: "close" });
  const target = researchTarget(state, view);
  if (target) add(`Research ${advance(target).name}`, { kind: "research" }, true);
  return out;
}

export function drawResearch(ctx: Context2D, state: GameState, view: ResearchView): void {
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 16, 16, W - 32, H - 32, 16);
  text(ctx, 40, 30, researchTitle(state, view), { size: 22, weight: "600", color: view.discovered.length ? UI.accent : UI.ink });
  const known = state.players[state.currentPlayer]!.advances.length;
  text(ctx, W - 40, 36, `${known} of ${advancesFor(state).length} advances known`, { size: 13, color: UI.dim, align: "right" });
  const band = researchBand(state, view);
  if (band !== null) drawIconLine(ctx, 40, BAND_Y, band, { size: 14, color: view.discovered.length ? UI.accent : UI.info });
  else {
    const o = researchOutlook(state);
    drawIconLine(ctx, 40, BAND_Y, `{bulb} ${o.name}`, { size: 14, weight: "600" });
    bar(ctx, 300, BAND_Y + 4, 420, 10, o.have, o.cost, UI.info);
    text(ctx, W - 40, BAND_Y, `${o.have}/${o.cost} · ${o.turns ?? "-"} turns`, { size: 13, color: UI.dim, align: "right" });
  }
  drawList(ctx, state, view);
  drawCard(ctx, state, view);
  for (const b of buttons(ctx, state, view)) {
    if (b.primary) fillRound(ctx, b.x, BUTTON.y, b.w, BUTTON.h, 10, TECH.button);
    else strokeRound(ctx, b.x + 0.5, BUTTON.y + 0.5, b.w - 1, BUTTON.h - 1, 10, UI.panelEdge, 1.5);
    text(ctx, b.x + b.w / 2, BUTTON.y + 9, b.label, { size: 15, weight: "600", color: b.primary ? TECH.buttonInk : UI.ink, align: "center" });
  }
  text(ctx, 40, BUTTON.y + 10, `${researchHint(state, view)}${view.closable ? " · Esc close" : ""}`, { size: 13, color: UI.dim });
}

/** What lies under a point of the research panel. */
export function researchHit(ctx: Context2D, state: GameState, view: ResearchView, px: number, py: number): ResearchHit | null {
  for (const b of buttons(ctx, state, view)) if (px >= b.x && px < b.x + b.w && py >= BUTTON.y && py < BUTTON.y + BUTTON.h) return b.hit;
  if (px >= LIST.x && px < LIST.x + LIST.w && py >= LIST.y + 8 && py < LIST.y + 8 + RESEARCH_LIST_ROWS * ROW) {
    const row = researchRows(state, view)[view.top + Math.floor((py - LIST.y - 8) / ROW)];
    return row?.kind === "advance" ? { kind: "row", id: row.id } : null;
  }
  for (const l of cardLinks(ctx, state, view).links) if (px >= l.x && px < l.x + l.w && py >= l.y && py < l.y + l.h) return { kind: "link", id: l.id };
  return null;
}
