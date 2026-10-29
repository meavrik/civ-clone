import { computeScore } from "./score.js";
import type { Chronicle, GameState, Player } from "./types.js";

/**
 * What each civilization has done over its whole history (asked for 2026-10-29: the end screen of a fallen
 * civilization showed only its ruin, "need to show all the achievements of the entire civ history"): cities
 * founded, taken and lost, fights won and lost, units raised, wonders completed, and the most cities, citizens and
 * score it ever had. Bookkeeping only: no rule or AI reads it, and it draws no random numbers, so an old game's log
 * replays to the same play and builds the chronicle as it goes. `Player.chronicle` since save version 44.
 */
export function chronicleOf(p: Player): Chronicle {
  return (p.chronicle ??= emptyChronicle());
}

/** A history with nothing in it yet: what a reader takes for a civilization without one (never stored by readers). */
export function emptyChronicle(): Chronicle {
  return { founded: 0, conquered: 0, lost: 0, won: 0, defeated: 0, units: 0, wonders: [], peakCities: 0, peakCitizens: 0, peakScore: 0, peakScoreTurn: 0 };
}

/** The civilization's height so far: its most cities, citizens and score, read as its turn ends. */
export function notePeaks(state: GameState, player: number): void {
  const p = state.players[player];
  if (!p || player === state.barbarians) return;
  const ch = chronicleOf(p);
  let cities = 0;
  let citizens = 0;
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    cities++;
    citizens += c.size;
  }
  ch.peakCities = Math.max(ch.peakCities, cities);
  ch.peakCitizens = Math.max(ch.peakCitizens, citizens);
  const score = computeScore(state, player).total;
  if (score > ch.peakScore) {
    ch.peakScore = score;
    ch.peakScoreTurn = state.turn;
  }
}
