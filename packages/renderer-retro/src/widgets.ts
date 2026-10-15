import { drawText, FONT_HEIGHT, textWidth } from "./font.js";
import { C, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/** A bevelled panel in the UI ramp: the chrome every dialog and screen uses. */
export function drawPanel(s: Surface, x: number, y: number, w: number, h: number, sunken = false): void {
  s.rect(x, y, w, h, shade("ui", 2));
  const hi = shade("ui", sunken ? 0 : 5);
  const lo = shade("ui", sunken ? 5 : 0);
  s.hline(x, y, w, hi);
  s.vline(x, y, h, hi);
  s.hline(x, y + h - 1, w, lo);
  s.vline(x + w - 1, y, h, lo);
}

/** Horizontal progress box with segment ticks (food box, shield box). */
export function drawBox(s: Surface, x: number, y: number, w: number, h: number, value: number, max: number, fill: number): void {
  s.rect(x, y, w, h, shade("ui", 0));
  s.frame(x, y, w, h, shade("ui", 4));
  const inner = w - 2;
  const px = max > 0 ? Math.min(inner, Math.floor((inner * value) / max)) : 0;
  if (px > 0) s.rect(x + 1, y + 1, px, h - 2, fill);
  // Ticks every 10 units.
  if (max > 0 && max <= 400)
    for (let v = 10; v < max; v += 10) {
      const tx = x + 1 + Math.floor((inner * v) / max);
      s.vline(tx, y + 1, h - 2, shade("ui", 1));
    }
}

export interface MenuState {
  title: string;
  items: string[];
  selected: number;
  /** Optional second column per row (cost, turns...). */
  right?: string[];
}

export const MENU_ROW = FONT_HEIGHT + 1;

export function menuRect(m: MenuState): { x: number; y: number; w: number; h: number } {
  const maxItem = Math.max(textWidth(m.title), ...m.items.map((i, k) => textWidth(i) + (m.right?.[k] ? textWidth(m.right[k]!) + 12 : 0)));
  const w = Math.min(300, maxItem + 24);
  const h = 14 + m.items.length * MENU_ROW + 8;
  return { x: Math.floor((320 - w) / 2), y: Math.floor((200 - h) / 2), w, h };
}

export function drawMenu(s: Surface, m: MenuState): void {
  const { x, y, w, h } = menuRect(m);
  drawPanel(s, x, y, w, h);
  drawText(s, x + 8, y + 4, m.title, shade("ui", 7));
  s.hline(x + 4, y + 13, w - 8, shade("ui", 0));
  m.items.forEach((item, i) => {
    const ry = y + 16 + i * MENU_ROW;
    const sel = i === m.selected;
    if (sel) s.rect(x + 4, ry - 1, w - 8, MENU_ROW, shade("ui", 5));
    drawText(s, x + 10, ry, item, sel ? C.BLACK! : shade("ui", 7));
    const r = m.right?.[i];
    if (r) drawText(s, x + w - 10 - textWidth(r), ry, r, sel ? C.BLACK! : shade("ui", 5));
  });
}

/** Row index under a screen point, or -1. */
export function menuHit(m: MenuState, px: number, py: number): number {
  const { x, y, w } = menuRect(m);
  if (px < x + 4 || px > x + w - 4) return -1;
  const i = Math.floor((py - (y + 15)) / MENU_ROW);
  return i >= 0 && i < m.items.length ? i : -1;
}

/** Small one-line message box at the bottom of the screen. */
export function drawStatusLine(s: Surface, text: string): void {
  drawPanel(s, 80, 188, 240, 12, true);
  drawText(s, 84, 190, text, C.YELLOW!);
}
