import { describe, expect, it } from "vitest";
import { civ, CIV_COLORS, CIVS, colorSlot, loadSave, makeSave, MAX_CIVS, nativeCivs, newGame, PREMADE_WORLDS, WORLD_SIZES, type GameState } from "../src/index.js";

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

  it("has a colour for each of the most civilizations a game seats, two civilizations to each", () => {
    const playable = CIVS.filter((c) => c.id !== "barbarians");
    const colors = new Set(playable.map((c) => c.color));
    expect(colors.size).toBe(MAX_CIVS);
    for (const color of colors) expect(playable.filter((c) => c.color === color).length, color).toBe(2);
  });

  it("seats ten civilizations of ten colours, whoever the human plays", () => {
    const playable = CIVS.filter((c) => c.id !== "barbarians");
    for (const human of playable) {
      const s = newGame(3, { opponents: MAX_CIVS - 1, civ: human.id, size: "medium" });
      expect(s.players.length, human.id).toBe(MAX_CIVS + 1);
      expect(new Set(s.players.map((p) => p.color)).size, human.id).toBe(MAX_CIVS + 1);
      expect(s.players[s.barbarians]!.color).toBe(colorSlot("red"));
    }
  });

  it("gives the natives of the smaller premade worlds a colour each, and Earth enough for ten", () => {
    for (const w of PREMADE_WORLDS) {
      const natives = nativeCivs(w);
      expect(new Set(natives.map((c) => civ(c).color)).size, w.id).toBe(Math.min(natives.length, MAX_CIVS));
    }
  });

  it("keeps the colours a game of before version 72 had", () => {
    const s = newGame(5, { opponents: 6, civ: "russians", eightColors: true });
    expect(s.players[0]!.color).toBe(colorSlot("white"));
    expect(s.players.some((p) => p.civ === "romans" || p.civ === "hebrews")).toBe(false); // they shared it then
    expect(civ("russians").earlyColor).toBe("white");
    expect(new Set(s.players.map((p) => p.color)).size).toBe(s.players.length);
    expect(Math.max(...s.players.map((p) => p.color))).toBeLessThan(colorSlot("brown"));
  });

  it("loads a save of before version 72 with the rivals, colours and starts it began with", () => {
    for (const world of [undefined, "earth"]) {
      const opts = { opponents: 6, ...(world ? { world, historical: true } : {}) };
      const then = newGame(8, { ...opts, eightColors: true, crowdedHomelands: true, ...(world ? { oldLands: true } : {}) });
      const save = { ...makeSave(then, opts, []), version: 71 as const };
      const { state } = loadSave(save, () => {});
      const seats = (g: GameState) => g.players.map((p) => [p.civ, p.color, g.units.find((u) => u.owner === p.id)?.x]);
      expect(seats(state)).toEqual(seats(then));
    }
  });

  it("offers every size its most civilizations", () => {
    expect(WORLD_SIZES.map((s) => s.maxCivs)).toEqual([8, 10, 10]);
  });
});
