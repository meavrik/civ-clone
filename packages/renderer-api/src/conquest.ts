import { civ, wonder, type GameState, type TurnEvent } from "@civ/core";
import { hash } from "./hash.js";
import type { IconName } from "./icons.js";

/**
 * A city taken (asked for 2026-10-27: "when a city is conquered by player or from player - add a sad
 * message (if lost) and celebration message + animation if player won"). Ours taken by another: a
 * window in mourning over the map, pointing at the city. One we took: fireworks over it on the map,
 * our cheer beside it, then the window in triumph, with View City.
 */
export type ConquestEvent = Extract<TurnEvent, { kind: "cityCaptured" | "cityLost" }>;

export interface ConquestView {
  /** The city taken (held) or razed, and by whom. */
  event: ConquestEvent;
  /** The player the window speaks to: they won when they took it (`event.by`), lost when it was theirs. */
  viewer: number;
  /** The lit button: 0 View City, 1 Continue (a window without buttons ignores it). */
  selected: number;
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
  /** The city's square on the screen under the window, when that is the map (`Renderer.squareRect`): the window stands by it and points at it. */
  square?: { x: number; y: number; w: number; h: number } | undefined;
}

/** View City (on a city we took and hold), Continue, or the close box (which goes on as Continue does); a click on the city it points at is View City. */
export type ConquestHit = "city" | "continue" | "close";

export interface ConquestFact {
  icon: IconName;
  text: string;
}

export interface ConquestCard {
  /** Ours to celebrate (we took it), or to mourn (it was ours). */
  won: boolean;
  /** The title strip's words: "City Conquered", "City Razed", "City Lost", "City Destroyed". */
  title: string;
  name: string;
  /** "Taken from the Babylonians", "Taken by the Babylonians", "Freed from the Barbarians". */
  where: string;
  /** A line in the mood of the news: cheering, or mourning. */
  words: string;
  /** What changed hands, in numbers: the capital, wonders, gold, people (three at most). */
  facts: ConquestFact[];
  /** The window's buttons: View City and Continue on a city we hold; none (the close box) otherwise. */
  buttons: string[];
  /** Said beside the city while the fireworks burst over it ("Babylon is ours!"); won only. */
  cheer: string;
}

/** Facts beyond this many are left out (the window has three lines for them). */
export const CONQUEST_FACTS = 3;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A civilization's people ("Babylonians") and adjective ("Babylonian"). */
function people(state: GameState, player: number): { name: string; adjective: string } {
  const p = state.players[player];
  if (!p) return { name: "enemy", adjective: "enemy" };
  try { return { name: p.name, adjective: civ(p.civ).adjective }; } catch { return { name: p.name, adjective: p.name }; }
}

/** One of a few lines, the same for the same city (a hash of its name and square, never the game's RNG). */
function pick(lines: readonly string[], ev: ConquestEvent): string {
  let h = 0;
  for (const ch of ev.name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return lines[Math.floor(hash(ev.x, ev.y, h) * lines.length)]!;
}

const MOURN_TAKEN = [
  "A foreign banner rises over its walls, and its people weep.",
  "Its streets fall silent under foreign soldiers.",
  "Our people there must bow to a foreign ruler.",
] as const;
const MOURN_RAZED = [
  "Nothing is left of it but smoke and ashes.",
  "Its walls are broken and its people scattered.",
] as const;
const CHEER_TAKEN = [
  "Our banner flies over its walls!",
  "Its gates are ours, and our soldiers march in!",
  "The city bows to its new masters!",
] as const;

/** What the window says of a city taken, as `view.viewer` sees it. */
export function conquestCard(state: GameState, view: ConquestView): ConquestCard {
  const ev = view.event;
  const won = ev.by === view.viewer;
  const held = ev.kind === "cityCaptured";
  const city = held ? state.cities.find((c) => c.id === ev.cityId) : undefined;
  const loser = people(state, ev.player);
  const winner = people(state, ev.by);
  const fromBarbarians = ev.player === state.barbarians;
  const byBarbarians = ev.by === state.barbarians;
  const facts: ConquestFact[] = [];
  const wonders = city?.wonders ?? [];
  // "Wonder lost: Pyramids", "Wonders won: Colossus, Oracle" (names alone: some are plural, some not).
  const wonderText = (how: string) => `${wonders.length === 1 ? "Wonder" : "Wonders"} ${how}: ${wonders.map((w) => wonder(w).name).join(", ")}`;

  if (won) {
    if (ev.capital && !fromBarbarians) facts.push({ icon: "crown", text: `The ${loser.adjective} capital has fallen!` });
    if (wonders.length) facts.push({ icon: "star", text: wonderText("won") });
    if (ev.plunder > 0) facts.push({ icon: "coin", text: `${ev.plunder} gold plundered` });
    if (city) facts.push({ icon: "people", text: `${plural(city.size, "citizen")} ${city.size === 1 ? "joins" : "join"} our people` });
    const kept = city ? city.buildings.length : 0;
    if (kept) facts.push({ icon: "house", text: `${plural(kept, "building")} still ${kept === 1 ? "stands" : "stand"}` });
    if (!held) facts.push({ icon: "swords", text: "Too small to hold: it is razed" });
    return {
      won,
      title: held ? "City Conquered" : "City Razed",
      name: ev.name,
      where: held && fromBarbarians ? "Freed from the Barbarians" : `Taken from the ${loser.name}`,
      words: !held ? "Victory! Its walls are thrown down." : fromBarbarians ? "Its people hail us as their liberators!" : pick(CHEER_TAKEN, ev),
      facts: facts.slice(0, CONQUEST_FACTS),
      buttons: held && city?.owner === view.viewer ? ["View City", "Continue"] : [],
      cheer: held ? `${ev.name} is ours!` : `${ev.name} is razed!`,
    };
  }

  if (ev.capital) facts.push({ icon: "crown", text: "Our capital has fallen!" });
  if (wonders.length) facts.push({ icon: "star", text: wonderText("lost") });
  if (ev.plunder > 0) facts.push({ icon: "coin", text: `${ev.plunder} gold carried off` });
  if (city) facts.push({ icon: "people", text: `${plural(city.size, "citizen")} now ${city.size === 1 ? "serves" : "serve"} the ${winner.name}` });
  else facts.push({ icon: "people", text: "Its people are lost to us" });
  return {
    won,
    title: held ? "City Lost" : "City Destroyed",
    name: ev.name,
    where: held ? (byBarbarians ? "Seized by the Barbarians" : `Taken by the ${winner.name}`) : (byBarbarians ? "Burned by the Barbarians" : `Razed by the ${winner.name}`),
    words: pick(held ? MOURN_TAKEN : MOURN_RAZED, ev),
    facts: facts.slice(0, CONQUEST_FACTS),
    buttons: [],
    cheer: "",
  };
}

/**
 * Fireworks over a city just taken (`MainScreenView.fireworks`): the city's square, and how far the
 * show has gone, 0..1. Renderers draw rockets climbing from it and bursting above it in sparks.
 */
export interface Fireworks {
  x: number;
  y: number;
  /** 0 as the first rocket leaves, 1 as the last sparks fade. */
  t: number;
  /** The civilization celebrating: its colour among the sparks. */
  owner: number;
  /** Words over the show ("Babylon is ours!", `ConquestCard.cheer`). */
  cheer?: string | undefined;
}
