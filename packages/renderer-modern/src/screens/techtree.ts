import { advance, advancesFor, type GameState } from "@civ/core";
import {
  canResearch,
  techDetails,
  techLane,
  techLayout,
  techStatus,
  techTreeTitle,
  type TechLayout,
  type TechNode,
  type TechTreeHit,
  type TechTreeView,
} from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { circle, fillRound, measure, panel, paragraph, roundRect, strokeRound, text } from "../draw.js";
import { paintIcon } from "../icons.js";
import { H, TECH, UI, W } from "../theme.js";

/**
 * The tech tree window: the graph of advances a few tiers at a time, the one
 * just found glowing, and under it what the selected advance gives, with the
 * button that sets it as the next research.
 */

const GRAPH = { x: 32, y: 70, w: W - 64, h: 322 };
const NODE_W = 150;
const NODE_H = 26;
const PITCH_X = 184;
const PITCH_Y = 32;
const TOP = GRAPH.y + 12;
/** Tiers that fit across the window (nearly five). */
export const TECH_COLUMNS = GRAPH.w / PITCH_X;
const STRIP = { x: GRAPH.x + 48, y: GRAPH.y + GRAPH.h - 16, w: GRAPH.w - 96, h: 6 };
const ARROW_R = 15;
const DETAILS_Y = GRAPH.y + GRAPH.h + 14;
const BUTTON = { y: H - 106, h: 36 };

function nodeX(node: TechNode, scroll: number): number {
  return GRAPH.x + 16 + (node.tier - scroll) * PITCH_X;
}

/** Rows sit PITCH_Y apart, closer when a tier holds more than the window fits. */
function pitchY(layout: TechLayout): number {
  return layout.rows <= 1 ? PITCH_Y : Math.min(PITCH_Y, Math.floor((STRIP.y - 8 - TOP - NODE_H) / (layout.rows - 1)));
}

function nodeY(layout: TechLayout, node: TechNode): number {
  return TOP + node.row * pitchY(layout);
}

/**
 * A curve from a prerequisite's right side to the left of what it leads to; one that skips
 * tiers runs along the lane between two rows past them. Drawn only where the window shows it.
 */
function edge(ctx: Context2D, layout: TechLayout, from: TechNode, to: TechNode, scroll: number, color: string, width: number): void {
  const x0 = nodeX(from, scroll) + NODE_W;
  const y0 = nodeY(layout, from) + NODE_H / 2;
  const x1 = nodeX(to, scroll);
  const y1 = nodeY(layout, to) + NODE_H / 2;
  const lo = GRAPH.x - 12;
  const hi = GRAPH.x + GRAPH.w + 12;
  if (Math.max(x0, x1) < lo || Math.min(x0, x1) > hi) return;
  const pts: [number, number][] = [[x0, y0]];
  const curve = (xa: number, ya: number, xb: number, yb: number): void => {
    const steps = Math.max(4, Math.ceil((xb - xa) / 8));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      pts.push([xa + (xb - xa) * t, ya + (yb - ya) * t * t * (3 - 2 * t)]);
    }
  };
  const lane = techLane(layout, from, to);
  if (lane === null) curve(x0, y0, x1, y1);
  else {
    const gap = PITCH_X - NODE_W;
    const pitch = pitchY(layout);
    const yl = TOP + lane * pitch + NODE_H + (pitch - NODE_H) / 2;
    curve(x0, y0, x0 + gap, yl);
    // The straight run in short steps, so the culling below can drop what lies off screen.
    for (let x = x0 + gap + PITCH_X / 2; x < x1 - gap; x += PITCH_X / 2) pts.push([x, yl]);
    pts.push([x1 - gap, yl]);
    curve(x1 - gap, yl, x1, y1);
  }
  ctx.beginPath();
  let pen = false;
  let [px, py] = pts[0]!;
  for (const [nx, ny] of pts.slice(1)) {
    const inside = Math.max(px, nx) >= lo && Math.min(px, nx) <= hi;
    if (inside) {
      if (!pen) ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
    }
    pen = inside;
    px = nx;
    py = ny;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

function fitLabel(ctx: Context2D, name: string, max: number): string {
  if (measure(ctx, name, 13, "600") <= max) return name;
  let t = name;
  while (t.length > 1 && measure(ctx, `${t}…`, 13, "600") > max) t = t.slice(0, -1);
  return `${t}…`;
}

function drawNode(ctx: Context2D, state: GameState, view: TechTreeView, layout: TechLayout, node: TechNode): void {
  const x = nodeX(node, view.scroll);
  const y = nodeY(layout, node);
  if (x + NODE_W < GRAPH.x || x > GRAPH.x + GRAPH.w) return;
  const fresh = view.discovered.includes(node.id);
  const look = fresh ? TECH.fresh : TECH[techStatus(state, node.id)];
  // A box cut by the window's edge keeps a straight cut: its far corner lies outside the clip.
  const x0 = Math.max(x, GRAPH.x - 10);
  const x1 = Math.min(x + NODE_W, GRAPH.x + GRAPH.w + 10);
  if (fresh) {
    ctx.save();
    ctx.shadowColor = TECH.glow;
    ctx.shadowBlur = view.blink ? 22 : 12;
    fillRound(ctx, x0, y, x1 - x0, NODE_H, 8, look.fill);
    ctx.restore();
  } else fillRound(ctx, x0, y, x1 - x0, NODE_H, 8, look.fill);
  strokeRound(ctx, x0 + 0.5, y + 0.5, x1 - x0 - 1, NODE_H - 1, 8, look.edge);
  if (node.id === view.selected) strokeRound(ctx, x0 - 3, y - 3, x1 - x0 + 6, NODE_H + 6, 10, TECH.ring, 2);
  text(ctx, x + 10, y + 6, fitLabel(ctx, node.name, NODE_W - 20), { size: 13, weight: "600", color: look.ink });
}

function moreLeft(view: TechTreeView): boolean {
  return view.scroll > 0.01;
}

function moreRight(layout: TechLayout, view: TechTreeView): boolean {
  return view.scroll + TECH_COLUMNS < layout.tiers - 0.01;
}

const ARROW_Y = GRAPH.y + (GRAPH.h - 20) / 2;
const LEFT_ARROW_X = GRAPH.x + ARROW_R + 6;
const RIGHT_ARROW_X = GRAPH.x + GRAPH.w - ARROW_R - 6;

function arrow(ctx: Context2D, cx: number, dir: -1 | 1): void {
  circle(ctx, cx, ARROW_Y, ARROW_R, TECH.arrow);
  ctx.beginPath();
  ctx.moveTo(cx - dir * 3, ARROW_Y - 6);
  ctx.lineTo(cx + dir * 4, ARROW_Y);
  ctx.lineTo(cx - dir * 3, ARROW_Y + 6);
  ctx.strokeStyle = UI.ink;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawStrip(ctx: Context2D, state: GameState, layout: TechLayout, view: TechTreeView): void {
  const { tiers, nodes } = layout;
  const per = STRIP.w / tiers;
  fillRound(ctx, STRIP.x, STRIP.y, STRIP.w, STRIP.h, STRIP.h / 2, UI.shadow);
  for (const n of nodes) {
    const st = techStatus(state, n.id);
    const mark = view.discovered.includes(n.id) ? TECH.fresh.fill : st === "available" || st === "researching" ? TECH.leads : null;
    if (mark) circle(ctx, STRIP.x + (n.tier + 0.5) * per, STRIP.y + STRIP.h / 2, 2.5, mark);
  }
  fillRound(ctx, STRIP.x + view.scroll * per, STRIP.y - 3, Math.min(TECH_COLUMNS, tiers) * per, STRIP.h + 6, (STRIP.h + 6) / 2, TECH.thumb);
}

interface Button { x: number; w: number; label: string; hit: TechTreeHit }

function buttons(ctx: Context2D, state: GameState, view: TechTreeView): Button[] {
  const out: Button[] = [];
  let x = 48;
  const add = (label: string, hit: TechTreeHit): void => {
    const w = measure(ctx, label, 15, "600") + 36;
    out.push({ x, w, label, hit });
    x += w + 12;
  };
  if (canResearch(state, view)) add(`Research ${advance(view.selected).name}`, { kind: "research" });
  if (view.closable) add("Close", { kind: "close" });
  return out;
}

export function drawTechTree(ctx: Context2D, state: GameState, view: TechTreeView): void {
  const layout = techLayout(state);
  const { nodes, byId } = layout;
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 16, 16, W - 32, H - 32, 16);
  text(ctx, 40, 30, techTreeTitle(view), { size: 22, weight: "600", color: view.discovered.length ? UI.accent : UI.ink });
  const known = state.players[state.currentPlayer]!.advances.length;
  text(ctx, W - 40, 36, `${known} of ${advancesFor(state).length} advances known`, { size: 13, color: UI.dim, align: "right" });

  fillRound(ctx, GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h, 12, TECH.ground);
  ctx.save();
  roundRect(ctx, GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h, 12);
  ctx.clip();
  const sel = byId.get(view.selected);
  for (const n of nodes) for (const r of n.requires) {
    if (n.id === view.selected || r === view.selected) continue;
    edge(ctx, layout, byId.get(r)!, n, view.scroll, TECH.edge, 1.5);
  }
  for (const r of sel?.requires ?? []) edge(ctx, layout, byId.get(r)!, sel!, view.scroll, TECH.needs, 2.5);
  for (const n of sel?.leadsTo ?? []) edge(ctx, layout, sel!, byId.get(n)!, view.scroll, TECH.leads, 2.5);
  for (const n of nodes) drawNode(ctx, state, view, layout, n);
  ctx.restore();
  if (moreLeft(view)) arrow(ctx, LEFT_ARROW_X, -1);
  if (moreRight(layout, view)) arrow(ctx, RIGHT_ARROW_X, 1);
  drawStrip(ctx, state, layout, view);

  // What the selected advance gives.
  const d = techDetails(state, view.selected);
  const fresh = view.discovered.includes(view.selected);
  text(ctx, 48, DETAILS_Y, d.name, { size: 24, weight: "600", color: fresh ? UI.accent : UI.ink });
  const standingColor = fresh ? UI.accent : d.status === "available" ? UI.info : d.status === "known" ? UI.ok : UI.dim;
  paragraph(ctx, 48, DETAILS_Y + 36, 300, fresh ? "Just discovered!" : d.standing, { size: 14, color: standingColor }, 3);
  let y = DETAILS_Y + 2;
  const rowsX = 380;
  for (const row of d.rows) {
    if (y > H - 64) break;
    paintIcon(ctx, row.icon, rowsX, y, 18);
    text(ctx, rowsX + 28, y + 1, row.label, { size: 13, color: UI.dim });
    y += Math.max(22, paragraph(ctx, rowsX + 130, y, W - 48 - rowsX - 130, row.items.join(", "), { size: 14 }, 2)) + 6;
  }
  if (!d.rows.length) text(ctx, rowsX, y, "It leads to no further advance.", { size: 14, color: UI.dim });

  for (const b of buttons(ctx, state, view)) {
    const primary = b.hit.kind === "research";
    if (primary) fillRound(ctx, b.x, BUTTON.y, b.w, BUTTON.h, 10, TECH.button);
    else strokeRound(ctx, b.x + 0.5, BUTTON.y + 0.5, b.w - 1, BUTTON.h - 1, 10, UI.panelEdge, 1.5);
    text(ctx, b.x + b.w / 2, BUTTON.y + 9, b.label, { size: 15, weight: "600", color: primary ? TECH.buttonInk : UI.ink, align: "center" });
  }
  const close = view.closable ? " · Esc close" : "";
  const hint = view.choosing && !canResearch(state, view)
    ? `${view.closable ? "Tab next choice" : "Pick an advance within reach · Tab next choice"} · arrows or click to look${close}`
    : view.choosing ? `Enter research · Tab next choice · click an advance to see what it brings${close}`
    : "Arrows or click to look around · Esc close";
  text(ctx, 48, H - 56, hint, { size: 12, color: UI.dim });
}

/** What lies under a point of the tech tree window. */
export function techTreeHit(ctx: Context2D, state: GameState, view: TechTreeView, px: number, py: number): TechTreeHit | null {
  for (const b of buttons(ctx, state, view)) if (px >= b.x && px < b.x + b.w && py >= BUTTON.y && py < BUTTON.y + BUTTON.h) return b.hit;
  if (px < GRAPH.x || px >= GRAPH.x + GRAPH.w || py < GRAPH.y || py >= GRAPH.y + GRAPH.h) return null;
  const layout = techLayout(state);
  if (py >= STRIP.y - 6 && py < STRIP.y + STRIP.h + 6 && px >= STRIP.x && px < STRIP.x + STRIP.w)
    return { kind: "scrollTo", tier: Math.floor(((px - STRIP.x) / STRIP.w) * layout.tiers) };
  const onArrow = (cx: number) => Math.hypot(px - cx, py - ARROW_Y) <= ARROW_R + 4;
  if (moreLeft(view) && onArrow(LEFT_ARROW_X)) return { kind: "scroll", by: -2 };
  if (moreRight(layout, view) && onArrow(RIGHT_ARROW_X)) return { kind: "scroll", by: 2 };
  for (const n of layout.nodes) {
    const x = nodeX(n, view.scroll);
    const y = nodeY(layout, n);
    if (px >= x && px < x + NODE_W && py >= y && py < y + NODE_H) return { kind: "advance", id: n.id };
  }
  return null;
}
