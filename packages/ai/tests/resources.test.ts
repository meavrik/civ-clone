import { describe, expect, it } from "vitest";
import { applyCommand, foundCity, hasResource, newGame, runAiPlayers, setRelation, Terrain, type GameState } from "@civ/core";
import { aiTurn, plannerTurn, resourceAsk, resourceOffers, spareResources, wantsResource } from "../src/index.js";

/** Two computer civs met on a flat grassland world with no specials, one city each, knowing iron and horses. */
function world(): GameState {
  const s = newGame(3, { opponents: 1, allAi: true });
  for (const t of s.map.tiles) {
    Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
    delete t.deposit;
  }
  s.units = [];
  s.cities = [];
  for (const p of s.players) p.advances = ["bronze_working", "iron_working", "horseback_riding", "animal_husbandry"];
  foundCity(s, 0, 10, 10);
  foundCity(s, 1, 30, 10);
  setRelation(s, 0, 1, "contact");
  s.currentPlayer = 0;
  return s;
}

function deposit(s: GameState, x: number, y: number, id: string): void {
  Object.assign(s.map.tiles[y * s.map.width + x]!, { special: true, deposit: id });
}

describe("planner and strategic resources", () => {
  it("spares a second square, or one it has no use for, and asks for what it wants", () => {
    const s = world();
    deposit(s, 11, 11, "Iron");
    deposit(s, 31, 11, "Horses");
    expect(wantsResource(s, 0, "Iron")).toBe(true); // Legion
    expect(wantsResource(s, 0, "Oil")).toBe(false); // nothing it could build soon burns oil
    expect(spareResources(s, 0)).toEqual([]); // its only iron is its own
    deposit(s, 9, 9, "Iron");
    expect(spareResources(s, 0)).toEqual(["Iron"]);
    // Civ 1 lets civ 0 (here the "player") have its horses only if it can spare them: one square, wanted.
    expect(resourceOffers(s, 1, 0)).toEqual([]);
    deposit(s, 29, 9, "Horses");
    expect(resourceOffers(s, 1, 0)).toEqual(["Horses"]);
    // And asks for the iron it lacks in return.
    expect(resourceAsk(s, 1, 0)).toBe("Iron");
    // At war, or hostile, nothing.
    setRelation(s, 0, 1, "war");
    expect(resourceOffers(s, 1, 0)).toEqual([]);
  });

  it("swaps spare resources with another computer civilization, and calls a trade off when it needs what it gave", () => {
    const s = world();
    deposit(s, 11, 11, "Iron");
    deposit(s, 9, 9, "Iron");
    deposit(s, 31, 11, "Horses");
    deposit(s, 29, 9, "Horses");
    for (let i = 0; i < 6 && !s.resourceTrades?.length; i++) {
      plannerTurn(s);
      applyCommand(s, { type: "endTurn" });
      runAiPlayers(s, () => {});
    }
    expect(s.resourceTrades).toMatchObject([{ give: expect.any(String), take: expect.any(String) }]);
    expect(hasResource(s, 0, "Horses")).toBe(true);
    expect(hasResource(s, 1, "Iron")).toBe(true);
    // Civ 0 loses the square of iron it kept: the one left is traded away, so it calls the trade off.
    s.map.tiles[9 * s.map.width + 9]!.special = false;
    expect(hasResource(s, 0, "Iron")).toBe(false);
    s.currentPlayer = 0;
    plannerTurn(s);
    expect(s.resourceTrades ?? []).toEqual([]);
    expect(hasResource(s, 0, "Iron")).toBe(true);
  });

  it("plays whole games with resources deterministically", () => {
    const play = () => {
      const s = newGame(11, { opponents: 3, allAi: true });
      while (s.turn < 120) runAiPlayers(s, aiTurn);
      return { units: s.units.map((u) => u.type).join(), trades: JSON.stringify(s.resourceTrades ?? []) };
    };
    expect(play()).toEqual(play());
  });
});
