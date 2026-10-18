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

/**
 * Speckle for the chrome ramps: -1 a dark speck, 1 a light one, 0 the face. A fixed
 * 64x64 pattern laid by screen position, so the grain never crawls as panels redraw.
 */
const SPECKLE = (() => {
  const t = new Int8Array(64 * 64);
  for (let i = 0; i < t.length; i++) {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) & 15;
    t[i] = h < 3 ? -1 : h < 5 ? 1 : 0;
  }
  return t;
})();

/** Fill a rectangle with a chrome ramp's face (shade 5), speckled with shades 4 and 6. */
export function stipple(s: Surface, x: number, y: number, w: number, h: number, ramp: string): void {
  const face = shade(ramp, 5);
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(s.width, x + w);
  const y1 = Math.min(s.height, y + h);
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) s.data[yy * s.width + xx] = face + SPECKLE[(yy & 63) * 64 + (xx & 63)]!;
}

/** The main screen's raised stone box: speckled grey, light top and left edges, dark bottom and right. */
export function drawStone(s: Surface, x: number, y: number, w: number, h: number): void {
  stipple(s, x + 1, y + 1, w - 2, h - 2, "panel");
  s.hline(x, y, w, shade("panel", 7));
  s.vline(x, y, h, shade("panel", 7));
  s.hline(x + 1, y + h - 1, w - 1, shade("panel", 2));
  s.vline(x + w - 1, y + 1, h - 1, shade("panel", 2));
}

/** Height of a blue box's title strip. */
export const BOX_HEAD = 10;

/** One of the city screen's blue boxes: a dark title strip with its caption, a speckled body, a dark rim. */
export function drawBlueBox(s: Surface, x: number, y: number, w: number, h: number, title = "", titleRight = ""): void {
  s.frame(x, y, w, h, shade("azure", 2));
  stipple(s, x + 1, y + 1, w - 2, h - 2, "azure");
  if (!title && !titleRight) return;
  s.rect(x + 1, y + 1, w - 2, BOX_HEAD - 1, shade("azure", 1));
  s.hline(x + 1, y + BOX_HEAD, w - 2, shade("azure", 2));
  if (title) drawText(s, x + 4, y + 2, title, shade("azure", 7));
  if (titleRight) drawText(s, x + w - 4 - textWidth(titleRight), y + 2, titleRight, C.WHITE!);
}

/** A pale blue button on a blue box: dark label, or a dim button while it cannot be pressed. */
export function drawBlueButton(s: Surface, x: number, y: number, w: number, h: number, label: string, enabled = true): void {
  s.rect(x, y, w, h, enabled ? shade("azure", 7) : shade("azure", 3));
  s.hline(x, y, w, C.WHITE!);
  s.vline(x, y, h, C.WHITE!);
  s.hline(x + 1, y + h - 1, w - 1, shade("azure", 1));
  s.vline(x + w - 1, y + 1, h - 1, shade("azure", 1));
  drawText(s, x + Math.floor((w - textWidth(label)) / 2), y + Math.floor((h - FONT_HEIGHT) / 2) + 1, label, enabled ? shade("azure", 1) : shade("azure", 6));
}

/** A raised button with its label centred; a disabled one keeps its place with a faded label. */
export function drawButton(s: Surface, x: number, y: number, w: number, h: number, label: string, enabled = true): void {
  s.rect(x, y, w, h, shade("ui", 3));
  s.hline(x, y, w, shade("ui", 6));
  s.vline(x, y, h, shade("ui", 6));
  s.hline(x, y + h - 1, w, shade("ui", 0));
  s.vline(x + w - 1, y, h, shade("ui", 0));
  drawText(s, x + Math.floor((w - textWidth(label)) / 2), y + Math.floor((h - FONT_HEIGHT) / 2) + 1, label, enabled ? shade("ui", 7) : shade("ui", 1));
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

/** A window on the stone: black rim, speckled grey face, and a blue title strip when it has a title. */
function drawWindow(s: Surface, x: number, y: number, w: number, h: number, title: string): void {
  s.frame(x, y, w, h, C.BLACK!);
  drawStone(s, x + 1, y + 1, w - 2, h - 2);
  if (!title) return;
  s.rect(x + 2, y + 2, w - 4, 11, shade("azure", 1));
  drawText(s, x + 8, y + 4, title, C.WHITE!);
}

export function drawMenu(s: Surface, m: MenuState): void {
  const { x, y, w, h, lines, itemsY } = menuLayout(m);
  drawWindow(s, x, y, w, h, m.title);
  lines.forEach((line, i) => drawIconLine(s, x + 10, y + (m.title ? 17 : 4) + i * FONT_HEIGHT, line, C.BLACK!));
  if (lines.length) {
    s.hline(x + 4, itemsY - 4, w - 8, shade("panel", 2));
    s.hline(x + 4, itemsY - 3, w - 8, shade("panel", 7));
  }
  m.items.forEach((item, i) => {
    const ry = itemsY + i * MENU_ROW;
    const sel = i === m.selected;
    if (sel) s.rect(x + 4, ry - 1, w - 8, MENU_ROW, shade("azure", 2));
    drawText(s, x + 10, ry, item, sel ? C.WHITE! : C.BLACK!);
    const r = m.right?.[i];
    if (r) drawText(s, x + w - 10 - textWidth(r), ry, r, sel ? shade("azure", 7) : shade("panel", 1));
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
  drawWindow(s, x, y, w, h, input.title);
  s.rect(x + 8, y + 17, w - 16, 12, C.BLACK!);
  s.frame(x + 8, y + 17, w - 16, 12, shade("panel", 2));
  drawText(s, x + 12, y + 19, input.text, C.WHITE!);
  if (cursorOn) s.rect(x + 12 + textWidth(input.text) + 1, y + 19, 4, FONT_HEIGHT, C.YELLOW!);
  drawText(s, x + w - 8 - textWidth("Enter / Esc"), y + 30, "Enter / Esc", shade("panel", 1));
}

/** Small one-line message box at the bottom of the screen. */
export function drawStatusLine(s: Surface, text: string): void {
  s.frame(80, 188, 240, 12, C.BLACK!);
  drawStone(s, 81, 189, 238, 11);
  drawText(s, 84, 191, text, C.BLUE!);
}
