import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unitArtPlace } from "@civ/renderer-api";
import { UNIT_ART } from "../../../packages/renderer-api/src/unit-art.js";
import { decodePng } from "../src/png.js";

const read = (p: string) => decodePng(new Uint8Array(readFileSync(new URL(p, import.meta.url))));

describe("a unit's picture of its own", () => {
  it.each([["archers", 1400], ["elephants", 1250], ["explorer", 1600]] as const)("is the user's picture cut to its bounds, every pixel as supplied, nothing of it left out: %s", (id, square) => {
    const pic = read(`../units/${id}.png`);
    const cut = read(`../../../apps/web/src/units/${id}.png`);
    expect(UNIT_ART[id]).toEqual([cut.width, cut.height, square]);
    // Where the cut lies in the picture: its solid pixels' bounds, two pixels out.
    let ox = pic.width, oy = pic.height;
    for (let y = 0; y < pic.height; y++)
      for (let x = 0; x < pic.width; x++) if (pic.data[(y * pic.width + x) * 4 + 3]! > 64) { ox = Math.min(ox, x); oy = Math.min(oy, y); }
    [ox, oy] = [Math.max(0, ox - 2), Math.max(0, oy - 2)];
    // Inside it every pixel as supplied; outside, only faint ones (alpha 64 or less).
    const changed: string[] = [];
    let lost = 0;
    for (let y = 0; y < pic.height; y++)
      for (let x = 0; x < pic.width; x++) {
        const i = (y * pic.width + x) * 4;
        if (x >= ox && y >= oy && x < ox + cut.width && y < oy + cut.height) {
          const j = ((y - oy) * cut.width + x - ox) * 4;
          for (let c = 0; c < 4; c++) if (pic.data[i + c] !== cut.data[j + c]) { changed.push(`${x},${y}`); break; }
        } else if (pic.data[i + 3]! > 64) lost++;
      }
    expect(changed.slice(0, 5)).toEqual([]);
    expect(lost).toBe(0);
  });

  it("stands at its own scale, the archer and the explorer as tall as the sheet's militia, on the square's foot", () => {
    const box = unitArtPlace({ id: "archers", unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    const [w, h] = UNIT_ART.archers!;
    expect(box.w).toBeCloseTo((w / 1400) * 16, 6);
    expect(box.h).toBeCloseTo((h / 1400) * 16, 6);
    expect(box.x + box.w / 2).toBeCloseTo(8, 6);
    expect(box.y + box.h).toBeCloseTo(16 - 0.5, 6);
    // Helmet to feet 973 of its pixels; the militia 166 of the sheet's 240; the explorer's hat to his boots 1113.
    expect(973 / 1400).toBeCloseTo(166 / 240, 2);
    expect(1113 / 1600).toBeCloseTo(166 / 240, 2);
    const explorer = unitArtPlace({ id: "explorer", unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    expect(explorer.x + explorer.w / 2).toBeCloseTo(8, 6);
    expect(explorer.y + explorer.h).toBeCloseTo(16 - 0.5, 6);
  });

  it("stands the war elephant as wide as its square allows, as the chariot, and taller than its horses", () => {
    const at = (id: string) => unitArtPlace({ id, unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    const elephant = at("elephants");
    expect(elephant.w).toBeCloseTo(at("chariot").w, 6);
    expect(elephant.w).toBeCloseTo(16 * 0.97, 6);
    expect(elephant.x + elephant.w / 2).toBeCloseTo(8, 6);
    expect(elephant.y + elephant.h).toBeCloseTo(16 - 0.5, 6);
    expect(elephant.h).toBeGreaterThan(at("chariot").h);
  });
});
