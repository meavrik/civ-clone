import { describe, expect, it } from "vitest";
import {
  applyCommand, civ, discoverSquare, findGeography, landAt, loadSave, makeSave, newGame, placeAt, placeNames,
  premadeMap, createRng, revealAround, Terrain, WATER_KINDS, LAND_KINDS, type Command, type GameState, type WorldMap,
} from "../src/index.js";

/** A world of sea with one island of `land` squares in a block, the rest as given. */
function world(w: number, h: number, paint: (x: number, y: number) => Terrain): WorldMap {
  const tiles = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ terrain: paint(x, y), river: false, special: false, road: false, irrigation: false, mine: false, hut: false, railroad: false, fortress: false, pollution: false, continent: 0 });
  return { width: w, height: h, tiles };
}

function skipAll(state: GameState): void {
  let guard = 0;
  while (state.activeUnit !== null && guard++ < 100) applyCommand(state, { type: "skip", unit: state.activeUnit });
}

describe("places", () => {
  it("finds lakes, seas, continents, islands and landforms on a world", () => {
    // 80x50: a continent with a desert and a lake, an island, the rest sea; ice at the poles.
    const map = world(80, 50, (x, y) => {
      if (y === 0 || y === 49) return Terrain.Arctic;
      if (x >= 10 && x < 30 && y >= 10 && y < 30) {
        if (x >= 18 && x < 21 && y >= 18 && y < 21) return Terrain.Ocean; // a lake of 9
        return x < 16 ? Terrain.Desert : Terrain.Grassland;
      }
      if (x >= 50 && x < 53 && y >= 20 && y < 22) return Terrain.Plains; // an island of 6
      return Terrain.Ocean;
    });
    const g = findGeography(map);
    const kinds = (x: number, y: number) => [placeAt({ ...map, geography: g }, x, y)?.kind, landAt({ ...map, geography: g }, x, y)?.kind];
    expect(kinds(19, 19)).toEqual(["lake", undefined]);
    expect(kinds(12, 15)).toEqual(["desert", "continent"]);
    expect(kinds(25, 15)).toEqual([undefined, "continent"]); // grassland makes no landform
    expect(kinds(51, 21)).toEqual([undefined, "island"]);
    expect(kinds(40, 0)).toEqual(["ice", undefined]); // the polar row is an ice field, not land of its own
    // Every sea square lies in some water; the open sea is cut into several basins.
    const waters = new Set<number>();
    map.tiles.forEach((t, i) => {
      if (t.terrain !== Terrain.Ocean) return;
      expect(g.place[i]).toBeGreaterThanOrEqual(0);
      expect(WATER_KINDS.has(g.regions[g.place[i]!]!.kind)).toBe(true);
      waters.add(g.place[i]!);
    });
    expect(waters.size).toBeGreaterThan(4);
    expect(g.regions.reduce((n, r) => n + r.size, 0)).toBe(
      [...g.place].filter((r) => r >= 0).length + [...g.land].filter((r) => r >= 0).length,
    );
    expect(g.regions.every((r) => r.name === undefined)).toBe(true);
  });

  it("names a place for the civilization that sees it first, and keeps the name", () => {
    const state = newGame(2026, { opponents: 3 });
    const g = state.map.geography!;
    const me = state.players[0]!;
    const rome = civ(me.civ);
    // Our first settlers stand on land we named as the game began: "Caesar's Land".
    const u = state.units.find((o) => o.owner === 0)!;
    const home = landAt(state.map, u.x, u.y)!;
    expect(home.by).toBe(0);
    expect(home.turn).toBe(0);
    expect(home.name).toBe(placeNames(home.kind, home.size, me.civ)[0]);
    expect(home.name).toContain(rome.leader);
    // Places nobody has seen have no name; every name is used once.
    const named = g.regions.filter((r) => r.name);
    expect(named.length).toBeLessThan(g.regions.length);
    expect(new Set(named.map((r) => r.name)).size).toBe(named.length);
    for (const r of g.regions) expect(r.name === undefined).toBe(r.by === undefined);
    // A second civilization seeing it later changes nothing.
    const i = u.y * state.map.width + u.x;
    discoverSquare(state, 1, i);
    expect(home.by).toBe(0);
    expect(home.name).toBe(placeNames(home.kind, home.size, me.civ)[0]);
  });

  it("gives the next unused name once a civilization has used the first", () => {
    const state = newGame(7, { opponents: 1 });
    const g = state.map.geography!;
    const square = (r: number) => (g.place.indexOf(r) >= 0 ? g.place.indexOf(r) : g.land.indexOf(r));
    const unseen = g.regions.map((r, i) => [r, i] as const).filter(([r]) => r.by === undefined);
    const [first, a] = unseen[0]!;
    const [twin, b] = unseen.find(([r]) => r.kind === first.kind && r !== first)!;
    discoverSquare(state, 0, square(a));
    discoverSquare(state, 0, square(b));
    const names = placeNames(first.kind, first.size, state.players[0]!.civ);
    expect(names).toContain(first.name);
    expect(twin.name).toBeDefined();
    expect(twin.name).not.toBe(first.name);
  });

  it("never lets the barbarians name a place", () => {
    const state = newGame(11, { opponents: 1 });
    const g = state.map.geography!;
    const unseen = g.regions.findIndex((r) => r.by === undefined);
    const i = g.place.indexOf(unseen) >= 0 ? g.place.indexOf(unseen) : g.land.indexOf(unseen);
    const x = i % state.map.width;
    const y = (i - x) / state.map.width;
    revealAround(state, state.barbarians, x, y, 1);
    expect(g.regions[unseen]!.by).toBeUndefined();
    expect(g.regions[unseen]!.name).toBeUndefined();
  });

  it("drops a landform from a square whose terrain no longer fits it, the place keeping its name", () => {
    const state = newGame(2026, { opponents: 1 });
    const g = state.map.geography!;
    const i = g.place.findIndex((r, j) => r >= 0 && !WATER_KINDS.has(g.regions[r]!.kind) && state.map.tiles[j]!.terrain === Terrain.Forest);
    const x = i % state.map.width;
    const y = (i - x) / state.map.width;
    const forest = placeAt(state.map, x, y)!;
    expect(forest.kind).toBe("forest");
    state.map.tiles[i]!.terrain = Terrain.Plains;
    expect(placeAt(state.map, x, y)).toBeUndefined();
    expect(g.regions[g.place[i]!]).toBe(forest);
  });

  it("names the same places when a save replays", () => {
    const opts = { opponents: 2 as const };
    const state = newGame(99, opts);
    const log: Command[] = [];
    const run = (cmd: Command) => { if (applyCommand(state, cmd).ok) log.push(cmd); };
    const walker = state.units.find((u) => u.owner === 0)!.id;
    for (let turn = 0; turn < 6; turn++) {
      for (const [dx, dy] of [[1, 0], [1, 1], [0, 1]] as const) run({ type: "move", unit: walker, dx, dy });
      skipAll(state);
      run({ type: "endTurn" });
      while (state.currentPlayer !== 0) { skipAll(state); applyCommand(state, { type: "endTurn" }); }
    }
    const again = loadSave(makeSave(state, opts, log), skipAll).state;
    expect(JSON.stringify(again.map.geography!.regions)).toBe(JSON.stringify(state.map.geography!.regions));
    expect(state.map.geography!.regions.filter((r) => r.by === 0).length).toBeGreaterThan(1);
  });

  it("discovers every place at once when the whole map is revealed", () => {
    const state = newGame(5, { opponents: 1 });
    applyCommand(state, { type: "cheat", cheat: "revealMap" });
    expect(state.map.geography!.regions.every((r) => r.by !== undefined && r.name)).toBe(true);
  });

  it("gives a premade world its real names, discovered or not", () => {
    const map = premadeMap(createRng(1), "earth");
    const names = map.geography!.regions.map((r) => r.name);
    for (const n of ["the Mediterranean Sea", "the North Atlantic Ocean", "the Sahara", "the Alps", "Africa", "Europe", "Great Britain", "the Caspian Sea"])
      expect(names).toContain(n);
    expect(map.geography!.regions.every((r) => r.name && r.by === undefined)).toBe(true);
    // Rome's homeland: in Europe, with the sea by it the Mediterranean or one of its arms.
    const state = newGame(3, { world: "earth", historical: true, opponents: 2 });
    const rome = state.units.find((u) => u.owner === 0)!;
    expect(landAt(state.map, rome.x, rome.y)?.name).toBe("Europe");
    expect(landAt(state.map, rome.x, rome.y)?.by).toBe(0);
    const seas = new Set<string>();
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const p = placeAt(state.map, rome.x + dx, rome.y + dy);
        if (p && WATER_KINDS.has(p.kind)) seas.add(p.name!);
      }
    expect([...seas].some((n) => /Mediterranean|Tyrrhenian|Adriatic|Ionian/.test(n))).toBe(true);
    // Lands are continents and islands; nothing else lies in that layer.
    const g = state.map.geography!;
    for (const r of new Set(g.land)) if (r >= 0) expect(LAND_KINDS.has(g.regions[r]!.kind)).toBe(true);
  });
});
