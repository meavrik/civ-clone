import { mkdirSync, writeFileSync } from "node:fs";
import { applyCommand, lastTurnEvents, newGame, type GameState } from "@civ/core";
import { treasuryOutlook, treasuryWarning, unsupportedNotice, type MainScreenView, type MenuState } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { BAD, drawMainScreen, drawMenu, GOOD, statusPartAt, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

/** Our first city, built up past what its taxes pay for. */
function spending(gold: number): GameState {
  const state = newGame(5, { opponents: 2 });
  applyCommand(state, { type: "found", unit: state.units[0]!.id });
  state.cities[0]!.buildings.push("temple", "city_walls", "granary", "barracks");
  const me = state.players[0]!;
  me.gold = gold;
  return state;
}

/** The map round our city. */
function around(state: GameState): MainScreenView {
  const c = state.cities[0]!;
  return { originX: c.x - 7, originY: Math.max(0, c.y - 6), blink: false, placeNames: false, civNames: false };
}

/** The colours drawn on the panel's treasury row. */
function rowInks(s: Surface, state: GameState): Set<number> {
  const spot = [...Array(200).keys()].map((y) => statusPartAt(state, 20, y)).find((p) => p?.part === "gold")!;
  const inks = new Set<number>();
  for (let y = spot.y; y < spot.y + spot.h; y++) for (let x = 0; x < 80; x++) inks.add(s.get(x, y));
  return inks;
}

describe("the treasury on the panel", () => {
  it("shows what the gold gains or loses a turn beside it, in green or red, and the gold red once it runs dry soon", () => {
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const state = spending(3);
    const cam = around(state);
    expect(treasuryOutlook(state, 0).net).toBeLessThan(0);
    const s = Surface.screen();
    drawMainScreen(s, state, cam);
    writeFileSync(new URL("./out/treasury-losing.png", import.meta.url), encodePng(s, 3));
    expect(rowInks(s, state).has(BAD)).toBe(true);
    // Taxes that cover the upkeep: a green gain.
    state.cities[0]!.buildings = ["palace"];
    state.players[0]!.gold = 120;
    const g = Surface.screen();
    drawMainScreen(g, state, cam);
    writeFileSync(new URL("./out/treasury-gaining.png", import.meta.url), encodePng(g, 3));
    const inks = rowInks(g, state);
    expect(treasuryOutlook(state, 0).net).toBeGreaterThan(0);
    expect(inks.has(GOOD)).toBe(true);
    expect(inks.has(BAD)).toBe(false);
  });

  it("draws the warning and the notice of buildings unsupported as the game's windows", () => {
    const state = spending(2);
    const w = treasuryWarning(state, 0)!;
    const warn: MenuState = { title: w.title, body: w.lines, items: ["Tax Rates", "Continue"], selected: 0 };
    const s = Surface.screen();
    drawMainScreen(s, state, around(state));
    drawMenu(s, warn);
    writeFileSync(new URL("./out/treasury-warning.png", import.meta.url), encodePng(s, 3));

    state.players[0]!.gold = 0;
    applyCommand(state, { type: "endTurn" });
    state.currentPlayer = 0;
    const notice = unsupportedNotice(state, lastTurnEvents.filter((e) => e.kind === "unsupported"), 0);
    const n = Surface.screen();
    drawMainScreen(n, state, around(state));
    drawMenu(n, { title: notice.title, body: notice.lines, items: [], selected: 0, close: true });
    writeFileSync(new URL("./out/treasury-unsupported.png", import.meta.url), encodePng(n, 3));
    expect(notice.lines.length).toBeGreaterThan(3);
  });
});
