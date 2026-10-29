import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, newGame, setRelation, type GameState } from "@civ/core";
import { acceptsPeace, allianceAnswer, alliancePrice, allianceRefusal, attitude, pactAnswer } from "../src/index.js";

/** The player (0) and two computer leaders, all met, no treaties, no armies. */
function court(): GameState {
  const s = newGame(11, { opponents: 2 });
  s.units = [];
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]] as const) setRelation(s, a, b, "contact");
  return s;
}

const army = (s: GameState, owner: number, n: number) => { for (let i = 0; i < n; i++) createUnit(s, "legion", owner, 5 + owner * 10, 5); };

describe("a leader's answer to a pact", () => {
  it("is yes unless hostile or at war", () => {
    const s = court();
    expect(attitude(s, 1, 0)).not.toBe("hostile");
    expect(pactAnswer(s, 1, 0)).toBe(true);
    applyCommand(s, { type: "declareWar", player: 1 });
    expect(pactAnswer(s, 1, 0)).toBe(false);
  });
});

describe("a leader's answer to an alliance", () => {
  it("joins a war it already fights, asks for gold or refuses one it does not, by mood and strength", () => {
    const s = court();
    // Equal and friendly, not yet at war with the enemy: yes.
    expect(attitude(s, 1, 0)).toBe("friendly");
    expect(allianceAnswer(s, 1, 0, 2)).toBe("yes");
    // An enemy stronger than both together: no.
    army(s, 2, 4);
    expect(allianceRefusal(s, 1, 0, 2)).toBe("weak");
    expect(allianceAnswer(s, 1, 0, 2)).toBe("no");
    // Already at war with it: yes whatever the odds.
    setRelation(s, 1, 2, "war");
    expect(allianceAnswer(s, 1, 0, 2)).toBe("yes");
    // Bound to the enemy by a pact: no.
    setRelation(s, 1, 2, "contact");
    s.pacts = { "1:2": s.turn + 5 };
    expect(allianceRefusal(s, 1, 0, 2)).toBe("bound");
    expect(alliancePrice(s, 1, 0, 2)).toBeGreaterThanOrEqual(10);
  });

  it("keeps an ally in the war: no separate peace with the enemy", () => {
    const s = court();
    applyCommand(s, { type: "ally", player: 1, against: 2 });
    expect(acceptsPeace(s, 1, 2)).toBe(false);
    // The enemy, far the weaker, would take peace with anyone else.
    expect(acceptsPeace(s, 2, 1)).toBe(true);
  });
});
