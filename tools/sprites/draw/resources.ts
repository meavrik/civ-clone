// Converts the user's resource sheet (resources.png, 2026-10-27: 8x3 icons of pixel art, 256 pixels a
// cell, each on a soft glow, in the order of NAMES) into packages/renderer-retro/src/art/resources.art.ts.
// Run from the repo root:
//   npx vite-node --script tools/sprites/draw/resources.ts [preview.png]
// Each cell becomes a 32x32 sprite, a cell's 8x8 pixels to one of the sprite's (the sheet's art pixel
// is about 16/3 of its pixels, so three of the art's pixels to two of ours; half that, two to one, was
// muddy), the icon centred:
// 1. the glow is cleared: flood from the cell's edge over pixels that change little from their
//    neighbour (the glow is smooth, the icons' edges sharp), and the specks of its noise it left;
// 2. each icon picks the five palette ramps (beside the fixed EGA colours) nearest its colours, and
//    every pixel of it takes the nearest of those colours;
// 3. a sprite pixel is the icon's where most of its block is, coloured by the block's commonest colour
//    (its middle weighing most), and on the silhouette's edge by the block's darkest colour of note,
//    so the outline stays one pixel and unbroken.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { C, PALETTE, shade } from "../../../packages/renderer-retro/src/palette.js";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const img = decodePng(new Uint8Array(readFileSync(here("./resources.png"))));
const NAMES = [
  "fish", "whales", "resources", "cotton", "horses", "wheat", "game", "silk",
  "coal", "wine", "gold", "iron", "oasis", "oil", "furs", "seals",
  "ivory", "peat", "spices", "gems", "fruit", "saltpeter",
];
const CELL = 256;
const N = 32;
/** The sheet's pixels across one of the sprite's: the cell is the map's square. */
const BLOCK = CELL / N;
/** Largest step between neighbouring pixels of the glow (its noise stays under 8). */
const SMOOTH = 10;
/** The derrick's black edge fades into a glow nearly as dark: a finer step keeps the flood out. */
const SMOOTH_FOR: Record<string, number> = { oil: 4 };

const W = img.width;
const rgbAt = (x: number, y: number): [number, number, number] => {
  const i = (y * W + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
};
const step = (a: readonly number[], b: readonly number[]) => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);

// OKLab, for nearest colours.
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function oklab([r8, g8, b8]: readonly number[]): [number, number, number] {
  const r = lin(r8!), g = lin(g8!), b = lin(b8!);
  const l = Math.cbrt(0.4122214708 * r + 0.5363015296 * g + 0.0514770479 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dist2 = (a: readonly number[], b: readonly number[]) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;

/** Legend characters: the fixed EGA colours, then each named ramp's. */
const FIXED: [string, number][] = [
  ["k", C.BLACK!], ["w", C.WHITE!], ["r", C.RED!], ["R", C.LRED!], ["y", C.YELLOW!], ["Y", C.BROWN!], ["u", C.BLUE!], ["U", C.LBLUE!],
  ["n", C.GREEN!], ["N", C.LGREEN!], ["i", C.CYAN!], ["I", C.LCYAN!], ["z", C.DGREY!], ["Z", C.LGREY!],
];
const RAMP_CHARS = ["01234567", "abcdefgh", "ABCDEFGH", "JKLMOQST", "jloqstvx"];
const RAMPS = [
  "ocean", "grass", "plains", "forest", "earth", "stone", "sand", "hide", "mire", "canopy", "flesh", "rock", "grey", "ice",
  "panel", "azure", "marble", "brick", "town", "sky", "meadow", "leaf", "mound", "wheat", "dune", "heath", "sea", "steel", "jewel", "skin",
];
const rampColours = (name: string) => Array.from({ length: name === "jewel" ? 6 : 8 }, (_, n) => shade(name, n));
const LAB = PALETTE.map((c) => oklab(c));

/** The cell's glow: true where the icon is not. */
function glowMask(x0: number, y0: number, smooth: number): Uint8Array {
  const glow = new Uint8Array(CELL * CELL);
  const stack: number[] = [];
  const at = (i: number) => rgbAt(x0 + (i % CELL), y0 + Math.floor(i / CELL));
  for (let k = 0; k < CELL; k++) for (const i of [k, (CELL - 1) * CELL + k, k * CELL, k * CELL + CELL - 1]) if (!glow[i]) { glow[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % CELL, y = Math.floor(i / CELL), c = at(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue;
      const j = ny * CELL + nx;
      if (glow[j] || step(c, at(j)) > smooth) continue;
      glow[j] = 1;
      stack.push(j);
    }
  }
  // Specks the flood left in the glow (its noise) go with it, and the tips of the next row's icons
  // (small pieces at the cell's edge).
  const seen = new Uint8Array(CELL * CELL);
  const pieces: { pixels: number[]; border: boolean }[] = [];
  for (let start = 0; start < CELL * CELL; start++) {
    if (glow[start] || seen[start]) continue;
    const piece: number[] = [start];
    seen[start] = 1;
    let border = false;
    for (let p = 0; p < piece.length; p++) {
      const i = piece[p]!;
      const x = i % CELL, y = Math.floor(i / CELL);
      if (Math.min(x, y, CELL - 1 - x, CELL - 1 - y) < EDGE) border = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue;
          const j = ny * CELL + nx;
          if (glow[j] || seen[j]) continue;
          seen[j] = 1;
          piece.push(j);
        }
    }
    pieces.push({ pixels: piece, border });
  }
  const largest = Math.max(...pieces.map((p) => p.pixels.length));
  for (const { pixels, border } of pieces)
    if (pixels.length < SPECK || (border && pixels.length < largest / 4)) for (const i of pixels) glow[i] = 1;
  return glow;
}
/** Pieces of the icon smaller than this (in the sheet's pixels) are taken for the glow's noise. */
const SPECK = 40;
/** Small pieces within this of the cell's edge are the tips of the next row's icons. */
const EDGE = 6;

/** The five ramps that serve an icon's colours best (greedy, then swaps until nothing improves). */
function pickRamps(labs: [number, number, number][]): string[] {
  const fixedD = labs.map((l) => Math.min(...FIXED.map(([, i]) => dist2(l, LAB[i]!))));
  const rampD = RAMPS.map((r) => { const cs = rampColours(r); return labs.map((l) => Math.min(...cs.map((i) => dist2(l, LAB[i]!)))); });
  const cost = (set: number[]) => labs.reduce((s, _, p) => s + Math.min(fixedD[p]!, ...set.map((r) => rampD[r]![p]!)), 0);
  const set: number[] = [];
  for (let k = 0; k < 5; k++) {
    let best = -1, bestC = Infinity;
    for (let r = 0; r < RAMPS.length; r++) if (!set.includes(r)) { const c = cost([...set, r]); if (c < bestC) { bestC = c; best = r; } }
    set.push(best);
  }
  for (let better = true; better;) {
    better = false;
    const now = cost(set);
    for (let k = 0; k < set.length && !better; k++)
      for (let r = 0; r < RAMPS.length && !better; r++) {
        if (set.includes(r)) continue;
        const trial = set.slice(); trial[k] = r;
        if (cost(trial) < now - 1e-9) { set.splice(0, set.length, ...trial); better = true; }
      }
  }
  return set.map((r) => RAMPS[r]!);
}

interface Converted { name: string; ramps: string[]; rows: string[]; pixels: Int16Array }

function convert(name: string, cell: number): Converted {
  const x0 = (cell % 8) * CELL, y0 = Math.floor(cell / 8) * CELL;
  const glow = glowMask(x0, y0, SMOOTH_FOR[name] ?? SMOOTH);
  let minX = CELL, minY = CELL, maxX = -1, maxY = -1;
  const samples: [number, number, number][] = [];
  const colour = new Map<number, [number, number, number]>();
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      if (glow[y * CELL + x]) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const lab = oklab(rgbAt(x0 + x, y0 + y));
      colour.set(y * CELL + x, lab);
      if ((x + y) % 3 === 0) samples.push(lab);
    }
  const ramps = pickRamps(samples);
  // The legend: palette index -> character.
  const legend = new Map<number, string>();
  for (const [ch, i] of FIXED) legend.set(i, ch);
  ramps.forEach((r, k) => rampColours(r).forEach((i, n) => legend.set(i, RAMP_CHARS[k]![n]!)));
  const allowed = [...legend.keys()];
  const nearest = (lab: readonly number[]) => allowed.reduce((b, i) => (dist2(lab, LAB[i]!) < dist2(lab, LAB[b]!) ? i : b), allowed[0]!);
  // The sprite's blocks, the icon centred.
  const ox = (minX + maxX + 1) / 2 - (N / 2) * BLOCK, oy = (minY + maxY + 1) / 2 - (N / 2) * BLOCK;
  if (Math.max(maxX - minX + 1, maxY - minY + 1) > (N - 2) * BLOCK) console.warn(`${name}: icon ${maxX - minX + 1}x${maxY - minY + 1} fills its square`);
  const votes: Map<number, number>[] = [];
  const cover = new Float32Array(N * N);
  const sigma = BLOCK * 0.3;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const v = new Map<number, number>();
      let n = 0, all = 0;
      const left = ox + i * BLOCK, top = oy + j * BLOCK;
      const cx = left + BLOCK / 2, cy = top + BLOCK / 2;
      // The sheet's pixels whose middles fall in the block.
      for (let y = Math.ceil(top - 0.5); y + 0.5 < top + BLOCK; y++)
        for (let x = Math.ceil(left - 0.5); x + 0.5 < left + BLOCK; x++) {
          all++;
          if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue;
          const lab = colour.get(y * CELL + x);
          if (!lab) continue;
          n++;
          const w = Math.exp(-((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (2 * sigma ** 2));
          const p = nearest(lab);
          v.set(p, (v.get(p) ?? 0) + w);
        }
      votes.push(v);
      cover[j * N + i] = n / all;
    }
  const pixels = new Int16Array(N * N).fill(-1);
  for (let k = 0; k < N * N; k++) {
    if (cover[k]! < COVER) continue;
    pixels[k] = [...votes[k]!.entries()].reduce((b, e) => (e[1] > b[1] ? e : b))[0];
  }
  // The silhouette's edge takes the block's darkest colour of note.
  const edge = (k: number) => {
    const i = k % N, j = Math.floor(k / N);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const x = i + dx!, y = j + dy!;
      return x < 0 || y < 0 || x >= N || y >= N || pixels[y * N + x] === -1;
    });
  };
  const out = pixels.slice();
  for (let k = 0; k < N * N; k++) {
    if (pixels[k] === -1 || !edge(k)) continue;
    const v = votes[k]!;
    const total = [...v.values()].reduce((s, w) => s + w, 0);
    let dark = pixels[k]!;
    for (const [p, w] of v) if (w >= total * OUTLINE_SHARE && LAB[p]![0] < LAB[dark]![0]) dark = p;
    out[k] = dark;
  }
  const rows = Array.from({ length: N }, (_, j) => Array.from({ length: N }, (_, i) => { const p = out[j * N + i]!; return p === -1 ? "." : legend.get(p)!; }).join(""));
  return { name, ramps, rows, pixels: out };
}
/** Share of a block the icon must cover to show. */
const COVER = 0.45;
/** Share of an edge block a darker colour needs to become its outline. */
const OUTLINE_SHARE = 0.2;

const sprites = NAMES.map((name, cell) => convert(name, cell));

// A preview, 8 sprites across, each 6x on mid grey, if asked for.
const preview = process.argv[2];
if (preview) {
  const S = 6, PAD = 4, cols = 8, rows = Math.ceil(sprites.length / cols);
  const w = cols * (N * S + PAD), h = rows * (N * S + PAD);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([96, 104, 88, 255], i * 4);
  sprites.forEach((s, n) => {
    const bx = (n % cols) * (N * S + PAD), by = Math.floor(n / cols) * (N * S + PAD);
    for (let y = 0; y < N * S; y++)
      for (let x = 0; x < N * S; x++) {
        const p = s.pixels[Math.floor(y / S) * N + Math.floor(x / S)]!;
        if (p !== -1) data.set([...PALETTE[p]!, 255], ((by + y) * w + bx + x) * 4);
      }
  });
  writeFileSync(preview, encodePng({ width: w, height: h, data }));
}

const header = [
  "# Special resources, 32x32: two pixels to each screen pixel, drawn over the terrain.",
  "# Legend: . clear  k black  w white  r/R red  y yellow  Y brown  u/U blue  n/N green  i/I cyan  z/Z grey;",
  "#   0-7, a-h, A-H, JKLMOQST, jloqstvx the shades of the ramps each sprite names (jewel has six).",
  "# The user's resource sheet of 2026-10-27 (22 icons), converted by tools/sprites/draw/resources.ts",
  "# from resources.png: each icon at two thirds of its art's pixels, in the palette's nearest colours.",
  "# Grassland's resources are a buffalo.",
];
const file = `// resources sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.
// Every character must be in the legend described in the comment lines below.
export default String.raw\`
${header.join("\n")}

${sprites.map((s) => `@${s.name} ramps=${s.ramps.join(",")}\n${s.rows.join("\n")}\n`).join("\n")}\`;
`;
writeFileSync(here("../../../packages/renderer-retro/src/art/resources.art.ts"), file);
console.log(`wrote resources.art.ts (${sprites.length} sprites)`);
for (const s of sprites) console.log(`  ${s.name}: ${s.ramps.join(",")}`);
