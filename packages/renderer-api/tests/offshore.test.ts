import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, foundCity, getTile, newGame, Terrain, type GameState } from "@civ/core";
import { resourcesView, resourcesWantingRigs, resourcesWantingRoads, rigNote, terrainInfo, workRefusal } from "../src/index.js";

/** Our city by the sea on flat grassland, knowing Refining, with oil at sea beside it and no rig on it. */
function world(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.special = false; t.hut = false;
    delete t.deposit; delete t.rig;
  }
  s.units = []; s.cities = [];
  s.players[0]!.advances.push("seafaring", "refining");
  Object.assign(getTile(s.map, 11, 10)!, { terrain: Terrain.Ocean, special: true, deposit: "Oil" });
  foundCity(s, 0, 10, 10);
  s.players[0]!.explored.fill(1);
  return s;
}

describe("oil at sea, as the game tells of it (save version 55)", () => {
  it("wants an oil rig, not a road: the Resources window, the build menu's note, the square's window", () => {
    const s = world();
    const oil = resourcesView(s, 0).entries.find((e) => e.id === "Oil")!;
    expect(oil).toMatchObject({ status: "road", badge: "Wants rig" });
    expect(oil.detail).toMatch(/1 square near .* wants an oil rig: a Fishing Boat builds one/);
    expect(resourcesView(s, 0).hint).toContain("At sea, an oil rig.");
    expect(resourcesWantingRoads(s, 0)).toEqual([]);
    expect(resourcesWantingRigs(s, 0)).toEqual(["Oil"]);
    expect(rigNote(["Oil"])).toBe("{shield} Our Oil lies unused at sea: a Fishing Boat builds a rig");
    expect(terrainInfo(s, 11, 10).lines).toContain("{shield} No use to anyone until a Fishing Boat builds an oil rig on it");
    // Built, it serves: held, and the square's window names the rig and what it adds.
    expect(applyCommand(s, { type: "rig", unit: createUnit(s, "fishing_boat", 0, 11, 10).id }).ok).toBe(true);
    expect(resourcesView(s, 0).entries.find((e) => e.id === "Oil")).toMatchObject({ status: "held", badge: "Held" });
    expect(resourcesWantingRigs(s, 0)).toEqual([]);
    const lines = terrainInfo(s, 11, 10).lines;
    expect(lines.some((l) => l.includes("{shield} Oil rig +1 {shield}"))).toBe(true);
    expect(lines.some((l) => l.includes("No use to anyone"))).toBe(false);
  });

  it("says why a boat cannot build one", () => {
    expect(workRefusal("no oil")).toBe("No oil at sea here.");
    expect(workRefusal("has rig")).toBe("Already has an oil rig.");
    expect(workRefusal("needs:refining")).toBe("Needs Refining.");
  });
});
