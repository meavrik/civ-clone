import { writeFileSync } from "node:fs";
import { newGame, Terrain, type GameState } from "@civ/core";
import type { MainScreenView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawMainScreen, shade, tileToScreen, TILE } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

/** Hills round (30, 25) in our sight, Iron on two of them; we know no Bronze Working yet. */
function hills(): { state: GameState; map: MainScreenView; iron: [number, number][] } {
  const state = newGame(5, { opponents: 1 });
  const me = state.players[0]!;
  const [x, y] = [30, 25];
  const w = state.map.width;
  for (let j = y - 6; j <= y + 6; j++)
    for (let i = x - 9; i <= x + 9; i++) {
      const idx = j * w + i;
      Object.assign(state.map.tiles[idx]!, { terrain: Terrain.Hills, special: false, river: false, hut: false, road: false, mine: false, irrigation: false });
      delete state.map.tiles[idx]!.deposit;
      me.explored[idx] = 1;
      me.visible[idx] = 1;
    }
  state.units = [];
  state.cities = [];
  me.advances = [];
  const iron: [number, number][] = [[x, y], [x + 2, y - 1]];
  for (const [i, j] of iron) Object.assign(state.map.tiles[j * w + i]!, { special: true, deposit: "Iron" });
  return { state, iron, map: { originX: x - 7, originY: y - 5, blink: false, placeNames: false, civNames: false, focus: null } };
}

/** The fine pixels of square (x, y) on the screen. */
function square(s: Surface, state: GameState, map: MainScreenView, x: number, y: number): number[] {
  const [sx, sy] = tileToScreen(state, map, x, y)!;
  const px: number[] = [];
  for (let fy = sy * s.k; fy < (sy + TILE) * s.k; fy++) for (let fx = sx * s.k; fx < (sx + TILE) * s.k; fx++) px.push(s.fget(fx, fy));
  return px;
}

describe("resources hidden until revealed", () => {
  it("draws Iron only once its civilization knows Bronze Working, then rings its squares for a moment", () => {
    const { state, map, iron } = hills();
    const [x, y] = iron[0]!;
    const s = Surface.screen();
    drawMainScreen(s, state, map);
    const hidden = square(s, state, map, x, y);
    // Hidden, the square is drawn as the plain hills beside it.
    state.map.tiles[y * state.map.width + x]!.special = false;
    drawMainScreen(s, state, map);
    expect(square(s, state, map, x, y)).toEqual(hidden);
    state.map.tiles[y * state.map.width + x]!.special = true;
    state.players[0]!.advances.push("bronze_working");
    drawMainScreen(s, state, map);
    expect(square(s, state, map, x, y)).not.toEqual(hidden);
    // The reveal's rings: a gold edge round each square of it, bright then dim.
    drawMainScreen(s, state, { ...map, revealed: { squares: iron.map(([i, j]) => ({ x: i, y: j })), at: 0.1 } });
    writeFileSync(new URL("./out/reveal.png", import.meta.url), encodePng(s, 3));
    for (const [i, j] of iron) {
      const [sx, sy] = tileToScreen(state, map, i, j)!;
      expect(s.get(sx, sy + 5)).toBe(shade("wheat", 7));
    }
    drawMainScreen(s, state, { ...map, revealed: { squares: iron.map(([i, j]) => ({ x: i, y: j })), at: 0.3 } });
    const [sx, sy] = tileToScreen(state, map, x, y)!;
    expect(s.get(sx, sy + 5)).toBe(shade("wheat", 4));
  });
});
