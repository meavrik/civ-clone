import { computeScore, emptyChronicle, formatYear, rankTitle, turnToYear, wonder, type GameEnd, type GameState } from "@civ/core";
import type { IconName } from "./icons.js";

/**
 * The end of the game as its screen shows it (asked for 2026-10-29: a fallen civilization's screen showed its ruin,
 * "need to show all the achievements of the entire civ history"): how it ended, the years of the reign, and what the
 * civilization did over its whole history (core's `Player.chronicle`), then the verdict.
 */
export interface EndCard {
  /** The window's title. */
  title: string;
  /** How it ended: "Your civilization has been destroyed." */
  headline: string;
  /** Who reigned and when: "The Romans, 3980 BC to 1250 AD". */
  span: string;
  /** The history in numbers, a row each, in two columns (the first half the realm, the second its deeds). */
  rows: { icon: IconName; label: string; value: string }[];
  /** The wonders it completed, as a line, or null for none. */
  wonders: string | null;
  /** "Your rule was Great.", or for a fallen civilization "At its height, your rule was Great." */
  verdict: string;
}

/** Names in a sentence, the first `max`, then how many more: "Pyramids, Colossus and 3 more". */
function nameList(names: string[], max: number): string {
  if (names.length > max) return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "";
}

/** The end screen for `player`, the game having ended as `end` says. */
export function endCard(state: GameState, end: NonNullable<GameEnd>, player = 0): EndCard {
  const p = state.players[player]!;
  const ch = p.chronicle ?? emptyChronicle();
  const final = computeScore(state, player).total;
  const winner = end.kind === "conquest" || end.kind === "space" ? state.players[end.winner]?.name ?? "" : "";
  const headline = end.kind === "conquest" ? (end.winner === player ? "You have conquered the world!" : `The ${winner} rule the world.`)
    : end.kind === "space" ? (end.winner === player ? "Your colonists have reached a new world!" : `The ${winner} have colonized the stars.`)
    : end.kind === "defeat" ? "Your civilization has been destroyed."
    : `The year is ${formatYear(turnToYear(state.turn))}. Your reign ends.`;
  const title = end.kind === "defeat" ? "Civilization Fallen" : (end.kind === "conquest" || end.kind === "space") && end.winner === player ? "Victory" : "The End";
  const from = formatYear(turnToYear(ch.firstCity ?? 0));
  const to = formatYear(turnToYear(ch.fell ?? state.turn));
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const rows: EndCard["rows"] = [
    { icon: "city", label: "Cities founded", value: String(ch.founded) },
    { icon: "swords", label: "Cities conquered", value: String(ch.conquered) },
    { icon: "unhappy", label: "Cities lost", value: String(ch.lost) },
    { icon: "crown", label: "Largest realm", value: plural(ch.peakCities, "city", "cities") },
    { icon: "people", label: "Most citizens", value: String(ch.peakCitizens) },
    { icon: "bulb", label: "Advances", value: String(p.advances.length) },
    { icon: "star", label: "Battles won", value: String(ch.won) },
    { icon: "heart", label: "Battles lost", value: String(ch.defeated) },
    { icon: "shield", label: "Units raised", value: String(ch.units) },
    { icon: "calendar", label: "Best score", value: ch.peakScore ? `${ch.peakScore}, ${formatYear(turnToYear(ch.peakScoreTurn))}` : "0" },
  ];
  const wonders = ch.wonders.length ? `Wonders: ${nameList(ch.wonders.map((id) => wonder(id).name), 4)}` : null;
  const verdict = end.kind === "defeat"
    ? `At its height, your rule was ${rankTitle(Math.max(ch.peakScore, final))}.`
    : `Final score ${final}. Your rule was ${rankTitle(final)}.`;
  return { title, headline, span: `The ${p.name}, ${from} to ${to}`, rows, wonders, verdict };
}
