// Cuts the user's sheet of resources (resources.png, 2026-11-03: "updates resources sprite-sheet - USE AS IS!! do not
// regenerate assets"; 26 icons of pixel art in rows of eight, cells 256 pixels wide and 192 tall, on a clear background
// whose soft colours have no alpha; the cell where Ivory stood left empty: Ivory is gone from the game) into one picture
// a resource, as it is. Run from the repo root:
//   npx vite-node --script tools/sprites/resources/cut.ts
// A piece is a run of a sheet's opaque pixels (alpha over 64), and each goes to the cell its middle lies in, so an icon of
// several pieces (two fish, three nuggets, oil's bubbles) comes whole. Each is cut by its pieces' bounds a few pixels
// out, the soft edge round it coming with it as it is. Every pixel of the cut is the sheet's, unchanged.
// Writes apps/web/src/resources/<id>.png (the special's name in lower case, words joined: offshore_oil) and the cuts'
// sizes to packages/renderer-api/src/resource-art.ts, from which `resourceArtPlace` stands each picture on its square.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));

/** A sheet: its file, its cells' size, and the names of its cells, row by row, eight to a row (null: not cut). */
interface SheetSpec { file: string; cellW: number; cellH: number; names: (string | null)[] }
const SHEETS: SheetSpec[] = [
  {
    file: "./resources.png", cellW: 256, cellH: 192,
    names: [
      "fish", "whales", "bison", "cotton", "horses", "wheat", "game", "silk",
      "coal", "wine", "gold", "iron", "oasis", "offshore_oil", "furs", "seals",
      null, "peat", "spices", "gems", "fruit", "saltpeter", "elephants", "oil",
      "sheep", "camels",
    ],
  },
];
const COLUMNS = 8;
/** Alpha over which a pixel is the icon's own. */
const SOLID = 64;
/** Pixels kept round each icon's bounds. */
const MARGIN = 2;

const sizes: Record<string, [number, number]> = {};
for (const spec of SHEETS) {
  const { width: W, height: H, data } = decodePng(new Uint8Array(readFileSync(here(spec.file))));
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
    p.cell = Math.floor(sy / n / spec.cellH) * COLUMNS + Math.floor(sx / n / spec.cellW);
  }
  spec.names.forEach((name, cell) => {
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
        if (o >= 0 && pieces[o]!.cell !== cell) throw new Error(`${name}'s cut holds part of another icon at ${x0 + x},${y0 + y}`);
      }
      out.set(data.subarray(i * 4, (i + w) * 4), y * w * 4);
    }
    writeFileSync(here(`../../../apps/web/src/resources/${name}.png`), encodePng({ width: w, height: h, data: out }, 4));
    sizes[name] = [w, h];
    console.log(`${name.padEnd(13)} ${w}x${h} from ${x0},${y0} (${own.length} pieces)`);
  });
}

writeFileSync(
  here("../../../packages/renderer-api/src/resource-art.ts"),
  `// Written by tools/sprites/resources/cut.ts from the user's sheet of resources (tools/sprites/resources/resources.png):
// each resource's picture (apps/web/src/resources/<id>.png), its width and height in the sheet's pixels.
export const RESOURCE_ART: Record<string, readonly [w: number, h: number]> = {
${Object.entries(sizes).map(([id, [w, h]]) => `  ${id}: [${w}, ${h}],`).join("\n")}
};
`,
);
console.log(`wrote ${Object.keys(sizes).length} pictures and resource-art.ts`);
