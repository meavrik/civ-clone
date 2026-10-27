import { describe, expect, it } from "vitest";
import { applyCommand, foundCity, goldScale, newGame, setBordersOpen, setRelation, Terrain, type GameState, type Relation } from "@civ/core";
import { AUDIENCE_CHOICES, civCard, giftAmounts, giftThanks, giftWeight, resourcesReport, talkButtons, talkLabel, talkTopics, TALK_SUBJECT, type TalkMemo, type TalkTone, type TalkTopic } from "../src/index.js";

/** Us (0) and civilization 1, standing as `relation`, knowing `advances`, with 100 gold. */
function talkGame(relation: Relation, advances: string[] = []): GameState {
  const s = newGame(2026, { opponents: 2 });
  setRelation(s, 0, 1, relation);
  s.players[0]!.advances.push(...advances);
  s.players[0]!.gold = 100;
  return s;
}

const labels = (s: GameState, memo: TalkMemo, swap = false) =>
  talkButtons(talkTopics(s, 0, 1, memo, swap), memo).map((b) => talkLabel(s, 0, 1, b, memo));

describe("a talk with a foreign leader", () => {
  it("opens a first meeting with peace, a gift, war and a parting in peace", () => {
    const s = talkGame("contact");
    expect(labels(s, { said: [], first: true })).toEqual(["Propose peace", "Give gold", "Declare war", "Part in peace"]);
  });

  it("never offers to break a treaty just signed, nor war after a gift", () => {
    const s = talkGame("contact");
    setRelation(s, 0, 1, "peace");
    const memo: TalkMemo = { said: ["peace"], tone: "friendly", subject: "propose", first: true };
    expect(labels(s, memo)).toEqual(["Give gold", "Part in peace"]);
    memo.said.push("gold");
    expect(labels(s, memo)).toEqual(["Part in peace"]);
  });

  it("offers open borders only once a treaty is signed, and never an exchange of maps", () => {
    const s = talkGame("contact", ["writing"]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["peace"]);
    setRelation(s, 0, 1, "peace");
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["openBorders"]);
  });

  it("offers gifts of gold by our treasury, weighed by what gold is worth to them", () => {
    expect(giftAmounts(5)).toEqual([]);
    expect(giftAmounts(30)).toEqual([10]);
    expect(giftAmounts(100)).toEqual([10, 20, 50]);
    expect(giftAmounts(1000)).toEqual([100, 250, 500]);
    const s = talkGame("peace");
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toEqual(["gold"]);
    s.players[0]!.gold = 5;
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toEqual([]);
    const scale = goldScale(s, 1);
    expect(giftWeight(s, 1, Math.floor(scale / 4))).toBe("modest");
    expect(giftWeight(s, 1, scale)).toBe("generous");
    expect(giftWeight(s, 1, 2 * scale)).toBe("lavish");
    expect(giftThanks(s, 1, "lavish")).toMatch(/will not forget it/);
  });

  it("follows the thread: after a proposal, the other proposals come first; after a demand, only demands", () => {
    const s = talkGame("peace", ["writing", "trade"]);
    expect(labels(s, { said: [] }, true)).toEqual(["Make a proposal", "Offer a gift", "Make demands", "Farewell"]);
    const friendly: TalkMemo = { said: ["knowledge"], tone: "friendly", subject: "propose" };
    expect(labels(s, friendly, true)).toEqual(["Open borders", "Give gold", "Give an advance", "Farewell"]);
    const hostile: TalkMemo = { said: ["tribute"], tone: "hostile", subject: "demand" };
    expect(labels(s, hostile, true)).toEqual(["Break the treaty", "Farewell"]);
  });

  it("closes open borders as a demand, never right after opening them", () => {
    const s = talkGame("peace", ["writing"]);
    setBordersOpen(s, 0, 1, true);
    expect(talkTopics(s, 0, 1, { said: [] }, false).demand).toContain("closeBorders");
    expect(talkTopics(s, 0, 1, { said: ["openBorders"], tone: "friendly" }, false).demand).toEqual([]);
  });

  it("trades strategic resources with Currency: a trade they would make, a gift they lack, and calling ours off", () => {
    const s = talkGame("peace", ["currency"]);
    for (const t of s.map.tiles) { Object.assign(t, { terrain: Terrain.Grassland, special: false }); delete t.deposit; }
    s.cities = [];
    foundCity(s, 0, 10, 10);
    foundCity(s, 1, 30, 10);
    expect(talkTopics(s, 0, 1, { said: [] }, false, true).propose).toEqual(["resources"]);
    expect(talkTopics(s, 0, 1, { said: [] }, false, false).propose).toEqual([]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).not.toContain("resource");
    Object.assign(s.map.tiles[11 * s.map.width + 11]!, { special: true, deposit: "Iron" });
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toContain("resource");
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" }).ok).toBe(true);
    expect(talkTopics(s, 0, 1, { said: [] }, false).demand).toContain("endTrade");
    expect(labels(s, { said: ["tribute"], tone: "hostile", subject: "demand" })).toContain("End our trade");
    expect(civCard(s, 1, "friendly").at(-1)).toBe("Resources: none. We trade them our Iron.");
    const report = resourcesReport(s);
    expect(report.lines[0]).toMatchObject({ text: "Horses", right: "none", dim: true });
    expect(report.lines[2]).toMatchObject({ text: "Iron", right: "all traded away", dim: true });
    expect(report.lines.at(-1)).toMatchObject({ text: "Trade: our Iron, a gift" });
    // Without Currency, or at war, none of it.
    s.players[0]!.advances = [];
    expect(talkTopics(s, 0, 1, { said: [] }, false, true).propose).toEqual([]);
  });

  it("at war offers peace and farewell, no gifts or tribute", () => {
    const s = talkGame("war", ["writing", "trade"]);
    expect(labels(s, { said: [] }, true)).toEqual(["Propose peace", "Farewell"]);
    expect(labels(s, { said: ["peace"], subject: "propose" }, true)).toEqual(["Farewell"]);
  });

  it("never shows more than four buttons, nor a demand in a friendly talk or an offer in a hostile one", () => {
    const tones: (TalkTone | undefined)[] = [undefined, "friendly", "hostile"];
    const knowledge = [[], ["writing"], ["trade"], ["writing", "trade"]];
    const s = talkGame("contact");
    const start = [...s.players[0]!.advances];
    for (const relation of ["contact", "peace", "war"] as Relation[])
      for (const advances of knowledge)
        for (const tone of tones)
          for (const open of [false, true])
            for (const swap of [false, true]) {
              setRelation(s, 0, 1, relation);
              s.players[0]!.advances = [...start, ...advances];
              setBordersOpen(s, 0, 1, open && relation === "peace");
              for (const subject of [undefined, "propose", "gift", "demand"] as const) {
                const memo: TalkMemo = { said: [], tone, subject };
                const buttons = talkButtons(talkTopics(s, 0, 1, memo, swap), memo);
                expect(buttons.length).toBeLessThanOrEqual(AUDIENCE_CHOICES);
                expect(buttons.at(-1)).toEqual({ farewell: true });
                const topics = buttons.flatMap((b) => ("topic" in b ? [b.topic] : []));
                const kinds = new Set(topics.map((t: TalkTopic) => TALK_SUBJECT[t]));
                if (tone === "friendly") expect(kinds.has("demand")).toBe(false);
                if (tone === "hostile") expect(kinds.has("propose") || kinds.has("gift")).toBe(false);
              }
            }
  });
});
