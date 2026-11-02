import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain } from "@civ/core";
import type { MainScreenView } from "@civ/renderer-api";
import { drawMainScreen, Surface } from "../src/index.js";

describe("a village entered", () => {
  it("stands on the map, and what it brought stays out of sight, until the village opens (view.villages)", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    applyCommand(state, { type: "found", unit: u.id });
    const city = state.cities[0]!;
    state.cities = [];
    const at = { x: city.x + 3, y: city.y + 2 };
    Object.assign(getTile(state.map, at.x, at.y)!, { terrain: Terrain.Grassland, hut: false, special: false, river: false, road: false });
    state.players[0]!.visible[at.y * state.map.width + at.x] = 1;
    // The rules have opened it already: a mercenary stands with our unit.
    const joined = createUnit(state, "phalanx", 0, at.x, at.y);
    const scout = createUnit(state, "militia", 0, at.x, at.y);
    const view: MainScreenView = { originX: city.x - 7, originY: Math.max(0, city.y - 6), blink: false, placeNames: false, civNames: false };
    const px = 80 + (at.x - view.originX) * 16, py = 9 + (at.y - view.originY) * 16;

    const opened = Surface.screen();
    drawMainScreen(opened, state, view);
    expect(opened.art.some((a) => a.hut && a.x === px && a.y === py)).toBe(false);
    // The first unit on a square stands for the stack: the phalanx, once the village is open.
    expect(opened.art.filter((a) => a.unit && a.x === px && a.y === py).map((a) => a.id)).toEqual(["phalanx"]);

    const held = Surface.screen();
    drawMainScreen(held, state, { ...view, villages: [{ x: at.x, y: at.y, units: [joined.id] }] });
    expect(held.art.some((a) => a.hut && a.x === px && a.y === py)).toBe(true);
    // Our unit stands on it; the phalanx it brought does not show yet.
    const units = held.art.filter((a) => a.unit && a.x === px && a.y === py).map((a) => a.id);
    expect(units).toContain(scout.type);
    expect(units).not.toContain(joined.type);
  });
});
