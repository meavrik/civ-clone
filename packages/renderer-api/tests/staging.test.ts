import { describe, expect, it } from "vitest";
import { foundCity, landSight, newGame, recomputeVisibility, type City, type UnitStep } from "@civ/core";
import { cityChanges, MotionPlayer, stagedCities, stagedSight } from "../src/index.js";

const step = (unit: number, owner: number, fromX: number, fromY: number, toX: number, toY: number): UnitStep =>
  ({ kind: "step", unit, type: "legion", owner, fromX, fromY, toX, toY });

/** Rome (ours) and Babylon (theirs), as they stood, and the cities after the other civilizations' turns. */
function turn() {
  const s = newGame(2026, { opponents: 1 });
  s.cities = [];
  const rome = foundCity(s, 0, 10, 10, "Rome");
  rome.size = 3;
  const babylon = foundCity(s, 1, 20, 10, "Babylon");
  const before: City[] = structuredClone(s.cities);
  return { s, rome, babylon, before };
}

describe("the cities shown while the other civilizations' turns play back", () => {
  it("change hands as the conqueror's step lands, and grow only once the playback is over", () => {
    const { s, rome, babylon, before } = turn();
    rome.owner = 1;
    rome.size = 2;
    babylon.size = 2;
    const marchIn = step(7, 1, 11, 10, 10, 10);
    const played = [step(7, 1, 12, 10, 11, 10), marchIn];
    const changes = cityChanges(before, s.cities, played);
    expect([...changes]).toEqual([[rome.id, marchIn]]);
    // Still to play: Rome is ours, Babylon as it was.
    const waiting = stagedCities(before, s.cities, changes, () => true);
    expect(waiting.map((c) => [c.name, c.owner, c.size])).toEqual([["Rome", 0, 3], ["Babylon", 1, 1]]);
    // Landed: Rome is theirs; Babylon waits for the end.
    const landed = stagedCities(before, s.cities, changes, () => false);
    expect(landed.map((c) => [c.name, c.owner, c.size])).toEqual([["Rome", 1, 2], ["Babylon", 1, 1]]);
  });

  it("raze a city as the raider's step lands and found one as its settlers' step does", () => {
    const { s, rome, before } = turn();
    s.cities = s.cities.filter((c) => c.id !== rome.id);
    const ur = foundCity(s, 1, 24, 12, "Ur");
    const raid = step(8, s.barbarians, 10, 11, 10, 10);
    const settle = step(9, 1, 23, 12, 24, 12);
    const changes = cityChanges(before, s.cities, [raid, step(9, 1, 22, 12, 23, 12), settle]);
    expect(changes.get(rome.id)).toBe(raid);
    expect(changes.get(ur.id)).toBe(settle);
    const pending = new Set([raid, settle]);
    expect(stagedCities(before, s.cities, changes, (a) => pending.has(a as UnitStep)).map((c) => c.name)).toEqual(["Rome", "Babylon"]);
    pending.delete(raid);
    expect(stagedCities(before, s.cities, changes, (a) => pending.has(a as UnitStep)).map((c) => c.name)).toEqual(["Babylon"]);
    pending.delete(settle);
    expect(stagedCities(before, s.cities, changes, (a) => pending.has(a as UnitStep)).map((c) => c.name)).toEqual(["Babylon", "Ur"]);
  });

  it("leave a change no step shows (out of sight, a diplomat's revolt) for the playback's end", () => {
    const { s, rome, before } = turn();
    rome.owner = 1;
    const changes = cityChanges(before, s.cities, [step(7, 1, 30, 30, 31, 30)]);
    expect(changes.size).toBe(0);
    expect(stagedCities(before, s.cities, changes, () => false).find((c) => c.id === rome.id)!.owner).toBe(0);
  });

  it("keep a fallen city's sight until it falls, and nothing more than was seen", () => {
    const { s, rome, before } = turn();
    recomputeVisibility(s, 0);
    const sawBefore = s.players[0]!.visible.slice();
    const w = s.map.width;
    const ours = landSight(s, 0);
    rome.owner = 1;
    recomputeVisibility(s, 0);
    const now = s.players[0]!.visible;
    expect(now[rome.y * w + rome.x]).toBe(0);
    const sight = stagedSight({ ...s, cities: before }, 0, now, sawBefore);
    for (const i of ours) expect(sight[i]).toBe(sawBefore[i]);
    // Once it has fallen, the shade falls with it.
    expect(stagedSight(s, 0, now, sawBefore)).toEqual(now);
  });
});

describe("a step or fight still playing", () => {
  it("is playing while queued or under way, and not once it has landed or the playback is cleared", () => {
    const m = new MotionPlayer();
    const pace = { stepMs: 100, maxMs: 1000, width: 80 };
    const first = step(1, 1, 4, 5, 5, 5);
    const second = step(1, 1, 5, 5, 6, 5);
    m.play([first, second], 0, pace);
    expect(m.playing(second, 50)).toBe(true);
    expect(m.playing(first, 150)).toBe(false);
    expect(m.playing(second, 150)).toBe(true);
    expect(m.playing(second, 200)).toBe(false);
    expect(m.playing(step(1, 1, 5, 5, 6, 5), 50)).toBe(false);
    m.play([first], 300, pace);
    m.clear();
    expect(m.playing(first, 300)).toBe(false);
  });
});
