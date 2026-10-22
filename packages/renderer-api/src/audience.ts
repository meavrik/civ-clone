import { civ, type GameState } from "@civ/core";

/**
 * The audience with a foreign leader (redone 2026-10-22, asked for, after the user's mock-up "Caesar
 * Welcomes You to Rome"): the realm's name across the top, the leader in their palace, then the
 * leader's name, their words and our choices as buttons, never more than `AUDIENCE_CHOICES` at once.
 */
export const AUDIENCE_CHOICES = 4;

export interface DiplomacyView {
  player: number;
  /** The leader's words. */
  line: string;
  /** Our choices, as buttons under the words (at most AUDIENCE_CHOICES); none, and any key goes on. */
  choices?: string[];
  selected?: number;
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
