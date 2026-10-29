import { describe, expect, it } from "vitest";
import {
  applyCommand,
  CITY_STATE,
  CITY_STATES,
  cityStateCount,
  cityStateUnit,
  cityStateUnits,
  createUnit,
  foundCity,
  lastTurnEvents,
  loadSave,
  makeSave,
  mapDistance,
  newGame,
  peaceUntil,
  resolveCombat,
  setRelation,
  Terrain,
  type City,
  type GameState,
} from "../src/index.js";

/** Each civilization's starting square: where its first settlers stand. */
function starts(s: GameState): [number, number][] {
  return s.players.filter((p) => p.id !== s.barbarians).map((p) => {
    const u = s.units.find((x) => x.owner === p.id && x.type === "settlers")!;
    return [u.x, u.y];
  });
}

/** Grassland everywhere, two civilizations, nothing on the map, and city-state Tyre at (20, 10) with its garrison. */
function world(): { s: GameState; tyre: City } {
  const s = newGame(1, { opponents: 1, classicCivs: true });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    delete t.deposit;
    t.continent = 1;
  }
  s.units = []; s.cities = [];
  const tyre = foundCity(s, s.barbarians, 20, 10, "Tyre");
  tyre.cityState = "tyre";
  tyre.buildings = [];
  createUnit(s, "militia", s.barbarians, 20, 10, tyre.id);
  createUnit(s, "militia", s.barbarians, 20, 10, tyre.id);
  return { s, tyre };
}

describe("city-states", () => {
  it("are thirty peoples of history, none a civilization's city", () => {
    expect(CITY_STATES).toHaveLength(30);
    expect(new Set(CITY_STATES.map((c) => c.name)).size).toBe(30);
    for (const c of CITY_STATES) expect(c.name.length).toBeLessThanOrEqual(14);
  });

  it("stand as a new game begins, held by the barbarians, so that no civilization is alone on its land", () => {
    for (const [seed, size, want] of [[1, "small", 8], [2, "small", 8], [3, "medium", 12], [4, "large", 16]] as const) {
      const s = newGame(seed, { opponents: 6, cityStates: true, size });
      expect(cityStateCount(s)).toBe(want);
      const cs = s.cities.filter((c) => c.cityState !== undefined);
      expect(cs.length).toBe(want);
      expect(new Set(cs.map((c) => c.cityState)).size).toBe(cs.length);
      for (const c of cs) {
        expect(c.owner).toBe(s.barbarians);
        expect(c.size).toBe(CITY_STATE.size);
        expect(c.buildings).not.toContain("palace");
        const guard = s.units.filter((u) => u.homeCity === c.id && u.x === c.x && u.y === c.y);
        expect(guard.length).toBe(CITY_STATE.garrison);
        expect(guard.every((u) => u.order.kind === "fortified")).toBe(true);
        for (const o of cs) if (o !== c) expect(mapDistance(s.map, c.x, c.y, o.x, o.y)).toBeGreaterThanOrEqual(CITY_STATE.apart);
        for (const [x, y] of starts(s)) expect(mapDistance(s.map, c.x, c.y, x, y)).toBeGreaterThanOrEqual(4);
      }
      // Every civilization shares its land with another civilization or a city-state.
      const land = (x: number, y: number) => s.map.tiles[y * s.map.width + x]!.continent;
      const st = starts(s);
      for (const [x, y] of st) {
        const company = st.some(([ox, oy]) => (ox !== x || oy !== y) && land(ox, oy) === land(x, y)) || cs.some((c) => land(c.x, c.y) === land(x, y));
        expect(company, `start ${x},${y}`).toBe(true);
      }
    }
    // Games without them (every game before save version 45) have none.
    expect(newGame(1, { opponents: 6 }).cities).toHaveLength(0);
  });

  it("replay from their save as they were placed", () => {
    const s = newGame(5, { opponents: 3, cityStates: true });
    const save = makeSave(s, { opponents: 3, cityStates: true }, []);
    const again = loadSave(save, () => {}).state;
    expect(again.cities.map((c) => [c.name, c.x, c.y])).toEqual(s.cities.map((c) => [c.name, c.x, c.y]));
  });

  it("raise soldiers a step behind the world: what half the civilizations know", () => {
    const s = newGame(1, { opponents: 3, cityStates: true });
    for (const p of s.players) p.advances = [];
    expect(cityStateUnits(s)).toEqual(["militia"]);
    const civs = s.players.filter((p) => p.id !== s.barbarians);
    civs[0]!.advances.push("iron_working");
    expect(cityStateUnits(s)).not.toContain("legion");
    civs[1]!.advances.push("iron_working");
    expect(cityStateUnit(s, "attack")).toBe("legion");
    for (const p of civs) p.advances.push("bronze_working");
    expect(cityStateUnit(s, "defense")).toBe("phalanx");
  });

  it("demand tribute; paid, they leave the payer be until the payer strikes them", () => {
    const { s, tyre } = world();
    const me = s.players[0]!;
    me.gold = 200;
    const rome = foundCity(s, 0, 26, 10, "Rome");
    // Only the city-states' seat demands, once a city, and only of one who can pay.
    expect(applyCommand(s, { type: "cityStateDemand", city: tyre.id, player: 0 })).toEqual({ ok: false, reason: "not a city-state" });
    s.currentPlayer = s.barbarians;
    expect(applyCommand(s, { type: "cityStateDemand", city: tyre.id, player: 0, target: rome.id }).ok).toBe(true);
    const ev = lastTurnEvents.find((e) => e.kind === "cityStateDemand")!;
    expect(ev).toMatchObject({ from: tyre.id, name: "Tyre", player: 0, target: "Rome" });
    expect(applyCommand(s, { type: "cityStateDemand", city: tyre.id, player: 0 })).toEqual({ ok: false, reason: "already asked" });
    const price = s.cityStateDemands![0]!.gold;
    expect(price).toBeGreaterThanOrEqual(CITY_STATE.minPrice);
    // We pay: our gold goes, Tyre leaves us be for its turns of peace.
    s.currentPlayer = 0;
    expect(applyCommand(s, { type: "cityStateTribute", city: tyre.id, pay: true }).ok).toBe(true);
    expect(me.gold).toBe(200 - price);
    expect(peaceUntil(s, tyre.id, 0)).toBe(s.turn + CITY_STATE.peaceTurns);
    expect(s.cityStateDemands).toBeUndefined();
    // Its soldiers may not strike us...
    const raider = createUnit(s, "legion", s.barbarians, 24, 10, tyre.id);
    createUnit(s, "militia", 0, 25, 10);
    s.currentPlayer = s.barbarians;
    expect(resolveCombat(s, raider, 1, 0)).toEqual({ error: "tribute paid" });
    // ...until we strike them.
    s.currentPlayer = 0;
    setRelation(s, 0, s.barbarians, "war");
    const ours = createUnit(s, "legion", 0, 23, 10);
    resolveCombat(s, ours, 1, 0);
    expect(peaceUntil(s, tyre.id, 0)).toBeUndefined();
  });

  it("let an unanswered demand lapse as their turn comes round, and refuse one we cannot pay", () => {
    const { s, tyre } = world();
    s.players[0]!.gold = 0;
    foundCity(s, 0, 26, 10, "Rome");
    s.currentPlayer = s.barbarians;
    expect(applyCommand(s, { type: "cityStateDemand", city: tyre.id, player: 0 })).toEqual({ ok: false, reason: "they cannot pay" });
    s.players[0]!.gold = 500;
    expect(applyCommand(s, { type: "cityStateDemand", city: tyre.id, player: 0 }).ok).toBe(true);
    // The city-states' turn ends; the round comes round to them again unanswered.
    applyCommand(s, { type: "endTurn" });
    s.currentPlayer = 0;
    expect(s.cityStateDemands).toHaveLength(1);
    expect(applyCommand(s, { type: "cityStateTribute", city: tyre.id, pay: false }).ok).toBe(true);
    expect(lastTurnEvents.find((e) => e.kind === "cityStateTribute")).toMatchObject({ paid: false, name: "Tyre" });
    expect(s.players[0]!.gold).toBe(500);
    s.currentPlayer = s.barbarians;
    applyCommand(s, { type: "cityStateDemand", city: tyre.id, player: 0 });
    s.turn++;
    s.currentPlayer = 0;
    applyCommand(s, { type: "endTurn" });
    expect(s.cityStateDemands).toBeUndefined();
  });

  it("taken, a city-state is one no more, and the news names it", () => {
    const { s, tyre } = world();
    setRelation(s, 0, s.barbarians, "war");
    s.units = s.units.filter((u) => u.owner !== s.barbarians);
    tyre.size = 3;
    createUnit(s, "settlers", 0, 40, 10);
    const legion = createUnit(s, "legion", 0, 19, 10);
    s.currentPlayer = 0;
    expect(applyCommand(s, { type: "move", unit: legion.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(tyre.owner).toBe(0);
    expect(tyre.cityState).toBeUndefined();
    expect(lastTurnEvents.find((e) => e.kind === "cityCaptured")).toMatchObject({ name: "Tyre", cityState: "tyre" });
  });
});
