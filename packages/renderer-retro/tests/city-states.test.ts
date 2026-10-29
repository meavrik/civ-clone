import { mkdirSync, writeFileSync } from "node:fs";
import { applyCommand, newGame, type GameState } from "@civ/core";
import { cityStateDemandCard, type MainScreenView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawMainScreen, drawMenu, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

/** A new game with city-states, our first city founded and every square seen. */
function game(): GameState {
  const s = newGame(7, { opponents: 3, cityStates: true });
  applyCommand(s, { type: "found", unit: s.activeUnit! });
  s.players[0]!.explored.fill(1);
  s.players[0]!.visible.fill(1);
  return s;
}

describe("city-states on screen", () => {
  it("stand on the map under their own names, and demand tribute in a window", () => {
    const s = game();
    const rome = s.cities.find((c) => c.owner === 0)!;
    const near = s.cities.filter((c) => c.cityState !== undefined).sort((a, b) => Math.abs(a.x - rome.x) + Math.abs(a.y - rome.y) - (Math.abs(b.x - rome.x) + Math.abs(b.y - rome.y)))[0]!;
    const view: MainScreenView = { originX: Math.min(rome.x, near.x) - 3, originY: Math.max(0, Math.min(rome.y, near.y) - 3), blink: false, placeNames: false };
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const map = Surface.screen();
    drawMainScreen(map, s, view);
    writeFileSync(new URL("./out/city-state-map.png", import.meta.url), encodePng(map, 3));
    s.players[0]!.gold = 120;
    const card = cityStateDemandCard(s, { kind: "cityStateDemand", from: near.id, name: near.name, player: 0, gold: 40, target: rome.name }, 0);
    const w = Surface.screen();
    drawMainScreen(w, s, view);
    drawMenu(w, { title: card.title, body: card.lines, items: card.buttons, selected: card.buttons.length - 1 });
    writeFileSync(new URL("./out/city-state-demand.png", import.meta.url), encodePng(w, 3));
    expect(card.buttons).toHaveLength(2);
  });
});
