import { describe, expect, it } from "vitest";
import { foundCity, newGame, type GameState, type UnitAction, type UnitBattle, type UnitStep } from "@civ/core";
import { ANNOUNCE_MS, fightReport, MotionPlayer, OUTCOME_MS, SETTLE_MS, travelMs, WATCH_BUDGET_MS, WATCH_PACE, watchMs, watchTurn, type WatchOptions } from "../src/index.js";

const step = (unit: number, owner: number, fromX: number, fromY: number, toX: number, toY: number): UnitStep =>
  ({ kind: "step", unit, type: "legion", owner, fromX, fromY, toX, toY });

const fight = (s: GameState, attackerWon: boolean, at: [number, number], alsoLost: number[] = []): UnitBattle => ({
  kind: "battle",
  attacker: { unit: 50, type: "legion", owner: s.barbarians, x: at[0] - 1, y: at[1], hp: 10, maxHp: 10, firepower: 1, xp: 0 },
  defender: { unit: 51, type: "phalanx", owner: 0, x: at[0], y: at[1], hp: 10, maxHp: 10, firepower: 1, xp: 0 },
  rounds: attackerWon ? [true, true] : [false, false],
  attackerWon,
  alsoLost,
});

/** The camera on squares 0..14 x 0..10, everything seen. */
function setup(): { s: GameState; o: WatchOptions } {
  const s = newGame(2026, { opponents: 1 });
  return { s, o: { viewer: 0, camera: { originX: 0, originY: 0, tilesX: 15, tilesY: 11 }, seen: () => true, glideMs: 280 } };
}

describe("watching the other civilizations' turns", () => {
  it("follows an enemy off screen, slowly, and plays a peaceful civilization's moves only where the map looks", () => {
    const { s, o } = setup();
    const enemy = [step(1, s.barbarians, 30, 20, 31, 20), step(1, s.barbarians, 31, 20, 32, 21)];
    const beats = watchTurn(s, [...enemy, step(2, 1, 5, 5, 6, 5), step(3, 1, 33, 22, 34, 22), step(4, 1, 60, 40, 61, 40)], o);
    expect(beats.map((b) => b.kind)).toEqual(["hold", "play", "play"]);
    expect(beats[0]).toEqual({ kind: "hold", ms: 280 + SETTLE_MS, centre: { x: 31, y: 21 } });
    expect(beats[1]).toMatchObject({ actions: enemy, timing: WATCH_PACE.threat });
    // The camera went to the enemy (squares 24..38 x 16..26): the peaceful unit at (5, 5) is off screen now, the one at (33, 22) on it.
    expect(beats[2]).toMatchObject({ actions: [step(3, 1, 33, 22, 34, 22)], timing: WATCH_PACE.other });
  });

  it("stays put for an enemy already well on screen, and leaves out steps nobody saw", () => {
    const { s, o } = setup();
    const seen = (x: number) => x < 8;
    const beats = watchTurn(s, [step(1, s.barbarians, 5, 5, 6, 5), step(1, s.barbarians, 6, 5, 7, 5), step(1, s.barbarians, 8, 5, 9, 5), step(1, s.barbarians, 9, 5, 10, 5)], { ...o, seen });
    expect(beats).toHaveLength(1);
    expect(beats[0]!.kind === "play" && beats[0]!.actions.map((a) => (a as UnitStep).toX)).toEqual([6, 7]);
  });

  it("announces a fight with our unit beside the attacker, then says beside ours what came of it", () => {
    const { s, o } = setup();
    const lost = fight(s, true, [5, 5]);
    expect(watchTurn(s, [lost], o)).toEqual([
      { kind: "hold", ms: ANNOUNCE_MS, note: { x: 4, y: 5, text: "Barbarian Legion attacks!" } },
      { kind: "play", actions: [lost], timing: { ...WATCH_PACE.threat, width: s.map.width, walkMs: travelMs } },
      { kind: "hold", ms: OUTCOME_MS, note: { x: 5, y: 5, text: "Phalanx destroyed" } },
    ]);
    // Far off: the camera glides there while the announcement stands.
    const held = fight(s, false, [40, 30], []);
    const beats = watchTurn(s, [held], o);
    expect(beats[0]).toMatchObject({ ms: 280 + SETTLE_MS + ANNOUNCE_MS, centre: { x: 40, y: 30 }, note: { text: "Barbarian Legion attacks!" } });
    expect(beats[2]).toMatchObject({ note: { text: "Phalanx holds!" } });
    expect(watchTurn(s, [fight(s, true, [5, 5], [7, 8])], o)[2]).toMatchObject({ note: { text: "Phalanx and 2 more lost" } });
  });

  it("tells the turn's fights in a few lines, the same fight once with a count", () => {
    const { s } = setup();
    const rome = foundCity(s, 0, 10, 10);
    const lines = fightReport(s, [fight(s, true, [12, 10]), fight(s, true, [12, 10]), fight(s, false, [10, 10]), fight(s, true, [60, 40], [9])], 0);
    expect(lines).toEqual([
      `{swords} A Barbarian Legion destroyed our Phalanx near ${rome.name} (x2).`,
      `{swords} Our Phalanx in ${rome.name} beat off a Barbarian Legion.`,
      "{swords} A Barbarian Legion destroyed our Phalanx and 1 more.",
    ]);
    const many = Array.from({ length: 9 }, (_, i) => fight(s, true, [40, 30], Array.from({ length: i }, (_, k) => 100 + k)));
    const told = fightReport(s, many, 0, 4);
    expect(told).toHaveLength(4);
    expect(told[3]).toBe("{swords} And 6 more fights.");
  });

  it("names a seasoned attacker's rank, and tells of a rank our unit won", () => {
    const { s, o } = setup();
    const rome = foundCity(s, 0, 10, 10);
    const base = fight(s, false, [10, 10]);
    const held: UnitBattle = { ...base, attacker: { ...base.attacker, xp: 6 }, promoted: "veteran" };
    const notes = watchTurn(s, [held], o).flatMap((b) => (b.kind === "hold" && b.note ? [b.note.text] : []));
    expect(notes).toEqual(["Hardened Barbarian Legion attacks!", "Phalanx holds, now Veteran!"]);
    expect(fightReport(s, [held], 0)).toEqual([`{swords} Our Phalanx in ${rome.name} beat off a Barbarian Legion, now Veteran.`]);
    const won: UnitBattle = { ...base, attacker: { ...base.defender, owner: 0, x: 9 }, defender: { ...base.attacker, owner: s.barbarians, x: 10 }, attackerWon: true, promoted: "elite" };
    expect(fightReport(s, [won], 0)[0]).toMatch(/^\{swords\} Our Phalanx defeated a Barbarian Legion .*, now Elite\.$/);
  });

  it("speeds up a long turn to fit, but never past a little under three times as fast", () => {
    const { s, o } = setup();
    const busy: UnitAction[] = [];
    for (let u = 0; u < 30; u++) for (let i = 0; i < 6; i++) busy.push(step(100 + u, s.barbarians, (u * 9 + i) % 80, (u * 7) % 50, (u * 9 + i + 1) % 80, (u * 7) % 50));
    const ms = watchMs(watchTurn(s, busy, o));
    expect(ms).toBeLessThanOrEqual(WATCH_BUDGET_MS + 30 * 280);
    expect(ms).toBeGreaterThan(WATCH_BUDGET_MS / 2);
  });
});

describe("holds in the motion", () => {
  it("hold the map between moves, say where the camera goes and what the note says, then go on", () => {
    const m = new MotionPlayer();
    const pace = { stepMs: 100, maxMs: 1000, width: 80 };
    m.hold(300, 0, { centre: { x: 4, y: 5 }, note: { x: 4, y: 5, text: "Look" } });
    m.play([step(1, 0, 4, 5, 5, 5)], 0, pace);
    const first = m.at(10);
    expect(first.hold).toMatchObject({ centre: { x: 4, y: 5 }, note: { text: "Look" } });
    // The unit waits on its square while the map holds.
    expect(first.moving).toEqual([{ unit: 1, type: "legion", owner: 0, x: 4, y: 5 }]);
    expect(m.at(350).hold).toBeUndefined();
    expect(m.at(350).moving[0]!.x).toBeCloseTo(4.5);
    m.hold(100, 400);
    expect(m.at(450).hold!.seq).toBeGreaterThan(first.hold!.seq);
    expect(m.busy(499)).toBe(true);
    expect(m.busy(500)).toBe(false);
  });
});
