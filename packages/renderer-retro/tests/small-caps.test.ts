import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { drawSmallCaps, drawTextRinged, FONT_HEIGHT, smallCapsWidth, SMALL_CAPS_HEIGHT, textWidth } from "../src/font.js";
import { C, shade } from "../src/palette.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

describe("small capitals", () => {
  it("write every letter five dots tall, smaller than the font, accents dropped", () => {
    const s = new Surface(160, 60, undefined, 2);
    s.fill(shade("sea", 0));
    drawSmallCaps(s, 4, 4, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", shade("rock", 5), shade("mound", 0));
    const names = ["North America", "Ausonia", "the Isle of Capua", "Shaka's Land", "Ginnungagap", "Ōsumi-jima"];
    names.forEach((n, i) => drawSmallCaps(s, 4 + (i % 2) * 78, 14 + Math.floor(i / 2) * 7, n, shade("rock", 5), shade("mound", 0)));
    // Beside the civilizations' names, as the minimap writes them.
    drawTextRinged(s, 4, 38, "Babylonians", shade("meadow", 6), C.BLACK!);
    drawSmallCaps(s, 70, 41, "Asia", shade("rock", 5), shade("mound", 0));
    writeFileSync(new URL("./out/small-caps.png", import.meta.url), encodePng(s, 4));
    expect(SMALL_CAPS_HEIGHT * 2).toBeLessThan(FONT_HEIGHT);
    expect(smallCapsWidth("Ōsumi")).toBe(smallCapsWidth("OSUMI"));
    expect(smallCapsWidth("asia")).toBe(smallCapsWidth("ASIA"));
    expect(smallCapsWidth("North America")).toBeLessThan(textWidth("North America"));
    // The letters stand five dots tall, with a dot of shadow under them: nothing below the third pixel.
    const t = new Surface(40, 8, undefined, 2);
    t.fill(0);
    drawSmallCaps(t, 0, 0, "QUAY", C.WHITE!, shade("mound", 0));
    let below = 0;
    for (let y = 6; y < t.fh; y++) for (let x = 0; x < t.fw; x++) if (t.fget(x, y) !== 0) below++;
    expect(below).toBe(0);
    expect(t.fget(2, 5)).toBe(shade("mound", 0));
  });
});
