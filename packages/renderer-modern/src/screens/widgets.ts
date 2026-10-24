import { menuButtons, MODAL_MAX_SHARE, type MenuState, type TextInputState } from "@civ/renderer-api";
import type { Context2D } from "../context.js";
import { fillRound, measure, panel, strokeRound, text, wrap } from "../draw.js";
import { BUTTON, H, UI, VIEW_X, W } from "../theme.js";
import { drawIconLine, iconLineWidth, wrapIcons } from "../icons.js";

/** Menus, the text prompt and the status line: overlays drawn on top of any screen. */

const ROW = 30;
const TITLE_H = 48;

const BODY_LINE = 21;
/** A modal's choices as buttons (see `menuButtons`): pills this tall, this far apart, at least this wide. */
const BUTTON_H = 36;
const BUTTON_GAP = 8;
const BUTTON_MIN_W = 140;

interface MenuLayout { x: number; y: number; w: number; h: number; lines: string[]; itemsY: number; row: number; buttons: boolean; bx: number; bw: number }

function menuLayout(ctx: Context2D, m: MenuState): MenuLayout {
  const buttons = menuButtons(m);
  let itemW = 0;
  m.items.forEach((item, i) => {
    const right = m.right?.[i];
    itemW = Math.max(itemW, measure(ctx, item, 15, buttons ? "600" : "normal") + (right ? measure(ctx, right, 13) + 32 : 0));
  });
  const bw = buttons ? Math.max(BUTTON_MIN_W, itemW + 48) : 0;
  const widest = Math.max(measure(ctx, m.title, 18, "600"), buttons ? bw : itemW);
  // Text wraps rather than widen the window past MODAL_MAX_SHARE of the screen.
  let bodyW = 0;
  for (const l of m.body ?? []) bodyW = Math.max(bodyW, Math.min(iconLineWidth(ctx, l, 15), Math.round(W * MODAL_MAX_SHARE) - 56));
  const w = Math.min(W - 80, Math.max(m.anchor ? 240 : 320, Math.max(widest, bodyW) + 56));
  const lines = (m.body ?? []).flatMap((l) => wrapIcons(ctx, l, w - 48, 15));
  const bodyH = lines.length ? lines.length * BODY_LINE + 14 : 0;
  // A dropdown (no title) has no header row.
  const head = m.title ? TITLE_H : 10;
  const top = m.anchor ? m.anchor.y : 32;
  // Long lists (every tribe, every build) tighten their rows to stay on screen.
  const row = buttons ? BUTTON_H + BUTTON_GAP : Math.max(20, Math.min(ROW, Math.floor((H - top - head - bodyH - 16) / Math.max(1, m.items.length))));
  const itemsH = buttons ? m.items.length * row - BUTTON_GAP + 6 : m.items.length * row;
  const h = head + bodyH + itemsH + (m.title ? 16 : 10);
  const x = m.anchor ? Math.max(4, Math.min(W - w - 4, m.anchor.x)) : Math.round((W - w) / 2);
  const y = m.anchor ? m.anchor.y : Math.round(Math.max(16, (H - h) / 2));
  return { x, y, w, h, lines, itemsY: y + head + bodyH, row, buttons, bx: x + Math.round((w - bw) / 2), bw };
}

export function menuRect(ctx: Context2D, m: MenuState): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = menuLayout(ctx, m);
  return { x, y, w, h };
}

export function drawMenu(ctx: Context2D, m: MenuState): void {
  const { x, y, w, h, lines, itemsY, row, buttons, bx, bw } = menuLayout(ctx, m);
  panel(ctx, x, y, w, h, m.anchor ? 10 : 14, UI.card);
  if (m.title) {
    text(ctx, x + 24, y + 14, m.title, { size: 18, weight: "600" });
    ctx.fillStyle = UI.panelEdge;
    ctx.fillRect(x + 16, y + TITLE_H - 6, w - 32, 1);
  }
  lines.forEach((line, i) => drawIconLine(ctx, x + 24, y + (m.title ? TITLE_H + 2 : 12) + i * BODY_LINE, line, { size: 15, color: "#d5dde6" }));
  if (lines.length) { ctx.fillStyle = UI.panelEdge; ctx.fillRect(x + 16, itemsY - 7, w - 32, 1); }
  m.items.forEach((item, i) => {
    const ry = itemsY + i * row;
    const sel = i === m.selected;
    if (buttons) {
      // The chosen one filled, the rest outlined, like the city screen's buttons.
      const by = ry + 6;
      if (sel) fillRound(ctx, bx, by, bw, BUTTON_H, 10, BUTTON.fill);
      else strokeRound(ctx, bx + 0.5, by + 0.5, bw - 1, BUTTON_H - 1, 10, BUTTON.edge, 1.5);
      text(ctx, bx + bw / 2, by + 10, item, { size: 15, weight: "600", color: sel ? BUTTON.ink : BUTTON.label, align: "center" });
      return;
    }
    if (sel) fillRound(ctx, x + 10, ry + 1, w - 20, row - 2, 8, UI.selection);
    text(ctx, x + 24, ry + Math.round((row - 16) / 2), item, { size: 15, color: sel ? UI.ink : "#c9d3de", weight: sel ? "600" : "normal" });
    const r = m.right?.[i];
    if (r) text(ctx, x + w - 24, ry + Math.round((row - 14) / 2), r, { size: 13, color: sel ? UI.accent : UI.dim, align: "right" });
  });
}

/** Row index under a screen point, or -1. */
export function menuHit(ctx: Context2D, m: MenuState, px: number, py: number): number {
  const { x, w, itemsY, row, buttons, bx, bw } = menuLayout(ctx, m);
  if (buttons) {
    const off = py - itemsY - 6;
    const i = Math.floor(off / row);
    if (px < bx || px > bx + bw || off < 0 || off % row > BUTTON_H) return -1;
    return i < m.items.length ? i : -1;
  }
  if (px < x + 10 || px > x + w - 10) return -1;
  const i = Math.floor((py - itemsY) / row);
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
