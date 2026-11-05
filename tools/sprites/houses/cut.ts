// Cuts the user's sheet of houses (houses.png, 2026-11-05: 24 homes and workshops on a clear background, six to a row, a
// row an age, "for the city view add random houses to be scattered around by the civ time-frame, size and advances")
// into one picture a house, as it is. Run from the repo root:
//   npx vite-node --script tools/sprites/houses/cut.ts
// Each house is one piece of the sheet's solid pixels (alpha over 64; its soft edge and the faint colour round it come
// with it), cut by its own bounds two pixels out. Every pixel of the cut is the sheet's, unchanged.
// Writes apps/web/src/houses/<id>.png and the cuts' sizes to packages/renderer-api/src/house-art.ts, from which
// `houseArtPlace` stands each picture on its lot.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../src/png.js";
import { piecesOf } from "../src/pieces.js";
import { HOUSE_CELL, HOUSE_MARGIN, HOUSE_ROWS } from "./sheet.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const sheet = decodePng(new Uint8Array(readFileSync(here("./houses.png"))));
const { width: W, height: H, data } = sheet;
const { pieces, owner } = piecesOf(sheet);

const sizes: Record<string, [number, number]> = {};
HOUSE_ROWS.forEach((row, r) => row.forEach((id, c) => {
  const mine = pieces.filter((p) => Math.floor(p.sx / p.n / HOUSE_CELL) === c && Math.floor(p.sy / p.n / HOUSE_CELL) === r);
  if (mine.length !== 1) throw new Error(`${id}: ${mine.length} pieces in its cell`);
  const p = mine[0]!;
  const x0 = Math.max(0, p.x0 - HOUSE_MARGIN), y0 = Math.max(0, p.y0 - HOUSE_MARGIN);
  const x1 = Math.min(W - 1, p.x1 + HOUSE_MARGIN), y1 = Math.min(H - 1, p.y1 + HOUSE_MARGIN);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const i = (y0 + y) * W + x0;
    for (let x = 0; x < w; x++) if (owner[i + x]! >= 0 && owner[i + x] !== p.id) throw new Error(`${id}'s cut holds part of another house at ${x0 + x},${y0 + y}`);
    out.set(data.subarray(i * 4, (i + w) * 4), y * w * 4);
  }
  writeFileSync(here(`../../../apps/web/src/houses/${id}.png`), encodePng({ width: w, height: h, data: out }, 4));
  sizes[id] = [w, h];
}));

writeFileSync(
  here("../../../packages/renderer-api/src/house-art.ts"),
  `// Written by tools/sprites/houses/cut.ts from the user's sheet of houses (tools/sprites/houses/houses.png): each house's
// picture (apps/web/src/houses/<id>.png), its width and height in the sheet's pixels.
export const HOUSE_ART: Readonly<Record<string, readonly [w: number, h: number]>> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  ${id}: [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${Object.keys(sizes).length} pictures and house-art.ts`);
