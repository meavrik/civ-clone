import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, revealAround, Terrain, type GameState } from "@civ/core";
import { SACK, sackBlows, sackFall, sackLength, type MainScreenView, type Sacking } from "@civ/renderer-api";
import { drawMainScreen, shade, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

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

  it("is sacked before it opens: the hut shaken and let down, its loot and dust on the map (view.sacking)", () => {
    const { state, at, view, px, py } = village();
    const scout = createUnit(state, "legion", 0, at.x, at.y);
    const blows = sackBlows(scout.type);
    const sack = (ms: number, loot: Sacking["loot"] = { kind: "coins", count: 7 }): Sacking => ({ x: at.x, y: at.y, unit: scout.id, loot, blows, ms });
    const draw = (sacking?: Sacking) => {
      const s = Surface.screen();
      drawMainScreen(s, state, { ...view, villages: [{ x: at.x, y: at.y, units: [] }], ...(sacking ? { sacking } : {}) });
      return s;
    };
    // Ours, on its square: shaken a pixel or so, let down at most its height.
    const hut = (s: Surface) => s.art.find((a) => a.hut && Math.abs(a.x - px) <= 2 && a.y >= py && a.y <= py + 16)!;
    const still = hut(draw());
    // Struck, the hut jolts sideways; between the blows it stands where it stood.
    expect(hut(draw(sack(blows[0]! + 20))).x).not.toBe(still.x);
    expect(hut(draw(sack(blows[0]! + SACK.shakeMs + 20))).x).toBe(still.x);
    // Going down, it is let down under its foot, nothing of it showing below.
    const going = hut(draw(sack(sackFall(blows) + SACK.fallMs / 2)));
    expect(going.y).toBeGreaterThan(still.y);
    expect(going.clip!.y + going.clip!.h).toBeLessThanOrEqual(py + 16);
    expect(going.clip!.y + going.clip!.h).toBeGreaterThan(py + 12);

    // The coins out of it, the dust as it goes: drawn over the square, the hut holed where they cross it.
    const plain = draw(sack(0));
    const near = (s: Surface, inks: number[]) => {
      let n = 0;
      for (let y = (py - 12) * s.k; y < (py + 20) * s.k; y++)
        for (let x = (px - 12) * s.k; x < (px + 28) * s.k; x++) if (inks.includes(s.fget(x, y)) && !inks.includes(plain.fget(x, y))) n++;
      return n;
    };
    // The coins' light and rim (the straw flying off a thatched hut is the coins' middle gold).
    const gold = [shade("wheat", 7), shade("mound", 3)];
    const last = blows[blows.length - 1]!;
    expect(near(plain, gold)).toBe(0);
    expect(near(draw(sack(last + 250)), gold)).toBeGreaterThan(10);
    expect(near(draw(sack(last + 250, null)), gold)).toBe(0);
    const scroll = [shade("rock", 7), shade("rock", 5)];
    expect(near(draw(sack(last + 500, { kind: "scroll" })), scroll)).toBeGreaterThan(10);
    const dust = [shade("dune", 2), shade("mound", 6), shade("mound", 4)];
    const dusty = draw(sack(sackFall(blows) + 200));
    expect(near(dusty, dust)).toBeGreaterThan(20);
    expect(hut(dusty).holes?.length ?? 0).toBeGreaterThan(0);

    // A strip of the show for the eye (the canvas only: the pictures are laid over it in the app).
    const frames = [0, blows[0]! + 40, last + 120, last + 300, sackFall(blows) + 200, sackFall(blows) + 500, sackLength(blows) - 300];
    const strip = new Surface(48 * frames.length, 48, undefined, 2);
    frames.forEach((ms, i) => {
      const s = draw(sack(ms));
      for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) strip.fset(i * 96 + x, y, s.fget((px - 16) * 2 + x, (py - 24) * 2 + y));
    });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/village-sack.png", import.meta.url), encodePng(strip, 4));
  });
});

/** A village our unit has walked into, on grassland in sight, the map's view round it, and where its square stands on screen. */
function village(): { state: GameState; at: { x: number; y: number }; view: MainScreenView; px: number; py: number } {
  const state = newGame(2026);
  const u = state.units[0]!;
  revealAround(state, 0, u.x, u.y, 9);
  applyCommand(state, { type: "found", unit: u.id });
  const city = state.cities[0]!;
  state.cities = [];
  state.units = state.units.filter((o) => o.owner !== 0);
  const at = { x: city.x + 3, y: city.y + 2 };
  Object.assign(getTile(state.map, at.x, at.y)!, { terrain: Terrain.Grassland, hut: false, special: false, river: false, road: false });
  state.players[0]!.visible[at.y * state.map.width + at.x] = 1;
  const view: MainScreenView = { originX: city.x - 7, originY: Math.max(0, city.y - 6), blink: false, placeNames: false, civNames: false };
  return { state, at, view, px: 80 + (at.x - view.originX) * 16, py: 9 + (at.y - view.originY) * 16 };
}
