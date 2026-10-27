import { hasContact, unitById, unitType, type GameState, type Unit } from "@civ/core";

/**
 * The tutorial (asked for 2026-10-27: "add a short tutorial for new players"): a few tips, each shown
 * once, in a small window over the map at the moment it helps: the first unit awaiting orders, the
 * first settlers with no city yet, the first city, the first turn with nothing left to order, and so
 * on. Which have been shown is the app's to keep (per browser), so a new player meets each one in
 * their first game and never again. Each is one short sentence (asked for 2026-10-27: "too many text.
 * one sentence. keep it short"): `line` for a mouse and keys, `touch` for the phone where the words
 * differ; both may carry `{icon}` tokens.
 */
export interface Tip {
  id: string;
  title: string;
  line: string;
  touch?: string;
  /** Whether the tip is due now for `viewer`. */
  due: (state: GameState, viewer: number) => boolean;
  /** The square the tip speaks of, which its window stands clear of; without one, the unit in play. */
  focus?: (state: GameState, viewer: number) => { x: number; y: number } | undefined;
}

const active = (state: GameState, viewer: number): Unit | undefined => {
  const u = state.activeUnit !== null ? unitById(state, state.activeUnit) : undefined;
  return u?.owner === viewer ? u : undefined;
};
const cities = (state: GameState, viewer: number) => state.cities.filter((c) => c.owner === viewer);
/** The huts on squares `viewer` sees now. */
const huts = (state: GameState, viewer: number): { x: number; y: number }[] => {
  const seen = state.players[viewer]?.visible;
  const out: { x: number; y: number }[] = [];
  if (seen) state.map.tiles.forEach((t, i) => { if (t.hut && seen[i] === 1) out.push({ x: i % state.map.width, y: Math.floor(i / state.map.width) }); });
  return out;
};
/** A unit that can hold a city: a land unit that fights, not a settler, diplomat or caravan. */
const soldier = (u: Unit): boolean => {
  const t = unitType(u.type);
  return t.domain === "land" && t.attack > 0 && !t.flags?.some((f) => f === "settler" || f === "diplomat" || f === "caravan");
};
const settlers = (u: Unit | undefined): boolean => !!u && !!unitType(u.type).flags?.includes("settler");
/** A city of `viewer`'s with no soldier in it. */
const unguarded = (state: GameState, viewer: number) => cities(state, viewer).find((c) => !state.units.some((u) => u.owner === viewer && u.x === c.x && u.y === c.y && soldier(u)));

export const TUTORIAL: readonly Tip[] = [
  {
    id: "move",
    title: "Moving Units",
    line: "Right-click a square to move the blinking unit there (twice for a far square).",
    touch: "Tap a square to move the blinking unit there (twice for a far square).",
    due: (s, v) => active(s, v) !== undefined,
  },
  {
    id: "found",
    title: "Founding a City",
    line: "Press B to found a city where your Settlers stand; dotted squares mark good sites.",
    touch: "Tap your Settlers and pick Found city; dotted squares mark good sites.",
    due: (s, v) => settlers(active(s, v)) && cities(s, v).length === 0,
  },
  {
    id: "city",
    title: "Your City",
    line: "Click your city to open it and choose what it builds.",
    touch: "Tap your city to open it and choose what it builds.",
    due: (s, v) => cities(s, v).length > 0,
    focus: (s, v) => cities(s, v).at(-1),
  },
  {
    id: "endTurn",
    title: "Ending the Turn",
    line: "Press Enter or click End of Turn when you are done.",
    touch: "Tap End of Turn on the panel when you are done.",
    due: (s, v) => s.activeUnit === null && cities(s, v).length > 0,
  },
  {
    id: "research",
    title: "Science",
    line: "{bulb} Click the research on the panel to choose what to study next.",
    touch: "{bulb} Tap the research on the panel to choose what to study next.",
    due: (s, v) => s.turn >= 2 && s.players[v]?.researching != null,
  },
  {
    id: "map",
    title: "The Map",
    line: "Left-click a square to centre the map there; click it again to learn about it.",
    touch: "Drag the map to look around; hold a finger on a square to learn about it.",
    due: (s) => s.turn >= 4,
  },
  {
    id: "village",
    title: "Villages",
    line: "{hut} Walk a unit into a village: it may give gold, an advance or soldiers.",
    // Not on the first turn, which has its own tips to tell.
    due: (s, v) => s.turn >= 1 && huts(s, v).length > 0,
    focus: (s, v) => huts(s, v)[0],
  },
  {
    id: "defend",
    title: "Defence",
    line: "Keep a soldier fortified (F) in every city, or barbarians will take it.",
    touch: "Keep a soldier fortified in every city, or barbarians will take it.",
    due: (s, v) => s.turn >= 8 && unguarded(s, v) !== undefined,
    focus: unguarded,
  },
  {
    id: "contact",
    title: "Neighbours",
    line: "You met a neighbour: talk, trade or make peace from the Diplomacy menu.",
    due: (s, v) => s.players.some((p) => p.id !== v && p.id !== s.barbarians && p.alive && hasContact(s, v, p.id)),
  },
];

/** The first tip not yet `seen` that is due now for `viewer`, if any. */
export function nextTip(state: GameState, viewer: number, seen: ReadonlySet<string>): Tip | null {
  return TUTORIAL.find((t) => !seen.has(t.id) && t.due(state, viewer)) ?? null;
}

/** A tip's words for a mouse and keys, or for fingers on the phone. */
export function tipLine(tip: Tip, touch: boolean): string {
  return touch && tip.touch ? tip.touch : tip.line;
}
