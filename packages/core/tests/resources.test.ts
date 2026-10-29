import { describe, expect, it } from "vitest";
import {
  advance,
  ADVANCES,
  applyCommand,
  CLASSIC_ADVANCES,
  buildOptions,
  canExport,
  createUnit,
  foundCity,
  getTile,
  hasResource,
  heldResources,
  lastTurnEvents,
  loadSave,
  makeSave,
  missingResources,
  newGame,
  processCityTurn,
  resourceAt,
  resourceHoldings,
  resourceKnown,
  RESOURCES,
  resourceSquares,
  revealedBy,
  seesResource,
  setRelation,
  siteScore,
  specialFor,
  specialOf,
  startTurn,
  Terrain,
  tileYield,
  unitChoices,
  UNIT_TYPES,
  type GameState,
} from "../src/index.js";

/** Two civs met at peace on a flat grassland world with no specials. */
function world(): GameState {
  const s = newGame(1, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    delete t.deposit;
  }
  s.units = []; s.cities = [];
  for (const p of s.players) p.advances = ["bronze_working", "iron_working", "horseback_riding", "animal_husbandry", "the_wheel"];
  setRelation(s, 0, 1, "peace");
  return s;
}

/** Lay a deposit of `id` at (x, y), with a road on it unless `road` is false (a square serves only with one). */
function deposit(s: GameState, x: number, y: number, id: string, road = true): void {
  const t = s.map.tiles[y * s.map.width + x]!;
  t.special = true;
  t.deposit = id;
  t.road = road;
}

const ids = (s: GameState, c: Parameters<typeof buildOptions>[1]) => buildOptions(s, c).map((p) => p.id);

describe("strategic resources", () => {
  it("lie in deposits on new worlds only, each the special of its kind, and old saves need none", () => {
    const s = newGame(7);
    const deposits = s.map.tiles.filter((t) => t.deposit);
    expect(deposits.length).toBeGreaterThan(50);
    for (const t of deposits) {
      expect(t.special).toBe(true);
      expect(specialOf(t)?.name).toBe(t.deposit);
      expect(RESOURCES.find((r) => r.id === t.deposit)!.deposits[t.terrain]).toBeGreaterThan(0);
    }
    // Every kind turns up.
    for (const r of RESOURCES) expect(deposits.some((t) => t.deposit === r.id), r.id).toBe(true);
    // The same seed draws the same world otherwise: only squares without a special took a deposit.
    const old = loadSave({ ...makeSave(newGame(7), {}, []), version: 32 as const }, () => {}).state;
    expect(old.noResources).toBe(true);
    expect(old.map.tiles.some((t) => t.deposit)).toBe(false);
    expect(old.map.tiles.map((t) => t.terrain)).toEqual(s.map.tiles.map((t) => t.terrain));
    expect(old.map.tiles.filter((t) => t.special).length + deposits.length).toBe(s.map.tiles.filter((t) => t.special).length);
    expect(loadSave(makeSave(newGame(7), {}, []), () => {}).state.noResources).toBeUndefined();
  });

  it("builds a unit only while its civilization holds what it needs, inside its border", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    expect(ids(s, rome)).toContain("phalanx");
    expect(ids(s, rome)).not.toContain("legion");
    expect(missingResources(s, 0, "legion")).toEqual(["Iron"]);
    expect(missingResources(s, 0, "knights")).toEqual(["Horses", "Iron"]);
    expect(unitChoices(s, rome).find((u) => u.id === "chariot")!.missing).toEqual(["Horses"]);
    expect(applyCommand(s, { type: "setProduction", city: rome.id, production: { kind: "unit", id: "legion" } }).ok).toBe(false);
    // Iron beyond the border counts for nothing; inside it (a square out from a new city), it does.
    deposit(s, 13, 10, "Iron");
    expect(hasResource(s, 0, "Iron")).toBe(false);
    deposit(s, 11, 11, "Iron");
    expect(hasResource(s, 0, "Iron")).toBe(true);
    expect(ids(s, rome)).toContain("legion");
    expect(resourceHoldings(s, 0).find((h) => h.id === "Iron")).toEqual({ id: "Iron", own: 1, exported: 0, imported: 0, has: true, unroaded: 0 });
    // A rival's city nearer the square takes it, and the iron with it.
    foundCity(s, 1, 12, 11);
    expect(hasResource(s, 0, "Iron")).toBe(false);
    expect(hasResource(s, 1, "Iron")).toBe(true);
    s.cities.pop();
    // Saves before version 33 need nothing.
    s.noResources = true;
    s.map.tiles[11 * s.map.width + 11]!.special = false;
    expect(ids(s, rome)).toContain("chariot");
    expect(heldResources(s, 0).size).toBe(RESOURCES.length);
  });

  it("serves only with a road on its square, a city's own square having one; old saves need none", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    deposit(s, 11, 11, "Iron", false);
    expect(hasResource(s, 0, "Iron")).toBe(false);
    expect(ids(s, rome)).not.toContain("legion");
    expect(resourceHoldings(s, 0).find((h) => h.id === "Iron")).toEqual({ id: "Iron", own: 0, exported: 0, imported: 0, has: false, unroaded: 1 });
    expect(resourceSquares(s, 0).get("Iron")).toBeUndefined();
    expect(resourceSquares(s, 0, true).get("Iron")).toEqual([{ x: 11, y: 11 }]);
    // None to trade away either.
    expect(canExport(s, 0, "Iron")).toBe(false);
    // Settlers build the road: the iron serves.
    const u = createUnit(s, "settlers", 0, 11, 11);
    expect(applyCommand(s, { type: "work", unit: u.id, work: "road" }).ok).toBe(true);
    s.currentPlayer = 0;
    for (let i = 0; i < 4 && !getTile(s.map, 11, 11)!.road; i++) { applyCommand(s, { type: "endTurn" }); s.currentPlayer = 0; }
    expect(getTile(s.map, 11, 11)!.road).toBe(true);
    expect(hasResource(s, 0, "Iron")).toBe(true);
    expect(ids(s, rome)).toContain("legion");
    // A city on the square brings its road.
    const t = getTile(s.map, 11, 11)!;
    t.road = false;
    deposit(s, 20, 10, "Horses", false);
    expect(hasResource(s, 0, "Horses")).toBe(false);
    foundCity(s, 0, 20, 10);
    expect(hasResource(s, 0, "Horses")).toBe(true);
    // Saves before version 43: every square on the land serves.
    s.roadlessResources = true;
    expect(hasResource(s, 0, "Iron")).toBe(true);
  });

  it("holds a unit whose resource is gone, its shields kept, telling the city once", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    deposit(s, 11, 11, "Iron");
    rome.production = { kind: "unit", id: "legion" };
    s.map.tiles[11 * s.map.width + 11]!.special = false; // the iron is lost
    rome.shields = 30;
    rome.turnShields = 15;
    lastTurnEvents.length = 0;
    const events = processCityTurn(s, rome);
    expect(s.units.some((u) => u.type === "legion")).toBe(false);
    expect(rome.shields).toBeGreaterThanOrEqual(30);
    expect(events.find((e) => e.kind === "lacks")).toMatchObject({ detail: "Legion", missing: ["Iron"] });
    // The next turn, the box already full, says nothing more.
    expect(processCityTurn(s, rome).some((e) => e.kind === "lacks")).toBe(false);
    // Bought? Not without iron.
    rome.shields = 5;
    s.players[0]!.gold = 500;
    expect(applyCommand(s, { type: "buy", city: rome.id })).toEqual({ ok: false, reason: "needs:Iron" });
    // The iron back: built.
    s.map.tiles[11 * s.map.width + 11]!.special = true;
    rome.shields = 30;
    processCityTurn(s, rome);
    expect(s.units.some((u) => u.type === "legion")).toBe(true);
  });

  it("trades resources between civilizations at peace: swaps, gifts, and their end", () => {
    const s = world();
    const rome = foundCity(s, 0, 10, 10);
    const babylon = foundCity(s, 1, 30, 10);
    deposit(s, 11, 11, "Iron");
    deposit(s, 31, 11, "Horses");
    // Rome gives its iron for Babylon's horses.
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron", receive: "Horses" }).ok).toBe(true);
    expect(hasResource(s, 0, "Horses")).toBe(true);
    expect(hasResource(s, 1, "Iron")).toBe(true);
    // Its only iron went with it.
    expect(hasResource(s, 0, "Iron")).toBe(false);
    expect(ids(s, rome)).toContain("cavalry");
    expect(ids(s, rome)).not.toContain("legion");
    expect(ids(s, babylon)).toContain("legion");
    // Nothing given twice, nothing they have already, nothing traded to us passed on.
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" }).ok).toBe(false);
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Horses" }).ok).toBe(false);
    // A second iron: a gift of it is refused, they have iron already.
    deposit(s, 9, 9, "Iron");
    expect(hasResource(s, 0, "Iron")).toBe(true);
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" })).toEqual({ ok: false, reason: "they have Iron" });
    // Rome loses its second iron... still fine; then the first (traded) one: the trade ends as Rome's turn begins.
    s.map.tiles[9 * s.map.width + 9]!.special = false;
    s.map.tiles[11 * s.map.width + 11]!.special = false;
    lastTurnEvents.length = 0;
    startTurn(s, 0);
    expect(s.resourceTrades).toEqual([]);
    expect(lastTurnEvents.find((e) => e.kind === "tradeEnded")).toMatchObject({ give: "Iron", take: "Horses", by: 0, why: "lost" });
    expect(hasResource(s, 0, "Horses")).toBe(false);
    // A war ends trades at once.
    s.map.tiles[11 * s.map.width + 11]!.special = true;
    expect(applyCommand(s, { type: "tradeResources", player: 1, receive: "Horses" }).ok).toBe(true); // bought (gold apart)
    expect(s.resourceTrades).toMatchObject([{ a: 1, b: 0, give: "Horses" }]);
    lastTurnEvents.length = 0;
    applyCommand(s, { type: "declareWar", player: 1 });
    expect(s.resourceTrades).toEqual([]);
    expect(lastTurnEvents.some((e) => e.kind === "tradeEnded" && e.why === "war")).toBe(true);
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" }).ok).toBe(false);
  });

  it("lets either side call a trade off", () => {
    const s = world();
    foundCity(s, 0, 10, 10);
    foundCity(s, 1, 30, 10);
    deposit(s, 11, 11, "Iron");
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" }).ok).toBe(true);
    s.currentPlayer = 1;
    expect(applyCommand(s, { type: "endTrade", player: 0 }).ok).toBe(true);
    expect(hasResource(s, 1, "Iron")).toBe(false);
    expect(applyCommand(s, { type: "endTrade", player: 0 }).ok).toBe(false);
  });

  it("hides Iron, Saltpeter and Oil from a civilization until it knows the advance that reveals each", () => {
    const s = world();
    s.players[0]!.advances = ["horseback_riding", "animal_husbandry", "the_wheel"];
    foundCity(s, 0, 10, 10);
    deposit(s, 11, 11, "Iron");
    deposit(s, 9, 9, "Horses");
    const t = s.map.tiles[11 * s.map.width + 11]!;
    const plain = { ...t, special: false };
    // Unrevealed, a square of it is plain terrain to that civilization: not drawn, yielding nothing of it, not held.
    expect(resourceKnown(s, 0, "Iron")).toBe(false);
    expect(specialFor(s, t, 0)).toBeUndefined();
    expect(tileYield(s, t, false, "monarchy", 0)).toEqual(tileYield(s, plain, false, "monarchy", 0));
    expect(hasResource(s, 0, "Iron")).toBe(false);
    expect(resourceAt(s, 11, 11, 0)).toBeNull();
    // To nobody in particular, and to a civilization that knows Bronze Working, it is there.
    expect(specialFor(s, t)?.name).toBe("Iron");
    expect(resourceAt(s, 11, 11)).toBe("Iron");
    expect(specialFor(s, t, 1)?.name).toBe("Iron");
    // Horses and Coal, the 1991 game's own specials, are seen from the start.
    expect(resourceKnown(s, 0, "Horses")).toBe(true);
    expect(resourceKnown(s, 0, "Coal")).toBe(true);
    expect(hasResource(s, 0, "Horses")).toBe(true);
    // A site's worth counts what its civilization knows.
    expect(siteScore(s, 12, 12, undefined, 0)).toBeLessThan(siteScore(s, 12, 12, undefined, 1)!);
    // Bronze Working reveals it.
    s.players[0]!.advances.push("bronze_working");
    expect(specialFor(s, t, 0)?.name).toBe("Iron");
    expect(tileYield(s, t, false, "monarchy", 0).shields).toBe(tileYield(s, plain, false, "monarchy", 0).shields + 3);
    expect(hasResource(s, 0, "Iron")).toBe(true);
    expect(siteScore(s, 12, 12, undefined, 0)).toBe(siteScore(s, 12, 12, undefined, 1));
    // Each revealing advance is in both trees, and every unit that needs a resource reveals it too: Chivalry's
    // Knights want Iron, and Chivalry needs no Bronze Working.
    expect(RESOURCES.filter((r) => r.revealedBy).map((r) => r.id)).toEqual(["Iron", "Saltpeter", "Oil"]);
    for (const r of RESOURCES) {
      if (r.revealedBy) for (const tree of [ADVANCES, CLASSIC_ADVANCES]) expect(tree.some((a) => a.id === r.revealedBy), r.revealedBy).toBe(true);
      for (const u of UNIT_TYPES.filter((x) => x.needs?.includes(r.id) && x.requires)) expect(seesResource([u.requires!], r.id), `${u.id} sees ${r.id}`).toBe(true);
    }
    expect(seesResource(["chivalry"], "Iron")).toBe(true);
    expect(advance("chivalry").requires).not.toContain("bronze_working");
    // What an advance reveals: what its civilization sees with it and would not without it.
    s.players[0]!.advances = ["horseback_riding"];
    expect(revealedBy(s, 0, ["bronze_working"])).toEqual(["Iron"]); // not yet known: what it would show
    s.players[0]!.advances.push("bronze_working");
    expect(revealedBy(s, 0, ["bronze_working"])).toEqual(["Iron"]); // just found: what it showed
    s.players[0]!.advances.push("chivalry");
    expect(revealedBy(s, 0, ["chivalry"])).toEqual([]); // Iron was seen already
    expect(revealedBy(s, 0, ["gunpowder"])).toEqual(["Saltpeter"]);
    // Saves before version 40 see them all.
    s.players[0]!.advances = [];
    s.visibleResources = true;
    expect(specialFor(s, t, 0)?.name).toBe("Iron");
    const old = loadSave({ ...makeSave(newGame(7), {}, []), version: 39 as const }, () => {}).state;
    expect(old.visibleResources).toBe(true);
    expect(loadSave(makeSave(newGame(7), {}, []), () => {}).state.visibleResources).toBeUndefined();
  });

  it("names only resources that exist, and barbarians build from nothing", () => {
    const names = new Set(RESOURCES.map((r) => r.id));
    for (const t of UNIT_TYPES) for (const n of t.needs ?? []) expect(names.has(n), `${t.id} needs ${n}`).toBe(true);
    const s = world();
    expect(missingResources(s, s.barbarians, "knights")).toEqual([]);
    const u = createUnit(s, "legion", 0, 5, 5);
    expect(u.type).toBe("legion"); // units already raised stay
  });
});
