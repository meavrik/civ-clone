// Converts the user's audience scenes (2026-10-22: each leader in their palace, framed) into the retro
// renderer's scene art, packages/renderer-retro/src/art/scenes/<leader>.ts. Run from the repo root with
// the folder that holds them, named by leader (caesar.png, tokugawa.png...):
//   npx vite-node --script tools/sprites/draw/scenes.ts <folder>
// The pictures (1672x941, too large to keep in the repo) are used whole, ornate frame and all (asked for:
// "as is"), laid on the audience screen's grid of fine pixels, each taking the palette colour most of its
// source pixels come nearest to (any of the palette's, these being full scenes). Nothing is drawn or cut.
// The result is run-length coded: base64 of (colour, run - 1) byte pairs.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE } from "../../../packages/renderer-retro/src/palette.js";
import { decodePng } from "../src/png.js";

/** The picture's size in screen pixels, two fine pixels to each (as the audience screen shows it: 16 by 9). */
export const SCENE_W = 224;
export const SCENE_H = 126;
const FW = SCENE_W * 2, FH = SCENE_H * 2;

const here = (p: string) => resolve(fileURLToPath(new URL(p, import.meta.url)));
const dir = process.argv[2];
if (!dir) { console.error("usage: npx vite-node --script tools/sprites/draw/scenes.ts <folder of <leader>.png>"); process.exit(2); }

type Lab = [number, number, number];
function lab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Every palette colour but the last (kept clear for sprites). */
const COLOURS = PALETTE.slice(0, 255).map(([r, g, b], i) => ({ i, l: lab(r, g, b) }));

function convert(file: string): Uint8Array {
  const { width: W, height: H, data } = decodePng(new Uint8Array(readFileSync(file)));
  const memo = new Map<number, number>();
  const nearest = (x: number, y: number) => {
    const o = (y * W + x) * 4;
    const key = (data[o]! << 16) | (data[o + 1]! << 8) | data[o + 2]!;
    let hit = memo.get(key);
    if (hit === undefined) {
      const s = lab(data[o]!, data[o + 1]!, data[o + 2]!);
      let d = Infinity;
      for (const c of COLOURS) { const e = (s[0] - c.l[0]) ** 2 + (s[1] - c.l[1]) ** 2 + (s[2] - c.l[2]) ** 2; if (e < d) { d = e; hit = c.i; } }
      memo.set(key, hit!);
    }
    return hit!;
  };
  // The whole picture, frame and all.
  const sx = W / FW, sy = H / FH;
  const out = new Uint8Array(FW * FH);
  for (let gy = 0; gy < FH; gy++)
    for (let gx = 0; gx < FW; gx++) {
      const sx0 = gx * sx, sy0 = gy * sy;
      const votes = new Map<number, number>();
      for (let y = Math.floor(sy0); y < Math.min(H, sy0 + sy); y++) for (let x = Math.floor(sx0); x < Math.min(W, sx0 + sx); x++) {
        const c = nearest(x, y);
        votes.set(c, (votes.get(c) ?? 0) + 1);
      }
      out[gy * FW + gx] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    }
  return out;
}

function rle(px: Uint8Array): string {
  const bytes: number[] = [];
  for (let i = 0; i < px.length;) {
    let n = 1;
    while (i + n < px.length && px[i + n] === px[i] && n < 256) n++;
    bytes.push(px[i]!, n - 1);
    i += n;
  }
  return Buffer.from(bytes).toString("base64");
}

let total = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".png")).sort()) {
  const name = f.slice(0, -4);
  if (!/^[a-z_]+$/.test(name)) continue;
  const code = rle(convert(resolve(dir, f)));
  total += code.length;
  writeFileSync(here(`../../../packages/renderer-retro/src/art/scenes/${name}.ts`), [
    `// ${name}'s audience scene for the retro renderer: the user's picture (2026-10-22), converted by`,
    "// tools/sprites/draw/scenes.ts. Palette indices, run-length coded (base64 of colour, run - 1 pairs).",
    `export default { w: ${SCENE_W}, h: ${SCENE_H}, rle: "${code}" };`,
    "",
  ].join("\n"));
  console.log(`${name}: ${(code.length / 1024).toFixed(0)} KB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KB`);
