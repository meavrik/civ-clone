import { drawText, FONT_HEIGHT, textWidth } from "./font.js";
import { drawIconLine, iconLineWidth, wrapIcons } from "./icons.js";
import { C, shade, slotColor } from "./palette.js";
import { drawPicture } from "./pictures.js";
import { SCREEN_H, SCREEN_W, type Surface } from "./surface.js";

/**
 * Inks for text on the stone, every panel in the game: black, a dark grey for what matters
 * less, and darker accents (the bright EGA colours are lost on light grey).
 */
export const INK = C.BLACK!;
export const DIM = shade("panel", 1);
export const FADED = shade("panel", 2);
export const GOOD = shade("grass", 0);
export const BAD = C.RED!;
export const NOTE = C.BLUE!;
export const GOLD = C.BROWN!;

/**
 * Speckle for the stone: -1 a dark speck, 1 a light one, 0 the face. A fixed 64x64
 * pattern laid by screen position, so the grain never crawls as panels redraw.
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
  speckle(s, x, y, w, h, shade(ramp, 4), shade(ramp, 5), shade(ramp, 6));
}

/** Fill a rectangle with `face`, speckled with `dark` and `light` in the stone's grain (any three colours). */
export function speckle(s: Surface, x: number, y: number, w: number, h: number, dark: number, face: number, light: number): void {
  // Laid in fine pixels, so the grain is as fine as the screen.
  const k = s.k;
  const x0 = Math.max(0, x * k);
  const y0 = Math.max(0, y * k);
  const x1 = Math.min(s.fw, (x + w) * k);
  const y1 = Math.min(s.fh, (y + h) * k);
  for (let yy = y0; yy < y1; yy++)
    for (let xx = x0; xx < x1; xx++) {
      const g = SPECKLE[(yy & 63) * 64 + (xx & 63)]!;
      s.data[yy * s.fw + xx] = g < 0 ? dark : g > 0 ? light : face;
    }
}

/** True for the stone's own colours (its face and specks): what text and pictures are drawn over. */
export function isStone(color: number): boolean {
  return color >= shade("panel", 4) && color <= shade("panel", 6);
}

/** A stone box, the one panel of the game: speckled grey, light top and left edges, dark bottom and right (or the reverse, sunken). */
export function drawStone(s: Surface, x: number, y: number, w: number, h: number, sunken = false): void {
  stipple(s, x + 1, y + 1, w - 2, h - 2, "panel");
  const hi = shade("panel", sunken ? 2 : 7);
  const lo = shade("panel", sunken ? 7 : 2);
  s.hline(x, y, w, hi);
  s.vline(x, y, h, hi);
  s.hline(x + 1, y + h - 1, w - 1, lo);
  s.vline(x + w - 1, y + 1, h - 1, lo);
}

/** A panel: the stone. Kept under its old name for the screens that draw one. */
export function drawPanel(s: Surface, x: number, y: number, w: number, h: number, sunken = false): void {
  drawStone(s, x, y, w, h, sunken);
}

/** Height of a title strip. */
export const TITLE_H = 11;

/** A blue title strip across the top of a box, its caption left (or centred) and an optional figure at the right. */
export function drawTitleStrip(s: Surface, x: number, y: number, w: number, title: string, opts: { right?: string; centred?: boolean; color?: number } = {}): void {
  s.rect(x, y, w, TITLE_H, opts.color ?? shade("azure", 1));
  if (opts.centred) drawText(s, x + Math.floor((w - textWidth(title)) / 2), y + 2, title, C.WHITE!);
  else drawText(s, x + 4, y + 2, title, C.WHITE!);
  if (opts.right) drawText(s, x + w - 4 - textWidth(opts.right), y + 2, opts.right, shade("azure", 7));
}

/** A window: black rim, the stone, and a blue title strip when it has a title. */
export function drawWindow(s: Surface, x: number, y: number, w: number, h: number, title: string, opts: { right?: string; centred?: boolean; color?: number } = {}): void {
  s.frame(x, y, w, h, C.BLACK!);
  drawStone(s, x + 1, y + 1, w - 2, h - 2);
  if (title || opts.right) drawTitleStrip(s, x + 2, y + 2, w - 4, title, opts);
}

/** A full-screen page (advisors, reports): one window on black, its title centred, a key hint along the bottom. */
export function drawPage(s: Surface, title: string, hint = ""): void {
  s.fill(C.BLACK!);
  drawWindow(s, 2, 2, SCREEN_W - 4, SCREEN_H - 4, title, { centred: true });
  if (hint) drawText(s, Math.floor((SCREEN_W - textWidth(hint)) / 2), SCREEN_H - 13, hint, DIM);
}

/** A civilization's colour as a small framed square, so even grey and white show on the stone. */
export function drawSwatch(s: Surface, x: number, y: number, color: number): void {
  s.rect(x, y + 1, 6, 6, C.BLACK!);
  s.rect(x + 1, y + 2, 4, 4, color);
}

/** A raised stone button with its label centred; a disabled one keeps its place with a faded label. */
export function drawButton(s: Surface, x: number, y: number, w: number, h: number, label: string, enabled = true, primary = false): void {
  s.rect(x, y, w, h, primary && enabled ? shade("azure", 2) : shade("panel", 6));
  s.hline(x, y, w, C.WHITE!);
  s.vline(x, y, h, C.WHITE!);
  s.hline(x + 1, y + h - 1, w - 1, shade("panel", 1));
  s.vline(x + w - 1, y + 1, h - 1, shade("panel", 1));
  const ink = !enabled ? FADED : primary ? C.WHITE! : INK;
  drawText(s, x + Math.floor((w - textWidth(label)) / 2), y + Math.floor((h - FONT_HEIGHT) / 2) + 1, label, ink);
}

/** Horizontal progress box with segment ticks (food box, shield box): a black bed sunk in the stone. */
export function drawBox(s: Surface, x: number, y: number, w: number, h: number, value: number, max: number, fill: number): void {
  s.rect(x, y, w, h, C.BLACK!);
  s.frame(x, y, w, h, shade("panel", 2));
  const inner = w - 2;
  const px = max > 0 ? Math.min(inner, Math.floor((inner * value) / max)) : 0;
  if (px > 0) s.rect(x + 1, y + 1, px, h - 2, fill);
  // Ticks every 10 units.
  if (max > 0 && max <= 400)
    for (let v = 10; v < max; v += 10) {
      const tx = x + 1 + Math.floor((inner * v) / max);
      s.vline(tx, y + 1, h - 2, shade("panel", 1));
    }
}

import { keepInView, menuButtons, MODAL_MAX_SHARE, PICTURES, type MenuState, type TextInputState } from "@civ/renderer-api";

export const MENU_ROW = FONT_HEIGHT + 1;
/** A modal's choices as buttons (see `menuButtons`): this tall, this far apart, at least this wide. */
const BUTTON_H = FONT_HEIGHT + 4;
const BUTTON_ROW = BUTTON_H + 3;
const BUTTON_MIN_W = 56;
/** A titled window is at least this wide; its text wraps rather than widen it past MODAL_MAX_SHARE of the screen. */
const MODAL_MIN_W = 112;

/** A list too long for the screen scrolls: its bar runs down the right of the rows, this wide. */
const SCROLL_W = 5;

interface MenuLayout {
  x: number; y: number; w: number; h: number; lines: string[]; itemsY: number; row: number; buttons: boolean; bx: number; bw: number; picH: number;
  /** Rows on view, and the first of them; `rows` is short of the items when the list scrolls. */
  rows: number; top: number;
}

/** Where a menu goes on a screen `screenW` wide: centred, or at its anchor kept on the screen. */
function menuLayout(m: MenuState, screenW = SCREEN_W): MenuLayout {
  const buttons = menuButtons(m);
  const itemW = Math.max(0, ...m.items.map((i, k) => textWidth(i) + (m.right?.[k] ? textWidth(m.right[k]!) + 12 : 0)));
  const bw = buttons ? Math.max(BUTTON_MIN_W, itemW + 16) : 0;
  const head = m.title ? 16 : 3;
  const foot = m.title ? 6 : 3;
  const pic = m.picture ? PICTURES[m.picture.id] : undefined;
  const picH = pic ? pic.h + 8 : 0;
  // A list that will not fit even with its rows closed up scrolls at the usual row height, beside its bar.
  const roomGuess = 200 - (m.anchor?.y ?? 0) - head - picH - foot - (m.body?.length ? m.body.length * FONT_HEIGHT + 5 : 0);
  const scrolls = !buttons && m.items.length * FONT_HEIGHT > roomGuess;
  const need = Math.max(textWidth(m.title) + 16 + (m.close ? TITLE_H : 0), buttons ? bw + 24 : itemW + 24 + (scrolls ? SCROLL_W + 4 : 0));
  const bodyW = m.body?.length ? Math.max(...m.body.map((l) => iconLineWidth(l))) + 20 : 0;
  const w = Math.min(300, Math.max(need, Math.min(bodyW, Math.round(SCREEN_W * MODAL_MAX_SHARE)), m.title ? MODAL_MIN_W : 0, pic ? pic.w + 24 : 0));
  const lines = (m.body ?? []).flatMap((l) => wrapIcons(l, w - 20));
  const bodyH = lines.length ? lines.length * FONT_HEIGHT + 5 : 0;
  // Long lists (every tribe) close up their rows to stay on screen; longer ones still scroll.
  const room = 200 - (m.anchor?.y ?? 0) - head - picH - bodyH - foot;
  const fits = m.items.length * FONT_HEIGHT <= room;
  const row = fits ? Math.max(FONT_HEIGHT, Math.min(MENU_ROW, Math.floor(room / Math.max(1, m.items.length)))) : MENU_ROW;
  const rows = buttons || fits ? m.items.length : Math.max(1, Math.floor(room / row));
  const itemsH = buttons ? m.items.length * BUTTON_ROW + 1 : rows * row;
  const h = head + picH + bodyH + itemsH + foot;
  const x = m.anchor ? Math.max(0, Math.min(screenW - w, m.anchor.x)) : Math.floor((screenW - w) / 2);
  const y = m.anchor ? m.anchor.y : Math.max(0, Math.floor((200 - h) / 2));
  const top = rows < m.items.length ? keepInView(m, rows) : 0;
  return { x, y, w, h, lines, itemsY: y + head + picH + bodyH, row, buttons, bx: x + Math.floor((w - bw) / 2), bw, picH, rows, top };
}

export function menuRect(m: MenuState, screenW = SCREEN_W): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = menuLayout(m, screenW);
  return { x, y, w, h };
}

/** How many of a menu's rows show at once. */
export function menuRows(m: MenuState): number {
  return menuLayout(m).rows;
}

/** A scrolling menu's bar: its track beside the rows, and the thumb that shows which of them are on view. */
function scrollBar(m: MenuState, l: MenuLayout): { x: number; y: number; h: number; thumbY: number; thumbH: number } {
  const x = l.x + l.w - 4 - SCROLL_W;
  const y = l.itemsY - 1;
  const h = l.rows * l.row;
  const track = h - 2 * (SCROLL_W + 1);
  const thumbH = Math.max(3, Math.round((track * l.rows) / m.items.length));
  const thumbY = y + SCROLL_W + 1 + Math.round(((track - thumbH) * l.top) / Math.max(1, m.items.length - l.rows));
  return { x, y, h, thumbY, thumbH };
}

/** Where a point lies on a scrolling menu's bar: -1 above its thumb (the up arrow too), 1 below, 0 on it; null off the bar. */
export function menuScrollAt(m: MenuState, px: number, py: number, screenW = SCREEN_W): number | null {
  const l = menuLayout(m, screenW);
  if (l.rows >= m.items.length) return null;
  const b = scrollBar(m, l);
  if (px < b.x - 1 || px > b.x + SCROLL_W || py < b.y || py >= b.y + b.h) return null;
  return py < b.thumbY ? -1 : py >= b.thumbY + b.thumbH ? 1 : 0;
}

export function drawMenu(s: Surface, m: MenuState): void {
  const l = menuLayout(m, s.width);
  const { x, y, w, h, lines, itemsY, row, buttons, bx, bw, picH, rows, top } = l;
  const scrolls = rows < m.items.length;
  drawWindow(s, x, y, w, h, m.title);
  if (m.close && m.title) drawCloseBox(s, x + w - 3 - (TITLE_H - 2), y + 3);
  const pic = m.picture ? PICTURES[m.picture.id] : undefined;
  if (pic && m.picture) {
    // The building on a strip of grass, as it stands in the city view.
    const px = x + Math.floor((w - pic.w) / 2);
    const ground = y + (m.title ? 16 : 3) + pic.h + 3;
    s.rect(px - 4, ground, pic.w + 8, 2, shade("grass", 4));
    drawPicture(s, pic, px, ground, slotColor(m.picture.slot));
  }
  lines.forEach((line, i) => drawIconLine(s, x + 10, y + (m.title ? 17 : 4) + picH + i * FONT_HEIGHT, line, C.BLACK!));
  if (lines.length && m.items.length) {
    s.hline(x + 4, itemsY - 4, w - 8, shade("panel", 2));
    s.hline(x + 4, itemsY - 3, w - 8, shade("panel", 7));
  }
  const rowW = w - 8 - (scrolls ? SCROLL_W + 2 : 0);
  m.items.forEach((item, i) => {
    const sel = i === m.selected;
    if (buttons) {
      drawButton(s, bx, itemsY + 1 + i * BUTTON_ROW, bw, BUTTON_H, item, true, sel);
      return;
    }
    if (i < top || i >= top + rows) return;
    const ry = itemsY + (i - top) * row;
    if (sel) s.rect(x + 4, ry - 1, rowW, row, shade("azure", 2));
    drawText(s, x + 10, ry, item, sel ? C.WHITE! : C.BLACK!);
    const r = m.right?.[i];
    if (r) drawText(s, x + 4 + rowW - 6 - textWidth(r), ry, r, sel ? shade("azure", 7) : DIM);
  });
  if (scrolls) drawScrollBar(s, m, l);
}

/** The bar beside a scrolling list: arrows at its ends (dark while there is more that way), a thumb for the rows on view. */
function drawScrollBar(s: Surface, m: MenuState, l: MenuLayout): void {
  const b = scrollBar(m, l);
  s.rect(b.x, b.y, SCROLL_W, b.h, shade("panel", 3));
  s.rect(b.x, b.thumbY, SCROLL_W, b.thumbH, shade("azure", 2));
  const more = (up: boolean) => (up ? l.top > 0 : l.top + l.rows < m.items.length);
  for (const up of [true, false]) {
    const ink = more(up) ? INK : FADED;
    const ay = up ? b.y + 1 : b.y + b.h - 2;
    // A small triangle, its point toward the hidden rows.
    for (let k = 0; k < 3; k++) s.hline(b.x + 2 - k, up ? ay + k : ay - k, 1 + 2 * k, ink);
  }
}

/** A window's close box: a small stone button in its title strip with an X on it. */
function drawCloseBox(s: Surface, x: number, y: number): void {
  const n = TITLE_H - 2;
  drawButton(s, x, y, n, n, "");
  for (let i = 0; i < n - 4; i++) {
    s.set(x + 2 + i, y + 2 + i, C.BLACK!);
    s.set(x + n - 3 - i, y + 2 + i, C.BLACK!);
  }
}

/** Row index under a screen point, or -1. */
export function menuHit(m: MenuState, px: number, py: number, screenW = SCREEN_W): number {
  const { x, w, itemsY, row, buttons, bx, bw, rows, top } = menuLayout(m, screenW);
  if (buttons) {
    const off = py - itemsY - 1;
    const i = Math.floor(off / BUTTON_ROW);
    if (px < bx || px >= bx + bw || off < 0 || off % BUTTON_ROW >= BUTTON_H) return -1;
    return i < m.items.length ? i : -1;
  }
  const right = x + w - 4 - (rows < m.items.length ? SCROLL_W + 2 : 0);
  if (px < x + 4 || px > right) return -1;
  const i = Math.floor((py - (itemsY - 1)) / row);
  return i >= 0 && i < rows && top + i < m.items.length ? top + i : -1;
}

/** A one-line text prompt: title, the text being typed, a blinking cursor. */
export function drawTextInput(s: Surface, input: TextInputState, cursorOn: boolean): void {
  const w = 200;
  const h = 40;
  const x = Math.floor((s.width - w) / 2);
  const y = Math.floor((200 - h) / 2);
  drawWindow(s, x, y, w, h, input.title);
  s.rect(x + 8, y + 17, w - 16, 12, C.BLACK!);
  s.frame(x + 8, y + 17, w - 16, 12, shade("panel", 2));
  drawText(s, x + 12, y + 19, input.text, C.WHITE!);
  if (cursorOn) s.rect(x + 12 + textWidth(input.text) + 1, y + 19, 4, FONT_HEIGHT, C.YELLOW!);
  drawText(s, x + w - 8 - textWidth("Enter / Esc"), y + 30, "Enter / Esc", DIM);
}

/** Small one-line message box at the bottom of the screen. */
export function drawStatusLine(s: Surface, text: string): void {
  s.frame(80, 188, s.width - 80, 12, C.BLACK!);
  drawStone(s, 81, 189, s.width - 82, 11);
  drawText(s, 84, 191, text, NOTE);
}
