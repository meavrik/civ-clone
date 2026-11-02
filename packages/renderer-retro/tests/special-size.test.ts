import { describe, expect, it } from "vitest";
import { applyCommand, newGame, revealAround, specialFor, Terrain } from "@civ/core";
import type { MainScreenView } from "@civ/renderer-api";
import { C, drawMainScreen, drawSpecial, RESOURCE_SHEET, shade, SPRITE_CLEAR, specialSprite, Surface } from "../src/index.js";
import { drawResourceMark, MARK_SIZE } from "../src/marks.js";

describe("a resource on its square", () => {
  it("is its icon's own size on the 20-pixel squares and the original's, 0.8 of a larger square, centred", () => {
    const state = newGame(7);
    const tile = state.map.tiles.find((t) => t.terrain !== Terrain.Ocean && !t.rig && specialFor(state, t, 0))!;
    const icon = specialSprite(specialFor(state, tile, 0)!.name)!;
    const drawn = (t: number) => {
      const s = Surface.fine(t, t);
      s.fill(C.MAGENTA!);
      drawSpecial(s, 0, 0, state, tile, 0, t);
      let x0 = s.fw, y0 = s.fh, x1 = -1, y1 = -1;
      for (let j = 0; j < s.fh; j++) for (let i = 0; i < s.fw; i++) if (s.fget(i, j) !== C.MAGENTA!) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
      return { s, box: [x0, y0, x1, y1] };
    };
    // 20 pixels: the icon pixel for pixel, a margin of four fine pixels round it.
    const twenty = drawn(20).s;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) if (icon.fget(i, j) !== SPRITE_CLEAR) expect(twenty.fget(4 + i, 4 + j), `${i},${j}`).toBe(icon.fget(i, j));
    expect(drawn(20).box.every((v) => v >= 4 && v < 36)).toBe(true);
    // 16 pixels (the original's, the phone's): as before, the icon filling the square, nothing dropped.
    const sixteen = drawn(16).s;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) if (icon.fget(i, j) !== SPRITE_CLEAR) expect(sixteen.fget(i, j)).toBe(icon.fget(i, j));
    // 32 pixels (zoomed in): 0.8 of the square, 51 fine pixels across, centred.
    expect(drawn(32).box.every((v) => v >= 6 && v < 57)).toBe(true);
  });

  it("is its mark, a pictogram on a dark token in the top right corner, where a work stands on the square", () => {
    const state = newGame(7);
    const tile = state.map.tiles.find((t) => t.terrain !== Terrain.Ocean && !t.rig && specialFor(state, t, 0))!;
    for (const t of [16, 20]) {
      const s = Surface.fine(t, t);
      s.fill(C.MAGENTA!);
      drawSpecial(s, 0, 0, state, tile, 0, t, undefined, true);
      let x0 = s.fw, y0 = s.fh, x1 = -1, y1 = -1;
      const colours = new Set<number>();
      for (let j = 0; j < s.fh; j++) for (let i = 0; i < s.fw; i++) if (s.fget(i, j) !== C.MAGENTA!) { colours.add(s.fget(i, j)); x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
      // The token, MARK_SIZE fine pixels across, a fine pixel in from the top and the right; in its three colours.
      expect([x0, y0, x1, y1]).toEqual([t * 2 - MARK_SIZE - 1, 1, t * 2 - 2, MARK_SIZE]);
      expect([...colours].sort()).toEqual([shade("rock", 7), shade("steel", 0), shade("steel", 2)].sort());
    }
  });

  it("has a mark for every resource in the sheet", () => {
    for (const { name } of RESOURCE_SHEET.sprites) {
      const s = Surface.fine(20, 20);
      s.fill(C.MAGENTA!);
      drawResourceMark(s, 0, 0, name, 20);
      expect(s.data.some((c) => c === shade("rock", 7)), name).toBe(true);
    }
  });

  it("marks the resource under a city over the city's picture, on the map", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    revealAround(state, 0, u.x, u.y, 9);
    applyCommand(state, { type: "found", unit: u.id });
    const city = state.cities[0]!;
    const view: MainScreenView = { originX: city.x - 7, originY: Math.max(0, city.y - 6), blink: false, placeNames: false, civNames: false };
    const tile = state.map.tiles[city.y * state.map.width + city.x]!;
    const px = 80 + (city.x - view.originX) * 16, py = 9 + (city.y - view.originY) * 16;
    const spotOf = (s: Surface) => s.art.find((a) => a.city)!;
    Object.assign(tile, { special: false, deposit: undefined });
    let s = Surface.screen();
    drawMainScreen(s, state, view);
    expect(spotOf(s).holes).toBeUndefined();
    Object.assign(tile, { deposit: "Horses", special: true });
    s = Surface.screen();
    drawMainScreen(s, state, view);
    // The mark's token is drawn over the city's square, and shows through the city's picture.
    const holes = spotOf(s).holes ?? [];
    expect(holes.length).toBeGreaterThan(0);
    expect(holes.every((h) => h.x >= px + 16 - MARK_SIZE / 2 - 1 && h.y < py + 1 + MARK_SIZE / 2)).toBe(true);
  });
});
