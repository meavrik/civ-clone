/**
 * Where the game screen goes on a phone or tablet: as large as it fits inside the safe area,
 * centred, keeping its 320x200 shape. There are no controls beside it. Sizes in CSS px.
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
