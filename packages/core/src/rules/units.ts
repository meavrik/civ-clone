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
  /** Hit points at full health. */
  hp: number;
  /** Hit points each round it wins takes off the enemy. */
  firepower: number;
  /** Enters rough ground (mountains, jungle, swamp, arctic) only along a road. Not a flag: flags mark special roles. */
  wheeled?: boolean;
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
): UnitTypeRule => ({ id, name, attack, defense, moves, cost, domain, sight: 1, hp: 10, firepower: 1, ...extra });

/**
 * Stats follow FreeCiv's civ1 ruleset (attack/defense/moves/cost). Hit points
 * and firepower are our own departure: the 1991 game (and that ruleset, with
 * 10 hp and firepower 10) settles a fight in one roll, while here fights go
 * in rounds, so later units are tougher (10 hp ancient, 20 gunpowder, 30-40
 * mechanised and steel) and the heaviest guns hit for 2. Wheeled units
 * (chariots, siege guns, vehicles) need roads over rough ground, another
 * departure: in the original every land unit goes everywhere.
 */
export const UNIT_TYPES: UnitTypeRule[] = [
  U("settlers", "Settlers", 0, 1, 1, 40, "land", { flags: ["settler"] }),
  U("militia", "Militia", 1, 1, 1, 10),
  U("phalanx", "Phalanx", 1, 2, 1, 20, "land", { requires: "bronze_working" }),
  U("legion", "Legion", 3, 1, 1, 20, "land", { requires: "iron_working" }),
  U("cavalry", "Cavalry", 2, 1, 2, 20, "land", { requires: "horseback_riding" }),
  U("chariot", "Chariot", 4, 1, 2, 40, "land", { requires: "the_wheel", wheeled: true }),
  U("catapult", "Catapult", 6, 1, 1, 40, "land", { requires: "mathematics", wheeled: true }),
  U("knights", "Knights", 4, 2, 2, 40, "land", { requires: "chivalry" }),
  U("musketeers", "Musketeers", 2, 3, 1, 30, "land", { requires: "gunpowder", hp: 20 }),
  U("cannon", "Cannon", 8, 1, 1, 40, "land", { requires: "metallurgy", hp: 20, wheeled: true }),
  U("riflemen", "Riflemen", 3, 5, 1, 30, "land", { requires: "conscription", hp: 20 }),
  U("mech_inf", "Mech. Inf.", 6, 6, 3, 50, "land", { requires: "labor_union", hp: 30, wheeled: true }),
  U("armor", "Armor", 10, 5, 3, 80, "land", { requires: "automobile", hp: 30, wheeled: true }),
  U("artillery", "Artillery", 12, 2, 2, 60, "land", { requires: "robotics", hp: 20, firepower: 2, wheeled: true }),
  U("diplomat", "Diplomat", 0, 0, 2, 30, "land", { requires: "writing", flags: ["diplomat", "ignoreZoc"] }),
  U("caravan", "Caravan", 0, 1, 1, 50, "land", { requires: "trade", flags: ["caravan", "ignoreZoc"] }),
  U("trireme", "Trireme", 1, 0, 3, 40, "sea", { requires: "map_making", capacity: 2 }),
  U("sail", "Sail", 1, 1, 3, 40, "sea", { requires: "navigation", capacity: 3 }),
  U("frigate", "Frigate", 2, 2, 3, 40, "sea", { requires: "magnetism", capacity: 4, hp: 20 }),
  U("ironclad", "Ironclad", 4, 4, 4, 60, "sea", { requires: "steam_engine", hp: 30 }),
  U("cruiser", "Cruiser", 6, 6, 6, 80, "sea", { requires: "combustion", sight: 2, hp: 30, firepower: 2 }),
  U("battleship", "Battleship", 18, 12, 4, 160, "sea", { requires: "steel", sight: 2, hp: 40, firepower: 2 }),
  U("submarine", "Submarine", 8, 2, 3, 50, "sea", { requires: "mass_production", sight: 2, hp: 30, firepower: 2 }),
  U("carrier", "Carrier", 1, 12, 5, 160, "sea", { requires: "advanced_flight", capacity: 8, sight: 2, hp: 40, firepower: 2 }),
  U("transport", "Transport", 0, 3, 4, 50, "sea", { requires: "industrialization", capacity: 8, hp: 30 }),
  U("fighter", "Fighter", 4, 2, 10, 60, "air", { requires: "flight", fuel: 1, sight: 2, hp: 20, firepower: 2 }),
  U("bomber", "Bomber", 12, 1, 8, 120, "air", { requires: "advanced_flight", fuel: 2, sight: 2, hp: 20, firepower: 2 }),
  U("nuclear", "Nuclear", 99, 0, 16, 160, "air", { requires: "rocketry", fuel: 1, flags: ["nuclear"] }),
];

/**
 * Share of full hit points recovered by a unit that spends its whole turn
 * without moving: in the field, in a fortress, in a city. Barracks heal land
 * units completely.
 */
export const HEALING = { field: 0.1, fortress: 0.25, city: 1 / 3 } as const;

/** With classic combat (old saves, `classicCombat`) every unit has these: one round settles a fight. */
export const CLASSIC_HP = 10;
export const CLASSIC_FIREPOWER = 10;

export const UNIT_BY_ID: Record<string, UnitTypeRule> = Object.fromEntries(
  UNIT_TYPES.map((u) => [u.id, u]),
);

export function unitType(id: string): UnitTypeRule {
  const t = UNIT_BY_ID[id];
  if (!t) throw new Error(`unknown unit type ${id}`);
  return t;
}
