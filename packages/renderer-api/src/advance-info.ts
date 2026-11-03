import { advance, advancesFor, BUILDINGS, government, SPACE_PARTS, UNIT_TYPES, WONDERS, type GameState } from "@civ/core";
import type { IconName } from "./icons.js";
import type { MenuPicture } from "./index.js";
import { techDetails } from "./research.js";

/**
 * The research list's pictures and its window of more about an advance (asked for 2026-11-03: "a basic simple tech
 * list - like the original civ1 game. near each tech can add in small icons the improvements/buildings/units it
 * unlocks - just icons small. add also a more info icon to show a new window with description, historical context
 * and full unlocks and next tech possible").
 */

/** What advance `id` brings that has a picture, in a row of small ones: its government's crown, its wonders, buildings (and spaceship parts) and units. */
export function techPictures(id: string, color: number): MenuPicture[] {
  const rule = advance(id);
  return [
    ...(rule.government ? [{ icon: "crown" as IconName }] : []),
    ...[...WONDERS, ...BUILDINGS, ...SPACE_PARTS].filter((b) => b.requires === id).map((b) => ({ building: b.id })),
    ...UNIT_TYPES.filter((u) => u.requires === id).map((u) => ({ unit: u.id, color })),
  ];
}

/** The window: the advance it tells of. */
export interface AdvanceInfoView {
  advance: string;
  /** How far it has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
}

/** Its close box. */
export type AdvanceInfoHit = "close";

/** A line of what an advance unlocks: a picture (a building's, a unit's, the crown) or an icon, and words. */
export interface AdvanceInfoLine {
  picture: MenuPicture;
  text: string;
}

export interface AdvanceInfo {
  name: string;
  /** "Ancient Era". */
  era: string;
  /** What it is (`AdvanceRule.text`) and its place in history (`AdvanceRule.history`). */
  text: string;
  history: string;
  /** "Needs Alphabet and Code of Laws", or one of the first discoveries. */
  needs: string;
  /** Where it stands for the player: "Discovered", "Researching: ...", "Can research now: ...", "Later: needs ...". */
  standing: string;
  /** Everything it brings: its government, wonders, buildings, units, then its other gains. */
  unlocks: AdvanceInfoLine[];
  /** The advances it opens the way to, each with what else it still waits for ("with Philosophy"). */
  leads: { name: string; also: string }[];
}

const and = (names: string[]): string =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** The window's words for advance `id`, for the current player. */
export function advanceInfo(state: GameState, id: string): AdvanceInfo {
  const rule = advancesFor(state).find((a) => a.id === id) ?? advance(id);
  const d = techDetails(state, id);
  const color = state.players[state.currentPlayer]!.color;
  const unlocks: AdvanceInfoLine[] = [];
  if (rule.government) unlocks.push({ picture: { icon: "crown" }, text: `${government(rule.government).name} (government)` });
  for (const w of WONDERS.filter((x) => x.requires === id)) unlocks.push({ picture: { building: w.id }, text: `${w.name} (wonder)` });
  for (const b of [...BUILDINGS, ...SPACE_PARTS].filter((x) => x.requires === id)) unlocks.push({ picture: { building: b.id }, text: b.name });
  for (const u of UNIT_TYPES.filter((x) => x.requires === id)) unlocks.push({ picture: { unit: u.id, color }, text: `${u.name} ${u.attack}/${u.defense}/${u.moves}` });
  // The rest of what it brings, a line each with the research card's icon.
  const framed = new Set(["Government", "Units", "Buildings", "Wonders"]);
  for (const row of d.rows.filter((r) => !framed.has(r.label))) {
    const items = row.items.join(", ");
    const text = row.label === "Reveals" ? `Reveals ${items} on the map`
      : row.label === "Ends wear" ? `No more wear in ${items}`
      : row.label === "Ends" ? `Ends ${items}`
      : row.label === "Settlers" ? `Settlers: ${items}`
      : `${row.label}: ${items}`;
    unlocks.push({ picture: { icon: row.icon }, text });
  }
  const leads = d.opens.map((o) => ({ name: o.name, also: o.also.length ? `with ${and(o.also.map((a) => advance(a).name))}` : "" }));
  return {
    name: rule.name,
    era: `${rule.era} Era`,
    text: rule.text,
    history: rule.history,
    needs: rule.requires.length ? `Needs ${and(rule.requires.map((r) => advance(r).name))}` : "One of the first discoveries",
    standing: d.standing,
    unlocks,
    leads,
  };
}
