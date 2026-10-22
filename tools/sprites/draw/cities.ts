// Converts the user's city icon sheet (cities.png, 4x3 cells of 32x32 named in cities.json, 2026-10-22)
// into packages/renderer-retro/src/art/cities.art.ts. Run from the repo root:
//   npx vite-node --script tools/sprites/draw/cities.ts
// Each colour of the sheet becomes a legend character: eight are the `town` ramp (put in the palette
// for them), three sit within five steps of shades of `skin` and `rock`. The flag on each icon
// (its light blue and the dark blue joined to it) becomes the owner's colour, P and p.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "../src/png.js";

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const atlas = JSON.parse(readFileSync(here("./cities.json"), "utf8")) as { cell_size: [number, number]; icons: { name: string; column: number; row: number }[] };
const img = decodePng(new Uint8Array(readFileSync(here("./cities.png"))));
const N = atlas.cell_size[0];

/** Sheet colour -> legend character with ramps town (0-7), skin (a-h), rock (A-H). */
const LEGEND: Record<string, string> = {
  "34,32,52": "0", // navy outline
  "48,96,130": "1", // dark slate blue (and the flag's shade)
  "91,110,139": "2", // slate
  "172,50,50": "3", // red roof tiles
  "155,173,183": "4", // light slate
  "217,87,99": "5", // lit roof tiles
  "217,160,102": "6", // plaster in shade
  "238,195,154": "7", // plaster
  "102,57,49": "e", // timber, skin 4 (100,62,41)
  "143,86,59": "h", // brick, skin 7 (136,86,56)
  "251,242,207": "H", // marble, rock 7 (252,245,214)
};
const FLAG_LIGHT = "99,155,255";
const FLAG_DARK = "48,96,130";

const colourAt = (x: number, y: number): string | null => {
  const i = (y * img.width + x) * 4;
  return img.data[i + 3]! < 128 ? null : `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`;
};

const sprites = atlas.icons.map(({ name, column, row }) => {
  const x0 = column * N;
  const y0 = row * N;
  const grid = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => colourAt(x0 + x, y0 + y)));
  // The flag: its light blue, and the dark blue reached from it.
  const flag = new Set<number>();
  const stack: [number, number][] = [];
  grid.forEach((r, y) => r.forEach((c, x) => { if (c === FLAG_LIGHT) { flag.add(y * N + x); stack.push([x, y]); } }));
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || flag.has(ny * N + nx)) continue;
      const c = grid[ny]![nx];
      if (c !== FLAG_LIGHT && c !== FLAG_DARK) continue;
      flag.add(ny * N + nx);
      stack.push([nx, ny]);
    }
  }
  const rows = grid.map((r, y) => r.map((c, x) => {
    if (c === null) return ".";
    if (flag.has(y * N + x)) return c === FLAG_LIGHT ? "P" : "p";
    const ch = LEGEND[c];
    if (!ch) throw new Error(`${name} (${x},${y}): colour ${c} is not in the legend`);
    return ch;
  }).join(""));
  if (flag.size === 0 || flag.size > 16) throw new Error(`${name}: flag of ${flag.size} pixels`);
  return `@${name} ramps=town,skin,rock\n${rows.join("\n")}\n`;
});

const header = [
  "# Cities on the map, 32x32: two pixels to each screen pixel. The user's icons (2026-10-22): three ages",
  "# (ancient, medieval from Construction, industrial from Industrialization, as the city view's homes)",
  "# by four sizes (village, town, city; the capital is the city with the Palace). Each flies a flag in",
  "# its owner's colour (P/p). Converted by tools/sprites/draw/cities.ts from cities.png and cities.json.",
  "# Legend: . clear  P/p owner colour/dark; 0-7 the town ramp (navy, slate blues, roof reds, plaster),",
  "#   a-h skin (timber e, brick h), A-H rock (marble H).",
];
const file = `// cities sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.
// Every character must be in the legend described in the comment lines below.
export default String.raw\`
${header.join("\n")}

${sprites.join("\n")}\`;
`;
writeFileSync(here("../../../packages/renderer-retro/src/art/cities.art.ts"), file);
console.log(`wrote cities.art.ts (${sprites.length} sprites)`);
