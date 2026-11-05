import { describe, expect, it } from "vitest";
import {
  advanceWorth,
  applyCommand,
  foundCity,
  goodwill,
  hasResource,
  lastTurnEvents,
  loadSave,
  makeSave,
  newGame,
  researchCostFor,
  resourceWorth,
  setRelation,
  startTurn,
  Terrain,
  tradeIncome,
  type Command,
  type GameState,
  type NewGameOptions,
} from "../src/index.js";

/** Two civs met at peace on a flat grassland world: ours with Iron by Rome, theirs with Horses by Babylon. */
function world(opts: NewGameOptions = {}): GameState {
  const s = newGame(1, { opponents: 1, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    delete t.deposit;
  }
  s.units = []; s.cities = [];
  for (const p of s.players) p.advances = ["bronze_working", "iron_working", "horseback_riding", "animal_husbandry", "the_wheel", "currency"];
  s.players[0]!.advances.push("alphabet");
  s.players[1]!.advances.push("pottery");
  setRelation(s, 0, 1, "peace");
  foundCity(s, 0, 10, 10, "Rome");
  foundCity(s, 1, 30, 10, "Babylon");
  const lay = (x: number, y: number, id: string) => Object.assign(s.map.tiles[y * s.map.width + x]!, { special: true, deposit: id, road: true });
  lay(11, 10, "Iron");
  lay(31, 10, "Horses");
  s.players[0]!.gold = 200;
  s.players[1]!.gold = 150;
  s.currentPlayer = 0;
  return s;
}

describe("an exchange between two civilizations", () => {
  it("hands gold, advances and resources both ways at once", () => {
    const s = world();
    const ok = applyCommand(s, { type: "exchange", player: 1, give: { gold: 50, advances: ["alphabet"], resources: ["Iron"] }, take: { gold: 20, advances: ["pottery"], resources: ["Horses"] } });
    expect(ok).toEqual({ ok: true });
    expect([s.players[0]!.gold, s.players[1]!.gold]).toEqual([170, 180]);
    expect(s.players[0]!.advances).toContain("pottery");
    expect(lastTurnEvents.find((e) => e.kind === "discovered")).toMatchObject({ advance: "pottery" });
    expect(s.players[1]!.advances).toContain("alphabet");
    expect(hasResource(s, 1, "Iron")).toBe(true);
    expect(hasResource(s, 0, "Horses")).toBe(true);
  });

  it("refuses what a side has not got, what the other has, an empty table, and war", () => {
    const s = world();
    const ex = (give: object, take: object) => applyCommand(s, { type: "exchange", player: 1, give, take });
    expect(ex({}, {})).toEqual({ ok: false, reason: "nothing to trade" });
    expect(ex({ gold: 500 }, {})).toEqual({ ok: false, reason: "not enough gold" });
    expect(ex({}, { gold: 500 })).toEqual({ ok: false, reason: "not enough gold" });
    expect(ex({ advances: ["pottery"] }, {})).toEqual({ ok: false, reason: "no pottery to give" });
    expect(ex({ advances: ["bronze_working"] }, {})).toEqual({ ok: false, reason: "they know bronze_working" });
    expect(ex({ resources: ["Horses"] }, {}).ok).toBe(false);
    expect(ex({ perTurn: 3 }, {})).toEqual({ ok: false, reason: "nothing to pay for" });
    expect(ex({ gold: 10.5 }, {})).toEqual({ ok: false, reason: "bad amount" });
    setRelation(s, 0, 1, "war");
    expect(ex({ gold: 10 }, {})).toEqual({ ok: false, reason: "at war" });
  });

  it("pays for a resource each turn while the trade stands, and ends it a turn the payer cannot pay", () => {
    const s = world();
    expect(applyCommand(s, { type: "exchange", player: 1, give: { resources: ["Iron"] }, take: { perTurn: 5 } }).ok).toBe(true);
    expect(s.resourceTrades).toEqual([expect.objectContaining({ a: 0, b: 1, give: "Iron", pay: 5 })]);
    expect(tradeIncome(s, 0)).toBe(5);
    expect(tradeIncome(s, 1)).toBe(-5);
    // They pay as their turn begins.
    lastTurnEvents.length = 0;
    startTurn(s, 1);
    expect([s.players[0]!.gold, s.players[1]!.gold]).toEqual([205, 145]);
    // Short of gold, the trade ends.
    s.players[1]!.gold = 3;
    startTurn(s, 1);
    expect(s.players[1]!.gold).toBe(3);
    expect(s.resourceTrades ?? []).toEqual([]);
    expect(lastTurnEvents.find((e) => e.kind === "tradeEnded")).toMatchObject({ give: "Iron", by: 1, why: "unpaid" });
  });

  it("shares gold a turn among the resources it pays for", () => {
    const s = world();
    Object.assign(s.map.tiles[9 * s.map.width + 10]!, { special: true, deposit: "Coal", road: true });
    // Hidden until Steam Engine, it is not ours to give before.
    expect(applyCommand(s, { type: "exchange", player: 1, give: { resources: ["Iron", "Coal"] }, take: { perTurn: 5 } }).ok).toBe(false);
    s.players[0]!.advances.push("steam_engine");
    expect(applyCommand(s, { type: "exchange", player: 1, give: { resources: ["Iron", "Coal"] }, take: { perTurn: 5 } }).ok).toBe(true);
    expect((s.resourceTrades ?? []).map((t) => t.pay)).toEqual([3, 2]);
  });

  it("replays from the log", () => {
    const opts: NewGameOptions = { opponents: 1 };
    const s = newGame(4, opts);
    const log: Command[] = [{ type: "cheat", cheat: "contact" }, { type: "cheat", cheat: "gold" }, { type: "exchange", player: 1, give: { gold: 20 }, take: {} }, { type: "endTurn" }];
    for (const c of log) expect(applyCommand(s, c).ok).toBe(true);
    const again = loadSave(makeSave(s, opts, log), () => {}).state;
    expect(again.players.map((p) => p.gold)).toEqual(s.players.map((p) => p.gold));
  });
});

describe("gifts other than gold", () => {
  it("sway a leader at what they are worth to it, since save version 51", () => {
    const s = world();
    const worth = advanceWorth(s, 1);
    expect(worth).toBe(researchCostFor(s, 1));
    expect(applyCommand(s, { type: "giveAdvance", player: 1, advance: "alphabet" }).ok).toBe(true);
    expect(s.gifts?.["0>1"]).toEqual([expect.objectContaining({ gold: worth })]);
    const iron = resourceWorth(s, 1);
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" }).ok).toBe(true);
    expect(s.gifts?.["0>1"]?.[1]).toMatchObject({ gold: iron });
    expect(goodwill(s, 0, 1)).toBe(true);
  });

  it("count for nothing in saves before it (plain gifts)", () => {
    const s = world({ plainGifts: true });
    applyCommand(s, { type: "giveAdvance", player: 1, advance: "alphabet" });
    applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" });
    expect(s.gifts).toBeUndefined();
    expect(goodwill(s, 0, 1)).toBe(false);
  });
});
