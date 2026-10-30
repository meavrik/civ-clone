// Cuts the user's unit sheet (units.png, 2026-10-28: 29 units in the order of UNIT_TYPES, rows of 8, 8, 8
// and 5 on a clear background, the owner's parts magenta) into one picture a unit, as it is: "USE AS IS -
// DO NOT regenerate". Run from the repo root:
//   npx vite-node --script tools/sprites/units/cut.ts
// Each unit is one piece of the sheet's opaque pixels (alpha over 64; its soft edge and the rest come with
// it): the units are not on an even grid (the carrier is wider than a cell, the phalanx's spear taller), so
// each is cut by its own bounds, a few pixels out, not by cells. Every pixel of the cut is the sheet's,
// unchanged, but those nearer another unit, cleared where two units' bounds overlap.
// Writes apps/web/src/units/<id>.png and the cuts' sizes to packages/renderer-api/src/unit-art.ts, from
// which `unitArtPlace` stands each picture in its square.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UNIT_TYPES } from "../../../packages/core/src/rules/units.js";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const sheet = decodePng(new Uint8Array(readFileSync(here("./units.png"))));
const { width: W, height: H, data } = sheet;
/** The units in the sheet's rows, left to right. */
const ROWS = [8, 8, 8, 5];
/** Alpha over which a pixel is the unit's own (under it: soft edges and the sheet's faint noise). */
const SOLID = 64;
/** Pieces smaller than this are specks, not units. */
const SPECK = 500;
/** Pixels kept round each unit's bounds. */
const MARGIN = 2;
/** How far a soft pixel looks for the unit it belongs to. */
const REACH = 4;

const solid = (i: number) => data[i * 4 + 3]! > SOLID;
const owner = new Int32Array(W * H).fill(-1);
const pieces: { x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
for (let s = 0; s < W * H; s++) {
  if (!solid(s) || owner[s]! >= 0) continue;
  const id = pieces.length;
  const p = { x0: W, y0: H, x1: -1, y1: -1, n: 0 };
  pieces.push(p);
  const stack = [s];
  owner[s] = id;
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
        if (solid(j) && owner[j]! < 0) { owner[j] = id; stack.push(j); }
      }
  }
}
const units = pieces.map((p, id) => ({ ...p, id })).filter((p) => p.n >= SPECK);
if (units.length !== UNIT_TYPES.length) throw new Error(`the sheet has ${units.length} units, the rules ${UNIT_TYPES.length}`);
// Rows top to bottom (a unit's middle), then left to right.
const byRow = units.slice().sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
const ordered: typeof units = [];
let at = 0;
for (const n of ROWS) {
  ordered.push(...byRow.slice(at, at + n).sort((a, b) => a.x0 - b.x0));
  at += n;
}

/** The unit nearest a soft pixel within REACH (-1: none), so a cut keeps its own edge and not a neighbour's. */
function nearest(x: number, y: number): number {
  let best = -1, bestD = Infinity;
  for (let dy = -REACH; dy <= REACH; dy++)
    for (let dx = -REACH; dx <= REACH; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const o = owner[ny * W + nx]!;
      const d = dx * dx + dy * dy;
      if (o >= 0 && d < bestD) { bestD = d; best = o; }
    }
  return best;
}

const sizes: Record<string, [number, number]> = {};
ordered.forEach((u, n) => {
  const type = UNIT_TYPES[n]!;
  const x0 = Math.max(0, u.x0 - MARGIN), y0 = Math.max(0, u.y0 - MARGIN);
  const x1 = Math.min(W - 1, u.x1 + MARGIN), y1 = Math.min(H - 1, u.y1 + MARGIN);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8Array(w * h * 4);
  let cleared = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y0 + y) * W + x0 + x;
      const o = owner[i]!;
      const mine = o >= 0 ? o === u.id : (() => { const near = nearest(x0 + x, y0 + y); return near < 0 || near === u.id; })();
      if (!mine) { if (data[i * 4 + 3]) cleared++; continue; }
      out.set(data.subarray(i * 4, i * 4 + 4), (y * w + x) * 4);
    }
  writeFileSync(here(`../../../apps/web/src/units/${type.id}.png`), encodePng({ width: w, height: h, data: out }));
  sizes[type.id] = [w, h];
  console.log(`${type.id.padEnd(17)} ${w}x${h} from ${x0},${y0}${cleared ? `, ${cleared} pixels of its neighbours left out` : ""}`);
});

writeFileSync(
  here("../../../packages/renderer-api/src/unit-art.ts"),
  `// Written by tools/sprites/units/cut.ts from the user's unit sheet (tools/sprites/units/units.png): each
// unit's picture (apps/web/src/units/<id>.png), its width and height in the sheet's pixels.
export const UNIT_ART: Record<string, readonly [w: number, h: number]> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  ${id}: [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${ordered.length} pictures and unit-art.ts`);
