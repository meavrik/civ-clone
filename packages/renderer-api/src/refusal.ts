import { getTile, TERRAIN_NAMES, unitById, unitType, type GameState } from "@civ/core";

/** What a note on the map says and which square it points at (the unit that was refused). */
export interface Callout {
  x: number;
  y: number;
  text: string;
}

const capitalise = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * Why a unit cannot make a move, in a sentence or two for the note beside it: what stands in
 * the way and, where there is one, the way round it. `reason` is the code the move came back with.
 */
export function moveRefusal(state: GameState, unitId: number, dx: number, dy: number, reason: string): string {
  const u = unitById(state, unitId);
  if (!u) return `${capitalise(reason)}.`;
  const type = unitType(u.type);
  const name = type.name;
  const to = getTile(state.map, u.x + dx, u.y + dy);
  const ground = to ? TERRAIN_NAMES[to.terrain] : "";
  switch (reason) {
    case "no-moves":
    case "no moves left":
      return `No moves left for ${name} this turn.`;
    case "off-map":
      return "Nothing lies beyond the pole.";
    case "terrain":
      if (type.domain === "sea") return `Ships keep to the sea: ${name} can put in only at our own cities.`;
      return `${name} cannot cross the ${ground.toLowerCase()}. A ship with room must carry it.`;
    case "full":
      return "No room aboard: the ship there is full.";
    case "rough":
      return `${name} cannot cross the ${ground.toLowerCase()} without a road: wheels need one.`;
    case "steep":
      return `Only settlers climb the ${ground.toLowerCase()} off the road. Build a road over them first.`;
    case "zoc":
      return `Zone of control: no step from one square beside an enemy to another. Go round, or attack.`;
    case "this unit cannot attack":
      return `${name} cannot attack.`;
    case "land units cannot attack at sea":
      return `${name} cannot attack ships at sea.`;
    case "only land units take cities":
      return "Only land units can take a city.";
    case "barbarian city":
      return `Barbarians keep no secrets worth stealing: ${name} has no business there.`;
    default:
      return `${capitalise(reason)}.`;
  }
}
