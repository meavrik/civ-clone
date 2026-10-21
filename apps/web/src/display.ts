/**
 * The one canvas on the page, fitted to the window for whichever renderer is
 * active: a crisp integer-scaled framebuffer for the retro renderer, a
 * device-pixel-ratio-aware surface for the modern one. Renderers draw in
 * their own logical size; mouse positions are mapped back into it.
 */
export const canvas = document.getElementById("screen") as HTMLCanvasElement;

let logicalW = 320;
let logicalH = 200;
let crisp = true;
let scale = 1;
/** Canvas pixels to a logical pixel when crisp: the retro renderer's terrain is finer than its layout. */
let density = 1;

export function configureDisplay(width: number, height: number, pixelated: boolean, canvasDensity = 1): void {
  logicalW = width;
  logicalH = height;
  crisp = pixelated;
  density = canvasDensity;
  fitCanvas();
}

export function fitCanvas(): void {
  const raw = Math.min(innerWidth / logicalW, innerHeight / logicalH);
  // Crisp: every canvas pixel a whole number of CSS pixels, so steps of 1/density of a logical pixel.
  scale = crisp ? Math.max(1, Math.floor(raw * density) / density) : Math.max(0.2, raw);
  canvas.style.width = `${Math.round(logicalW * scale)}px`;
  canvas.style.height = `${Math.round(logicalH * scale)}px`;
  canvas.style.imageRendering = crisp ? "pixelated" : "auto";
  if (crisp) {
    const w = logicalW * density;
    const h = logicalH * density;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  } else {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(logicalW * scale * dpr));
    canvas.height = Math.max(1, Math.round(logicalH * scale * dpr));
  }
}

/** Backing-store pixels per logical unit, for a renderer that draws straight onto the canvas. */
export function backingScale(): number {
  return canvas.width / logicalW;
}

/** Canvas event position in the active renderer's logical units. */
export function toLogical(e: MouseEvent): [number, number] {
  return [Math.floor(e.offsetX / scale), Math.floor(e.offsetY / scale)];
}
