import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, newGame } from "@civ/core";
import { CITIZEN_LEGS, CITIZEN_SKINS, citizenLook, citizenNote, citizenRole, citizenRow, isWorker, nextSpecialist } from "../src/index.js";

describe("citizens", () => {
  it("are the same people every time a city is drawn", () => {
    for (let i = 0; i < 20; i++) expect(citizenLook(4, i)).toEqual(citizenLook(4, i));
    expect(Array.from({ length: 12 }, (_, i) => citizenLook(4, i))).not.toEqual(Array.from({ length: 12 }, (_, i) => citizenLook(5, i)));
  });

  it("stand in a row of workers by mood, then specialists, whose jobs a click turns round", () => {
    const state = newGame(2026);
    applyCommand(state, { type: "found", unit: state.units[0]!.id });
    const city = state.cities[0]!;
    city.size = 5;
    autoAssignWorkers(state, city);
    applyCommand(state, { type: "toggleTile", city: city.id, slot: city.worked[0]! });
    applyCommand(state, { type: "toggleTile", city: city.id, slot: city.worked[0]! });
    applyCommand(state, { type: "setSpecialist", city: city.id, index: 1, specialist: "scientist" });
    const row = citizenRow(state, city);
    expect(row).toHaveLength(5);
    expect(row.slice(3)).toEqual(["entertainer", "scientist"]);
    expect(row.slice(0, 3).every(isWorker)).toBe(true);
    // Happy before content before unhappy.
    const rank = { happy: 0, content: 1, unhappy: 2 } as Record<string, number>;
    expect(row.slice(0, 3).map((w) => rank[w])).toEqual([...row.slice(0, 3).map((w) => rank[w]!)].sort());
    // The original's round of trades.
    expect(["entertainer", "taxman", "scientist"].map((s) => nextSpecialist(s as "taxman"))).toEqual(["taxman", "scientist", "entertainer"]);
    // With a square free, the scientist goes back to work on the land.
    expect(["entertainer", "taxman", "scientist"].map((s) => nextSpecialist(s as "taxman", true))).toEqual(["taxman", "scientist", null]);
    expect(citizenNote("scientist", true)).toBe("Scientist, +2 science. Click to work the land");
    expect(citizenRole("taxman")).toBe("Taxman, +2 tax");
    expect(citizenNote("content")).toBe("Content worker. Click for an entertainer");
    expect(citizenNote("scientist")).toBe("Scientist, +2 science. Click for an entertainer");
  });

  it("mix men and women of every skin, hair and look", () => {
    const people = Array.from({ length: 30 }, (_, c) => Array.from({ length: 12 }, (_, i) => citizenLook(c, i))).flat();
    expect(new Set(people.map((p) => `${p.woman}${p.style}`)).size).toBe(4);
    expect(new Set(people.map((p) => p.skin)).size).toBe(CITIZEN_SKINS);
    expect(new Set(people.map((p) => p.hair)).size).toBe(6);
    expect(new Set(people.map((p) => p.legs)).size).toBe(CITIZEN_LEGS);
    const women = people.filter((p) => p.woman).length;
    expect(women / people.length).toBeGreaterThan(0.4);
    expect(women / people.length).toBeLessThan(0.6);
  });
});
