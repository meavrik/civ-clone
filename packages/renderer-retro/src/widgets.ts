import { drawText, FONT_HEIGHT, textWidth } from "./font.js";
import { drawIconLine, iconLineWidth, wrapIcons } from "./icons.js";
import { unitSprite } from "./overlays.js";
import { C, DIMMED, shade, slotColor } from "./palette.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { SCREEN_H, SCREEN_W, Surface } from "./surface.js";

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

/**
 * Darken everything drawn so far, the backdrop behind a window (asked for 2026-10-24): each pixel to its
 * colour's darkened twin (`DIMMED`). Once a frame: stacked windows share one backdrop.
 */
export function dimScreen(s: Surface): void {
  if (s.dimmed) return;
  s.dimmed = true;
  const d = s.data;
  for (let i = 0; i < d.length; i++) d[i] = DIMMED[d[i]!]!;
  // The user's pictures on what was drawn darken with it (the apps lay them over the canvas).
  for (const a of s.art) a.dim = true;
}

/**
 * Drop the pictures the screen under a window left spots for where the window stands: the apps lay
 * them over the canvas, so one under the window would cover it. The rest stay, darkened (`dimScreen`).
 */
export function hideArtUnder(s: Surface, r: { x: number; y: number; w: number; h: number }): void {
  s.art = s.art.filter((a) => !(a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y));
}

/**
 * A raised button of the game's stone (asked for 2026-10-24: every button "stone like"), speckled like
 * the panels, lit along the top and left, shaded along the bottom and right, its label centred in ink;
 * the lit one (`primary`) is ringed in gold; a disabled one keeps its place with a faded label.
 */
export function drawButton(s: Surface, x: number, y: number, w: number, h: number, label: string, enabled = true, primary = false): void {
  if (primary && enabled) speckle(s, x + 1, y + 1, w - 2, h - 2, shade("panel", 5), shade("panel", 6), shade("panel", 7));
  else stipple(s, x + 1, y + 1, w - 2, h - 2, "panel");
  s.hline(x, y, w, shade("panel", 7));
  s.vline(x, y, h, shade("panel", 7));
  s.hline(x + 1, y + h - 1, w - 1, shade("panel", 1));
  s.vline(x + w - 1, y + 1, h - 1, shade("panel", 1));
  if (primary && enabled) s.frame(x - 1, y - 1, w + 2, h + 2, shade("wheat", 6));
  const ink = !enabled ? FADED : INK;
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

import { keepInView, menuButtons, MODAL_MAX_SHARE, type MenuState, type TextInputState } from "@civ/renderer-api";

export const MENU_ROW = FONT_HEIGHT + 1;
/** A titled window is at least this wide; its text wraps rather than widen it past MODAL_MAX_SHARE of the screen. */
const MODAL_MIN_W = 112;

/** A list too long for the screen scrolls: its bar runs down the right of the rows, this wide. */
export const SCROLL_W = 5;

/**
 * How large a menu's parts are. The original's sizes (`DESK_MENU`) are the default everywhere; the
 * phone app passes `TOUCH_MENU` (asked for 2026-10-25: "some menus are too small and hard to click"),
 * whose rows and buttons a finger can hit on a screen 200 pixels tall shown about twice as large.
 */
export interface MenuSize {
  /** A list row's height, and the least a long list closes its rows up to before it scrolls instead. */
  row: number;
  least: number;
  /** A modal's choices as buttons (see `menuButtons`): this tall, this far apart, at least this wide. */
  button: number;
  buttonGap: number;
  buttonW: number;
  /** The scroll bar's width. */
  scroll: number;
}
export const DESK_MENU: MenuSize = { row: MENU_ROW, least: FONT_HEIGHT, button: FONT_HEIGHT + 4, buttonGap: 3, buttonW: 56, scroll: SCROLL_W };
export const TOUCH_MENU: MenuSize = { row: 15, least: 13, button: 19, buttonGap: 4, buttonW: 72, scroll: 10 };

interface MenuLayout {
  size: MenuSize;
  x: number; y: number; w: number; h: number; lines: string[]; itemsY: number; row: number; buttons: boolean; bx: number; bw: number;
  /** How far in each body line starts: past the square's picture (`MenuState.square`) for the lines beside it. */
  indents: number[];
  /** Rows on view, and the first of them; `rows` is short of the items when the list scrolls. */
  rows: number; top: number;
}

/** A window's map square (`MenuState.square`): its picture's side in screen pixels (twice a map square), framed, and the gap after it. */
export const SQUARE_PIC = 32;
const SQUARE_FRAME = SQUARE_PIC + 4;
const SQUARE_SIDE = SQUARE_FRAME + 6;
/** A window with a map square is at least this wide, so the lines beside the picture have room. */
const SQUARE_WINDOW_W = 236;

/** A row with a unit's sprite before it (`MenuState.units`): the sprite's side, and the row tall enough to hold it with a pixel either side. */
const UNIT_PIC = 16;
const UNIT_ROW = UNIT_PIC + 2;

/** How far round the point a window keeps clear of (`MenuState.avoid`): a square of the map either way. */
const AVOID = 16;

/**
 * A window at (x, y), moved off the point it must keep clear of: below the point if it fits there,
 * else above, else to its right or left; where it already stands clear it stays.
 */
function clearOf(p: { x: number; y: number }, x: number, y: number, w: number, h: number, screenW: number): [number, number] {
  const covers = (wx: number, wy: number) => wx < p.x + AVOID && wx + w > p.x - AVOID && wy < p.y + AVOID && wy + h > p.y - AVOID;
  if (!covers(x, y)) return [x, y];
  if (p.y + AVOID + h <= SCREEN_H) return [x, p.y + AVOID];
  if (p.y - AVOID - h >= 0) return [x, p.y - AVOID - h];
  const ty = Math.max(0, Math.min(SCREEN_H - h, Math.floor((SCREEN_H - h) / 2)));
  if (p.x + AVOID + w <= screenW) return [p.x + AVOID, ty];
  return [Math.max(0, p.x - AVOID - w), ty];
}

/** Where a menu goes on a screen `screenW` wide: centred, or at its anchor kept on the screen; its parts `size` large. */
function menuLayout(m: MenuState, screenW = SCREEN_W, size = DESK_MENU): MenuLayout {
  const buttons = menuButtons(m);
  // Rows with a unit's sprite before them keep the sprite's height (or the row's, if taller) and never close up.
  const pic = m.units ? UNIT_PIC + 4 : 0;
  const unitRow = Math.max(UNIT_ROW, size.row);
  const least = m.units ? unitRow : size.least;
  const itemW = Math.max(0, ...m.items.map((i, k) => pic + textWidth(i) + (m.right?.[k] ? textWidth(m.right[k]!) + 12 : 0)));
  const bw = buttons ? Math.max(size.buttonW, itemW + 16) : 0;
  const head = m.title ? 16 : 3;
  const foot = m.title ? 6 : 3;
  // A list that will not fit even with its rows closed up scrolls at the usual row height, beside its bar.
  const roomGuess = 200 - (m.anchor?.y ?? 0) - head - foot - (m.body?.length ? m.body.length * FONT_HEIGHT + 5 : 0);
  const scrolls = !buttons && m.items.length * least > roomGuess;
  const need = Math.max(textWidth(m.title) + 16 + (m.close ? TITLE_H : 0), buttons ? bw + 24 : itemW + 24 + (scrolls ? size.scroll + 4 : 0));
  const bodyW = m.body?.length ? Math.max(...m.body.map((l) => iconLineWidth(l))) + 20 : 0;
  const w = Math.min(300, Math.max(need, Math.min(bodyW + (m.square ? SQUARE_SIDE : 0), Math.round(SCREEN_W * MODAL_MAX_SHARE)), m.title ? MODAL_MIN_W : 0, m.square ? SQUARE_WINDOW_W : 0));
  // The paragraphs that begin beside a map square's picture wrap to the room left of it.
  const lines: string[] = [];
  const indents: number[] = [];
  for (const l of m.body ?? []) {
    const indent = m.square && lines.length * FONT_HEIGHT < SQUARE_FRAME ? SQUARE_SIDE : 0;
    for (const piece of wrapIcons(l, w - 20 - indent)) { lines.push(piece); indents.push(indent); }
  }
  const bodyH = lines.length || m.square ? Math.max(lines.length * FONT_HEIGHT, m.square ? SQUARE_FRAME + 2 : 0) + 5 : 0;
  // Long lists (every tribe) close up their rows to stay on screen; longer ones still scroll.
  const room = 200 - (m.anchor?.y ?? 0) - head - bodyH - foot;
  const fits = m.items.length * least <= room;
  const row = m.units ? unitRow : fits ? Math.max(size.least, Math.min(size.row, Math.floor(room / Math.max(1, m.items.length)))) : size.row;
  const rows = buttons || fits ? m.items.length : Math.max(1, Math.floor(room / row));
  const itemsH = buttons ? m.items.length * (size.button + size.buttonGap) + 1 : rows * row;
  const h = head + bodyH + itemsH + foot;
  let x = m.anchor ? Math.max(0, Math.min(screenW - w, m.anchor.x)) : Math.floor((screenW - w) / 2);
  let y = m.anchor ? m.anchor.y : Math.max(0, Math.floor((200 - h) / 2));
  if (m.avoid && !m.anchor) [x, y] = clearOf(m.avoid, x, y, w, h, screenW);
  const top = rows < m.items.length ? keepInView(m, rows) : 0;
  return { size, x, y, w, h, lines, indents, itemsY: y + head + bodyH, row, buttons, bx: x + Math.floor((w - bw) / 2), bw, rows, top };
}

export function menuRect(m: MenuState, screenW = SCREEN_W, size = DESK_MENU): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = menuLayout(m, screenW, size);
  return { x, y, w, h };
}

/** How many of a menu's rows show at once. */
export function menuRows(m: MenuState, screenW = SCREEN_W, size = DESK_MENU): number {
  return menuLayout(m, screenW, size).rows;
}

/** A scroll bar `w` wide (SCROLL_W unless given): its track from (x, y) down `h`, the arrows at its ends, and the thumb between them. */
export interface ScrollTrack { x: number; y: number; w: number; h: number; thumbY: number; thumbH: number }

/** The bar beside `rows` lines of a list of `total`, the first on view `top`: the thumb as long as the share on view, as far down as the list has scrolled. */
export function scrollTrack(x: number, y: number, h: number, total: number, rows: number, top: number, w = SCROLL_W): ScrollTrack {
  const track = h - 2 * (w + 1);
  const thumbH = Math.max(3, Math.round((track * rows) / total));
  const thumbY = y + w + 1 + Math.round(((track - thumbH) * top) / Math.max(1, total - rows));
  return { x, y, w, h, thumbY, thumbH };
}

/** A scrolling menu's bar: its track beside the rows, and the thumb that shows which of them are on view. */
function scrollBar(m: MenuState, l: MenuLayout): ScrollTrack {
  const w = l.size.scroll;
  return scrollTrack(l.x + l.w - 4 - w, l.itemsY - 1, l.rows * l.row, m.items.length, l.rows, l.top, w);
}

/** Where a point lies on a scrolling menu's bar: -1 above its thumb (the up arrow too), 1 below, 0 on it; null off the bar. */
export function menuScrollAt(m: MenuState, px: number, py: number, screenW = SCREEN_W, size = DESK_MENU): number | null {
  const l = menuLayout(m, screenW, size);
  if (l.rows >= m.items.length) return null;
  const b = scrollBar(m, l);
  if (px < b.x - 1 || px > b.x + b.w || py < b.y || py >= b.y + b.h) return null;
  return py < b.thumbY ? -1 : py >= b.thumbY + b.thumbH ? 1 : 0;
}

/**
 * A window or dropdown. `square` paints the window's map square (`MenuState.square`) with its top left
 * at a screen point, `SQUARE_PIC` pixels a side; without it the square's place stays bare.
 */
/**
 * A window on its way open (`enter` 0..1): drawn whole on a scratch screen, then laid on the screen
 * grown about its centre to `enter` of its size (from two fifths), each fine pixel from the nearest
 * of the whole. At 1 it is drawn in place.
 */
export function drawEntering(s: Surface, enter: number, rect: { x: number; y: number; w: number; h: number }, draw: (s: Surface) => void): void {
  if (enter >= 1) { draw(s); return; }
  const scratch = new Surface(s.width, s.height, undefined, s.k);
  scratch.fill(SPRITE_CLEAR);
  draw(scratch);
  const k = s.k;
  // The window and the shadow it casts two pixels down and right.
  const x0 = rect.x * k;
  const y0 = rect.y * k;
  const w = (rect.w + 2) * k;
  const h = (rect.h + 2) * k;
  const f = 0.4 + 0.6 * Math.max(0, enter);
  const tw = Math.max(1, Math.round(w * f));
  const th = Math.max(1, Math.round(h * f));
  const tx = Math.round(x0 + (w - tw) / 2);
  const ty = Math.round(y0 + (h - th) / 2);
  for (let y = 0; y < th; y++) {
    const sy = y0 + Math.min(h - 1, Math.floor((y * h) / th));
    for (let x = 0; x < tw; x++) {
      const c = scratch.fget(x0 + Math.min(w - 1, Math.floor((x * w) / tw)), sy);
      if (c !== SPRITE_CLEAR) s.fset(tx + x, ty + y, c);
    }
  }
}

export function drawMenu(s: Surface, m: MenuState, square?: (s: Surface, x: number, y: number) => void, size = DESK_MENU): void {
  // A titled window (not a dropdown, not the title screen's plain list) darkens what it opens over.
  if (m.title && !m.anchor) dimScreen(s);
  // A window (not a dropdown) still opening grows into place.
  if (m.enter !== undefined && m.enter < 1 && !m.anchor) {
    drawEntering(s, m.enter, menuRect(m, s.width, size), (t) => drawMenuNow(t, m, square, size));
    return;
  }
  drawMenuNow(s, m, square, size);
}

function drawMenuNow(s: Surface, m: MenuState, square: ((s: Surface, x: number, y: number) => void) | undefined, size: MenuSize): void {
  const l = menuLayout(m, s.width, size);
  const { x, y, w, h, lines, indents, itemsY, row, buttons, bx, bw, rows, top } = l;
  const scrolls = rows < m.items.length;
  if (m.title) hideArtUnder(s, { x, y, w, h });
  drawWindow(s, x, y, w, h, m.title);
  if (m.close && m.title) drawCloseBox(s, x + w - 3 - (TITLE_H - 2), y + 3);
  const bodyY = y + (m.title ? 17 : 4);
  if (m.square) {
    // The square in a dark frame, sunk into the stone: shade along the top and left, light along the foot and right.
    const fx = x + 10;
    const fy = bodyY + 1;
    s.frame(fx, fy, SQUARE_FRAME, SQUARE_FRAME, shade("panel", 2));
    s.hline(fx, fy + SQUARE_FRAME, SQUARE_FRAME + 1, shade("panel", 7));
    s.rect(fx + SQUARE_FRAME, fy, 1, SQUARE_FRAME + 1, shade("panel", 7));
    s.frame(fx + 1, fy + 1, SQUARE_FRAME - 2, SQUARE_FRAME - 2, C.BLACK!);
    if (square) square(s, fx + 2, fy + 2);
    else s.rect(fx + 2, fy + 2, SQUARE_PIC, SQUARE_PIC, C.BLACK!);
  }
  lines.forEach((line, i) => drawIconLine(s, x + 10 + (indents[i] ?? 0), bodyY + i * FONT_HEIGHT, line, C.BLACK!));
  if (lines.length && m.items.length) {
    s.hline(x + 4, itemsY - 4, w - 8, shade("panel", 2));
    s.hline(x + 4, itemsY - 3, w - 8, shade("panel", 7));
  }
  const rowW = w - 8 - (scrolls ? size.scroll + 2 : 0);
  m.items.forEach((item, i) => {
    const off = m.disabled?.includes(i) === true;
    const sel = i === m.selected && !off;
    if (buttons) {
      drawButton(s, bx, itemsY + 1 + i * (size.button + size.buttonGap), bw, size.button, item, !off, sel);
      return;
    }
    if (i < top || i >= top + rows) return;
    const ry = itemsY + (i - top) * row;
    if (sel) s.rect(x + 4, ry - 1, rowW, row, shade("azure", 2));
    // A unit's sprite before the row, the words (and the sprite) in the middle of the row's height.
    const unit = m.units?.[i];
    const ty = unit ? ry + Math.floor((row - FONT_HEIGHT) / 2) - 1 : ry + Math.max(0, Math.floor((row - MENU_ROW) / 2));
    if (unit) s.blit(unitSprite(unit.type, slotColor(unit.color)), x + 8, ry + Math.floor((row - UNIT_ROW) / 2), SPRITE_CLEAR);
    drawText(s, x + 10 + (unit ? UNIT_PIC + 4 : 0), ty, item, off ? FADED : sel ? C.WHITE! : C.BLACK!);
    const r = m.right?.[i];
    if (r) drawText(s, x + 4 + rowW - 6 - textWidth(r), ty, r, off ? FADED : sel ? shade("azure", 7) : DIM);
  });
  if (scrolls) drawScrollBar(s, m, l);
}

/** The bar beside a scrolling menu. */
function drawScrollBar(s: Surface, m: MenuState, l: MenuLayout): void {
  drawScrollTrack(s, scrollBar(m, l), l.top > 0, l.top + l.rows < m.items.length);
}

/** The bar beside a scrolling list: arrows at its ends (dark while there is more that way), a thumb for the rows on view. */
export function drawScrollTrack(s: Surface, b: ScrollTrack, moreUp: boolean, moreDown: boolean): void {
  s.rect(b.x, b.y, b.w, b.h, shade("panel", 3));
  s.rect(b.x, b.thumbY, b.w, b.thumbH, shade("azure", 2));
  // A triangle as wide as the bar allows (three rows on the original's bar), its point toward the hidden rows.
  const steps = Math.ceil(b.w / 2);
  const mid = b.x + Math.floor((b.w - 1) / 2);
  for (const up of [true, false]) {
    const ink = (up ? moreUp : moreDown) ? INK : FADED;
    const ay = up ? b.y + 1 : b.y + b.h - 2;
    for (let k = 0; k < steps; k++) s.hline(mid - k, up ? ay + k : ay - k, 1 + 2 * k, ink);
  }
}

/** A window's close box: a small stone button in its title strip with an X on it. */
export function drawCloseBox(s: Surface, x: number, y: number): void {
  const n = TITLE_H - 2;
  drawButton(s, x, y, n, n, "");
  for (let i = 0; i < n - 4; i++) {
    s.set(x + 2 + i, y + 2 + i, C.BLACK!);
    s.set(x + n - 3 - i, y + 2 + i, C.BLACK!);
  }
}

/** Row index under a screen point, or -1. */
export function menuHit(m: MenuState, px: number, py: number, screenW = SCREEN_W, size = DESK_MENU): number {
  const { x, w, itemsY, row, buttons, bx, bw, rows, top } = menuLayout(m, screenW, size);
  if (buttons) {
    const off = py - itemsY - 1;
    const pitch = size.button + size.buttonGap;
    const i = Math.floor(off / pitch);
    if (px < bx || px >= bx + bw || off < 0 || off % pitch >= size.button) return -1;
    return i < m.items.length && !m.disabled?.includes(i) ? i : -1;
  }
  const right = x + w - 4 - (rows < m.items.length ? size.scroll + 2 : 0);
  if (px < x + 4 || px > right) return -1;
  const i = Math.floor((py - (itemsY - 1)) / row);
  const hit = i >= 0 && i < rows && top + i < m.items.length ? top + i : -1;
  return m.disabled?.includes(hit) ? -1 : hit;
}

/** A one-line text prompt: title, the text being typed, a blinking cursor. */
export function drawTextInput(s: Surface, input: TextInputState, cursorOn: boolean): void {
  const w = 200;
  const h = 40;
  const x = Math.floor((s.width - w) / 2);
  const y = Math.floor((200 - h) / 2);
  dimScreen(s);
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
