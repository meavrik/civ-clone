import { describe, expect, it } from "vitest";
import { getTile, landAt, newGame, placeAt, Terrain, type Region } from "@civ/core";
import { discoveryNote, NAME_REACH, placeLabel, placeLabelText, placeTitle, terrainInfo } from "../src/index.js";

describe("place names", () => {
  it("names one place at a time, the nearest to the unit in play, near the unit", () => {
    const state = newGame(2026, { world: "earth", historical: true, opponents: 3 });
    const me = state.players[0]!;
    const settlers = state.units.find((u) => u.owner === 0)!;
    expect(state.activeUnit).toBe(settlers.id);
    const view = [31, 9, 16, 12] as const;
    // Nothing explored on view: nothing named.
    me.explored.fill(0);
    expect(placeLabel(state, 0, ...view)).toBeNull();
    me.explored.fill(1);
    // The land the settlers stand on, written on a square of it a square in from the view's sides.
    const label = placeLabel(state, 0, ...view)!;
    expect(label).toMatchObject({ name: "Europe", land: true });
    const first = label.at[0]!;
    expect(first.tx).toBeGreaterThanOrEqual(1);
    expect(first.tx).toBeLessThan(view[2] - 1);
    expect(landAt(state.map, view[0] + first.tx, view[1] + first.ty)?.name).toBe("Europe");
    // It stays where it is written while the settlers walk about Europe (asked for: "show static").
    const home = { x: settlers.x, y: settlers.y };
    let stayed = 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      settlers.x = home.x + dx;
      settlers.y = home.y + dy;
      const moved = placeLabel(state, 0, ...view);
      if (moved?.name !== "Europe") continue;
      expect(moved.at[0], `${dx},${dy}`).toEqual(first);
      stayed++;
    }
    expect(stayed).toBeGreaterThanOrEqual(3);
    settlers.x = home.x;
    settlers.y = home.y;
    // At sea the sea is named; in mountains the range before the land under it.
    const at = (x: number, y: number) => { settlers.x = x; settlers.y = y; return placeLabel(state, 0, ...view)?.name; };
    const g = state.map.geography!;
    const black = g.place.findIndex((r) => r >= 0 && g.regions[r]!.name === "the Black Sea");
    expect(at(black % state.map.width, Math.floor(black / state.map.width))).toBe("the Black Sea");
    let range = -1;
    for (let y = view[1] + 2; y < view[1] + view[3] - 2 && range < 0; y++)
      for (let x = view[0] + 2; x < view[0] + view[2] - 2; x++)
        if (placeAt(state.map, x, y)?.kind === "mountains" && landAt(state.map, x, y)) { range = y * state.map.width + x; break; }
    expect(range).toBeGreaterThanOrEqual(0);
    expect(at(range % state.map.width, Math.floor(range / state.map.width))).toBe(g.regions[g.place[range]!]!.name);
    // No unit of ours in play: nothing named.
    state.activeUnit = null;
    expect(placeLabel(state, 0, ...view)).toBeNull();
  });

  it("says where a square lies in its window's title, each name once", () => {
    const state = newGame(3, { world: "earth", historical: true, opponents: 2 });
    const { map } = state;
    const me = state.players[0]!;
    me.explored.fill(1);
    const rome = state.units.find((u) => u.owner === 0)!;
    const info = terrainInfo(state, rome.x, rome.y);
    // The terrain, then the land: "Plains, Europe"; the body no longer repeats it.
    expect(info.title).toMatch(/^(Grassland|Plains|Hills|Forest), Europe$/);
    expect(info.lines.some((l) => l.includes("Europe"))).toBe(false);
    const find = (test: (x: number, y: number) => boolean) => {
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (test(x, y)) return { x, y };
      throw new Error("none");
    };
    // A sea's square is named by its sea alone; a range's square by its range, its terrain's word not said twice.
    const sea = find((x, y) => placeAt(map, x, y)?.name === "the Mediterranean Sea");
    expect(terrainInfo(state, sea.x, sea.y).title).toBe("The Mediterranean Sea");
    const named = find((x, y) => { const p = placeAt(map, x, y); return p?.kind === "mountains" && /Mountains/.test(p.name!) && getTile(map, x, y)?.terrain === Terrain.Mountains; });
    const range = terrainInfo(state, named.x, named.y).title;
    expect(range).toBe(placeTitle([placeAt(map, named.x, named.y)!.name, landAt(map, named.x, named.y)?.name].filter(Boolean).join(", ")));
    expect(range.match(/Mountains/g)!.length).toBe(1);
    // A range's hills keep their own word: "Hills, the Alps, Europe".
    const hills = find((x, y) => placeAt(map, x, y)?.kind === "mountains" && getTile(map, x, y)?.terrain === Terrain.Hills);
    expect(terrainInfo(state, hills.x, hills.y).title).toMatch(/^Hills, /);
    expect(placeLabelText("the Sea of Caesar")).toBe("Sea of Caesar");
    expect(placeTitle("the Sahara, Africa")).toBe("The Sahara, Africa");
  });

  it("tells of new places waters first, then lands, then landforms", () => {
    const found: Region[] = [
      { kind: "desert", size: 9, name: "the Caesar Desert" },
      { kind: "continent", size: 300, name: "Caesar's Land" },
      { kind: "lake", size: 3, name: "Lake Caesar" },
    ];
    expect(discoveryNote(found)).toBe("Discovered: Lake Caesar, Caesar's Land, the Caesar Desert");
    const many = Array.from({ length: 6 }, (_, i): Region => ({ kind: "lake", size: 9 - i, name: `Lake ${i}` }));
    expect(discoveryNote(many)).toBe("Discovered: Lake 0, Lake 1, Lake 2 and 3 more");
  });
});
