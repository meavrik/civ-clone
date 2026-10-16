import { describe, expect, it } from "vitest";
import { civ, CIV_COLORS, CIVS, colorSlot, newGame } from "../src/index.js";

describe("civilization colours", () => {
  it("every civilization has a colour slot and the barbarians are red", () => {
    for (const c of CIVS) expect(CIV_COLORS).toContain(c.color);
    expect(civ("barbarians").color).toBe("red");
    expect(CIVS.filter((c) => c.id !== "barbarians").every((c) => c.color !== "red")).toBe(true);
  });

  it("no two players in a game share a colour, whoever the human plays", () => {
    const playable = CIVS.filter((c) => c.id !== "barbarians");
    for (const human of playable)
      for (let seed = 1; seed <= 6; seed++) {
        const s = newGame(seed, { opponents: 6, civ: human.id });
        const slots = s.players.map((p) => p.color);
        expect(new Set(slots).size, `${human.id} seed ${seed}`).toBe(slots.length);
        expect(s.players.length).toBe(8); // seven civilizations and the barbarians
      }
  });

  it("a civilization keeps its colour whatever seat it takes", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(seed, { opponents: 6 });
      for (const p of s.players) expect(p.color, p.civ).toBe(colorSlot(civ(p.civ).color));
    }
  });
});
