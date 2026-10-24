import { civ, civInfluence, esteem, GOVERNMENTS, trespassers, type GameState } from "@civ/core";

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
  return [
    `${c.leader} leads the ${c.name}: ${realmName(state, player)}.`,
    ...(c.trait ? [`${c.trait.name}: ${c.trait.text}`] : []),
    `${GOVERNMENTS[p.government]?.name ?? p.government}; capital ${capital?.name ?? "none"}. ${cities.length} ${cities.length === 1 ? "city" : "cities"}, ${p.advances.length} advances, ${p.gold} gold.`,
    `Influence ${civInfluence(state, player)}: they ${regard === "admired" ? "admire ours" : regard === "scorned" ? "scorn ours" : "weigh ours little either way"}.`,
    `They are ${mood} toward us.`,
    onOurLand ? `${onOurLand} of their units stand on our land.` : "None of their units stand on our land.",
  ];
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
