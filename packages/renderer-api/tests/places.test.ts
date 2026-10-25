import { describe, expect, it } from "vitest";
import { landAt, newGame, placeAt, type Region } from "@civ/core";
import { discoveryNote, NAME_REACH, placeLabel, placeLabelText, placeLine, placeTitle, terrainInfo } from "../src/index.js";

describe("place names", () => {
  it("names one place at a time, the nearest to the unit in play, near the unit", () => {
    const state = newGame(2026, { world: "earth", historical: true, opponents: 3 });
    const me = state.players[0]!;
    const settlers = state.units.find((u) => u.owner === 0)!;
    expect(state.activeUnit).toBe(settlers.id);
    const view = [31, 9, 16, 12] as const;
    // Nothing explored on view: nothing named.
    me.explored.fill(0);
    expect(placeLabel(state, 0, ...view)).toBeNull();
    me.explored.fill(1);
    // The land the settlers stand on, near them, not on their square, a square in from the view's sides.
    const label = placeLabel(state, 0, ...view)!;
    expect(label).toMatchObject({ name: "Europe", land: true });
    for (const { tx, ty } of label.at) {
      expect(Math.abs(view[0] + tx - settlers.x)).toBeLessThanOrEqual(NAME_REACH);
      expect(Math.abs(view[1] + ty - settlers.y)).toBeLessThanOrEqual(NAME_REACH);
    }
    const first = label.at[0]!;
    expect(first.tx).toBeGreaterThanOrEqual(1);
    expect(first.tx).toBeLessThan(view[2] - 1);
    expect(view[1] + first.ty).not.toBe(settlers.y);
    // At sea the sea is named; in mountains the range before the land under it.
    const at = (x: number, y: number) => { settlers.x = x; settlers.y = y; return placeLabel(state, 0, ...view)?.name; };
    const g = state.map.geography!;
    const black = g.place.findIndex((r) => r >= 0 && g.regions[r]!.name === "the Black Sea");
    expect(at(black % state.map.width, Math.floor(black / state.map.width))).toBe("the Black Sea");
    let range = -1;
    for (let y = view[1] + 2; y < view[1] + view[3] - 2 && range < 0; y++)
      for (let x = view[0] + 2; x < view[0] + view[2] - 2; x++)
        if (placeAt(state.map, x, y)?.kind === "mountains" && landAt(state.map, x, y)) { range = y * state.map.width + x; break; }
    expect(range).toBeGreaterThanOrEqual(0);
    expect(at(range % state.map.width, Math.floor(range / state.map.width))).toBe(g.regions[g.place[range]!]!.name);
    // No unit of ours in play: nothing named.
    state.activeUnit = null;
    expect(placeLabel(state, 0, ...view)).toBeNull();
  });

  it("says where a square lies in its window", () => {
    const state = newGame(3, { world: "earth", historical: true, opponents: 2 });
    const rome = state.units.find((u) => u.owner === 0)!;
    expect(placeLine(state, rome.x, rome.y)).toMatch(/Europe$/);
    expect(terrainInfo(state, rome.x, rome.y).lines[2]).toBe(placeLine(state, rome.x, rome.y));
    expect(placeLabelText("the Sea of Caesar")).toBe("Sea of Caesar");
    expect(placeTitle("the Sahara, Africa")).toBe("The Sahara, Africa");
  });

  it("tells of new places waters first, then lands, then landforms", () => {
    const found: Region[] = [
      { kind: "desert", size: 9, name: "the Caesar Desert" },
      { kind: "continent", size: 300, name: "Caesar's Land" },
      { kind: "lake", size: 3, name: "Lake Caesar" },
    ];
    expect(discoveryNote(found)).toBe("Discovered: Lake Caesar, Caesar's Land, the Caesar Desert");
    const many = Array.from({ length: 6 }, (_, i): Region => ({ kind: "lake", size: 9 - i, name: `Lake ${i}` }));
    expect(discoveryNote(many)).toBe("Discovered: Lake 0, Lake 1, Lake 2 and 3 more");
  });
});
