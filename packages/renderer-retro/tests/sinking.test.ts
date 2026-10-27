import { writeFileSync } from "node:fs";
import { createUnit, newGame, Terrain, type GameState } from "@civ/core";
import { sinkingWords, type MainScreenView, type Sinking } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { C, drawMainScreen, shade, tileToScreen, TILE } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const out = (name: string) => new URL(`./out/${name}.png`, import.meta.url);

/** Our Trireme with Settlers aboard on deep water, all of it in sight, the map round it; `ship` false leaves the sea empty. */
function atSea(ship = true): { state: GameState; map: MainScreenView; sinking: Omit<Sinking, "t"> } {
  const state = newGame(5, { opponents: 1 });
  const me = state.players[0]!;
  const [x, y] = [30, 25];
  const w = state.map.width;
  for (let j = y - 6; j <= y + 6; j++)
    for (let i = x - 9; i <= x + 9; i++) {
      const idx = j * w + i;
      state.map.tiles[idx]!.terrain = Terrain.Ocean;
      Object.assign(state.map.tiles[idx]!, { special: false, river: false, hut: false });
      me.explored[idx] = 1;
      me.visible[idx] = 1;
    }
  state.units = state.units.filter((u) => Math.abs(u.x - x) > 9 || Math.abs(u.y - y) > 6);
  const trireme = createUnit(state, "trireme", 0, x, y);
  const settlers = createUnit(state, "settlers", 0, x, y);
  settlers.aboard = trireme.id;
  if (!ship) state.units = state.units.filter((u) => u !== trireme && u !== settlers);
  const map: MainScreenView = { originX: x - 7, originY: y - 5, blink: false, placeNames: false, focus: null };
  return { state, map, sinking: { unit: trireme.id, x, y, type: "trireme", owner: 0, stacked: true, text: sinkingWords("trireme", ["settlers"]) } };
}

/** The fine pixels of the ship's square. */
function square(s: Surface, state: GameState, map: MainScreenView, x: number, y: number): number[] {
  const [sx, sy] = tileToScreen(state, map, x, y)!;
  const px: number[] = [];
  for (let fy = sy * s.k; fy < (sy + TILE) * s.k; fy++) for (let fx = sx * s.k; fx < (sx + TILE) * s.k; fx++) px.push(s.fget(fx, fy));
  return px;
}

describe("a ship sinking", () => {
  it("is told in a line naming what goes down with it", () => {
    expect(sinkingWords("trireme", [])).toBe("Our Trireme sinks in deep water!");
    expect(sinkingWords("trireme", ["settlers"])).toBe("Our Trireme sinks in deep water, with the Settlers aboard!");
    expect(sinkingWords("trireme", ["settlers", "legion"])).toBe("Our Trireme sinks in deep water, with the Settlers and the Legion aboard!");
    expect(sinkingWords("trireme", ["settlers", "legion", "legion"])).toBe("Our Trireme sinks in deep water, with all 3 units aboard!");
  });

  it("goes down from where it stood, under the words above it, and leaves rings on empty water", () => {
    const { state, map, sinking } = atSea();
    const { x, y } = sinking;
    const afloat = Surface.screen();
    drawMainScreen(afloat, state, map);
    const empty = atSea(false);
    const sea = Surface.screen();
    drawMainScreen(sea, empty.state, empty.map);
    const [sx, sy] = tileToScreen(state, map, x, y)!;
    const light = new Set([C.WHITE!, shade("ice", 6), shade("ice", 7)]);
    let before = square(afloat, state, map, x, y);
    for (const t of [0, 0.08, 0.25, 0.4, 0.55, 0.68, 0.8, 0.95]) {
      const s = Surface.screen();
      drawMainScreen(s, state, { ...map, sinking: { ...sinking, t } });
      writeFileSync(out(`sinking-${Math.round(t * 100)}`), encodePng(s, 3));
      const again = Surface.screen();
      drawMainScreen(again, state, { ...map, sinking: { ...sinking, t } });
      expect(again.data).toEqual(s.data);
      const now = square(s, state, map, x, y);
      if (t === 0) expect(now).toEqual(before); // as it stood
      else expect(now, `t ${t}`).not.toEqual(before); // moving
      before = now;
      // The words stand above the square: the rows over it differ from the map without them.
      let words = 0;
      for (let fy = (sy - 12) * s.k; fy < (sy - 4) * s.k; fy++) for (let fx = (sx - 20) * s.k; fx < (sx + 36) * s.k; fx++) if (s.fget(fx, fy) !== afloat.fget(fx, fy)) words++;
      expect(words, `t ${t}`).toBeGreaterThan(100);
      // Gone under: the square is the empty sea's but for the foam, rings and bubbles.
      if (t >= 0.72) {
        const bare = square(sea, empty.state, empty.map, x, y);
        now.forEach((c, i) => { if (c !== bare[i]) expect(light.has(c), `t ${t}`).toBe(true); });
      }
    }
    // The ship and its cargo are not drawn on their square meanwhile, and are again without it.
    const after = Surface.screen();
    drawMainScreen(after, state, map);
    expect(after.data).toEqual(afloat.data);
  });
});
