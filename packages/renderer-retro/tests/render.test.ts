import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain } from "@civ/core";
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

  it("renders the main screen with overlays and units", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    // Reveal a neighbourhood and dress it with improvements so every overlay shows.
    revealAround(state, 0, u.x, u.y, 9);
    const here = getTile(state.map, u.x, u.y)!;
    here.road = true;
    for (const [dx, dy] of [[1, 0], [2, 0], [2, 1]] as const) {
      const t = getTile(state.map, u.x + dx, u.y + dy)!;
      t.road = true;
    }
    const irr = getTile(state.map, u.x - 1, u.y)!;
    irr.terrain = Terrain.Plains;
    irr.irrigation = true;
    const mine = getTile(state.map, u.x, u.y + 1)!;
    mine.terrain = Terrain.Hills;
    mine.mine = true;
    const m = createUnit(state, "militia", 0, u.x + 2, u.y + 1);
    applyCommand(state, { type: "fortify", unit: m.id });
    applyCommand(state, { type: "endTurn" });
    createUnit(state, "trireme", 0, u.x + 1, u.y - 2);
    state.activeUnit = u.id;

    const view: MainScreenView = {
      originX: u.x - 7,
      originY: Math.max(0, u.y - 6),
      blink: true,
      gold: 0,
      taxRate: 5,
      luxRate: 0,
      sciRate: 5,
      message: "Zone of control",
    };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    expect(s.data.length).toBe(320 * 200);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/main-screen.png", import.meta.url), encodePng(s, 3));
  });
});
