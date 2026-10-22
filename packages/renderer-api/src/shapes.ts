import type { Material, Part, Picture } from "./cityview.js";

/** The shapes pictures are made of (`PICTURES`, the setup's emblems), on a grid of retro pixels. */


export const pic = (w: number, h: number, ...parts: (Part | Part[])[]): Picture => ({ w, h, parts: parts.flat() });
export const box = (x: number, y: number, w: number, h: number, m: Material, tone = 0): Part =>
  tone ? { k: "rect", x, y, w, h, m, tone } : { k: "rect", x, y, w, h, m };
export const poly = (m: Material, ...pts: number[]): Part => ({ k: "poly", pts, m });
export const shaded = (p: Part): Part => ({ ...p, tone: -1 });
export const disc = (x: number, y: number, r: number, m: Material): Part => ({ k: "oval", x, y, rx: r, ry: r, m });
export const oval = (x: number, y: number, rx: number, ry: number, m: Material): Part => ({ k: "oval", x, y, rx, ry, m });
/** The top half of an oval standing on `base`. */
export const dome = (x: number, base: number, rx: number, ry: number, m: Material): Part => ({ k: "oval", x, y: base, rx, ry, m, top: true });
export const line = (x0: number, y0: number, x1: number, y1: number, m: Material, w = 1): Part => ({ k: "line", x0, y0, x1, y1, m, w });
/** A gable: a triangle on the line `y + h`. */
export const gable = (x: number, y: number, w: number, h: number, m: Material): Part => poly(m, x, y + h, x + w / 2, y, x + w, y + h);
/** A hipped roof: a trapezoid on the line `y + h`, `inset` narrower at the top on each side. */
export const slope = (x: number, y: number, w: number, h: number, inset: number, m: Material): Part =>
  poly(m, x, y + h, x + inset, y, x + w - inset, y, x + w, y + h);

/** `n` columns two pixels thick, evenly from `x` to `x + w`. */
export function cols(x: number, y: number, w: number, h: number, n: number, m: Material = "marble"): Part[] {
  return Array.from({ length: n }, (_, i) => box(Math.round(x + (i * (w - 2)) / (n - 1)), y, 2, h, m));
}

/** A grid of windows (`ww` by `wh`), one centred in each of `nx` by `ny` cells. */
export function windows(x: number, y: number, w: number, h: number, nx: number, ny: number, m: Material = "dark", ww = 1, wh = 2): Part[] {
  const out: Part[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      out.push(box(Math.round(x + ((i + 0.5) * w) / nx - ww / 2), Math.round(y + ((j + 0.5) * h) / ny - wh / 2), ww, wh, m));
  return out;
}

/** A row of `n` round-topped openings filling `w`. */
export function arches(x: number, y: number, w: number, h: number, n: number, m: Material = "dark"): Part[] {
  const cell = w / n;
  const r = Math.max(1, Math.round(cell * 0.3));
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * cell;
    out.push(box(cx - r, y + r, 2 * r, h - r, m), dome(cx, y + r, r, r, m));
  }
  return out;
}

/** A pole with a pennant in the owner's colour. */
export const flag = (x: number, top: number, h: number): Part[] => [line(x, top, x, top + h, "steel"), poly("owner", x + 1, top, x + 6, top + 1.5, x + 1, top + 3)];
export const smoke = (x: number, y: number): Part[] => [disc(x, y, 1.5, "smoke"), disc(x + 2, y - 3, 2, "smoke")];
export const door = (cx: number, base: number, w: number, h: number): Part[] => [box(cx - w / 2, base - h + w / 2, w, h - w / 2, "dark"), dome(cx, base - h + w / 2, w / 2, w / 2, "dark")];

/** A dish (radio telescope, radar) of radius `r` around (`x`, `y`), its opening turned by `angle` (radians, 0 = up). */
export function dish(x: number, y: number, r: number, angle: number, m: Material): Part[] {
  const pts: [number, number][] = [];
  for (let t = -1; t <= 1.001; t += 0.25) pts.push([t * r, 0]);
  for (let t = 1; t >= -1.001; t -= 0.25) pts.push([t * r, r * 0.45 * (1 - t * t)]);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const turn = ([px, py]: [number, number]): number[] => [x + px * c - py * s, y + px * s + py * c];
  const [fx, fy] = turn([0, -0.7 * r]);
  return [poly(m, ...pts.flatMap(turn)), line(x, y, fx!, fy!, "steel")];
}

export const stall = (x: number, m: Material): Part[] => [
  line(x + 1, 10, x + 1, 17, "wood"), line(x + 8, 10, x + 8, 17, "wood"),
  box(x + 1, 13, 8, 4, "wood"),
  poly(m, x, 11, x + 2, 8, x + 8, 8, x + 10, 11),
  disc(x + 3.5, 12.5, 1, "green"), disc(x + 6.5, 12.5, 1, "gold"),
];
export const coolingTower = (x: number, h: number): Part[] => [poly("concrete", x, h, x + 2, h - 12, x + 1, h - 20, x + 11, h - 20, x + 10, h - 12, x + 12, h)];
export const panel = (x: number): Part[] => [
  line(x + 3, 10, x + 3, 14, "steel"), line(x + 8, 10, x + 8, 14, "steel"),
  poly("deep", x, 12, x + 3, 5, x + 11, 5, x + 8, 12),
  line(x + 1.5, 8.5, x + 9.5, 8.5, "glass"),
];
export const lattice = (x0: number, x1: number, top: number, base: number): Part[] => {
  const mid = (x0 + x1) / 2;
  const out = [line(x0, base, mid - 1, top, "steel"), line(x1, base, mid + 1, top, "steel")];
  for (let k = 1; k < 4; k++) {
    const y = base - ((base - top) * k) / 4;
    const half = ((x1 - x0) / 2) * (1 - k / 4) + 1;
    out.push(line(mid - half, y, mid + half, y, "steel"));
  }
  return out;
};
