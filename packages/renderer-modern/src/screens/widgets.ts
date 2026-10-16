import type { MenuState, TextInputState } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { fillRound, measure, panel, text } from "../draw.js";
import { H, UI, VIEW_X, W } from "../theme.js";

/** Menus, the text prompt and the status line: overlays drawn on top of any screen. */

const ROW = 30;
const TITLE_H = 48;

export function menuRect(ctx: Context2D, m: MenuState): { x: number; y: number; w: number; h: number } {
  let widest = measure(ctx, m.title, 18, "600");
  m.items.forEach((item, i) => {
    const right = m.right?.[i];
    widest = Math.max(widest, measure(ctx, item, 15) + (right ? measure(ctx, right, 13) + 32 : 0));
  });
  const w = Math.min(W - 80, Math.max(320, widest + 56));
  const h = TITLE_H + m.items.length * ROW + 16;
  return { x: Math.round((W - w) / 2), y: Math.round(Math.max(24, (H - h) / 2)), w, h };
}

export function drawMenu(ctx: Context2D, m: MenuState): void {
  const { x, y, w, h } = menuRect(ctx, m);
  panel(ctx, x, y, w, h, 14, UI.card);
  text(ctx, x + 24, y + 14, m.title, { size: 18, weight: "600" });
  ctx.fillStyle = UI.panelEdge;
  ctx.fillRect(x + 16, y + TITLE_H - 6, w - 32, 1);
  m.items.forEach((item, i) => {
    const ry = y + TITLE_H + i * ROW;
    const sel = i === m.selected;
    if (sel) fillRound(ctx, x + 10, ry + 1, w - 20, ROW - 2, 8, UI.selection);
    text(ctx, x + 24, ry + 7, item, { size: 15, color: sel ? UI.ink : "#c9d3de", weight: sel ? "600" : "normal" });
    const r = m.right?.[i];
    if (r) text(ctx, x + w - 24, ry + 8, r, { size: 13, color: sel ? UI.accent : UI.dim, align: "right" });
  });
}

/** Row index under a screen point, or -1. */
export function menuHit(ctx: Context2D, m: MenuState, px: number, py: number): number {
  const { x, y, w } = menuRect(ctx, m);
  if (px < x + 10 || px > x + w - 10) return -1;
  const i = Math.floor((py - (y + TITLE_H)) / ROW);
  return i >= 0 && i < m.items.length ? i : -1;
}

export function drawTextInput(ctx: Context2D, input: TextInputState, cursorOn: boolean): void {
  const w = 480;
  const h = 128;
  const x = Math.round((W - w) / 2);
  const y = Math.round((H - h) / 2);
  panel(ctx, x, y, w, h, 14, UI.card);
  text(ctx, x + 24, y + 16, input.title, { size: 18, weight: "600" });
  fillRound(ctx, x + 24, y + 52, w - 48, 40, 8, "rgba(0,0,0,0.4)");
  ctx.strokeStyle = UI.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 24.5, y + 52.5, w - 49, 39);
  text(ctx, x + 36, y + 62, input.text, { size: 18 });
  if (cursorOn) {
    const cx = x + 36 + measure(ctx, input.text, 18) + 2;
    ctx.fillStyle = UI.accent;
    ctx.fillRect(cx, y + 60, 2, 24);
  }
  text(ctx, x + w - 24, y + 100, "Enter to confirm · Esc to cancel", { size: 12, color: UI.dim, align: "right" });
}

/** A pill over the map's bottom edge for a short message. */
export function drawStatusLine(ctx: Context2D, s: string): void {
  const w = Math.min(W - VIEW_X - 40, measure(ctx, s, 14) + 36);
  const x = VIEW_X + Math.round((W - VIEW_X - w) / 2);
  const y = H - 46;
  fillRound(ctx, x, y, w, 32, 16, "rgba(10, 14, 20, 0.85)");
  text(ctx, x + w / 2, y + 8, s, { size: 14, color: UI.accent, align: "center" });
}
