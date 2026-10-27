import { atPeace, atWar, bordersOpen, civ, civInfluence, esteem, exportable, GOVERNMENTS, hasResource, resourceHoldings, tradesOf, tradeSides, trespassers, type GameState } from "@civ/core";

/**
 * The audience with a foreign leader (redone 2026-10-22, asked for, after the user's mock-up "Caesar
 * Welcomes You to Rome"): the realm's name across the top, the leader in their palace, then the
 * leader's name, their words and our choices as buttons, never more than `AUDIENCE_CHOICES` at once.
 */
export const AUDIENCE_CHOICES = 4;

/** How a leader regards us (the AI's `attitude`): the audience window takes its colour and names it. */
export type LeaderMood = "friendly" | "wary" | "hostile";
export const MOOD_WORDS: Record<LeaderMood, string> = { friendly: "Friendly", wary: "Wary", hostile: "Hostile" };

export interface DiplomacyView {
  player: number;
  /** The leader's words. */
  line: string;
  /** The leader's mood toward us, shown as the window's colour and a word (asked for 2026-10-24); absent, the window is plain navy. */
  mood?: LeaderMood;
  /** Our choices, as buttons under the words (at most AUDIENCE_CHOICES); none, and any key goes on. */
  choices?: string[];
  selected?: number;
  /**
   * A civilization's card (the menu bar's Diplomacy tab): these lines beside the leader's portrait,
   * in place of the palace; `line` is then how we stand with them.
   */
  card?: string[];
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
}

/**
 * What the Diplomacy tab's card says of civilization `player`: who leads them and their realm, their
 * trait, their government, capital and size, what they make of our influence, their mood toward us
 * (`mood`, the AI's `attitude`), and whether their units stand on our land.
 */
export function civCard(state: GameState, player: number, mood: "friendly" | "wary" | "hostile"): string[] {
  const me = state.currentPlayer;
  const p = state.players[player]!;
  const c = civ(p.civ);
  const cities = state.cities.filter((x) => x.owner === player);
  const capital = cities.find((x) => x.buildings.includes("palace"));
  const regard = esteem(state, player, me);
  const onOurLand = trespassers(state, me, player).length;
  const goods = state.noResources ? null : resourceHoldings(state, player).filter((h) => h.own > 0).map((h) => h.id);
  return [
    `${c.leader} leads the ${c.name}: ${realmName(state, player)}.`,
    ...(c.trait ? [`${c.trait.name}: ${c.trait.text}`] : []),
    `${GOVERNMENTS[p.government]?.name ?? p.government}; capital ${capital?.name ?? "none"}. ${cities.length} ${cities.length === 1 ? "city" : "cities"}, ${p.advances.length} advances, ${p.gold} gold.`,
    `Influence ${civInfluence(state, player)}: they ${regard === "admired" ? "admire ours" : regard === "scorned" ? "scorn ours" : "weigh ours little either way"}.`,
    `They are ${mood} toward us.`,
    onOurLand ? `${onOurLand} of their units stand on our land.` : "None of their units stand on our land.",
    ...(goods ? [`Resources: ${goods.length ? goods.join(", ") : "none"}.${tradeWords(state, me, player)}`] : []),
  ];
}

/** Our trades of resources with `player`, in a few words: " We trade our Iron for their Horses." */
export function tradeWords(state: GameState, me: number, player: number): string {
  const parts = tradesOf(state, me, player).map((t) => {
    const { gives, gets } = tradeSides(t, me);
    return gives && gets ? `our ${gives} for their ${gets}` : gives ? `them our ${gives}` : `us their ${gets}`;
  });
  return parts.length ? ` We trade ${parts.join("; ")}.` : "";
}

/** What a realm is called under each government. */
const REALM: Record<string, string> = {
  anarchy: "Lands", despotism: "Empire", monarchy: "Kingdom", communism: "Union", republic: "Republic", democracy: "Republic",
};

/** The realm of civilization `player` by its government: "The Roman Empire", "The English Kingdom". */
export function realmName(state: GameState, player: number): string {
  const p = state.players[player]!;
  return `The ${civ(p.civ).adjective} ${REALM[p.government] ?? "Empire"}`;
}

/** Its leader, as the audience names them: "Caesar of the Romans". */
export function leaderTitle(state: GameState, player: number): string {
  const c = civ(state.players[player]!.civ);
  return `${c.leader} of the ${c.name}`;
}

/**
 * A talk with a foreign leader is a conversation (redone 2026-10-25, asked for: a choice answered by
 * buttons for its opposite was "very confusing"; "should be a smooth logical flow of talk between
 * civs"). Each button is something we say; the leader's answer becomes their words and the buttons
 * after it follow from it: nothing already said, no demand or war once the talk has turned friendly
 * (a treaty, a deal, a gift), no proposal or gift once it has turned hostile (a demand), nothing that
 * needs a treaty before there is one. What we may say falls under three subjects: proposals (peace;
 * with Writing maps and open borders, at peace; with Trade knowledge), gifts (gold; with Trade an
 * advance) and demands (their units off our land, tribute with Writing, closing borders, war).
 */
export type TalkSubject = "propose" | "gift" | "demand";
export type TalkTopic = "peace" | "maps" | "openBorders" | "knowledge" | "resources" | "gold" | "advance" | "resource" | "leave" | "tribute" | "closeBorders" | "endTrade" | "war";
export type TalkTone = "friendly" | "hostile";

/** What a talk remembers: what we have said, the turn it has taken, the subject last talked of. */
export interface TalkMemo {
  said: TalkTopic[];
  tone?: TalkTone | undefined;
  subject?: TalkSubject | undefined;
  /** A first meeting: we part in peace. */
  first?: boolean | undefined;
}

/** A button of the talk: something to say, a subject that opens as its own list, or the farewell. */
export type TalkButton = { topic: TalkTopic } | { subject: TalkSubject } | { farewell: true };

/** The gold we may give in an audience (and to be let stay on a leader's land). */
export const GIFT_GOLD = 50;

export const TALK_SUBJECT: Record<TalkTopic, TalkSubject> = {
  peace: "propose", maps: "propose", openBorders: "propose", knowledge: "propose", resources: "propose",
  gold: "gift", advance: "gift", resource: "gift",
  leave: "demand", tribute: "demand", closeBorders: "demand", endTrade: "demand", war: "demand",
};

const SUBJECTS: readonly TalkSubject[] = ["propose", "gift", "demand"];

/**
 * What `me` may say to `them` now, by subject (`swap`: they would trade knowledge, the AI's `tradeAsk`;
 * `goods`: they would let us have a strategic resource, the AI's `resourceOffers`). Peace while there is
 * no treaty; maps and open borders only at peace; no gift at war. With Currency, resources: a trade, a
 * gift of one they lack, and calling off the trades we have.
 */
export function talkTopics(state: GameState, me: number, them: number, memo: TalkMemo, swap: boolean, goods = false): Record<TalkSubject, TalkTopic[]> {
  const us = state.players[me]!;
  const they = state.players[them]!;
  const knows = (id: string) => us.advances.includes(id);
  const war = atWar(state, me, them);
  const peace = atPeace(state, me, them);
  const open = bordersOpen(state, me, them);
  const fresh = (list: [TalkTopic, boolean][]) => list.filter(([t, ok]) => ok && !memo.said.includes(t)).map(([t]) => t);
  const coins = !state.noResources && knows("currency");
  return {
    propose: memo.tone === "hostile" ? [] : fresh([
      ["peace", !peace],
      ["maps", peace && knows("writing")],
      ["openBorders", peace && knows("writing") && !open],
      ["knowledge", !war && knows("trade") && swap],
      ["resources", !war && coins && goods],
    ]),
    gift: memo.tone === "hostile" || war ? [] : fresh([
      ["gold", us.gold >= GIFT_GOLD],
      ["advance", knows("trade") && us.advances.some((a) => !they.advances.includes(a))],
      ["resource", coins && exportable(state, me).some((id) => !hasResource(state, them, id))],
    ]),
    demand: memo.tone === "friendly" ? [] : fresh([
      ["leave", trespassers(state, me, them).length > 0],
      ["tribute", !war && knows("writing")],
      ["closeBorders", open],
      ["endTrade", tradesOf(state, me, them).length > 0],
      ["war", !war],
    ]),
  };
}

/**
 * The talk's buttons, never more than `AUDIENCE_CHOICES`, the farewell last: each subject's topics
 * spread out where they fit, else the subject as one button. The subject just talked of spreads first,
 * so the talk follows its thread; then proposals, gifts, demands.
 */
export function talkButtons(topics: Record<TalkSubject, TalkTopic[]>, memo: TalkMemo): TalkButton[] {
  const live = SUBJECTS.filter((s) => topics[s].length);
  const spread = new Set(live.filter((s) => topics[s].length === 1));
  let count = live.length + 1;
  const thread = memo.subject && live.includes(memo.subject) ? [memo.subject, ...live.filter((s) => s !== memo.subject)] : live;
  for (const s of thread) {
    if (spread.has(s) || count + topics[s].length - 1 > AUDIENCE_CHOICES) continue;
    spread.add(s);
    count += topics[s].length - 1;
  }
  return [...live.flatMap((s): TalkButton[] => spread.has(s) ? topics[s].map((topic) => ({ topic })) : [{ subject: s }]), { farewell: true }];
}

export const SUBJECT_LABEL: Record<TalkSubject, string> = { propose: "Make a proposal", gift: "Offer a gift", demand: "Make demands" };

/** What we say with a topic's button. */
export function topicLabel(state: GameState, me: number, them: number, topic: TalkTopic): string {
  switch (topic) {
    case "peace": return "Propose peace";
    case "maps": return "Exchange maps";
    case "openBorders": return "Open borders";
    case "knowledge": return "Trade knowledge";
    case "resources": return "Trade resources";
    case "resource": return "Give a resource";
    case "endTrade": return "End our trade";
    case "gold": return `Give ${GIFT_GOLD} gold`;
    case "advance": return "Give an advance";
    case "leave": return "Demand they leave our land";
    case "tribute": return "Demand tribute";
    case "closeBorders": return "Close borders";
    case "war": return atPeace(state, me, them) ? "Break the treaty" : "Declare war";
  }
}

/** A button's words. */
export function talkLabel(state: GameState, me: number, them: number, button: TalkButton, memo: TalkMemo): string {
  if ("topic" in button) return topicLabel(state, me, them, button.topic);
  if ("subject" in button) return SUBJECT_LABEL[button.subject];
  return memo.first && !atWar(state, me, them) ? "Part in peace" : "Farewell";
}

/** The leader's words as a subject opens: what do we propose, bring or demand? */
export const SUBJECT_WORDS: Record<TalkSubject, Record<LeaderMood, string>> = {
  propose: { friendly: "We are listening, friend. What do you propose?", wary: "Speak. We are listening.", hostile: "Say what you came to say, and be brief." },
  gift: { friendly: "A gift between friends? Show us.", wary: "A gift? Let us see it.", hostile: "Gifts will not buy our favour. But show us." },
  demand: { friendly: "Demands? We had thought you a friend.", wary: "Demands? Speak them, then.", hostile: "You dare make demands of us?" },
};

/** The leader's words when we speak of war (a treaty broken, or war declared), before we say it. */
export function warWarning(treaty: boolean, mood: LeaderMood): string {
  if (treaty) return "Break our treaty? Then your word is worth nothing, and it is war.";
  return mood === "friendly" ? "War? We had thought you a friend. There is no unsaying it."
    : mood === "wary" ? "War? Think well: there is no unsaying it."
    : "War? We have waited for this.";
}
