/**
 * Where the game screen goes on a phone or tablet: as large as it fits inside the safe area,
 * centred, keeping its shape (as wide as the phone allows, `screenWidth`, by 200). There are no
 * controls beside it. Sizes in CSS px.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  /** CSS px per logical pixel of the game screen. */
  scale: number;
  canvas: Rect;
}

export function layoutFor(width: number, height: number, insets: Insets, logicalW: number, logicalH: number): Layout {
  const w = Math.max(0, width - insets.left - insets.right);
  const h = Math.max(0, height - insets.top - insets.bottom);
  const scale = Math.max(0.1, Math.min(w / logicalW, h / logicalH));
  const cw = Math.round(logicalW * scale);
  const ch = Math.round(logicalH * scale);
  return {
    scale: cw / logicalW,
    canvas: { x: insets.left + Math.round((w - cw) / 2), y: insets.top + Math.round((h - ch) / 2), w: cw, h: ch },
  };
}

/** The widest the game screen gets, in logical pixels (the original's is 320). */
export const MAX_SCREEN_W = 480;

/**
 * How wide the game screen is laid out, 200 high, to fill the safe area of a phone held sideways:
 * the map's viewport takes whatever the original's 320 leaves (`viewAcross` in renderer-retro).
 */
export function screenWidth(width: number, height: number, insets: Insets, logicalH = 200): number {
  const w = Math.max(1, width - insets.left - insets.right);
  const h = Math.max(1, height - insets.top - insets.bottom);
  return Math.max(320, Math.min(MAX_SCREEN_W, Math.floor((logicalH * w) / h)));
}
