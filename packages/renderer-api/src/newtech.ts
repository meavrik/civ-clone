import { advance, advancesFor, type GameState } from "@civ/core";
import type { IconName } from "./icons.js";
import { techDetails } from "./research.js";

/**
 * The New Technology window (asked for 2026-10-23, after the user's template): shown for each advance
 * found, before the research panel. Under its title the advance's name and era; the user's picture of
 * it; what it is, what it unlocks and what it needed; View Tech Tree and Continue.
 */
export interface NewTechView {
  advance: string;
  /** The lit button: 0 View Tech Tree, 1 Continue. */
  selected: number;
  /** How far the window has grown on opening, 0..1 (`WINDOW_ENTER_MS`); absent or 1, it stands whole. */
  enter?: number | undefined;
}

export const NEW_TECH_BUTTONS = ["View Tech Tree", "Continue"] as const;

/** A button of the window, or its close box (which goes on as Continue does). */
export type NewTechHit = "tree" | "continue" | "close";

export interface Unlock {
  icon: IconName;
  name: string;
  /** What kind of thing it is, in a word or two: "unit", "wonder", "+1 food". */
  kind: string;
  /** A unit's id, so its sprite can stand in the box. */
  unit?: string;
}

export interface NewTechCard {
  name: string;
  era: string;
  text: string;
  /** What it brings; when it brings nothing of its own, the advances it leads to (`leads`). */
  unlocks: Unlock[];
  leads: boolean;
  /** The advances it needed. */
  needs: { id: string; name: string }[];
}

/** The kind each row of the research card's gifts stands for. */
const KIND: Record<string, string> = {
  Government: "government", Units: "unit", Buildings: "building", Wonders: "wonder", Settlers: "settler work",
  "Ends wear": "no more wear", Ends: "no longer works",
};

/** What the window says of advance `id`, for the current player. */
export function newTechCard(state: GameState, id: string): NewTechCard {
  const rule = advancesFor(state).find((a) => a.id === id) ?? advance(id);
  const d = techDetails(state, id);
  const unlocks: Unlock[] = d.rows.flatMap((row) => row.items.map((item, i): Unlock => {
    const unit = row.ids?.[i];
    if (unit) return { icon: row.icon, name: item.replace(/ \d+\/\d+\/\d+$/, ""), kind: "unit", unit };
    // Yields from specials read "Horses +1": the gain becomes the kind.
    const gain = /^(.*) \+(\d+)$/.exec(item);
    if (gain) return { icon: row.icon, name: gain[1]!, kind: `+${gain[2]} ${row.label.toLowerCase()}` };
    return { icon: row.icon, name: item, kind: KIND[row.label] ?? row.label.toLowerCase() };
  }));
  const leads = !unlocks.length;
  if (leads) for (const o of d.opens) unlocks.push({ icon: "bulb", name: o.name, kind: "advance" });
  return { name: rule.name, era: `${rule.era} Era`, text: rule.text, unlocks, leads, needs: rule.requires.map((r) => ({ id: r, name: advance(r).name })) };
}

/** The advances that have a picture of the user's (every one but the 1991 tree's Future Tech.). */
export function techPicture(id: string): string | null {
  return id === "future_tech" ? null : id;
}
