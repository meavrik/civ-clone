import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOUSE_ART } from "../../../packages/renderer-api/src/house-art.js";
import { HOUSE_CELL, HOUSE_MARGIN, HOUSE_ROWS } from "../houses/sheet.js";
import { piecesOf } from "../src/pieces.js";
import { decodePng } from "../src/png.js";

const read = (p: string) => decodePng(new Uint8Array(readFileSync(new URL(p, import.meta.url))));

describe("the houses' pictures", () => {
  it("are the user's 24 houses cut to their bounds, every pixel as supplied, nothing of them left out", () => {
    const sheet = read("../houses/houses.png");
    const { width: W, data } = sheet;
    const { pieces } = piecesOf(sheet);
    expect(pieces.length).toBe(24);
    expect(Object.keys(HOUSE_ART)).toEqual(HOUSE_ROWS.flat());
    let solid = 0, kept = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 64) solid++;
    HOUSE_ROWS.forEach((row, r) => row.forEach((id, c) => {
      const p = pieces.find((q) => Math.floor(q.sx / q.n / HOUSE_CELL) === c && Math.floor(q.sy / q.n / HOUSE_CELL) === r)!;
      const cut = read(`../../../apps/web/src/houses/${id}.png`);
      expect(HOUSE_ART[id]).toEqual([cut.width, cut.height]);
      const ox = p.x0 - HOUSE_MARGIN, oy = p.y0 - HOUSE_MARGIN;
      const changed: string[] = [];
      for (let y = 0; y < cut.height; y++)
        for (let x = 0; x < cut.width; x++) {
          const i = ((oy + y) * W + ox + x) * 4, j = (y * cut.width + x) * 4;
          if (cut.data[j + 3]! > 64) kept++;
          for (let k = 0; k < 4; k++) if (data[i + k] !== cut.data[j + k]) { changed.push(`${ox + x},${oy + y}`); break; }
        }
      expect(changed.slice(0, 5), id).toEqual([]);
    }));
    expect(kept).toBe(solid);
  });

  it("stand in rows with their feet level, so one scale keeps the sheet's sizes", () => {
    const { pieces } = piecesOf(read("../houses/houses.png"));
    for (let r = 0; r < 4; r++) {
      const feet = pieces.filter((p) => Math.floor(p.sy / p.n / HOUSE_CELL) === r).map((p) => p.y1);
      expect(Math.max(...feet) - Math.min(...feet)).toBeLessThanOrEqual(5);
    }
  });
});
