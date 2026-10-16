import { PALETTE_RGBA, SCREEN_H, SCREEN_W, Surface } from "@civ/renderer-retro";

/** 320x200 indexed framebuffer -> integer-scaled canvas. */
export const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;
const image = ctx.createImageData(SCREEN_W, SCREEN_H);
export const screen = Surface.screen();

export function fitCanvas(): void {
  const scale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_W, innerHeight / SCREEN_H)));
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
}

export function present(): void {
  const px = image.data;
  const src = screen.data;
  for (let i = 0, j = 0; i < src.length; i++, j += 4) {
    const p = src[i]! * 4;
    px[j] = PALETTE_RGBA[p]!;
    px[j + 1] = PALETTE_RGBA[p + 1]!;
    px[j + 2] = PALETTE_RGBA[p + 2]!;
    px[j + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/** Canvas event position in framebuffer pixels. */
export function toScreen(e: MouseEvent): [number, number] {
  const scale = canvas.clientWidth / SCREEN_W;
  return [Math.floor(e.offsetX / scale), Math.floor(e.offsetY / scale)];
}
