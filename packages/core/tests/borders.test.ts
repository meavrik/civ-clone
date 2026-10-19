import { describe, expect, it } from "vitest";
import {
  applyCommand,
  borderRadius,
  bordersOpen,
  building,
  claims,
  CULTURE,
  cultureRate,
  createUnit,
  landOwner,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  nextBorderLevel,
  relation,
  setRelation,
  Terrain,
  trespassers,
  trespassRecord,
  type GameState,
  type NewGameOptions,
} from "../src/index.js";

/** Two civs plus barbarians on a flat world, nobody on it yet. */
function world(opts: NewGameOptions = {}): GameState {
  const s = newGame(5, { opponents: 1, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  }
  s.units = [];
  s.cities = [];
  return s;
}

/** Civ 1 holds a city at (30, 10); we have a city far away; the two are at peace. Both reach two squares out, as ten turns' culture takes them. */
function neighbours(opts: NewGameOptions = {}): GameState {
  const s = world(opts);
  const ours = createUnit(s, "settlers", 0, 10, 10);
  applyCommand(s, { type: "found", unit: ours.id });
  s.currentPlayer = 1;
  const theirs = createUnit(s, "settlers", 1, 30, 10);
  applyCommand(s, { type: "found", unit: theirs.id });
  s.currentPlayer = 0;
  setRelation(s, 0, 1, "peace");
  for (const c of s.cities) c.culture = 10;
  lastTurnEvents.length = 0;
  return s;
}

describe("contact", () => {
  it("is made face to face, and the meeting stops the unit that walked into it", () => {
    const s = world();
    createUnit(s, "militia", 1, 20, 10);
    const scout = createUnit(s, "cavalry", 0, 16, 10);
    scout.movesLeft = 30;
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("none"); // two squares apart: not yet
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("peace");
    expect(lastTurnEvents).toContainEqual({ kind: "contact", player: 1 });
    expect(scout.movesLeft).toBe(0);
  });

  it("stops a unit on a goto where it meets someone", () => {
    const s = world();
    s.players[0]!.explored.fill(1);
    // A causeway one square wide, past a city of theirs.
    for (let y = 5; y < 16; y++) for (let x = 14; x < 33; x++) if (y !== 10) s.map.tiles[y * s.map.width + x]!.terrain = Terrain.Ocean;
    s.map.tiles[11 * s.map.width + 20]!.terrain = Terrain.Grassland;
    s.currentPlayer = 1;
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 1, 20, 11).id });
    s.currentPlayer = 0;
    const scout = createUnit(s, "cavalry", 0, 16, 10);
    scout.movesLeft = 30;
    expect(applyCommand(s, { type: "goto", unit: scout.id, x: 30, y: 10 }).ok).toBe(true);
    expect(relation(s, 0, 1)).toBe("peace");
    expect(scout.x).toBe(19);
    expect(scout.order.kind).toBe("goto"); // it walks on next turn
  });

  it("keeps the old two-square meeting, with no stop, in saves before version 10", () => {
    const s = world({ farContact: true });
    createUnit(s, "militia", 1, 20, 10);
    const scout = createUnit(s, "cavalry", 0, 16, 10);
    scout.movesLeft = 30;
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("peace");
    expect(scout.movesLeft).toBeGreaterThan(0);
  });

  it("lets cities see the squares next to them", () => {
    const s = neighbours();
    const w = s.map.width;
    s.units = [];
    applyCommand(s, { type: "endTurn" });
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(0);
    expect(s.players[0]!.visible[10 * w + 11]).toBe(1);
    expect(s.players[0]!.visible[10 * w + 12]).toBe(0);
  });
});

describe("land", () => {
  it("is the same square by square as on the whole map", () => {
    const s = neighbours();
    s.currentPlayer = 1;
    for (const [x, y] of [[33, 10], [12, 12], [36, 11]] as const) {
      const c = createUnit(s, "settlers", 1, x, y);
      applyCommand(s, { type: "found", unit: c.id });
    }
    const all = claims(s);
    const w = s.map.width;
    for (let y = 0; y < s.map.height; y++)
      for (let x = 0; x < w; x++) expect(landOwner(s, x, y)).toBe(all[y * w + x]);
  });
});

describe("culture", () => {
  it("lets a new city claim the squares round it, and reach further as its culture mounts", () => {
    const s = neighbours();
    const theirs = s.cities.find((c) => c.owner === 1)!;
    theirs.culture = 0;
    expect(borderRadius(s, theirs)).toBe(1);
    expect(landOwner(s, 31, 11)).toBe(1);
    expect(landOwner(s, 32, 10)).toBe(-1);
    theirs.culture = 10;
    expect(landOwner(s, 32, 11)).toBe(1); // the 21 squares it works
    expect(landOwner(s, 33, 10)).toBe(-1);
    theirs.culture = 60;
    expect(landOwner(s, 33, 11)).toBe(1);
    expect(landOwner(s, 33, 13)).toBe(-1); // the rim of a disc, not a square
    theirs.culture = CULTURE.levels.at(-1)!;
    expect(borderRadius(s, theirs)).toBe(CULTURE.levels.length + 1);
    expect(nextBorderLevel(s, theirs)).toBeNull();
  });

  it("is gathered every turn from a city's people, buildings and wonders, and says when the border grows", () => {
    const s = neighbours();
    const ours = s.cities.find((c) => c.owner === 0)!;
    ours.culture = 0;
    expect(cultureRate(s, ours)).toBe(CULTURE.base + building("palace").culture!);
    ours.buildings = [];
    expect(cultureRate(s, ours)).toBe(CULTURE.base);
    ours.size = 8;
    ours.buildings.push("temple");
    ours.wonders.push("pyramids");
    expect(cultureRate(s, ours)).toBe(CULTURE.base + 2 + building("temple").culture! + CULTURE.wonder);
    ours.culture = CULTURE.levels[0]! - 1;
    const rate = cultureRate(s, ours);
    applyCommand(s, { type: "endTurn" });
    expect(ours.culture).toBe(CULTURE.levels[0]! - 1 + rate);
    expect(borderRadius(s, ours)).toBe(2);
    expect(lastTurnEvents).toContainEqual({ city: ours.id, kind: "borders" });
  });

  it("settles a square two cities reach equally for the one with more culture", () => {
    const s = neighbours();
    s.currentPlayer = 0;
    const settler = createUnit(s, "settlers", 0, 26, 10);
    applyCommand(s, { type: "found", unit: settler.id });
    const [ours, theirs] = [s.cities.find((c) => c.x === 26)!, s.cities.find((c) => c.owner === 1)!];
    ours.culture = 10;
    theirs.culture = 10;
    expect(landOwner(s, 28, 10)).toBe(1); // as far from each, as much culture: the older city's
    ours.culture = 11;
    expect(landOwner(s, 28, 10)).toBe(0);
    theirs.culture = 12;
    expect(landOwner(s, 28, 10)).toBe(1);
    expect(landOwner(s, 27, 10)).toBe(0); // the nearer city keeps its side, whatever the culture
  });

  it("never moves borders in saves before version 12", () => {
    const s = neighbours({ fixedBorders: true });
    const theirs = s.cities.find((c) => c.owner === 1)!;
    theirs.culture = 5000;
    expect(borderRadius(s, theirs)).toBe(2);
    applyCommand(s, { type: "endTurn" });
    const before = theirs.culture;
    while (s.currentPlayer !== 0) applyCommand(s, { type: "endTurn" });
    expect(theirs.culture).toBe(before);
    const old = { ...makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), version: 11 as const };
    expect(loadSave(old, () => {}).state.fixedBorders).toBe(true);
    expect(loadSave(makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), () => {}).state.fixedBorders).toBeUndefined();
  });
});

describe("trespass", () => {
  it("asks a unit stepping onto foreign land to leave, once, and counts it as the first warning", () => {
    const s = neighbours();
    const u = createUnit(s, "militia", 0, 27, 10);
    applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 });
    expect(lastTurnEvents).toContainEqual({ kind: "trespass", player: 1, intruder: 0, unit: u.id, x: 28, y: 10, warnings: 1 });
    expect(trespassRecord(s, 1, 0)).toEqual({ turn: s.turn, warnings: 1 });
    lastTurnEvents.length = 0;
    applyCommand(s, { type: "move", unit: u.id, dx: 0, dy: 1 }); // still inside: no new request
    expect(lastTurnEvents.some((e) => e.kind === "trespass")).toBe(false);
    expect(trespassers(s, 1, 0).map((t) => t.id)).toEqual([u.id]);
  });

  it("minds neither diplomats and caravans, nor anyone at war or with open borders", () => {
    const s = neighbours();
    const d = createUnit(s, "diplomat", 0, 27, 10);
    applyCommand(s, { type: "move", unit: d.id, dx: 1, dy: 0 });
    expect(trespassers(s, 1, 0)).toEqual([]);
    const u = createUnit(s, "militia", 0, 28, 11);
    expect(trespassers(s, 1, 0).length).toBe(1);
    expect(applyCommand(s, { type: "openBorders", player: 1 }).ok).toBe(true);
    expect(bordersOpen(s, 1, 0)).toBe(true);
    expect(trespassers(s, 1, 0)).toEqual([]);
    applyCommand(s, { type: "declareWar", player: 1 });
    expect(bordersOpen(s, 0, 1)).toBe(false);
    expect(trespassers(s, 1, 0)).toEqual([]);
    void u;
  });

  it("is never minded in saves before version 10", () => {
    const s = neighbours({ noTrespass: true });
    const u = createUnit(s, "militia", 0, 27, 10);
    applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 });
    expect(lastTurnEvents.some((e) => e.kind === "trespass")).toBe(false);
    expect(trespassers(s, 1, 0)).toEqual([]);
  });

  it("escalates with each demand, is forgiven for a gift, and is dropped once the units have gone", () => {
    const s = neighbours();
    const u = createUnit(s, "militia", 0, 29, 10);
    s.currentPlayer = 1;
    expect(applyCommand(s, { type: "demandLeave", player: 0 }).ok).toBe(true);
    expect(applyCommand(s, { type: "demandLeave", player: 0 }).ok).toBe(true);
    expect(lastTurnEvents.at(-1)).toEqual({ kind: "leaveDemand", player: 1, to: 0, warnings: 2 });
    s.currentPlayer = 0;
    s.players[0]!.gold = 100;
    applyCommand(s, { type: "giveGold", player: 1, amount: 50 });
    expect(trespassRecord(s, 1, 0)).toBeUndefined();
    s.currentPlayer = 1;
    applyCommand(s, { type: "demandLeave", player: 0 });
    // We walk out; their next turn forgets it.
    s.currentPlayer = 0;
    u.x = 20;
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(1);
    expect(trespassRecord(s, 1, 0)).toBeUndefined();
    expect(applyCommand(s, { type: "demandLeave", player: 0 })).toEqual({ ok: false, reason: "no one trespasses" });
  });
});

describe("treaties", () => {
  it("share maps both ways, at peace only", () => {
    const s = neighbours();
    const w = s.map.width;
    s.players[0]!.explored.fill(0);
    s.players[1]!.explored.fill(0);
    s.players[0]!.explored[5 * w + 5] = 1;
    s.players[1]!.explored[6 * w + 6] = 1;
    expect(applyCommand(s, { type: "shareMaps", player: 1 }).ok).toBe(true);
    expect(s.players[0]!.explored[6 * w + 6]).toBe(1);
    expect(s.players[1]!.explored[5 * w + 5]).toBe(1);
    applyCommand(s, { type: "declareWar", player: 1 });
    expect(applyCommand(s, { type: "shareMaps", player: 1 }).ok).toBe(false);
  });

  it("take tribute from a civilization that gives in, and remember when", () => {
    const s = neighbours();
    s.players[0]!.gold = 0;
    s.players[1]!.gold = 80;
    expect(applyCommand(s, { type: "tribute", player: 1, amount: 100 }).ok).toBe(false);
    expect(applyCommand(s, { type: "tribute", player: 1, amount: 20 }).ok).toBe(true);
    expect([s.players[0]!.gold, s.players[1]!.gold]).toEqual([20, 60]);
    expect(s.tributePaid?.["1>0"]).toBe(s.turn);
  });

  it("say who declared war on whom, and why", () => {
    const s = neighbours();
    s.currentPlayer = 1;
    applyCommand(s, { type: "declareWar", player: 0, reason: "trespass" });
    expect(lastTurnEvents).toContainEqual({ kind: "warDeclared", player: 1, on: 0, reason: "trespass" });
  });
});

describe("saves", () => {
  it("load games saved before version 10 with far contact and no trespass", () => {
    const s = newGame(9, { opponents: 2 });
    const save = { ...makeSave(s, { opponents: 2 }, []), version: 9 as const };
    const loaded = loadSave(save, () => {});
    expect(loaded.state.farContact).toBe(true);
    expect(loaded.state.noTrespass).toBe(true);
    expect(loadSave(makeSave(s, { opponents: 2 }, []), () => {}).state.farContact).toBeUndefined();
  });
});
