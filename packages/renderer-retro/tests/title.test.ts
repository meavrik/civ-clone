import { writeFileSync } from "node:fs";
import { INTRO_MS, introAt } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawTitleScreen } from "../src/index.js";
import { C } from "../src/palette.js";
import { encodePng } from "./png.js";
import { Surface } from "../src/surface.js";

describe("opening and title", () => {
  it("tells the story in order and ends on the name", () => {
    expect(introAt(0).caption).toBeUndefined();
    expect(introAt(4000).caption?.text).toMatch(/fire/);
    expect(introAt(4000).cool).toBe(0);
    expect(introAt(14000).sea).toBe(1);
    expect(introAt(INTRO_MS - 1).done).toBe(false);
    const end = introAt(INTRO_MS);
    expect(end).toMatchObject({ done: true, name: 1, life: 1, lights: 1 });
    expect(end.caption).toBeUndefined();
  });

  it("draws each stage of the opening, the same every time", () => {
    const s = Surface.screen();
    for (const [at, file] of [[4000, "intro-fire"], [10500, "intro-seas"], [18500, "intro-life"], [23500, "intro-towns"], [26000, "intro-name"], [INTRO_MS, "intro-end"]] as const) {
      drawTitleScreen(s, at);
      writeFileSync(new URL(`./out/${file}.png`, import.meta.url), encodePng(s, 3));
    }
    drawTitleScreen(s);
    const first = Uint8Array.from(s.data);
    drawTitleScreen(s);
    expect(s.data).toEqual(first);
    // The name across the top, the planet in the middle, black space at the corners.
    expect(s.get(160, 106)).not.toBe(C.BLACK!);
    expect(s.get(1, 198)).toBe(C.BLACK!);
  });
});
