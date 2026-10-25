import { describe, expect, it } from "vitest";
import { newGame, type Region } from "@civ/core";
import { discoveryNote, placeLabels, placeLabelText, placeLine, placeTitle, terrainInfo } from "../src/index.js";

describe("place names", () => {
  it("names the places on view where the player has explored, on squares well inside them", () => {
    const state = newGame(2026, { world: "earth", historical: true, opponents: 3 });
    const me = state.players[0]!;
    // Nothing explored on view: nothing named.
    me.explored.fill(0);
    expect(placeLabels(state, 0, 27, 8, 16, 12)).toEqual([]);
    me.explored.fill(1);
    const labels = placeLabels(state, 0, 27, 8, 16, 12);
    const names = labels.map((l) => l.name);
    expect(names).toContain("the Mediterranean Sea");
    expect(names).toContain("Europe");
    expect(labels.find((l) => l.name === "Europe")!.land).toBe(true);
    // Continents come first, then the waters; no name twice; each on view, a square in from the sides.
    expect(labels[0]!.kind).toBe("continent");
    expect(new Set(names).size).toBe(names.length);
    for (const l of labels) {
      expect(l.tx).toBeGreaterThanOrEqual(1);
      expect(l.tx).toBeLessThan(15);
      expect(l.ty).toBeGreaterThanOrEqual(0);
      expect(l.ty).toBeLessThan(12);
    }
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
