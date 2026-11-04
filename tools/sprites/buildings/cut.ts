// Cuts the user's sheet of city improvements (buildings.png, 2026-11-04: "replace all building images with attached
// sprite-sheet"; 27 pictures of pixel art in the rules' order, in rows of seven, on a clear background; no even grid) into
// one picture an improvement, as it is. Run from the repo root:
//   npx vite-node --script tools/sprites/buildings/cut.ts
// Each picture is one piece of the sheet's opaque pixels (alpha over 64; the soft edge and the faint noise round it come
// with it), cut by its bounds a few pixels out. Every pixel of the cut is the sheet's, unchanged. The wonders and the
// spaceship parts are not on it.
// Writes apps/web/src/buildings/<id>.png and the cuts' sizes to packages/renderer-api/src/building-art.ts, from which
// `artPlace` lays each picture.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const { width: W, height: H, data } = decodePng(new Uint8Array(readFileSync(here("./buildings.png"))));
/** The sheet's pictures, row by row, left to right. */
const ROWS = [
  ["palace", "barracks", "granary", "harbour", "temple", "marketplace", "library"],
  ["courthouse", "city_walls", "aqueduct", "bank", "cathedral", "university", "mass_transit"],
  ["colosseum", "factory", "mfg_plant", "sdi_defense", "recycling_center", "power_plant", "hydro_plant"],
  ["nuclear_plant", "data_center", "cell_tower", "solar_plant", "automated_office", "quantum_lab"],
];
/** Alpha over which a pixel is the picture's own (under it: soft edges and the sheet's faint noise). */
const SOLID = 64;
/** Pieces smaller than this are specks, not pictures. */
const SPECK = 500;
/** Pixels kept round each picture's bounds. */
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

// The sheet's rows stand apart: each is a run of lines holding solid pixels.
const bands: [number, number][] = [];
for (let y = 0; y < H; y++) {
  let any = false;
  for (let x = 0; x < W && !any; x++) any = solid(y * W + x);
  const last = bands[bands.length - 1];
  if (any && last && last[1] === y - 1) last[1] = y;
  else if (any) bands.push([y, y]);
}
if (bands.length !== ROWS.length) throw new Error(`the sheet has ${bands.length} rows, not ${ROWS.length}`);

const sizes: Record<string, [number, number]> = {};
ROWS.forEach((names, r) => {
  const [top, bottom] = bands[r]!;
  const row = pieces.filter((p) => p.n >= SPECK && p.y0 >= top && p.y1 <= bottom).sort((a, b) => a.x0 - b.x0);
  if (row.length !== names.length) throw new Error(`row ${r} has ${row.length} pictures, not ${names.length}`);
  row.forEach((c, n) => {
    const name = names[n]!;
    const x0 = Math.max(0, c.x0 - MARGIN), y0 = Math.max(0, c.y0 - MARGIN);
    const x1 = Math.min(W - 1, c.x1 + MARGIN), y1 = Math.min(H - 1, c.y1 + MARGIN);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const i = (y0 + y) * W + x0;
      for (let x = 0; x < w; x++) {
        const o = owner[i + x]!;
        if (o >= 0 && o !== c.id && pieces[o]!.n >= SPECK) throw new Error(`${name}'s cut holds part of another picture at ${x0 + x},${y0 + y}`);
      }
      out.set(data.subarray(i * 4, (i + w) * 4), y * w * 4);
    }
    writeFileSync(here(`../../../apps/web/src/buildings/${name}.png`), encodePng({ width: w, height: h, data: out }, 4));
    sizes[name] = [w, h];
    console.log(`${name.padEnd(17)} ${w}x${h} from ${x0},${y0}`);
  });
});

writeFileSync(
  here("../../../packages/renderer-api/src/building-art.ts"),
  `// Written by tools/sprites/buildings/cut.ts from the user's sheet of improvements (tools/sprites/buildings/buildings.png):
// each improvement's picture (apps/web/src/buildings/<id>.png), its width and height in the sheet's pixels.
export const BUILDING_CUTS: Readonly<Record<string, readonly [w: number, h: number]>> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  ${id}: [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${Object.keys(sizes).length} pictures and building-art.ts`);
