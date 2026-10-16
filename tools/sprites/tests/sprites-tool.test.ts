import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sheetFromImage, sheetImage, SHEETS, sheetText } from "@civ/renderer-retro";
import { artModule } from "../src/cli.js";
import { decodePng, encodePng } from "../src/png.js";

describe("sprite tool", () => {
  it("reads back every PNG filter type it writes", () => {
    const img = sheetImage(SHEETS.units!);
    for (const filter of [0, 1, 2, 3, 4] as const) {
      const back = decodePng(encodePng(img, filter));
      expect(back.width).toBe(img.width);
      expect(back.height).toBe(img.height);
      expect(Buffer.from(back.data).equals(Buffer.from(img.data))).toBe(true);
    }
  });

  it("round-trips every sheet through a PNG file and prints the same art module", () => {
    for (const [name, sheet] of Object.entries(SHEETS)) {
      const text = sheetFromImage(sheet, decodePng(encodePng(sheetImage(sheet))));
      expect(text).toBe(sheetText(sheet));
      // The committed art file is exactly what an import would write.
      const file = readFileSync(new URL(`../../../packages/renderer-retro/src/art/${name}.art.ts`, import.meta.url), "utf8");
      expect(file).toBe(artModule(name, text));
    }
  });
});
