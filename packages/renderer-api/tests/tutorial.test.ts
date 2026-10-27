import { describe, expect, it } from "vitest";
import { createUnit, foundCity, newGame, setRelation, unitType } from "@civ/core";
import { nextTip, tipLines, TUTORIAL } from "../src/index.js";

describe("tutorial", () => {
  it("tells each tip once, as the game comes to it", () => {
    const s = newGame(7, { opponents: 1 });
    const seen = new Set<string>();
    const next = (): string | null => {
      const tip = nextTip(s, 0, seen);
      if (tip) seen.add(tip.id);
      return tip?.id ?? null;
    };
    // The first settlers in play: how to move them, then how they found a city; then nothing until more happens.
    const first = s.units.find((u) => u.id === s.activeUnit)!;
    expect(unitType(first.type).flags).toContain("settler");
    expect(next()).toBe("move");
    expect(next()).toBe("found");
    expect(next()).toBeNull();
    // The first city, then the first moment with nothing left to order.
    const city = foundCity(s, 0, first.x, first.y);
    s.units = s.units.filter((u) => u.owner !== 0);
    expect(next()).toBe("city");
    // Its window stands clear of the city it speaks of.
    expect(TUTORIAL.find((t) => t.id === "city")!.focus!(s, 0)).toMatchObject({ x: city.x, y: city.y });
    expect(next()).toBeNull();
    s.activeUnit = null;
    expect(next()).toBe("endTurn");
    // Science from the second turn, the map from the fourth.
    s.turn = 2;
    s.players[0]!.researching = "alphabet";
    expect(next()).toBe("research");
    expect(next()).toBeNull();
    s.turn = 4;
    expect(next()).toBe("map");
    // A village in sight; an empty city from the eighth turn; a neighbour met.
    const i = s.players[0]!.visible.findIndex((v, k) => v === 1 && k !== city.y * s.map.width + city.x);
    s.map.tiles[i]!.hut = true;
    expect(next()).toBe("village");
    s.turn = 8;
    expect(next()).toBe("defend");
    createUnit(s, "militia", 0, city.x, city.y);
    setRelation(s, 0, 1, "contact");
    expect(next()).toBe("contact");
    expect(next()).toBeNull();
    expect(seen.size).toBe(TUTORIAL.length);
  });

  it("speaks of taps on the phone where the words differ", () => {
    const move = TUTORIAL.find((t) => t.id === "move")!;
    expect(tipLines(move, false).join(" ")).toMatch(/Right-click/);
    expect(tipLines(move, true).join(" ")).toMatch(/Tap a square/);
    const village = TUTORIAL.find((t) => t.id === "village")!;
    expect(tipLines(village, true)).toBe(village.lines);
    expect(new Set(TUTORIAL.map((t) => t.id)).size).toBe(TUTORIAL.length);
  });
});
