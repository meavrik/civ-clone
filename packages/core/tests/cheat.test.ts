import { describe, expect, it } from "vitest";
import { ADVANCES, applyCommand, CHEAT_GOLD, createUnit, hasContact, lastTurnEvents, loadSave, makeSave, newGame, productionCost, type Command } from "../src/index.js";

function skipAll(state: Parameters<typeof applyCommand>[0]): void {
  let guard = 0;
  while (state.activeUnit !== null && guard++ < 100) applyCommand(state, { type: "skip", unit: state.activeUnit });
}

describe("debug menu cheats", () => {
  it("reveal the map, add gold and meet everyone", () => {
    const state = newGame(11, { opponents: 3 });
    const me = state.players[0]!;
    expect(me.explored.every((e) => e === 1)).toBe(false);
    expect(applyCommand(state, { type: "cheat", cheat: "revealMap" }).ok).toBe(true);
    expect(me.explored.every((e) => e === 1)).toBe(true);

    const gold = me.gold;
    applyCommand(state, { type: "cheat", cheat: "gold" });
    expect(me.gold).toBe(gold + CHEAT_GOLD);

    applyCommand(state, { type: "cheat", cheat: "contact" });
    for (const p of state.players) if (p.id !== 0 && p.id !== state.barbarians) expect(hasContact(state, 0, p.id)).toBe(true);
    expect(Object.keys(state.relations).some((k) => k.split(":").includes(String(state.barbarians)))).toBe(false);
  });

  it("finish research, then learn everything", () => {
    const state = newGame(12, { opponents: 1 });
    const me = state.players[0]!;
    applyCommand(state, { type: "research", advance: "alphabet" });
    applyCommand(state, { type: "cheat", cheat: "research" });
    expect(me.advances).toContain("alphabet");
    expect(me.researching).toBeNull();
    expect(lastTurnEvents.some((e) => e.kind === "chooseResearch")).toBe(true);

    applyCommand(state, { type: "cheat", cheat: "allAdvances" });
    expect(me.advances.length).toBe(ADVANCES.length);
    expect(applyCommand(state, { type: "cheat", cheat: "research" }).ok).toBe(false);
  });

  it("finish production and restore units", () => {
    const state = newGame(13, { opponents: 1 });
    const settler = state.units.find((u) => u.owner === 0)!;
    applyCommand(state, { type: "found", unit: settler.id });
    const city = state.cities.find((c) => c.owner === 0)!;
    applyCommand(state, { type: "cheat", cheat: "production" });
    expect(city.shields).toBeGreaterThanOrEqual(productionCost(city.production));

    const unit = createUnit(state, "militia", 0, city.x, city.y);
    applyCommand(state, { type: "skip", unit: unit.id });
    expect(unit.movesLeft).toBe(0);
    applyCommand(state, { type: "cheat", cheat: "moves" });
    expect(unit.movesLeft).toBeGreaterThan(0);
    expect(state.activeUnit).not.toBeNull();
  });

  it("replay from a save", () => {
    const opts = { opponents: 1 as const };
    const state = newGame(14, opts);
    const log: Command[] = [];
    const run = (cmd: Command) => { if (applyCommand(state, cmd).ok) log.push(cmd); };
    run({ type: "cheat", cheat: "revealMap" });
    run({ type: "cheat", cheat: "gold" });
    run({ type: "found", unit: state.units[0]!.id });
    run({ type: "cheat", cheat: "production" });
    skipAll(state);
    run({ type: "endTurn" });
    while (state.currentPlayer !== 0) { skipAll(state); applyCommand(state, { type: "endTurn" }); }
    const { state: again } = loadSave(makeSave(state, opts, log), skipAll);
    expect(again.players[0]!.gold).toBe(state.players[0]!.gold);
    expect(Array.from(again.players[0]!.explored)).toEqual(Array.from(state.players[0]!.explored));
    expect(JSON.stringify(again.cities)).toBe(JSON.stringify(state.cities));
    expect(JSON.stringify(again.units)).toBe(JSON.stringify(state.units));
  });
});
