import { writeFileSync } from "node:fs";
import { INTRO_MS, loadingView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { textWidth } from "../src/font.js";
import { drawLoading, drawTitleScreen, loadingRect } from "../src/index.js";
import { shade } from "../src/palette.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

describe("the loading window", () => {
  it("stands over the darkened title with the save, a bar that fills as the turns replay, and the year", () => {
    const s = Surface.screen();
    const bars: number[][] = [];
    for (const [file, at] of [["loading-start", undefined], ["loading-half", { turn: 60, from: 0, to: 120 }], ["loading-end", { turn: 120, from: 0, to: 120 }]] as const) {
      drawTitleScreen(s, INTRO_MS);
      s.dimmed = false;
      drawLoading(s, loadingView("Babylonians, 1250 AD", at));
      writeFileSync(new URL(`./out/${file}.png`, import.meta.url), encodePng(s, 3));
      const o = loadingRect();
      const row = o.y + 11 + 6 + 13 + 4;
      bars.push(Array.from({ length: o.w - 32 }, (_, i) => s.get(o.x + 16 + i, row)));
    }
    // The bar's blue reaches further as the replay goes on.
    const lit = bars.map((b) => b.filter((c) => c !== shade("panel", 1)).length);
    expect(lit[0]).toBe(0);
    expect(lit[1]).toBeGreaterThan(0);
    expect(lit[2]).toBeGreaterThan(lit[1]!);
    expect(lit[2]).toBe(bars[2]!.length);
    // The longest words fit the window.
    const o = loadingRect();
    for (const text of ["Babylonians, 1250 AD", "Retracing history: 1250 AD", "Making the world..."]) expect(textWidth(text)).toBeLessThan(o.w - 16);
  });

  it("centres on the phone's wide map", () => {
    const s = new Surface(480, 200, undefined, 2);
    drawLoading(s, loadingView("Romans, 1200 BC", { turn: 30, from: 0, to: 60 }));
    writeFileSync(new URL("./out/loading-wide.png", import.meta.url), encodePng(s, 3));
    expect(loadingRect(480).x).toBe(140);
  });
});
