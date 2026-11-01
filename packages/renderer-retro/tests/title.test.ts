import { writeFileSync } from "node:fs";
import { INTRO_MS, introAt } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawTitleName, drawTitleScreen, TITLE_NAME_BOTTOM } from "../src/index.js";
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

describe("the title", () => {
  it("lays the byline between its rules over the name, all of it above the line menus keep below", () => {
    const s = Surface.screen();
    drawTitleName(s, 1);
    const rows = new Array<number>(s.fh).fill(0);
    let left = s.fw, right = 0;
    for (let y = 0; y < s.fh; y++) {
      for (let x = 0; x < s.fw; x++) {
        if (s.fget(x, y) === 0) continue;
        rows[y]!++;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    const inked = rows.flatMap((n, y) => (n ? [y] : []));
    expect(inked.at(-1)!).toBeLessThan(TITLE_NAME_BOTTOM * s.k);
    // Centred, across most of the screen.
    expect(Math.abs(left - (s.fw - 1 - right))).toBeLessThanOrEqual(2);
    expect(right - left).toBeGreaterThan(s.fw * 0.7);
    // The rules run on both sides of the byline: on their row, ink near both ends of the name.
    const rule = inked.findIndex((y) => rows[y]! > s.fw * 0.5);
    expect(rule).toBeGreaterThanOrEqual(0);
    const y = inked[rule]!;
    expect(s.fget(left + 4, y)).not.toBe(0);
    expect(s.fget(right - 4, y)).not.toBe(0);
  });

  it("comes up out of the dark: nothing at first, the middle of the word before its ends", () => {
    const lit = (name: number) => {
      const s = Surface.screen();
      drawTitleName(s, name);
      let middle = 0, ends = 0;
      for (let y = 0; y < s.fh; y++) {
        for (let x = 0; x < s.fw; x++) {
          if (s.fget(x, y) === 0) continue;
          if (Math.abs(x - s.fw / 2) < s.fw * 0.1) middle++;
          else if (Math.abs(x - s.fw / 2) > s.fw * 0.3) ends++;
        }
      }
      return { middle, ends };
    };
    expect(lit(0.02)).toEqual({ middle: 0, ends: 0 });
    const rising = lit(0.35);
    expect(rising.middle).toBeGreaterThan(0);
    expect(rising.ends).toBe(0);
  });
});
