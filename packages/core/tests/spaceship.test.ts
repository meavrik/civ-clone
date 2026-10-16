import { describe, expect, it } from "vitest";
import {
  applyCommand,
  buildOptions,
  captureCity,
  checkGameEnd,
  createUnit,
  newGame,
  shipStats,
  Terrain,
  type GameState,
} from "../src/index.js";

function world(): GameState {
  const s = newGame(2, { opponents: 1 });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
    t.railroad = false; t.fortress = false; t.pollution = false;
  }
  s.units = [];
  s.cities = [];
  const u = createUnit(s, "settlers", 0, 10, 10);
  applyCommand(s, { type: "found", unit: u.id });
  return s;
}

function round(s: GameState): void {
  applyCommand(s, { type: "endTurn" });
  while (s.currentPlayer !== 0) applyCommand(s, { type: "endTurn" });
}

describe("spaceship", () => {
  it("parts appear once Apollo stands and the advances are known, and build into the ship", () => {
    const s = world();
    const c = s.cities[0]!;
    const p = s.players[0]!;
    p.advances.push("space_flight", "plastics");
    expect(buildOptions(s, c).some((o) => o.kind === "spaceship")).toBe(false);
    c.wonders.push("apollo_program");
    const parts = buildOptions(s, c).filter((o) => o.kind === "spaceship").map((o) => o.id);
    expect(parts).toEqual(["structural", "component"]);
    applyCommand(s, { type: "setProduction", city: c.id, production: { kind: "spaceship", id: "structural" } });
    c.shields = 80;
    round(s);
    expect(p.spaceship.structurals).toBe(1);
    expect(c.production).toEqual({ kind: "unit", id: "militia" });
  });

  it("needs a habitat, an engine and structurals to launch; flies and lands", () => {
    const s = world();
    const p = s.players[0]!;
    expect(applyCommand(s, { type: "launch" }).ok).toBe(false);
    Object.assign(p.spaceship, { structurals: 2, components: 1, modules: 3 });
    expect(shipStats(p.spaceship).launchable).toBe(false); // only two structurals: one habitat needs three modules carried
    Object.assign(p.spaceship, { structurals: 16, components: 4, modules: 12 });
    const st = shipStats(p.spaceship);
    expect(st.habitats).toBe(4);
    expect(st.successPct).toBe(100);
    expect(st.launchable).toBe(true);
    expect(applyCommand(s, { type: "launch" }).ok).toBe(true);
    expect(p.spaceship.launched).toBe(s.turn);
    const arrives = p.spaceship.arrives!;
    expect(arrives - s.turn).toBe(st.flightTurns);
    while (s.turn < arrives) round(s);
    expect(p.spaceship.arrived).toBe(true);
    expect(checkGameEnd(s, 9999)).toEqual({ kind: "space", winner: 0 });
  });

  it("is lost with the capital", () => {
    const s = world();
    const p = s.players[0]!;
    Object.assign(p.spaceship, { structurals: 16, components: 4, modules: 12 });
    applyCommand(s, { type: "launch" });
    const capital = s.cities[0]!;
    capital.size = 3;
    s.relations["0:1"] = "war";
    const raider = createUnit(s, "legion", 1, 11, 10);
    const cap = captureCity(s, raider, capital);
    expect(cap.shipLost).toBe(true);
    expect(p.spaceship.launched).toBeNull();
    expect(p.spaceship.modules).toBe(0);
  });
});
