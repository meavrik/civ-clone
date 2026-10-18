import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, foundCity, getTile, labelContinents, lastTurnEvents, newGame, relation, setBordersOpen, setRelation, Terrain, trespassRecord, type GameState } from "@civ/core";
import { acceptsMapSwap, attitude, bordersAnswer, describePlan, plannerTurn, tributeOffer } from "../src/index.js";

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
  function trespassed(): { s: GameState; unit: number } {
    const s = newGame(6, { opponents: 1 });
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
    s.tributePaid = { "1>0": s.turn };
    expect(tributeOffer(s, 1, 0)).toBe(0);
    s.trespass = { "1>0": { turn: s.turn, warnings: 2 } };
    expect(attitude(s, 1, 0)).toBe("hostile");
    expect(bordersAnswer(s, 1, 0)).toBe("no");
  });
});
