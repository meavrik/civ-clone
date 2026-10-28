import { describe, expect, it } from "vitest";
import { foundCity, getTile, newGame, Terrain, type GameState } from "@civ/core";
import { discoveryNote, knownResourceSquares, newTechCard, resourceReveals, resourcesReport, techDetails, terrainInfo } from "../src/index.js";

/** Grassland round (20, 20), all of it explored by player 0, our city there; Iron at (21, 21) on our land and (26, 20) near it. */
function field(): GameState {
  const s = newGame(2026, { opponents: 1 });
  s.units = [];
  s.cities = [];
  for (const t of s.map.tiles) {
    Object.assign(t, { terrain: Terrain.Ocean, river: false, special: false, hut: false, continent: 0 });
    delete t.deposit;
  }
  for (let y = 8; y < 32; y++) for (let x = 8; x < 32; x++) Object.assign(getTile(s.map, x, y)!, { terrain: Terrain.Grassland, continent: 1, grassShield: false });
  s.players[0]!.explored.fill(1);
  s.players[0]!.visible.fill(1);
  s.players[0]!.advances = [];
  foundCity(s, 0, 20, 20);
  for (const [x, y] of [[21, 21], [26, 20]] as const) Object.assign(getTile(s.map, x, y)!, { special: true, deposit: "Iron" });
  return s;
}

describe("resources revealed by an advance", () => {
  it("hide their squares from the map's words until the advance, then tell where they lie", () => {
    const s = field();
    expect(knownResourceSquares(s, 0).size).toBe(0);
    expect(terrainInfo(s, 21, 21).lines.join(" ")).not.toContain("Iron");
    expect(resourcesReport(s).lines.find((l) => l.text === "Iron")).toMatchObject({ right: "unseen until Bronze Working", dim: true });
    // The research card and the New Technology window say what the advance shows.
    expect(techDetails(s, "bronze_working").rows.find((r) => r.label === "Reveals")?.items).toEqual(["Iron"]);
    s.players[0]!.advances.push("bronze_working");
    expect(newTechCard(s, "bronze_working").unlocks).toContainEqual({ icon: "gem", name: "Iron", kind: "now on the map", resource: "Iron" });
    expect(knownResourceSquares(s, 0).size).toBe(2);
    expect(terrainInfo(s, 21, 21).lines.join(" ")).toContain("Iron is needed for");
    const [rv] = resourceReveals(s, 0, ["bronze_working"]);
    expect(rv).toMatchObject({ id: "Iron", focus: { x: 21, y: 21 }, text: "Iron revealed: 1 on our land, 1 nearby" });
    expect(rv!.squares).toHaveLength(2);
    expect(resourceReveals(s, 0, ["pottery"])).toEqual([]);
  });

  it("say when none lies on our land, and name a find among the places", () => {
    const s = field();
    getTile(s.map, 21, 21)!.special = false;
    s.players[0]!.advances.push("bronze_working");
    expect(resourceReveals(s, 0, ["bronze_working"])[0]).toMatchObject({ focus: { x: 26, y: 20 }, text: "Iron revealed: none on our land yet, 1 nearby" });
    expect(discoveryNote([], ["Iron"])).toBe("Discovered: Iron");
    // Saves before version 40 see every resource from the start: nothing is revealed.
    s.visibleResources = true;
    expect(resourceReveals(s, 0, ["bronze_working"])).toEqual([]);
  });
});
