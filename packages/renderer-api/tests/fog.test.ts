import { describe, expect, it } from "vitest";
import { newGame, revealAround } from "@civ/core";
import { coastLevel, coastPatch, fogLevel, fogPatch } from "../src/index.js";

describe("fog of war", () => {
  const state = newGame(7);
  const u = state.units[0]!;
  revealAround(state, 0, u.x + 2, u.y + 1, 2);
  const { map } = state;
  const explored = state.players[0]!.explored;
  const known = (x: number, y: number) => explored[y * map.width + ((x + map.width) % map.width)] === 1;

  it("is solid over unexplored squares and at their border, and clear in the middle of explored ones", () => {
    let borders = 0;
    for (let y = 1; y < map.height - 1; y++)
      for (let x = 0; x < map.width; x++) {
        const p = fogPatch(map, explored, x, y);
        if (!known(x, y)) { expect(fogLevel(p, 0.3, 0.7)).toBe(1); continue; }
        expect(fogLevel(p, 0.5, 0.5)).toBe(0);
        if (!known(x + 1, y)) { borders++; expect(fogLevel(p, 1, 0.5)).toBeCloseTo(1, 9); }
      }
    expect(borders).toBeGreaterThan(0);
  });

  it("agrees along the border of two explored squares", () => {
    for (let y = 1; y < map.height - 1; y++)
      for (let x = 0; x < map.width; x++) {
        if (!known(x, y) || !known(x + 1, y)) continue;
        const a = fogPatch(map, explored, x, y);
        const b = fogPatch(map, explored, (x + 1) % map.width, y);
        for (const t of [0.05, 0.3, 0.6, 0.95]) expect(fogLevel(a, 1, t)).toBeCloseTo(fogLevel(b, 0, t), 9);
      }
  });

  it("leaves unexplored squares out of the coast, so the shore beside them gives nothing away", () => {
    const hidden = map.tiles.map((t, i) => (explored[i] ? null : t));
    const levels = () => {
      const out: number[] = [];
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) if (known(x, y)) for (const t of [0.02, 0.5, 0.98]) out.push(coastLevel(coastPatch(map, x, y, explored), t, 0.02));
      return out;
    };
    const before = levels();
    for (const t of hidden) if (t) t.terrain = (t.terrain + 1) % 11;
    expect(levels()).toEqual(before);
  });
});
