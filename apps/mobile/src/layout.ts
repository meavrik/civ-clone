/**
 * Where the screen and the touch controls go on a phone or tablet. The game keeps its 320x200
 * screen; it is scaled as large as it fits beside the controls, which take a column each side
 * (landscape: the pad left, the buttons right) or a band below (portrait), whichever leaves the
 * bigger screen. All sizes in CSS px, inside the safe area.
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
  mode: "sides" | "below";
  /** CSS px per logical pixel of the game screen. */
  scale: number;
  canvas: Rect;
  /** The direction pad's area. */
  pad: Rect;
  /** The buttons' area. */
  keys: Rect;
}

/** Side columns in landscape: three thumb-sized pad buttons across, one button across. */
export const PAD_W = 150;
export const KEYS_W = 104;
/** The band under the screen in portrait. */
export const BELOW = 180;

export function layoutFor(width: number, height: number, insets: Insets, logicalW: number, logicalH: number): Layout {
  const x0 = insets.left;
  const y0 = insets.top;
  const w = Math.max(0, width - insets.left - insets.right);
  const h = Math.max(0, height - insets.top - insets.bottom);
  const sides = Math.min((w - PAD_W - KEYS_W) / logicalW, h / logicalH);
  const below = Math.min(w / logicalW, (h - BELOW) / logicalH);
  const scale = Math.max(0.1, Math.max(sides, below));
  const cw = Math.round(logicalW * scale);
  const ch = Math.round(logicalH * scale);
  if (sides >= below) {
    // The screen between the columns, any width to spare shared between them.
    const spare = w - PAD_W - KEYS_W - cw;
    const cx = x0 + PAD_W + Math.round(spare / 2);
    const cy = y0 + Math.round((h - ch) / 2);
    return {
      mode: "sides",
      scale: cw / logicalW,
      canvas: { x: cx, y: cy, w: cw, h: ch },
      pad: { x: x0, y: y0, w: cx - x0, h },
      keys: { x: cx + cw, y: y0, w: x0 + w - cx - cw, h },
    };
  }
  const cx = x0 + Math.round((w - cw) / 2);
  const band = { y: y0 + ch, h: h - ch };
  const half = Math.round(w / 2);
  return {
    mode: "below",
    scale: cw / logicalW,
    canvas: { x: cx, y: y0, w: cw, h: ch },
    pad: { x: x0, y: band.y, w: half, h: band.h },
    keys: { x: x0 + half, y: band.y, w: w - half, h: band.h },
  };
}
