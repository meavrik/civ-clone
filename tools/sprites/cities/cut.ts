// Cuts the user's city sheet (cities.png, 2026-10-29: three ages in rows, ancient, medieval and industrial, of four
// sizes, village, town, city and capital, on a clear background, each flying a blue flag) into one picture a city, as
// it is: "USE AS IS!!! DO NOT regenerate". Run from the repo root:
//   npx vite-node --script tools/sprites/cities/cut.ts
// Each city is one piece of the sheet's opaque pixels (alpha over 64; its soft edge and the faint noise round it come
// with it), cut by its own bounds a few pixels out: the pieces do not keep to the sheet's 362-pixel cells (the ancient
// capital reaches into the row below). Every pixel of the cut is the sheet's, unchanged.
// Writes apps/web/src/cities/<era>-<tier>.png and the cuts' sizes to packages/renderer-api/src/city-art.ts, from
// which `cityArtPlace` stands each picture on its square.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const sheet = decodePng(new Uint8Array(readFileSync(here("./cities.png"))));
const { width: W, height: H, data } = sheet;
/** The sheet's rows, top to bottom, and the sizes along each, left to right (renderer-api `CityEra`, `CityTier`). */
const ERAS = ["ancient", "medieval", "industrial"] as const;
const TIERS = ["village", "town", "city", "capital"] as const;
/** Alpha over which a pixel is the city's own (under it: soft edges and the sheet's faint noise). */
const SOLID = 64;
/** Pieces smaller than this are specks, not cities. */
const SPECK = 500;
/** Pixels kept round each city's bounds. */
const MARGIN = 2;

const solid = (i: number) => data[i * 4 + 3]! > SOLID;
const owner = new Int32Array(W * H).fill(-1);
const pieces: { id: number; x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
for (let s = 0; s < W * H; s++) {
  if (!solid(s) || owner[s]! >= 0) continue;
  const p = { id: pieces.length, x0: W, y0: H, x1: -1, y1: -1, n: 0 };
  pieces.push(p);
  const stack = [s];
  owner[s] = p.id;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W, y = Math.floor(i / W);
    p.n++;
    p.x0 = Math.min(p.x0, x); p.x1 = Math.max(p.x1, x); p.y0 = Math.min(p.y0, y); p.y1 = Math.max(p.y1, y);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (solid(j) && owner[j]! < 0) { owner[j] = p.id; stack.push(j); }
      }
  }
}
const cities = pieces.filter((p) => p.n >= SPECK);
if (cities.length !== ERAS.length * TIERS.length) throw new Error(`the sheet has ${cities.length} cities, not ${ERAS.length * TIERS.length}`);
// Rows top to bottom (a city's middle), then left to right.
const byRow = cities.slice().sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
const ordered = ERAS.flatMap((_, r) => byRow.slice(r * TIERS.length, (r + 1) * TIERS.length).sort((a, b) => a.x0 - b.x0));

const sizes: Record<string, [number, number]> = {};
ordered.forEach((c, n) => {
  const name = `${ERAS[Math.floor(n / TIERS.length)]}-${TIERS[n % TIERS.length]}`;
  const x0 = Math.max(0, c.x0 - MARGIN), y0 = Math.max(0, c.y0 - MARGIN);
  const x1 = Math.min(W - 1, c.x1 + MARGIN), y1 = Math.min(H - 1, c.y1 + MARGIN);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const i = (y0 + y) * W + x0;
    for (let x = 0; x < w; x++) {
      const o = owner[i + x]!;
      if (o >= 0 && o !== c.id) throw new Error(`${name}'s cut holds part of another city at ${x0 + x},${y0 + y}`);
    }
    out.set(data.subarray(i * 4, (i + w) * 4), y * w * 4);
  }
  writeFileSync(here(`../../../apps/web/src/cities/${name}.png`), encodePng({ width: w, height: h, data: out }, 4));
  sizes[name] = [w, h];
  console.log(`${name.padEnd(19)} ${w}x${h} from ${x0},${y0}`);
});

writeFileSync(
  here("../../../packages/renderer-api/src/city-art.ts"),
  `// Written by tools/sprites/cities/cut.ts from the user's city sheet (tools/sprites/cities/cities.png): each city's
// picture (apps/web/src/cities/<era>-<tier>.png), its width and height in the sheet's pixels.
export const CITY_ART: Record<string, readonly [w: number, h: number]> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  "${id}": [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${ordered.length} pictures and city-art.ts`);
