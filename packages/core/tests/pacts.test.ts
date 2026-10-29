import { describe, expect, it } from "vitest";
import {
  alliance,
  allied,
  alliesAgainst,
  applyCommand,
  atWar,
  createUnit,
  foundCity,
  hasPact,
  lastTurnEvents,
  mindsTrespass,
  newGame,
  PACTS,
  pactUntil,
  relation,
  setRelation,
  warBarred,
  type GameState,
} from "../src/index.js";

/** Three civilizations who have all met, no treaties; the player (0) to move. */
function threeCivs(): GameState {
  const s = newGame(7, { opponents: 2 });
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]] as const) setRelation(s, a, b, "contact");
  return s;
}

/** Plays every seat's end of turn until the player is to move again. */
function nextRound(s: GameState): void {
  do applyCommand(s, { type: "endTurn" });
  while (s.currentPlayer !== 0);
}

describe("non-aggression pacts", () => {
  it("bar war on either side until they run out, then say so", () => {
    const s = threeCivs();
    expect(applyCommand(s, { type: "makePact", player: 1 }).ok).toBe(true);
    expect(hasPact(s, 1, 0)).toBe(true);
    expect(pactUntil(s, 0, 1)).toBe(s.turn + PACTS.pactTurns);
    expect(warBarred(s, 0, 1)).toBe("pact");
    expect(applyCommand(s, { type: "declareWar", player: 1 })).toEqual({ ok: false, reason: "pact" });
    expect(atWar(s, 0, 1)).toBe(false);
    // One pact at a time; none at war.
    expect(applyCommand(s, { type: "makePact", player: 1 }).ok).toBe(false);
    applyCommand(s, { type: "declareWar", player: 2 });
    expect(applyCommand(s, { type: "makePact", player: 2 }).ok).toBe(false);
    // Its last turn, then gone with word of it.
    const until = pactUntil(s, 0, 1)!;
    while (s.turn < until - 1) nextRound(s);
    expect(hasPact(s, 0, 1)).toBe(true);
    let ended = false;
    do {
      applyCommand(s, { type: "endTurn" });
      ended ||= lastTurnEvents.some((e) => e.kind === "pactEnded" && e.a === 0 && e.b === 1);
    } while (s.currentPlayer !== 0);
    expect(ended).toBe(true);
    expect(hasPact(s, 0, 1)).toBe(false);
    expect(applyCommand(s, { type: "declareWar", player: 1 }).ok).toBe(true);
  });
});

describe("alliances", () => {
  it("take both allies to war with the enemy, bind them to each other and open their lands", () => {
    const s = threeCivs();
    expect(applyCommand(s, { type: "ally", player: 1, against: 2 }).ok).toBe(true);
    expect(alliance(s, 1, 0)).toEqual({ against: 2, turn: s.turn });
    expect(allied(s, 0, 1)).toBe(true);
    expect(alliesAgainst(s, 0, 2)).toEqual([1]);
    expect(relation(s, 0, 1)).toBe("peace");
    expect(atWar(s, 0, 2) && atWar(s, 1, 2)).toBe(true);
    expect(lastTurnEvents.filter((e) => e.kind === "warDeclared" && e.on === 2).slice(-2)).toEqual([
      { kind: "warDeclared", player: 0, on: 2, reason: "alliance" },
      { kind: "warDeclared", player: 1, on: 2, reason: "alliance" },
    ]);
    expect(applyCommand(s, { type: "declareWar", player: 1 })).toEqual({ ok: false, reason: "allied" });
    expect(mindsTrespass(s, 1, 0)).toBe(false);
  });

  it("are refused against a civilization one side is bound to, or has not met", () => {
    const s = threeCivs();
    applyCommand(s, { type: "makePact", player: 2 });
    expect(applyCommand(s, { type: "ally", player: 1, against: 2 }).ok).toBe(false);
    setRelation(s, 1, 2, "none");
    s.pacts = {};
    expect(applyCommand(s, { type: "ally", player: 1, against: 2 }).ok).toBe(false);
    expect(applyCommand(s, { type: "ally", player: 1, against: 1 }).ok).toBe(false);
  });

  it("end when one ally makes a separate peace, or the enemy falls", () => {
    const s = threeCivs();
    applyCommand(s, { type: "ally", player: 1, against: 2 });
    applyCommand(s, { type: "makePeace", player: 2 });
    expect(allied(s, 0, 1)).toBe(false);
    expect(lastTurnEvents).toContainEqual({ kind: "allianceEnded", a: 0, b: 1, against: 2, by: 0 });
    // Allied again; the enemy's last city and units gone.
    applyCommand(s, { type: "declareWar", player: 2 });
    applyCommand(s, { type: "ally", player: 1, against: 2 });
    expect(allied(s, 0, 1)).toBe(true);
    s.players[2]!.alive = false;
    expect(allied(s, 0, 1)).toBe(false);
    expect(warBarred(s, 0, 1)).toBe(null);
  });

  it("leave the trespass rules alone between civilizations that are not allies", () => {
    const s = threeCivs();
    foundCity(s, 1, 20, 20);
    createUnit(s, "militia", 0, 21, 20);
    expect(mindsTrespass(s, 1, 0)).toBe(true);
    applyCommand(s, { type: "ally", player: 1, against: 2 });
    expect(mindsTrespass(s, 1, 0)).toBe(false);
    expect(mindsTrespass(s, 2, 0)).toBe(false); // at war: fair game, as ever
  });
});
