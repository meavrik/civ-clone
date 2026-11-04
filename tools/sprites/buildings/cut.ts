// Cuts the user's sheets of buildings into one picture each, as they are. Run from the repo root:
//   npx vite-node --script tools/sprites/buildings/cut.ts
// buildings.png (2026-11-04: "replace all building images with attached sprite-sheet"): the 27 improvements of pixel art
// in the rules' order, in rows of seven, on a clear background, no even grid. Each is one piece of the sheet's opaque
// pixels (alpha over 64; the soft edge and the faint noise round it come with it), cut by its bounds a few pixels out.
// wonders-1.png (2026-11-04: "each wonder contain 3 stages of construction to show in the city view while constructed"):
// a wonder a row on an even grid, its stages left to right: start, in construction, finished. A wonder's three are cut by
// one box, the bounds of all three within their cells a few pixels out, so they lie in register as the sheet draws them.
// Every pixel of a cut is the sheet's, unchanged.
// A new sheet of wonders is a line in WONDER_SHEETS: run this, then take its wonders out of `BUILDING_ART` (art.ts) and
// delete their WebPs. Nothing else knows which wonders have stages: `wonderStages` reads the cuts.
// Writes apps/web/src/buildings/<id>.png (a stage <id>-start.png, <id>-construction.png) and the cuts' sizes to
// packages/renderer-api/src/building-art.ts, from which `artPlace` lays each picture.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, type Image } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
/** The improvements on buildings.png, row by row, left to right. */
const ROWS = [
  ["palace", "barracks", "granary", "harbour", "temple", "marketplace", "library"],
  ["courthouse", "city_walls", "aqueduct", "bank", "cathedral", "university", "mass_transit"],
  ["colosseum", "factory", "mfg_plant", "sdi_defense", "recycling_center", "power_plant", "hydro_plant"],
  ["nuclear_plant", "data_center", "cell_tower", "solar_plant", "automated_office", "quantum_lab"],
];
/** The sheets of wonders: each file, its cells' size, and the wonder of each row. */
const WONDER_SHEETS = [
  { file: "./wonders-1.png", cell: 418, wonders: ["pyramids", "hanging_gardens", "colossus"] },
];
/** What each column of a sheet of wonders is called after the wonder's id (renderer-api `wonderStages`); finished, the id alone. */
const COLUMNS = ["-start", "-construction", ""];
/** Alpha over which a pixel is the picture's own (under it: soft edges and the sheet's faint noise). */
const SOLID = 64;
/** Pieces smaller than this are specks, not pictures. */
const SPECK = 500;
/** Pixels kept round each picture's bounds. */
const MARGIN = 2;

interface Piece { id: number; x0: number; y0: number; x1: number; y1: number; n: number; sx: number; sy: number }

/** The sheet's pieces of solid pixels, and the piece each pixel belongs to (-1: none). */
function piecesOf({ width: W, height: H, data }: Image): { owner: Int32Array; pieces: Piece[] } {
  const solid = (i: number) => data[i * 4 + 3]! > SOLID;
  const owner = new Int32Array(W * H).fill(-1);
  const pieces: Piece[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!solid(s) || owner[s]! >= 0) continue;
    const p = { id: pieces.length, x0: W, y0: H, x1: -1, y1: -1, n: 0, sx: 0, sy: 0 };
    pieces.push(p);
    const stack = [s];
    owner[s] = p.id;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = Math.floor(i / W);
      p.n++; p.sx += x; p.sy += y;
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
  return { owner, pieces };
}

const sizes: Record<string, [number, number]> = {};

/** Writes the box of the sheet as picture `name`, none of it another's (`mine`: the pieces it may hold). */
function cut({ width: W, height: H, data }: Image, owner: Int32Array, name: string, x0: number, y0: number, w: number, h: number, mine: (piece: number) => boolean): void {
  if (x0 < 0 || y0 < 0 || x0 + w > W || y0 + h > H) throw new Error(`${name}'s cut leaves the sheet`);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const i = (y0 + y) * W + x0;
    for (let x = 0; x < w; x++) {
      const o = owner[i + x]!;
      if (o >= 0 && !mine(o)) throw new Error(`${name}'s cut holds part of another picture at ${x0 + x},${y0 + y}`);
    }
    out.set(data.subarray(i * 4, (i + w) * 4), y * w * 4);
  }
  writeFileSync(here(`../../../apps/web/src/buildings/${name}.png`), encodePng({ width: w, height: h, data: out }, 4));
  sizes[name] = [w, h];
  console.log(`${name.padEnd(24)} ${w}x${h} from ${x0},${y0}`);
}

{
  const sheet = decodePng(new Uint8Array(readFileSync(here("./buildings.png"))));
  const { width: W, height: H, data } = sheet;
  const { owner, pieces } = piecesOf(sheet);
  // The sheet's rows stand apart: each is a run of lines holding solid pixels.
  const bands: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    let any = false;
    for (let x = 0; x < W && !any; x++) any = data[(y * W + x) * 4 + 3]! > SOLID;
    const last = bands[bands.length - 1];
    if (any && last && last[1] === y - 1) last[1] = y;
    else if (any) bands.push([y, y]);
  }
  if (bands.length !== ROWS.length) throw new Error(`the sheet has ${bands.length} rows, not ${ROWS.length}`);
  ROWS.forEach((names, r) => {
    const [top, bottom] = bands[r]!;
    const row = pieces.filter((p) => p.n >= SPECK && p.y0 >= top && p.y1 <= bottom).sort((a, b) => a.x0 - b.x0);
    if (row.length !== names.length) throw new Error(`row ${r} has ${row.length} pictures, not ${names.length}`);
    row.forEach((c, n) => {
      const x0 = Math.max(0, c.x0 - MARGIN), y0 = Math.max(0, c.y0 - MARGIN);
      const x1 = Math.min(W - 1, c.x1 + MARGIN), y1 = Math.min(H - 1, c.y1 + MARGIN);
      cut(sheet, owner, names[n]!, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (o) => o === c.id || pieces[o]!.n < SPECK);
    });
  });
}

for (const { file, cell, wonders } of WONDER_SHEETS) {
  const sheet = decodePng(new Uint8Array(readFileSync(here(file))));
  const { owner, pieces } = piecesOf(sheet);
  /** The pieces whose middle lies in a cell. */
  const inCell = (r: number, c: number) => pieces.filter((p) => Math.floor(p.sy / p.n / cell) === r && Math.floor(p.sx / p.n / cell) === c);
  wonders.forEach((id, r) => {
    const cells = COLUMNS.map((_, c) => inCell(r, c));
    if (cells.some((own) => !own.length)) throw new Error(`${id}: a stage's cell is empty`);
    // One box for all three, in cell coordinates, so what stands still in the sheet stands still between them.
    const across = cells.flatMap((own, c) => own.flatMap((p) => [p.x0 - c * cell, p.x1 - c * cell]));
    const down = cells.flat().flatMap((p) => [p.y0 - r * cell, p.y1 - r * cell]);
    const x0 = Math.min(...across) - MARGIN, x1 = Math.max(...across) + MARGIN;
    const y0 = Math.min(...down) - MARGIN, y1 = Math.max(...down) + MARGIN;
    COLUMNS.forEach((suffix, c) => cut(sheet, owner, id + suffix, c * cell + x0, r * cell + y0, x1 - x0 + 1, y1 - y0 + 1, (o) => cells[c]!.some((p) => p.id === o)));
  });
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
