import { describe, expect, it } from "vitest";
import { applyCommand, CITY_RADIUS, newGame } from "@civ/core";
import { borderSides, ownerAt, territory, type Territory } from "../src/index.js";

/** The capital, its palace taking its border to the 21 squares it works. */
function founded() {
  const state = newGame(7);
  const u = state.units[0]!;
  applyCommand(state, { type: "found", unit: u.id });
  const city = state.cities[0]!;
  return { state, city };
}

describe("territory", () => {
  it("gives a new city the squares round it, and with culture the squares it can work", () => {
    const { state, city } = founded();
    city.buildings = [];
    expect([...territory(state).owner].filter((o) => o === city.owner).length).toBe(9);
    city.buildings = ["palace"];
    const t = territory(state);
    expect([...t.owner].filter((o) => o === city.owner).length).toBe(CITY_RADIUS.length);
    for (const [dx, dy] of CITY_RADIUS) expect(ownerAt(t, city.x + dx, city.y + dy)).toBe(city.owner);
    expect(ownerAt(t, city.x + 3, city.y)).toBe(-1);
  });

  it("splits overlapping reach by the nearer city, then the older, and leaves out cities not explored", () => {
    const { state, city } = founded();
    const rival = { ...city, id: city.id + 100, owner: 1, x: city.x + 3, name: "Rival" };
    state.cities.push(rival);
    state.players[0]!.explored[rival.y * state.map.width + rival.x] = 1;
    const t = territory(state);
    expect(ownerAt(t, city.x + 1, city.y)).toBe(city.owner); // nearer ours
    expect(ownerAt(t, city.x + 2, city.y)).toBe(1); // nearer theirs
    // Two squares from each: the older city keeps it.
    rival.x = city.x + 4;
    state.players[0]!.explored[rival.y * state.map.width + rival.x] = 1;
    expect(ownerAt(territory(state), city.x + 2, city.y)).toBe(city.owner);
    expect(ownerAt(territory(state), city.x + 3, city.y)).toBe(1);
    rival.x = city.x + 3;
    // A rival city we have not found claims nothing.
    state.players[0]!.explored[rival.y * state.map.width + rival.x] = 0;
    expect(ownerAt(territory(state), city.x + 2, city.y)).toBe(city.owner);
    expect(ownerAt(territory(state), city.x + 4, city.y)).toBe(-1);
  });

  it("runs the border round the city's reach, reaching past the corner at each inner corner", () => {
    const { state, city } = founded();
    const t = territory(state);
    let sides = 0;
    let reaching = 0;
    for (const [dx, dy] of CITY_RADIUS)
      for (const b of borderSides(t, city.x + dx, city.y + dy)) {
        sides++;
        reaching += Number(b.startOut) + Number(b.endOut);
      }
    expect(sides).toBe(20); // the outline of a 5x5 block without its corners
    expect(reaching).toBe(8); // two lines at each of the four notches
  });

  it("draws both civilizations' lines where they meet, and wraps east-west", () => {
    const owner = new Int16Array(4 * 1).fill(-1);
    owner.set([0, 1, 1, 0]);
    const t: Territory = { width: 4, height: 1, owner };
    expect(borderSides(t, 0, 0).map((b) => b.side).sort()).toEqual([0, 1, 2]); // west neighbour is square 3, also ours
    expect(borderSides(t, 1, 0).map((b) => b.side).sort()).toEqual([0, 2, 3]);
  });
});
