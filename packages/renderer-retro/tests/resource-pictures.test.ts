import { existsSync } from "node:fs";
import { DEPOSIT_BY_ID, newGame, specialFor, Terrain, TERRAIN_RULES } from "@civ/core";
import { RESOURCE_ART, RESOURCE_CELL, resourceArtPlace } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { C, drawMainScreen, drawSpecial, MAP_TILE, Surface, tileToScreen } from "../src/index.js";

/** A special's icon's name, as the resources sheet names it. */
const iconName = (name: string) => name.toLowerCase().replace(/ /g, "_");

describe("the user's pictures of the resources (2026-11-03, as is)", () => {
  it("has one for every special of the rules, on land and at sea, each a picture in the app", () => {
    const names = new Set<string>();
    for (const r of Object.values(TERRAIN_RULES)) for (const sp of [r.special, r.second]) if (sp && sp.name !== "Resources") names.add(iconName(sp.name));
    for (const d of Object.values(DEPOSIT_BY_ID)) names.add(iconName(d.special.name));
    names.add("offshore_oil");
    for (const n of names) expect(RESOURCE_ART[n], n).toBeDefined();
    for (const id of Object.keys(RESOURCE_ART)) expect(existsSync(new URL(`../../../apps/web/src/resources/${id}.png`, import.meta.url)), id).toBe(true);
  });

  it("lays the picture in the room its icon takes, centred, the sheet's cell to that room; the canvas left as it was", () => {
    const state = newGame(7);
    const tile = state.map.tiles.find((t) => t.terrain !== Terrain.Ocean && !t.rig && specialFor(state, t, 0))!;
    const id = iconName(specialFor(state, tile, 0)!.name);
    for (const [t, side, off] of [[20, 16, 2], [16, 16, 0], [32, 25.5, 3]] as const) {
      const s = Surface.fine(t, t);
      s.fill(C.MAGENTA!);
      const pics = { room: { x: 0, y: 0, w: t, h: t }, laid: [] };
      drawSpecial(s, 0, 0, state, tile, 0, t, pics);
      // Nothing drawn on the canvas: the picture stands over it.
      expect(s.data.every((c) => c === C.MAGENTA!)).toBe(true);
      expect(s.art).toEqual([{ id, resource: true, x: off, y: off, w: side, h: side, clip: pics.room }]);
      // Its square remembered as drawn, so what comes over it later shows through.
      expect(pics.laid.map((l: { copy: { x: number; y: number; w: number; h: number } }) => [l.copy.x, l.copy.y, l.copy.w, l.copy.h])).toEqual([[0, 0, t, t]]);
      const [w, h] = RESOURCE_ART[id]!;
      const box = resourceArtPlace(s.art[0]!)!;
      expect(box.w).toBeCloseTo((w * side) / RESOURCE_CELL);
      expect(box.h).toBeCloseTo((h * side) / RESOURCE_CELL);
      expect(box.x + box.w / 2).toBeCloseTo(off + side / 2);
      expect(box.y + box.h / 2).toBeCloseTo(off + side / 2);
    }
  });

  it("stands on the map, shaded whole out of sight as the square under it is", () => {
    const state = newGame(5, { opponents: 1 });
    const me = state.players[0]!;
    const w = state.map.width;
    const [x, y] = [30, 25];
    for (let j = y - 6; j <= y + 6; j++)
      for (let i = x - 9; i <= x + 9; i++) {
        const idx = j * w + i;
        Object.assign(state.map.tiles[idx]!, { terrain: Terrain.Plains, special: false, river: false, hut: false, road: false, irrigation: false, mine: false });
        delete state.map.tiles[idx]!.deposit;
        me.explored[idx] = 1;
        // In sight left of x, out of sight from it on.
        me.visible[idx] = i < x ? 1 : 0;
      }
    state.units = [];
    state.cities = [];
    for (const i of [x - 2, x + 2]) Object.assign(state.map.tiles[y * w + i]!, { special: true, deposit: "Sheep" });
    const view = { originX: x - 7, originY: y - 5, blink: false, placeNames: false, civNames: false, focus: null };
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    const sheep = s.art.filter((a) => a.resource && a.id === "sheep");
    expect(sheep.length).toBe(2);
    for (const i of [x - 2, x + 2]) {
      const [sx, sy] = tileToScreen(state, view, i, y)!;
      const spot = sheep.find((a) => a.x >= sx && a.x < sx + MAP_TILE && a.y >= sy && a.y < sy + MAP_TILE)!;
      expect(spot, `${i}`).toBeDefined();
      expect(spot.unseen === true, `${i}`).toBe(i >= x);
    }
  });
});
