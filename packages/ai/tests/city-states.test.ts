import { describe, expect, it } from "vitest";
import { CITY_STATE, createUnit, foundCity, labelContinents, lastTurnEvents, loadSave, makeSave, newGame, peaceUntil, runAiPlayers, startTurn, Terrain, type City, type GameState } from "@civ/core";
import { aiTurn, barbarianTurn, plannerTurn } from "../src/index.js";

/** Grassland everywhere, a computer civ's Rome at (10, 10) and city-state Tyre at (18, 10) with its garrison; the turn past the grace. */
function world(): { s: GameState; tyre: City; rome: City } {
  const s = newGame(3, { opponents: 1, allAi: true });
  for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false, railroad: false, fortress: false });
  labelContinents(s.map);
  s.units = [];
  s.cities = [];
  const rome = foundCity(s, 0, 10, 10, "Rome");
  createUnit(s, "militia", 0, 10, 10).order = { kind: "fortified" };
  const tyre = foundCity(s, s.barbarians, 18, 10, "Tyre");
  tyre.cityState = "tyre";
  tyre.buildings = [];
  for (let i = 0; i < CITY_STATE.garrison; i++) createUnit(s, "militia", s.barbarians, 18, 10, tyre.id).order = { kind: "fortified" };
  s.players[0]!.gold = 300;
  s.turn = CITY_STATE.grace;
  return { s, tyre, rome };
}

/** One turn of the city-states (the barbarians' seat), moves restored first. */
function turn(s: GameState): void {
  s.currentPlayer = s.barbarians;
  startTurn(s, s.barbarians);
  barbarianTurn(s);
}

const at = (s: GameState, c: City) => s.units.filter((u) => u.homeCity === c.id && u.x === c.x && u.y === c.y);

describe("city-states", () => {
  it("keep their garrison home and raise attackers once it stands", () => {
    const { s, tyre } = world();
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison);
    expect(tyre.production.kind).toBe("unit");
    s.units = s.units.filter((u) => u.homeCity !== tyre.id);
    turn(s);
    expect(tyre.production).toEqual({ kind: "unit", id: "militia" });
  });

  it("wait for a band, then demand tribute of the nearest civilization and march on its city", () => {
    const { s, tyre, rome } = world();
    createUnit(s, "legion", s.barbarians, 18, 10, tyre.id);
    turn(s);
    // One spare soldier is no band: it waits at home, and nobody is asked for anything.
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + 1);
    expect(s.cityStateDemands).toBeUndefined();
    createUnit(s, "legion", s.barbarians, 18, 10, tyre.id);
    turn(s);
    expect(s.cityStateDemands).toEqual([expect.objectContaining({ city: tyre.id, player: 0, target: rome.id })]);
    expect(lastTurnEvents.find((e) => e.kind === "cityStateDemand")).toMatchObject({ name: "Tyre", target: "Rome" });
    // The garrison stays; the band sets out toward Rome.
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison);
    const band = s.units.filter((u) => u.homeCity === tyre.id && u.type === "legion");
    expect(band.every((u) => u.x < 18)).toBe(true);
  });

  it("raid nobody before the grace, nor a civilization that paid them off", () => {
    const { s, tyre } = world();
    for (let i = 0; i < 2; i++) createUnit(s, "legion", s.barbarians, 18, 10, tyre.id);
    s.turn = CITY_STATE.grace - 1;
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + 2);
    s.turn = CITY_STATE.grace;
    s.cityStatePeace = { [`${tyre.id}:0`]: s.turn + 5 };
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + 2);
    expect(s.cityStateDemands).toBeUndefined();
  });

  it("are paid by a computer civilization with gold to spare, and refused by one without", () => {
    for (const [gold, paid] of [[300, true], [40, false]] as const) {
      const { s, tyre } = world();
      s.players[0]!.gold = gold;
      for (let i = 0; i < 2; i++) createUnit(s, "legion", s.barbarians, 18, 10, tyre.id);
      turn(s);
      if (!s.cityStateDemands) { expect(paid).toBe(false); continue; }
      s.currentPlayer = 0;
      startTurn(s, 0);
      plannerTurn(s);
      expect(s.cityStateDemands).toBeUndefined();
      expect(peaceUntil(s, tyre.id, 0) !== undefined).toBe(paid);
    }
  });

  it("make all-computer games replay exactly", () => {
    const opts = { allAi: true, opponents: 3, cityStates: true };
    const s = newGame(5, opts);
    while (s.turn < 60) runAiPlayers(s, aiTurn);
    expect(s.cities.filter((c) => c.cityState !== undefined).length).toBeGreaterThan(0);
    const again = loadSave(makeSave(s, opts, []), aiTurn).state;
    expect(again.turn).toBe(s.turn);
    expect(JSON.stringify(again.cities)).toBe(JSON.stringify(s.cities));
    expect(JSON.stringify(again.units)).toBe(JSON.stringify(s.units));
  });
});
