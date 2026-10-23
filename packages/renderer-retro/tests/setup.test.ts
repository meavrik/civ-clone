import { existsSync, writeFileSync } from "node:fs";
import { LEADER_PORTRAITS, setupCards, setupMenu, type SetupState } from "@civ/renderer-api";
import { CIVS } from "@civ/core";
import { describe, expect, it } from "vitest";
import { drawSetupScreen, setupCardAt, setupPictureSpots } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const setup = (step: SetupState["step"], extra: Partial<SetupState> = {}): SetupState =>
  ({ step, world: null, historical: false, custom: null, difficulty: 2, opponents: 6, civ: "romans", ...extra });

describe("setup cards", () => {
  it("has the user's picture for every level's ruler and every tribe's leader, and a place for each on screen", () => {
    const file = (name: string) => existsSync(new URL(`../../../apps/web/src/portraits/${name}.webp`, import.meta.url));
    for (const c of CIVS.filter((c) => c.id !== "barbarians")) expect(file(LEADER_PORTRAITS[c.id] ?? ""), c.id).toBe(true);
    const levels = setupCards(setup("difficulty"))!;
    for (const card of levels.cards) expect(file(card.portrait), card.portrait).toBe(true);
    expect(setupPictureSpots(levels, 0).map((p) => p.portrait)).toEqual(levels.cards.map((c) => c.portrait));
    // The tribes: every card, and the selected one large in the panel.
    const tribes = setupCards(setup("civ"))!;
    const spots = setupPictureSpots(tribes, 3);
    expect(spots).toHaveLength(tribes.cards.length + 1);
    expect(spots.at(-1)!.portrait).toBe(tribes.cards[3]!.portrait);
    for (const p of spots) expect(p.x >= 0 && p.y >= 0 && p.x + p.w <= 320 && p.y + p.h <= 200, p.portrait).toBe(true);
  });

  it("draws difficulty and the tribes as cards, each answering to a click; the count stays a list", () => {
    const s = Surface.screen();
    for (const [st, file, sel] of [[setup("difficulty"), "setup-difficulty", 0], [setup("civ"), "setup-tribes", 0], [setup("civ", { world: "europe", historical: true }), "setup-tribes-europe", 3]] as const) {
      const cards = setupCards(st)!;
      // The cards are the menu's items, in its order.
      expect(cards.cards.map((c) => c.label)).toEqual(setupMenu(st).items);
      drawSetupScreen(s, cards, sel, 5000);
      writeFileSync(new URL(`./out/${file}.png`, import.meta.url), encodePng(s, 3));
      const hits = new Set<number>();
      for (let y = 0; y < 200; y += 2) for (let x = 0; x < 320; x += 2) hits.add(setupCardAt(cards, x, y));
      for (let i = 0; i < cards.cards.length; i++) expect(hits.has(i), cards.cards[i]!.label).toBe(true);
    }
    expect(setupCards(setup("opponents"))).toBeNull();
    expect(setupCards(setup("size"))).toBeNull();
  });
});
