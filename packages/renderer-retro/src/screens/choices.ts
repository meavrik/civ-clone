import type { MenuState } from "@civ/renderer-api";
import { textWidth, textWidthLarge } from "../font.js";
import { SCREEN_H } from "../surface.js";
import type { Surface } from "../surface.js";
import { dimScreen, drawButton, drawCloseBox, drawEntering, drawWindow, hideArtUnder, TITLE_H, TITLE_H_LARGE } from "../widgets.js";

/**
 * A menu drawn as stone buttons, a grid of them, for a finger (the phone app; asked for 2026-10-25:
 * the starting game's questions "too small and hard to click", and a unit's orders as "larger button
 * options"). The web game never draws one: its menus are rows (`drawMenu`).
 */
export interface ChoiceStyle {
  /** Buttons across at first; more (up to three) when the rows would not fit the screen's height. */
  columns: number;
  /** A button's height, the gap between buttons, and the least width of one. */
  h: number;
  gap: number;
  minW: number;
  /** The labels: the font's size, or twice it. */
  scale: 1 | 2;
  /** A window with no title (the title screen's) keeps below this line, clear of the game's name. */
  top?: number;
  /** The style to lay the menu out in when it will not fit the screen in this one. */
  fallback?: ChoiceStyle;
}

/** The starting game's questions (the title screen's menu, the number of civilizations, the world...): a column of large buttons. */
export const SETUP_CHOICES: ChoiceStyle = { columns: 1, h: 24, gap: 4, minW: 150, scale: 2, top: 44 };
/** A unit's orders as the font's own size, two buttons across, tall enough for a finger. */
export const ORDER_CHOICES_SMALL: ChoiceStyle = { columns: 2, h: 20, gap: 3, minW: 72, scale: 1 };
/** A unit's orders: words twice the font's size, two buttons across (or three), else as ORDER_CHOICES_SMALL. */
export const ORDER_CHOICES: ChoiceStyle = { columns: 2, h: 22, gap: 3, minW: 80, scale: 2, fallback: ORDER_CHOICES_SMALL };

interface Rect { x: number; y: number; w: number; h: number }
interface ChoicesLayout extends Rect { buttons: Rect[]; style: ChoiceStyle }

const PAD = 8;

/**
 * Where a menu's window and buttons go on a screen `screenW` wide, centred or at its anchor; null when
 * it is not a plain list of choices (text, a map square, units' sprites) or cannot fit the screen.
 */
function choicesLayout(m: MenuState, screenW: number, style: ChoiceStyle): ChoicesLayout | null {
  if (!m.items.length || m.body?.length || m.square || m.unit || m.units) return null;
  return layoutIn(m, screenW, style) ?? (style.fallback ? choicesLayout(m, screenW, style.fallback) : null);
}

function layoutIn(m: MenuState, screenW: number, style: ChoiceStyle): ChoicesLayout | null {
  const n = m.items.length;
  const label = (t: string) => (style.scale === 2 ? textWidthLarge(t) : textWidth(t));
  const bw = Math.max(style.minW, ...m.items.map((t) => label(t) + 16));
  const titleH = style.scale === 2 ? TITLE_H_LARGE : TITLE_H;
  const head = m.title ? titleH + 6 : PAD;
  const foot = PAD;
  for (let cols = Math.min(style.columns, n); cols <= Math.min(3, n); cols++) {
    const rows = Math.ceil(n / cols);
    const block = { w: cols * bw + (cols - 1) * style.gap, h: rows * style.h + (rows - 1) * style.gap };
    const w = Math.max(block.w + 2 * PAD, m.title ? label(m.title) + 16 + (m.close ? titleH : 0) : 0);
    const h = head + block.h + foot;
    if (w > screenW || h > SCREEN_H) continue;
    let x: number;
    let y: number;
    if (m.anchor) {
      x = Math.max(0, Math.min(screenW - w, m.anchor.x));
      y = Math.max(0, Math.min(SCREEN_H - h, m.anchor.y));
    } else {
      x = Math.floor((screenW - w) / 2);
      y = Math.floor((SCREEN_H - h) / 2);
      if (!m.title && style.top !== undefined && style.top + h <= SCREEN_H) y = Math.max(style.top, y);
    }
    const bx = x + Math.floor((w - block.w) / 2);
    const by = y + head;
    const buttons = m.items.map((_, i) => ({ x: bx + (i % cols) * (bw + style.gap), y: by + Math.floor(i / cols) * (style.h + style.gap), w: bw, h: style.h }));
    return { x, y, w, h, buttons, style };
  }
  return null;
}

/** Whether a menu can be drawn as buttons in `style` on a screen `screenW` wide (else it is drawn as rows). */
export function choicesFit(m: MenuState, screenW: number, style: ChoiceStyle): boolean {
  return choicesLayout(m, screenW, style) !== null;
}

/** The window a menu drawn as buttons takes, or null when it is drawn as rows. */
export function choicesRect(m: MenuState, screenW: number, style: ChoiceStyle): Rect | null {
  const l = choicesLayout(m, screenW, style);
  return l && { x: l.x, y: l.y, w: l.w, h: l.h };
}

/** The choice under a point, or -1 (between the buttons, off them, or on one that cannot be picked). */
export function choiceAt(m: MenuState, px: number, py: number, screenW: number, style: ChoiceStyle): number {
  const l = choicesLayout(m, screenW, style);
  if (!l) return -1;
  const i = l.buttons.findIndex((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h);
  return i >= 0 && !m.disabled?.includes(i) ? i : -1;
}

/**
 * A menu as buttons: a titled window darkens the screen it opens over and grows into place, as
 * `drawMenu`'s windows do; the selected choice is lit (ringed in gold), those that cannot be picked faded.
 */
export function drawChoices(s: Surface, m: MenuState, style: ChoiceStyle): void {
  const l = choicesLayout(m, s.width, style);
  if (!l) return;
  if (m.title && !m.anchor) dimScreen(s);
  // A window or a grid of buttons covers the pictures under it (the map's units).
  hideArtUnder(s, l);
  const scale = l.style.scale;
  const titleH = scale === 2 ? TITLE_H_LARGE : TITLE_H;
  const draw = (t: Surface) => {
    drawWindow(t, l.x, l.y, l.w, l.h, m.title, { scale });
    if (m.close && m.title) drawCloseBox(t, l.x + l.w - 3 - (titleH - 2), l.y + 3, titleH - 2);
    m.items.forEach((item, i) => {
      const b = l.buttons[i]!;
      const off = m.disabled?.includes(i) === true;
      drawButton(t, b.x, b.y, b.w, b.h, item, !off, i === m.selected && !off, scale, m.danger?.includes(i) === true);
    });
  };
  if (m.enter !== undefined && m.enter < 1 && !m.anchor) drawEntering(s, m.enter, l, draw);
  else draw(s);
}
