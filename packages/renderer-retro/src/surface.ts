/**
 * A palette-indexed framebuffer in the manner of MCGA mode 13h: one byte per
 * pixel, laid out on a 320x200 screen. Everything in the retro renderer draws
 * into one of these; the web app converts it to RGBA once per frame. Keeping
 * the whole pipeline indexed means the palette is enforced by construction,
 * and it makes the renderer testable in Node with no canvas.
 *
 * Detail: a surface may hold `k` x `k` fine pixels to each of its pixels. The
 * screen holds DETAIL of them, so the screens are still laid out (and
 * hit-tested) on the 320x200 grid, while the terrain, drawn on tiles as fine
 * as the screen, shows twice the detail. Drawing in screen pixels (`set`,
 * `rect`, `blit` of a coarse sprite...) fills whole blocks of fine pixels; the
 * `f`-prefixed calls address fine pixels one by one.
 */
export const SCREEN_W = 320;
export const SCREEN_H = 200;
/** Fine pixels across one of the screen's pixels. */
export const DETAIL = 2;

export class Surface {
  readonly data: Uint8Array;
  /** Size in fine pixels: `width * k` by `height * k`. */
  readonly fw: number;
  readonly fh: number;

  constructor(
    readonly width: number,
    readonly height: number,
    data?: Uint8Array,
    /** Fine pixels across each pixel. */
    readonly k = 1,
  ) {
    this.fw = width * k;
    this.fh = height * k;
    this.data = data ?? new Uint8Array(this.fw * this.fh);
  }

  static screen(): Surface {
    return new Surface(SCREEN_W, SCREEN_H, undefined, DETAIL);
  }

  /** A surface `width` x `height` pixels, as fine as the screen. */
  static fine(width: number, height: number): Surface {
    return new Surface(width, height, undefined, DETAIL);
  }

  fill(color: number): void {
    this.data.fill(color);
  }

  set(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const k = this.k;
    if (k === 1) { this.data[y * this.width + x] = color; return; }
    const fw = this.fw;
    let o = y * k * fw + x * k;
    for (let j = 0; j < k; j++, o += fw) for (let i = 0; i < k; i++) this.data[o + i] = color;
  }

  /** The colour at a pixel (its top-left fine pixel). */
  get(x: number, y: number): number {
    return this.data[y * this.k * this.fw + x * this.k] ?? 0;
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    const k = this.k;
    this.frect(x * k, y * k, w * k, h * k, color);
  }

  hline(x: number, y: number, w: number, color: number): void {
    this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: number): void {
    this.rect(x, y, 1, h, color);
  }

  /** Outline rectangle, 1px. */
  frame(x: number, y: number, w: number, h: number, color: number): void {
    this.hline(x, y, w, color);
    this.hline(x, y + h - 1, w, color);
    this.vline(x, y, h, color);
    this.vline(x + w - 1, y, h, color);
  }

  /** One fine pixel. */
  fset(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= this.fw || y >= this.fh) return;
    this.data[y * this.fw + x] = color;
  }

  /** The colour at a fine pixel. */
  fget(x: number, y: number): number {
    return this.data[y * this.fw + x] ?? 0;
  }

  /** A rectangle of fine pixels. */
  frect(x: number, y: number, w: number, h: number, color: number): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.fw, x + w);
    const y1 = Math.min(this.fh, y + h);
    if (x1 <= x0) return;
    for (let yy = y0; yy < y1; yy++) this.data.fill(color, yy * this.fw + x0, yy * this.fw + x1);
  }

  /**
   * Blit another surface with its top left at pixel (dx, dy). `transparent` is
   * the palette index treated as "skip" (sprites use SPRITE_CLEAR). A coarser
   * source is drawn in blocks, a finer one sampled.
   */
  blit(src: Surface, dx: number, dy: number, transparent = -1): void {
    if (src.k === this.k) { this.fblit(src, dx * this.k, dy * this.k, transparent); return; }
    const k = this.k;
    const sk = src.k;
    // Each fine pixel of this surface reads the source fine pixel under its centre.
    const x0 = dx * k;
    const y0 = dy * k;
    const w = src.width * k;
    const h = src.height * k;
    const cols = new Int32Array(w);
    for (let x = 0; x < w; x++) cols[x] = Math.floor(((x + 0.5) * sk) / k);
    for (let y = 0; y < h; y++) {
      const ty = y0 + y;
      if (ty < 0 || ty >= this.fh) continue;
      const srow = Math.floor(((y + 0.5) * sk) / k) * src.fw;
      const trow = ty * this.fw;
      for (let x = 0; x < w; x++) {
        const tx = x0 + x;
        if (tx < 0 || tx >= this.fw) continue;
        const c = src.data[srow + cols[x]!]!;
        if (c === transparent) continue;
        this.data[trow + tx] = c;
      }
    }
  }

  /** Blit a source as fine as this surface, its top left at fine pixel (fx, fy). */
  fblit(src: Surface, fx: number, fy: number, transparent = -1): void {
    for (let sy = 0; sy < src.fh; sy++) {
      const ty = fy + sy;
      if (ty < 0 || ty >= this.fh) continue;
      const srow = sy * src.fw;
      const trow = ty * this.fw;
      for (let sx = 0; sx < src.fw; sx++) {
        const tx = fx + sx;
        if (tx < 0 || tx >= this.fw) continue;
        const c = src.data[srow + sx]!;
        if (c === transparent) continue;
        this.data[trow + tx] = c;
      }
    }
  }
}
