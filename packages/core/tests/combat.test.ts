import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cargo,
  createUnit,
  defenseStrength,
  findPath,
  getTile,
  lastCombat,
  lastActions,
  lastTurnEvents,
  attackOdds,
  moveAllowance,
  newGame,
  unitType,
  winProbability,
  type UnitBattle,
  relation,
  setRelation,
  Terrain,
  type GameState,
  VETERAN_XP,
} from "../src/index.js";

/** Two civs plus barbarians on a flat world. */
function world(classicCombat = false): GameState {
  const s = newGame(1, { opponents: 1, ...(classicCombat ? { classicCombat } : {}) });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = []; s.cities = [];
  return s;
}

describe("combat", () => {
  it("refuses to attack without a state of war, then fights when at war", () => {
    const s = world();
    const a = createUnit(s, "legion", 0, 10, 10);
    createUnit(s, "militia", 1, 11, 10);
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "treaty" });
    setRelation(s, 0, 1, "war");
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(lastCombat).not.toBeNull();
    expect(s.units.length).toBe(1);
  });

  it("applies terrain, fortification, veteran and walls to defence", () => {
    const s = world();
    const a = createUnit(s, "legion", 0, 10, 10);
    const d = createUnit(s, "phalanx", 1, 11, 10);
    expect(defenseStrength(s, d, a)).toBe(2);
    getTile(s.map, 11, 10)!.terrain = Terrain.Hills;
    expect(defenseStrength(s, d, a)).toBe(4);
    d.order = { kind: "fortified" };
    expect(defenseStrength(s, d, a)).toBe(6);
    d.xp = VETERAN_XP;
    expect(defenseStrength(s, d, a)).toBe(9);
  });

  it("a losing stack outside a city is wiped out", () => {
    const s = world();
    setRelation(s, 0, 1, "war");
    const a = createUnit(s, "armor", 0, 10, 10);
    a.xp = VETERAN_XP;
    createUnit(s, "militia", 1, 11, 10);
    createUnit(s, "militia", 1, 11, 10);
    // 15 vs 1: near-certain win; retry seeds until the roll goes our way.
    let won = false;
    for (let i = 0; i < 20 && !won; i++) {
      applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
      if (lastCombat?.attackerWon) won = true;
      a.movesLeft = 9;
      if (!s.units.includes(a)) break;
    }
    expect(won).toBe(true);
    expect(s.units.filter((u) => u.owner === 1).length).toBe(0);
  });

  it("captures an undefended enemy city and plunders gold", () => {
    const s = world();
    setRelation(s, 0, 1, "war");
    const settler = createUnit(s, "settlers", 1, 12, 10);
    s.currentPlayer = 1;
    applyCommand(s, { type: "found", unit: settler.id });
    s.currentPlayer = 0;
    const city = s.cities[0]!;
    city.size = 3;
    s.players[1]!.gold = 90;
    const a = createUnit(s, "legion", 0, 11, 10);
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(city.owner).toBe(0);
    expect(city.size).toBe(2);
    expect(s.players[0]!.gold).toBeGreaterThan(0);
    expect(lastTurnEvents.some((e) => e.kind === "cityCaptured")).toBe(true);
  });
});

describe("transport", () => {
  it("boards a ship, sails, and disembarks", () => {
    const s = world();
    for (let x = 12; x < 20; x++) getTile(s.map, x, 10)!.terrain = Terrain.Ocean;
    const ship = createUnit(s, "trireme", 0, 12, 10);
    const inf = createUnit(s, "militia", 0, 11, 10);
    expect(applyCommand(s, { type: "move", unit: inf.id, dx: 1, dy: 0 }).ok).toBe(true);
    expect(inf.aboard).toBe(ship.id);
    expect(cargo(s, ship).length).toBe(1);
    const extra = createUnit(s, "militia", 0, 11, 10);
    const extra2 = createUnit(s, "militia", 0, 11, 10);
    applyCommand(s, { type: "move", unit: extra.id, dx: 1, dy: 0 });
    expect(applyCommand(s, { type: "move", unit: extra2.id, dx: 1, dy: 0 })).toEqual({ ok: false, reason: "full" });
    applyCommand(s, { type: "move", unit: ship.id, dx: 1, dy: 0 });
    expect(inf.x).toBe(13);
    applyCommand(s, { type: "endTurn" });
    applyCommand(s, { type: "endTurn" }); // back to player 0
    inf.order = { kind: "none" };
    getTile(s.map, 13, 9)!.terrain = Terrain.Grassland;
    expect(applyCommand(s, { type: "move", unit: inf.id, dx: 0, dy: -1 }).ok).toBe(true);
    expect(inf.aboard).toBeNull();
  });
});

/** The fight the last command started, from the action log. */
function lastBattle(from: number): UnitBattle {
  const b = lastActions.slice(from).find((x) => x.kind === "battle");
  expect(b).toBeDefined();
  return b as UnitBattle;
}

describe("hit points", () => {
  it("fights in rounds: each lost round costs the winner's firepower, and the survivor keeps its wounds", () => {
    const s = world();
    setRelation(s, 0, 1, "war");
    const a = createUnit(s, "legion", 0, 10, 10);
    const d = createUnit(s, "phalanx", 1, 11, 10);
    expect([a.hp, d.hp]).toEqual([10, 10]);
    const mark = lastActions.length;
    expect(applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 }).ok).toBe(true);
    const b = lastBattle(mark);
    const wins = b.rounds.filter(Boolean).length;
    const losses = b.rounds.length - wins;
    expect(b.attacker).toMatchObject({ unit: a.id, hp: 10, maxHp: 10, firepower: 1, x: 10, y: 10 });
    expect(b.defender).toMatchObject({ unit: d.id, hp: 10, maxHp: 10, firepower: 1, x: 11, y: 10 });
    // The winner landed the tenth blow, in the last round.
    expect(b.attackerWon ? wins : losses).toBe(10);
    expect(b.rounds.at(-1)).toBe(b.attackerWon);
    const winner = b.attackerWon ? a : d;
    expect(s.units.includes(winner)).toBe(true);
    expect(s.units.includes(b.attackerWon ? d : a)).toBe(false);
    expect(winner.hp).toBe(10 - (b.attackerWon ? losses : wins));
    expect(lastCombat).toMatchObject({ attackerWon: b.attackerWon, attackerHp: a.hp, defenderHp: b.attackerWon ? 0 : d.hp, attackerMaxHp: 10, defenderMaxHp: 10 });
  });

  it("later units are tougher and the heaviest guns hit for two", () => {
    expect(unitType("militia").hp).toBe(10);
    expect(unitType("musketeers").hp).toBe(20);
    expect(unitType("armor").hp).toBe(30);
    expect(unitType("battleship")).toMatchObject({ hp: 40, firepower: 2 });
    const s = world();
    setRelation(s, 0, 1, "war");
    const a = createUnit(s, "artillery", 0, 10, 10);
    createUnit(s, "musketeers", 1, 11, 10);
    const mark = lastActions.length;
    applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
    const b = lastBattle(mark);
    expect(b.defender).toMatchObject({ hp: 20, maxHp: 20 });
    expect(b.attacker.firepower).toBe(2);
    if (b.attackerWon) expect(b.rounds.filter(Boolean).length).toBe(10); // 20 hp at 2 a blow
  });

  it("a stack beaten in the open falls with its defender, listed as lost with it", () => {
    const s = world();
    setRelation(s, 0, 1, "war");
    const a = createUnit(s, "armor", 0, 10, 10);
    a.xp = VETERAN_XP;
    const d1 = createUnit(s, "militia", 1, 11, 10);
    const d2 = createUnit(s, "militia", 1, 11, 10);
    const mark = lastActions.length;
    applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
    const b = lastBattle(mark);
    expect(b.attackerWon).toBe(true); // 15 against 1 over ten blows each way
    expect(b.alsoLost).toEqual([b.defender.unit === d1.id ? d2.id : d1.id]);
    expect(s.units.filter((u) => u.owner === 1)).toEqual([]);
  });

  it("heals a unit that rests: a tenth in the field, a third in a city, all of it with barracks", () => {
    const s = world();
    const roundTrip = () => { applyCommand(s, { type: "endTurn" }); while (s.currentPlayer !== 0) applyCommand(s, { type: "endTurn" }); };
    const u = createUnit(s, "legion", 0, 10, 10);
    u.hp = 3;
    roundTrip();
    expect(u.hp).toBe(4);
    u.movesLeft = 0; // it moved: no rest this turn
    roundTrip();
    expect(u.hp).toBe(4);
    const settlers = createUnit(s, "settlers", 0, 20, 20);
    expect(applyCommand(s, { type: "found", unit: settlers.id }).ok).toBe(true);
    u.x = 20; u.y = 20;
    roundTrip();
    expect(u.hp).toBe(7);
    s.cities[0]!.buildings.push("barracks");
    roundTrip();
    expect(u.hp).toBe(10);
    expect(u.movesLeft).toBe(moveAllowance(s, u));
  });

  it("classic combat settles a fight in one roll and leaves no wounds", () => {
    const s = world(true);
    setRelation(s, 0, 1, "war");
    const a = createUnit(s, "legion", 0, 10, 10);
    const d = createUnit(s, "musketeers", 1, 11, 10);
    expect([a.hp, d.hp]).toEqual([10, 10]);
    const mark = lastActions.length;
    applyCommand(s, { type: "move", unit: a.id, dx: 1, dy: 0 });
    const b = lastBattle(mark);
    expect(b.rounds).toHaveLength(1);
    expect((b.attackerWon ? a : d).hp).toBe(10);
  });

  it("works out the odds over every round", () => {
    expect(winProbability(0.5, 1, 1)).toBeCloseTo(0.5);
    expect(winProbability(0.5, 10, 10)).toBeCloseTo(0.5);
    expect(winProbability(0.6, 10, 10)).toBeGreaterThan(0.8);
    expect(winProbability(1, 5, 1)).toBe(1);
    expect(winProbability(0, 1, 5)).toBe(0);
    // Against a simulation with a fixed generator.
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    let won = 0;
    const trials = 20000;
    for (let t = 0; t < trials; t++) {
      let need = 10;
      let lives = 20;
      while (need > 0 && lives > 0) if (rand() < 0.4) need--; else lives--;
      if (need === 0) won++;
    }
    expect(winProbability(0.4, 10, 20)).toBeCloseTo(won / trials, 1);
    const s = world();
    const a = createUnit(s, "legion", 0, 10, 10);
    const d = createUnit(s, "phalanx", 1, 11, 10);
    expect(attackOdds(s, a, d)).toBeCloseTo(winProbability(3 / 5, 10, 10));
    d.hp = 1;
    expect(attackOdds(s, a, d)).toBeGreaterThan(0.99);
  });
});

describe("unit steps", () => {
  it("records each square moved, cargo with its ship, a goto square by square, and clears at end of turn", () => {
    const s = world();
    applyCommand(s, { type: "endTurn" });
    applyCommand(s, { type: "endTurn" }); // a fresh turn for player 0, nothing recorded yet
    lastActions.length = 0;
    for (let x = 12; x < 20; x++) getTile(s.map, x, 10)!.terrain = Terrain.Ocean;
    const ship = createUnit(s, "trireme", 0, 12, 10);
    const inf = createUnit(s, "militia", 0, 11, 10);
    applyCommand(s, { type: "move", unit: inf.id, dx: 1, dy: 0 });
    expect(lastActions).toEqual([{ kind: "step", unit: inf.id, type: "militia", owner: 0, fromX: 11, fromY: 10, toX: 12, toY: 10 }]);
    applyCommand(s, { type: "move", unit: ship.id, dx: 1, dy: 0 });
    expect(lastActions.slice(1)).toEqual([
      { kind: "step", unit: ship.id, type: "trireme", owner: 0, fromX: 12, fromY: 10, toX: 13, toY: 10 },
      { kind: "step", unit: inf.id, type: "militia", owner: 0, fromX: 12, fromY: 10, toX: 13, toY: 10, aboard: ship.id },
    ]);
    const walker = createUnit(s, "cavalry", 0, 3, 3);
    const mark = lastActions.length;
    applyCommand(s, { type: "goto", unit: walker.id, x: 5, y: 3 });
    const walked = lastActions.slice(mark);
    expect(walked).toHaveLength(2);
    expect(walked[0]).toMatchObject({ unit: walker.id, fromX: 3, fromY: 3 });
    expect(walked[1]).toMatchObject({ fromX: walked[0]!.toX, fromY: walked[0]!.toY, toX: 5, toY: 3 });
    // Across the seam the step is recorded wrapped, as the unit stands.
    const edge = createUnit(s, "militia", 0, 0, 20);
    applyCommand(s, { type: "move", unit: edge.id, dx: -1, dy: 0 });
    expect(lastActions.at(-1)).toMatchObject({ fromX: 0, toX: s.map.width - 1 });
    applyCommand(s, { type: "endTurn" });
    expect(lastActions.every((st) => st.owner !== 0)).toBe(true);
  });
});

describe("goto", () => {
  it("routes around water and walks over several turns", () => {
    const s = world();
    for (let y = 5; y < 15; y++) getTile(s.map, 12, y)!.terrain = Terrain.Ocean;
    const u = createUnit(s, "militia", 0, 10, 10);
    const path = findPath(s, u, 14, 10);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(4);
    expect(applyCommand(s, { type: "goto", unit: u.id, x: 14, y: 10 }).ok).toBe(true);
    for (let i = 0; i < 12 && u.order.kind === "goto"; i++) {
      applyCommand(s, { type: "endTurn" });
      applyCommand(s, { type: "endTurn" });
    }
    expect([u.x, u.y]).toEqual([14, 10]);
    expect(u.order.kind).toBe("none");
  });
});

describe("diplomacy and turns", () => {
  it("makes contact when units meet and cycles players", () => {
    const s = world();
    expect(relation(s, 0, 1)).toBe("none");
    createUnit(s, "militia", 0, 10, 10);
    createUnit(s, "settlers", 0, 30, 20);
    const b = createUnit(s, "militia", 1, 12, 10);
    createUnit(s, "settlers", 1, 20, 20);
    s.currentPlayer = 1;
    applyCommand(s, { type: "move", unit: b.id, dx: -1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("contact"); // met, no treaty yet
    expect(lastTurnEvents.some((e) => e.kind === "contact")).toBe(true);
    s.currentPlayer = 0;
    const turn = s.turn;
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(1);
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(0);
    expect(s.turn).toBe(turn + 1);
  });
});
