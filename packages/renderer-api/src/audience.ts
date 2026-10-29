import { alliance, allied, atPeace, atWar, bordersOpen, civ, civInfluence, esteem, exportable, goldScale, GOVERNMENTS, hasContact, hasPact, hasResource, pactUntil, relation, resourceHoldings, tradesOf, tradeSides, trespassers, warBarred, type GameState } from "@civ/core";

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
   * A civilization's card (the menu bar's Diplomacy tab): these sections beside the leader's portrait,
   * in place of the palace; `line` is then our envoy's word, or a leader's answer.
   */
  card?: CardSection[];
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
}

/** A part of a civilization's card: a heading over its lines, which may carry `{icon}` tokens. */
export interface CardSection {
  title: string;
  lines: string[];
}

/** How `me` stands with `them`, as the card's treaty line and the Foreign Minister's list say it. */
export type StandingTone = "war" | "contact" | "peace";
export function treaty(state: GameState, me: number, them: number, long = false): { text: string; tone: StandingTone } {
  const r = relation(state, me, them);
  if (r === "war") return { text: long ? "We are at WAR" : "WAR", tone: "war" };
  const al = alliance(state, me, them);
  if (al) return { text: long ? `Allies against the ${state.players[al.against]?.name ?? "enemy"}` : "Allied", tone: "peace" };
  const until = pactUntil(state, me, them);
  const pact = until === undefined ? "" : `${until - state.turn} turn${until - state.turn === 1 ? "" : "s"}`;
  if (r !== "peace") {
    if (pact) return { text: long ? `Non-aggression pact, ${pact} left` : "Pact", tone: "contact" };
    return { text: long ? "No treaty between us" : "No treaty", tone: "contact" };
  }
  const open = bordersOpen(state, me, them);
  const base = long ? (open ? "At peace, our borders open" : "We are at peace") : open ? "Open borders" : "Peace";
  return { text: pact ? (long ? `${base}; a pact, ${pact} left` : `${base}, pact`) : base, tone: "peace" };
}

/** The face beside a leader's mood on the card. */
const MOOD_ICON: Record<LeaderMood, string> = { friendly: "happy", wary: "people", hostile: "unhappy" };

/**
 * What the Diplomacy tab's card says of civilization `player`, in sections (asked for 2026-10-29: "split to
 * sections of civ stats etc. improve content design"): their realm (government, capital, cities,
 * citizens, advances, gold), how they stand toward us (their mood, the AI's `attitude`; our treaty, pact or
 * alliance; what they make of our influence; their units on our land), their people's trait, and their
 * strategic resources with our trades.
 */
export function civCard(state: GameState, player: number, mood: LeaderMood): CardSection[] {
  const me = state.currentPlayer;
  const p = state.players[player]!;
  const c = civ(p.civ);
  const cities = state.cities.filter((x) => x.owner === player);
  const capital = cities.find((x) => x.buildings.includes("palace"));
  const citizens = cities.reduce((n, x) => n + x.size, 0);
  const regard = esteem(state, player, me);
  const onOurLand = trespassers(state, me, player).length;
  const goods = state.noResources ? null : resourceHoldings(state, player).filter((h) => h.own > 0).map((h) => h.id);
  return [
    { title: "Realm", lines: [
      `{crown} ${GOVERNMENTS[p.government]?.name ?? p.government}  {city} ${capital ? capital.name : "No capital"}`,
      `{house} ${plural(cities.length, "city", "cities")}  {people} ${plural(citizens, "citizen")}`,
      `{bulb} ${plural(p.advances.length, "advance")}  {coin} ${p.gold} gold`,
    ] },
    { title: "Toward us", lines: [
      `{${MOOD_ICON[mood]}} ${MOOD_WORDS[mood]}. ${treaty(state, me, player, true).text}.`,
      `{culture} Influence ${civInfluence(state, player)}: they ${regard === "admired" ? "admire ours" : regard === "scorned" ? "scorn ours" : "weigh ours little"}`,
      ...(onOurLand ? [`{boot} ${onOurLand} of their units on our land`] : []),
    ] },
    ...(c.trait ? [{ title: c.trait.name, lines: [c.trait.text] }] : []),
    ...(goods ? [{ title: "Resources", lines: [`${goods.length ? goods.join(", ") : "None"}.${tradeWords(state, me, player)}`] }] : []),
  ];
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** What our envoy says on the card while no leader has answered: whose court it stands at. */
export function envoyLine(state: GameState, player: number): string {
  return `Our envoy stands ready at the court of ${civ(state.players[player]!.civ).leader}.`;
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
 * with Writing open borders, at peace; with Trade knowledge), gifts (gold; with Trade an advance) and
 * demands (their units off our land, tribute with Writing, closing borders, war). The exchange of maps
 * is gone (asked for 2026-10-27; core's `shareMaps` stays for the logs that hold it).
 */
export type TalkSubject = "propose" | "gift" | "demand";
export type TalkTopic = "peace" | "pact" | "alliance" | "openBorders" | "knowledge" | "resources" | "gold" | "advance" | "resource" | "leave" | "tribute" | "closeBorders" | "endTrade" | "war";
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

/**
 * The gifts of gold we may offer (asked for 2026-10-27: it was always 50): a tenth, a quarter and half
 * of our treasury, in tens, at least ten each, never the same twice; none under ten gold.
 */
export function giftAmounts(gold: number): number[] {
  const out: number[] = [];
  for (const share of [0.1, 0.25, 0.5]) {
    const g = Math.max(10, Math.floor((gold * share) / 10) * 10);
    if (g <= gold && !out.includes(g)) out.push(g);
  }
  return out;
}

/** How a gift of `gold` weighs with `them`: against what gold is worth to them (core `goldScale`). */
export type GiftWeight = "modest" | "generous" | "lavish";
export function giftWeight(state: GameState, them: number, gold: number): GiftWeight {
  const share = gold / goldScale(state, them);
  return share >= 1.5 ? "lavish" : share >= 0.5 ? "generous" : "modest";
}

/** The leader's thanks for a gift of gold, by its weight; a generous one or more turns the talk friendly. */
export function giftThanks(state: GameState, them: number, weight: GiftWeight): string {
  const people = civ(state.players[them]!.civ).name;
  return weight === "lavish" ? `Such generosity! The ${people} will not forget it.`
    : weight === "generous" ? "Your generosity will be remembered."
    : "A modest gift. We accept it.";
}

export const TALK_SUBJECT: Record<TalkTopic, TalkSubject> = {
  peace: "propose", pact: "propose", alliance: "propose", openBorders: "propose", knowledge: "propose", resources: "propose",
  gold: "gift", advance: "gift", resource: "gift",
  leave: "demand", tribute: "demand", closeBorders: "demand", endTrade: "demand", war: "demand",
};

const SUBJECTS: readonly TalkSubject[] = ["propose", "gift", "demand"];

/**
 * Whom `me` may ask `them` to fight beside it (since save version 41): every civilization both have met,
 * still standing, that `me` is free to make war on (no pact or alliance with it), barbarians aside.
 */
export function allianceTargets(state: GameState, me: number, them: number): number[] {
  return state.players.filter((p) => p.id !== me && p.id !== them && p.alive && p.id !== state.barbarians
    && hasContact(state, me, p.id) && hasContact(state, them, p.id) && !warBarred(state, me, p.id)).map((p) => p.id);
}

/**
 * What `me` may say to `them` now, by subject (`swap`: they would trade knowledge, the AI's `tradeAsk`;
 * `goods`: they would let us have a strategic resource, the AI's `resourceOffers`). Peace while there is
 * no treaty; a non-aggression pact while none stands and an alliance against a civilization both know,
 * out of war (since save version 41); open borders only at peace; no gift at war. With Currency,
 * resources: a trade, a gift of one they lack, and calling off the trades we have. No war on an ally or
 * a civilization we have a pact with.
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
      ["pact", !war && !hasPact(state, me, them) && !allied(state, me, them)],
      ["alliance", !war && !allied(state, me, them) && allianceTargets(state, me, them).length > 0],
      ["openBorders", peace && knows("writing") && !open],
      ["knowledge", !war && knows("trade") && swap],
      ["resources", !war && coins && goods],
    ]),
    gift: memo.tone === "hostile" || war ? [] : fresh([
      ["gold", giftAmounts(us.gold).length > 0],
      ["advance", knows("trade") && us.advances.some((a) => !they.advances.includes(a))],
      ["resource", coins && exportable(state, me).some((id) => !hasResource(state, them, id))],
    ]),
    demand: memo.tone === "friendly" ? [] : fresh([
      ["leave", trespassers(state, me, them).length > 0],
      ["tribute", !war && knows("writing")],
      ["closeBorders", open],
      ["endTrade", tradesOf(state, me, them).length > 0],
      ["war", !war && !warBarred(state, me, them)],
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
    case "pact": return "Non-aggression pact";
    case "alliance": return "Alliance against...";
    case "openBorders": return "Open borders";
    case "knowledge": return "Trade knowledge";
    case "resources": return "Trade resources";
    case "resource": return "Give a resource";
    case "endTrade": return "End our trade";
    case "gold": return "Give gold";
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
