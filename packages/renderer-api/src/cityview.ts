import { CITY_RADIUS, getTile, knows, Terrain, type City, type GameState } from "@civ/core";
import { hash } from "./hash.js";

/**
 * The city view, the original's View: the city as a picture. Every improvement and wonder has a
 * picture made of a few shapes (`Part`s) on a grid of retro pixels, its ground along the bottom;
 * the retro renderer fills them pixel by pixel, the modern one paints them as paths three times
 * larger. `cityScene` lays out what a city has (wonders on the skyline, the palace in the middle,
 * improvements and homes along the streets, walls across the front) for both.
 */

/** What a shape is made of; each renderer gives it colours (a face, a lit edge, a shaded edge). */
export type Material =
  | "stone" | "marble" | "sandstone" | "brick" | "roof" | "slate" | "wood" | "thatch" | "gold"
  | "glass" | "deep" | "dark" | "steel" | "concrete" | "green" | "leaf" | "copper" | "water" | "white"
  | "light" | "smoke" | "owner";

/** One shape of a picture; `tone` -1 draws it a shade darker (a face turned from the light), +1 lighter. */
export type Part = { m: Material; tone?: number } & (
  | { k: "rect"; x: number; y: number; w: number; h: number }
  | { k: "poly"; pts: number[] }
  | { k: "oval"; x: number; y: number; rx: number; ry: number; top?: boolean }
  | { k: "line"; x0: number; y0: number; x1: number; y1: number; w: number }
);

export interface Picture {
  w: number;
  h: number;
  parts: Part[];
}

/** Lines (masts, poles, rails) and smoke are drawn without the dark outline that rings everything else. */
export function bare(p: Part): boolean {
  return p.k === "line" || p.m === "smoke";
}

// ---- shapes ----------------------------------------------------------------------

const pic = (w: number, h: number, ...parts: (Part | Part[])[]): Picture => ({ w, h, parts: parts.flat() });
const box = (x: number, y: number, w: number, h: number, m: Material, tone = 0): Part =>
  tone ? { k: "rect", x, y, w, h, m, tone } : { k: "rect", x, y, w, h, m };
const poly = (m: Material, ...pts: number[]): Part => ({ k: "poly", pts, m });
const shaded = (p: Part): Part => ({ ...p, tone: -1 });
const disc = (x: number, y: number, r: number, m: Material): Part => ({ k: "oval", x, y, rx: r, ry: r, m });
const oval = (x: number, y: number, rx: number, ry: number, m: Material): Part => ({ k: "oval", x, y, rx, ry, m });
/** The top half of an oval standing on `base`. */
const dome = (x: number, base: number, rx: number, ry: number, m: Material): Part => ({ k: "oval", x, y: base, rx, ry, m, top: true });
const line = (x0: number, y0: number, x1: number, y1: number, m: Material, w = 1): Part => ({ k: "line", x0, y0, x1, y1, m, w });
/** A gable: a triangle on the line `y + h`. */
const gable = (x: number, y: number, w: number, h: number, m: Material): Part => poly(m, x, y + h, x + w / 2, y, x + w, y + h);
/** A hipped roof: a trapezoid on the line `y + h`, `inset` narrower at the top on each side. */
const slope = (x: number, y: number, w: number, h: number, inset: number, m: Material): Part =>
  poly(m, x, y + h, x + inset, y, x + w - inset, y, x + w, y + h);

/** `n` columns two pixels thick, evenly from `x` to `x + w`. */
function cols(x: number, y: number, w: number, h: number, n: number, m: Material = "marble"): Part[] {
  return Array.from({ length: n }, (_, i) => box(Math.round(x + (i * (w - 2)) / (n - 1)), y, 2, h, m));
}

/** A grid of windows (`ww` by `wh`), one centred in each of `nx` by `ny` cells. */
function windows(x: number, y: number, w: number, h: number, nx: number, ny: number, m: Material = "dark", ww = 1, wh = 2): Part[] {
  const out: Part[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      out.push(box(Math.round(x + ((i + 0.5) * w) / nx - ww / 2), Math.round(y + ((j + 0.5) * h) / ny - wh / 2), ww, wh, m));
  return out;
}

/** A row of `n` round-topped openings filling `w`. */
function arches(x: number, y: number, w: number, h: number, n: number, m: Material = "dark"): Part[] {
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
const flag = (x: number, top: number, h: number): Part[] => [line(x, top, x, top + h, "steel"), poly("owner", x + 1, top, x + 6, top + 1.5, x + 1, top + 3)];
const smoke = (x: number, y: number): Part[] => [disc(x, y, 1.5, "smoke"), disc(x + 2, y - 3, 2, "smoke")];
const door = (cx: number, base: number, w: number, h: number): Part[] => [box(cx - w / 2, base - h + w / 2, w, h - w / 2, "dark"), dome(cx, base - h + w / 2, w / 2, w / 2, "dark")];

/** A dish (radio telescope, radar) of radius `r` around (`x`, `y`), its opening turned by `angle` (radians, 0 = up). */
function dish(x: number, y: number, r: number, angle: number, m: Material): Part[] {
  const pts: [number, number][] = [];
  for (let t = -1; t <= 1.001; t += 0.25) pts.push([t * r, 0]);
  for (let t = 1; t >= -1.001; t -= 0.25) pts.push([t * r, r * 0.45 * (1 - t * t)]);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const turn = ([px, py]: [number, number]): number[] => [x + px * c - py * s, y + px * s + py * c];
  const [fx, fy] = turn([0, -0.7 * r]);
  return [poly(m, ...pts.flatMap(turn)), line(x, y, fx!, fy!, "steel")];
}

const stall = (x: number, m: Material): Part[] => [
  line(x + 1, 10, x + 1, 17, "wood"), line(x + 8, 10, x + 8, 17, "wood"),
  box(x + 1, 13, 8, 4, "wood"),
  poly(m, x, 11, x + 2, 8, x + 8, 8, x + 10, 11),
  disc(x + 3.5, 12.5, 1, "green"), disc(x + 6.5, 12.5, 1, "gold"),
];
const coolingTower = (x: number, h: number): Part[] => [poly("concrete", x, h, x + 2, h - 12, x + 1, h - 20, x + 11, h - 20, x + 10, h - 12, x + 12, h)];
const panel = (x: number): Part[] => [
  line(x + 3, 10, x + 3, 14, "steel"), line(x + 8, 10, x + 8, 14, "steel"),
  poly("deep", x, 12, x + 3, 5, x + 11, 5, x + 8, 12),
  line(x + 1.5, 8.5, x + 9.5, 8.5, "glass"),
];
const lattice = (x0: number, x1: number, top: number, base: number): Part[] => {
  const mid = (x0 + x1) / 2;
  const out = [line(x0, base, mid - 1, top, "steel"), line(x1, base, mid + 1, top, "steel")];
  for (let k = 1; k < 4; k++) {
    const y = base - ((base - top) * k) / 4;
    const half = ((x1 - x0) / 2) * (1 - k / 4) + 1;
    out.push(line(mid - half, y, mid + half, y, "steel"));
  }
  return out;
};

// ---- the pictures ------------------------------------------------------------------

/** A run of city wall `w` pixels long: crenellated stone, towers at the ends and between, a gate in the middle. */
export function wallRun(w: number): Picture {
  const parts: Part[] = [box(0, 6, w, 10, "stone")];
  for (let x = 0; x + 2 <= w; x += 4) parts.push(box(x, 4, 2, 2, "stone"));
  const towers = Math.max(2, Math.round(w / 56) + 1);
  for (let i = 0; i < towers; i++) {
    const tx = Math.round((i * (w - 8)) / (towers - 1));
    parts.push(box(tx, 2, 8, 14, "stone", 1), box(tx, 0, 2, 2, "stone", 1), box(tx + 3, 0, 2, 2, "stone", 1), box(tx + 6, 0, 2, 2, "stone", 1), box(tx + 3, 6, 2, 3, "dark"));
  }
  parts.push(...door(w / 2, 16, 8, 8));
  return pic(w, 16, parts);
}

/** One picture per improvement and per wonder, by id. */
export const PICTURES: Record<string, Picture> = {
  palace: pic(32, 32,
    flag(16, 0, 7),
    box(0, 20, 6, 12, "marble"), slope(0, 17, 6, 3, 1, "roof"),
    box(26, 20, 6, 12, "marble"), slope(26, 17, 6, 3, 1, "roof"),
    box(4, 16, 24, 16, "marble"), slope(3, 12, 26, 4, 3, "roof"),
    dome(16, 12, 6, 6, "gold"),
    windows(6, 18, 20, 4, 5, 1, "glass"), windows(5, 25, 7, 4, 2, 1, "glass"), windows(20, 25, 7, 4, 2, 1, "glass"),
    box(2, 23, 2, 3, "glass"), box(28, 23, 2, 3, "glass"),
    door(16, 32, 4, 7)),
  barracks: pic(28, 15,
    flag(22, 0, 15),
    box(0, 6, 21, 9, "stone"), slope(0, 3, 21, 3, 2, "slate"),
    windows(1, 8, 19, 2, 6, 1, "dark"), box(9, 10, 3, 5, "dark"),
    line(21, 11, 28, 11, "wood"), line(21, 13, 28, 13, "wood"), line(27, 10, 27, 15, "wood")),
  granary: pic(19, 20,
    box(1, 7, 8, 13, "sandstone"), dome(5, 7, 4, 4, "roof"),
    box(1, 11, 8, 1, "wood"), box(1, 15, 8, 1, "wood"),
    box(9, 12, 9, 8, "wood"), slope(8, 9, 11, 3, 2, "thatch"), box(12, 15, 3, 5, "dark")),
  temple: pic(24, 20,
    box(3, 8, 18, 9, "dark"), cols(3, 8, 18, 9, 5),
    box(2, 6, 20, 2, "marble"), gable(2, 1, 20, 5, "marble"),
    box(1, 17, 22, 2, "marble"), box(0, 19, 24, 1, "stone")),
  marketplace: pic(28, 17,
    box(6, 3, 16, 10, "sandstone"), slope(5, 1, 18, 2, 1, "roof"), windows(8, 5, 12, 3, 3, 1),
    stall(0, "roof"), stall(9, "owner"), stall(18, "gold")),
  library: pic(24, 21,
    gable(8, 1, 8, 3, "sandstone"),
    box(1, 7, 22, 14, "sandstone"), slope(0, 4, 24, 3, 2, "slate"),
    arches(2, 10, 7, 6, 2, "glass"), arches(15, 10, 7, 6, 2, "glass"),
    poly("white", 9.5, 9, 12, 10, 14.5, 9, 14.5, 12, 12, 13, 9.5, 12),
    door(12, 21, 4, 7)),
  courthouse: pic(24, 26,
    box(9, 4, 6, 8, "stone"), poly("slate", 8.5, 4, 12, 0, 15.5, 4), disc(12, 7, 1.5, "white"),
    box(1, 12, 22, 12, "marble"),
    box(4, 14, 16, 9, "dark"), cols(4, 14, 16, 9, 4),
    box(1, 12, 22, 2, "marble"), gable(1, 8, 22, 4, "marble"),
    box(0, 23, 24, 3, "stone")),
  city_walls: wallRun(32),
  aqueduct: pic(36, 18,
    box(0, 1, 36, 2, "water"), box(0, 3, 36, 3, "stone"),
    box(0, 6, 36, 12, "stone"), arches(0, 7, 36, 11, 4)),
  bank: pic(22, 22,
    box(1, 6, 20, 16, "stone"), box(0, 4, 22, 2, "stone"),
    disc(11, 3, 3, "gold"),
    arches(2, 9, 18, 5, 3, "glass"),
    box(8, 15, 6, 7, "dark"), cols(6, 15, 10, 7, 2),
    box(0, 21, 22, 1, "stone")),
  cathedral: pic(26, 36,
    box(8, 16, 18, 20, "stone"), slope(7, 12, 20, 4, 2, "slate"),
    box(1, 10, 9, 26, "stone"), poly("slate", 0.5, 10, 5.5, 0, 10.5, 10),
    arches(3, 14, 5, 5, 1), arches(3, 24, 5, 5, 1, "glass"),
    disc(17, 22, 3, "glass"), door(17, 36, 4, 7)),
  university: pic(30, 26,
    box(10, 6, 10, 6, "marble"), dome(15, 6, 5, 5, "copper"), box(14, 0, 2, 2, "gold"),
    box(1, 12, 28, 14, "marble"), box(0, 11, 30, 2, "marble"),
    windows(2, 15, 6, 8, 2, 2, "glass"), windows(22, 15, 6, 8, 2, 2, "glass"),
    box(9, 15, 12, 10, "dark"), cols(9, 15, 12, 10, 4), gable(8, 11, 14, 4, "marble"),
    box(0, 25, 30, 1, "stone")),
  mass_transit: pic(32, 17,
    box(4, 8, 2, 9, "concrete"), box(26, 8, 2, 9, "concrete"), box(0, 6, 32, 2, "concrete"),
    box(3, 1, 25, 5, "white"), poly("white", 28, 1, 30, 3, 30, 6, 28, 6),
    windows(4, 1, 23, 3, 6, 1, "glass", 2, 1), box(3, 4, 27, 1, "owner")),
  colosseum: pic(36, 22,
    poly("sandstone", 0, 22, 0, 2, 25, 2, 29, 5, 33, 9, 36, 12, 36, 22),
    arches(1, 4, 24, 5, 5), arches(1, 11, 34, 5, 7), arches(1, 17, 34, 5, 7),
    box(0, 10, 34, 1, "sandstone", -1)),
  factory: pic(30, 26,
    smoke(25, 5), box(24, 6, 3, 10, "brick"),
    box(0, 14, 30, 12, "brick"),
    poly("slate", 0, 14, 0, 10, 6, 14, 6, 10, 12, 14, 12, 10, 18, 14, 18, 10, 24, 14),
    windows(2, 16, 26, 4, 6, 1, "glass", 2, 2), box(13, 21, 4, 5, "dark")),
  mfg_plant: pic(36, 26,
    smoke(21, 5), box(20, 6, 3, 10, "brick"),
    box(0, 12, 24, 14, "steel"), box(0, 10, 24, 2, "slate"),
    windows(2, 14, 20, 4, 5, 1, "glass", 2, 2), box(8, 20, 6, 6, "dark"),
    line(24, 19, 26, 19, "steel"),
    box(25, 16, 10, 10, "concrete"), dome(30, 16, 5, 3, "concrete")),
  sdi_defense: pic(24, 24,
    line(19, 6, 19, 16, "steel"), dish(19, 5, 4, -0.5, "white"),
    box(1, 16, 22, 8, "concrete"), dome(10, 16, 7, 7, "white"), box(2, 19, 4, 3, "dark")),
  recycling_center: pic(28, 18,
    box(0, 6, 22, 12, "concrete"), slope(0, 3, 22, 3, 1, "green"),
    disc(11, 11, 3.5, "green"), disc(11, 11, 1.5, "concrete"), box(3, 12, 3, 6, "dark"),
    box(23, 12, 5, 6, "green", -1), box(23, 11, 5, 1, "dark")),
  power_plant: pic(30, 28,
    smoke(24, 5), smoke(27, 9),
    box(22, 6, 3, 22, "brick"), box(26, 10, 3, 18, "brick"),
    box(0, 14, 22, 14, "brick"), slope(0, 11, 22, 3, 2, "slate"),
    windows(2, 17, 18, 4, 5, 1, "glass", 2, 2), box(9, 22, 4, 6, "dark")),
  hydro_plant: pic(36, 24,
    box(4, 2, 28, 2, "water"),
    poly("concrete", 0, 24, 4, 4, 32, 4, 36, 24),
    box(15, 9, 6, 13, "water"), disc(18, 22, 3, "white"),
    box(1, 18, 9, 6, "concrete", 1), windows(2, 19, 7, 3, 3, 1)),
  nuclear_plant: pic(34, 28,
    disc(7, 5, 3, "smoke"), disc(10, 3, 2.5, "smoke"),
    coolingTower(1, 28),
    box(20, 18, 13, 10, "white"), dome(26.5, 18, 5, 5, "white"), box(24, 22, 3, 6, "dark")),
  data_center: pic(26, 16,
    box(3, 2, 5, 2, "steel"), box(10.5, 2, 5, 2, "steel"), box(18, 2, 5, 2, "steel"),
    box(0, 4, 26, 12, "concrete"), box(1, 6, 24, 8, "dark"),
    windows(2, 7, 22, 6, 8, 3, "light", 1, 1)),
  cell_tower: pic(14, 34,
    lattice(3, 11, 3, 34), line(7, 0, 7, 4, "steel"),
    box(4, 5, 1, 4, "white"), box(9, 5, 1, 4, "white"), disc(7, 1, 1, "light"),
    box(9, 29, 5, 5, "concrete")),
  solar_plant: pic(34, 14, panel(0), panel(11), panel(22)),
  automated_office: pic(20, 40,
    line(10, 0, 10, 3, "steel"), box(5, 2, 10, 3, "steel"),
    box(2, 5, 16, 35, "glass"), box(2, 5, 6, 35, "glass", 1),
    windows(2, 7, 16, 31, 1, 11, "deep", 16, 1), box(7, 35, 6, 5, "dark")),
  quantum_lab: pic(28, 22,
    oval(14, 11, 13, 3, "light"),
    box(0, 12, 28, 10, "white"), dome(14, 12, 9, 9, "glass"), disc(14, 7, 1.5, "light"),
    windows(2, 15, 24, 3, 6, 1, "deep", 2, 2), box(12, 17, 4, 5, "dark")),

  // Wonders of the World.
  pyramids: pic(44, 28,
    poly("sandstone", 0, 28, 8, 17, 10, 28), shaded(poly("sandstone", 10, 28, 8, 17, 16, 28)),
    poly("sandstone", 8, 28, 26, 2, 30, 28), shaded(poly("sandstone", 30, 28, 26, 2, 44, 28))),
  hanging_gardens: pic(36, 30,
    box(0, 22, 36, 8, "sandstone"), box(4, 15, 28, 7, "sandstone"), box(9, 8, 18, 7, "sandstone"), box(13, 3, 10, 5, "sandstone"),
    arches(2, 25, 32, 5, 6), arches(6, 17, 24, 5, 4),
    box(0, 21, 36, 2, "green"), box(4, 14, 28, 2, "green"), box(9, 7, 18, 2, "green"), box(13, 2, 10, 2, "green"),
    line(2, 22, 2, 27, "green"), line(33, 22, 33, 26, "green"), line(6, 15, 6, 20, "green"), line(29, 15, 29, 19, "green"),
    line(11, 8, 11, 12, "green"), line(24, 8, 24, 12, "green"),
    disc(15, 1.5, 2, "green"), disc(20, 1.5, 2, "green")),
  colossus: pic(22, 44,
    box(4, 38, 14, 6, "stone"),
    box(7, 28, 3, 10, "copper"), box(12, 28, 3, 10, "copper"),
    box(6, 17, 10, 12, "copper"), disc(11, 13, 3, "copper"),
    line(15, 18, 18, 7, "copper", 2), line(6, 18, 4, 27, "copper", 2),
    disc(18.5, 5, 2, "light"),
    line(8, 9, 7, 7, "gold"), line(11, 8, 11, 6, "gold"), line(14, 9, 15, 7, "gold")),
  lighthouse: pic(16, 46,
    poly("marble", 2, 46, 5, 12, 11, 12, 14, 46),
    box(7, 20, 2, 3, "dark"), box(7, 32, 2, 3, "dark"),
    box(3, 10, 10, 2, "stone"), box(5, 5, 6, 5, "stone"), disc(8, 7.5, 2, "light"),
    gable(4, 1, 8, 4, "slate")),
  great_library: pic(40, 26,
    box(3, 10, 34, 12, "dark"), cols(3, 10, 34, 12, 9),
    box(1, 7, 38, 3, "marble"), gable(1, 1, 38, 6, "marble"),
    box(1, 22, 38, 2, "marble"), box(0, 24, 40, 2, "stone")),
  oracle: pic(26, 24,
    poly("stone", 0, 24, 4, 16, 22, 15, 26, 24),
    box(5, 14, 16, 2, "marble"),
    box(6, 7, 14, 7, "dark"), cols(6, 7, 14, 7, 5),
    poly("roof", 4, 7, 13, 1, 22, 7),
    disc(23, 10, 1.5, "smoke"), disc(24.5, 7, 1.5, "smoke")),
  great_wall: pic(44, 22,
    poly("green", 0, 22, 0, 16, 10, 12, 22, 16, 33, 10, 44, 14, 44, 22),
    poly("stone", 0, 16, 10, 12, 22, 16, 33, 10, 44, 14, 44, 10, 33, 6, 22, 12, 10, 8, 0, 12),
    box(7, 2, 6, 9, "stone", 1), box(7, 0, 2, 2, "stone", 1), box(11, 0, 2, 2, "stone", 1), box(9, 5, 2, 3, "dark"),
    box(30, 0, 6, 8, "stone", 1), box(31, 3, 2, 2, "dark")),
  copernicus: pic(24, 34,
    line(12, 8, 19, 2, "steel", 2),
    box(6, 14, 12, 20, "brick"), box(5, 11, 14, 3, "stone"),
    dome(12, 11, 7, 7, "copper"), line(12, 5, 12, 10, "dark"),
    arches(8, 17, 8, 6, 2, "glass"), door(12, 34, 4, 7)),
  magellans: pic(40, 30,
    line(14, 3, 14, 20, "wood"), line(25, 1, 25, 20, "wood"), poly("owner", 26, 1, 31, 2.5, 26, 4),
    poly("white", 9, 5, 19, 5, 18, 16, 10, 16), poly("white", 20, 5, 30, 5, 29, 16, 21, 16),
    poly("wood", 5, 19, 35, 19, 31, 27, 9, 27), box(28, 15, 7, 4, "wood"),
    windows(10, 21, 20, 2, 5, 1, "dark", 1, 1),
    box(0, 26, 40, 4, "water")),
  michelangelos: pic(32, 36,
    box(15, 0, 2, 4, "marble"),
    box(9, 12, 14, 7, "marble"), dome(16, 12, 8, 9, "slate"), windows(10, 14, 12, 3, 4, 1),
    box(0, 20, 32, 16, "marble"),
    box(10, 23, 12, 11, "dark"), cols(10, 23, 12, 11, 4), gable(9, 18, 14, 5, "marble"),
    windows(2, 24, 6, 8, 2, 2), windows(24, 24, 6, 8, 2, 2),
    box(0, 34, 32, 2, "stone")),
  shakespeares: pic(30, 28,
    flag(15, 0, 7),
    slope(0, 5, 30, 5, 4, "thatch"),
    box(1, 10, 28, 18, "white"),
    [1, 7, 13, 19, 25, 28].map((x) => box(x, 10, 1, 18, "wood")), box(1, 18, 28, 1, "wood"),
    windows(3, 12, 24, 4, 4, 1, "dark", 2, 2), door(15, 28, 4, 7)),
  isaac_newtons: pic(30, 30,
    box(0, 13, 30, 17, "brick"), slope(0, 11, 30, 2, 1, "slate"),
    windows(1, 16, 8, 10, 2, 2, "glass", 1, 3), windows(21, 16, 8, 10, 2, 2, "glass", 1, 3),
    box(10, 5, 10, 25, "brick"), box(9, 2, 3, 8, "brick", 1), box(18, 2, 3, 8, "brick", 1),
    disc(15, 10, 2, "white"), box(14, 14, 2, 4, "glass"), door(15, 30, 4, 9)),
  js_bachs: pic(28, 38,
    box(4, 18, 20, 20, "stone"), gable(4, 13, 20, 5, "slate"),
    box(0, 10, 7, 28, "stone"), box(21, 10, 7, 28, "stone"),
    poly("slate", 0, 10, 3.5, 0, 7, 10), poly("slate", 21, 10, 24.5, 0, 28, 10),
    arches(1, 14, 5, 5, 1), arches(22, 14, 5, 5, 1),
    disc(14, 23, 3.5, "glass"), door(14, 38, 4, 8)),
  darwins_voyage: pic(36, 28,
    line(11, 4, 11, 19, "wood"), line(19, 6, 19, 19, "wood"),
    poly("white", 7, 6, 15, 6, 14, 15, 8, 15), poly("white", 16, 8, 23, 8, 22, 15, 17, 15),
    poly("wood", 3, 18, 27, 18, 24, 24, 6, 24),
    box(0, 24, 36, 4, "water"),
    poly("sandstone", 26, 26, 30, 21, 36, 26),
    line(32, 22, 31, 14, "wood"), disc(30, 13, 2.5, "green"), disc(33, 13.5, 2, "green")),
  womens_suffrage: pic(28, 26,
    box(13, 2, 2, 4, "marble"), dome(14, 11, 6, 6, "marble"),
    box(0, 12, 28, 12, "marble"), box(0, 11, 28, 2, "marble"),
    box(8, 15, 12, 9, "dark"), cols(8, 15, 12, 9, 4),
    box(2, 14, 4, 9, "owner"), box(22, 14, 4, 9, "owner"),
    box(0, 24, 28, 2, "stone")),
  hoover_dam: pic(44, 30,
    box(9, 2, 26, 3, "water"),
    poly("concrete", 8, 4, 36, 4, 32, 30, 12, 30),
    box(19, 14, 6, 14, "water"), disc(22, 28, 3, "white"),
    box(12, 1, 3, 4, "concrete", 1), box(29, 1, 3, 4, "concrete", 1),
    poly("stone", 0, 30, 0, 0, 8, 2, 11, 30), shaded(poly("stone", 33, 30, 36, 2, 44, 0, 44, 30))),
  manhattan_project: pic(30, 36,
    lattice(22, 29, 6, 36), box(22, 5, 7, 2, "steel"), disc(25.5, 3, 2.5, "steel"),
    box(0, 22, 21, 14, "concrete"), box(0, 20, 21, 2, "concrete", -1),
    windows(2, 24, 17, 4, 5, 1, "dark", 2, 2), box(8, 29, 5, 7, "dark")),
  united_nations: pic(24, 44,
    box(5, 2, 14, 38, "glass"), box(5, 2, 2, 38, "concrete"), box(17, 2, 2, 38, "concrete"),
    windows(7, 4, 10, 34, 1, 12, "deep", 10, 1),
    box(0, 36, 24, 8, "white"), windows(1, 38, 22, 3, 6, 1, "glass", 2, 2),
    flag(1, 28, 8), line(22, 28, 22, 36, "steel"), poly("glass", 22, 28, 17, 29.5, 22, 31)),
  seti_program: pic(34, 28,
    poly("steel", 7, 28, 9, 16, 11, 28), dish(9, 12, 8, -0.6, "white"),
    poly("steel", 24, 28, 26, 19, 28, 28), dish(26, 16, 6, -0.6, "white"),
    box(13, 23, 7, 5, "concrete"), box(15, 25, 3, 3, "dark")),
  apollo_program: pic(24, 46,
    lattice(18, 23, 4, 42), line(15, 14, 18, 14, "steel"), line(15, 26, 18, 26, "steel"),
    box(9, 10, 6, 32, "white"), poly("white", 9, 10, 12, 1, 15, 10),
    box(9, 20, 6, 1, "dark"), box(9, 32, 6, 1, "dark"), box(10, 24, 4, 3, "owner"),
    poly("white", 9, 35, 6, 42, 9, 42), poly("white", 15, 35, 18, 42, 15, 42),
    box(0, 42, 24, 4, "concrete")),
  cure_for_cancer: pic(28, 26,
    box(10, 0, 8, 8, "white"), box(13, 1, 2, 6, "green"), box(11, 3, 6, 2, "green"),
    box(0, 8, 28, 18, "white"),
    windows(2, 10, 24, 10, 6, 3, "glass", 2, 2), box(11, 20, 6, 6, "glass", -1)),
};

/** Homes, by the age the city lives in: huts, then cottages, town houses and blocks of flats. */
const HOMES: Picture[][] = [
  [
    pic(10, 9, box(1, 5, 8, 4, "sandstone"), poly("thatch", 0, 6, 5, 0, 10, 6), box(4, 6, 2, 3, "dark")),
    pic(13, 8, box(1, 4, 11, 4, "wood"), slope(0, 1, 13, 3, 2, "thatch"), box(5, 5, 2, 3, "dark")),
  ],
  [
    pic(12, 11, box(1, 5, 10, 6, "white"), gable(0, 1, 12, 4, "roof"), box(3, 7, 2, 4, "dark"), box(7, 7, 2, 2, "glass")),
    pic(12, 12, box(8, 0, 2, 3, "sandstone"), box(1, 5, 10, 7, "sandstone"), slope(0, 2, 12, 3, 2, "roof"), box(7, 8, 2, 4, "dark"), box(3, 7, 2, 2, "glass")),
    pic(10, 9, box(1, 5, 8, 4, "sandstone"), poly("thatch", 0, 6, 5, 0, 10, 6), box(4, 6, 2, 3, "dark")),
  ],
  [
    pic(10, 17, box(7, 1, 2, 3, "brick"), box(0, 5, 10, 12, "brick"), slope(0, 3, 10, 2, 1, "slate"), windows(1, 6, 8, 8, 2, 3, "glass", 2, 2), box(4, 14, 2, 3, "dark")),
    pic(11, 15, box(0, 3, 11, 12, "white"), slope(0, 1, 11, 2, 1, "slate"), windows(1, 5, 9, 6, 3, 2, "glass", 1, 2), box(4, 12, 3, 3, "dark")),
    pic(12, 11, box(1, 5, 10, 6, "white"), gable(0, 1, 12, 4, "roof"), box(3, 7, 2, 4, "dark"), box(7, 7, 2, 2, "glass")),
  ],
  [
    pic(12, 23, box(0, 2, 12, 21, "concrete"), windows(1, 3, 10, 17, 3, 6, "glass", 2, 1), box(4, 20, 4, 3, "dark")),
    pic(10, 27, box(0, 1, 10, 26, "glass"), windows(0, 2, 10, 23, 1, 8, "deep", 10, 1), box(3, 24, 4, 3, "dark")),
    pic(10, 17, box(7, 1, 2, 3, "brick"), box(0, 5, 10, 12, "brick"), slope(0, 3, 10, 2, 1, "slate"), windows(1, 6, 8, 8, 2, 3, "glass", 2, 2), box(4, 14, 2, 3, "dark")),
  ],
];

const TREES: Picture[] = [
  pic(7, 10, line(3.5, 6, 3.5, 10, "wood"), disc(3.5, 4, 3.2, "leaf")),
  pic(7, 11, line(3.5, 8, 3.5, 11, "wood"), poly("leaf", 0, 9, 3.5, 0, 7, 9)),
  pic(9, 9, line(4.5, 6, 4.5, 9, "wood"), disc(3, 4.5, 2.6, "leaf"), disc(6, 3.5, 3, "leaf")),
];

/** The age a civilization's homes show: what it knows of building and industry. */
export function homeAge(known: string[]): number {
  return knows(known, "automobile") ? 3 : knows(known, "industrialization") ? 2 : knows(known, "construction") ? 1 : 0;
}

export type CityEra = "ancient" | "medieval" | "industrial";
export type CityTier = "village" | "town" | "city" | "capital";

/** Size from which a city is drawn as a town, and as a city. */
export const CITY_TIER_SIZES = { town: 4, city: 8 } as const;

/**
 * How a city looks on the map: the age of its owner's homes, as the city view shows them (ancient,
 * medieval from Construction, industrial from Industrialization), and its size (village, town, city);
 * the city with the Palace is drawn as the capital whatever its size.
 */
export function cityLook(state: GameState, city: City): { era: CityEra; tier: CityTier } {
  const age = homeAge(state.players[city.owner]?.advances ?? []);
  const era: CityEra = age >= 2 ? "industrial" : age === 1 ? "medieval" : "ancient";
  const tier: CityTier = city.buildings.includes("palace") ? "capital"
    : city.size >= CITY_TIER_SIZES.city ? "city" : city.size >= CITY_TIER_SIZES.town ? "town" : "village";
  return { era, tier };
}

// ---- the scene ----------------------------------------------------------------------

/** The city view's size in retro pixels; the modern renderer paints it three times larger. */
export const SCENE_W = 316;
export const SCENE_H = 174;
const HORIZON = 46;
const STREETS = [74, 100, 126, 152];
/** The rows improvements and homes fill, in turn: the middle, the front, the one before it, the back. */
const ROW_ORDER = [1, 2, 3, 0];
const MARGIN = 4;
const GAP = 3;

export interface SceneItem {
  /** The improvement or wonder shown, or "" for homes, trees and walls. */
  id: string;
  kind: "wonder" | "building" | "home" | "tree" | "walls";
  pic: Picture;
  /** Left edge and ground line. */
  x: number;
  y: number;
}

export interface CityScene {
  w: number;
  h: number;
  horizon: number;
  /** Clouds: each a few puffs around its middle. */
  clouds: { x: number; y: number }[];
  /** The city's own ground. */
  ground: Terrain;
  /** Land of other kinds (and the sea) out to the horizon, from the far edge of the city's reach. */
  patches: { terrain: Terrain; pts: number[] }[];
  /** Mountains, hills and woods along the horizon (their middle, width and height). */
  knolls: { kind: "mountain" | "hill" | "tree"; x: number; w: number; h: number }[];
  /** A river winding across, when the city stands on one. */
  river: number[] | null;
  /** The streets the rows stand along, as far as the row is built: dirt, then cobbles, then asphalt. */
  streets: { y: number; x0: number; x1: number; surface: "dirt" | "stone" | "asphalt" }[];
  /** Back to front, left to right: the order to draw them. */
  items: SceneItem[];
}

/**
 * Lays out a city's view. Wonders stand along the back row against the sky, the palace in the
 * middle of the next; improvements and homes (more for a bigger city) fill the middle row
 * outward and then the rows before and behind it, so a small town keeps together. Each row is
 * built from its middle out, with a street along what is built and trees scattered beyond.
 * The land beyond is what the city reaches to the north; walls run across the front.
 * Variety comes from `hash`, never the game's RNG.
 */
export function cityScene(state: GameState, city: City): CityScene {
  const w = SCENE_W;
  const h = SCENE_H;
  const known = state.players[city.owner]!.advances;
  const tile = getTile(state.map, city.x, city.y);
  const ground = tile?.terrain ?? Terrain.Grassland;
  const salt = city.id * 7919;

  // The far land: five strips across, west to east, each the farthest square north in reach.
  const patches: CityScene["patches"] = [];
  const knolls: CityScene["knolls"] = [];
  const strip = w / 5;
  for (let i = 0; i < 5; i++) {
    const dx = i - 2;
    const dy = Math.min(...CITY_RADIUS.filter(([ox]) => ox === dx).map(([, oy]) => oy));
    const t = getTile(state.map, city.x + dx, city.y + dy)?.terrain ?? ground;
    const x0 = i * strip;
    const x1 = x0 + strip;
    if (t !== ground && t !== Terrain.Mountains && t !== Terrain.Hills && t !== Terrain.Forest && t !== Terrain.Jungle) {
      const deep = t === Terrain.Ocean ? 14 : 10;
      patches.push({ terrain: t, pts: [Math.max(0, x0 - 8), HORIZON, Math.min(w, x1 + 8), HORIZON, Math.min(w, x1 + 2), HORIZON + deep, Math.max(0, x0 - 2), HORIZON + deep] });
    }
    if (t === Terrain.Mountains || t === Terrain.Hills) {
      for (let k = 0; k < 2; k++) {
        const r = hash(i, k, salt);
        const mountain = t === Terrain.Mountains;
        knolls.push({ kind: mountain ? "mountain" : "hill", x: x0 + (k + 0.5) * (strip / 2) + (r - 0.5) * 12, w: mountain ? 34 + r * 12 : 40 + r * 10, h: mountain ? 15 + r * 8 : 6 + r * 4 });
      }
    }
    if (t === Terrain.Forest || t === Terrain.Jungle)
      for (let x = x0 + 3; x < x1; x += 6 + hash(i, Math.round(x), salt) * 3) knolls.push({ kind: "tree", x, w: 7, h: 4 + hash(Math.round(x), i, salt) * 3 });
  }
  knolls.sort((a, b) => (a.kind === "tree" ? 1 : 0) - (b.kind === "tree" ? 1 : 0) || b.h - a.h);

  let river: number[] | null = null;
  if (tile?.river) {
    river = [];
    for (let x = -4; x <= w + 4; x += 16) river.push(x, HORIZON + 18 + Math.sin(x / 23 + city.id) * 3 + (hash(x, 0, salt) - 0.5) * 2);
  }

  // What stands in the city, row by row: a row takes lots up to the town's width, then the next.
  type Lot = { id: string; kind: SceneItem["kind"]; pic: Picture; key: number };
  const cap = w - 2 * MARGIN;
  const width = Math.min(cap, 60 + city.size * 26);
  const rows: Lot[][] = STREETS.map(() => []);
  const used = STREETS.map(() => 0);
  const put = (r: number, lot: Lot) => { rows[r]!.push(lot); used[r]! += lot.pic.w + GAP; };
  const place = (lot: Lot, order: number[], max: number): boolean => {
    const r = order.find((k) => used[k]! + lot.pic.w <= max);
    if (r === undefined) return false;
    put(r, lot);
    return true;
  };
  const least = () => used.indexOf(Math.min(...used));

  city.wonders.forEach((id, i) => {
    const p = PICTURES[id];
    if (p) {
      const lot = { id, kind: "wonder" as const, pic: p, key: 1 + hash(i, 1, salt) };
      if (!place(lot, [0, 1, 2, 3], cap)) put(least(), lot);
    }
  });
  const buildings = city.buildings.filter((b) => b !== "city_walls" && PICTURES[b]);
  if (buildings.includes("palace")) put(1, { id: "palace", kind: "building", pic: PICTURES.palace!, key: 0 });
  buildings.filter((b) => b !== "palace").forEach((id, i) => {
    const lot = { id, kind: "building" as const, pic: PICTURES[id]!, key: 1 + hash(i, 2, salt) };
    if (!place(lot, ROW_ORDER, width) && !place(lot, ROW_ORDER, cap)) put(least(), lot);
  });
  const homes = HOMES[homeAge(known)]!;
  for (let i = 0; i < 1 + city.size * 2; i++) {
    const lot = { id: "", kind: "home" as const, pic: homes[Math.floor(hash(i, 3, salt) * homes.length)]!, key: 1.2 + hash(i, 4, salt) };
    if (!place(lot, ROW_ORDER, width) && !place(lot, ROW_ORDER, cap)) break;
  }

  // Each row from the middle outward in order of its keys (the palace first), a street along it, trees beyond.
  const front = Math.max(0, ...rows.map((row, r) => (row.length ? r : 0)));
  const walls = city.buildings.includes("city_walls");
  const surface = knows(known, "automobile") ? "asphalt" : knows(known, "construction") ? "stone" : "dirt";
  const streets: CityScene["streets"] = [];
  const items: SceneItem[] = [];
  rows.forEach((row, r) => {
    const y = STREETS[r]!;
    // The first lot in the middle, then each on the lighter side, so the palace keeps to the middle.
    const [first, ...rest] = [...row].sort((a, b) => a.key - b.key);
    const placed: Lot[] = first ? [first] : [];
    let lean = 0;
    for (const lot of rest) {
      if (lean > 0) { placed.unshift(lot); lean -= lot.pic.w; } else { placed.push(lot); lean += lot.pic.w; }
    }
    const total = placed.reduce((n, l) => n + l.pic.w, 0);
    const gap = placed.length > 1 ? Math.min(GAP, (cap - total) / (placed.length - 1)) : 0;
    const span = total + gap * Math.max(0, placed.length - 1);
    const start = Math.round(MARGIN + (cap - span) / 2);
    const out: SceneItem[] = [];
    let x = start;
    for (const lot of placed) {
      out.push({ id: lot.id, kind: lot.kind, pic: lot.pic, x: Math.round(x), y });
      x += lot.pic.w + gap;
    }
    const spans: [number, number][] = placed.length ? [[MARGIN, start - 4], [Math.round(start + span) + 4, w - MARGIN]] : [[MARGIN, w - MARGIN]];
    if (placed.length) streets.push({ y, x0: Math.max(0, start - 6), x1: Math.min(w, Math.round(start + span) + 6), surface });
    // Rows outside the walls stay open ground.
    if (!(walls && r > front)) spans.forEach(([a, b], side) => {
      const n = Math.floor((b - a) / 18);
      for (let k = 0; k < n; k++) {
        const pick = hash(k, r * 2 + side, salt);
        if (pick < 0.3) continue;
        const tree = TREES[Math.floor(hash(r, k + side * 50, salt) * TREES.length)]!;
        const tx = a + ((k + 0.2 + hash(k, r, salt + 1) * 0.6) * (b - a)) / n - tree.w / 2;
        out.push({ id: "", kind: "tree", pic: tree, x: Math.round(Math.max(a, Math.min(b - tree.w, tx))), y: y - Math.floor(pick * 4) });
      }
    });
    items.push(...out);
  });
  // Walls just before the frontmost row that is built.
  if (walls) items.push({ id: "city_walls", kind: "walls", pic: wallRun(w - 2 * MARGIN), x: MARGIN, y: Math.min(h - 1, STREETS[front]! + 24) });
  items.sort((a, b) => a.y - b.y || a.x - b.x);

  const clouds = [0, 1, 2].map((i) => ({ x: (i + 0.3 + hash(i, 5, salt) * 0.5) * (w / 3), y: 8 + hash(i, 6, salt) * 16 }));
  return { w, h, horizon: HORIZON, clouds, ground, patches, knolls, river, streets, items };
}

/** The puffs of a cloud: offsets from its middle and radii. */
export const CLOUD_PUFFS = [[0, 0, 5], [5, -2, 6], [11, 0, 5], [6, 2, 4]] as const;

/** The improvement or wonder whose picture covers a point of the scene (front-most first), or null. */
export function sceneItemAt(scene: CityScene, x: number, y: number): SceneItem | null {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const it = scene.items[i]!;
    if (x >= it.x && x < it.x + it.pic.w && y >= it.y - it.pic.h && y < it.y) return it.id ? it : null;
  }
  return null;
}
