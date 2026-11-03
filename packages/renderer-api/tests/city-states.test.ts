import { describe, expect, it } from "vitest";
import { applyCommand, CITY_STATE, createUnit, foundCity, newGame, Terrain, type GameState, type TurnEvent } from "@civ/core";
import { cityStateAt, cityStateCard, cityStateDemandCard, cityStateIntro, cityStateTitle, conquestCard, terrainInfo, unitTitle } from "../src/index.js";

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
    expect(lines).toContain("{city} Tyre, a city-state of the Phoenicians, size 1");
    expect(lines).toContain("{swords} Legion: Tyre");
    expect(terrainInfo(s, 17, 10).card!.owner?.name).toBe("Land of Tyre");
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

  it("are found under a click on their city or a soldier of theirs in sight, and nowhere else", () => {
    const s = field();
    const tyre = s.cities.find((c) => c.cityState)!;
    expect(cityStateAt(s, 16, 10, 0)?.id).toBe(tyre.id);
    // A soldier of Tyre out in the field, in sight; a barbarian of no city-state is none of it.
    createUnit(s, "legion", s.barbarians, 14, 12, tyre.id);
    createUnit(s, "legion", s.barbarians, 13, 13);
    expect(cityStateAt(s, 14, 12, 0)?.id).toBe(tyre.id);
    expect(cityStateAt(s, 13, 13, 0)).toBeUndefined();
    expect(cityStateAt(s, 10, 10, 0)).toBeUndefined();
    // Out of sight, the soldier is not there for us; an unexplored city is not either.
    s.players[0]!.visible[12 * s.map.width + 14] = 0;
    expect(cityStateAt(s, 14, 12, 0)).toBeUndefined();
    s.players[0]!.explored[10 * s.map.width + 16] = 0;
    expect(cityStateAt(s, 16, 10, 0)).toBeUndefined();
  });

  it("say what a city-state is when we come upon it, and sell its peace when clicked", () => {
    const s = field();
    const tyre = s.cities.find((c) => c.cityState)!;
    const intro = cityStateIntro(tyre);
    expect(intro.title).toBe("Tyre, a City-State");
    expect(intro.lines[0]).toBe("{city}A lone city of the Phoenicians, at war with all.");
    expect(intro.lines.join(" ")).toMatch(/tribute/);
    s.players[0]!.gold = 300;
    const open = cityStateCard(s, tyre, 0);
    expect(open.title).toBe("Tyre, a City-State");
    expect(open.lines[1]).toBe("{swords}Its soldiers may strike us at any time.");
    expect(open.lines[2]).toMatch(new RegExp(`^\\{purse\\}Pay ${open.price} gold: it leaves us be until \\d+ (BC|AD)\\.$`));
    expect(open.buttons).toEqual([`Pay ${open.price} gold`, "Leave"]);
    // Too poor: Leave alone, and it says why.
    s.players[0]!.gold = 0;
    expect(cityStateCard(s, tyre, 0)).toMatchObject({ buttons: ["Leave"], canPay: false });
    expect(cityStateCard(s, tyre, 0).lines).toContain("We have not the gold to pay.");
    // Paid: how long it leaves us be, nothing to buy.
    s.players[0]!.gold = 300;
    expect(applyCommand(s, { type: "cityStateOffer", city: tyre.id }).ok).toBe(true);
    const paid = cityStateCard(s, tyre, 0);
    expect(paid.buttons).toEqual([]);
    expect(paid.lines[1]).toMatch(/^\{heart\}Paid off: it leaves us be until \d+ (BC|AD), unless we strike it\.$/);
    expect(s.cityStatePeace?.[`${tyre.id}:0`]).toBe(s.turn + CITY_STATE.peaceTurns);
  });
});
