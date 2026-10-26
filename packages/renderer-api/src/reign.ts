import { advance, building, civ, formatYear, turnToYear, unitType, type CivTrait, type GameState, type TraitEffect, type WorkKind } from "@civ/core";
import { WORK_ICON, type IconName } from "./icons.js";
import { LEADER_PORTRAITS } from "./setup.js";

/**
 * The window a new game opens with on the map (asked for 2026-10-26: "improve the starting game first
 * message ... add civ image + short description and civ bonuses"; it had been a plain message with the
 * trait's line): our leader's portrait, the people in a sentence (`CivRule.text`), and what the tribe
 * brings, a line each in numbers from its trait's effects, with the advance it starts with. One button,
 * Begin, or the close box, Enter or Esc.
 */
export interface ReignView {
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
}

export const REIGN_BUTTON = "Begin";

/** The window's button, or its close box (which begins too). */
export type ReignHit = "begin" | "close";

export interface Bonus {
  icon: IconName;
  text: string;
}

export interface ReignCard {
  /** "The Romans". */
  name: string;
  /** Under the name: the leader and the year, "Caesar, 4000 BC". */
  under: string;
  /** The leader's portrait (a name in the portrait art), and the civilization's colour slot, round it. */
  portrait: string;
  band: number;
  /** The people in a sentence. */
  text: string;
  /** The trait's name; null in a game of classic civilizations, where every people is alike. */
  trait: string | null;
  /** What the tribe brings, a line each. */
  bonuses: Bonus[];
}

const WORK_WORDS: Record<WorkKind, string> = {
  road: "roads", railroad: "railroads", mine: "mines", irrigate: "irrigation", fortress: "fortresses", clean: "clean-up",
};

/** "a", "a and b", "a, b and c". */
function andList(xs: string[]): string {
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A share of the food box in words: "a third", "half". */
function share(keep: number): string {
  if (Math.abs(keep - 1 / 2) < 1e-6) return "half";
  if (Math.abs(keep - 1 / 3) < 1e-6) return "a third";
  if (Math.abs(keep - 1 / 4) < 1e-6) return "a quarter";
  return `${Math.round(keep * 100)}%`;
}

/** The units an effect names, in a word or two: its `who`, else its domain's. */
function whom(e: { who?: string; domain?: string }): string {
  return e.who ?? (e.domain === "sea" ? "Ships" : e.domain === "air" ? "Aircraft" : "Land units");
}

/** One of a trait's effects in a short line with its icon, in numbers where it has them. */
export function bonusLine(e: TraitEffect): Bonus {
  switch (e.kind) {
    case "fastWork": return { icon: WORK_ICON[e.work[0] ?? "road"], text: `${capital(andList(e.work.map((w) => WORK_WORDS[w])))} in half the time` };
    case "cost": {
      const what = e.wonders ? "Wonders" : e.soldiers ? "Soldiers" : andList([...(e.buildings ?? []).map((b) => building(b).name), ...(e.units ?? []).map((u) => unitType(u).name)]);
      const icon: IconName = e.wonders ? "star" : e.soldiers || e.units ? "swords" : "house";
      return { icon, text: `${what} cost ${Math.abs(e.pct)}% ${e.pct < 0 ? "less" : "more"}` };
    }
    case "sciencePct": return { icon: "bulb", text: `${signed(e.pct)}% science in every city` };
    case "taxPct": return { icon: "coin", text: `${signed(e.pct)}% tax in every city` };
    case "corruptionPct": return { icon: "trade", text: `${signed(e.pct)}% trade lost to corruption` };
    case "content": return { icon: "heart", text: `+${plural(e.amount, "content citizen")} in every city` };
    case "growth": return { icon: "food", text: `A growing city keeps ${share(e.keep)} of its food` };
    case "foodBoxPct": return { icon: "food", text: `${signed(e.pct)}% food for a city to grow` };
    case "veteran": return { icon: "veteran", text: `${whom(e)} start as veterans` };
    case "moves": return { icon: "boot", text: `+${plural(e.amount, "move")} for ${whom(e).toLowerCase()}` };
    case "anarchy": return { icon: "crown", text: `Anarchy lasts ${plural(e.turns, "turn")} at most` };
    case "friendlyVillages": return { icon: "hut", text: "Villages: no barbarians, twice the gold" };
  }
}

/** What a trait brings, a line each: its effects, then the advance it starts with. */
export function traitBonuses(t: CivTrait): Bonus[] {
  return [...t.effects.map(bonusLine), { icon: "bulb", text: `Starts knowing ${advance(t.start).name}` }];
}

/** What the opening window says of civilization `player` (the one at the keys). */
export function reignCard(state: GameState, player = 0): ReignCard {
  const p = state.players[player]!;
  const c = civ(p.civ);
  const t = state.classicCivs ? undefined : c.trait;
  return {
    name: `The ${p.name}`,
    under: `${c.leader}, ${formatYear(turnToYear(state.turn))}`,
    portrait: LEADER_PORTRAITS[c.id] ?? "king",
    band: p.color,
    text: c.text ?? "",
    trait: t?.name ?? null,
    bonuses: t ? traitBonuses(t) : [{ icon: "star", text: "Every people alike, as in the original" }],
  };
}
