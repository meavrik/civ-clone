import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, foundCity, getTile, newGame, setRelation, Terrain, type GameState } from "@civ/core";
import { homeTrip, moveRefusal, planMove, routeTurns, type MovePlan } from "../src/index.js";

/** A strip of open grassland east of a militia, with mountains to its west. */
function field(): { s: GameState; id: number; x: number; y: number } {
  const s = newGame(2026, { opponents: 1 });
  const x = 20;
  const y = 20;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 9; dx++)
      Object.assign(getTile(s.map, x + dx, y + dy)!, { terrain: dx < 0 ? Terrain.Mountains : Terrain.Grassland, road: false, river: false, railroad: false });
  s.units = s.units.filter((u) => Math.abs(u.x - x) > 12 || Math.abs(u.y - y) > 6);
  s.cities = s.cities.filter((c) => Math.abs(c.x - x) > 12 || Math.abs(c.y - y) > 6);
  const m = createUnit(s, "militia", 0, x, y);
  return { s, id: m.id, x, y };
}

describe("planned moves", () => {
  it("step next door at once, and leave a refused step to say why", () => {
    const { s, id, x, y } = field();
    expect(planMove(s, id, x + 1, y)).toBe("step");
    // A militia cannot climb the mountains off the road: still a step, which the rules refuse with a note.
    expect(planMove(s, id, x - 1, y)).toBe("step");
    expect(planMove(s, id, x, y)).toBeNull();
  });

  it("show the odds before a fight, and the city before taking it", () => {
    const { s, id, x, y } = field();
    createUnit(s, "militia", 1, x + 1, y);
    const fight = planMove(s, id, x + 1, y) as MovePlan;
    expect(fight.text).toMatch(/^Attack: \d+%$/);
    expect(fight.route).toEqual([[x + 1, y]]);
    const city = foundCity(s, 1, x, y + 1);
    expect((planMove(s, id, x, y + 1) as MovePlan).text).toBe(`Take ${city.name}`);
  });

  it("show what a caravan opens at a foreign city, garrisoned or not, and leave a refused one to say why", () => {
    const { s, x, y } = field();
    setRelation(s, 0, 1, "peace");
    const home = foundCity(s, 0, x - 12, y + 12);
    const theirs = foundCity(s, 1, x + 2, y);
    createUnit(s, "phalanx", 1, theirs.x, theirs.y, theirs.id);
    const cv = createUnit(s, "caravan", 0, x + 1, y, home.id);
    const next = planMove(s, cv.id, x + 2, y) as MovePlan;
    expect(next.text).toMatch(/^Trade route \+\d+$/);
    expect(next.route).toEqual([[x + 2, y]]);
    cv.x = x; // further off: the note says when too
    expect((planMove(s, cv.id, x + 2, y) as MovePlan).text).toMatch(/^Trade route \+\d+: (this turn|\d+ turns)$/);
    // Too close to its home: a step, which the rules refuse with a note.
    cv.x = x + 1;
    cv.homeCity = foundCity(s, 0, x - 1, y + 3).id;
    expect(planMove(s, cv.id, x + 2, y)).toBe("step");
    expect(moveRefusal(s, cv.id, 1, 0, "too close to home")).toBe("Too close to home: a trade route needs 9 squares.");
    // At war there is no route to open, and no attack to show: a caravan cannot fight.
    cv.homeCity = home.id;
    setRelation(s, 0, 1, "war");
    expect(planMove(s, cv.id, x + 2, y)).toBe("step");
  });

  it("show the route and the turns before going further, and nothing where there is no route", () => {
    const { s, id, x, y } = field();
    const near = planMove(s, id, x + 2, y) as MovePlan;
    expect(near.route.at(-1)).toEqual([x + 2, y]);
    expect(near.text).toBe("2 turns"); // one square this turn, one the next
    const far = planMove(s, id, x + 6, y) as MovePlan;
    expect(far.route).toHaveLength(6);
    expect(far.text).toBe("6 turns");
    // A road all the way: three squares a turn.
    for (let dx = 0; dx <= 6; dx++) getTile(s.map, x + dx, y)!.road = true;
    expect(routeTurns(s, s.units.find((u) => u.id === id)!, (planMove(s, id, x + 6, y) as MovePlan).route)).toBe(2);
    expect((planMove(s, id, x + 3, y) as MovePlan).text).toBe("This turn");
    // The sea, for a land unit: no route, so the click is not the unit's.
    getTile(s.map, x + 8, y + 3)!.terrain = Terrain.Ocean;
    expect(planMove(s, id, x + 8, y + 3)).toBeNull();
  });
});

describe("the way home", () => {
  it("names the unit's home city and the turns there, a goto's way, and nothing once it stands in it", () => {
    const { s, id, x, y } = field();
    const u = s.units.find((o) => o.id === id)!;
    const home = foundCity(s, 0, x + 6, y);
    u.homeCity = home.id;
    expect(homeTrip(s, u)).toEqual({ city: home, turns: 6 });
    u.x = x + 5;
    expect(homeTrip(s, u)!.turns).toBe(1);
    u.movesLeft = 0; // spent: the trip starts next turn
    expect(homeTrip(s, u)!.turns).toBe(2);
    u.x = x + 6;
    expect(homeTrip(s, u)).toBeNull();
    // Walked: a goto gets it there, however many turns it takes.
    u.x = x;
    u.movesLeft = 3;
    expect(applyCommand(s, { type: "goto", unit: id, x: home.x, y: home.y }).ok).toBe(true);
    expect([u.x, u.order.kind]).toEqual([x + 1, "goto"]);
  });

  it("is none for a unit with no home city, or one no longer its owner's", () => {
    const { s, id, x, y } = field();
    const u = s.units.find((o) => o.id === id)!;
    expect(homeTrip(s, u)).toBeNull();
    u.homeCity = foundCity(s, 1, x + 2, y).id;
    expect(homeTrip(s, u)).toBeNull();
  });

  it("says when no route leads there: walled off from it, or over the sea", () => {
    const { s, id, x, y } = field();
    const u = s.units.find((o) => o.id === id)!;
    const home = foundCity(s, 0, x - 2, y);
    u.homeCity = home.id;
    expect(homeTrip(s, u)).toEqual({ city: home, turns: null }); // the mountains between
    getTile(s.map, x + 3, y)!.terrain = Terrain.Ocean;
    u.homeCity = foundCity(s, 0, x + 3, y + 3).id;
    const ship = createUnit(s, "trireme", 0, x + 3, y, u.homeCity);
    expect(homeTrip(s, ship)).toEqual({ city: expect.objectContaining({ id: u.homeCity }), turns: null }); // a city inland
  });
});
