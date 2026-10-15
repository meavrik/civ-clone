/**
 * A palette-indexed framebuffer, exactly like MCGA mode 13h: one byte per
 * pixel, 320x200. Everything in the retro renderer draws into one of these;
 * the web app converts it to RGBA once per frame. Keeping the whole pipeline
 * indexed means the palette is enforced by construction, and it makes the
 * renderer testable in Node with no canvas.
 */
export const SCREEN_W = 320;
export const SCREEN_H = 200;

export class Surface {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    data?: Uint8Array,
  ) {
    this.data = data ?? new Uint8Array(width * height);
  }

  static screen(): Surface {
    return new Surface(SCREEN_W, SCREEN_H);
  }

  fill(color: number): void {
    this.data.fill(color);
  }

  set(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = color;
  }

  get(x: number, y: number): number {
    return this.data[y * this.width + x] ?? 0;
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.width, x + w);
    const y1 = Math.min(this.height, y + h);
    for (let yy = y0; yy < y1; yy++) {
      this.data.fill(color, yy * this.width + x0, yy * this.width + x1);
    }
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

  /**
   * Blit another surface. `transparent` is the palette index treated as
   * "skip" (sprites use index 0 for see-through).
   */
  blit(src: Surface, dx: number, dy: number, transparent = -1): void {
    for (let sy = 0; sy < src.height; sy++) {
      const ty = dy + sy;
      if (ty < 0 || ty >= this.height) continue;
      const srow = sy * src.width;
      const trow = ty * this.width;
      for (let sx = 0; sx < src.width; sx++) {
        const tx = dx + sx;
        if (tx < 0 || tx >= this.width) continue;
        const c = src.data[srow + sx]!;
        if (c === transparent) continue;
        this.data[trow + tx] = c;
      }
    }
  }
}
