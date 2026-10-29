import { describe, expect, it } from "vitest";
import { applyCommand, autoAssignWorkers, createUnit, lastCombat, newGame, setRelation, Terrain, type GameState } from "../src/index.js";

/** Grassland everywhere, two civilizations and nothing on the map. */
function world(): GameState {
  const s = newGame(1, { opponents: 1, classicCivs: true });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    delete t.deposit;
  }
  s.units = []; s.cities = [];
  return s;
}

describe("a civilization's chronicle", () => {
  it("counts cities founded, units raised, wonders, fights, cities taken and lost, its heights and its fall", () => {
    const s = world();
    const me = s.players[0]!;
    const them = s.players[1]!;
    expect(me.chronicle).toBeUndefined();
    const theirSettlers = createUnit(s, "settlers", 1, 30, 10);
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 10, 10).id });
    const rome = s.cities[0]!;
    expect(me.chronicle).toMatchObject({ founded: 1, firstCity: 0 });
    // A unit raised and a wonder completed as the turn ends; its heights read then.
    rome.size = 3;
    autoAssignWorkers(s, rome);
    rome.production = { kind: "unit", id: "militia" };
    rome.shields = 100;
    applyCommand(s, { type: "endTurn" });
    expect(me.chronicle).toMatchObject({ units: 1, peakCities: 1, peakCitizens: rome.size });
    expect(me.chronicle!.peakScore).toBeGreaterThan(0);
    s.currentPlayer = 0;
    rome.production = { kind: "wonder", id: "colossus" };
    rome.shields = 1000;
    applyCommand(s, { type: "endTurn" });
    expect(me.chronicle!.wonders).toEqual(["colossus"]);

    // A fight won by one side is lost by the other.
    s.currentPlayer = 0;
    setRelation(s, 0, 1, "war");
    const legion = createUnit(s, "legion", 0, 20, 10);
    createUnit(s, "militia", 1, 21, 10);
    expect(applyCommand(s, { type: "move", unit: legion.id, dx: 1, dy: 0 }).ok).toBe(true);
    const won = lastCombat!.attackerWon;
    expect(me.chronicle).toMatchObject({ won: won ? 1 : 0, defeated: won ? 0 : 1 });
    expect(them.chronicle).toMatchObject({ won: won ? 0 : 1, defeated: won ? 1 : 0 });

    // Their only city taken: one conquered for us, one lost and the fall for them; the wonder stays in our record.
    s.currentPlayer = 1;
    applyCommand(s, { type: "found", unit: theirSettlers.id });
    s.currentPlayer = 0;
    s.cities.find((c) => c.owner === 1)!.size = 3;
    const taker = createUnit(s, "legion", 0, 29, 10);
    expect(applyCommand(s, { type: "move", unit: taker.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(me.chronicle!.conquered).toBe(1);
    expect(them.chronicle).toMatchObject({ founded: 1, lost: 1, fell: s.turn });
    expect(them.alive).toBe(false);
    rome.wonders = [];
    expect(me.chronicle!.wonders).toEqual(["colossus"]);
  });
});
