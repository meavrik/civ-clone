import { describe, expect, it } from "vitest";
import { CITY_SPACING, createUnit, foundCity, getTile, mapDistance, newGame, Terrain, type GameState } from "@civ/core";
import { settlerSites } from "../src/index.js";

/** Grassland round (20, 20), all of it seen by player 0, one landmass; the settlers in the middle. */
function field(): { s: GameState; id: number } {
  const s = newGame(2026, { opponents: 1 });
  s.units = [];
  s.cities = [];
  for (const t of s.map.tiles) Object.assign(t, { terrain: Terrain.Ocean, river: false, special: false, hut: false, continent: 0 });
  for (let y = 8; y < 32; y++) for (let x = 8; x < 32; x++) Object.assign(getTile(s.map, x, y)!, { terrain: Terrain.Grassland, continent: 1 });
  s.players[0]!.explored.fill(1);
  const u = createUnit(s, "settlers", 0, 20, 20);
  return { s, id: u.id };
}

describe("suggested city sites", () => {
  it("mark a few good squares near the settlers, apart from each other, the best first", () => {
    const { s, id } = field();
    const sites = settlerSites(s, id);
    expect(sites.length).toBe(3);
    expect(sites.map((x) => x.best)).toEqual([true, false, false]);
    // On open grassland the nearest is best: where the settlers stand.
    expect(sites[0]).toMatchObject({ x: 20, y: 20 });
    for (const a of sites) for (const b of sites) if (a !== b) expect(mapDistance(s.map, a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(CITY_SPACING.own);
  });

  it("keep clear of known cities, ours by four squares and others by five, and of what is unseen or across the sea", () => {
    const { s, id } = field();
    foundCity(s, 0, 23, 20);
    foundCity(s, 1, 14, 20);
    const sites = settlerSites(s, id);
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      expect(mapDistance(s.map, site.x, site.y, 23, 20)).toBeGreaterThanOrEqual(CITY_SPACING.own);
      expect(mapDistance(s.map, site.x, site.y, 14, 20)).toBeGreaterThanOrEqual(CITY_SPACING.foreign);
    }
    // Squares the player has not seen are never suggested; nor land the settlers cannot walk to.
    const { s: t, id: tid } = field();
    for (let y = 0; y < t.map.height; y++) for (let x = 0; x < 20; x++) t.players[0]!.explored[y * t.map.width + x] = 0;
    expect(settlerSites(t, tid).every((site) => site.x >= 20)).toBe(true);
    for (let y = 8; y < 32; y++) getTile(t.map, 24, y)!.terrain = Terrain.Ocean;
    for (let y = 8; y < 32; y++) for (let x = 25; x < 32; x++) getTile(t.map, x, y)!.continent = 2;
    expect(settlerSites(t, tid).every((site) => site.x < 24)).toBe(true);
  });

  it("mark nothing for any other unit", () => {
    const { s } = field();
    const militia = createUnit(s, "militia", 0, 20, 20);
    expect(settlerSites(s, militia.id)).toEqual([]);
    expect(settlerSites(s, null)).toEqual([]);
  });
});
