import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WONDERS } from "../../../packages/core/src/rules/wonders.js";
import { BUILDING_CUTS } from "../../../packages/renderer-api/src/building-art.js";
import { wonderCuts, WONDER_SHEETS } from "../buildings/sheets.js";
import { piecesOf } from "../src/pieces.js";
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

  it("are the wonders' three stages on one canvas, in register, every pixel as supplied, nothing of them left out", () => {
    const seen: string[] = [];
    for (const { file, cell, wonders } of WONDER_SHEETS) {
      const sheet = read(`../buildings/${file}`);
      const { width: W, height: H, data } = sheet;
      const covered = new Uint8Array(W * H);
      for (const { id, w, h, stages } of wonderCuts(sheet, piecesOf(sheet).pieces, cell, wonders)) {
        seen.push(id);
        expect(stages.map((s) => s.name)).toEqual([`${id}-start`, `${id}-construction`, id]);
        // Their feet on the canvas, as the sheet draws them: within a few pixels, so the base stands still as it goes up.
        const feet = stages.map((s) => s.at[1] + s.h);
        expect(Math.max(...feet) - Math.min(...feet), id).toBeLessThanOrEqual(3);
        for (const s of stages) {
          const cut = read(`../../../apps/web/src/buildings/${s.name}.png`);
          expect([cut.width, cut.height], s.name).toEqual([w, h]);
          expect(BUILDING_CUTS[s.name], s.name).toEqual([w, h]);
          const changed: string[] = [];
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const j = (y * w + x) * 4;
              const sx = x - s.at[0], sy = y - s.at[1];
              if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) { if (cut.data[j + 3] !== 0) changed.push(`${x},${y} past its box`); continue; }
              const at = (s.y0 + sy) * W + s.x0 + sx;
              covered[at] = 1;
              for (let k = 0; k < 4; k++) if (data[at * 4 + k] !== cut.data[j + k]) { changed.push(`${x},${y}`); break; }
            }
          expect(changed.slice(0, 5), s.name).toEqual([]);
        }
      }
      let lost = 0;
      for (let i = 0; i < W * H; i++) if (data[i * 4 + 3]! > 64 && !covered[i]) lost++;
      expect(lost, file).toBe(0);
    }
    expect(seen.sort()).toEqual(WONDERS.map((w) => w.id).sort());
  });
});
