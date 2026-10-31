import { describe, expect, it } from "vitest";
import { advanceWorth, foundCity, newGame, resourceWorth, setRelation, Terrain, type GameState } from "@civ/core";
import { DEAL, exchangeAnswer } from "../src/index.js";

/** Us (0) and a computer civilization (1) at peace on flat grassland: our Rome with Iron, their Babylon with two Horses. */
function world(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    Object.assign(t, { terrain: Terrain.Grassland, river: false, road: false, irrigation: false, mine: false, special: false, hut: false });
    delete t.deposit;
  }
  s.units = []; s.cities = [];
  for (const p of s.players) p.advances = ["bronze_working", "iron_working", "horseback_riding", "animal_husbandry", "the_wheel", "currency"];
  s.players[0]!.advances.push("alphabet");
  s.players[1]!.advances.push("pottery");
  setRelation(s, 0, 1, "peace");
  foundCity(s, 0, 10, 10, "Rome").size = 3;
  foundCity(s, 1, 30, 10, "Babylon").size = 3;
  const lay = (x: number, y: number, id: string) => Object.assign(s.map.tiles[y * s.map.width + x]!, { special: true, deposit: id, road: true });
  lay(11, 10, "Iron");
  lay(31, 10, "Horses");
  lay(29, 10, "Horses");
  s.players[0]!.gold = 300;
  s.players[1]!.gold = 200;
  return s;
}

describe("a computer leader weighing an exchange", () => {
  it("takes a fair one, and names the gold that would settle one too thin", () => {
    const s = world();
    // An advance for an advance: it learns ours at full worth and keeps its own.
    expect(exchangeAnswer(s, 1, 0, { advances: ["alphabet"] }, { advances: ["pottery"] })).toMatchObject({ accept: true });
    // Its advance for nothing: refused, with the gold that would make it fair.
    const r = exchangeAnswer(s, 1, 0, {}, { advances: ["pottery"] });
    expect(r.accept).toBe(false);
    expect(r.why).toBe("value");
    expect(r.short).toBeGreaterThanOrEqual(advanceWorth(s, 1) * DEAL.keep);
    expect(exchangeAnswer(s, 1, 0, { gold: r.short }, { advances: ["pottery"] }).accept).toBe(true);
  });

  it("weighs gold a turn for a resource it wants", () => {
    const s = world();
    // Iron it wants (the Legion): a gold a turn, worth less to it than the Iron, is agreed.
    expect(DEAL.turns).toBeLessThan(resourceWorth(s, 1));
    expect(exchangeAnswer(s, 1, 0, { resources: ["Iron"] }, { perTurn: 1 })).toMatchObject({ accept: true });
    // The Iron and its gold a turn and most of its treasury besides: too much.
    expect(exchangeAnswer(s, 1, 0, { resources: ["Iron"] }, { perTurn: 1, gold: 150 })).toMatchObject({ accept: false, why: "value" });
  });

  it("parts with a spare resource only, pays no more a turn than its cities bring, and trades nothing while hostile", () => {
    const s = world();
    expect(exchangeAnswer(s, 1, 0, { gold: 200 }, { resources: ["Horses"] }).accept).toBe(true);
    // Its second Horses gone, the one left is no spare.
    s.map.tiles[10 * s.map.width + 29]!.special = false;
    expect(exchangeAnswer(s, 1, 0, { gold: 200 }, { resources: ["Horses"] })).toMatchObject({ accept: false, why: "needs" });
    expect(exchangeAnswer(s, 1, 0, { resources: ["Iron"] }, { perTurn: 50 })).toMatchObject({ accept: false, why: "afford" });
    setRelation(s, 0, 1, "war");
    expect(exchangeAnswer(s, 1, 0, { gold: 100 }, {}).accept).toBe(false);
  });
});
