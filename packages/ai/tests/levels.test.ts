import { describe, expect, it } from "vitest";
import { applyCommand, clearTrespass, createRng, createUnit, foundCity, labelContinents, newGame, relation, setRelation, Terrain, type GameState, type NewGameOptions } from "@civ/core";
import { acceptsPeace, attitude, courtPlayers, plannerTurn } from "../src/index.js";

/**
 * Computer civ 1 (cities at (30, 10), (30, 20) and (40, 10), two phalanxes) and the player's city at
 * (`ourX`, 10) with a militia at home, met without a treaty, on open grassland, at `difficulty`.
 */
function met(difficulty: number, opts: NewGameOptions = {}, ourX = 22): GameState {
  const s = newGame(6, { opponents: 1, difficulty, ...opts });
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

/** Does computer civ 1, with `legions` legions besides, go to war on the player within `turns` of its turns from `from`? */
function declares(difficulty: number, legions: number, guards: number, from = 100, turns = 60, opts: NewGameOptions = {}, barbarians = false): boolean {
  const s = met(difficulty, opts);
  s.turn = from;
  foundCity(s, 1, 30, 20);
  foundCity(s, 1, 40, 10);
  // A barbarian-held city on its land: a war it means to win back.
  if (barbarians) foundCity(s, s.barbarians, 50, 30);
  for (let i = 0; i < legions; i++) createUnit(s, "legion", 1, 30, 10);
  // The player's strength away from the city its legions could take: phalanxes far off.
  for (let i = 0; i < guards; i++) createUnit(s, "phalanx", 0, 5, 40).order = { kind: "fortified" };
  for (let t = 0; t < turns && relation(s, 0, 1) !== "war"; t++, s.turn++) plannerTurn(s);
  return relation(s, 0, 1) === "war";
}

describe("computer leaders by the player's difficulty level", () => {
  it("starts wars of choice on the player at lower odds as the level grows, and never at Chieftain", () => {
    // 8 legions and 2 phalanxes (38) against a militia (2): every level but Chieftain's goes to war.
    expect(declares(0, 8, 0)).toBe(false);
    for (const level of [1, 2, 3, 4]) expect(declares(level, 8, 0), `level ${level}`).toBe(true);
    // Against 38 the player holds 2 + 3 x 7 = 23: 1.65 times. King (1.5) goes to war, Prince (2) and Warlord (3) do not.
    expect(declares(2, 8, 7)).toBe(false);
    expect(declares(3, 8, 7)).toBe(true);
    // 2 + 3 x 9 = 29: 1.31 times, and the leader is no prouder than the player, so friendly: the King spares a
    // friend, the Emperor (1.25, sparing nobody) does not.
    expect(declares(3, 8, 9)).toBe(false);
    expect(declares(4, 8, 9)).toBe(true);
  });

  it("goes to war on the player while it fights the barbarians only at King and Emperor", () => {
    expect(declares(2, 8, 0, 100, 60, {}, true)).toBe(false);
    expect(declares(3, 8, 0, 100, 60, {}, true)).toBe(true);
    expect(declares(4, 8, 0, 100, 60, {}, true)).toBe(true);
  });

  it("goes to war earlier at the harder levels: the Emperor's from turn 40, Prince's from 80", () => {
    expect(declares(4, 8, 0, 40, 39)).toBe(true);
    expect(declares(2, 8, 0, 40, 39)).toBe(false);
    // Saves before version 47 keep Prince's ways at every level.
    expect(declares(4, 8, 0, 40, 39, { evenDifficulty: true })).toBe(false);
    expect(declares(0, 8, 0, 100, 60, { evenDifficulty: true })).toBe(true);
  });

  it("only complains of trespass at Chieftain, and goes to war over it at the Emperor's even when the weaker", () => {
    const trespass = (difficulty: number, legions: number): string => {
      const s = met(difficulty, {}, 10);
      setRelation(s, 0, 1, "peace");
      createUnit(s, "militia", 0, 29, 11).order = { kind: "fortified" };
      for (let i = 0; i < legions; i++) createUnit(s, "legion", 0, 10, 10);
      clearTrespass(s, 1);
      for (let t = 0; t < 6 && relation(s, 0, 1) === "peace"; t++, s.turn++) plannerTurn(s);
      return relation(s, 0, 1);
    };
    expect(trespass(0, 0)).toBe("peace");
    expect(trespass(2, 0)).toBe("war");
    // Its phalanxes (6) against the player's two militia and two legions (12): half the strength, under Prince's 0.6
    // and over the Emperor's 0.4.
    expect(trespass(2, 2)).toBe("peace");
    expect(trespass(4, 2)).toBe("war");
  });

  it("always takes peace at Chieftain; at the Emperor's holds a war it is merely stronger in", () => {
    const peace = (difficulty: number, legions: number): boolean => {
      const s = met(difficulty);
      setRelation(s, 0, 1, "war");
      for (let i = 0; i < legions; i++) createUnit(s, "legion", 1, 24, 10); // beside our city
      return acceptsPeace(s, 1, 0);
    };
    // 38 against 2, its legions at our gates.
    expect(peace(0, 8)).toBe(true);
    expect(peace(2, 8)).toBe(false);
    const even = (difficulty: number): boolean => {
      const s = met(difficulty);
      setRelation(s, 0, 1, "war");
      createUnit(s, "legion", 1, 24, 10);
      createUnit(s, "phalanx", 0, 5, 40);
      createUnit(s, "phalanx", 0, 5, 40);
      return acceptsPeace(s, 1, 0); // 10 against 8: 1.25 times
    };
    expect(even(2)).toBe(true);
    expect(even(3)).toBe(false);
    expect(even(4)).toBe(false);
  });

  it("demands tribute sooner and more as the level grows, and never at Chieftain", () => {
    const demand = (difficulty: number, phalanxes: number): number | undefined => {
      const s = met(difficulty, {}, 10);
      s.players[0]!.gold = 200;
      for (let i = 0; i < phalanxes; i++) createUnit(s, "phalanx", 1, 30, 10);
      for (let t = 0; t < 300 && !s.proposals?.["1>0"]; t++, s.turn++) courtPlayers(s, 1);
      const p = s.proposals?.["1>0"];
      return p?.kind === "tribute" ? p.gold : undefined;
    };
    // 9 against 2: Prince asks three eighths of 200, the Emperor three quarters (its most); Chieftain nothing.
    expect(demand(0, 1)).toBeUndefined();
    expect(demand(2, 1)).toBe(70);
    expect(demand(4, 1)).toBe(150);
    // Two phalanxes and a legion (10) against two militia (4): 2.5 times, enough at King, not at Prince (3).
    const asks = (difficulty: number): boolean => {
      const s = met(difficulty, {}, 10);
      s.players[0]!.gold = 200;
      createUnit(s, "militia", 0, 10, 10);
      createUnit(s, "legion", 1, 30, 10);
      for (let t = 0; t < 300 && !s.proposals?.["1>0"]; t++, s.turn++) courtPlayers(s, 1);
      return s.proposals?.["1>0"] !== undefined;
    };
    expect(asks(3)).toBe(true);
    expect(asks(2)).toBe(false);
  });

  it("answers a refused demand with war every time at the Emperor's", () => {
    const s = met(4, {}, 10);
    s.players[0]!.gold = 200;
    createUnit(s, "phalanx", 1, 30, 10);
    for (let t = 0; t < 300 && !s.proposals?.["1>0"]; t++, s.turn++) courtPlayers(s, 1);
    s.currentPlayer = 0;
    applyCommand(s, { type: "answer", player: 1, accept: false });
    expect(attitude(s, 1, 0)).toBe("hostile");
    s.currentPlayer = 1;
    const wars = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => {
      const c = structuredClone(s);
      c.rng = createRng(seed);
      courtPlayers(c, 1);
      return relation(c, 0, 1) === "war";
    });
    expect(wars.every(Boolean)).toBe(true);
  });
});
