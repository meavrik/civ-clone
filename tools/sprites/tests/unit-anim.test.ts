import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UNIT_ATLASES } from "@civ/renderer-api";
import { keyGreen } from "../src/chroma.js";
import { decodePng } from "../src/png.js";

const read = (p: string) => decodePng(new Uint8Array(readFileSync(new URL(p, import.meta.url))));

describe("a green screen", () => {
  it("goes clear behind the figures, their own pixels as they are, its blended edges part clear with no green", () => {
    const px = new Uint8Array([0, 255, 0, 255, 40, 22, 8, 255, 250, 170, 120, 255, 220, 0, 200, 255, 60, 150, 20, 255]);
    keyGreen(px);
    expect([...px.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...px.subarray(4, 16)]).toEqual([40, 22, 8, 255, 250, 170, 120, 255, 220, 0, 200, 255]);
    // An outline blended with the screen: its green down to its red, part clear.
    expect(px[17]).toBe(60);
    expect(px[19]).toBeGreaterThan(0);
    expect(px[19]).toBeLessThan(255);
  });
});

describe("the units' atlases", () => {
  it.each(["militia", "militia-travel", "militia-won", "settlers", "settlers-found"])("hold every pixel of each of the %s' frames as the user's sheet has it, and nothing else", (unit) => {
    const sheet = read(`../units/${unit}-anim.png`);
    // Sheets drawn on a green screen are keyed clear behind the figures first, as the cutter does.
    if (unit === "militia-won") keyGreen(sheet.data);
    const img = read(`../../../apps/web/src/units/${unit}-anim.png`);
    const atlas = UNIT_ATLASES[unit]!;
    const [w, h] = atlas.size;
    expect([img.width, img.height]).toEqual([w * atlas.frames.length, h]);
    let kept = 0;
    const wrong: string[] = [];
    atlas.frames.forEach((f, n) => {
      // Each canvas pixel is the sheet's pixel at the same place round the anchors, or clear.
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * img.width + n * w + x) * 4;
          if (!img.data[i + 3]) continue;
          const sx = f.anchor[0] - atlas.anchor[0] + x, sy = f.anchor[1] - atlas.anchor[1] + y;
          const j = (sy * sheet.width + sx) * 4;
          for (let c = 0; c < 4; c++) if (img.data[i + c] !== sheet.data[j + c]) { wrong.push(`${f.name} ${x},${y}`); break; }
          kept++;
        }
    });
    expect(wrong.slice(0, 5)).toEqual([]);
    // The frames' opaque pixels are all there (the few soft pixels nearer a neighbour aside).
    let solid = 0;
    for (let i = 3; i < sheet.data.length; i += 4) if (sheet.data[i]! > 64) solid++;
    expect(kept).toBeGreaterThan(solid);
  });
});
