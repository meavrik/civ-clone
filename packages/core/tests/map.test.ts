import { describe, expect, it } from "vitest";
import { formatYear, newGame, Terrain, turnToYear } from "../src/index.js";

describe("map generation", () => {
  it("produces an 80x50 world deterministically", () => {
    const a = newGame(1234);
    const b = newGame(1234);
    expect(a.map.width).toBe(80);
    expect(a.map.height).toBe(50);
    expect(a.map.tiles.length).toBe(4000);
    expect(a.map.tiles.map((t) => t.terrain)).toEqual(b.map.tiles.map((t) => t.terrain));
  });

  it("has a plausible land/ocean ratio", () => {
    const g = newGame(99);
    const land = g.map.tiles.filter((t) => t.terrain !== Terrain.Ocean).length;
    const ratio = land / g.map.tiles.length;
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.65);
  });

  it("has polar ice on the first and last rows", () => {
    const g = newGame(5);
    for (let x = 0; x < 80; x++) {
      expect(g.map.tiles[x]!.terrain).toBe(Terrain.Arctic);
      expect(g.map.tiles[49 * 80 + x]!.terrain).toBe(Terrain.Arctic);
    }
  });
});

describe("calendar", () => {
  it("matches the original pacing", () => {
    expect(formatYear(turnToYear(0))).toBe("4000 BC");
    expect(formatYear(turnToYear(1))).toBe("3980 BC");
    expect(formatYear(turnToYear(200))).toBe("1 AD");
  });
});
