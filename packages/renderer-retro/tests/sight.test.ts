import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, getTile, newGame, recomputeVisibility, revealAround, setRelation, Terrain, type GameState } from "@civ/core";
import { drawMainScreen, Surface, TILE, tileToScreen, UNSEEN, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";

/** Our city with a wide land of explored squares round it, a scout out beyond, and a foreign soldier in sight and one out of it. */
function scene(): { state: GameState; view: MainScreenView; cx: number; cy: number } {
  const state = newGame(2026);
  const u = state.units[0]!;
  const cx = u.x;
  const cy = u.y;
  state.units = state.units.filter((o) => o.owner !== 0 || o.id === u.id);
  applyCommand(state, { type: "found", unit: u.id });
  for (const p of state.players) { p.explored.fill(0); p.visible.fill(0); }
  revealAround(state, 0, cx, cy, 9);
  setRelation(state, 0, 1, "war");
  createUnit(state, "cavalry", 0, cx + 6, cy + 3);
  for (const [x, y] of [[cx + 3, cy], [cx - 6, cy - 4]] as const) {
    const t = getTile(state.map, x, y)!;
    if (t.terrain === Terrain.Ocean) t.terrain = Terrain.Plains;
    createUnit(state, "legion", 1, x, y);
  }
  recomputeVisibility(state, 0);
  return { state, view: { originX: cx - 7, originY: Math.max(0, cy - 6), blink: true }, cx, cy };
}

/** The fine pixels of square (x, y) as drawn. */
function squarePixels(s: Surface, state: GameState, view: MainScreenView, x: number, y: number): number[] {
  const [dx, dy] = tileToScreen(state, view, x, y)!;
  const out: number[] = [];
  for (let j = 0; j < TILE * s.k; j++) for (let i = 0; i < TILE * s.k; i++) out.push(s.fget(dx * s.k + i, dy * s.k + j));
  return out;
}

describe("sight on the map", () => {
  it("shades explored squares out of sight and shows foreign units in sight only", () => {
    const { state, view, cx, cy } = scene();
    const me = state.players[0]!;
    const w = state.map.width;
    const s = Surface.screen();
    drawMainScreen(s, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/sight.png", import.meta.url), encodePng(s, 3));
    expect(me.visible[cy * w + cx + 3]).toBe(1); // the legion beside our land is in sight
    expect(me.visible[(cy - 4) * w + cx - 6]).toBe(0); // the other is not
    // Seen everywhere, the same picture but for the shade.
    const lit = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, visible: new Uint8Array(p.visible.length).fill(1) } : p)) };
    const all = Surface.screen();
    drawMainScreen(all, lit, view);
    const inSight = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!me.visible[(y + dy) * w + x + dx]) return false;
      return true;
    };
    const outOfSight = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (me.visible[(y + dy) * w + x + dx] || !me.explored[(y + dy) * w + x + dx]) return false;
      return !state.cities.some((c) => c.x === x && c.y === y) && !state.units.some((u) => u.x === x && u.y === y);
    };
    let shadedSquares = 0;
    let litSquares = 0;
    for (let y = cy - 5; y <= cy + 5; y++)
      for (let x = cx - 6; x <= cx + 6; x++) {
        if (state.units.some((u) => u.x === x && u.y === y)) continue;
        const shown = squarePixels(s, state, view, x, y);
        const bright = squarePixels(all, lit, view, x, y);
        if (inSight(x, y)) { expect(shown).toEqual(bright); litSquares++; }
        else if (outOfSight(x, y)) { expect(shown).toEqual(bright.map((c) => UNSEEN[c]!)); shadedSquares++; }
      }
    expect(litSquares).toBeGreaterThan(10);
    expect(shadedSquares).toBeGreaterThan(5);
    // The legion out of sight is not drawn: its square looks as it would empty, shaded.
    state.units = state.units.filter((u) => !(u.x === cx - 6 && u.y === cy - 4));
    const empty = Surface.screen();
    drawMainScreen(empty, state, view);
    expect(squarePixels(s, state, view, cx - 6, cy - 4)).toEqual(squarePixels(empty, state, view, cx - 6, cy - 4));
  });
});
