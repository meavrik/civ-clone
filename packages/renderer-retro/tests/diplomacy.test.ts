import { existsSync, writeFileSync } from "node:fs";
import { CIVS, newGame } from "@civ/core";
import { AUDIENCE_CHOICES, LEADER_PORTRAITS } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { audiencePicture, audienceRect, diplomacyChoiceAt, drawDiplomacyScreen, shade } from "../src/index.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

describe("audience screen", () => {
  it("has the user's picture for every playable civilization's leader, and room for it at 16 by 9", () => {
    for (const c of CIVS.filter((c) => c.id !== "barbarians"))
      expect(existsSync(new URL(`../../../apps/web/src/scenes/${LEADER_PORTRAITS[c.id]}.webp`, import.meta.url)), c.id).toBe(true);
    expect(audiencePicture().w / audiencePicture().h).toBeCloseTo(1672 / 941, 2);
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

  it("colours the window by the leader's mood and names it: green friendly, amber wary, red hostile, navy with none", () => {
    const state = newGame(3, { opponents: 2 });
    const s = Surface.screen();
    const o = audienceRect();
    const fills = { friendly: shade("leaf", 2), wary: shade("hide", 2), hostile: shade("brick", 1) } as const;
    for (const mood of ["friendly", "wary", "hostile"] as const) {
      drawDiplomacyScreen(s, state, { player: 1, line: "Greetings.", mood, choices: ["Farewell"] });
      writeFileSync(new URL(`./out/audience-${mood}.png`, import.meta.url), encodePng(s, 3));
      // The title strip's corner and the panel's inside take the mood's colour; the picture's frame a lighter shade of it.
      expect(s.get(o.x + 3, o.y + 12)).toBe(fills[mood]);
      expect(s.get(o.x + 5, o.y + 128)).toBe(fills[mood]);
      expect(s.get(o.x + 35, o.y + 14)).not.toBe(shade("panel", 1));
      // The word stands at the strip's left, in a light ink of the same ramp.
      let ink = 0;
      for (let y = o.y + 4; y < o.y + 12; y++) for (let x = o.x + 6; x < o.x + 60; x++) if (s.get(x, y) !== fills[mood]) ink++;
      expect(ink).toBeGreaterThan(8); // thin strokes, read a screen pixel at a time: "WARY" paints about twenty
    }
    drawDiplomacyScreen(s, state, { player: 1, line: "Greetings.", choices: ["Farewell"] });
    expect(s.get(o.x + 3, o.y + 12)).toBe(shade("azure", 0));
  });
});
