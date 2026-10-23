import { advance, unitById, unitType, type GameState } from "@civ/core";

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

/**
 * Why a settler cannot take up a job, in a few words for the note beside it. `reason` is the code
 * the work order came back with (`whyNoWork` in core).
 */
export function workRefusal(reason: string): string {
  if (reason === "needs:bridge_building") return "A road across the river needs Bridge Building.";
  if (reason.startsWith("needs:")) {
    let name = reason.slice(6);
    try { name = advance(name).name; } catch { /* an advance since renamed */ }
    return `Needs ${name}.`;
  }
  switch (reason) {
    case "not a settler": return "Only settlers can do that.";
    case "aboard": return "Not while aboard a ship.";
    case "has road": return "Already has a road.";
    case "no road here": return "No road can be built here.";
    case "has railroad": return "Already has a railroad.";
    case "needs road": return "Needs a road first.";
    case "no railroad here": return "No railroad can be laid here.";
    case "cannot irrigate": return "Can't irrigate here.";
    case "irrigated": return "Already irrigated.";
    case "needs water": return "Needs water beside it: a river, the sea or irrigation.";
    case "cannot mine": return "Can't mine here.";
    case "has mine": return "Already has a mine.";
    case "has fortress": return "Already has a fortress.";
    case "in city": return "Not inside a city.";
    case "no fortress here": return "No fortress can be built here.";
    case "no pollution": return "No pollution here.";
    default: return `${capitalise(reason)}.`;
  }
}
