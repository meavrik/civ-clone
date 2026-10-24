import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, esteem, foundCity, getTile, labelContinents, lastTurnEvents, newGame, peaceOffered, relation, setBordersOpen, setRelation, Terrain, trespassRecord, type GameState, type NewGameOptions } from "@civ/core";
import { acceptsMapSwap, attitude, bordersAnswer, describePlan, peaceAnswer, plannerTurn, tributeOffer, withdrawAnswer } from "../src/index.js";

/** Player 0 plays (AI); everyone else just ends the turn. */
function round(state: GameState): void {
  plannerTurn(state);
  applyCommand(state, { type: "endTurn" });
  let guard = 0;
  while (state.currentPlayer !== 0 && guard++ < 10) applyCommand(state, { type: "endTurn" });
}

/** An empty sea with a small home island (one city, no room) and a bigger island three squares away. */
function islands(): GameState {
  const s = newGame(5, { opponents: 1, allAi: true });
  for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Ocean, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
  const land = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) getTile(s.map, x, y)!.terrain = Terrain.Grassland;
  };
  land(12, 15, 19, 24);
  land(19, 27, 16, 27);
  labelContinents(s.map);
  s.units = [];
  s.cities = [];
  const p = s.players[0]!;
  p.advances.push("bronze_working", "map_making");
  p.explored.fill(1);
  foundCity(s, 0, 15, 21);
  createUnit(s, "settlers", 0, 15, 21);
  createUnit(s, "trireme", 0, 15, 21);
  s.currentPlayer = 0;
  return s;
}

describe("planner AI v3", () => {
  it("ferries a settler from a full island to free land across the strait and founds a colony", () => {
    const s = islands();
    const plan = describePlan(s, 0);
    expect(plan.sites).toBe(0);
    expect(plan.overseasSites).toBeGreaterThan(0);
    expect(plan.wantOverseas).toBe(true);
    const across = getTile(s.map, 20, 20)!.continent;
    for (let r = 0; r < 30 && !s.cities.some((c) => c.owner === 0 && getTile(s.map, c.x, c.y)!.continent === across); r++) round(s);
    const colony = s.cities.find((c) => c.owner === 0 && getTile(s.map, c.x, c.y)!.continent === across);
    expect(colony, "a city on the far island").toBeDefined();
  });

  it("swaps advances with another computer civilization it is at peace with", () => {
    const s = newGame(7, { opponents: 2, allAi: true });
    const [a, b] = [s.players[0]!, s.players[1]!];
    a.advances = ["alphabet"];
    b.advances = ["bronze_working"];
    setRelation(s, 0, 1, "peace");
    setRelation(s, 0, 2, "war");
    s.turn = 2; // the pair (0, 1) deals on turns where turn + 0 + 1 is a multiple of three
    s.currentPlayer = 0;
    plannerTurn(s);
    expect(a.advances).toContain("bronze_working");
    expect(b.advances).toContain("alphabet");
  });

  it("storms a lightly held enemy city its soldiers stand next to, and walks in", () => {
    const s = newGame(9, { opponents: 1, allAi: true });
    for (let y = 15; y <= 25; y++) for (let x = 15; x <= 25; x++) Object.assign(getTile(s.map, x, y)!, { terrain: Terrain.Grassland, river: false, hut: false });
    labelContinents(s.map);
    s.units = s.units.filter((u) => Math.abs(u.x - 20) > 6 || Math.abs(u.y - 20) > 6);
    s.cities = [];
    const target = foundCity(s, 1, 20, 20);
    target.size = 3;
    createUnit(s, "militia", 1, 20, 20);
    foundCity(s, 0, 15, 20);
    createUnit(s, "phalanx", 0, 15, 20);
    for (const [x, y] of [[19, 20], [19, 21], [21, 20]] as const) createUnit(s, "legion", 0, x, y);
    setRelation(s, 0, 1, "war");
    s.currentPlayer = 0;
    plannerTurn(s);
    expect(target.owner).toBe(0);
  });
});

describe("planner AI v3 borders", () => {
  /** Computer civ 1 has a city at (30, 10) and two phalanxes; our militia stands on its land, at peace. */
  function trespassed(opts: NewGameOptions = {}): { s: GameState; unit: number } {
    const s = newGame(6, { opponents: 1, ...opts });
    for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
    labelContinents(s.map);
    s.units = [];
    s.cities = [];
    foundCity(s, 0, 10, 10);
    foundCity(s, 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    const u = createUnit(s, "militia", 0, 29, 11);
    u.order = { kind: "fortified" };
    setRelation(s, 0, 1, "peace");
    s.currentPlayer = 1;
    return { s, unit: u.id };
  }

  it("asks a human civilization off its land, warns once more, then goes to war", () => {
    const { s } = trespassed();
    plannerTurn(s);
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(1);
    expect(lastTurnEvents).toContainEqual({ kind: "leaveDemand", player: 1, to: 0, warnings: 1 });
    plannerTurn(s); // the same turn: no second word
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(1);
    s.turn++;
    plannerTurn(s);
    expect(trespassRecord(s, 1, 0)?.warnings).toBe(2);
    expect(relation(s, 0, 1)).toBe("peace");
    s.turn++;
    plannerTurn(s);
    expect(relation(s, 0, 1)).toBe("war");
    expect(lastTurnEvents).toContainEqual({ kind: "warDeclared", player: 1, on: 0, reason: "trespass" });
  });

  it("only complains when far the weaker, and says nothing once borders are open", () => {
    const { s } = trespassed();
    s.units = s.units.filter((u) => u.owner !== 1);
    for (let i = 0; i < 4; i++) createUnit(s, "legion", 0, 10, 10);
    for (let t = 0; t < 4; t++, s.turn++) plannerTurn(s);
    expect(relation(s, 0, 1)).toBe("peace");
    setBordersOpen(s, 0, 1, true);
    lastTurnEvents.length = 0;
    s.turn += 10;
    plannerTurn(s);
    expect(lastTurnEvents.some((e) => e.kind === "leaveDemand")).toBe(false);
  });

  it("answers the player's proposals by how it regards them", () => {
    const { s } = trespassed();
    expect(attitude(s, 1, 0)).toBe("wary"); // four phalanx points against our militia's two: proud
    expect(bordersAnswer(s, 1, 0)).toBe("for gold");
    expect(acceptsMapSwap(s, 1, 0)).toBe(true);
    expect(tributeOffer(s, 1, 0)).toBe(0); // the stronger never pays
    s.units = s.units.filter((u) => u.owner !== 1);
    for (let i = 0; i < 3; i++) createUnit(s, "legion", 0, 10, 10);
    s.players[1]!.gold = 120;
    expect(attitude(s, 1, 0)).toBe("friendly");
    expect(tributeOffer(s, 1, 0)).toBe(30);
    // A friendly leader takes its units off our land when asked; a hostile one never; a wary one yields to strength.
    expect(withdrawAnswer(s, 1, 0)).toBe(true);
    s.units = s.units.filter((u) => u.owner !== 0);
    for (let i = 0; i < 4; i++) createUnit(s, "phalanx", 1, 20, 10);
    expect(attitude(s, 1, 0)).toBe("wary");
    expect(withdrawAnswer(s, 1, 0)).toBe(false); // the stronger stays
    s.tributePaid = { "1>0": s.turn };
    expect(tributeOffer(s, 1, 0)).toBe(0);
    s.trespass = { "1>0": { turn: s.turn, warnings: 2 } };
    expect(attitude(s, 1, 0)).toBe("hostile");
    expect(bordersAnswer(s, 1, 0)).toBe("no");
  });
});

describe("planner AI v3 treaties and influence", () => {
  /** Computer civ 1 (a city at (30, 10), two phalanxes) and our city at (`ourX`, 10) with a militia at home, met without a treaty. */
  function met(opts: NewGameOptions = {}, ourX = 10): GameState {
    const s = newGame(6, { opponents: 1, ...opts });
    for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Grassland, river: false, special: false, hut: false, road: false, irrigation: false, mine: false });
    labelContinents(s.map);
    s.units = [];
    s.cities = [];
    foundCity(s, 0, ourX, 10);
    foundCity(s, 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    createUnit(s, "phalanx", 1, 30, 10);
    createUnit(s, "militia", 0, ourX, 10).order = { kind: "fortified" };
    setRelation(s, 0, 1, "contact");
    s.currentPlayer = 1;
    return s;
  }

  /** Temples, libraries and wonders in the city of `owner`: far more influence than a lone city's. */
  function renowned(s: GameState, owner: number): void {
    const c = s.cities.find((x) => x.owner === owner)!;
    c.buildings.push("temple", "library", "courthouse");
    c.wonders.push("pyramids", "colossus");
  }

  it("weighs our influence: admiration outweighs its pride, scorn adds to it", () => {
    const s = met();
    expect(attitude(s, 1, 0)).toBe("wary"); // proud: four phalanx points against our militia's two
    expect(peaceAnswer(s, 1, 0)).toBe("for gold");
    renowned(s, 0);
    expect(esteem(s, 1, 0)).toBe("admired");
    expect(attitude(s, 1, 0)).toBe("friendly");
    expect(peaceAnswer(s, 1, 0)).toBe("yes");
    expect(bordersAnswer(s, 1, 0)).toBe("yes");
    s.cities.find((c) => c.owner === 0)!.buildings = [];
    s.cities.find((c) => c.owner === 0)!.wonders = [];
    renowned(s, 1);
    expect(esteem(s, 1, 0)).toBe("scorned");
    expect(attitude(s, 1, 0)).toBe("hostile"); // proud and scornful
    expect(peaceAnswer(s, 1, 0)).toBe("no");
    expect(acceptsMapSwap(s, 1, 0)).toBe(false);
  });

  it("sends a player it thinks well of an offer of peace now and then, and leaves the answer to them", () => {
    const s = met();
    renowned(s, 0);
    let offered: number | undefined;
    for (let t = 0; t < 80 && offered === undefined; t++, s.turn++) {
      plannerTurn(s);
      offered = peaceOffered(s, 1, 0);
    }
    expect(offered).toBeDefined();
    expect(lastTurnEvents).toContainEqual({ kind: "peaceOffer", player: 1, to: 0 });
    expect(relation(s, 0, 1)).toBe("contact");
    for (let t = 0; t < 15; t++, s.turn++) plannerTurn(s);
    expect(peaceOffered(s, 1, 0)).toBe(offered); // not again so soon
  });

  it("sends one envoy a turn to a player, whoever sends it", () => {
    const s = met();
    renowned(s, 0);
    s.peaceOffers = { [`2>0`]: s.turn }; // another civilization's envoy came this turn
    for (let t = 0; t < 40; t++) plannerTurn(s);
    expect(peaceOffered(s, 1, 0)).toBeUndefined();
  });

  it("does not court a player it is wary of", () => {
    const s = met();
    for (let t = 0; t < 30; t++, s.turn++) plannerTurn(s);
    expect(peaceOffered(s, 1, 0)).toBeUndefined();
  });

  it("offers peace to end a war it is losing, where saves before version 15 made it at once", () => {
    for (const old of [false, true]) {
      const s = met(old ? { peaceOnContact: true } : {});
      setRelation(s, 0, 1, "war");
      s.units = s.units.filter((u) => u.owner !== 1);
      for (let i = 0; i < 4; i++) createUnit(s, "legion", 0, 10, 10);
      for (let t = 0; t < 40 && relation(s, 0, 1) === "war" && peaceOffered(s, 1, 0) === undefined; t++, s.turn++) plannerTurn(s);
      if (old) expect(relation(s, 0, 1)).toBe("peace");
      else {
        expect(peaceOffered(s, 1, 0)).toBeDefined();
        expect(relation(s, 0, 1)).toBe("war");
      }
    }
  });

  it("spares a far weaker player whose influence it admires from a war of choice", () => {
    const declared = (admired: boolean): boolean => {
      const s = met({}, 22); // within reach of their legions
      s.turn = 100;
      foundCity(s, 1, 30, 20);
      foundCity(s, 1, 40, 10);
      for (let i = 0; i < 8; i++) createUnit(s, "legion", 1, 30, 10);
      if (admired) renowned(s, 0);
      for (let t = 0; t < 60 && relation(s, 0, 1) !== "war"; t++, s.turn++) plannerTurn(s);
      return relation(s, 0, 1) === "war";
    };
    expect(declared(false)).toBe(true);
    expect(declared(true)).toBe(false);
  });
});
