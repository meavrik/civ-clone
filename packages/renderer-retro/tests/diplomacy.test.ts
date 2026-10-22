import { writeFileSync } from "node:fs";
import { CIVS, newGame } from "@civ/core";
import { AUDIENCE_CHOICES, LEADER_PORTRAITS } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { diplomacyChoiceAt, drawDiplomacyScreen, loadScene, SCENE_NAMES } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

describe("audience screen", () => {
  it("has a scene for every playable civilization's leader", () => {
    for (const c of CIVS.filter((c) => c.id !== "barbarians")) expect(SCENE_NAMES, c.id).toContain(LEADER_PORTRAITS[c.id]);
  });

  it("shows the realm, the leader in their palace, their words and up to four choices that answer to clicks", async () => {
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
      // Before its scene has loaded the leader's portrait stands in; then the scene.
      drawDiplomacyScreen(s, state, { player: 1, line: "Greetings. What brings you to our court?", choices: [...choices], selected: 0 });
      if (id === "romans") writeFileSync(new URL("./out/audience-loading.png", import.meta.url), encodePng(s, 3));
      expect(await loadScene(name)).toBeDefined();
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
