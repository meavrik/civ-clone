import { C, DIMMED } from "../palette.js";
import { SCREEN_H, type Surface } from "../surface.js";
import { drawCloseBox } from "../widgets.js";
import { CITY_BOXES, type CityBox } from "./city.js";

/**
 * A box of the city screen blown up over the rest of it, on the phone only (asked for 2026-10-27: "on
 * mobile only - inside the city view - when click on a box area - enlarge it to see it bigger"): the
 * 320x200 screen laid on the phone's wide one, darkened, and the box copied over its middle as large as
 * whole fine pixels let it stand (twice the size for every box of the screen), ringed in black with a
 * close box above its corner. Its controls answer there (`cityZoomPoint` maps a point back), and the
 * pictures of its buildings grow with it.
 */
export interface CityZoom {
  box: CityBox;
  /** Where the box stands enlarged, in the wide screen's pixels, and how many times its size. */
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

/** The box under a point of the 320x200 city screen, or null (its title strip and citizens, the gaps). */
export function cityBoxAt(px: number, py: number): CityBox | null {
  return CITY_BOXES.find((b) => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) ?? null;
}

/** Where `box` stands enlarged on a screen `screenW` wide: whole times its size, with room all round, in the middle. */
export function cityZoomPlace(box: CityBox, screenW: number): CityZoom {
  const scale = Math.max(1, Math.min(Math.floor((screenW - 8) / box.w), Math.floor((SCREEN_H - 24) / box.h)));
  const w = box.w * scale;
  const h = box.h * scale;
  return { box, x: Math.floor((screenW - w) / 2), y: Math.floor((SCREEN_H - h) / 2) + 4, w, h, scale };
}

/** A point of the wide screen as the point of the 320x200 city screen it shows, inside the enlarged box; null off it. */
export function cityZoomPoint(z: CityZoom, px: number, py: number): [number, number] | null {
  if (px < z.x || px >= z.x + z.w || py < z.y || py >= z.y + z.h) return null;
  return [z.box.x + Math.floor((px - z.x) / z.scale), z.box.y + Math.floor((py - z.y) / z.scale)];
}

/** The close box above the enlarged box's right corner (a tap anywhere off the box closes it too). */
export function cityZoomClose(z: CityZoom): { x: number; y: number; w: number; h: number } {
  return { x: z.x + z.w - 11, y: z.y - 13, w: 11, h: 11 };
}

/**
 * Lay the city screen `src` (320x200, drawn) on `dst` from `dx` across, darken it, and draw box `z` over
 * its middle, `z.scale` times its size: each fine pixel a block of them, so the pixel art keeps its edges.
 * The pictures `src` left spots for go with it: the box's grown and moved, the rest darkened.
 */
export function drawCityZoom(dst: Surface, src: Surface, z: CityZoom, dx: number): void {
  const k = dst.k;
  dst.fill(C.BLACK!);
  for (let y = 0; y < src.fh && y < dst.fh; y++)
    for (let x = 0; x < src.fw; x++) {
      const tx = dx * k + x;
      if (tx >= 0 && tx < dst.fw) dst.data[y * dst.fw + tx] = DIMMED[src.data[y * src.fw + x]!]!;
    }
  // Not `dimmed`: a window opened over the enlarged box darkens it in turn.
  const { box, scale } = z;
  // A shadow, a black ring, then the box itself grown.
  dst.rect(z.x + 3, z.y + 3, z.w, z.h, C.BLACK!);
  dst.frame(z.x - 1, z.y - 1, z.w + 2, z.h + 2, C.BLACK!);
  const x0 = box.x * k;
  const y0 = box.y * k;
  for (let y = 0; y < z.h * k; y++) {
    const sy = y0 + Math.floor(y / scale);
    const row = (z.y * k + y) * dst.fw + z.x * k;
    const from = sy * src.fw + x0;
    for (let x = 0; x < z.w * k; x++) dst.data[row + x] = src.data[from + Math.floor(x / scale)]!;
  }
  const c = cityZoomClose(z);
  drawCloseBox(dst, c.x, c.y, c.w);
  // The box's pictures grow with it; the others darken, and those the enlarged box covers go.
  const covers = (a: { x: number; y: number; w: number; h: number }) => a.x < z.x + z.w + 3 && a.x + a.w > z.x - 1 && a.y < z.y + z.h + 3 && a.y + a.h > z.y - 1;
  dst.art = src.art.flatMap((a) => {
    const inside = a.x >= box.x && a.y >= box.y && a.x + a.w <= box.x + box.w && a.y + a.h <= box.y + box.h;
    if (inside) return [{ ...a, x: z.x + (a.x - box.x) * scale, y: z.y + (a.y - box.y) * scale, w: a.w * scale, h: a.h * scale }];
    const moved = { ...a, x: a.x + dx, dim: true };
    return covers(moved) ? [] : [moved];
  });
}
