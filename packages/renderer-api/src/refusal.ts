import { unitById, unitType, type GameState } from "@civ/core";

/** What a note on the map says and which square it points at (the unit that was refused). */
export interface Callout {
  x: number;
  y: number;
  text: string;
}

const capitalise = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * Why a unit cannot make a move, in a few words for the note beside it: what stops it, not how
 * the rule works. `reason` is the code the move came back with.
 */
export function moveRefusal(state: GameState, unitId: number, _dx: number, _dy: number, reason: string): string {
  const u = unitById(state, unitId);
  if (!u) return `${capitalise(reason)}.`;
  switch (reason) {
    case "no-moves":
    case "no moves left":
      return "No moves left.";
    case "off-map":
      return "Can't go there.";
    case "terrain":
      return unitType(u.type).domain === "sea" ? "Can't go ashore." : "Can't go there yet.";
    case "full":
      return "Ship is full.";
    case "rough":
    case "steep":
      return "Needs a road.";
    case "zoc":
      return "Enemy too close.";
    case "this unit cannot attack":
      return "Can't attack.";
    case "land units cannot attack at sea":
      return "Can't attack at sea.";
    case "only land units take cities":
      return "Can't take cities.";
    case "barbarian city":
      return "Nothing to do there.";
    default:
      return `${capitalise(reason)}.`;
  }
}
