import { describe, expect, it } from "vitest";
import { newGame, revealAround } from "@civ/core";
import { coastLevel, coastPatch, FogLifter, fogLevel, fogPatch, type UnitMotion } from "../src/index.js";

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

  it("thins fog lifting off a square evenly, still solid at the border with fog beside it", () => {
    let checked = 0;
    for (let y = 1; y < map.height - 1 && !checked; y++)
      for (let x = 0; x < map.width; x++) {
        if (!known(x, y) || known(x + 1, y)) continue;
        const lifting = new Map([[y * map.width + x, 0.5]]);
        const p = fogPatch(map, explored, x, y, lifting);
        expect(fogLevel(p, 0.5, 0.5)).toBeCloseTo(0.5, 9);
        expect(fogLevel(p, 1, 0.5)).toBeCloseTo(1, 9);
        // Its drift into the explored square west of it thins with it.
        if (known(x - 1, y)) expect(fogLevel(fogPatch(map, explored, x - 1, y, lifting), 0.97, 0.5)).toBeLessThanOrEqual(0.5 + 1e-9);
        checked++;
        break;
      }
    expect(checked).toBe(1);
  });
});

describe("fog lifting", () => {
  const slide = (x: number, y: number): UnitMotion => ({ unit: 1, type: "settlers", owner: 0, x, y });

  it("fades newly explored squares out, and starts afresh on another game", () => {
    const state = newGame(7);
    const lifter = new FogLifter(700);
    expect(lifter.update(state, 0).size).toBe(0); // what was explored at the start does not lift
    const u = state.units[0]!;
    revealAround(state, 0, u.x + 3, u.y, 1);
    const first = lifter.update(state, 1000);
    expect(first.size).toBeGreaterThan(0);
    for (const left of first.values()) expect(left).toBe(1);
    const mid = [...lifter.update(state, 1350).values()];
    expect(mid.every((v) => v > 0 && v < 1)).toBe(true);
    expect(lifter.update(state, 1700).size).toBe(0);
    expect(lifter.busy()).toBe(false);
    const other = newGame(8);
    revealAround(other, 0, other.units[0]!.x + 3, other.units[0]!.y, 1);
    expect(lifter.update(other, 2000).size).toBe(0);
  });

  it("keeps the fog on squares a sliding unit has yet to reach", () => {
    const state = newGame(7);
    const lifter = new FogLifter(700);
    lifter.update(state, 0);
    const u = state.units[0]!;
    revealAround(state, 0, u.x + 4, u.y, 1);
    const far = lifter.update(state, 100, [slide(u.x, u.y)]);
    expect([...far.values()].every((v) => v === 1)).toBe(true);
    expect(lifter.update(state, 900, [slide(u.x, u.y)]).size).toBe(far.size); // still waiting
    const near = lifter.update(state, 1000, [slide(u.x + 2, u.y)]);
    expect(near.size).toBe(far.size);
    expect(lifter.update(state, 1300, [slide(u.x + 3, u.y)]).size).toBe(far.size);
    // The nearer columns began to fade at 1000, the far one only once the unit came within reach at 1300.
    expect(lifter.update(state, 1800, []).size).toBe(3);
    expect(lifter.update(state, 2100, []).size).toBe(0);
  });
});
