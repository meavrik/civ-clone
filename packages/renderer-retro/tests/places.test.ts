import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newGame, recomputeVisibility, type GameState } from "@civ/core";
import { drawMainScreen, Surface, type MainScreenView } from "../src/index.js";
import { encodePng } from "./png.js";

/** Earth with every square explored and seen, the view on the Mediterranean. */
function earth(): { state: GameState; view: MainScreenView } {
  const state = newGame(2026, { world: "earth", historical: true, opponents: 4 });
  const me = state.players[0]!;
  me.explored.fill(1);
  recomputeVisibility(state, 0);
  me.visible.fill(1);
  return { state, view: { originX: 27, originY: 8, blink: true } };
}

describe("place names on the map", () => {
  it("writes the names of seas, lands and landforms, and none when they are turned off", () => {
    const { state, view } = earth();
    const named = Surface.screen();
    drawMainScreen(named, state, view);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/places.png", import.meta.url), encodePng(named, 3));
    const bare = Surface.screen();
    drawMainScreen(bare, state, { ...view, placeNames: false });
    let differ = 0;
    for (let i = 0; i < named.data.length; i++) if (named.data[i] !== bare.data[i]) differ++;
    expect(differ).toBeGreaterThan(200);
  });
});
