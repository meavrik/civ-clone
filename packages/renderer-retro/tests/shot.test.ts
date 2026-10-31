import { writeFileSync } from "node:fs";
import { createUnit, newGame, Terrain, type GameState, type UnitBattle } from "@civ/core";
import { MotionPlayer, shotOf, strikeMs, type MainScreenView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawMainScreen, shade, tileToScreen, TILE } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const out = (name: string) => new URL(`./out/${name}.png`, import.meta.url);

/** Our catapult beside a foreign phalanx on open grassland, all of it in sight, and the fight between them. */
function field(): { state: GameState; map: MainScreenView; battle: UnitBattle; x: number; y: number } {
  const state = newGame(5, { opponents: 1 });
  const me = state.players[0]!;
  const [x, y] = [30, 25];
  const w = state.map.width;
  for (let j = y - 6; j <= y + 6; j++)
    for (let i = x - 9; i <= x + 9; i++) {
      const idx = j * w + i;
      Object.assign(state.map.tiles[idx]!, { terrain: Terrain.Grassland, special: false, river: false, hut: false, road: false, grassShield: false });
      me.explored[idx] = 1;
      me.visible[idx] = 1;
    }
  state.units = state.units.filter((u) => Math.abs(u.x - x) > 9 || Math.abs(u.y - y) > 6);
  state.cities = state.cities.filter((c) => Math.abs(c.x - x) > 9 || Math.abs(c.y - y) > 6);
  const a = createUnit(state, "catapult", 0, x, y);
  const d = createUnit(state, "phalanx", 1, x + 1, y);
  const battle: UnitBattle = {
    kind: "battle",
    attacker: { unit: a.id, type: "catapult", owner: 0, x, y, hp: 10, maxHp: 10, firepower: 1 },
    defender: { unit: d.id, type: "phalanx", owner: 1, x: x + 1, y, hp: 10, maxHp: 10, firepower: 1 },
    rounds: [true, true, false, true, true, true, true, true, true, true, true],
    attackerWon: true,
    alsoLost: [],
  };
  const map: MainScreenView = { originX: x - 7, originY: y - 5, blink: false, placeNames: false, focus: null };
  return { state, map, battle, x, y };
}

describe("a catapult's shot", () => {
  it("flies as a stone from the catapult in an arc over its shadow, comes down before its foe, and throws up dust", () => {
    const { state, map, battle, x, y } = field();
    const pace = { stepMs: 120, maxMs: 1000, width: state.map.width, battleMs: 1600, battleTotalMs: 1600, strikeMs, shot: shotOf };
    const release = shotOf("catapult")!.releaseMs, land = strikeMs("catapult");
    const [sx, sy] = tileToScreen(state, map, x, y)!;
    // The two squares, a square round them, cut from each moment into one strip.
    const cut = { x: (sx - TILE) * 2, y: (sy - TILE) * 2, w: TILE * 4 * 2, h: TILE * 3 * 2 };
    const moments = [release - 60, release + 10, release + 120, release + 220, release + 330, land + 20, land + 120, land + 240, land + 360];
    const strip = new Surface(cut.w * moments.length / 2, cut.h / 2, undefined, 2);
    const stone = new Set([shade("rock", 0), shade("rock", 2), shade("rock", 3), shade("steel", 7)]);
    const dust = new Set([shade("dune", 2), shade("mound", 6), shade("mound", 4)]);
    const player = new MotionPlayer();
    player.play([battle], 0, pace);
    moments.forEach((t, n) => {
      const frame = player.at(t);
      const s = Surface.screen();
      drawMainScreen(s, state, { ...map, ...(frame.battle ? { battle: frame.battle } : {}) });
      for (let fy = 0; fy < cut.h; fy++) for (let fx = 0; fx < cut.w; fx++) strip.fset(n * cut.w + fx, fy, s.fget(cut.x + fx, cut.y + fy));
      const shot = frame.battle?.shot;
      if (t < release) { expect(shot, `${t} ms`).toBeUndefined(); return; }
      expect(shot, `${t} ms`).toBeDefined();
      const [px, py] = tileToScreen(state, map, shot!.x, shot!.y)!;
      // Round where it is: the stone's greys in flight, the dust's browns once down.
      const near: number[] = [];
      for (let fy = Math.round(py * 2) - 6; fy <= Math.round(py * 2) + 6; fy++) for (let fx = Math.round(px * 2) - 8; fx <= Math.round(px * 2) + 8; fx++) near.push(s.fget(fx, fy));
      if (shot!.landed === 0) expect(near.filter((c) => stone.has(c)).length, `${t} ms`).toBeGreaterThanOrEqual(12);
      else if (shot!.landed < 0.6) expect(near.filter((c) => dust.has(c)).length, `${t} ms`).toBeGreaterThan(4);
    });
    writeFileSync(out("catapult-shot"), encodePng(strip, 4));
    // Always the same picture for the same moment.
    const again = (t: number) => {
      const p = new MotionPlayer();
      p.play([battle], 0, pace);
      const s = Surface.screen();
      drawMainScreen(s, state, { ...map, battle: p.at(t).battle! });
      return s.data;
    };
    expect(again(release + 200)).toEqual(again(release + 200));
  });
});
