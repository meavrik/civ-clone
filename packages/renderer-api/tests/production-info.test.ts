import { describe, expect, it } from "vitest";
import { applyCommand, newGame } from "@civ/core";
import { productionInfo } from "../src/index.js";

/** Our first city, founded where the game starts. */
function rome() {
  const state = newGame(2026);
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  return { state, city: state.cities[0]! };
}

describe("the build menu's info", () => {
  it("gives a unit's numbers, gifts, upkeep in its city, the resources it needs and what retires it", () => {
    const { state, city } = rome();
    const legion = productionInfo(state, 0, { kind: "unit", id: "legion" }, city);
    expect(legion.title).toBe("Legion");
    expect(legion.lines[0]).toBe("{swords}Attack 3  {tower}Defence 1  {boot}Moves 1");
    expect(legion.lines).toContain("{heart}Hit points 10, firepower 1");
    expect(legion.lines.some((l) => l.startsWith("{shield}Upkeep: 1 shield a turn once Rome's"))).toBe(true);
    expect(legion.lines).toContain("Needs Iron: we have none.");
    const settlers = productionInfo(state, 0, { kind: "unit", id: "settlers" }, city);
    expect(settlers.lines).toContain("Founds cities, and builds roads, farms and mines.");
    expect(settlers.lines.some((l) => l.endsWith("eats 1 food a turn."))).toBe(true);
    expect(productionInfo(state, 0, { kind: "unit", id: "militia" }, city).lines).toContain("{hourglass}No longer built once we can build Musketeers.");
    expect(productionInfo(state, 0, { kind: "unit", id: "chariot" }, city).lines).toContain("{hourglass}No longer built once we can build Knights.");
    state.noReplacements = true; // saves before version 65
    expect(productionInfo(state, 0, { kind: "unit", id: "militia" }, city).lines).toContain("{hourglass}No longer built once we know Gunpowder.");
    delete state.noReplacements;
    expect(productionInfo(state, 0, { kind: "unit", id: "trireme" }, city).lines).toContain("Must end its turn beside land, or it sinks in deep water.");
    // A city with Barracks trains its land units as veterans.
    city.buildings.push("barracks");
    expect(productionInfo(state, 0, { kind: "unit", id: "legion" }, city).lines).toContain("{veteran}Trained here as a Veteran (+50%).");
  });

  it("gives a building's purpose, its effects in numbers and its upkeep; a wonder's, and when its effect ends", () => {
    const { state, city } = rome();
    const temple = productionInfo(state, 0, { kind: "building", id: "temple" }, city);
    expect(temple.title).toBe("Temple");
    expect(temple.lines).toEqual(["Calms one unhappy citizen.", "{heart}+1 content citizen", "{culture}+2 culture", "{coin}Upkeep: 1 gold a turn"]);
    const colossus = productionInfo(state, 0, { kind: "wonder", id: "colossus" }, city);
    expect(colossus.lines).toContain("{trade}+1 trade on squares with trade");
    expect(colossus.lines).toContain("{star}One in all the world: the first city to finish it has it.");
    expect(colossus.lines).toContain("{hourglass}Its effect ends once we know Electricity.");
  });
});
