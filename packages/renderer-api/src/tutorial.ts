import { hasContact, unitById, unitType, type GameState, type Unit } from "@civ/core";

/**
 * The tutorial (asked for 2026-10-27: "add a short tutorial for new players"): a few tips, each shown
 * once, in a small window over the map at the moment it helps: the first unit awaiting orders, the
 * first settlers with no city yet, the first city, the first turn with nothing left to order, and so
 * on. Which have been shown is the app's to keep (per browser), so a new player meets each one in
 * their first game and never again. `lines` are for a mouse and keys, `touch` for the phone where the
 * words differ; both may carry `{icon}` tokens.
 */
export interface Tip {
  id: string;
  title: string;
  lines: readonly string[];
  touch?: readonly string[];
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
    lines: [
      "The blinking unit awaits your orders.",
      "Right-click a square to send it there: next door it steps at once; further off its route shows first, and a second right-click sends it.",
      "The arrow keys and number pad move it too.",
    ],
    touch: [
      "The blinking unit awaits your orders.",
      "Tap a square to send it there: next door it steps at once; further off its route shows first, and a second tap sends it.",
      "Tap the unit itself for its orders.",
    ],
    due: (s, v) => active(s, v) !== undefined,
  },
  {
    id: "found",
    title: "Founding a City",
    lines: [
      "Settlers found cities. Press B, or pick Found city from the Orders menu, to build one where they stand.",
      "Dotted squares mark good sites nearby: rivers, coast, grassland and resources help a city grow.",
    ],
    touch: [
      "Settlers found cities. Tap them and pick Found city to build one where they stand.",
      "Dotted squares mark good sites nearby: rivers, coast, grassland and resources help a city grow.",
    ],
    due: (s, v) => settlers(active(s, v)) && cities(s, v).length === 0,
  },
  {
    id: "city",
    title: "Your City",
    lines: [
      "Left-click a city to open it any time. Change picks what it builds; its citizens work the squares around it.",
      "{food} Food grows the city, {shield} shields build, {trade} trade brings taxes and science.",
    ],
    touch: [
      "Tap a city to open it any time. Change picks what it builds; its citizens work the squares around it.",
      "{food} Food grows the city, {shield} shields build, {trade} trade brings taxes and science.",
    ],
    due: (s, v) => cities(s, v).length > 0,
    focus: (s, v) => cities(s, v).at(-1),
  },
  {
    id: "endTurn",
    title: "Ending the Turn",
    lines: [
      "Every unit has its orders. The turn ends by itself after your last unit's order.",
      "When nothing waits for orders, press Enter or click End of Turn on the panel. Then the other civilizations move.",
    ],
    touch: [
      "Every unit has its orders. The turn ends by itself after your last unit's order.",
      "When nothing waits for orders, tap End of Turn on the panel. Then the other civilizations move.",
    ],
    due: (s, v) => s.activeUnit === null && cities(s, v).length > 0,
  },
  {
    id: "research",
    title: "Science",
    lines: [
      "{bulb} Your scholars study one advance at a time; each brings new units, buildings or ways to govern.",
      "The panel shows the research under way: click it to choose. Tax Rate (T) shares your trade between gold, luxuries and science.",
    ],
    touch: [
      "{bulb} Your scholars study one advance at a time; each brings new units, buildings or ways to govern.",
      "The panel shows the research under way: tap it to choose. Tap the rates on the panel to share your trade between gold, luxuries and science.",
    ],
    due: (s, v) => s.turn >= 2 && s.players[v]?.researching != null,
  },
  {
    id: "map",
    title: "The Map",
    lines: [
      "Left-click a square to centre the map there, or one of your units to pick it; where several stand together, choose one from the list.",
      "Shift+click any square to learn about it. Rest the mouse on the panel to learn what each part means.",
    ],
    touch: [
      "Drag the map to look around, and pinch to zoom. Tap one of your units to pick it; where several stand together, choose one from the list.",
      "Hold a finger on a square to learn about it. Tap the panel to learn what each part means.",
    ],
    due: (s) => s.turn >= 4,
  },
  {
    id: "village",
    title: "Villages",
    lines: ["{hut} Huts are tribal villages. Walk a unit in: the tribe may give gold, an advance or soldiers, or barbarians may rush out."],
    // Not on the first turn, which has its own tips to tell.
    due: (s, v) => s.turn >= 1 && huts(s, v).length > 0,
    focus: (s, v) => huts(s, v)[0],
  },
  {
    id: "defend",
    title: "Defence",
    lines: ["A city without soldiers is easy prey for barbarians and rivals. Build a defender and keep it in the city, fortified (F)."],
    touch: ["A city without soldiers is easy prey for barbarians and rivals. Build a defender and keep it in the city, fortified (in its orders)."],
    due: (s, v) => s.turn >= 8 && unguarded(s, v) !== undefined,
    focus: unguarded,
  },
  {
    id: "contact",
    title: "Neighbours",
    lines: ["You have met another civilization. Diplomacy on the menu bar lists everyone you have met: talk with their leaders there, to trade or make peace."],
    due: (s, v) => s.players.some((p) => p.id !== v && p.id !== s.barbarians && p.alive && hasContact(s, v, p.id)),
  },
];

/** The first tip not yet `seen` that is due now for `viewer`, if any. */
export function nextTip(state: GameState, viewer: number, seen: ReadonlySet<string>): Tip | null {
  return TUTORIAL.find((t) => !seen.has(t.id) && t.due(state, viewer)) ?? null;
}

/** A tip's words for a mouse and keys, or for fingers on the phone. */
export function tipLines(tip: Tip, touch: boolean): readonly string[] {
  return touch && tip.touch ? tip.touch : tip.lines;
}
