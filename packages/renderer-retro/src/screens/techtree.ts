import { advancesFor, type GameState } from "@civ/core";
import {
  canResearch,
  techDetails,
  techLane,
  techLayout,
  techStatus,
  techTreeTitle,
  type TechLayout,
  type TechNode,
  type TechStatus,
  type TechTreeHit,
  type TechTreeView,
} from "@civ/renderer-api";
import { drawText, drawTextWrapped, FONT_HEIGHT, textWidth } from "../font.js";
import { drawIcon, ICON } from "../icons.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawButton, drawPanel, drawTitleStrip, GOLD, GOOD, INK, NOTE } from "../widgets.js";

/**
 * The tech tree window: the graph of advances a few tiers at a time (known
 * ones green, those within reach white, the one just found yellow), and
 * under it what the selected advance gives, with the button to research it.
 */

const GRAPH = { x: 4, y: 13, w: SCREEN_W - 8, h: 104 };
const NODE_W = 76;
const NODE_H = 10;
const PITCH_X = 88;
/** A pixel between rows: the lane that edges skipping tiers run along (nine rows fit). */
const PITCH_Y = 11;
const TOP = GRAPH.y + 1;
/** Tiers that fit across the window (three and a half). */
export const TECH_COLUMNS = GRAPH.w / PITCH_X;
const STRIP = { x: GRAPH.x + 10, y: GRAPH.y + GRAPH.h - 4, w: GRAPH.w - 20, h: 3 };
const ARROW_W = 8;
const DETAILS_Y = GRAPH.y + GRAPH.h + 2;
const BUTTON_Y = SCREEN_H - 13;

/** Labels for the advances whose names are wider than a node; the details panel gives the full name. */
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
};

export function techLabel(node: Pick<TechNode, "id" | "name">): string {
  return SHORT[node.id] ?? node.name;
}

function nodeX(node: TechNode, scroll: number): number {
  return Math.round(GRAPH.x + 6 + (node.tier - scroll) * PITCH_X);
}

/** Rows sit PITCH_Y apart, closer when a tier holds more than the window fits. */
function pitchY(layout: TechLayout): number {
  return layout.rows <= 1 ? PITCH_Y : Math.min(PITCH_Y, Math.floor((STRIP.y - 1 - TOP - NODE_H) / (layout.rows - 1)));
}

function nodeY(layout: TechLayout, node: TechNode): number {
  return TOP + node.row * pitchY(layout);
}

const LOOK: Record<TechStatus, { fill: number; ink: number; edge: number }> = {
  known: { fill: shade("grass", 2), ink: C.WHITE!, edge: shade("grass", 4) },
  researching: { fill: C.CYAN!, ink: C.WHITE!, edge: C.LCYAN! },
  available: { fill: shade("panel", 7), ink: C.BLACK!, edge: C.BLACK! },
  locked: { fill: shade("panel", 4), ink: shade("panel", 2), edge: shade("panel", 2) },
};

/** A pixel inside the graph window only. */
function plot(s: Surface, x: number, y: number, color: number): void {
  if (x < GRAPH.x + 1 || x >= GRAPH.x + GRAPH.w - 1 || y < GRAPH.y + 1 || y >= GRAPH.y + GRAPH.h - 1) return;
  s.set(x, y, color);
}

function line(s: Surface, x0: number, y0: number, x1: number, y1: number, color: number, dotted: boolean): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2000; i++) {
    if (!dotted || (x0 + y0) % 2 === 0) plot(s, x0, y0, color);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * An edge from a prerequisite's right side to the left side of what it leads to: level ends, an
 * easy S between. Long edges that pass behind other tiers are dotted unless they are lit.
 */
function edge(s: Surface, layout: TechLayout, from: TechNode, to: TechNode, scroll: number, color: number, lit = false): void {
  const dotted = !lit && to.tier - from.tier > 1;
  const x0 = nodeX(from, scroll) + NODE_W;
  const y0 = nodeY(layout, from) + (NODE_H >> 1);
  const x1 = nodeX(to, scroll) - 1;
  const y1 = nodeY(layout, to) + (NODE_H >> 1);
  if (Math.max(x0, x1) < GRAPH.x || Math.min(x0, x1) > GRAPH.x + GRAPH.w) return;
  const curve = (xa: number, ya: number, xb: number, yb: number): void => {
    const steps = Math.max(2, Math.ceil(Math.abs(xb - xa) / 6));
    let px = xa;
    let py = ya;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const nx = Math.round(xa + (xb - xa) * t);
      const ny = Math.round(ya + (yb - ya) * t * t * (3 - 2 * t));
      line(s, px, py, nx, ny, color, dotted);
      px = nx;
      py = ny;
    }
  };
  const lane = techLane(layout, from, to);
  if (lane === null) { curve(x0, y0, x1, y1); return; }
  // Into the gap below a row, along it past the tiers between, and out to the advance.
  const gap = PITCH_X - NODE_W - 1;
  const yl = TOP + lane * pitchY(layout) + NODE_H;
  curve(x0, y0, x0 + gap, yl);
  line(s, x0 + gap, yl, x1 - gap, yl, color, dotted);
  curve(x1 - gap, yl, x1, y1);
}

function drawNode(s: Surface, state: GameState, view: TechTreeView, layout: TechLayout, node: TechNode): void {
  const x = nodeX(node, view.scroll);
  const y = nodeY(layout, node);
  if (x + NODE_W < GRAPH.x || x > GRAPH.x + GRAPH.w) return;
  const fresh = view.discovered.includes(node.id);
  const look = LOOK[techStatus(state, node.id)];
  const fill = fresh ? C.YELLOW! : look.fill;
  const ink = fresh ? C.BLACK! : look.ink;
  // Draw into a node-sized surface first so nodes cut by the window's edges stay inside it.
  const box = new Surface(NODE_W + 2, NODE_H + 2);
  box.fill(0xff);
  box.rect(1, 1, NODE_W, NODE_H, fill);
  box.frame(1, 1, NODE_W, NODE_H, fresh ? C.BROWN! : look.edge);
  drawText(box, 3, 3 - 1, techLabel(node), ink);
  if (node.id === view.selected) box.frame(0, 0, NODE_W + 2, NODE_H + 2, fresh && !view.blink ? C.BROWN! : C.WHITE!);
  else if (fresh && view.blink) box.frame(0, 0, NODE_W + 2, NODE_H + 2, C.YELLOW!);
  const left = Math.max(0, GRAPH.x + 1 - (x - 1));
  const right = Math.max(0, x - 1 + NODE_W + 2 - (GRAPH.x + GRAPH.w - 1));
  for (let yy = 0; yy < box.height; yy++)
    for (let xx = left; xx < box.width - right; xx++) {
      const c = box.get(xx, yy);
      if (c !== 0xff) s.set(x - 1 + xx, y - 1 + yy, c);
    }
}

function arrow(s: Surface, x: number, dir: -1 | 1): void {
  const y = GRAPH.y + 2;
  const h = GRAPH.h - 10;
  drawPanel(s, x, y, ARROW_W, h);
  const cy = y + (h >> 1);
  for (let i = 0; i < 4; i++) {
    const ax = dir < 0 ? x + 2 + i : x + ARROW_W - 3 - i;
    s.vline(ax, cy - i, 2 * i + 1, C.BLACK!);
  }
}

function moreLeft(view: TechTreeView): boolean {
  return view.scroll > 0.01;
}

function moreRight(layout: TechLayout, view: TechTreeView): boolean {
  return view.scroll + TECH_COLUMNS < layout.tiers - 0.01;
}

function drawStrip(s: Surface, state: GameState, layout: TechLayout, view: TechTreeView): void {
  const { tiers, nodes } = layout;
  const per = STRIP.w / tiers;
  s.rect(STRIP.x, STRIP.y, STRIP.w, STRIP.h, shade("panel", 1));
  // Marks for the tiers holding a choice (cyan) or the advance just found (yellow).
  for (const n of nodes) {
    const st = techStatus(state, n.id);
    const mark = view.discovered.includes(n.id) ? C.YELLOW! : st === "available" || st === "researching" ? C.LCYAN! : -1;
    if (mark >= 0) s.rect(Math.round(STRIP.x + (n.tier + 0.5) * per) - 1, STRIP.y, 2, STRIP.h, mark);
  }
  const tx = Math.round(STRIP.x + view.scroll * per);
  const tw = Math.round(Math.min(TECH_COLUMNS, tiers) * per);
  s.frame(tx, STRIP.y - 1, tw, STRIP.h + 2, C.WHITE!);
}

interface Button { x: number; y: number; w: number; label: string; hit: TechTreeHit }

function buttons(state: GameState, view: TechTreeView): Button[] {
  const out: Button[] = [];
  let x = SCREEN_W - 8;
  const add = (label: string, hit: TechTreeHit): void => {
    const w = textWidth(label) + 10;
    x -= w;
    out.push({ x, y: BUTTON_Y, w, label, hit });
    x -= 4;
  };
  if (view.closable) add("Close", { kind: "close" });
  if (canResearch(state, view)) add("Research", { kind: "research" });
  return out;
}

export function drawTechTree(s: Surface, state: GameState, view: TechTreeView): void {
  const layout = techLayout(state);
  const { nodes, byId } = layout;
  s.fill(C.BLACK!);
  const known = state.players[state.currentPlayer]!.advances.length;
  drawTitleStrip(s, 0, 0, SCREEN_W, "", { right: `${known}/${advancesFor(state).length}` });
  drawText(s, 4, 2, techTreeTitle(view), view.discovered.length ? C.YELLOW! : C.WHITE!);

  // The graph lies on a flat, darker grey sunk into the stone, so the speckle never breaks an edge.
  drawPanel(s, 0, GRAPH.y - 1, SCREEN_W, GRAPH.h + 2);
  drawPanel(s, GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h, true);
  s.rect(GRAPH.x + 1, GRAPH.y + 1, GRAPH.w - 2, GRAPH.h - 2, shade("panel", 3));
  const sel = byId.get(view.selected);
  for (const n of nodes) for (const r of n.requires) {
    if (n.id === view.selected || r === view.selected) continue;
    edge(s, layout, byId.get(r)!, n, view.scroll, shade("panel", 1));
  }
  for (const r of sel?.requires ?? []) edge(s, layout, byId.get(r)!, sel!, view.scroll, C.WHITE!, true);
  for (const n of sel?.leadsTo ?? []) edge(s, layout, sel!, byId.get(n)!, view.scroll, C.LCYAN!, true);
  for (const n of nodes) drawNode(s, state, view, layout, n);
  if (moreLeft(view)) arrow(s, GRAPH.x + 1, -1);
  if (moreRight(layout, view)) arrow(s, GRAPH.x + GRAPH.w - 1 - ARROW_W, 1);
  drawStrip(s, state, layout, view);

  // What the selected advance gives.
  const d = techDetails(state, view.selected);
  drawPanel(s, 0, DETAILS_Y, SCREEN_W, SCREEN_H - DETAILS_Y);
  const fresh = view.discovered.includes(view.selected);
  drawText(s, 6, DETAILS_Y + 3, d.name, fresh ? GOLD : INK);
  const standing = fresh ? "Just discovered!" : d.standing;
  const standingInk = fresh ? GOLD : d.status === "available" ? NOTE : d.status === "known" ? GOOD : DIM;
  const lines = drawTextWrapped(s, 6, DETAILS_Y + 12, SCREEN_W - 12, standing, standingInk, 2);
  const rule = DETAILS_Y + 13 + lines * FONT_HEIGHT;
  s.hline(4, rule, SCREEN_W - 8, shade("panel", 2));
  s.hline(4, rule + 1, SCREEN_W - 8, shade("panel", 7));
  let y = rule + 3;
  const labelW = Math.max(0, ...d.rows.map((r) => textWidth(r.label))) + 6;
  for (const row of d.rows) {
    if (y > BUTTON_Y - FONT_HEIGHT) break;
    drawIcon(s, row.icon, 6, y);
    drawText(s, 8 + ICON, y, row.label, DIM);
    const room = Math.max(1, Math.floor((BUTTON_Y - 1 - y) / FONT_HEIGHT));
    y += drawTextWrapped(s, 8 + ICON + labelW, y, SCREEN_W - 16 - ICON - labelW, row.items.join(", "), INK, Math.min(2, room)) * FONT_HEIGHT + 1;
  }
  if (!d.rows.length) drawText(s, 6, y, "It leads to no further advance.", DIM);

  const bs = buttons(state, view);
  for (const b of bs) {
    drawButton(s, b.x, b.y, b.w, 11, b.label, true, b.hit.kind === "research");
  }
  const hint = view.choosing && !canResearch(state, view) ? (view.closable ? "Tab: choices  Esc: close" : "Pick an advance within reach (Tab)")
    : view.choosing ? "Enter: research  Tab: next" : "Arrows: look around";
  drawText(s, 6, BUTTON_Y + 2, hint, DIM);
}

/** What lies under a point of the tech tree window. */
export function techTreeHit(state: GameState, view: TechTreeView, px: number, py: number): TechTreeHit | null {
  for (const b of buttons(state, view)) if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + 11) return b.hit;
  if (px < GRAPH.x || px >= GRAPH.x + GRAPH.w || py < GRAPH.y || py >= GRAPH.y + GRAPH.h) return null;
  const layout = techLayout(state);
  if (py >= STRIP.y - 2 && py < STRIP.y + STRIP.h + 2 && px >= STRIP.x && px < STRIP.x + STRIP.w)
    return { kind: "scrollTo", tier: Math.floor(((px - STRIP.x) / STRIP.w) * layout.tiers) };
  if (moreLeft(view) && px < GRAPH.x + 1 + ARROW_W) return { kind: "scroll", by: -2 };
  if (moreRight(layout, view) && px >= GRAPH.x + GRAPH.w - 1 - ARROW_W) return { kind: "scroll", by: 2 };
  for (const n of layout.nodes) {
    const x = nodeX(n, view.scroll);
    const y = nodeY(layout, n);
    if (px >= x && px < x + NODE_W && py >= y && py < y + NODE_H) return { kind: "advance", id: n.id };
  }
  return null;
}
