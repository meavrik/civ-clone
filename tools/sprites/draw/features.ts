// Draws the features sheet (city, walls, walls_front, hut, mine) as layered pixel art in the
// terrain's manner: lit from the upper left, two or three flat shades a face, each thing outlined
// one pixel in the darkest of its own colours, layers back to front so a dark line parts them.
// Run from the repo root: npx vite-node --script tools/sprites/draw/features.ts
// Rewrites packages/renderer-retro/src/art/features.art.ts; the art text stays the source the game reads.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const N = 32;
type G = string[][];
const blank = (): G => Array.from({ length: N }, () => Array<string>(N).fill("."));
const get = (g: G, x: number, y: number): string => (x < 0 || y < 0 || x >= N || y >= N ? "." : g[y]![x]!);
const put = (g: G, x: number, y: number, c: string): void => { if (x >= 0 && y >= 0 && x < N && y < N) g[y]![x] = c; };
const rect = (g: G, x0: number, y0: number, x1: number, y1: number, c: string): void => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, c);
};
/** Pixels of the layer beside a clear pixel take the outline colour of their own shade. */
const outline = (g: G, map: Record<string, string>): G => {
  const o = g.map((r) => [...r]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = g[y]![x]!;
      if (c === ".") continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(g, x + dx!, y + dy!) === ".");
      if (edge && map[c] !== undefined) o[y]![x] = map[c]!;
    }
  return o;
};
const over = (base: G, layer: G): void => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (layer[y]![x] !== ".") base[y]![x] = layer[y]![x]!;
};
const text = (g: G): string => g.map((r) => r.join("")).join("\n");

// ---- city: ramps=brick,hide,rock (0-7 roof tiles, a-h plaster and timber, A-H stone) ----------------

/**
 * A house from the front and a little above: a pitched roof seen as a gable, the slope toward the
 * light bright and the other dark, over a short plastered wall with a door.
 */
function house(x0: number, y0: number, w: number, roofRows: number, wallRows: number, thatch = false): G {
  const g = blank();
  const cx = x0 + (w - 1) / 2;
  const [lit, ridge, dark, gleam] = thatch ? ["f", "e", "d", "g"] : ["6", "5", "4", "7"];
  for (let k = 0; k < roofRows; k++) {
    const half = Math.min((w - 1) / 2, k);
    for (let x = cx - half; x <= cx + half; x++) put(g, x, y0 + k, x < cx ? lit! : x === cx ? ridge! : dark!);
  }
  put(g, cx - 1, y0 + 2, gleam!);
  put(g, cx - 2, y0 + 3, gleam!);
  const wy0 = y0 + roofRows;
  const wy1 = wy0 + wallRows - 1;
  rect(g, x0 + 1, wy0, x0 + w - 2, wy1, "g");
  rect(g, x0 + w - 3, wy0, x0 + w - 2, wy1, "f");
  rect(g, x0 + 1, wy0, x0 + w - 2, wy0, "f");
  const dw = w >= 9 ? 1 : 0;
  rect(g, cx - dw, wy1 - 1, cx, wy1, "b");
  return outline(g, { "7": "0", "6": "0", "5": "0", "4": "0", g: "a", f: "a", e: "a", d: "a", b: "a" });
}

/** A longer house, its ridge running left to right: the whole front slope faces the light. */
function longHouse(x0: number, y0: number, w: number, roofRows: number, wallRows: number, thatch = false): G {
  const g = blank();
  const [lit, mid, eave, gleam] = thatch ? ["f", "e", "d", "g"] : ["6", "5", "4", "7"];
  for (let k = 0; k < roofRows; k++) {
    const ins = Math.max(0, 2 - k);
    rect(g, x0 + ins, y0 + k, x0 + w - 1 - ins, y0 + k, k === 0 ? lit! : k === roofRows - 1 ? eave! : mid!);
  }
  rect(g, x0 + 3, y0, x0 + 4, y0, gleam!);
  const wy0 = y0 + roofRows;
  const wy1 = wy0 + wallRows - 1;
  rect(g, x0 + 1, wy0, x0 + w - 2, wy1, "g");
  rect(g, x0 + w - 3, wy0, x0 + w - 2, wy1, "f");
  rect(g, x0 + 1, wy0, x0 + w - 2, wy0, "f");
  const dx = x0 + Math.floor(w / 2);
  rect(g, dx, wy1 - 1, dx + 1, wy1, "b");
  rect(g, x0 + 2, wy0 + 1, x0 + 2, wy0 + 1, "A");
  return outline(g, { "7": "0", "6": "0", "5": "0", "4": "0", g: "a", f: "a", e: "a", d: "a", b: "a" });
}

/** A stone tower with battlements, its right side in shade, an arched door at the foot. */
function tower(x0: number, y0: number, w: number, h: number, door: boolean, slit: boolean): G {
  const g = blank();
  for (let x = x0; x < x0 + w; x++) if ((x - x0) % 3 !== 2) rect(g, x, y0, x, y0 + 1, "E");
  rect(g, x0, y0 + 2, x0 + w - 1, y0 + h - 1, "E");
  rect(g, x0 + w - 2, y0 + 2, x0 + w - 1, y0 + h - 1, "C");
  rect(g, x0, y0 + 2, x0 + w - 3, y0 + 2, "G");
  for (const [mx, my] of [[1, 5], [3, 7], [2, 10], [4, 12], [1, 14]] as const) if (my < h - 6 && mx < w - 2) put(g, x0 + mx, y0 + my, "D");
  const cx = x0 + Math.floor((w - 2) / 2);
  if (slit) rect(g, cx, y0 + 4, cx, y0 + 6, "A");
  if (door) {
    rect(g, cx - 1, y0 + h - 4, cx + 1, y0 + h - 1, "A");
    put(g, cx, y0 + h - 5, "A");
  }
  return outline(g, { E: "A", C: "A", G: "A", D: "A" });
}

/** The owner's banner on a pole, flying to the right. */
function banner(px: number, top: number, poleH: number): G {
  const g = blank();
  rect(g, px, top, px, top + poleH - 1, "b");
  const widths = [7, 7, 6, 4];
  widths.forEach((wd, r) => {
    rect(g, px + 1, top + r, px + wd, top + r, r === widths.length - 1 ? "p" : "P");
    put(g, px + wd, top + r, "p");
  });
  return g;
}

function city(): G {
  const g = blank();
  over(g, longHouse(0, 6, 10, 4, 3));
  over(g, house(23, 5, 9, 5, 3));
  over(g, tower(10, 2, 12, 13, true, true));
  over(g, banner(15, 0, 4));
  over(g, house(1, 14, 9, 5, 3));
  over(g, longHouse(22, 16, 10, 4, 3));
  over(g, longHouse(11, 15, 11, 4, 3));
  over(g, house(2, 23, 7, 4, 3, true));
  over(g, longHouse(23, 24, 9, 3, 3, true));
  return g;
}

/** A wall ring with the corners cut, three courses thick: walkway, face and foot, merlons front and back. */
function octRing(front: boolean): G {
  const band = blank();
  const inside = (x: number, y: number): boolean => x + y >= 4 && (31 - x) + y >= 4 && x + (31 - y) >= 4 && (31 - x) + (31 - y) >= 4;
  for (let y = 1; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      const top = y >= 1 && y <= 4;
      const bottom = y >= 27;
      const left = x <= 2;
      const right = x >= 29;
      if (!(top || bottom || left || right)) continue;
      if (front ? y < 20 : y >= 20) continue;
      let c = "E";
      if (top) c = y === 1 ? ((x % 3) !== 2 ? "E" : ".") : y === 2 ? "F" : y === 4 ? "D" : "E";
      else if (bottom) c = y === 27 ? ((x % 3) !== 2 ? "E" : ".") : y === 28 ? "F" : y === 31 ? "D" : "E";
      else if (left) c = x === 0 ? "F" : "E";
      else if (right) c = x === 31 ? "D" : x === 30 ? "D" : "E";
      if (c !== ".") put(band, x, y, c);
    }
  const b = outline(band, { E: "A", F: "A", D: "A" });
  if (front) {
    rect(b, 13, 28, 18, 31, "A");
    rect(b, 14, 27, 17, 27, "A");
  }
  return b;
}

// ---- hut: ramps=hide,wheat,brick (0-7 timber and mud, a-h straw, A-H embers) -------------------------

/** A round hut: a cone of thatch, lit on the left, over a mud wall with a dark doorway. */
function hut(cx: number, yTop: number, yBase: number, r: number): G {
  const g = blank();
  for (let y = yTop; y <= yBase; y++) {
    const t = (y - yTop) / (yBase - yTop);
    const half = Math.round(r * t);
    for (let x = cx - half; x <= cx + half; x++) {
      const u = half === 0 ? 0 : (x - cx) / half;
      put(g, x, y, u < -0.3 ? "g" : u < 0.35 ? "e" : "c");
    }
  }
  for (let y = yTop + 3; y < yBase; y += 3) {
    const half = Math.round((r * (y - yTop)) / (yBase - yTop));
    put(g, cx + 1, y, "b");
    put(g, cx + half - 2, y, "b");
  }
  const wy0 = yBase + 1;
  const wy1 = yBase + 4;
  rect(g, cx - r + 2, wy0, cx + r - 2, wy1, "5");
  rect(g, cx + r - 4, wy0, cx + r - 2, wy1, "4");
  rect(g, cx - 1, wy0 + 1, cx, wy1, "1");
  return outline(g, { g: "1", e: "1", c: "1", b: "1", "5": "0", "4": "0", "1": "0" });
}

function fire(cx: number, yb: number): G {
  const g = blank();
  rect(g, cx - 3, yb, cx + 3, yb, "2");
  rect(g, cx - 2, yb - 1, cx + 2, yb - 1, "1");
  rect(g, cx - 2, yb - 3, cx + 2, yb - 2, "R");
  rect(g, cx - 1, yb - 4, cx + 1, yb - 3, "y");
  put(g, cx, yb - 2, "y");
  put(g, cx, yb - 5, "R");
  put(g, cx + 1, yb - 6, "R");
  return outline(g, { R: "r", "2": "0", "1": "0" });
}

function village(): G {
  const g = blank();
  over(g, hut(8, 3, 10, 6));
  over(g, hut(24, 5, 12, 6));
  over(g, hut(14, 15, 23, 7));
  over(g, fire(26, 28));
  return g;
}

// ---- mine: ramps=rock,hide,steel ----------------------------------------------------------------------

function mine(): G {
  const g = blank();
  const mound = blank();
  const bumps: [number, number, number][] = [[16, 9, 29], [9, 6, 29], [23, 6, 29]];
  for (let y = 12; y <= 29; y++)
    for (let x = 2; x <= 29; x++) {
      let best: [number, number] | null = null;
      // A ragged top: each column's rock rises or falls a pixel.
      const jag = ((x * 7 + 3) % 5) - 2 > 0 ? 1 : ((x * 7 + 3) % 5) - 2 < 0 ? -1 : 0;
      for (const [cx, r, base] of bumps) {
        const dx = (x - cx) / r;
        const dy = (y + jag * 0.5 - base) / r;
        if (dx * dx + dy * dy > 1) continue;
        const v = (y - (base - r)) / r;
        if (!best || r > best[1]) best = [dx, r, v] as unknown as [number, number];
        best = [dx, v];
      }
      if (!best) continue;
      const [u, v] = best;
      put(mound, x, y, u > 0.4 && v > 0.3 ? "1" : u < -0.15 || v < 0.3 ? "4" : "3");
    }
  for (const [sx, sy] of [[7, 25], [12, 21], [20, 21], [25, 25], [16, 24], [10, 27], [23, 27]] as const) put(mound, sx, sy, "2");
  for (const [sx, sy] of [[9, 23], [10, 24], [19, 19], [20, 20], [25, 23]] as const) put(mound, sx, sy, "1");
  const o = outline(mound, { "4": "0", "3": "0", "2": "0", "1": "0" });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (o[y]![x] === "4" && get(o, x - 1, y - 1) === "0") o[y]![x] = "5";
  over(g, o);
  const shaft = blank();
  rect(shaft, 12, 22, 19, 23, "d");
  rect(shaft, 12, 24, 13, 29, "c");
  rect(shaft, 18, 24, 19, 29, "c");
  rect(shaft, 14, 24, 17, 29, "A");
  over(g, outline(shaft, { d: "a", c: "a" }));
  // An ore cart by the entrance.
  const cart = blank();
  rect(cart, 22, 26, 26, 28, "c");
  rect(cart, 23, 25, 25, 25, "F");
  put(cart, 24, 25, "G");
  rect(cart, 22, 29, 22, 29, "A");
  rect(cart, 26, 29, 26, 29, "A");
  over(g, outline(cart, { c: "a", F: "a", G: "a" }));
  return g;
}

const sprites: [string, string, G][] = [
  ["city", "brick,hide,rock", city()],
  ["walls", "brick,hide,rock", octRing(false)],
  ["walls_front", "brick,hide,rock", octRing(true)],
  ["hut", "hide,wheat,brick", village()],
  ["mine", "rock,hide,steel", mine()],
];

const header = [
  "# Features, 32x32: two pixels to each screen pixel, drawn over the map, in the terrain's manner: lit",
  "# from the upper left, flat two- and three-shade faces, each thing outlined one pixel in the darkest of",
  "# its own colours. The city stands free on its square: a stone keep flying the owner's banner (P/p)",
  "# among tile-roofed houses; walled, the wall ring goes behind it (walls) and before it (walls_front),",
  "# its gate where the size plate hangs. The village (hut) is thatched round huts about a fire; the mine",
  "# a rock mound with a timber-framed shaft. Special resources are in the resources sheet.",
  "# Legend: . clear  k black  w white  P/p owner colour/dark",
  "#   r/R red  y yellow  Y brown  u/U blue  n/N green  i/I cyan  z/Z grey (EGA)",
  "#   0-7 shades of ramp 1, a-h of ramp 2, A-H of ramp 3. Default ramps: earth, stone, grey.",
];
const body = sprites.map(([name, ramps, g]) => `@${name} ramps=${ramps}\n${text(g)}\n`).join("\n");
const file = `// features sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.
// Every character must be in the legend described in the comment lines below.
export default String.raw\`
${header.join("\n")}

${body}\`;
`;
const target = resolve(fileURLToPath(new URL("../../../packages/renderer-retro/src/art/features.art.ts", import.meta.url)));
writeFileSync(target, file);
console.log("wrote features.art.ts");
