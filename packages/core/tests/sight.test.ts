import { describe, expect, it } from "vitest";
import { applyCommand, borderRadius, claims, createUnit, foundCity, landSight, newGame, recomputeVisibility, setRelation, Terrain, unitSight, type GameState, type NewGameOptions } from "../src/index.js";

/** Grassland everywhere, nobody on it yet: civ 0 (us) and civ 1, at war. */
function world(opts: NewGameOptions = {}): GameState {
  const s = newGame(5, { opponents: 1, ...opts });
  for (const t of s.map.tiles) {
    t.terrain = Terrain.Grassland;
    t.river = false; t.road = false; t.irrigation = false; t.mine = false; t.special = false; t.hut = false;
  }
  s.units = [];
  s.cities = [];
  for (const p of s.players) { p.explored.fill(0); p.visible.fill(0); }
  setRelation(s, 0, 1, "war");
  return s;
}

const seen = (s: GameState, x: number, y: number, player = 0) => s.players[player]!.visible[y * s.map.width + x] === 1;

describe("sight", () => {
  it("covers a civilization's land and one square beyond it", () => {
    const s = world();
    const city = foundCity(s, 0, 20, 20);
    city.size = 4; // culture 4: the border reaches two squares out
    expect(borderRadius(s, city)).toBe(2);
    recomputeVisibility(s, 0);
    const land = claims(s);
    const w = s.map.width;
    for (let y = 14; y <= 26; y++)
      for (let x = 14; x <= 26; x++) {
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (land[(y + dy) * w + x + dx] === 0) near = true;
        expect(seen(s, x, y), `${x},${y}`).toBe(near);
        if (near) expect(s.players[0]!.explored[y * w + x]).toBe(1); // what it sees it has explored
      }
    expect(seen(s, 23, 20)).toBe(true);
    expect(seen(s, 24, 20)).toBe(false);
    expect(seen(s, 23, 23)).toBe(false); // the fat cross's corner is not land, nor next to it
  });

  it("grows with the border and shows foreign units on it", () => {
    const s = world();
    foundCity(s, 0, 50, 30); // the capital (its palace gives it the wider border at once)
    const city = foundCity(s, 0, 20, 20);
    const theirs = createUnit(s, "militia", 1, 23, 20);
    recomputeVisibility(s, 0);
    expect(borderRadius(s, city)).toBe(1);
    expect(seen(s, 22, 20)).toBe(true); // a new city's border is one square out: it sees two
    expect(seen(s, 23, 20)).toBe(false);
    city.size = 4;
    recomputeVisibility(s, 0);
    expect(seen(s, theirs.x, theirs.y)).toBe(true);
    expect(landSight(s, 0)).toContain(20 * s.map.width + 23);
  });

  it("sees round each unit beyond the border, two squares out for scouts", () => {
    const s = world();
    foundCity(s, 0, 20, 20);
    const militia = createUnit(s, "militia", 0, 40, 20);
    const horse = createUnit(s, "cavalry", 0, 60, 20);
    const diplomat = createUnit(s, "diplomat", 0, 60, 30);
    recomputeVisibility(s, 0);
    expect(unitSight(s, militia)).toBe(1);
    expect(unitSight(s, horse)).toBe(2);
    expect(unitSight(s, diplomat)).toBe(2);
    expect(seen(s, 41, 21)).toBe(true);
    expect(seen(s, 42, 20)).toBe(false);
    expect(seen(s, 62, 22)).toBe(true);
    expect(seen(s, 63, 20)).toBe(false);
  });

  it("keeps the old sight in saves before version 30: round units, scouts one square, next to cities", () => {
    const s = world({ narrowSight: true });
    const city = foundCity(s, 0, 20, 20);
    city.size = 4;
    const horse = createUnit(s, "cavalry", 0, 60, 20);
    const ship = createUnit(s, "cruiser", 0, 60, 40);
    recomputeVisibility(s, 0);
    expect(unitSight(s, horse)).toBe(1);
    expect(unitSight(s, ship)).toBe(2); // warships always saw two out
    expect(seen(s, 21, 20)).toBe(true);
    expect(seen(s, 22, 20)).toBe(false);
    expect(seen(s, 62, 20)).toBe(false);
  });

  it("takes a lost city's land out of its old owner's sight at once", () => {
    const s = world();
    const city = foundCity(s, 1, 20, 20);
    city.size = 4;
    foundCity(s, 1, 40, 20); // a second city, so civ 1 lives on
    recomputeVisibility(s, 1);
    expect(seen(s, 23, 20, 1)).toBe(true);
    s.currentPlayer = 0;
    const legion = createUnit(s, "legion", 0, 19, 20);
    const r = applyCommand(s, { type: "move", unit: legion.id, dx: 1, dy: 0 });
    expect(r.ok).toBe(true);
    expect(s.cities.find((c) => c.x === 20)?.owner).toBe(0);
    expect(seen(s, 23, 20, 1)).toBe(false);
  });
});
