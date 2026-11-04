import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILDING_CUTS } from "../../../packages/renderer-api/src/building-art.js";
import { decodePng } from "../src/png.js";

const read = (p: string) => decodePng(new Uint8Array(readFileSync(new URL(p, import.meta.url))));

describe("the improvements' pictures", () => {
  it("are the user's 27 cut to their bounds in the rules' order, every pixel as supplied, nothing of them left out", () => {
    const { width: W, height: H, data } = read("../buildings/buildings.png");
    const solid = (x: number, y: number) => data[(y * W + x) * 4 + 3]! > 64;
    /** Runs of `n` lines that `any` finds solid. */
    const runs = (n: number, any: (i: number) => boolean) => {
      const out: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        if (!any(i)) continue;
        const last = out[out.length - 1];
        if (last && last[1] === i - 1) last[1] = i;
        else out.push([i, i]);
      }
      return out;
    };
    const across = (a: number, b: number, test: (x: number, y: number) => boolean, x: number) => {
      for (let y = a; y <= b; y++) if (test(x, y)) return true;
      return false;
    };
    const rows = runs(H, (y) => { for (let x = 0; x < W; x++) if (solid(x, y)) return true; return false; });
    expect(rows.length).toBe(4);
    const names = Object.keys(BUILDING_CUTS).slice(0, 27);
    // The first of each row of seven: the pictures stand in the rules' order, so the names fall as the sheet lays them.
    expect([names[0], names[7], names[14], names[21]]).toEqual(["palace", "courthouse", "colosseum", "nuclear_plant"]);
    const covered = new Uint8Array(W * H);
    let n = 0;
    for (const [top, bottom] of rows) {
      const inRow = runs(W, (x) => across(top, bottom, solid, x)).filter(([a, b]) => b - a > 100);
      for (const [a, b] of inRow) {
        const id = names[n++]!;
        const cut = read(`../../../apps/web/src/buildings/${id}.png`);
        expect(BUILDING_CUTS[id]).toEqual([cut.width, cut.height]);
        let high = H;
        for (let y = top; y <= bottom; y++) for (let x = a; x <= b; x++) if (solid(x, y)) high = Math.min(high, y);
        const ox = a - 2, oy = high - 2;
        const changed: string[] = [];
        for (let y = 0; y < cut.height; y++)
          for (let x = 0; x < cut.width; x++) {
            const i = ((oy + y) * W + ox + x) * 4, j = (y * cut.width + x) * 4;
            covered[(oy + y) * W + ox + x] = 1;
            for (let c = 0; c < 4; c++) if (data[i + c] !== cut.data[j + c]) { changed.push(`${ox + x},${oy + y}`); break; }
          }
        expect(changed.slice(0, 5), id).toEqual([]);
      }
    }
    expect(n).toBe(27);
    let lost = 0;
    for (let i = 0; i < W * H; i++) if (data[i * 4 + 3]! > 64 && !covered[i]) lost++;
    expect(lost).toBe(0);
  });

  it("are the wonders' three stages, each wonder's in one box, every pixel as supplied, nothing of them left out", () => {
    const { width: W, height: H, data } = read("../buildings/wonders-1.png");
    const CELL = 418, MARGIN = 2;
    const solid = (x: number, y: number) => data[(y * W + x) * 4 + 3]! > 64;
    const covered = new Uint8Array(W * H);
    ["pyramids", "hanging_gardens", "colossus"].forEach((id, r) => {
      let x0 = CELL * 2, y0 = CELL * 2, x1 = -CELL, y1 = -CELL;
      for (let c = 0; c < 3; c++)
        for (let y = r * CELL; y < (r + 1) * CELL; y++)
          for (let x = c * CELL; x < Math.min(W, (c + 1) * CELL); x++)
            if (solid(x, y)) { x0 = Math.min(x0, x - c * CELL); x1 = Math.max(x1, x - c * CELL); y0 = Math.min(y0, y - r * CELL); y1 = Math.max(y1, y - r * CELL); }
      const w = x1 - x0 + 1 + 2 * MARGIN, h = y1 - y0 + 1 + 2 * MARGIN;
      [`${id}-start`, `${id}-construction`, id].forEach((name, c) => {
        const cut = read(`../../../apps/web/src/buildings/${name}.png`);
        expect(BUILDING_CUTS[name]).toEqual([w, h]);
        expect([cut.width, cut.height], name).toEqual([w, h]);
        const ox = c * CELL + x0 - MARGIN, oy = r * CELL + y0 - MARGIN;
        const changed: string[] = [];
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const i = ((oy + y) * W + ox + x) * 4, j = (y * w + x) * 4;
            covered[(oy + y) * W + ox + x] = 1;
            for (let k = 0; k < 4; k++) if (data[i + k] !== cut.data[j + k]) { changed.push(`${ox + x},${oy + y}`); break; }
          }
        expect(changed.slice(0, 5), name).toEqual([]);
      });
    });
    let lost = 0;
    for (let i = 0; i < W * H; i++) if (data[i * 4 + 3]! > 64 && !covered[i]) lost++;
    expect(lost).toBe(0);
  });
});
