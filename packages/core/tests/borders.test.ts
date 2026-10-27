import { describe, expect, it } from "vitest";
import { exitSquare, foundCity } from "../src/index.js";
import {
  applyCommand,
  borderRadius,
  bordersOpen,
  building,
  claims,
  ACCRUED_CULTURE,
  autoAssignWorkers,
  cityCulture,
  CITY_RADIUS,
  civInfluence,
  computeCity,
  CULTURE,
  cultureRate,
  createUnit,
  dropLostSquares,
  esteem,
  getTile,
  GOLD_WORTH,
  goldScale,
  GOODWILL,
  goodwill,
  INFLUENCE,
  influenceSpecials,
  landOwner,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  nextBorderLevel,
  peaceOffered,
  relation,
  setRelation,
  slotAvailable,
  slotInLand,
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

/** Civ 1 holds a city at (30, 10); we have a city far away; the two are at peace. Both have grown until their borders reach two squares out. */
function neighbours(opts: NewGameOptions = {}): GameState {
  const s = world(opts);
  const ours = createUnit(s, "settlers", 0, 10, 10);
  applyCommand(s, { type: "found", unit: ours.id });
  s.currentPlayer = 1;
  const theirs = createUnit(s, "settlers", 1, 30, 10);
  applyCommand(s, { type: "found", unit: theirs.id });
  s.currentPlayer = 0;
  setRelation(s, 0, 1, "peace");
  for (const c of s.cities) {
    if (s.accruedCulture) c.culture = 10; // ten turns' culture, as old saves gathered it
    else {
      c.size += CULTURE.levels[0]! - cityCulture(s, c);
      autoAssignWorkers(s, c);
    }
  }
  lastTurnEvents.length = 0;
  return s;
}

describe("withdrawal", () => {
  it("sends a civilization's units off our land to the nearest way out when it agrees to leave", () => {
    const s = newGame(1, { opponents: 1, classicCivs: true });
    s.units = [];
    s.cities = [];
    foundCity(s, 0, 10, 10);
    setRelation(s, 0, 1, "contact");
    for (const t of s.map.tiles) { t.terrain = Terrain.Grassland; t.river = false; }
    const scout = createUnit(s, "militia", 1, 11, 10);
    expect(trespassers(s, 0, 1).map((u) => u.id)).toEqual([scout.id]);
    const exit = exitSquare(s, scout, 0)!;
    expect(exit).not.toBeNull();
    expect(landOwner(s, exit.x, exit.y)).not.toBe(0);
    expect(applyCommand(s, { type: "withdraw", player: 1 }).ok).toBe(true);
    expect(scout.order).toEqual({ kind: "goto", x: exit.x, y: exit.y });
    expect(trespassRecord(s, 0, 1)).toBeUndefined(); // their trespass so far is forgiven
    // Nothing to ask of a civilization with no unit on our land.
    expect(applyCommand(s, { type: "withdraw", player: 1 }).ok).toBe(true); // still there until its turn
    s.units = [];
    expect(applyCommand(s, { type: "withdraw", player: 1 }).ok).toBe(false);
  });
});

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
    expect(relation(s, 0, 1)).toBe("contact"); // met: no treaty yet
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
    expect(relation(s, 0, 1)).toBe("contact");
    expect(scout.x).toBe(19);
    expect(scout.order.kind).toBe("goto"); // it walks on next turn
  });

  it("keeps the old two-square meeting, with no stop, in saves before version 10", () => {
    const s = world({ farContact: true, peaceOnContact: true });
    createUnit(s, "militia", 1, 20, 10);
    const scout = createUnit(s, "cavalry", 0, 16, 10);
    scout.movesLeft = 30;
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("peace"); // and old saves made peace on meeting
    expect(scout.movesLeft).toBeGreaterThan(0);
  });

  it("lets a civilization see its land and a square beyond it", () => {
    const s = neighbours();
    const w = s.map.width;
    s.units = [];
    applyCommand(s, { type: "endTurn" });
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(0);
    expect(s.players[0]!.visible[10 * w + 13]).toBe(1); // the border reaches two out, sight one more
    expect(s.players[0]!.visible[10 * w + 14]).toBe(0);
  });

  it("lets cities see only the squares next to them in saves before version 30", () => {
    const s = neighbours({ narrowSight: true });
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
  it("lets a new city claim the squares round it, and reach further as its culture grows", () => {
    const s = neighbours();
    const theirs = s.cities.find((c) => c.owner === 1)!;
    theirs.buildings = [];
    theirs.size = 1;
    expect(borderRadius(s, theirs)).toBe(1);
    expect(landOwner(s, 31, 11)).toBe(1);
    expect(landOwner(s, 32, 10)).toBe(-1);
    theirs.size = CULTURE.levels[0]! - 1;
    expect(borderRadius(s, theirs)).toBe(1); // people alone take long
    theirs.size++;
    expect(landOwner(s, 32, 11)).toBe(1); // the 21 squares it works
    expect(landOwner(s, 33, 10)).toBe(-1);
    theirs.size = CULTURE.levels[1]! - building("temple").culture!;
    theirs.buildings.push("temple");
    expect(landOwner(s, 33, 11)).toBe(1);
    expect(landOwner(s, 33, 13)).toBe(-1); // the rim of a disc, not a square
    theirs.size = CULTURE.levels.at(-1)!;
    expect(borderRadius(s, theirs)).toBe(CULTURE.levels.length + 1);
    expect(nextBorderLevel(s, theirs)).toBeNull();
  });

  it("gives the capital its 21 squares at size three, not the day it is founded (before version 36 at once)", () => {
    for (const wideCapital of [false, true]) {
      const s = world(wideCapital ? { wideCapital } : {});
      const settlers = createUnit(s, "settlers", 0, 10, 10);
      applyCommand(s, { type: "found", unit: settlers.id });
      const capital = s.cities[0]!;
      expect(capital.buildings).toContain("palace");
      expect(borderRadius(s, capital)).toBe(wideCapital ? 2 : 1);
      capital.size = 3;
      expect(borderRadius(s, capital)).toBe(2);
    }
    const old = { ...makeSave(newGame(9, { opponents: 1 }), { opponents: 1 }, []), version: 35 as const };
    expect(loadSave(old, () => {}).state.wideCapital).toBe(true);
  });

  it("is what a city's people, buildings and wonders make it, not more each turn, and says when the border grows", () => {
    const s = neighbours();
    const ours = s.cities.find((c) => c.owner === 0)!;
    ours.size = 1;
    autoAssignWorkers(s, ours);
    expect(cityCulture(s, ours)).toBe(CULTURE.perCitizen + building("palace").culture!);
    ours.buildings = [];
    expect(cityCulture(s, ours)).toBe(CULTURE.perCitizen);
    ours.size = 4;
    autoAssignWorkers(s, ours);
    ours.buildings.push("temple");
    ours.wonders.push("pyramids");
    const culture = 4 * CULTURE.perCitizen + building("temple").culture! + CULTURE.wonder;
    expect(cityCulture(s, ours)).toBe(culture);
    applyCommand(s, { type: "endTurn" });
    while (s.currentPlayer !== 0) applyCommand(s, { type: "endTurn" });
    expect(cityCulture(s, ours)).toBe(culture);
    expect(ours.culture).toBe(0);
    // A city one citizen short of the next level grows into it.
    ours.buildings = [];
    ours.wonders = [];
    ours.size = CULTURE.levels[0]! - 1;
    autoAssignWorkers(s, ours);
    expect(borderRadius(s, ours)).toBe(1);
    ours.food = computeCity(s, ours).foodBox;
    lastTurnEvents.length = 0;
    applyCommand(s, { type: "endTurn" });
    expect(ours.size).toBe(CULTURE.levels[0]);
    expect(borderRadius(s, ours)).toBe(2);
    expect(lastTurnEvents).toContainEqual({ city: ours.id, kind: "borders" });
  });

  it("brings a city trade from specials inside its border beyond the squares it works, since version 28", () => {
    const s = neighbours();
    const ours = s.cities.find((c) => c.owner === 0)!;
    // Culture enough for a border three squares out; gold in the mountains three squares east of the
    // city, whales in the sea three to the north: beyond the 21 squares it works, inside its land.
    ours.size = CULTURE.levels[1]!;
    autoAssignWorkers(s, ours);
    expect(borderRadius(s, ours)).toBe(3);
    const gold = getTile(s.map, 13, 10)!;
    gold.terrain = Terrain.Mountains;
    gold.special = true;
    const sea = getTile(s.map, 10, 7)!;
    sea.terrain = Terrain.Ocean;
    sea.special = true;
    sea.secondSpecial = true;
    expect(influenceSpecials(s, ours).map((i) => `${i.special.name} ${i.trade}`).sort()).toEqual(["Gold 3", "Whales 1"]);
    const before = computeCity(s, ours);
    expect(before.influence).toBe(4);
    // A square claimed by another city of ours brings this one nothing.
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 0, 14, 10).id });
    expect(landOwner(s, 13, 10)).toBe(0);
    expect(influenceSpecials(s, ours).map((i) => i.special.name)).toEqual(["Whales"]);
    expect(computeCity(s, ours).trade).toBe(before.trade - 3);
    // Nothing in saves before version 28.
    s.noInfluenceYields = true;
    expect(computeCity(s, ours).influence).toBe(0);
  });

  it("settles a square two cities reach equally for the one with more culture", () => {
    const s = neighbours();
    s.currentPlayer = 0;
    const settler = createUnit(s, "settlers", 0, 26, 10);
    applyCommand(s, { type: "found", unit: settler.id });
    const [ours, theirs] = [s.cities.find((c) => c.x === 26)!, s.cities.find((c) => c.owner === 1)!];
    ours.size = cityCulture(s, theirs);
    expect(borderRadius(s, ours)).toBe(2);
    expect(landOwner(s, 28, 10)).toBe(1); // as far from each, as much culture: the older city's
    ours.size++;
    expect(landOwner(s, 28, 10)).toBe(0);
    theirs.size += 2;
    expect(landOwner(s, 28, 10)).toBe(1);
    expect(landOwner(s, 27, 10)).toBe(0); // the nearer city keeps its side, whatever the culture
  });

  it("was gathered every turn in saves before version 14", () => {
    const s = neighbours({ accruedCulture: true });
    const ours = s.cities.find((c) => c.owner === 0)!;
    expect(cultureRate(s, ours)).toBe(ACCRUED_CULTURE.base + ACCRUED_CULTURE.buildings.palace!);
    ours.culture = ACCRUED_CULTURE.levels[0]! - 1;
    expect(borderRadius(s, ours)).toBe(1);
    const rate = cultureRate(s, ours);
    applyCommand(s, { type: "endTurn" });
    expect(ours.culture).toBe(ACCRUED_CULTURE.levels[0]! - 1 + rate);
    expect(borderRadius(s, ours)).toBe(2);
    expect(lastTurnEvents).toContainEqual({ city: ours.id, kind: "borders" });
    const old = { ...makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), version: 13 as const };
    expect(loadSave(old, () => {}).state.accruedCulture).toBe(true);
    expect(loadSave(makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), () => {}).state.accruedCulture).toBeUndefined();
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
  it("notes a unit stepping onto foreign land, a turn to leave before anyone asks (before version 37 the first warning)", () => {
    const s = neighbours();
    const u = createUnit(s, "militia", 0, 27, 10);
    applyCommand(s, { type: "move", unit: u.id, dx: 1, dy: 0 });
    expect(lastTurnEvents).toContainEqual({ kind: "trespass", player: 1, intruder: 0, unit: u.id, x: 28, y: 10, warnings: 0 });
    expect(trespassRecord(s, 1, 0)).toEqual({ turn: s.turn, warnings: 0 });
    lastTurnEvents.length = 0;
    applyCommand(s, { type: "move", unit: u.id, dx: 0, dy: 1 }); // still inside: nothing new
    expect(lastTurnEvents.some((e) => e.kind === "trespass")).toBe(false);
    expect(trespassers(s, 1, 0).map((t) => t.id)).toEqual([u.id]);
    // The first demand counts one.
    s.currentPlayer = 1;
    applyCommand(s, { type: "demandLeave", player: 0 });
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(1);
    // Saves before version 37: stepping in was the first demand.
    const old = neighbours({ askOnEntry: true });
    const v = createUnit(old, "militia", 0, 27, 10);
    applyCommand(old, { type: "move", unit: v.id, dx: 1, dy: 0 });
    expect(trespassRecord(old, 1, 0)).toEqual({ turn: old.turn, warnings: 1 });
  });

  it("notes units found on the land as its owner's turn begins, and drops them once gone", () => {
    const s = neighbours();
    const u = createUnit(s, "militia", 0, 29, 10);
    applyCommand(s, { type: "endTurn" });
    expect(s.currentPlayer).toBe(1);
    expect(trespassRecord(s, 1, 0)).toEqual({ turn: s.turn, warnings: 0 });
    u.x = 20;
    const noted = s.turn;
    while (s.currentPlayer !== 1 || s.turn === noted) applyCommand(s, { type: "endTurn" });
    expect(trespassRecord(s, 1, 0)).toBeUndefined();
    // Not in saves before version 37: the AI asked at once.
    const old = neighbours({ askOnEntry: true });
    createUnit(old, "militia", 0, 29, 10);
    applyCommand(old, { type: "endTurn" });
    expect(trespassRecord(old, 1, 0)).toBeUndefined();
  });

  it("weighs gifts of gold by what gold is worth to the receiver, and lets generous ones sway them for a while", () => {
    const s = neighbours();
    s.players[0]!.gold = 1000;
    s.players[1]!.gold = 0;
    const scale = goldScale(s, 1);
    expect(scale).toBe(GOLD_WORTH.base + GOLD_WORTH.perCitizen * s.cities.filter((c) => c.owner === 1).reduce((n, c) => n + c.size, 0));
    applyCommand(s, { type: "giveGold", player: 1, amount: 10 });
    expect(s.gifts?.["0>1"]).toEqual([{ turn: s.turn, gold: 10, share: 10 / scale }]);
    expect(goodwill(s, 0, 1)).toBe(false);
    applyCommand(s, { type: "giveGold", player: 1, amount: Math.ceil(scale / 2) });
    expect(goodwill(s, 0, 1)).toBe(true);
    expect(goodwill(s, 1, 0)).toBe(false);
    s.turn += GOODWILL.turns;
    expect(goodwill(s, 0, 1)).toBe(false);
    // Old gifts are dropped as new ones come.
    applyCommand(s, { type: "giveGold", player: 1, amount: 10 });
    expect(s.gifts?.["0>1"]).toHaveLength(1);
    expect(goodwill(neighbours({ noGoodwill: true }), 0, 1)).toBe(false);
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

describe("worked squares", () => {
  /** Our new city at (10, 10), its border one square out. */
  function newCity(opts: NewGameOptions = {}) {
    const s = world(opts);
    const u = createUnit(s, "settlers", 0, 10, 10);
    applyCommand(s, { type: "found", unit: u.id });
    const city = s.cities[0]!;
    city.buildings = [];
    return { s, city };
  }
  const slotOf = (dx: number, dy: number) => CITY_RADIUS.findIndex(([x, y]) => x === dx && y === dy);

  it("lie inside the city's border: a new city works only the squares round it", () => {
    const { s, city } = newCity();
    expect(borderRadius(s, city)).toBe(1);
    expect(slotInLand(s, city, slotOf(1, 1))).toBe(true);
    expect(slotInLand(s, city, slotOf(2, 0))).toBe(false);
    expect(slotAvailable(s, city, slotOf(2, 0))).toBe(false);
    city.specialists.push("entertainer");
    city.size++;
    expect(applyCommand(s, { type: "workTile", city: city.id, slot: slotOf(2, 0) })).toEqual({ ok: false, reason: "tile unavailable" });
    // Auto-placement keeps to the land as well.
    city.size = 7;
    city.specialists = [];
    autoAssignWorkers(s, city);
    for (const w of city.worked) expect(slotInLand(s, city, w), `slot ${w}`).toBe(true);
    // Once its culture takes the border further, the outer squares open up.
    city.size = CULTURE.levels[0]!;
    expect(borderRadius(s, city)).toBe(2);
    expect(slotAvailable(s, city, slotOf(2, 0))).toBe(true);
  });

  it("stop where a rival's land begins", () => {
    const { s, city } = newCity();
    city.size = CULTURE.levels[0]!; // border two squares out
    s.currentPlayer = 1;
    applyCommand(s, { type: "found", unit: createUnit(s, "settlers", 1, 13, 10).id });
    s.currentPlayer = 0;
    // (12, 10) is two from us and one from them: theirs.
    expect(landOwner(s, 12, 10)).toBe(1);
    expect(slotInLand(s, city, slotOf(2, 0))).toBe(false);
    expect(slotInLand(s, city, slotOf(-2, 0))).toBe(true);
  });

  it("lost from the land are given up as the owner's turn begins, for the best square left", () => {
    const { s, city } = newCity();
    // It worked a square two out while its border reached there; now, at size 3, the border is one square out.
    city.size = 3;
    city.worked = [slotOf(2, 0), slotOf(1, 0), slotOf(0, 1)];
    city.specialists = [];
    expect(borderRadius(s, city)).toBe(1);
    dropLostSquares(s, city);
    expect(city.worked).not.toContain(slotOf(2, 0));
    expect(city.worked.length).toBe(3);
    for (const w of city.worked) expect(slotInLand(s, city, w)).toBe(true);
  });

  it("reach all 21 squares in saves before version 16", () => {
    const { s, city } = newCity({ workBeyondBorders: true });
    expect(slotInLand(s, city, slotOf(2, 0))).toBe(true);
    expect(slotAvailable(s, city, slotOf(2, 0))).toBe(true);
    const old = { ...makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), version: 15 as const };
    expect(loadSave(old, () => {}).state.workBeyondBorders).toBe(true);
    expect(loadSave(makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), () => {}).state.workBeyondBorders).toBeUndefined();
  });
});

describe("peace treaties", () => {
  it("are not made by meeting: maps and open borders wait for peace", () => {
    const s = neighbours();
    setRelation(s, 0, 1, "contact");
    expect(applyCommand(s, { type: "shareMaps", player: 1 })).toEqual({ ok: false, reason: "not at peace" });
    expect(applyCommand(s, { type: "openBorders", player: 1 })).toEqual({ ok: false, reason: "not at peace" });
    expect(applyCommand(s, { type: "makePeace", player: 1 }).ok).toBe(true);
    expect(relation(s, 0, 1)).toBe("peace");
    expect(applyCommand(s, { type: "shareMaps", player: 1 }).ok).toBe(true);
    expect(applyCommand(s, { type: "openBorders", player: 1 }).ok).toBe(true);
  });

  it("are not needed for a civilization to mind our units on its land", () => {
    const s = neighbours();
    setRelation(s, 0, 1, "contact");
    createUnit(s, "militia", 0, 29, 10);
    expect(trespassers(s, 1, 0).length).toBe(1);
  });

  it("are offered by a leader, remembered, and never to a civilization at peace already", () => {
    const s = neighbours();
    setRelation(s, 0, 1, "contact");
    s.currentPlayer = 1;
    expect(applyCommand(s, { type: "offerPeace", player: 0 }).ok).toBe(true);
    expect(lastTurnEvents).toContainEqual({ kind: "peaceOffer", player: 1, to: 0 });
    expect(peaceOffered(s, 1, 0)).toBe(s.turn);
    expect(applyCommand(s, { type: "offerPeace", player: s.barbarians }).ok).toBe(false);
    setRelation(s, 0, 1, "peace");
    expect(applyCommand(s, { type: "offerPeace", player: 0 })).toEqual({ ok: false, reason: "already at peace" });
  });

  it("came with every meeting in saves before version 15", () => {
    const s = world({ peaceOnContact: true });
    createUnit(s, "militia", 1, 20, 10);
    const scout = createUnit(s, "militia", 0, 18, 10);
    applyCommand(s, { type: "move", unit: scout.id, dx: 1, dy: 0 });
    expect(relation(s, 0, 1)).toBe("peace");
    const old = { ...makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), version: 14 as const };
    expect(loadSave(old, () => {}).state.peaceOnContact).toBe(true);
    expect(loadSave(makeSave(newGame(5, { opponents: 1 }), { opponents: 1 }, []), () => {}).state.peaceOnContact).toBeUndefined();
  });
});

describe("influence", () => {
  it("is the culture of all a civilization's cities", () => {
    const s = neighbours();
    const ours = s.cities.filter((c) => c.owner === 0);
    expect(civInfluence(s, 0)).toBe(ours.reduce((n, c) => n + cityCulture(s, c), 0));
    expect(civInfluence(s, 0)).toBeGreaterThan(0);
  });

  it("is admired when far greater than the judge's own, scorned when far less", () => {
    const s = neighbours();
    const ours = s.cities.find((c) => c.owner === 0)!;
    const theirs = s.cities.find((c) => c.owner === 1)!;
    expect(esteem(s, 1, 0)).toBe("respected"); // alike
    ours.buildings.push("temple", "library", "courthouse");
    ours.wonders.push("pyramids", "colossus");
    // Ours, with the floor, at least half again theirs: admired; seen the other way round, scorned.
    expect(civInfluence(s, 0) + INFLUENCE.floor).toBeGreaterThanOrEqual((civInfluence(s, 1) + INFLUENCE.floor) * INFLUENCE.admired);
    expect(esteem(s, 1, 0)).toBe("admired");
    theirs.size = 1;
    theirs.buildings = [];
    expect(esteem(s, 0, 1)).toBe("scorned");
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
