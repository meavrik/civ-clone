import { writeFileSync } from "node:fs";
import { setupCards, setupMenu, type SetupState } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { drawSetupScreen, setupCardAt } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const setup = (step: SetupState["step"], extra: Partial<SetupState> = {}): SetupState =>
  ({ step, world: null, historical: false, custom: null, difficulty: 2, opponents: 6, civ: "romans", ...extra });

describe("setup cards", () => {
  it("draws difficulty, the count and the tribes as cards, each answering to a click", () => {
    const s = Surface.screen();
    for (const [st, file, sel] of [[setup("difficulty"), "setup-difficulty", 0], [setup("opponents"), "setup-count", 2], [setup("civ"), "setup-tribes", 0], [setup("civ", { world: "europe", historical: true }), "setup-tribes-europe", 3]] as const) {
      const cards = setupCards(st)!;
      // The cards are the menu's items, in its order.
      expect(cards.cards.length).toBe(setupMenu(st).items.length);
      drawSetupScreen(s, cards, sel, 5000);
      writeFileSync(new URL(`./out/${file}.png`, import.meta.url), encodePng(s, 3));
      const hits = new Set<number>();
      for (let y = 0; y < 200; y += 2) for (let x = 0; x < 320; x += 2) hits.add(setupCardAt(cards, x, y));
      for (let i = 0; i < cards.cards.length; i++) expect(hits.has(i), cards.cards[i]!.label).toBe(true);
    }
    expect(setupCards(setup("size"))).toBeNull();
  });
});
