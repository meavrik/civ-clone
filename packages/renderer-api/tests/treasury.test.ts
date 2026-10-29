import { describe, expect, it } from "vitest";
import { applyCommand, computeCity, foundCity, lastTurnEvents, newGame, type GameState } from "@civ/core";
import { panelTip, treasuryOutlook, treasuryWarning, unsupportedNotice } from "../src/index.js";

/** Rome and Antium paying more upkeep than their taxes bring. */
function spending(gold: number): GameState {
  const s = newGame(2026, { opponents: 1, classicCivs: true });
  s.cities = [];
  const rome = foundCity(s, 0, 10, 10, "Rome");
  const antium = foundCity(s, 0, 16, 10, "Antium");
  rome.buildings.push("temple", "city_walls", "granary");
  antium.buildings.push("barracks", "library");
  const me = s.players[0]!;
  me.gold = gold;
  me.taxRate = 0;
  me.luxRate = 4;
  me.sciRate = 6;
  return s;
}

describe("the treasury's outlook", () => {
  it("counts taxes, upkeep, and the turn's end at which the gold no longer meets the upkeep", () => {
    const s = spending(20);
    const t = treasuryOutlook(s, 0);
    const tax = s.cities.reduce((n, c) => n + computeCity(s, c).tax, 0);
    expect(t).toEqual({ gold: 20, tax, upkeep: 6, net: tax - 6, dryIn: Math.floor(20 / (6 - tax)) + 1 });
    s.players[0]!.gold = 0;
    expect(treasuryOutlook(s, 0).dryIn).toBe(1);
    // Taxes that cover the upkeep: the gold holds.
    s.players[0]!.taxRate = 6;
    s.players[0]!.sciRate = 0;
    s.players[0]!.luxRate = 4;
    s.cities.forEach((c) => (c.buildings = ["palace"]));
    expect(treasuryOutlook(s, 0).dryIn).toBeNull();
  });

  it("warns within three turns, and says what follows by the save's rules", () => {
    const s = spending(0);
    const w = treasuryWarning(s, 0)!;
    expect(w.title).toBe("Treasury Running Dry");
    expect(w.dryAt).toBe(s.turn);
    expect(w.lines[0]).toMatch(/^Our 0 gold cannot pay this turn's upkeep/);
    expect(w.lines[1]).toBe("As the turn ends, buildings stop being supported until the books balance.");
    const net = -treasuryOutlook(s, 0).net;
    s.players[0]!.gold = net * 2;
    expect(treasuryWarning(s, 0)!.lines[0]).toMatch(/runs out in 3 turns/);
    expect(treasuryWarning(s, 0)!.dryAt).toBe(s.turn + 2);
    s.players[0]!.gold = net * 3;
    expect(treasuryWarning(s, 0)).toBeNull();
    s.players[0]!.gold = 0;
    s.sellWhenBroke = true;
    expect(treasuryWarning(s, 0)!.lines[1]).toBe("As the turn ends, a city sells a building to pay.");
    expect(panelTip(s, "gold", null)!.lines).toContain("This turn's upkeep empties it: a city sells a building to pay.");
  });

  it("lists the buildings an empty treasury stopped supporting, city by city, with the upkeep cut", () => {
    const s = spending(0);
    applyCommand(s, { type: "endTurn" });
    const stopped = lastTurnEvents.filter((e) => e.kind === "unsupported");
    expect(stopped.length).toBeGreaterThan(1);
    const notice = unsupportedNotice(s, stopped, 0);
    expect(notice.title).toBe("Buildings Unsupported");
    expect(notice.lines[0]).toBe("Our treasury is empty. To pay the upkeep, these buildings are no longer supported:");
    // Rome's walls first (the most upkeep), then what else it took, Antium's after.
    expect(notice.lines[1]).toMatch(/^\{city\}Rome: City Walls/);
    const cut = stopped.reduce((n, e) => n + (e.upkeep ?? 0), 0);
    expect(notice.lines.at(-2)).toMatch(new RegExp(`^Upkeep cut by ${cut} gold a turn: `));
    expect(notice.lines.at(-1)).toBe("A city's Improvements list supports them again (Use).");
  });
});
