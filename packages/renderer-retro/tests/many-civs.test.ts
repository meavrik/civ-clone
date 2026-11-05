import { mkdirSync, writeFileSync } from "node:fs";
import { CIV_COLORS, createUnit, foundCity, MAX_CIVS, newGame, setRelation, type GameState } from "@civ/core";
import { describe, expect, it } from "vitest";
import { C, drawForeignAdvisor, drawScoreScreen, drawSpaceshipScreen, drawUnit, PLAYER_COLORS, SCREEN_H, SCREEN_W, Surface, DETAIL } from "../src/index.js";
import { encodePng } from "./png.js";

/** A game of `civs`, every rival met, with a city and an army, the worst lists a page has to hold. */
function met(civs: number): GameState {
  const s = newGame(7, { size: "medium", opponents: civs - 1 });
  for (const p of s.players) {
    if (p.id !== 0 && p.id !== s.barbarians) setRelation(s, 0, p.id, p.id % 3 ? "peace" : "war");
    if (p.id === s.barbarians) continue;
    const u = s.units.find((x) => x.owner === p.id)!;
    createUnit(s, "militia", p.id, u.x, u.y);
    p.gold = 12345;
    s.players[p.id]!.advances.push("writing");
    foundCity(s, p.id, u.x, u.y);
    if (p.id !== 0 && p.id % 2) s.players[p.id]!.spaceship.structurals = 1;
  }
  s.currentPlayer = 0;
  return s;
}

function page(draw: (s: Surface, state: GameState) => void, state: GameState, name: string): Surface {
  const s = new Surface(SCREEN_W, SCREEN_H, undefined, DETAIL);
  draw(s, state);
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/${name}.png`, import.meta.url), encodePng(s, 2));
  return s;
}

/** The rows of the page's list that differ between a game with these rivals and one with fewer. */
function rowsDiffering(a: Surface, b: Surface, from: number): number[] {
  const out = new Set<number>();
  const fine = SCREEN_W * a.k;
  for (let i = from * a.k * fine; i < a.data.length; i++) if (a.data[i] !== b.data[i]) out.add(Math.floor(i / fine / a.k));
  return [...out];
}

describe("the pages that list every civilization, in the largest games", () => {
  it("the Foreign Minister's page holds nine rivals above its foot", () => {
    const nine = page(drawForeignAdvisor, met(MAX_CIVS), "foreign-nine");
    const none = page(drawForeignAdvisor, { ...met(MAX_CIVS), relations: {} }, "foreign-none");
    const changed = rowsDiffering(nine, none, 0);
    expect(changed.length).toBeGreaterThan(0);
    expect(Math.max(...changed)).toBeLessThan(SCREEN_H - 30);
  });

  it("keeps two lines a rival while they fit", () => {
    const six = page(drawForeignAdvisor, met(7), "foreign-six");
    const none = page(drawForeignAdvisor, { ...met(7), relations: {} }, "foreign-six-none");
    expect(Math.max(...rowsDiffering(six, none, 0))).toBeLessThan(SCREEN_H - 30);
  });

  it("the race for space names all nine rivals, in two columns", () => {
    const state = met(MAX_CIVS);
    const nine = page(drawSpaceshipScreen, state, "spaceship-nine");
    // The ninth rival's row: gone without it, and nothing below the page's foot.
    const last = state.players.filter((p) => p.id !== 0 && p.id !== state.barbarians).at(-1)!;
    const fewer = { ...state, players: state.players.map((p) => (p.id === last.id ? { ...p, alive: false } : p)) };
    const eight = page(drawSpaceshipScreen, fewer, "spaceship-eight");
    const changed = rowsDiffering(nine, eight, 100);
    expect(changed.length).toBeGreaterThan(0);
    expect(Math.max(...changed)).toBeLessThan(SCREEN_H - 14);
  });

  it("the score page holds all ten civilizations above its foot", () => {
    const state = met(MAX_CIVS);
    const ten = page(drawScoreScreen, state, "score-ten");
    const last = state.players.filter((p) => p.id !== state.barbarians).at(-1)!;
    const fewer = { ...state, players: state.players.map((p) => (p.id === last.id ? { ...p, alive: false } : p)) };
    const nine = page(drawScoreScreen, fewer, "score-nine");
    expect(Math.max(...rowsDiffering(ten, nine, 100))).toBeLessThan(SCREEN_H - 13);
  });
});

describe("the colours of the largest games", () => {
  it("draws a unit under every colour, new ones with a darker partner of their own", () => {
    const state = newGame(2, { opponents: 2 });
    const unit = state.units[0]!;
    expect(PLAYER_COLORS.length).toBe(CIV_COLORS.length);
    const s = new Surface(8 + PLAYER_COLORS.length * 34, 40, undefined, DETAIL);
    s.fill(C.BLACK!);
    PLAYER_COLORS.forEach((color, i) => {
      s.rect(4 + i * 34, 2, 32, 32, 30);
      drawUnit(s, { ...unit, type: "militia", order: { kind: "none" }, xp: 0 }, 4 + i * 34, 2, color, false);
    });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/civ-colors-all.png", import.meta.url), encodePng(s, 3));
  });
});
