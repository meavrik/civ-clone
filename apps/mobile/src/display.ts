import type * as WebDisplay from "../../web/src/display.js";
import { layoutFor, type Insets, type Layout } from "./layout.js";

/**
 * Stands in for apps/web/src/display.ts (vite.config.ts swaps it in): the same exports, but the
 * screen fills the phone beside the touch controls at any scale, and points map back to the
 * game's logical pixels from where the canvas actually is, for the browser's mouse events and
 * the ones the touch layer makes alike.
 */
export const canvas = document.getElementById("screen") as HTMLCanvasElement;

let logicalW = 320;
let logicalH = 200;
/** Canvas pixels to a logical pixel: the retro renderer's terrain is finer than its layout. */
let density = 1;
let current: Layout | null = null;
const listeners: ((layout: Layout) => void)[] = [];

export function configureDisplay(width: number, height: number, _pixelated: boolean, canvasDensity = 1): void {
  logicalW = width;
  logicalH = height;
  density = canvasDensity;
  fitCanvas();
}

export function fitCanvas(): void {
  const layout = layoutFor(innerWidth, innerHeight, safeInsets(), logicalW, logicalH);
  current = layout;
  place(canvas, layout.canvas);
  if (canvas.width !== logicalW * density || canvas.height !== logicalH * density) {
    canvas.width = logicalW * density;
    canvas.height = logicalH * density;
  }
  for (const fn of listeners) fn(layout);
}

/** Run `fn` with the layout now and whenever it changes. */
export function onLayout(fn: (layout: Layout) => void): void {
  listeners.push(fn);
  if (current) fn(current);
}

export function backingScale(): number {
  return canvas.width / logicalW;
}

export function toLogical(e: MouseEvent): [number, number] {
  return logicalAt(e.clientX, e.clientY);
}

/** A point in the window as a logical pixel of the game screen. */
export function logicalAt(clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((clientX - r.left) * logicalW) / r.width);
  const y = Math.floor(((clientY - r.top) * logicalH) / r.height);
  return [Math.max(0, Math.min(logicalW - 1, x)), Math.max(0, Math.min(logicalH - 1, y))];
}

/** CSS px per logical pixel, as laid out. */
export function displayScale(): number {
  return current?.scale ?? 1;
}

export function place(el: HTMLElement, r: { x: number; y: number; w: number; h: number }): void {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
}

/** The notch, rounded corners and home bar, from the probe in index.html that pads itself by them. */
function safeInsets(): Insets {
  const probe = document.getElementById("safe");
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const s = getComputedStyle(probe);
  return { top: parseFloat(s.paddingTop) || 0, right: parseFloat(s.paddingRight) || 0, bottom: parseFloat(s.paddingBottom) || 0, left: parseFloat(s.paddingLeft) || 0 };
}

// iOS reports the new size a moment after it turns.
addEventListener("orientationchange", () => setTimeout(fitCanvas, 120));

({ canvas, configureDisplay, fitCanvas, backingScale, toLogical }) satisfies typeof WebDisplay;
