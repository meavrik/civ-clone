import { drawText, drawTextLarge, FONT_HEIGHT, textWidth, textWidthLarge } from "./font.js";
import { drawIcon, drawIconLine, iconLineWidth, wrapIcons } from "./icons.js";
import { drawShield, drawUnitFigure } from "./overlays.js";
import { C, DIMMED, shade, slotColor } from "./palette.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { darker } from "./sprites/index.js";
import { SCREEN_H, SCREEN_W, Surface } from "./surface.js";
import { CITY_UNITS_BOX } from "./screens/city-layout.js";
import { BAR_H } from "./screens/main-layout.js";
import { drawSquareRing, drawWindowPoint, pointedPlace, sideRoom, type PointedPlace } from "./pointing.js";
import { CARD_MAX_W, CARD_MIN_W, CARD_NARROW_W, cardLayout, cardNeed, drawSquareCard, type CardLayout } from "./square-card.js";

export { BAD, DIM, FADED, GOLD, GOOD, INK, NOTE, speckle, stipple } from "./stone.js";
import { BAD, DIM, FADED, INK, NOTE, speckle, stipple } from "./stone.js";

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
/** A title strip for words twice the font's size (`scale` 2: the phone's windows), this tall. */
export const TITLE_H_LARGE = 2 * FONT_HEIGHT + 3;

type StripOpts = { right?: string; centred?: boolean; color?: number; scale?: 1 | 2 };

export function drawTitleStrip(s: Surface, x: number, y: number, w: number, title: string, opts: StripOpts = {}): void {
  if (opts.scale === 2) {
    s.rect(x, y, w, TITLE_H_LARGE, opts.color ?? shade("azure", 1));
    drawTextLarge(s, opts.centred ? x + Math.floor((w - textWidthLarge(title)) / 2) : x + 5, y + 2, title, C.WHITE!);
    if (opts.right) drawTextLarge(s, x + w - 5 - textWidthLarge(opts.right), y + 2, opts.right, shade("azure", 7));
    return;
  }
  s.rect(x, y, w, TITLE_H, opts.color ?? shade("azure", 1));
  if (opts.centred) drawText(s, x + Math.floor((w - textWidth(title)) / 2), y + 2, title, C.WHITE!);
  else drawText(s, x + 4, y + 2, title, C.WHITE!);
  if (opts.right) drawText(s, x + w - 4 - textWidth(opts.right), y + 2, opts.right, shade("azure", 7));
}

/** A window: black rim, the stone, and a blue title strip when it has a title. */
export function drawWindow(s: Surface, x: number, y: number, w: number, h: number, title: string, opts: StripOpts = {}): void {
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
  // The civilization's shield as its units bear it, device and all, so the lists say whose shield is whose.
  drawShield(s, x, y, 1, 2, color, darker(color));
}

/**
 * Darken everything drawn so far, the backdrop behind a window (asked for 2026-10-24): each pixel to its
 * colour's darkened twin (`DIMMED`). Once a frame: stacked windows share one backdrop. `keep`, in screen
 * pixels, stays lit (the city a Building Completed window points at).
 */
export function dimScreen(s: Surface, keep?: { x: number; y: number; w: number; h: number }): void {
  if (s.dimmed) return;
  s.dimmed = true;
  const d = s.data;
  const k = s.k;
  const x0 = keep ? Math.max(0, keep.x * k) : 0;
  const x1 = keep ? Math.min(s.fw, (keep.x + keep.w) * k) : 0;
  const y0 = keep ? Math.max(0, keep.y * k) : 0;
  const y1 = keep ? Math.min(s.fh, (keep.y + keep.h) * k) : 0;
  for (let y = 0, i = 0; y < s.fh; y++) {
    const lit = y >= y0 && y < y1;
    for (let x = 0; x < s.fw; x++, i++) if (!lit || x < x0 || x >= x1) d[i] = DIMMED[d[i]!]!;
  }
  // The user's pictures on what was drawn darken with it (the apps lay them over the canvas), but those standing in what is kept lit.
  const lit = (a: { x: number; y: number; w: number; h: number }) => !!keep && a.x >= keep.x && a.y >= keep.y && a.x + a.w <= keep.x + keep.w && a.y + a.h <= keep.y + keep.h;
  for (const a of s.art) if (!lit(a)) a.dim = true;
}

/**
 * Drop the pictures the screen under a window left spots for where the window stands: the apps lay
 * them over the canvas, so one under the window would cover it. The rest stay, darkened (`dimScreen`).
 * A unit's, a city's or a village's picture is only cut round the window (a hole where it stands), so the map's
 * units, cities and villages at its edge keep what shows of them; a ship going down under its waterline goes.
 */
export function hideArtUnder(s: Surface, r: { x: number; y: number; w: number; h: number }): void {
  s.art = s.art.flatMap((a) => {
    if (!(a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y)) return [a];
    return (a.unit || a.city || a.hut) && a.water === undefined ? [{ ...a, holes: [...(a.holes ?? []), { x: r.x, y: r.y, w: r.w, h: r.h }] }] : [];
  });
}

/**
 * How a button looks (asked for 2026-11-01: "button hover/selected change style", and "add new button style (maybe
 * red) for aggressive actions"): `plain`, the game's stone, its label in ink; `lit` (under the pointer, or the choice
 * Enter takes) the same grain and bevel in the blue of the title strips and the menus' lit rows, its label white
 * (the stone warmed to parchment gold before, since 2026-10-25); `danger`, a choice that makes an enemy or undoes
 * something for good (war, a demand, Disband, Pillage, a diplomat's mission), red stone with a white label, and
 * `dangerLit` the same red ringed in white inside its bevel.
 */
export type ButtonLook = "plain" | "lit" | "danger" | "dangerLit";

/** A button's look: lit or not, aggressive or not. */
export function buttonLook(lit: boolean, danger = false): ButtonLook {
  return danger ? (lit ? "dangerLit" : "danger") : lit ? "lit" : "plain";
}

/** Each look's grain (dark speck, face, light speck), bevel (light top and left, dark bottom and right) and ink. */
const LOOKS: Record<ButtonLook, () => { grain: [number, number, number]; hi: number; lo: number; ink: number; ring?: number }> = {
  plain: () => ({ grain: [shade("panel", 4), shade("panel", 5), shade("panel", 6)], hi: shade("panel", 7), lo: shade("panel", 1), ink: INK }),
  // The coloured faces speckled darker only: their light specks were too loud on a strong colour.
  lit: () => ({ grain: [shade("azure", 2), shade("azure", 3), shade("azure", 3)], hi: shade("azure", 7), lo: shade("azure", 0), ink: C.WHITE! }),
  danger: () => ({ grain: [C.RED!, shade("town", 3), shade("town", 3)], hi: C.LRED!, lo: shade("brick", 0), ink: C.WHITE! }),
  dangerLit: () => ({ grain: [C.RED!, shade("town", 3), shade("town", 3)], hi: C.LRED!, lo: shade("brick", 0), ink: C.WHITE!, ring: shade("marble", 7) }),
};

/** A raised button's face in `look`: speckled, lit along the top and left, shaded along the bottom and right. Returns the ink its label takes. */
export function buttonFace(s: Surface, x: number, y: number, w: number, h: number, look: ButtonLook): number {
  const { grain: [dark, face, light], hi, lo, ink, ring } = LOOKS[look]();
  speckle(s, x + 1, y + 1, w - 2, h - 2, dark, face, light);
  s.hline(x, y, w, hi);
  s.vline(x, y, h, hi);
  s.hline(x + 1, y + h - 1, w - 1, lo);
  s.vline(x + w - 1, y + 1, h - 1, lo);
  // The lit red one ringed just inside its bevel, so it stands apart from the red beside it.
  if (ring !== undefined && w > 4 && h > 4) s.frame(x + 1, y + 1, w - 2, h - 2, ring);
  return ink;
}

/**
 * A raised button of the game's stone (asked for 2026-10-24: every button "stone like"), speckled like the panels,
 * its label centred; a disabled one keeps its place with a faded label on the plain stone. `primary` (under the
 * pointer, or the choice Enter takes) is lit, `danger` red (`ButtonLook`).
 */
export function drawButton(s: Surface, x: number, y: number, w: number, h: number, label: string, enabled = true, primary = false, scale: 1 | 2 = 1, danger = false): void {
  const ink = buttonFace(s, x, y, w, h, enabled ? buttonLook(primary, danger) : "plain");
  const color = enabled ? ink : FADED;
  // A label twice the font's size (the phone's setup questions) stands on a line twice as tall.
  if (scale === 2) drawTextLarge(s, x + Math.floor((w - textWidthLarge(label)) / 2), y + Math.floor((h - 2 * FONT_HEIGHT) / 2) + 1, label, color);
  else drawText(s, x + Math.floor((w - textWidth(label)) / 2), y + Math.floor((h - FONT_HEIGHT) / 2) + 1, label, color);
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

import { buildingArt, keepInView, menuButtons, MODAL_MAX_SHARE, unitArt, type MenuPicture, type MenuState, type TextInputState } from "@civ/renderer-api";

export const MENU_ROW = FONT_HEIGHT + 1;
/** A titled window is at least this wide; its text wraps rather than widen it past MODAL_MAX_SHARE of the screen. */
const MODAL_MIN_W = 112;

/** A list too long for the screen scrolls: its bar runs down the right of the rows, this wide. */
export const SCROLL_W = 5;

/**
 * How large a menu's parts are. The original's sizes (`DESK_MENU`) are the default everywhere; the
 * phone app passes `TOUCH_MENU` (asked for 2026-10-25: "some menus are too small and hard to click",
 * then "only on mobile - enlarge default font size"): rows and buttons a finger can hit, and words and
 * icons twice the font's size, on a screen 200 pixels tall shown about twice as large. A window that
 * would not fit the screen so is laid out at its `fallback` size (`TOUCH_MENU_SMALL`, the font's own).
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
  /** Words (and the icons among them) at the font's size or twice it. */
  text: 1 | 2;
  /** A titled window is at least `minW` wide, and widens for its text up to `share` of the screen, never past `maxW`. */
  minW: number;
  share: number;
  maxW: number;
  /** The size to lay a window out at when it will not fit the screen at this one. */
  fallback?: MenuSize;
}
export const DESK_MENU: MenuSize = { row: MENU_ROW, least: FONT_HEIGHT, button: FONT_HEIGHT + 4, buttonGap: 3, buttonW: 56, scroll: SCROLL_W, text: 1, minW: MODAL_MIN_W, share: MODAL_MAX_SHARE, maxW: 300 };
export const TOUCH_MENU_SMALL: MenuSize = { ...DESK_MENU, row: 15, least: 13, button: 19, buttonGap: 4, buttonW: 72, scroll: 10 };
export const TOUCH_MENU: MenuSize = { row: 19, least: 18, button: 22, buttonGap: 4, buttonW: 80, scroll: 10, text: 2, minW: 160, share: 0.92, maxW: 400, fallback: TOUCH_MENU_SMALL };

interface MenuLayout {
  size: MenuSize;
  x: number; y: number; w: number; h: number; lines: string[]; itemsY: number; row: number; buttons: boolean; bx: number; bw: number;
  /** How far in each body line starts: past the square's picture (`MenuState.square`) for the lines beside it. */
  indents: number[];
  /** Rows on view, and the first of them; `rows` is short of the items when the list scrolls. */
  rows: number; top: number;
  /** The part of the screen it stands clear of and leaves lit (`MenuState.keepClear`), when it does. */
  keep: { x: number; y: number; w: number; h: number } | null;
  /** The top of its tabs (`MenuState.tabs`; the rows' top when it has none) and their height. */
  tabsY: number; tabH: number;
  /** The rows of its longest list (every tab's), and how many of them it has room for. */
  count: number; room: number;
  /** A body line that must stay whole (`MenuState.oneLine`) broke all the same: the window is too narrow at this size. */
  wrapped: boolean;
  /** Where it stands by the square it points at (`MenuState.point`), when there is room for that. */
  place: PointedPlace | null;
  /** The square's window's card (`MenuState.card`) laid out at the window's width, and its top. */
  card: CardLayout | null;
  cardY: number;
}

/** The gap between a tabbed list's tabs, and under them before the rows. */
const TAB_GAP = 2;
const TAB_FOOT = 4;

/** A window's map square (`MenuState.square`): its picture's side in screen pixels (twice a map square), framed, and the gap after it. */
export const SQUARE_PIC = 32;
const SQUARE_FRAME = SQUARE_PIC + 4;
const SQUARE_SIDE = SQUARE_FRAME + 6;
/** A window with a map square is at least this wide, so the lines beside the picture have room. */
const SQUARE_WINDOW_W = 236;

/** A row with a picture before it (`MenuState.pictures`): the picture's side, and the row tall enough to hold it with a pixel either side. */
const UNIT_PIC = 16;
const UNIT_ROW = UNIT_PIC + 2;

/** The part of the screen a window keeps clear of and leaves lit (`MenuState.keepClear`), or null. */
function keptClear(m: MenuState): { x: number; y: number; w: number; h: number } | null {
  return m.keepClear === "cityUnits" ? CITY_UNITS_BOX : null;
}

/** A window keeping clear of part of the screen shows at least this many rows (or all it has), else stands in the middle as usual. */
const CLEAR_ROWS = 3;

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

/**
 * Where a menu goes on a screen `screenW` wide: centred, or at its anchor kept on the screen; its parts
 * `size` large, or its `fallback` size when it would run off the screen so.
 */
function menuLayout(m: MenuState, screenW = SCREEN_W, size = DESK_MENU, clear = true): MenuLayout {
  // The square's card keeps the font's size (the phone's large words would not fit it), and so does its window.
  if (m.card && size.text === 2 && size.fallback) return menuLayout(m, screenW, size.fallback, clear);
  const l = pointedLayout(m, screenW, size, clear);
  // Too few rows in the room above what it keeps clear of: smaller (the phone's), else in the middle after all.
  const cramped = !!l.keep && l.room < Math.min(l.count, CLEAR_ROWS);
  const bad = l.y + l.h > SCREEN_H || l.x + l.w > screenW || l.wrapped;
  if (size.fallback && (bad || cramped)) {
    const small = menuLayout(m, screenW, size.fallback, clear);
    return cramped && !bad && !small.keep ? menuLayout(m, screenW, size, false) : small;
  }
  return cramped ? menuLayout(m, screenW, size, false) : l;
}

/**
 * Laid out at its width; the square's window (its card) pointing at its square that finds no room above or below it
 * there stands beside it instead, as wide as the room there allows, its notes wrapping to it.
 */
function pointedLayout(m: MenuState, screenW: number, size: MenuSize, clear: boolean): MenuLayout {
  const l = layoutAt(m, screenW, size, clear);
  if (l.place || !m.point || m.anchor || !m.card) return l;
  const room = sideRoom(screenW, m.point);
  // Never narrower than its title needs, nor so narrow its notes break into crumbs.
  const title = (size.text === 2 ? textWidthLarge(m.title) : textWidth(m.title)) + 16 + (m.close ? (size.text === 2 ? TITLE_H_LARGE : TITLE_H) : 0);
  if (room < Math.max(CARD_NARROW_W, title) || room >= l.w) return l;
  const narrow = layoutAt(m, screenW, size, clear, room);
  return narrow.place && narrow.w <= room ? narrow : l;
}

function layoutAt(m: MenuState, screenW: number, size: MenuSize, clear: boolean, cap?: number): MenuLayout {
  const buttons = menuButtons(m);
  const t = size.text;
  const tw = (text: string) => (t === 2 ? textWidthLarge(text) : textWidth(text));
  const lineH = FONT_HEIGHT * t;
  // A tabbed list is sized for every tab's rows (`MenuState.tabs`), so it keeps its size as they change.
  const lists: Pick<MenuState, "items" | "right" | "pictures">[] = m.tabs ?? [m];
  const count = Math.max(0, ...lists.map((l) => l.items.length));
  // Rows with a picture before them keep the picture's height (or the row's, if taller) and never close up.
  const pictured = lists.some((l) => l.pictures);
  const pic = pictured ? UNIT_PIC + 4 : 0;
  const unitRow = Math.max(UNIT_ROW, size.row);
  const least = pictured ? unitRow : size.least;
  // Its tabs: a row of buttons as tall as a window's buttons across the top of the list, each as wide as the longest label needs.
  const tabH = m.tabs ? size.button : 0;
  const tabsH = m.tabs ? tabH + TAB_FOOT : 0;
  const tabsW = m.tabs ? m.tabs.length * (Math.max(...m.tabs.map((tab) => tw(tab.label))) + 16 + TAB_GAP) + 8 - TAB_GAP : 0;
  // The window's room ends at the screen's foot, or above what it keeps clear of, its shadow too.
  const keep = clear ? keptClear(m) : null;
  const floor = keep ? keep.y - 2 : SCREEN_H;
  const itemW = Math.max(0, ...lists.flatMap((l) => l.items.map((i, k) => pic + tw(i) + (l.right?.[k] ? tw(l.right[k]!) + 12 : 0))));
  const bw = buttons ? Math.max(size.buttonW, itemW + 16) : 0;
  const titleH = t === 2 ? TITLE_H_LARGE : TITLE_H;
  const head = m.title ? titleH + 5 : 3;
  const foot = m.title ? 6 : 3;
  // A list that will not fit even with its rows closed up scrolls at the usual row height, beside its bar.
  const roomGuess = floor - (m.anchor?.y ?? 0) - head - foot - tabsH - (m.body?.length ? m.body.length * lineH + 5 : 0);
  const scrolls = !buttons && count * least > roomGuess;
  const need = Math.max(tw(m.title) + 16 + (m.close ? titleH : 0), buttons ? bw + 24 : itemW + 24 + (scrolls ? size.scroll + 4 : 0), tabsW);
  // Measured as the lines wrap (the font's widths, `t` times), so a line that sets the window's width keeps to one line.
  const bodyW = m.body?.length ? Math.max(...m.body.map((l) => iconLineWidth(l) * t)) + 20 : 0;
  // A map square or a unit's picture heads the window, in the same frame.
  const framed = !m.card && !!(m.square || m.unit);
  // Lines that must stay whole (`oneLine`) widen the window as far as the screen lets them.
  const bodyRoom = m.oneLine ? bodyW + (framed ? SQUARE_SIDE : 0) : Math.min(bodyW + (framed ? SQUARE_SIDE : 0), Math.round(SCREEN_W * size.share));
  // The square's card is as wide as its facts need, within its bounds.
  const cardW = m.card ? Math.min(CARD_MAX_W, Math.max(CARD_MIN_W, cardNeed(m.card))) : 0;
  const w = Math.min(cap ?? (m.card ? CARD_MAX_W : size.maxW), screenW - 8, Math.max(need, m.card ? cardW : bodyRoom, m.title ? size.minW : 0, m.square && !m.card ? SQUARE_WINDOW_W : 0));
  // The paragraphs that begin beside the picture wrap to the room left of it.
  const lines: string[] = [];
  const indents: number[] = [];
  for (const l of m.card ? [] : m.body ?? []) {
    const indent = framed && lines.length * lineH < SQUARE_FRAME ? SQUARE_SIDE : 0;
    for (const piece of wrapIcons(l, Math.floor((w - 20 - indent) / t))) { lines.push(piece); indents.push(indent); }
  }
  // The card in place of the body, air under it, more where a rule and the choices follow.
  const card = m.card ? cardLayout(m.card, w) : null;
  const bodyH = card ? card.h + (m.items.length || m.tabs ? 9 : 3) : lines.length || framed ? Math.max(lines.length * lineH, framed ? SQUARE_FRAME + 2 : 0) + 5 : 0;
  const secH = 0;
  // Long lists (every tribe) close up their rows to stay on screen; longer ones still scroll.
  const room = floor - (m.anchor?.y ?? 0) - head - bodyH - secH - tabsH - foot;
  const fits = count * least <= room;
  const row = pictured ? unitRow : fits ? Math.max(size.least, Math.min(size.row, Math.floor(room / Math.max(1, count)))) : size.row;
  const rows = buttons || fits ? m.items.length : Math.max(1, Math.floor(room / row));
  const itemsH = buttons ? m.items.length * (size.button + size.buttonGap) + 1 : (fits ? count : rows) * row;
  const h = head + bodyH + secH + tabsH + itemsH + foot;
  let x = m.anchor ? Math.max(0, Math.min(screenW - w, m.anchor.x)) : Math.floor((screenW - w) / 2);
  let y = m.anchor ? m.anchor.y : keep ? Math.max(0, floor - h) : Math.max(0, Math.floor((SCREEN_H - h) / 2));
  // By the square it tells of, pointing at it (`MenuState.point`), clear of the menu bar; else clear of the click.
  const pointed = m.point && !m.anchor ? pointedPlace(screenW, m.point, { w, h }, BAR_H + 1) : null;
  const place = pointed?.side ? pointed : null;
  if (place) [x, y] = [place.win.x, place.win.y];
  else if (m.avoid && !m.anchor) [x, y] = clearOf(m.avoid, x, y, w, h, screenW);
  const top = rows < m.items.length ? keepInView(m, rows) : 0;
  return { size, x, y, w, h, lines, indents, itemsY: y + head + bodyH + secH + tabsH, row, buttons, bx: x + Math.floor((w - bw) / 2), bw, rows, top, keep, tabsY: y + head + bodyH + secH, tabH, count, room: fits ? count : rows, wrapped: !!m.oneLine && lines.length > (m.body?.length ?? 0), place, card, cardY: y + (m.title ? titleH + 6 : 4) };
}

export function menuRect(m: MenuState, screenW = SCREEN_W, size = DESK_MENU): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = menuLayout(m, screenW, size);
  return { x, y, w, h };
}

/** Where tab `i` of a tabbed menu stands: the tabs share the window's width, `TAB_GAP` apart. */
function tabRect(l: MenuLayout, n: number, i: number): { x: number; y: number; w: number; h: number } {
  const tw = Math.floor((l.w - 8 - TAB_GAP * (n - 1)) / n);
  return { x: l.x + 4 + i * (tw + TAB_GAP), y: l.tabsY, w: tw, h: l.tabH };
}

/** The tab of a tabbed menu (`MenuState.tabs`) under a screen point, or null. */
export function menuTabAt(m: MenuState, px: number, py: number, screenW = SCREEN_W, size = DESK_MENU): number | null {
  if (!m.tabs) return null;
  const l = menuLayout(m, screenW, size);
  const i = m.tabs.findIndex((_, k) => {
    const r = tabRect(l, m.tabs!.length, k);
    return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
  });
  return i >= 0 && !m.tabs[i]!.off ? i : null;
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
 * grown to `enter` of its size (from two fifths) about its centre, or about `from` (a screen point that
 * stays put: the city a window points at), each fine pixel from the nearest of the whole. At 1 it is
 * drawn in place.
 */
/**
 * Where a box of a window stands while the window is on its way open (`enter` 0..1, as `drawEntering` grows it about
 * its centre), in screen pixels: so a picture laid over the canvas grows with the window it sits in.
 */
export function enteringBox(enter: number, rect: { x: number; y: number; w: number; h: number }, box: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  if (enter >= 1) return box;
  const f = 0.4 + 0.6 * Math.max(0, enter);
  // As `drawEntering` has it: the window and its shadow (two pixels more each way) grown about their middle.
  const cx = rect.x + (rect.w + 2) / 2;
  const cy = rect.y + (rect.h + 2) / 2;
  return { x: cx + (box.x - cx) * f, y: cy + (box.y - cy) * f, w: box.w * f, h: box.h * f };
}

export function drawEntering(s: Surface, enter: number, rect: { x: number; y: number; w: number; h: number }, draw: (s: Surface) => void, from?: { x: number; y: number }): void {
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
  const tx = Math.round(from ? from.x * k - (from.x * k - x0) * f : x0 + (w - tw) / 2);
  const ty = Math.round(from ? from.y * k - (from.y * k - y0) * f : y0 + (h - th) / 2);
  for (let y = 0; y < th; y++) {
    const sy = y0 + Math.min(h - 1, Math.floor((y * h) / th));
    for (let x = 0; x < tw; x++) {
      const c = scratch.fget(x0 + Math.min(w - 1, Math.floor((x * w) / tw)), sy);
      if (c !== SPRITE_CLEAR) s.fset(tx + x, ty + y, c);
    }
  }
}

export function drawMenu(s: Surface, m: MenuState, square?: (s: Surface, x: number, y: number) => void, size = DESK_MENU): void {
  const { place } = menuLayout(m, s.width, size);
  // A titled window (not a dropdown, not the title screen's plain list) darkens what it opens over; the square it points at stays lit, ringed.
  if (m.title && !m.anchor) dimScreen(s, menuLayout(m, s.width, size).keep ?? (place && m.point) ?? undefined);
  if (place && m.point) drawSquareRing(s, m.point);
  // A window (not a dropdown) still opening grows into place, out of its point when it has one.
  if (m.enter !== undefined && m.enter < 1 && !m.anchor) {
    drawEntering(s, m.enter, place?.bounds ?? menuRect(m, s.width, size), (t) => drawMenuNow(t, m, square, size), place?.tip ?? undefined);
    return;
  }
  drawMenuNow(s, m, square, size);
}

function drawMenuNow(s: Surface, m: MenuState, square: ((s: Surface, x: number, y: number) => void) | undefined, wanted: MenuSize): void {
  const l = menuLayout(m, s.width, wanted);
  const { size, x, y, w, h, lines, indents, itemsY, row, buttons, bx, bw, rows, top } = l;
  // Words twice the font's size (the phone's), or the font's own.
  const t = size.text;
  const lineH = FONT_HEIGHT * t;
  const write = (tx: number, ty: number, text: string, ink: number) => (t === 2 ? drawTextLarge(s, tx, ty, text, ink) : drawText(s, tx, ty, text, ink));
  const titleH = t === 2 ? TITLE_H_LARGE : TITLE_H;
  const scrolls = rows < m.items.length;
  // A window or a dropdown covers the pictures under it (the map's units).
  hideArtUnder(s, l.place?.bounds ?? { x, y, w, h });
  drawWindow(s, x, y, w, h, m.title, t === 2 ? { scale: 2 } : {});
  if (l.place) drawWindowPoint(s, l.place);
  if (m.close && m.title) drawCloseBox(s, x + w - 3 - (titleH - 2), y + 3, titleH - 2);
  const bodyY = y + (m.title ? titleH + 6 : 4);
  if (l.card && m.card) drawSquareCard(s, m.card, x, l.cardY, w, square);
  else if (m.square || m.unit) {
    // The square in a dark frame, sunk into the stone: shade along the top and left, light along the foot and right.
    const fx = x + 10;
    const fy = bodyY + 1;
    s.frame(fx, fy, SQUARE_FRAME, SQUARE_FRAME, shade("panel", 2));
    s.hline(fx, fy + SQUARE_FRAME, SQUARE_FRAME + 1, shade("panel", 7));
    s.rect(fx + SQUARE_FRAME, fy, 1, SQUARE_FRAME + 1, shade("panel", 7));
    s.frame(fx + 1, fy + 1, SQUARE_FRAME - 2, SQUARE_FRAME - 2, C.BLACK!);
    if (m.unit) {
      // The unit on the Building Completed window's slate, twice its size on the map: the user's picture
      // laid over it, else its sprite in the middle.
      speckle(s, fx + 2, fy + 2, SQUARE_PIC, SQUARE_PIC, shade("steel", 3), shade("steel", 4), shade("steel", 4));
      const art = unitArt(m.unit.type);
      const at = art ? 0 : (SQUARE_PIC - UNIT_PIC) >> 1;
      drawUnitFigure(s, m.unit.type, fx + 2 + at, fy + 2 + at, slotColor(m.unit.color), art ? { w: SQUARE_PIC, h: SQUARE_PIC } : {});
    } else if (square) square(s, fx + 2, fy + 2);
    else s.rect(fx + 2, fy + 2, SQUARE_PIC, SQUARE_PIC, C.BLACK!);
  }
  lines.forEach((line, i) => drawIconLine(s, x + 10 + (indents[i] ?? 0), bodyY + i * lineH, line, C.BLACK!, t));
  if ((lines.length || l.card) && (m.items.length || m.tabs)) {
    s.hline(x + 4, l.tabsY - 4, w - 8, shade("panel", 2));
    s.hline(x + 4, l.tabsY - 3, w - 8, shade("panel", 7));
  }
  // The tabs, the one shown lit, one with nothing in it faded.
  m.tabs?.forEach((tab, i) => {
    const r = tabRect(l, m.tabs!.length, i);
    drawButton(s, r.x, r.y, r.w, r.h, tab.label, !tab.off, i === (m.tab ?? 0), t);
  });
  const rowW = w - 8 - (scrolls ? size.scroll + 2 : 0);
  m.items.forEach((item, i) => {
    const off = m.disabled?.includes(i) === true;
    const sel = i === m.selected && !off;
    const danger = m.danger?.includes(i) === true;
    if (buttons) {
      drawButton(s, bx, itemsY + 1 + i * (size.button + size.buttonGap), bw, size.button, item, !off, sel, t, danger);
      return;
    }
    if (i < top || i >= top + rows) return;
    const ry = itemsY + (i - top) * row;
    // A row that makes an enemy or undoes something for good is red, lit in the red of its buttons.
    if (sel) s.rect(x + 4, ry - 1, rowW, row, danger ? shade("town", 3) : shade("azure", 2));
    // A picture before the row, the words (and the picture) in the middle of the row's height.
    const picture = m.pictures?.[i];
    const ty = m.pictures ? ry + Math.floor((row - lineH) / 2) - 1 : ry + Math.max(0, Math.floor((row - lineH - 1) / 2));
    if (picture) drawRowPicture(s, picture, x + 8, ry + Math.floor((row - UNIT_ROW) / 2), off);
    write(x + 10 + (m.pictures ? UNIT_PIC + 4 : 0), ty, item, off ? FADED : sel ? C.WHITE! : danger ? BAD : C.BLACK!);
    const r = m.right?.[i];
    if (r) write(x + 4 + rowW - 6 - (t === 2 ? textWidthLarge(r) : textWidth(r)), ty, r, off ? FADED : sel ? (danger ? shade("town", 7) : shade("azure", 7)) : danger ? BAD : DIM);
  });
  if (scrolls) drawScrollBar(s, m, l);
}

/**
 * A row's picture, `UNIT_PIC` a side at (x, y): a unit's (the user's picture, else its sprite), or the user's picture
 * of a building in the middle of the square, shape kept (a house where there is none); darkened on a row that cannot
 * be picked.
 */
function drawRowPicture(s: Surface, p: MenuPicture, x: number, y: number, off: boolean): void {
  const dim = off ? { dim: true } : {};
  if ("unit" in p) drawUnitFigure(s, p.unit, x, y, slotColor(p.color), dim);
  else if (buildingArt(p.building)) s.art.push({ id: p.building, x, y, w: UNIT_PIC, h: UNIT_PIC, middle: true, ...dim });
  else drawIcon(s, "house", x, y);
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

/** A window's close box: a small stone button in its title strip with an X on it, `n` a side. */
export function drawCloseBox(s: Surface, x: number, y: number, n = TITLE_H - 2): void {
  drawButton(s, x, y, n, n, "");
  for (let i = 0; i < n - 4; i++) {
    s.set(x + 2 + i, y + 2 + i, C.BLACK!);
    s.set(x + n - 3 - i, y + 2 + i, C.BLACK!);
  }
}

/** Row index under a screen point, or -1. */
export function menuHit(m: MenuState, px: number, py: number, screenW = SCREEN_W, wanted = DESK_MENU): number {
  const { size, x, w, itemsY, row, buttons, bx, bw, rows, top } = menuLayout(m, screenW, wanted);
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

/** Where row `i` of a menu of rows lies, across the menu's whole width (a submenu opens beside it); null for buttons or a row off view. */
export function menuRowRect(m: MenuState, i: number, screenW = SCREEN_W, wanted = DESK_MENU): { x: number; y: number; w: number; h: number } | null {
  const { x, w, itemsY, row, buttons, rows, top } = menuLayout(m, screenW, wanted);
  if (buttons || i < top || i >= top + rows) return null;
  return { x, y: itemsY - 1 + (i - top) * row, w, h: row };
}

/** A one-line text prompt: title, the text being typed, a blinking cursor. */
export function drawTextInput(s: Surface, input: TextInputState, cursorOn: boolean): void {
  const w = 200;
  const h = 40;
  const x = Math.floor((s.width - w) / 2);
  const y = Math.floor((200 - h) / 2);
  dimScreen(s);
  hideArtUnder(s, { x, y, w, h });
  drawWindow(s, x, y, w, h, input.title);
  s.rect(x + 8, y + 17, w - 16, 12, C.BLACK!);
  s.frame(x + 8, y + 17, w - 16, 12, shade("panel", 2));
  drawText(s, x + 12, y + 19, input.text, C.WHITE!);
  if (cursorOn) s.rect(x + 12 + textWidth(input.text) + 1, y + 19, 4, FONT_HEIGHT, C.YELLOW!);
  drawText(s, x + w - 8 - textWidth("Enter / Esc"), y + 30, "Enter / Esc", DIM);
}

/** Small one-line message box at the bottom of the screen. */
export function drawStatusLine(s: Surface, text: string): void {
  hideArtUnder(s, { x: 80, y: 188, w: s.width - 80, h: 12 });
  s.frame(80, 188, s.width - 80, 12, C.BLACK!);
  drawStone(s, 81, 189, s.width - 82, 11);
  drawText(s, 84, 191, text, NOTE);
}
