// Cuts the user's sheet of tile improvements (works.png, 2026-11-02: "implement updated tile improvements", a 4x4 grid
// on a clear background: roads straight, bent and crossing; ploughed fields, crops, wheat and irrigated fields; a mine,
// a quarry, a logging camp and an oil pump; an offshore rig, a fishing net, a pier and a bridge) into one picture an
// improvement, as it is. Run from the repo root:
//   npx vite-node --script tools/sprites/works/cut.ts
// A piece is a run of the sheet's opaque pixels (alpha over 64), and each goes to the cell its middle lies in, so an
// improvement of several pieces (three plots of a field, a mine's loose rocks) comes whole. Each is cut by its pieces'
// bounds a few pixels out, the faint pixels round it (its soft edge, the sheet's faint noise and a red fringe left by
// the background's removal, alpha 1 to 3) coming with it as they are. Every pixel of the cut is the sheet's, unchanged.
// The roads, the bridge and the logging camp are not cut: roads and bridges are drawn in code along their courses
// (they wander and run diagonally, which tiles of four directions cannot), and the rules have no work for forests.
// Writes apps/web/src/works/<id>.png and the cuts' sizes to packages/renderer-api/src/work-art.ts, from which
// `workArtPlace` stands each picture on its square.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const sheet = decodePng(new Uint8Array(readFileSync(here("./works.png"))));
const { width: W, height: H, data } = sheet;
/** The sheet's cells, row by row (renderer-api `WorkPicture`); null where the improvement is not cut. */
const CELLS: (string | null)[][] = [
  [null, null, null, null],
  ["fields_ploughed", "fields_crops", "fields_wheat", "fields_irrigated"],
  ["mine", "quarry", null, "oil_pump"],
  ["oil_rig", "fishing_net", "pier", null],
];
const ROWS = CELLS.length;
const COLS = CELLS[0]!.length;
/** Alpha over which a pixel is the improvement's own. */
const SOLID = 64;
/** Pixels kept round each improvement's bounds. */
const MARGIN = 2;

const solid = (i: number) => data[i * 4 + 3]! > SOLID;
const owner = new Int32Array(W * H).fill(-1);
/** Each piece's bounds and the cell its middle lies in. */
const pieces: { x0: number; y0: number; x1: number; y1: number; cell: number }[] = [];
for (let s = 0; s < W * H; s++) {
  if (!solid(s) || owner[s]! >= 0) continue;
  const id = pieces.length;
  const p = { x0: W, y0: H, x1: -1, y1: -1, cell: -1 };
  pieces.push(p);
  const stack = [s];
  owner[s] = id;
  let n = 0, sx = 0, sy = 0;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W, y = Math.floor(i / W);
    n++; sx += x; sy += y;
    p.x0 = Math.min(p.x0, x); p.x1 = Math.max(p.x1, x); p.y0 = Math.min(p.y0, y); p.y1 = Math.max(p.y1, y);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (solid(j) && owner[j]! < 0) { owner[j] = id; stack.push(j); }
      }
  }
  p.cell = Math.min(ROWS - 1, Math.floor((sy / n / H) * ROWS)) * COLS + Math.min(COLS - 1, Math.floor((sx / n / W) * COLS));
}

const sizes: Record<string, [number, number]> = {};
CELLS.flat().forEach((name, cell) => {
  if (!name) return;
  const own = pieces.filter((p) => p.cell === cell);
  if (!own.length) throw new Error(`${name}: nothing in its cell`);
  const x0 = Math.max(0, Math.min(...own.map((p) => p.x0)) - MARGIN), y0 = Math.max(0, Math.min(...own.map((p) => p.y0)) - MARGIN);
  const x1 = Math.min(W - 1, Math.max(...own.map((p) => p.x1)) + MARGIN), y1 = Math.min(H - 1, Math.max(...own.map((p) => p.y1)) + MARGIN);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const i = (y0 + y) * W + x0;
    for (let x = 0; x < w; x++) {
      const o = owner[i + x]!;
      if (o >= 0 && pieces[o]!.cell !== cell) throw new Error(`${name}'s cut holds part of another improvement at ${x0 + x},${y0 + y}`);
    }
    out.set(data.subarray(i * 4, (i + w) * 4), y * w * 4);
  }
  writeFileSync(here(`../../../apps/web/src/works/${name}.png`), encodePng({ width: w, height: h, data: out }, 4));
  sizes[name] = [w, h];
  console.log(`${name.padEnd(17)} ${w}x${h} from ${x0},${y0} (${own.length} pieces)`);
});

writeFileSync(
  here("../../../packages/renderer-api/src/work-art.ts"),
  `// Written by tools/sprites/works/cut.ts from the user's sheet of tile improvements (tools/sprites/works/works.png):
// each improvement's picture (apps/web/src/works/<id>.png), its width and height in the sheet's pixels.
export const WORK_ART: Record<string, readonly [w: number, h: number]> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  ${id}: [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${Object.keys(sizes).length} pictures and work-art.ts`);
