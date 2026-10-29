import { describe, expect, it } from "vitest";
import { createUnit, foundCity, newGame, Terrain, type GameState, type TurnEvent } from "@civ/core";
import { cityStateDemandCard, cityStateTitle, conquestCard, terrainInfo, unitTitle } from "../src/index.js";

/** Grassland, our Rome at (10, 10), city-state Tyre at (16, 10) with a militia; all of it explored by us. */
function field(): GameState {
  const s = newGame(2026, { opponents: 1 });
  s.units = [];
  s.cities = [];
  for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false });
  s.players[0]!.explored.fill(1);
  s.players[0]!.visible.fill(1);
  foundCity(s, 0, 10, 10, "Rome");
  const tyre = foundCity(s, s.barbarians, 16, 10, "Tyre");
  tyre.cityState = "tyre";
  createUnit(s, "legion", s.barbarians, 16, 10, tyre.id);
  return s;
}

describe("city-states in words", () => {
  it("demand tribute: who marches where, the price and the peace, Refuse alone without the gold", () => {
    const s = field();
    const tyre = s.cities.find((c) => c.cityState)!;
    const ev: Extract<TurnEvent, { kind: "cityStateDemand" }> = { kind: "cityStateDemand", from: tyre.id, name: "Tyre", player: 0, gold: 40, target: "Rome" };
    s.players[0]!.gold = 100;
    const card = cityStateDemandCard(s, ev, 0);
    expect(card.title).toBe("Tyre Demands Tribute");
    expect(card.lines[0]).toBe("{swords}The warriors of Tyre, a city of the Phoenicians, march on Rome.");
    expect(card.lines[1]).toMatch(/^\{purse\}Pay 40 gold and Tyre leaves us be until \d+ (BC|AD)\. Refuse, and we fight\.$/);
    expect(card.buttons).toEqual(["Pay 40 gold", "Refuse"]);
    s.players[0]!.gold = 10;
    expect(cityStateDemandCard(s, ev, 0)).toMatchObject({ buttons: ["Refuse"], canPay: false });
  });

  it("name a city-state and its soldiers as themselves, not as barbarians", () => {
    const s = field();
    expect(cityStateTitle("tyre")).toBe("the city-state of Tyre");
    expect(unitTitle(s, s.barbarians, "legion", "tyre")).toBe("Legion of Tyre");
    expect(unitTitle(s, s.barbarians, "legion")).toBe("Barbarian Legion");
    const lines = terrainInfo(s, 16, 10).lines.join(" | ");
    expect(lines).toContain("Tyre (a city-state of the Phoenicians), size 1");
    expect(lines).toContain("Legion (Tyre)");
    expect(terrainInfo(s, 17, 10).lines.join(" | ")).toContain("Land of Tyre");
  });

  it("tell a city-state taken, and one of ours taken by a city-state's soldiers", () => {
    const s = field();
    const tyre = s.cities.find((c) => c.cityState)!;
    tyre.owner = 0;
    const won = conquestCard(s, { event: { kind: "cityCaptured", name: "Tyre", player: s.barbarians, by: 0, cityId: tyre.id, x: 16, y: 10, plunder: 0, capital: false, cityState: "tyre" }, viewer: 0 });
    expect(won.where).toBe("Taken from the city-state of Tyre");
    const lost = conquestCard(s, { event: { kind: "cityLost", name: "Rome", player: 0, by: s.barbarians, x: 10, y: 10, plunder: 0, capital: true, byCityState: "tyre" }, viewer: 0 });
    expect(lost.where).toBe("Burned by the city-state of Tyre");
  });
});
