import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORK_ART } from "../../../packages/renderer-api/src/work-art.js";
import { decodePng } from "../src/png.js";

const read = (p: string) => decodePng(new Uint8Array(readFileSync(new URL(p, import.meta.url))));

describe("the tile improvements' pictures", () => {
  it.each(Object.keys(WORK_ART))("are cut from the user's sheet, every pixel as supplied: %s", (id) => {
    const sheet = read("../works/works.png");
    const cut = read(`../../../apps/web/src/works/${id}.png`);
    expect(WORK_ART[id]).toEqual([cut.width, cut.height]);
    // Where in the sheet the cut lies: its first solid pixel, row by row, found in the sheet.
    const { width: W, height: H, data } = sheet;
    let first = -1;
    for (let i = 0; i < cut.width * cut.height && first < 0; i++) if (cut.data[i * 4 + 3]! > 64) first = i;
    const fx = first % cut.width, fy = Math.floor(first / cut.width);
    const same = (ox: number, oy: number) => {
      for (let y = 0; y < cut.height; y += 3)
        for (let x = 0; x < cut.width; x += 3) {
          const i = ((oy + y) * W + ox + x) * 4, j = (y * cut.width + x) * 4;
          for (let c = 0; c < 4; c++) if (data[i + c] !== cut.data[j + c]) return false;
        }
      return true;
    };
    let found: [number, number] | null = null;
    const px = cut.data.slice(first * 4, first * 4 + 4);
    for (let y = fy; y < H && !found; y++)
      for (let x = fx; x < W && !found; x++) {
        const i = (y * W + x) * 4;
        if (data[i] !== px[0] || data[i + 1] !== px[1] || data[i + 2] !== px[2] || data[i + 3] !== px[3]) continue;
        const ox = x - fx, oy = y - fy;
        if (ox + cut.width <= W && oy + cut.height <= H && same(ox, oy)) found = [ox, oy];
      }
    expect(found).not.toBeNull();
    // Every pixel, not only every third.
    const [ox, oy] = found!;
    let changed = 0;
    for (let y = 0; y < cut.height; y++)
      for (let x = 0; x < cut.width; x++) {
        const i = ((oy + y) * W + ox + x) * 4, j = (y * cut.width + x) * 4;
        for (let c = 0; c < 4; c++) if (data[i + c] !== cut.data[j + c]) { changed++; break; }
      }
    expect(changed).toBe(0);
  });
});
