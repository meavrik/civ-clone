import { writeFileSync } from "node:fs";
import { LEADER_PORTRAITS, setupCards, setupMenu, type SetupState } from "@civ/renderer-api";
import { CIVS } from "@civ/core";
import { describe, expect, it } from "vitest";
import { drawSetupScreen, setupCardAt } from "../src/index.js";
import { PORTRAIT_SHEET, RULER_SHEET } from "../src/sprites/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const setup = (step: SetupState["step"], extra: Partial<SetupState> = {}): SetupState =>
  ({ step, world: null, historical: false, custom: null, difficulty: 2, opponents: 6, civ: "romans", ...extra });

describe("setup cards", () => {
  it("has a portrait for every level's ruler and every tribe's leader", () => {
    for (const c of CIVS.filter((c) => c.id !== "barbarians")) expect(PORTRAIT_SHEET.byName.has(LEADER_PORTRAITS[c.id] ?? ""), c.id).toBe(true);
    for (const card of setupCards(setup("difficulty"))!.cards) expect(RULER_SHEET.byName.has(card.portrait), card.portrait).toBe(true);
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
