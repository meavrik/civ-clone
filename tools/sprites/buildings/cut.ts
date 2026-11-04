// Cuts the user's sheets of buildings into one picture each, as they are. Run from the repo root:
//   npx vite-node --script tools/sprites/buildings/cut.ts
// buildings.png (2026-11-04: "replace all building images with attached sprite-sheet"): the 27 improvements of pixel art
// in the rules' order, in rows of seven, on a clear background, no even grid. Each is one piece of the sheet's opaque
// pixels (alpha over 64; the soft edge and the faint noise round it come with it), cut by its bounds a few pixels out.
// wonders-*.png (2026-11-04: "each wonder contain 3 stages of construction to show in the city view while constructed"):
// a wonder a row on an even grid, its stages left to right: start, in construction, finished. The three of a wonder lie
// on one canvas, in register as the sheet draws them (`wonderCuts`). The sheets and what is on them are in sheets.ts.
// Every pixel of a cut is the sheet's, unchanged; a stage's canvas is clear past its own box.
// A wonder added later is a line in WONDER_SHEETS: run this, then take it out of `BUILDING_ART` (art.ts) if it was there
// and delete its WebP. Nothing else knows which wonders have stages: `wonderStages` reads the cuts.
// Writes apps/web/src/buildings/<id>.png (a stage <id>-start.png, <id>-construction.png) and the cuts' sizes to
// packages/renderer-api/src/building-art.ts, from which `artPlace` lays each picture.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { piecesOf } from "../src/pieces.js";
import { decodePng, encodePng } from "../src/png.js";
import { IMPROVEMENT_ROWS, MARGIN, WONDER_SHEETS, wonderCuts } from "./sheets.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
/** Alpha over which a pixel of buildings.png is the picture's own (under it: soft edges and the sheet's faint noise). */
const SOLID = 64;
/** Pieces smaller than this are specks, not pictures. */
const SPECK = 500;

const sizes: Record<string, [number, number]> = {};

/** Writes a box of the sheet as picture `name`, on a clear canvas `w` by `h` at `at`; none of it another picture's (`mine`). */
function cut({ width: W, height: H, data }: ReturnType<typeof decodePng>, owner: Int32Array, name: string, box: { x0: number; y0: number; w: number; h: number }, canvas: { w: number; h: number; at: [number, number] }, mine: (piece: number) => boolean): void {
  const { x0, y0 } = box;
  if (x0 < 0 || y0 < 0 || x0 + box.w > W || y0 + box.h > H) throw new Error(`${name}'s cut leaves the sheet`);
  const { w, h, at: [ax, ay] } = canvas;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < box.h; y++) {
    const i = (y0 + y) * W + x0;
    for (let x = 0; x < box.w; x++) {
      const o = owner[i + x]!;
      if (o >= 0 && !mine(o)) throw new Error(`${name}'s cut holds part of another picture at ${x0 + x},${y0 + y}`);
    }
    out.set(data.subarray(i * 4, (i + box.w) * 4), ((ay + y) * w + ax) * 4);
  }
  writeFileSync(here(`../../../apps/web/src/buildings/${name}.png`), encodePng({ width: w, height: h, data: out }, 4));
  sizes[name] = [w, h];
  console.log(`${name.padEnd(30)} ${w}x${h} from ${x0},${y0}`);
}

{
  const sheet = decodePng(new Uint8Array(readFileSync(here("./buildings.png"))));
  const { width: W, height: H, data } = sheet;
  const { owner, pieces } = piecesOf(sheet, SOLID);
  // The sheet's rows stand apart: each is a run of lines holding solid pixels.
  const bands: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    let any = false;
    for (let x = 0; x < W && !any; x++) any = data[(y * W + x) * 4 + 3]! > SOLID;
    const last = bands[bands.length - 1];
    if (any && last && last[1] === y - 1) last[1] = y;
    else if (any) bands.push([y, y]);
  }
  if (bands.length !== IMPROVEMENT_ROWS.length) throw new Error(`the sheet has ${bands.length} rows, not ${IMPROVEMENT_ROWS.length}`);
  IMPROVEMENT_ROWS.forEach((names, r) => {
    const [top, bottom] = bands[r]!;
    const row = pieces.filter((p) => p.n >= SPECK && p.y0 >= top && p.y1 <= bottom).sort((a, b) => a.x0 - b.x0);
    if (row.length !== names.length) throw new Error(`row ${r} has ${row.length} pictures, not ${names.length}`);
    row.forEach((c, n) => {
      const x0 = Math.max(0, c.x0 - MARGIN), y0 = Math.max(0, c.y0 - MARGIN);
      const w = Math.min(W - 1, c.x1 + MARGIN) - x0 + 1, h = Math.min(H - 1, c.y1 + MARGIN) - y0 + 1;
      cut(sheet, owner, names[n]!, { x0, y0, w, h }, { w, h, at: [0, 0] }, (o) => o === c.id || pieces[o]!.n < SPECK);
    });
  });
}

for (const { file, cell, wonders } of WONDER_SHEETS) {
  const sheet = decodePng(new Uint8Array(readFileSync(here(`./${file}`))));
  const { owner, pieces } = piecesOf(sheet, SOLID);
  for (const { w, h, stages } of wonderCuts(sheet, pieces, cell, wonders))
    for (const s of stages) cut(sheet, owner, s.name, s, { w, h, at: s.at }, (o) => s.own.some((p) => p.id === o));
}

writeFileSync(
  here("../../../packages/renderer-api/src/building-art.ts"),
  `// Written by tools/sprites/buildings/cut.ts from the user's sheets of buildings (tools/sprites/buildings/*.png): each
// improvement's and wonder's picture (apps/web/src/buildings/<id>.png), and the stages of a wonder's construction
// (<id>-start, <id>-construction, the size of the finished picture), their width and height in the sheet's pixels.
export const BUILDING_CUTS: Readonly<Record<string, readonly [w: number, h: number]>> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  ${/^[a-z_]+$/.test(id) ? id : JSON.stringify(id)}: [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${Object.keys(sizes).length} pictures and building-art.ts`);
