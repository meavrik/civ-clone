import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, newGame, type Region } from "@civ/core";
import { discoveryNote, NAME_REACH, placeLabels, placeLabelText, placeLine, placeTitle, terrainInfo } from "../src/index.js";

describe("place names", () => {
  it("names the places near our units out in the world, on squares well inside them", () => {
    const state = newGame(2026, { world: "earth", historical: true, opponents: 3 });
    const me = state.players[0]!;
    const settlers = state.units.find((u) => u.owner === 0)!;
    const view = [31, 9, 16, 12] as const;
    // Nothing explored on view: nothing named.
    me.explored.fill(0);
    expect(placeLabels(state, 0, ...view)).toEqual([]);
    me.explored.fill(1);
    // Explored everywhere, only what lies near the settlers is named: Europe under them, not the Black Sea.
    const labels = placeLabels(state, 0, ...view);
    const names = labels.map((l) => l.name);
    expect(names).toContain("Europe");
    expect(labels.find((l) => l.name === "Europe")!.land).toBe(true);
    expect(names).not.toContain("the Black Sea");
    expect(new Set(names).size).toBe(names.length);
    for (const l of labels) {
      expect(Math.abs(view[0] + l.tx - settlers.x)).toBeLessThanOrEqual(NAME_REACH);
      expect(Math.abs(view[1] + l.ty - settlers.y)).toBeLessThanOrEqual(NAME_REACH);
      expect(l.tx).toBeGreaterThanOrEqual(1);
      expect(l.tx).toBeLessThan(view[2] - 1);
    }
    // Continents come first, then the waters.
    expect(labels[0]!.kind).toBe("continent");
    // Walked to the Black Sea's shore, they name it.
    settlers.x = 44;
    settlers.y = 14;
    expect(placeLabels(state, 0, ...view).map((l) => l.name)).toContain("the Black Sea");
    // A unit in a city names nothing.
    applyCommand(state, { type: "found", unit: settlers.id });
    createUnit(state, "militia", 0, 44, 14);
    expect(placeLabels(state, 0, ...view)).toEqual([]);
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
