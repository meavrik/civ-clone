// Converts the user's portraits (2026-10-22) into the retro renderer's sheets. Run from the repo root:
//   npx vite-node --script tools/sprites/draw/rulers.ts
// rulers/*.png beside this file are the difficulty levels' rulers (as supplied); leaders/*.png each tribe's
// leader (as supplied, kept at a third of the size: each pixel the commonest colour of a 3x3 block, which
// loses nothing at these grids). Writes packages/renderer-retro/src/art/rulers.art.ts (all 25 at 104x104,
// drawn a pixel to each fine pixel: the difficulty cards and the tribe panel) and portraits.art.ts (the
// leaders at 48x48, the tribes' grid). Each picture is cropped to its opaque pixels and laid on the grid
// (the bust's foot on the bottom row, centred across); every cell takes the palette colour most of its
// source pixels come nearest to, so blocks stay flat and edges crisp. The colours on offer are the legend's
// fixed ones and the five ramps (chosen per picture, greedily) that fit its colours best.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { C, PALETTE, shade } from "../../../packages/renderer-retro/src/palette.js";
import { decodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const RULERS = ["chieftain", "warlord", "prince", "king", "emperor"];
const LEADERS = [
  "caesar", "hammurabi", "ramesses", "alexander", "qin_shi_huang", "ashoka", "montezuma", "shaka", "otto", "washington",
  "peter", "charlemagne", "elizabeth", "genghis_khan", "isabella", "harald", "suppiluliuma", "cyrus", "david", "tokugawa",
];
const RAMP_CHARS = ["01234567", "abcdefgh", "ABCDEFGH", "JKLMOQST", "jloqstvx"];
const FIXED: Record<string, number> = {
  k: C.BLACK!, w: C.WHITE!, r: C.RED!, R: C.LRED!, y: C.YELLOW!, Y: C.BROWN!, u: C.BLUE!, U: C.LBLUE!,
  n: C.GREEN!, N: C.LGREEN!, i: C.CYAN!, I: C.LCYAN!, z: C.DGREY!, Z: C.LGREY!,
};
const EGA_NAMES = new Set(["BLACK", "BLUE", "GREEN", "CYAN", "RED", "MAGENTA", "BROWN", "LGREY", "DGREY", "LBLUE", "LGREEN", "LCYAN", "LRED", "LMAGENTA", "YELLOW", "WHITE", "ORANGE"]);
const RAMPS = Object.keys(C).filter((k) => !EGA_NAMES.has(k)).map((k) => k.toLowerCase());

type Lab = [number, number, number];
/** CIE Lab of an sRGB colour, for distances the eye agrees with. */
function lab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const PAL_LAB = PALETTE.map(([r, g, b]) => lab(r, g, b));
const dist = (a: Lab, i: number) => {
  const p = PAL_LAB[i]!;
  return (a[0] - p[0]) ** 2 + (a[1] - p[1]) ** 2 + (a[2] - p[2]) ** 2;
};
const rampIdx = (r: string) => [0, 1, 2, 3, 4, 5, 6, 7].map((n) => shade(r, n));

/** A picture read and fitted to the palette: its opaque box, its five ramps, the legend character of each colour. */
interface Fitted {
  W: number; data: Uint8Array;
  box: [number, number, number, number];
  ramps: string[];
  offer: Map<number, string>;
  nearest: (x: number, y: number) => number;
}

function fit(file: string): Fitted {
  const { width: W, height: H, data } = decodePng(new Uint8Array(readFileSync(here(file))));
  const opaque = (x: number, y: number) => data[(y * W + x) * 4 + 3]! >= 128;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (opaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const labAt = (x: number, y: number) => { const o = (y * W + x) * 4; return lab(data[o]!, data[o + 1]!, data[o + 2]!); };

  // The five ramps that, with the fixed colours, come nearest to a sample of the picture's pixels.
  const step = Math.max(1, Math.floor((x1 - x0) / 120));
  const samples: Lab[] = [];
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) if (opaque(x, y)) samples.push(labAt(x, y));
  const best = samples.map((s) => Math.min(...Object.values(FIXED).map((i) => dist(s, i))));
  const ramps: string[] = [];
  for (let k = 0; k < RAMP_CHARS.length; k++) {
    let pick = "", pickErr = Infinity;
    for (const r of RAMPS) {
      if (ramps.includes(r)) continue;
      const idx = rampIdx(r);
      let err = 0;
      for (let i = 0; i < samples.length; i++) err += Math.min(best[i]!, ...idx.map((c) => dist(samples[i]!, c)));
      if (err < pickErr) { pickErr = err; pick = r; }
    }
    ramps.push(pick);
    const idx = rampIdx(pick);
    for (let i = 0; i < samples.length; i++) best[i] = Math.min(best[i]!, ...idx.map((c) => dist(samples[i]!, c)));
  }
  // The legend: each palette colour on offer and the character that names it (fixed ones first).
  const offer = new Map<number, string>();
  for (const [ch, i] of Object.entries(FIXED)) if (!offer.has(i)) offer.set(i, ch);
  ramps.forEach((r, k) => rampIdx(r).forEach((i, n) => { if (!offer.has(i)) offer.set(i, RAMP_CHARS[k]![n]!); }));
  const colours = [...offer.keys()];
  const memo = new Map<number, number>();
  const nearest = (x: number, y: number) => {
    const o = (y * W + x) * 4;
    const key = (data[o]! << 16) | (data[o + 1]! << 8) | data[o + 2]!;
    let hit = memo.get(key);
    if (hit === undefined) {
      const s = lab(data[o]!, data[o + 1]!, data[o + 2]!);
      let d = Infinity;
      for (const c of colours) { const e = dist(s, c); if (e < d) { d = e; hit = c; } }
      memo.set(key, hit!);
    }
    return hit!;
  };
  return { W, data, box: [x0, y0, x1, y1], ramps, offer, nearest };
}

/** The fitted picture on a grid `size` square, as a sprite of the sheet's text. */
function sprite(name: string, f: Fitted, size: number): string {
  const { W, data, box: [x0, y0, x1, y1] } = f;
  const opaque = (x: number, y: number) => data[(y * W + x) * 4 + 3]! >= 128;
  const scale = Math.max(x1 - x0 + 1, y1 - y0 + 1) / size;
  const ox = Math.floor((size - (x1 - x0 + 1) / scale) / 2), oy = size - Math.round((y1 - y0 + 1) / scale);
  const step = Math.max(1, Math.floor(scale / 4));
  const rows: string[] = [];
  for (let gy = 0; gy < size; gy++) {
    let row = "";
    for (let gx = 0; gx < size; gx++) {
      const sx0 = Math.floor(x0 + (gx - ox) * scale), sy0 = Math.floor(y0 + (gy - oy) * scale);
      const votes = new Map<number, number>();
      let solid = 0, all = 0;
      for (let y = sy0; y < sy0 + scale; y += step) for (let x = sx0; x < sx0 + scale; x += step) {
        all++;
        if (x < x0 || y < y0 || x > x1 || y > y1 || !opaque(x, y)) continue;
        solid++;
        const c = f.nearest(x, y);
        votes.set(c, (votes.get(c) ?? 0) + 1);
      }
      if (solid * 2 < all || !votes.size) { row += "."; continue; }
      row += f.offer.get([...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0])!;
    }
    rows.push(row);
  }
  return `@${name} ramps=${f.ramps.join(",")}\n${rows.join("\n")}\n`;
}

/** An art module as an import would write it, so the file round-trips unchanged. */
function module(sheet: string, header: string[], sprites: string[]): string {
  return `// ${sheet} sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.
// Every character must be in the legend described in the comment lines below.
export default String.raw\`
${header.join("\n")}

${sprites.join("\n")}\`;
`;
}

const LEGEND = [
  "# Legend: . clear  k w r R y Y u U n N i I z Z the EGA colours",
  "#   0-7, a-h, A-H, JKLMOQST, jloqstvx: shades of the sprite's first to fifth ramps, dark to light",
];
const rulers = RULERS.map((n) => [n, fit(`./rulers/${n}.png`)] as const);
const leaders = LEADERS.map((n) => [n, fit(`./leaders/${n}.png`)] as const);
writeFileSync(here("../../../packages/renderer-retro/src/art/rulers.art.ts"), module("rulers", [
  "# The setup's portraits, 104x104: one pixel to each of the screen's fine pixels (52 screen pixels across):",
  "# the difficulty levels' rulers, chieftain to emperor, then each tribe's leader. The user's portraits",
  "# (2026-10-22), converted by tools/sprites/draw/rulers.ts from rulers/*.png and leaders/*.png beside it:",
  "# each cell the palette colour most of its pixels come nearest to, from the fixed colours and five ramps",
  "# chosen per picture.",
  ...LEGEND,
], [...rulers, ...leaders].map(([n, f]) => sprite(n, f, 104))));
writeFileSync(here("../../../packages/renderer-retro/src/art/portraits.art.ts"), module("portraits", [
  "# The tribes' leaders small, 48x48: one pixel to each fine pixel (24 screen pixels across), for the setup's",
  "# grid of tribes. The user's portraits (2026-10-22), converted by tools/sprites/draw/rulers.ts from",
  "# leaders/*.png beside it, as the large ones in the rulers sheet.",
  ...LEGEND,
], leaders.map(([n, f]) => sprite(n, f, 48))));
console.log(`wrote rulers.art.ts (${rulers.length + leaders.length}) and portraits.art.ts (${leaders.length})`);
