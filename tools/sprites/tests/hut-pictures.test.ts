import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HUT_ART } from "../../../packages/renderer-api/src/hut-art.js";
import { decodePng } from "../src/png.js";

const read = (p: string) => decodePng(new Uint8Array(readFileSync(new URL(p, import.meta.url))));

describe("the villages' pictures", () => {
  it("are the user's five huts cut to their bounds, every pixel as supplied, nothing of them left out", () => {
    const sheet = read("../huts/huts.png");
    const { width: W, height: H, data } = sheet;
    const solid = (x: number, y: number) => data[(y * W + x) * 4 + 3]! > 64;
    // The huts stand apart in the sheet's row: each is a run of columns holding solid pixels.
    const runs: [number, number][] = [];
    for (let x = 0; x < W; x++) {
      let any = false;
      for (let y = 0; y < H && !any; y++) any = solid(x, y);
      const last = runs[runs.length - 1];
      if (any && last && last[1] === x - 1) last[1] = x;
      else if (any) runs.push([x, x]);
    }
    const huts = runs.filter(([a, b]) => b - a > 100);
    expect(huts.length).toBe(5);
    const kinds = ["thatch", "timber", "adobe", "tent", "cottage"];
    expect(Object.keys(HUT_ART)).toEqual(kinds);
    const covered = new Uint8Array(W * H);
    huts.forEach(([a, b], n) => {
      const cut = read(`../../../apps/web/src/huts/${kinds[n]}.png`);
      expect(HUT_ART[kinds[n]!]).toEqual([cut.width, cut.height]);
      let top = H;
      for (let y = 0; y < H; y++) for (let x = a; x <= b; x++) if (solid(x, y)) top = Math.min(top, y);
      const ox = Math.max(0, a - 2), oy = Math.max(0, top - 2);
      const changed: string[] = [];
      for (let y = 0; y < cut.height; y++)
        for (let x = 0; x < cut.width; x++) {
          const i = ((oy + y) * W + ox + x) * 4, j = (y * cut.width + x) * 4;
          covered[(oy + y) * W + ox + x] = 1;
          for (let c = 0; c < 4; c++) if (data[i + c] !== cut.data[j + c]) { changed.push(`${ox + x},${oy + y}`); break; }
        }
      expect(changed.slice(0, 5), kinds[n]).toEqual([]);
    });
    let lost = 0;
    for (let i = 0; i < W * H; i++) if (data[i * 4 + 3]! > 64 && !covered[i]) lost++;
    expect(lost).toBe(0);
  });
});
