export type UnitDomain = "land" | "sea" | "air";

export interface UnitTypeRule {
  id: string;
  name: string;
  attack: number;
  defense: number;
  moves: number;
  cost: number;
  domain: UnitDomain;
  /** Tiles seen around the unit (1 = adjacent only). */
  sight: number;
  /** Carrying capacity for sea units. */
  capacity?: number;
  /** Air units must return within this many turns. */
  fuel?: number;
  /** Required advance id; wired to the tech tree in phase 4. */
  requires?: string;
  flags?: ("settler" | "diplomat" | "caravan" | "ignoreZoc" | "nuclear")[];
}

const U = (
  id: string,
  name: string,
  attack: number,
  defense: number,
  moves: number,
  cost: number,
  domain: UnitDomain = "land",
  extra: Partial<UnitTypeRule> = {},
): UnitTypeRule => ({ id, name, attack, defense, moves, cost, domain, sight: 1, ...extra });

/** Stats follow FreeCiv's civ1 ruleset (attack/defense/moves/cost). */
export const UNIT_TYPES: UnitTypeRule[] = [
  U("settlers", "Settlers", 0, 1, 1, 40, "land", { flags: ["settler"] }),
  U("militia", "Militia", 1, 1, 1, 10),
  U("phalanx", "Phalanx", 1, 2, 1, 20, "land", { requires: "bronze_working" }),
  U("legion", "Legion", 3, 1, 1, 20, "land", { requires: "iron_working" }),
  U("cavalry", "Cavalry", 2, 1, 2, 20, "land", { requires: "horseback_riding" }),
  U("chariot", "Chariot", 4, 1, 2, 40, "land", { requires: "the_wheel" }),
  U("catapult", "Catapult", 6, 1, 1, 40, "land", { requires: "mathematics" }),
  U("knights", "Knights", 4, 2, 2, 40, "land", { requires: "chivalry" }),
  U("musketeers", "Musketeers", 2, 3, 1, 30, "land", { requires: "gunpowder" }),
  U("cannon", "Cannon", 8, 1, 1, 40, "land", { requires: "metallurgy" }),
  U("riflemen", "Riflemen", 3, 5, 1, 30, "land", { requires: "conscription" }),
  U("mech_inf", "Mech. Inf.", 6, 6, 3, 50, "land", { requires: "labor_union" }),
  U("armor", "Armor", 10, 5, 3, 80, "land", { requires: "automobile" }),
  U("artillery", "Artillery", 12, 2, 2, 60, "land", { requires: "robotics" }),
  U("diplomat", "Diplomat", 0, 0, 2, 30, "land", { requires: "writing", flags: ["diplomat", "ignoreZoc"] }),
  U("caravan", "Caravan", 0, 1, 1, 50, "land", { requires: "trade", flags: ["caravan", "ignoreZoc"] }),
  U("trireme", "Trireme", 1, 0, 3, 40, "sea", { requires: "map_making", capacity: 2 }),
  U("sail", "Sail", 1, 1, 3, 40, "sea", { requires: "navigation", capacity: 3 }),
  U("frigate", "Frigate", 2, 2, 3, 40, "sea", { requires: "magnetism", capacity: 4 }),
  U("ironclad", "Ironclad", 4, 4, 4, 60, "sea", { requires: "steam_engine" }),
  U("cruiser", "Cruiser", 6, 6, 6, 80, "sea", { requires: "combustion", sight: 2 }),
  U("battleship", "Battleship", 18, 12, 4, 160, "sea", { requires: "steel", sight: 2 }),
  U("submarine", "Submarine", 8, 2, 3, 50, "sea", { requires: "mass_production", sight: 2 }),
  U("carrier", "Carrier", 1, 12, 5, 160, "sea", { requires: "advanced_flight", capacity: 8, sight: 2 }),
  U("transport", "Transport", 0, 3, 4, 50, "sea", { requires: "industrialization", capacity: 8 }),
  U("fighter", "Fighter", 4, 2, 10, 60, "air", { requires: "flight", fuel: 1, sight: 2 }),
  U("bomber", "Bomber", 12, 1, 8, 120, "air", { requires: "advanced_flight", fuel: 2, sight: 2 }),
  U("nuclear", "Nuclear", 99, 0, 16, 160, "air", { requires: "rocketry", fuel: 1, flags: ["nuclear"] }),
];

export const UNIT_BY_ID: Record<string, UnitTypeRule> = Object.fromEntries(
  UNIT_TYPES.map((u) => [u.id, u]),
);

export function unitType(id: string): UnitTypeRule {
  const t = UNIT_BY_ID[id];
  if (!t) throw new Error(`unknown unit type ${id}`);
  return t;
}
