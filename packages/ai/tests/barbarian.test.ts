import { describe, expect, it } from "vitest";
import { cargo, createUnit, foundCity, getTile, labelContinents, LEADER, mapDistance, newGame, startTurn, Terrain, unitType, type GameState } from "@civ/core";
import { barbarianTurn } from "../src/index.js";

/** Grassland west of column 40, ocean east of it; no units or cities; the barbarians to move. */
function world(): GameState {
  const s = newGame(3, { opponents: 1, allAi: true });
  s.map.tiles.forEach((t, i) => {
    Object.assign(t, { terrain: i % s.map.width < 40 ? Terrain.Grassland : Terrain.Ocean, river: false, special: false, hut: false, road: false, irrigation: false, mine: false, railroad: false, fortress: false });
  });
  labelContinents(s.map);
  s.units = [];
  s.cities = [];
  return s;
}

/** One barbarian turn, moves restored first. */
function turn(s: GameState): void {
  s.currentPlayer = s.barbarians;
  startTurn(s, s.barbarians);
  barbarianTurn(s);
}

const mine = (s: GameState) => s.units.filter((u) => u.owner === s.barbarians);

describe("barbarian AI", () => {
  it("sails raiders to the nearest city and puts them ashore beside it with their leader", () => {
    const s = world();
    const city = foundCity(s, 0, 39, 10);
    createUnit(s, "musketeers", 0, 39, 10).order = { kind: "fortified" };
    const boat = createUnit(s, "sail", s.barbarians, 45, 12);
    for (const type of ["legion", "legion", LEADER]) createUnit(s, type, s.barbarians, 45, 12).aboard = boat.id;
    for (let i = 0; i < 4 && s.units.includes(boat); i++) turn(s);
    // Ashore and the boat gone: the raiders stand beside the city (or died storming it), the leader among them.
    expect(s.units.includes(boat)).toBe(false);
    const leader = mine(s).find((u) => u.type === LEADER)!;
    expect(leader.aboard).toBeNull();
    expect(getTile(s.map, leader.x, leader.y)!.terrain).toBe(Terrain.Grassland);
    expect(mapDistance(s.map, leader.x, leader.y, city.x, city.y)).toBeLessThanOrEqual(2);
  });

  it("keeps the leader with its band, and a lone leader runs, then slips away", () => {
    const s = world();
    foundCity(s, 0, 10, 10);
    const legion = createUnit(s, "legion", s.barbarians, 15, 10);
    const leader = createUnit(s, LEADER, s.barbarians, 16, 11);
    turn(s);
    expect([leader.x, leader.y]).toEqual([legion.x, legion.y]);
    // The escort is gone: the leader backs away from the soldier hunting it, and once far from every city it leaves.
    s.units = s.units.filter((u) => u !== legion);
    const hunter = createUnit(s, "cavalry", 0, leader.x - 1, leader.y);
    const before = mapDistance(s.map, leader.x, leader.y, hunter.x, hunter.y);
    turn(s);
    expect(s.units.includes(leader)).toBe(true);
    expect(mapDistance(s.map, leader.x, leader.y, hunter.x, hunter.y)).toBeGreaterThan(before);
    s.units = s.units.filter((u) => u !== hunter);
    leader.x = 30;
    turn(s);
    expect(s.units.includes(leader)).toBe(false);
  });

  it("holds a barbarian city with its best defender and sends the rest at the nearest city", () => {
    const s = world();
    const target = foundCity(s, 0, 10, 10);
    const held = foundCity(s, 1, 20, 10);
    held.owner = s.barbarians;
    const musketeers = createUnit(s, "musketeers", s.barbarians, 20, 10);
    const knights = createUnit(s, "knights", s.barbarians, 20, 10);
    s.players[0]!.advances.push("gunpowder", "chivalry");
    turn(s);
    expect([musketeers.x, musketeers.y]).toEqual([20, 10]);
    expect(musketeers.order.kind).toMatch(/fortif/);
    expect(mapDistance(s.map, knights.x, knights.y, target.x, target.y)).toBeLessThan(10);
    // Held by a good defender, the city raises attackers.
    expect(unitType(held.production.id).attack).toBeGreaterThan(unitType("musketeers").attack);
  });

  it("an uprising loots the farms it crosses while the city is still far off", () => {
    const s = world();
    foundCity(s, 0, 10, 10);
    getTile(s.map, 17, 10)!.irrigation = true;
    const rider = createUnit(s, "cavalry", s.barbarians, 17, 10);
    turn(s);
    expect([rider.x, rider.y]).toEqual([17, 10]);
    expect(getTile(s.map, 17, 10)!.irrigation).toBe(false);
    turn(s);
    expect(rider.x).toBeLessThan(17);
  });

  it("an empty boat sails off", () => {
    const s = world();
    foundCity(s, 0, 10, 10);
    const boat = createUnit(s, "sail", s.barbarians, 50, 10);
    expect(cargo(s, boat)).toHaveLength(0);
    turn(s);
    expect(s.units.includes(boat)).toBe(false);
  });
});
