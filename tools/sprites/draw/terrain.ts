// Converts the user's terrain sheet (terrain.png, 2026-11-02: 5x4 tiles of pixel art on a dark ground, each about
// 265 pixels a side and about 32 of its art's pixels across; not an even grid, the rows 246 to 284 pixels tall)
// into packages/renderer-retro/src/art/terrain.art.ts.
// Run from the repo root:
//   npx vite-node --script tools/sprites/draw/terrain.ts [preview.png]
// Each tile becomes a 32x32 sprite (the map's square, as fine as the screen):
// 1. the tiles are the sheet's boxes between the dark gutters (the gutters' colour is the sheet's corner);
// 2. each tile picks the five palette ramps (beside the fixed EGA colours and orange) nearest its colours, and every
//    pixel of it takes the nearest of those colours, but a pixel near the tile's ground (its commonest colour) is
//    that ground: the sheet's grounds are mottled (the grass in two greens 8 apart, which the palette would set 22
//    apart; the deep sea between two of its blues), so each ground is one colour; the tiles standing on the
//    grassland's ground take the grassland's, so they blend with grassland seamlessly;
// 3. the tile's box is cut into 32x32 blocks, each the commonest colour of its pixels, its middle weighing most
//    (the art's own pixels are uneven, 7 to 10 of the sheet's, so a block rarely lies on one exactly).
// The sheet's river tile is not a sprite: rivers are drawn in code (`terrainSquare`), in the tile's blues.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { C, PALETTE, shade } from "../../../packages/renderer-retro/src/palette.js";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const img = decodePng(new Uint8Array(readFileSync(here("./terrain.png"))));
/** The sheet's tiles, row by row; null where a tile is not a sprite (the river). */
const NAMES: (string | null)[][] = [
  ["grassland", "plains", "desert", "tundra", "swamp"],
  ["forest", "forest_pine", "forest_birch", "forest_autumn", "jungle"],
  ["hills", "mountains", "mountains_snow", "mountains_red", "mountains_ice"],
  ["ocean", "deep_ocean", null, "arctic", "forest_mixed"],
];
/** Tiles standing on the grassland's ground (`GROUND` in tiles.ts). */
const ON_GRASS = new Set(["grassland", "forest", "forest_pine", "forest_birch", "forest_autumn", "forest_mixed", "hills", "mountains", "mountains_snow", "mountains_red"]);
const N = 32;

const W = img.width;
const H = img.height;
const rgbAt = (x: number, y: number): [number, number, number] => { const i = (y * W + x) * 4; return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!]; };

// 1. The tiles' boxes: runs of columns and rows mostly not the gutters' colour, each edge then drawn in past any line
// of the tile that is still mostly gutter.
const GUTTER = rgbAt(0, 0);
const gutter = (x: number, y: number) => { const [r, g, b] = rgbAt(x, y); return Math.abs(r - GUTTER[0]) + Math.abs(g - GUTTER[1]) + Math.abs(b - GUTTER[2]) < 40; };
function spans(n: number, across: number, at: (k: number, t: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let k = 0; k <= n; k++) {
    let g = 0;
    if (k < n) for (let t = 0; t < across; t++) if (at(k, t)) g++;
    const inTile = k < n && g < across * 0.6;
    if (inTile && start < 0) start = k;
    if (!inTile && start >= 0) { if (k - start > 64) out.push([start, k - 1]); start = -1; }
  }
  return out;
}
const cols = spans(W, H, (x, y) => gutter(x, y));
const rows = spans(H, W, (y, x) => gutter(x, y));
if (cols.length !== NAMES[0]!.length || rows.length !== NAMES.length) throw new Error(`found ${cols.length}x${rows.length} tiles, expected ${NAMES[0]!.length}x${NAMES.length}`);
interface Box { x0: number; y0: number; x1: number; y1: number }
function box(c: number, r: number): Box {
  let [x0, x1] = cols[c]!;
  let [y0, y1] = rows[r]!;
  const colG = (x: number) => { let g = 0; for (let y = y0; y <= y1; y++) if (gutter(x, y)) g++; return g / (y1 - y0 + 1); };
  const rowG = (y: number) => { let g = 0; for (let x = x0; x <= x1; x++) if (gutter(x, y)) g++; return g / (x1 - x0 + 1); };
  for (let moved = true; moved;) {
    moved = false;
    if (colG(x0) > 0.5) { x0++; moved = true; }
    if (colG(x1) > 0.5) { x1--; moved = true; }
    if (rowG(y0) > 0.5) { y0++; moved = true; }
    if (rowG(y1) > 0.5) { y1--; moved = true; }
  }
  return { x0, y0, x1, y1 };
}

// OKLab, for nearest colours.
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function oklab([r8, g8, b8]: readonly number[]): [number, number, number] {
  const r = lin(r8!), g = lin(g8!), b = lin(b8!);
  const l = Math.cbrt(0.4122214708 * r + 0.5363015296 * g + 0.0514770479 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/**
 * Lightness counts for less than hue and colourfulness: the palette lacks some of the sheet's colours (deep orange,
 * the birches' lime), and a colour of the right hue a shade off reads truer than one of the right lightness and
 * another hue (the autumn's oranges came out salmon).
 */
const L_WEIGHT = 0.5;
const labDist2 = (a: readonly number[], b: readonly number[]) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
const dist2 = (a: readonly number[], b: readonly number[]) => L_WEIGHT * (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;

/** Legend characters: the fixed EGA colours, then each named ramp's. */
const FIXED: [string, number][] = [
  ["k", C.BLACK!], ["w", C.WHITE!], ["y", C.YELLOW!], ["Y", C.BROWN!], ["u", C.BLUE!], ["U", C.LBLUE!],
  ["n", C.GREEN!], ["N", C.LGREEN!], ["i", C.CYAN!], ["I", C.LCYAN!], ["z", C.DGREY!], ["Z", C.LGREY!], ["m", C.ORANGE!],
];
const RAMP_CHARS = ["01234567", "abcdefgh", "ABCDEFGH", "JKLMOQST", "jloqstvx"];
const RAMPS = [
  "ocean", "grass", "plains", "forest", "earth", "stone", "sand", "hide", "mire", "canopy", "flesh", "rock", "grey", "ice",
  "marble", "brick", "sky", "meadow", "leaf", "mound", "wheat", "dune", "heath", "sea", "steel",
];
const rampColours = (name: string) => Array.from({ length: 8 }, (_, n) => shade(name, n));
const LAB = PALETTE.map((c) => oklab(c));

/** The five ramps that serve a tile's colours best, starting from `fixed` (greedy, then swaps until nothing improves). */
function pickRamps(labs: [number, number, number][], fixed: string[]): string[] {
  const fixedD = labs.map((l) => Math.min(...FIXED.map(([, i]) => dist2(l, LAB[i]!))));
  const rampD = RAMPS.map((r) => { const cs = rampColours(r); return labs.map((l) => Math.min(...cs.map((i) => dist2(l, LAB[i]!)))); });
  const cost = (set: number[]) => labs.reduce((s, _, p) => s + Math.min(fixedD[p]!, ...set.map((r) => rampD[r]![p]!)), 0);
  const kept = fixed.map((r) => RAMPS.indexOf(r));
  const set: number[] = [...kept];
  while (set.length < 5) {
    let best = -1, bestC = Infinity;
    for (let r = 0; r < RAMPS.length; r++) if (!set.includes(r)) { const c = cost([...set, r]); if (c < bestC) { bestC = c; best = r; } }
    set.push(best);
  }
  for (let better = true; better;) {
    better = false;
    const now = cost(set);
    for (let k = kept.length; k < set.length && !better; k++)
      for (let r = 0; r < RAMPS.length && !better; r++) {
        if (set.includes(r)) continue;
        const trial = set.slice(); trial[k] = r;
        if (cost(trial) < now - 1e-9) { set.splice(0, set.length, ...trial); better = true; }
      }
  }
  return set.map((r) => RAMPS[r]!);
}

interface Converted { name: string; ramps: string[]; rows: string[]; pixels: Int16Array; box: Box }

/** The commonest colour of the sheet's pixels in a box, to a few levels. */
function sheetCommonest(b: Box): [number, number, number] {
  const n = new Map<number, number>();
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const [r, g, bl] = rgbAt(x, y); const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (bl >> 2); n.set(k, (n.get(k) ?? 0) + 1); }
  const k = [...n.entries()].reduce((a, e) => (e[1] > a[1] ? e : a))[0];
  return [((k >> 12) & 63) * 4 + 2, ((k >> 6) & 63) * 4 + 2, (k & 63) * 4 + 2];
}

/** How near (OKLab, lightness weighed in full) a colour must be to a tile's ground to be that ground. */
const GROUND_SNAP = 0.035;

function convert(name: string, b: Box, fixed: string[], ground: { lab: [number, number, number]; index?: number } = { lab: oklab(sheetCommonest(b)) }): Converted {
  const labs: [number, number, number][] = [];
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if ((x + y) % 3 === 0) labs.push(oklab(rgbAt(x, y)));
  const ramps = pickRamps(labs, fixed);
  // The legend: palette index -> character.
  const legend = new Map<number, string>();
  for (const [ch, i] of FIXED) legend.set(i, ch);
  ramps.forEach((r, k) => rampColours(r).forEach((i, n) => legend.set(i, RAMP_CHARS[k]![n]!)));
  const allowed = [...legend.keys()];
  const nearestOf = (lab: readonly number[]) => allowed.reduce((best, i) => (dist2(lab, LAB[i]!) < dist2(lab, LAB[best]!) ? i : best), allowed[0]!);
  const groundIndex = ground.index ?? nearestOf(ground.lab);
  const near = new Map<number, number>();
  const nearest = (x: number, y: number) => {
    const [r, g, bl] = rgbAt(x, y);
    const key = (r << 16) | (g << 8) | bl;
    let p = near.get(key);
    if (p === undefined) {
      const lab = oklab([r, g, bl]);
      p = labDist2(lab, ground.lab) < GROUND_SNAP ** 2 ? groundIndex : nearestOf(lab);
      near.set(key, p);
    }
    return p;
  };
  const bw = (b.x1 - b.x0 + 1) / N, bh = (b.y1 - b.y0 + 1) / N;
  const pixels = new Int16Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const left = b.x0 + i * bw, top = b.y0 + j * bh;
      const cx = left + bw / 2, cy = top + bh / 2;
      const votes = new Map<number, number>();
      for (let y = Math.ceil(top - 0.5); y + 0.5 < top + bh; y++)
        for (let x = Math.ceil(left - 0.5); x + 0.5 < left + bw; x++) {
          const w = Math.exp(-(((x + 0.5 - cx) / bw) ** 2 + ((y + 0.5 - cy) / bh) ** 2) / (2 * 0.3 ** 2));
          const p = nearest(x, y);
          votes.set(p, (votes.get(p) ?? 0) + w);
        }
      pixels[j * N + i] = [...votes.entries()].reduce((best, e) => (e[1] > best[1] ? e : best))[0];
    }
  const rows = Array.from({ length: N }, (_, j) => Array.from({ length: N }, (_, i) => legend.get(pixels[j * N + i]!)!).join(""));
  return { name, ramps, rows, pixels, box: b };
}

/** The palette colour most of a sprite is. */
const commonest = (s: Converted) => {
  const n = new Map<number, number>();
  for (const p of s.pixels) n.set(p, (n.get(p) ?? 0) + 1);
  return [...n.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
};

// The grassland first: its ground is the ground of everything standing on grass.
const grassland = convert("grassland", box(0, 0), []);
const grass = { lab: oklab(sheetCommonest(grassland.box)), index: commonest(grassland) };
const grassRamp = RAMPS.find((r) => rampColours(r).includes(grass.index))!;
const sprites: Converted[] = [];
NAMES.forEach((row, r) =>
  row.forEach((name, c) => {
    if (name === "grassland") sprites.push(grassland);
    else if (name) sprites.push(ON_GRASS.has(name) ? convert(name, box(c, r), [grassRamp], grass) : convert(name, box(c, r), []));
  }),
);

// A preview, if asked for: each tile as the sheet has it beside its sprite at six times, on the gutters' colour.
const preview = process.argv[2];
if (preview) {
  const S = 6, SIDE = N * S, PAD = 8, cols = 4;
  const w = cols * (2 * SIDE + 3 * PAD), h = Math.ceil(sprites.length / cols) * (SIDE + PAD) + PAD;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...GUTTER, 255], i * 4);
  sprites.forEach((s, n) => {
    const bx = (n % cols) * (2 * SIDE + 3 * PAD) + PAD, by = Math.floor(n / cols) * (SIDE + PAD) + PAD;
    const { x0, y0, x1, y1 } = s.box;
    for (let y = 0; y < SIDE; y++)
      for (let x = 0; x < SIDE; x++) {
        const sx = x0 + Math.floor((x / SIDE) * (x1 - x0 + 1)), sy = y0 + Math.floor((y / SIDE) * (y1 - y0 + 1));
        data.set([...rgbAt(sx, sy), 255], ((by + y) * w + bx + x) * 4);
        data.set([...PALETTE[s.pixels[Math.floor(y / S) * N + Math.floor(x / S)]!]!, 255], ((by + y) * w + bx + SIDE + PAD + x) * 4);
      }
  });
  writeFileSync(preview, encodePng({ width: w, height: h, data }));
}

const header = [
  "# Terrain, 32x32, opaque: two pixels to each screen pixel, so a 16-pixel square shows twice the detail.",
  "# Legend: k black  w white  r/R red  y yellow  Y brown  u/U blue  n/N green  i/I cyan  z/Z grey  m orange;",
  "#   0-7, a-h, A-H, JKLMOQST, jloqstvx the shades of the ramps each sprite names (dark to light).",
  "# The user's terrain sheet of 2026-11-02, converted by tools/sprites/draw/terrain.ts from terrain.png: each tile",
  "# on a 32x32 grid, in the palette's nearest colours. deep_ocean is open sea, water with no land beside it.",
  "# Forests and mountains come in kinds, drawn by the climate round them (terrainVariant in renderer-api):",
  "# forest (broadleaf), forest_pine, forest_birch, forest_autumn, forest_mixed; mountains (grey), mountains_snow,",
  "# mountains_red, mountains_ice (on the ice's ground).",
];
const file = `// terrain sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.
// Every character must be in the legend described in the comment lines below.
export default String.raw\`
${header.join("\n")}

${sprites.map((s) => `@${s.name} ramps=${s.ramps.join(",")}\n${s.rows.join("\n")}\n`).join("\n")}\`;
`;
writeFileSync(here("../../../packages/renderer-retro/src/art/terrain.art.ts"), file);
console.log(`wrote terrain.art.ts (${sprites.length} sprites)`);
for (const s of sprites) console.log(`  ${s.name}: ${s.ramps.join(",")}  box ${s.box.x0},${s.box.y0}-${s.box.x1},${s.box.y1}  ground ${commonest(s)}`);
