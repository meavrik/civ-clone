import { describe, expect, it } from "vitest";
import { applyCommand, foundCity, goldScale, newGame, setBordersOpen, setRelation, Terrain, type GameState, type Relation } from "@civ/core";
import { allianceTargets, AUDIENCE_CHOICES, civCard, dealCard, dealEmpty, dealHas, dealItemLabel, dealItems, giftAmounts, perTurnAmounts, standing, giftThanks, giftWeight, resourcesReport, resourcesView, talkButtons, talkDanger, talkLabel, talkTopics, TALK_SUBJECT, toggleDeal, type DealItem, type TalkMemo, type TalkTone, type TalkTopic } from "../src/index.js";

/** Us (0) and civilization 1, standing as `relation`, knowing `advances`, with 100 gold. */
function talkGame(relation: Relation, advances: string[] = []): GameState {
  const s = newGame(2026, { opponents: 2 });
  setRelation(s, 0, 1, relation);
  s.players[0]!.advances.push(...advances);
  s.players[0]!.gold = 100;
  return s;
}

const labels = (s: GameState, memo: TalkMemo, exchange = false) =>
  talkButtons(talkTopics(s, 0, 1, memo, exchange), memo).map((b) => talkLabel(s, 0, 1, b, memo));

describe("a talk with a foreign leader", () => {
  it("opens a first meeting with proposals (peace, a pact), a gift, war and a parting in peace", () => {
    const s = talkGame("contact");
    // A gift is always Offer a gift, opening what to give (asked for 2026-10-31: a lone "Give gold" said nothing of why).
    expect(labels(s, { said: [], first: true })).toEqual(["Make a proposal", "Offer a gift", "Declare war", "Part in peace"]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["peace", "pact"]);
  });

  it("never offers to break a treaty just signed, nor war after a gift", () => {
    const s = talkGame("contact");
    setRelation(s, 0, 1, "peace");
    const memo: TalkMemo = { said: ["peace"], tone: "friendly", subject: "propose", first: true };
    expect(labels(s, memo)).toEqual(["Non-aggression pact", "Offer a gift", "Part in peace"]);
    memo.said.push("pact", "gold");
    // An advance of ours they lack is a gift still to give.
    s.players[0]!.advances = s.players[1]!.advances.slice();
    expect(labels(s, memo)).toEqual(["Part in peace"]);
  });

  it("offers open borders only once a treaty is signed, and never an exchange of maps", () => {
    const s = talkGame("contact", ["writing"]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["peace", "pact"]);
    setRelation(s, 0, 1, "peace");
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["pact", "openBorders"]);
  });

  it("offers gifts of gold by our treasury, weighed by what gold is worth to them", () => {
    expect(giftAmounts(5)).toEqual([]);
    expect(giftAmounts(30)).toEqual([10]);
    expect(giftAmounts(100)).toEqual([10, 20, 50]);
    expect(giftAmounts(1000)).toEqual([100, 250, 500]);
    const s = talkGame("peace");
    s.players[0]!.advances = s.players[1]!.advances.slice();
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toEqual(["gold"]);
    // Knowledge they lack is a gift too, without Trade (asked for 2026-10-31: "offer a gift ... with also other options").
    s.players[0]!.advances.push("alphabet", "bronze_working", "ceremonial_burial", "pottery", "masonry");
    s.players[1]!.advances = s.players[1]!.advances.filter((a) => a !== "masonry");
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toEqual(["gold", "advance"]);
    s.players[0]!.gold = 5;
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toEqual(["advance"]);
    const scale = goldScale(s, 1);
    expect(giftWeight(s, 1, Math.floor(scale / 4))).toBe("modest");
    expect(giftWeight(s, 1, scale)).toBe("generous");
    expect(giftWeight(s, 1, 2 * scale)).toBe("lavish");
    expect(giftThanks(s, 1, "lavish")).toMatch(/will not forget it/);
  });

  it("follows the thread: after a proposal, the other proposals come first; after a demand, only demands", () => {
    const s = talkGame("peace", ["writing", "trade"]);
    expect(labels(s, { said: [] }, true)).toEqual(["Make a proposal", "Offer a gift", "Make demands", "Farewell"]);
    const friendly: TalkMemo = { said: ["exchange"], tone: "friendly", subject: "propose" };
    expect(labels(s, friendly, true)).toEqual(["Non-aggression pact", "Open borders", "Offer a gift", "Farewell"]);
    expect(talkTopics(s, 0, 1, { said: [] }, true).propose).toEqual(["pact", "openBorders", "exchange"]);
    const hostile: TalkMemo = { said: ["tribute"], tone: "hostile", subject: "demand" };
    expect(labels(s, hostile, true)).toEqual(["Break the treaty", "Farewell"]);
  });

  it("marks war, every demand and the demands as a subject red, nothing else", () => {
    const red = (Object.keys(TALK_SUBJECT) as TalkTopic[]).filter((topic) => talkDanger({ topic }));
    expect(red.sort()).toEqual(["closeBorders", "endTrade", "leave", "tribute", "war"]);
    expect(talkDanger({ subject: "demand" })).toBe(true);
    expect(talkDanger({ subject: "propose" })).toBe(false);
    expect(talkDanger({ subject: "gift" })).toBe(false);
    expect(talkDanger({ farewell: true })).toBe(false);
  });

  it("closes open borders as a demand, never right after opening them", () => {
    const s = talkGame("peace", ["writing"]);
    setBordersOpen(s, 0, 1, true);
    expect(talkTopics(s, 0, 1, { said: [] }, false).demand).toContain("closeBorders");
    expect(talkTopics(s, 0, 1, { said: ["openBorders"], tone: "friendly" }, false).demand).toEqual([]);
  });

  it("trades strategic resources with Currency: a gift they lack, an exchange, and calling ours off", () => {
    const s = talkGame("peace", ["currency"]);
    for (const t of s.map.tiles) { Object.assign(t, { terrain: Terrain.Grassland, special: false }); delete t.deposit; }
    s.cities = [];
    foundCity(s, 0, 10, 10);
    foundCity(s, 1, 30, 10);
    expect(talkTopics(s, 0, 1, { said: [] }, true).propose).toEqual(["pact", "exchange"]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["pact"]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).not.toContain("resource");
    Object.assign(s.map.tiles[11 * s.map.width + 11]!, { special: true, deposit: "Iron", road: true });
    expect(talkTopics(s, 0, 1, { said: [] }, false).gift).toContain("resource");
    expect(applyCommand(s, { type: "tradeResources", player: 1, give: "Iron" }).ok).toBe(true);
    expect(talkTopics(s, 0, 1, { said: [] }, false).demand).toContain("endTrade");
    expect(labels(s, { said: ["tribute"], tone: "hostile", subject: "demand" })).toContain("End our trade");
    expect(civCard(s, 1, "friendly").at(-1)).toEqual({ title: "Resources", lines: ["None. We trade them our Iron."] });
    const report = resourcesReport(s);
    expect(report.lines[0]).toMatchObject({ text: "Horses", right: "none", dim: true });
    expect(report.lines[2]).toMatchObject({ text: "Iron", right: "all traded away", dim: true });
    expect(report.lines.at(-1)).toMatchObject({ text: "Trade: our Iron, a gift" });
    // The Resources window (redone 2026-10-31): a badge for each, where it stands, the units needing it, our trades.
    const view = resourcesView(s, 0);
    expect(view.entries.map((e) => [e.id, e.status])).toEqual([["Horses", "none"], ["Iron", "away"], ["Saltpeter", "unseen"], ["Coal", "none"], ["Oil", "unseen"]]);
    expect(view.entries[1]).toMatchObject({ badge: "Traded away", detail: `All traded to the ${s.players[1]!.name}` });
    expect(view.entries[1]!.units).toContain("legion");
    expect(view.entries[2]!.detail).toBe("Shows on the map with Gunpowder");
    expect(view.trades).toEqual([expect.objectContaining({ player: 1, text: `Our Iron to the ${s.players[1]!.name}, a gift`, gold: 0 })]);
    // Paid for by the turn, it says so, and counts toward the trades' gold a turn.
    s.resourceTrades![0]!.pay = 3;
    expect(resourcesView(s, 0)).toMatchObject({ income: 3, trades: [{ text: `Our Iron to the ${s.players[1]!.name}`, gold: 3 }] });
    expect(resourcesView(s, 1).income).toBe(-3);
    // Our own square of it, held: Iron back on our land with a road, the trade off.
    s.resourceTrades = [];
    expect(resourcesView(s, 0).entries[1]).toMatchObject({ status: "held", badge: "Held", detail: "1 square near " + s.cities[0]!.name });
    s.map.tiles[11 * s.map.width + 11]!.road = false;
    expect(resourcesView(s, 0).entries[1]).toMatchObject({ status: "road", badge: "Wants road" });
    // At war, none of it.
    setRelation(s, 0, 1, "war");
    expect(talkTopics(s, 0, 1, { said: [] }, true).propose).toEqual(["peace"]);
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
            for (const exchange of [false, true]) {
              setRelation(s, 0, 1, relation);
              s.players[0]!.advances = [...start, ...advances];
              setBordersOpen(s, 0, 1, open && relation === "peace");
              for (const subject of [undefined, "propose", "gift", "demand"] as const) {
                const memo: TalkMemo = { said: [], tone, subject };
                const buttons = talkButtons(talkTopics(s, 0, 1, memo, exchange), memo);
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

describe("pacts and alliances in a talk", () => {
  it("offer a pact and an alliance against a civilization both know, and no war on a partner", () => {
    const s = talkGame("contact");
    expect(allianceTargets(s, 0, 1)).toEqual([]);
    setRelation(s, 0, 2, "contact");
    setRelation(s, 1, 2, "contact");
    expect(allianceTargets(s, 0, 1)).toEqual([2]);
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual(["peace", "pact", "alliance"]);
    expect(applyCommand(s, { type: "makePact", player: 1 }).ok).toBe(true);
    const topics = talkTopics(s, 0, 1, { said: [] }, false);
    expect(topics.propose).toEqual(["peace", "alliance"]);
    expect(topics.demand).not.toContain("war");
    expect(standing(s, 1, true).text).toBe("Non-aggression pact, 20 turns left");
    expect(standing(s, 1).text).toBe("Pact");
    // Our own pact with a civilization keeps it off the list of enemies.
    expect(allianceTargets(s, 0, 2)).toEqual([]);
    applyCommand(s, { type: "ally", player: 1, against: 2 });
    expect(talkTopics(s, 0, 1, { said: [] }, false).propose).toEqual([]);
    expect(standing(s, 1, true).text).toBe(`Allies against the ${s.players[2]!.name}`);
    expect(standing(s, 2).text).toBe("WAR");
  });

  it("lays out a civilization's card in sections: realm, toward us, their trait, resources", () => {
    const s = talkGame("peace");
    s.cities = [];
    foundCity(s, 1, 30, 10, "Babylon").size = 3;
    foundCity(s, 1, 36, 10, "Ur");
    const card = civCard(s, 1, "wary");
    expect(card.map((c) => c.title)).toEqual(["Realm", "Toward us", expect.any(String), "Resources"]);
    // Their government and capital, no more (asked for 2026-10-31: not their cities, advances or gold).
    expect(card[0]!.lines).toEqual([expect.stringMatching(/^\{crown\} \w+ {2}\{city\} Babylon$/)]);
    expect(card.flatMap((c) => c.lines).join(" ")).not.toMatch(/cities|citizens|advances|gold/);
    expect(card[1]!.lines[0]).toBe("{people} Wary. We are at peace.");
  });
});

describe("an exchange's table", () => {
  it("lists what each side may put on it: gold, with Trade advances, with Currency resources, gold a turn for resources", () => {
    const s = talkGame("peace");
    s.players[0]!.advances = ["alphabet", "bronze_working"];
    s.players[1]!.advances = ["pottery", "bronze_working"];
    s.players[1]!.gold = 60;
    const kinds = (items: DealItem[]) => [...new Set(items.map((i) => i.kind))];
    // Gold alone without Trade.
    expect(dealItems(s, 0, 0, 1, {}, {})).toEqual([{ kind: "gold", gold: 10 }, { kind: "gold", gold: 20 }, { kind: "gold", gold: 50 }]);
    s.players[0]!.advances.push("trade");
    expect(dealItems(s, 0, 0, 1, {}, {}).filter((i) => i.kind === "advance").map((i) => i.kind === "advance" && i.id)).toEqual(["trade", "alphabet"]);
    expect(dealItems(s, 0, 1, 0, {}, {}).filter((i) => i.kind === "advance")).toEqual([{ kind: "advance", id: "pottery" }]);
    expect(kinds(dealItems(s, 0, 1, 0, {}, {}))).toEqual(["gold", "advance"]);
    // Gold a turn only to pay for resources the other side gives.
    expect(kinds(dealItems(s, 0, 0, 1, {}, { resources: ["Iron"] }))).toContain("perTurn");
    expect(perTurnAmounts(s, 1).every((g) => g >= 1)).toBe(true);
  });

  it("puts an item on the table and takes it back, and shows the table beside the leader", () => {
    let give = toggleDeal({}, { kind: "gold", gold: 20 });
    give = toggleDeal(give, { kind: "advance", id: "alphabet" });
    expect(give).toEqual({ gold: 20, advances: ["alphabet"] });
    expect(dealHas(give, { kind: "advance", id: "alphabet" })).toBe(true);
    expect(dealItemLabel({ kind: "advance", id: "alphabet" }, true)).toBe("Take back Alphabet");
    expect(dealItemLabel({ kind: "perTurn", gold: 3 }, false)).toBe("3 gold a turn");
    give = toggleDeal(give, { kind: "gold", gold: 50 });
    expect(give.gold).toBe(50);
    give = toggleDeal(toggleDeal(give, { kind: "gold", gold: 50 }), { kind: "advance", id: "alphabet" });
    expect(give).toEqual({});
    expect(dealEmpty(give, {})).toBe(true);
    const card = dealCard({ gold: 20, resources: ["Iron"] }, { perTurn: 3 });
    expect(card.map((c) => c.title)).toEqual(["We offer", "They give", "Each turn"]);
    expect(card[0]!.lines).toEqual(["{coin} 20 gold", "{trade} Iron"]);
    expect(card[1]!.lines).toEqual(["{purse} 3 gold a turn"]);
    expect(dealCard({}, {})[1]!.lines).toEqual(["Nothing yet"]);
  });
});
