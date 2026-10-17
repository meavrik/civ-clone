import { drawText, FONT_HEIGHT, textWidth } from "./font.js";
import { drawIconLine, iconLineWidth, wrapIcons } from "./icons.js";
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

import type { MenuState, TextInputState } from "@civ/renderer-api";

export const MENU_ROW = FONT_HEIGHT + 1;

interface MenuLayout { x: number; y: number; w: number; h: number; lines: string[]; itemsY: number }

function menuLayout(m: MenuState): MenuLayout {
  const maxItem = Math.max(textWidth(m.title), ...m.items.map((i, k) => textWidth(i) + (m.right?.[k] ? textWidth(m.right[k]!) + 12 : 0)));
  const bodyW = m.body?.length ? Math.max(...m.body.map((l) => iconLineWidth(l))) : 0;
  const w = Math.min(300, Math.max(maxItem, Math.min(bodyW, 276)) + 24);
  const lines = (m.body ?? []).flatMap((l) => wrapIcons(l, w - 20));
  const bodyH = lines.length ? lines.length * FONT_HEIGHT + 5 : 0;
  const head = m.title ? 16 : 3;
  const h = head + bodyH + m.items.length * MENU_ROW + (m.title ? 6 : 3);
  const x = m.anchor ? Math.max(0, Math.min(320 - w, m.anchor.x)) : Math.floor((320 - w) / 2);
  const y = m.anchor ? m.anchor.y : Math.max(0, Math.floor((200 - h) / 2));
  return { x, y, w, h, lines, itemsY: y + head + bodyH };
}

export function menuRect(m: MenuState): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = menuLayout(m);
  return { x, y, w, h };
}

export function drawMenu(s: Surface, m: MenuState): void {
  const { x, y, w, h, lines, itemsY } = menuLayout(m);
  drawPanel(s, x, y, w, h);
  if (m.title) {
    drawText(s, x + 8, y + 4, m.title, shade("ui", 7));
    s.hline(x + 4, y + 13, w - 8, shade("ui", 0));
  }
  lines.forEach((line, i) => drawIconLine(s, x + 10, y + (m.title ? 17 : 4) + i * FONT_HEIGHT, line, shade("ui", 6)));
  if (lines.length) s.hline(x + 4, itemsY - 3, w - 8, shade("ui", 1));
  m.items.forEach((item, i) => {
    const ry = itemsY + i * MENU_ROW;
    const sel = i === m.selected;
    if (sel) s.rect(x + 4, ry - 1, w - 8, MENU_ROW, shade("ui", 5));
    drawText(s, x + 10, ry, item, sel ? C.BLACK! : shade("ui", 7));
    const r = m.right?.[i];
    if (r) drawText(s, x + w - 10 - textWidth(r), ry, r, sel ? C.BLACK! : shade("ui", 5));
  });
}

/** Row index under a screen point, or -1. */
export function menuHit(m: MenuState, px: number, py: number): number {
  const { x, w, itemsY } = menuLayout(m);
  if (px < x + 4 || px > x + w - 4) return -1;
  const i = Math.floor((py - (itemsY - 1)) / MENU_ROW);
  return i >= 0 && i < m.items.length ? i : -1;
}

/** A one-line text prompt: title, the text being typed, a blinking cursor. */
export function drawTextInput(s: Surface, input: TextInputState, cursorOn: boolean): void {
  const w = 200;
  const h = 40;
  const x = Math.floor((320 - w) / 2);
  const y = Math.floor((200 - h) / 2);
  drawPanel(s, x, y, w, h);
  drawText(s, x + 8, y + 4, input.title, shade("ui", 7));
  s.hline(x + 4, y + 13, w - 8, shade("ui", 0));
  s.rect(x + 8, y + 18, w - 16, 12, shade("ui", 0));
  s.frame(x + 8, y + 18, w - 16, 12, shade("ui", 4));
  drawText(s, x + 12, y + 20, input.text, C.WHITE!);
  if (cursorOn) s.rect(x + 12 + textWidth(input.text) + 1, y + 20, 4, FONT_HEIGHT, C.YELLOW!);
  drawText(s, x + w - 8 - textWidth("Enter / Esc"), y + 31, "Enter / Esc", shade("ui", 5));
}

/** Small one-line message box at the bottom of the screen. */
export function drawStatusLine(s: Surface, text: string): void {
  drawPanel(s, 80, 188, 240, 12, true);
  drawText(s, 84, 190, text, C.YELLOW!);
}
