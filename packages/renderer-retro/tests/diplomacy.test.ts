import { existsSync, writeFileSync } from "node:fs";
import { CIVS, newGame } from "@civ/core";
import { AUDIENCE_CHOICES, LEADER_PORTRAITS } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { AUDIENCE_PICTURE, diplomacyChoiceAt, drawDiplomacyScreen } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

describe("audience screen", () => {
  it("has the user's picture for every playable civilization's leader, and room for it at 16 by 9", () => {
    for (const c of CIVS.filter((c) => c.id !== "barbarians"))
      expect(existsSync(new URL(`../../../apps/web/src/scenes/${LEADER_PORTRAITS[c.id]}.webp`, import.meta.url)), c.id).toBe(true);
    expect(AUDIENCE_PICTURE.w / AUDIENCE_PICTURE.h).toBeCloseTo(1672 / 941, 2);
  });

  it("shows the realm, the leader in their palace, their words and up to four choices that answer to clicks", () => {
    const state = newGame(3, { opponents: 2 });
    const s = Surface.screen();
    const cases = [
      ["romans", "caesar", ["We come in peace.", "Prepare for war!"]],
      ["japanese", "tokugawa", ["Propose peace", "Gifts and trade", "Declare war", "Part in peace"]],
      ["zulus", "shaka", ["Sign the treaty", "Refuse", "Talk more"]],
      ["english", "elizabeth", ["So be it"]],
    ] as const;
    for (const [id, name, choices] of cases) {
      state.players[1]!.civ = id;
      const view = { player: 1, line: `I am ${name}. Shall our peoples meet as friends?`, choices: [...choices], selected: 1 };
      drawDiplomacyScreen(s, state, view);
      writeFileSync(new URL(`./out/audience-${name}.png`, import.meta.url), encodePng(s, 3));
      const hits = new Set<number>();
      for (let y = 140; y < 200; y++) for (let x = 0; x < 320; x++) hits.add(diplomacyChoiceAt(view, x, y));
      for (let i = 0; i < choices.length; i++) expect(hits.has(i), choices[i]).toBe(true);
      expect(hits.has(choices.length)).toBe(false);
    }
    expect(AUDIENCE_CHOICES).toBe(4);
  });
});
