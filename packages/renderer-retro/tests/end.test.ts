import { mkdirSync, writeFileSync } from "node:fs";
import { aiTurn } from "@civ/ai";
import { newGame, runAiPlayers, type GameState } from "@civ/core";
import { endCard } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawEndScreen, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

/** A game the computer players have played for `turns` rounds. */
function played(turns: number): GameState {
  const state = newGame(3, { allAi: true, opponents: 3 });
  while (state.turn < turns) runAiPlayers(state, aiTurn);
  return state;
}

describe("the end screen", () => {
  it("tells a fallen civilization's whole history, not its ruin", () => {
    const state = played(120);
    const p = state.players.find((x) => x.id !== state.barbarians && (x.chronicle?.founded ?? 0) > 0)!;
    const before = structuredClone(p.chronicle);
    // Its cities gone, its history stands.
    state.cities = state.cities.filter((c) => c.owner !== p.id);
    const card = endCard(state, { kind: "defeat" }, p.id);
    expect(p.chronicle).toEqual(before);
    expect(card.title).toBe("Civilization Fallen");
    expect(card.headline).toBe("Your civilization has been destroyed.");
    expect(card.span).toMatch(new RegExp(`^The ${p.name}, \\d+ BC to `));
    const row = (label: string) => card.rows.find((r) => r.label === label)?.value;
    expect(row("Cities founded")).toBe(String(before!.founded));
    expect(row("Largest realm")).toMatch(/^\d+ cit(y|ies)$/);
    expect(row("Most citizens")).toBe(String(before!.peakCitizens));
    expect(row("Advances")).toBe(String(p.advances.length));
    expect(card.verdict).toMatch(/^At its height, your rule was \w+\.$/);
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const s = Surface.screen();
    drawEndScreen(s, card);
    writeFileSync(new URL("./out/end-fallen.png", import.meta.url), encodePng(s, 3));

    // A reign that runs to its end: the final score and the rank.
    const time = endCard(played(60), { kind: "time" }, 0);
    expect(time.title).toBe("The End");
    expect(time.verdict).toMatch(/^Final score \d+\. Your rule was \w+\.$/);
    const t = Surface.screen();
    drawEndScreen(t, time);
    writeFileSync(new URL("./out/end-time.png", import.meta.url), encodePng(t, 3));
  });
});
