import { describe, expect, it } from "vitest";
import {
  applyCommand,
  BARBARIANS,
  barbarianUnits,
  buildOptions,
  cargo,
  createUnit,
  foundCity,
  getTile,
  LEADER,
  lastTurnEvents,
  loadSave,
  makeSave,
  mapDistance,
  maybeSpawnBarbarians,
  newGame,
  pillageTarget,
  setRelation,
  Terrain,
  unitType,
  type GameState,
} from "../src/index.js";

/** Grassland west of column 40 (one continent), ocean east of it; no units or cities. */
function world(opts: { simpleBarbarians?: boolean; zocAtSea?: boolean } = {}): GameState {
  const s = newGame(1, { opponents: 1, ...opts });
  s.map.tiles.forEach((t, i) => {
    const land = i % s.map.width < 40;
    t.terrain = land ? Terrain.Grassland : Terrain.Ocean;
    t.continent = land ? 1 : 2;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  });
  s.units = [];
  s.cities = [];
  return s;
}

/** Ten cities for player 0 along the coast and inland, all their land explored. */
function empire(s: GameState): void {
  for (let i = 0; i < 10; i++) foundCity(s, 0, i < 5 ? 38 : 20, 4 + (i % 5) * 9);
  s.players[0]!.explored.fill(1);
  s.turn = BARBARIANS.onset;
}

/** Summon until a band appears (the gate is a roll), keeping only that band. */
function summon(s: GameState, sea: boolean) {
  for (let i = 0; i < 20000; i++) {
    const bands = maybeSpawnBarbarians(s);
    const band = bands.find((b) => b.sea === sea);
    if (band) {
      s.units = s.units.filter((u) => u.owner !== s.barbarians || (u.x === band.x && u.y === band.y));
      return band;
    }
    s.units = s.units.filter((u) => u.owner !== s.barbarians);
  }
  throw new Error("no band appeared");
}

const move = (s: GameState, unit: number, dx: number, dy: number) => applyCommand(s, { type: "move", unit, dx, dy });

describe("barbarian uprisings and raids", () => {
  it("raises an uprising with its leader on explored land 5 to 8 squares from the nearest city", () => {
    const s = world();
    empire(s);
    const band = summon(s, false);
    const there = s.units.filter((u) => u.owner === s.barbarians);
    expect(getTile(s.map, band.x, band.y)!.terrain).toBe(Terrain.Grassland);
    const nearest = Math.min(...s.cities.map((c) => mapDistance(s.map, band.x, band.y, c.x, c.y)));
    expect(nearest).toBeGreaterThanOrEqual(BARBARIANS.minDistance - 1);
    expect(nearest).toBeLessThanOrEqual(BARBARIANS.maxDistance + 1);
    expect(band.victim).toBe(0);
    expect(there.filter((u) => u.type === LEADER)).toHaveLength(1);
    // Nobody knows Chivalry, Gunpowder or Metallurgy yet: an uprising is horsemen, 2 + 0..2 per step of empire size.
    const soldiers = there.filter((u) => u.type !== LEADER);
    expect(soldiers.every((u) => u.type === "cavalry")).toBe(true);
    expect(soldiers.length).toBeGreaterThanOrEqual(4); // ten cities: the second step
  });

  it("sends raiders by sea: a boat with soldiers and their leader aboard", () => {
    const s = world();
    empire(s);
    s.players[1]!.advances.push("chivalry");
    const band = summon(s, true);
    const boat = s.units.find((u) => u.owner === s.barbarians && unitType(u.type).domain === "sea")!;
    expect(boat.type).toBe("sail");
    expect([boat.x, boat.y]).toEqual([band.x, band.y]);
    const aboard = cargo(s, boat);
    expect(aboard).toHaveLength(unitType("sail").capacity!);
    expect(aboard.filter((u) => u.type === LEADER)).toHaveLength(1);
    expect(aboard.filter((u) => u.type !== LEADER).every((u) => u.type === "legion" || u.type === "knights")).toBe(true);
  });

  it("fields an advanced unit only once some civilization knows its advance", () => {
    const s = world();
    expect(barbarianUnits(s, "land")).toEqual(["cavalry"]);
    expect(barbarianUnits(s, "build")).toEqual(["legion"]);
    s.players[1]!.advances.push("gunpowder", "metallurgy");
    expect(barbarianUnits(s, "land").sort()).toEqual(["cannon", "cavalry", "musketeers"]);
    expect(barbarianUnits(s, "sea").sort()).toEqual(["legion", "musketeers"]);
  });

  it("never starts on tundra or arctic, and waits for the onset", () => {
    const s = world();
    empire(s);
    s.turn = BARBARIANS.onset - 1;
    for (let i = 0; i < 200; i++) expect(maybeSpawnBarbarians(s)).toEqual([]);
    s.turn = BARBARIANS.onset;
    for (const t of s.map.tiles) t.terrain = t.terrain === Terrain.Ocean ? Terrain.Tundra : Terrain.Arctic;
    for (let i = 0; i < 2000; i++) expect(maybeSpawnBarbarians(s)).toEqual([]);
  });
});

describe("the barbarian leader", () => {
  it("pays a ransom when caught alone by a land unit", () => {
    const s = world();
    const leader = createUnit(s, LEADER, s.barbarians, 11, 10);
    const legion = createUnit(s, "legion", 0, 10, 10);
    const gold = s.players[0]!.gold;
    expect(move(s, legion.id, 1, 0).ok).toBe(true);
    expect(s.units.includes(leader)).toBe(false);
    expect(s.players[0]!.gold).toBe(gold + BARBARIANS.ransom);
    expect(lastTurnEvents).toContainEqual({ kind: "ransom", amount: BARBARIANS.ransom, player: 0 });
  });

  it("pays nothing when it falls with its escort", () => {
    const s = world();
    createUnit(s, LEADER, s.barbarians, 11, 10);
    createUnit(s, "militia", s.barbarians, 11, 10).hp = 1;
    const armor = createUnit(s, "armor", 0, 10, 10);
    const gold = s.players[0]!.gold;
    expect(move(s, armor.id, 1, 0).ok).toBe(true);
    expect(s.units.filter((u) => u.owner === s.barbarians)).toHaveLength(0);
    expect(s.players[0]!.gold).toBe(gold);
  });

  it("can never be built", () => {
    const s = world();
    const c = foundCity(s, 0, 10, 10);
    s.players[0]!.advances.push("iron_working");
    expect(buildOptions(s, c).some((p) => p.id === LEADER)).toBe(false);
  });
});

describe("barbarian cities", () => {
  it("are held when taken, raise only barbarian soldiers, and give the barbarians a turn", () => {
    const s = world();
    const c = foundCity(s, 1, 11, 10);
    c.size = 3;
    const raider = createUnit(s, "legion", s.barbarians, 10, 10);
    s.currentPlayer = s.barbarians;
    expect(move(s, raider.id, 1, 0).ok).toBe(true);
    expect(c.owner).toBe(s.barbarians);
    expect(c.size).toBe(2);
    expect(lastTurnEvents).toContainEqual({ kind: "cityCaptured", name: c.name, player: 1, by: s.barbarians });
    expect(buildOptions(s, c)).toEqual([{ kind: "unit", id: "legion" }]);
    expect(c.production).toEqual({ kind: "unit", id: "legion" });
    // With no unit left on the map, the city alone still gives them a turn.
    s.units = [];
    s.currentPlayer = 1;
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(s.barbarians);
  });

  it("are razed at size 1, and always under the simple barbarians of old saves", () => {
    for (const [simple, size] of [[false, 1], [true, 3]] as const) {
      const s = world(simple ? { simpleBarbarians: true } : {});
      const c = foundCity(s, 1, 11, 10);
      c.size = size;
      const raider = createUnit(s, "legion", s.barbarians, 10, 10);
      s.currentPlayer = s.barbarians;
      expect(move(s, raider.id, 1, 0).ok).toBe(true);
      expect(s.cities.includes(c)).toBe(false);
      expect(lastTurnEvents).toContainEqual({ kind: "cityLost", name: c.name, player: 1, by: s.barbarians });
    }
  });
});

describe("pillage", () => {
  it("wrecks the most valuable improvement first, one per turn", () => {
    const s = world();
    const t = getTile(s.map, 10, 10)!;
    t.irrigation = true; t.road = true; t.railroad = true;
    const u = createUnit(s, "legion", 0, 10, 10);
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      order.push(pillageTarget(s, u)!);
      expect(applyCommand(s, { type: "pillage", unit: u.id }).ok).toBe(true);
      // The order takes the whole turn.
      expect(applyCommand(s, { type: "pillage", unit: u.id })).toEqual({ ok: false, reason: i < 2 ? "no-moves" : "nothing to pillage" });
      u.movesLeft = 3;
    }
    expect(order).toEqual(["irrigation", "railroad", "road"]);
    expect([t.irrigation, t.railroad, t.road]).toEqual([false, false, false]);
  });

  it("is for soldiers outside cities", () => {
    const s = world();
    getTile(s.map, 10, 10)!.mine = true;
    getTile(s.map, 12, 10)!.irrigation = true;
    const settler = createUnit(s, "settlers", 0, 10, 10);
    expect(applyCommand(s, { type: "pillage", unit: settler.id })).toEqual({ ok: false, reason: "nothing to pillage" });
    foundCity(s, 0, 12, 10);
    const guard = createUnit(s, "legion", 0, 12, 10);
    expect(pillageTarget(s, guard)).toBeNull();
  });
});

describe("landings", () => {
  it("ignore zones of control stepping off a ship, except under an old save's rules", () => {
    for (const zocAtSea of [false, true]) {
      const s = world(zocAtSea ? { zocAtSea } : {});
      setRelation(s, 0, 1, "war");
      const ship = createUnit(s, "trireme", 0, 40, 10);
      const legion = createUnit(s, "legion", 0, 40, 10);
      legion.aboard = ship.id;
      createUnit(s, "militia", 1, 39, 10);
      const r = move(s, legion.id, -1, -1);
      expect(r.ok, String(zocAtSea)).toBe(!zocAtSea);
    }
  });

  it("old saves load with simple barbarians and zones of control at sea", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(321, opts);
    const old = loadSave({ ...makeSave(state, opts, []), version: 3 as const }, () => {});
    expect(old.state.simpleBarbarians).toBe(true);
    expect(old.state.zocAtSea).toBe(true);
    const fresh = loadSave(makeSave(state, opts, []), () => {});
    expect(fresh.state.simpleBarbarians).toBeUndefined();
    expect(fresh.state.zocAtSea).toBeUndefined();
  });
});
