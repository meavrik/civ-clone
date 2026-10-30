import { describe, expect, it } from "vitest";
import {
  buyCost,
  cityFoodBox,
  computerRule,
  contentBase,
  costFor,
  DIFFICULTY_RULES,
  foodBox,
  foundCity,
  leaderSpurred,
  loadSave,
  makeSave,
  newGame,
  productionCost,
  researchCostFor,
  temperToward,
  type GameState,
  type NewGameOptions,
  type Production,
} from "../src/index.js";

const skipAll = (): void => {};
const TEMPLE: Production = { kind: "building", id: "temple" };
const LEGION: Production = { kind: "unit", id: "legion" };

/** The player (0) and one computer player (1), alike but for being human; a city each. */
function game(difficulty: number, opts: NewGameOptions = {}): GameState {
  const s = newGame(3, { opponents: 1, difficulty, classicCivs: true, ...opts });
  s.cities = [];
  foundCity(s, 0, 10, 10);
  foundCity(s, 1, 30, 10);
  return s;
}

describe("the computer players by difficulty level", () => {
  it("charges a computer player the original's spread of costs from Prince: 133% at Chieftain to 67% at Emperor", () => {
    const pcts = [133, 117, 100, 83, 67];
    for (let level = 0; level < 5; level++) {
      const s = game(level);
      for (const p of [TEMPLE, LEGION]) {
        expect(costFor(s, 0, p), `${DIFFICULTY_RULES[level]!.name} human`).toBe(productionCost(p));
        expect(costFor(s, 1, p), `${DIFFICULTY_RULES[level]!.name} computer`).toBe(Math.round((productionCost(p) * pcts[level]!) / 100));
      }
    }
    // Buying follows the cost: an empty temple box is dearer for the Chieftain's computers, cheaper for the Emperor's.
    const price = (level: number) => {
      const s = game(level);
      const c = s.cities.find((x) => x.owner === 1)!;
      c.production = TEMPLE;
      return buyCost(s, c);
    };
    expect(price(4)).toBeLessThan(price(2));
    expect(price(0)).toBeGreaterThan(price(2));
  });

  it("grows a computer player's cities on a smaller food box at the harder levels", () => {
    for (const [level, box] of [[0, 27], [2, 20], [4, 13]] as const) {
      const s = game(level);
      const [mine, theirs] = [s.cities.find((c) => c.owner === 0)!, s.cities.find((c) => c.owner === 1)!];
      expect(cityFoodBox(s, mine)).toBe(foodBox(mine));
      expect(cityFoodBox(s, theirs)).toBe(box);
    }
  });

  it("prices a computer player's advances at the original's 14 - level beakers each, the human's by its own table", () => {
    for (let level = 0; level < 5; level++) {
      const s = game(level);
      s.players[0]!.advances = ["alphabet"];
      s.players[1]!.advances = ["alphabet"];
      expect(researchCostFor(s, 0)).toBe(2 * DIFFICULTY_RULES[level]!.techCost);
      expect(researchCostFor(s, 1)).toBe(2 * (14 - level));
    }
  });

  it("keeps a computer player's content citizens and starting gold at Prince's, whatever the human's", () => {
    for (let level = 0; level < 5; level++) {
      const s = game(level);
      expect(contentBase(s, 0)).toBe(6 - level);
      expect(contentBase(s, 1)).toBe(4);
      expect(s.players[0]!.gold).toBe(DIFFICULTY_RULES[level]!.gold);
      expect(s.players[1]!.gold).toBe(0);
    }
  });

  it("spurs the King's and Emperor's computers on from 1 AD while a human knows the most advances", () => {
    const s = game(3);
    s.players[0]!.advances = ["alphabet", "bronze_working"];
    s.players[1]!.advances = ["alphabet"];
    s.turn = 199;
    expect(leaderSpurred(s)).toBe(false);
    expect(costFor(s, 1, TEMPLE)).toBe(Math.round((productionCost(TEMPLE) * 83) / 100));
    s.turn = 200;
    expect(leaderSpurred(s)).toBe(true);
    expect(costFor(s, 1, TEMPLE)).toBe(Math.round((productionCost(TEMPLE) * 66) / 100));
    s.players[1]!.advances.push("pottery");
    expect(leaderSpurred(s)).toBe(false);
    // Prince's computers have no spur.
    const p = game(2);
    p.turn = 250;
    p.players[0]!.advances = ["alphabet", "bronze_working"];
    expect(leaderSpurred(p)).toBe(true);
    expect(costFor(p, 1, TEMPLE)).toBe(productionCost(TEMPLE));
  });

  it("leaves the barbarians as they were", () => {
    const s = game(4);
    expect(computerRule(s, s.barbarians)).toBeNull();
    expect(costFor(s, s.barbarians, LEGION)).toBe(productionCost(LEGION));
  });

  it("plays the computers under the human's rules of the level in saves before version 47", () => {
    const opts: NewGameOptions = { opponents: 1, difficulty: 4, classicCivs: true };
    const state = newGame(3, opts);
    const old = loadSave({ ...makeSave(state, opts, []), version: 46 as const }, skipAll).state;
    expect(old.evenDifficulty).toBe(true);
    expect(computerRule(old, 1)).toBeNull();
    expect(costFor(old, 1, TEMPLE)).toBe(productionCost(TEMPLE));
    expect(contentBase(old, 1)).toBe(2);
    expect(researchCostFor(old, 1)).toBe((old.players[1]!.advances.length + 1) * 16);
    // And their leaders treat the player as at Prince.
    expect(temperToward(old, 0)).toBe(DIFFICULTY_RULES[2]!.computer.temper);
    expect(temperToward(game(4), 0)).toBe(DIFFICULTY_RULES[4]!.computer.temper);
  });
});
