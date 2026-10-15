import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newGame, reveal } from "@civ/core";
import { drawMainScreen, drawText, PALETTE, Surface, textWidth, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";

describe("retro renderer", () => {
  it("palette has 256 entries, EGA first", () => {
    expect(PALETTE.length).toBe(256);
    expect(PALETTE[15]).toEqual([255, 255, 255]);
  });

  it("font measures proportionally", () => {
    expect(textWidth("i")).toBeLessThan(textWidth("W"));
    const s = new Surface(64, 8);
    drawText(s, 0, 0, "Hi", 15);
    expect(s.data.some((c) => c === 15)).toBe(true);
  });

  it("renders the main screen without going out of palette", () => {
    const state = newGame(2026);
    // Find the 15x13 window with the most terrain variety so the frame is a
    // useful visual check of every tile type.
    let best = { x: 0, y: 0, score: -1 };
    for (let y = 1; y < 50 - 13; y++)
      for (let x = 0; x < 80; x++) {
        const seen = new Set<number>();
        let land = 0;
        for (let dy = 0; dy < 13; dy++)
          for (let dx = 0; dx < 15; dx++) {
            const t = state.map.tiles[(y + dy) * 80 + ((x + dx) % 80)]!;
            seen.add(t.terrain);
            if (t.terrain !== 0) land++;
          }
        const score = seen.size * 100 + land;
        if (score > best.score) best = { x, y, score };
      }
    for (let y = best.y - 3; y < best.y + 16; y++) for (let x = best.x - 3; x < best.x + 18; x++) reveal(state, x, y, 0);
    const view: MainScreenView = {
      originX: best.x,
      originY: best.y,
      unit: { x: best.x + 7, y: best.y + 6, name: "Settlers", moves: "1", owner: 0 },
      blink: true,
      gold: 0,
      taxRate: 5,
      luxRate: 0,
      sciRate: 5,
    };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    expect(s.data.length).toBe(320 * 200);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/main-screen.png", import.meta.url), encodePng(s, 3));
  });
});
