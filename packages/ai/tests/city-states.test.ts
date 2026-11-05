import { describe, expect, it } from "vitest";
import { autoAssignWorkers, CITY_STATE, createUnit, foundCity, labelContinents, lastActions, lastTurnEvents, loadSave, makeSave, newGame, peaceUntil, processCityTurn, recomputeVisibility, runAiPlayers, startTurn, Terrain, type City, type GameState } from "@civ/core";
import { aiTurn, barbarianTurn, plannerTurn } from "../src/index.js";

/** Grassland everywhere, a computer civ's Rome at (10, 10) and city-state Tyre at (18, 10) with its garrison, which Rome has come upon; the turn past the grace. */
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
  s.players[0]!.explored.fill(0);
  recomputeVisibility(s, 0);
  s.players[0]!.explored[10 * s.map.width + 18] = 1;
  s.turn = CITY_STATE.grace;
  return { s, tyre, rome };
}

/** The city-states' demands of player 0 made this turn. */
const demands = () => lastTurnEvents.filter((e) => e.kind === "cityStateDemand" && e.player === 0).length;

/** One turn of the city-states (the barbarians' seat), moves restored first. */
function turn(s: GameState): void {
  lastTurnEvents.length = 0;
  s.currentPlayer = s.barbarians;
  startTurn(s, s.barbarians);
  barbarianTurn(s);
}

const at = (s: GameState, c: City) => s.units.filter((u) => u.homeCity === c.id && u.x === c.x && u.y === c.y);

/** `n` soldiers of Tyre's, beyond its garrison, in the city; a whole band unless said. */
const raiders = (s: GameState, tyre: City, n: number = CITY_STATE.band) => {
  for (let i = 0; i < n; i++) createUnit(s, "legion", s.barbarians, tyre.x, tyre.y, tyre.id);
};

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
    raiders(s, tyre, CITY_STATE.band - 1);
    turn(s);
    // Short of a band: they wait at home, and nobody is asked for anything.
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + CITY_STATE.band - 1);
    expect(s.cityStateDemands).toBeUndefined();
    raiders(s, tyre, 1);
    turn(s);
    expect(s.cityStateDemands).toEqual([expect.objectContaining({ city: tyre.id, player: 0, target: rome.id })]);
    expect(lastTurnEvents.find((e) => e.kind === "cityStateDemand")).toMatchObject({ name: "Tyre", target: "Rome" });
    // The garrison stays; the band sets out toward Rome.
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison);
    const band = s.units.filter((u) => u.homeCity === tyre.id && u.type === "legion");
    expect(band).toHaveLength(CITY_STATE.band);
    expect(band.every((u) => u.x < 18)).toBe(true);
  });

  it("raise no more than their garrison and one band, and fill its place when one falls (since save version 71)", () => {
    const { s, tyre } = world();
    raiders(s, tyre);
    const soldiers = () => s.units.filter((u) => u.homeCity === tyre.id).length;
    const full = CITY_STATE.garrison + CITY_STATE.band;
    // A city with the shields to pay for them, so none goes for its upkeep.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s.map.tiles[(tyre.y + dy) * s.map.width + tyre.x + dx]!.terrain = Terrain.Plains;
    tyre.size = 6;
    autoAssignWorkers(s, tyre);
    tyre.production = { kind: "unit", id: "legion" };
    tyre.shields = 500;
    processCityTurn(s, tyre);
    expect(soldiers()).toBe(full);
    expect(tyre.shields).toBeGreaterThanOrEqual(500);
    s.units.pop();
    processCityTurn(s, tyre);
    expect(soldiers()).toBe(full);
    // Before, they went on for good.
    s.swarmingCityStates = true;
    tyre.shields = 500;
    processCityTurn(s, tyre);
    expect(soldiers()).toBe(full + 1);
  });

  it("send no one after a band until the last of it has fallen or come home (since save version 71)", () => {
    const { s, tyre } = world();
    raiders(s, tyre);
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison);
    // A new soldier stands home while the band is out, where it used to set off after it alone.
    raiders(s, tyre, 1);
    s.turn++;
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + 1);
    const { s: old, tyre: oldTyre } = world();
    old.swarmingCityStates = true;
    raiders(old, oldTyre, CITY_STATE.raid);
    turn(old);
    raiders(old, oldTyre, 1);
    old.turn++;
    turn(old);
    expect(at(old, oldTyre)).toHaveLength(CITY_STATE.garrison);
  });

  it("keep to the nearest city, whatever lies to loot round another (since save version 71)", () => {
    const { s, tyre, rome } = world();
    s.units = s.units.filter((u) => u.owner !== 0);
    createUnit(s, "musketeers", 0, rome.x, rome.y).order = { kind: "fortified" };
    // Babylon lies further from Tyre than Rome, with a farm to wreck and nobody home.
    const babylon = foundCity(s, 0, 18, 22, "Babylon");
    s.map.tiles[21 * s.map.width + 18]!.irrigation = true;
    raiders(s, tyre);
    const band = s.units.filter((u) => u.type === "legion");
    for (let t = 0; t < 3; t++) { turn(s); s.turn++; }
    expect(band.every((u) => u.x <= 15)).toBe(true);
    // Before, it made for the city it could loot or storm.
    const { s: old, tyre: oldTyre, rome: oldRome } = world();
    old.swarmingCityStates = true;
    old.units = old.units.filter((u) => u.owner !== 0);
    createUnit(old, "musketeers", 0, oldRome.x, oldRome.y).order = { kind: "fortified" };
    foundCity(old, 0, 18, 22, "Babylon");
    raiders(old, oldTyre, CITY_STATE.raid);
    turn(old);
    expect(old.units.filter((u) => u.type === "legion").every((u) => u.y > 10)).toBe(true);
    expect(babylon.name).toBe("Babylon");
  });

  it("attack what they come next to at any odds, and the raid ends in the fight (since save version 71)", () => {
    const { s, tyre, rome } = world();
    s.units = s.units.filter((u) => u.owner !== 0);
    createUnit(s, "musketeers", 0, rome.x, rome.y).order = { kind: "fortified" };
    const raider = createUnit(s, "militia", s.barbarians, 11, 10, tyre.id);
    for (let t = 0; t < 12 && s.units.includes(raider); t++) { turn(s); s.turn++; }
    // Beaten by the walls, as it should be, not waiting there or walking round them.
    expect(s.units).not.toContain(raider);
  });

  it("go home from a raid when nothing is left to raid, and stay (since save version 71)", () => {
    const { s, tyre } = world();
    raiders(s, tyre);
    turn(s);
    s.cityStatePeace = { [`${tyre.id}:0`]: s.turn + 50 };
    for (let t = 0; t < 4; t++) { s.turn++; turn(s); }
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + CITY_STATE.band);
    s.turn++;
    turn(s);
    expect(at(s, tyre).every((u) => ["fortified", "fortifying"].includes(u.order.kind))).toBe(true);
  });

  it("pass by a civilization that paid them off, to strike the one beside it (since save version 71)", () => {
    const { s, tyre } = world();
    const friend = createUnit(s, "militia", 0, 13, 10);
    const foe = createUnit(s, "militia", 1, 13, 11);
    s.cityStatePeace = { [`${tyre.id}:0`]: s.turn + 50 };
    foundCity(s, 1, 8, 11, "Babylon");
    const raider = createUnit(s, "legion", s.barbarians, 14, 10, tyre.id);
    for (const u of [friend, foe]) u.order = { kind: "fortified" };
    lastActions.length = 0;
    turn(s);
    const fought = lastActions.filter((a) => a.kind === "battle");
    expect(fought.length).toBeGreaterThan(0);
    expect(fought.every((a) => a.kind === "battle" && a.defender.owner === 1)).toBe(true);
    expect(raider.owner).toBe(s.barbarians);
  });

  it("swarm as they did in a save before version 71", () => {
    const { s, tyre } = world();
    const save = makeSave(s, { allAi: true, opponents: 1 }, []);
    expect(tyre.cityState).toBe("tyre");
    expect(s.swarmingCityStates).toBeUndefined();
    expect(loadSave({ ...save, version: 70 }, aiTurn).state.swarmingCityStates).toBe(true);
    expect(loadSave(save, aiTurn).state.swarmingCityStates).toBeUndefined();
  });

  it("ask a civilization that has not come upon them only once their soldiers come into its sight", () => {
    const { s, tyre } = world();
    s.players[0]!.explored[10 * s.map.width + 18] = 0;
    raiders(s, tyre);
    const band = () => s.units.filter((u) => u.homeCity === tyre.id && u.type === "legion");
    const seen = () => band().some((u) => s.players[0]!.visible[u.y * s.map.width + u.x]);
    let asked = -1;
    for (let t = 0; t < 8 && asked < 0; t++) {
      turn(s);
      if (demands()) asked = t;
      else expect(seen()).toBe(false);
      s.turn++;
    }
    // The band set out unannounced, and asked as it came into sight.
    expect(asked).toBeGreaterThan(0);
    expect(seen()).toBe(true);
  });

  it("ask once in their turns between, though the band is held at home", () => {
    for (const eager of [false, true]) {
      const { s, tyre } = world();
      if (eager) { s.eagerCityStates = true; s.swarmingCityStates = true; }
      raiders(s, tyre);
      let asked = 0;
      for (let t = 0; t <= CITY_STATE.askEvery; t++) {
        // Whatever stopped them, the band stands at home again as their turn comes round, and the demand is refused.
        lastTurnEvents.length = 0;
        s.currentPlayer = s.barbarians;
        startTurn(s, s.barbarians);
        for (const u of s.units) if (u.homeCity === tyre.id) { u.x = 18; u.y = 10; u.order = { kind: "none" }; }
        barbarianTurn(s);
        asked += demands();
        delete s.cityStateDemands;
        s.turn++;
      }
      // Before version 50 it asked every turn.
      expect(asked).toBe(eager ? CITY_STATE.askEvery + 1 : 2);
    }
  });

  it("raid nobody before the grace, nor a civilization that paid them off", () => {
    const { s, tyre } = world();
    raiders(s, tyre);
    s.turn = CITY_STATE.grace - 1;
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + CITY_STATE.band);
    s.turn = CITY_STATE.grace;
    s.cityStatePeace = { [`${tyre.id}:0`]: s.turn + 5 };
    turn(s);
    expect(at(s, tyre)).toHaveLength(CITY_STATE.garrison + CITY_STATE.band);
    expect(s.cityStateDemands).toBeUndefined();
  });

  it("are paid by a computer civilization with gold to spare, and refused by one without", () => {
    for (const [gold, paid] of [[300, true], [40, false]] as const) {
      const { s, tyre } = world();
      s.players[0]!.gold = gold;
      raiders(s, tyre);
      turn(s);
      if (!s.cityStateDemands) { expect(paid).toBe(false); continue; }
      s.currentPlayer = 0;
      startTurn(s, 0);
      plannerTurn(s);
      expect(s.cityStateDemands).toBeUndefined();
      expect(peaceUntil(s, tyre.id, 0) !== undefined).toBe(paid);
    }
  });

  it("lay waste a city they cannot storm, never fortifying beside it (saves of versions 63 to 70)", () => {
    for (const meek of [false, true]) {
      const { s, tyre, rome } = world();
      s.swarmingCityStates = true;
      if (meek) s.meekCityStates = true;
      s.units = s.units.filter((u) => u.owner !== 0);
      createUnit(s, "musketeers", 0, rome.x, rome.y).order = { kind: "fortified" };
      const farm = s.map.tiles[9 * s.map.width + 11]!;
      farm.irrigation = true;
      const raider = createUnit(s, "legion", s.barbarians, 11, 10, tyre.id);
      // Rome's musketeers are past storming: the raider steps out of their zone of control and back in onto the farm
      // along the walls, and wrecks it, where it stood fortified at the gates before.
      for (let t = 0; t < 4 && farm.irrigation; t++) {
        turn(s);
        expect(s.units).toContain(raider);
        expect(["fortified", "fortifying"].includes(raider.order.kind)).toBe(meek);
        s.turn++;
      }
      expect(farm.irrigation).toBe(meek);
    }
  });

  it("wreck farms and mines on the way, but not on the land of a civilization that paid them off", () => {
    for (const paid of [false, true]) {
      const { s, tyre, rome } = world();
      s.units = s.units.filter((u) => u.owner !== 0);
      createUnit(s, "musketeers", 0, rome.x, rome.y).order = { kind: "fortified" };
      // Rome's land two squares out, so the raider stands on it with nothing next door to strike.
      rome.size = 6;
      recomputeVisibility(s, 0);
      const mine = s.map.tiles[11 * s.map.width + 12]!;
      mine.mine = true;
      if (paid) s.cityStatePeace = { [`${tyre.id}:0`]: s.turn + 5 };
      createUnit(s, "legion", s.barbarians, 12, 11, tyre.id);
      turn(s);
      expect(mine.mine).toBe(paid);
    }
  });

  it("go after a unit in the open a few squares off and strike it (saves of versions 63 to 70)", () => {
    const { s, tyre } = world();
    s.swarmingCityStates = true;
    const settlers = createUnit(s, "settlers", 0, 14, 10);
    createUnit(s, "cavalry", s.barbarians, 16, 10, tyre.id);
    turn(s);
    expect(s.units).not.toContain(settlers);
    const { s: old, tyre: oldTyre } = world();
    old.swarmingCityStates = true;
    old.meekCityStates = true;
    const spared = createUnit(old, "settlers", 0, 14, 10);
    createUnit(old, "cavalry", old.barbarians, 16, 10, oldTyre.id);
    turn(old);
    // Before, raiders hit only what stood next door on their way.
    expect(old.units).toContain(spared);
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
