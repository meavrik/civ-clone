/**
 * City improvements. Costs are in shields, upkeep in gold per turn, both
 * checked against FreeCiv's civ1 ruleset (no Sewer, Stock Exchange or
 * Harbour in this era). Effects are declared as data and interpreted in
 * cities.ts so the AI can reason about them without special cases. Wonders
 * live in their own file.
 */
export interface BuildingRule {
  id: string;
  name: string;
  /** What it does, in a line: shown when a city finishes one. */
  text: string;
  cost: number;
  upkeep: number;
  requires?: string; // advance id, wired in phase 4
  /** Unhappy citizens made content. */
  content?: number;
  /** Multipliers, in percent added (50 = +50%). */
  shieldsPct?: number;
  taxPct?: number;
  luxPct?: number;
  sciencePct?: number;
  /** Halves corruption / waste. */
  halveCorruption?: boolean;
  /** Keeps half the food box on growth. */
  granary?: boolean;
  /** Size cap raised from 10 to unlimited. */
  aqueduct?: boolean;
  /** New land units start veteran. */
  barracks?: boolean;
  /** Defence multiplier vs land attacks. */
  wallsPct?: number;
  /** Required building. */
  needs?: string;
  /** Pollution cut, percent: Mass Transit removes population pollution; the rest cut production pollution (best one counts). */
  pollutionPct?: number;
}

const B = (id: string, name: string, cost: number, upkeep: number, text: string, extra: Partial<BuildingRule> = {}): BuildingRule => ({
  id, name, text, cost, upkeep, ...extra,
});

export const BUILDINGS: BuildingRule[] = [
  B("palace", "Palace", 200, 0, "The seat of government: the farther a city lies from it, the more trade corruption takes.", { requires: "masonry" }),
  B("barracks", "Barracks", 40, 1, "Land units trained here start as veterans.", { barracks: true }),
  B("granary", "Granary", 60, 1, "Half the food stays in store when the city grows.", { requires: "pottery", granary: true }),
  B("temple", "Temple", 40, 1, "Calms one unhappy citizen.", { requires: "ceremonial_burial", content: 1 }),
  B("marketplace", "Marketplace", 80, 1, "Adds half again to the city's tax and luxuries.", { requires: "currency", taxPct: 50, luxPct: 50 }),
  B("library", "Library", 80, 1, "Adds half again to the city's science.", { requires: "writing", sciencePct: 50 }),
  B("courthouse", "Courthouse", 80, 1, "Halves the trade lost to corruption.", { requires: "code_of_laws", halveCorruption: true }),
  B("city_walls", "City Walls", 120, 2, "Triples the defence of the city against attacks by land.", { requires: "masonry", wallsPct: 200 }),
  B("aqueduct", "Aqueduct", 120, 2, "Lets the city grow past size 10.", { requires: "construction", aqueduct: true }),
  B("bank", "Bank", 120, 3, "Adds half again to tax and luxuries, on top of the marketplace.", { requires: "banking", taxPct: 50, luxPct: 50, needs: "marketplace" }),
  B("cathedral", "Cathedral", 160, 3, "Calms three unhappy citizens.", { requires: "religion", content: 3 }),
  B("university", "University", 160, 3, "Adds half again to science, on top of the library.", { requires: "university", sciencePct: 50, needs: "library" }),
  B("mass_transit", "Mass Transit", 160, 4, "Ends the pollution a large population makes.", { requires: "mass_production", pollutionPct: 100 }),
  B("colosseum", "Colosseum", 100, 4, "Calms three unhappy citizens.", { requires: "construction", content: 3 }),
  B("factory", "Factory", 200, 4, "Adds half again to the city's shields, and to its pollution.", { requires: "industrialization", shieldsPct: 50 }),
  B("mfg_plant", "Mfg. Plant", 320, 6, "Adds half again to shields, on top of the factory.", { requires: "robotics", shieldsPct: 50, needs: "factory" }),
  B("sdi_defense", "SDI Defense", 200, 4, "Stops nuclear attacks within three squares of the city.", { requires: "superconductor" }),
  B("recycling_center", "Recycling Center", 200, 2, "Cuts the pollution from production by two thirds.", { requires: "recycling", pollutionPct: 66 }),
  B("power_plant", "Power Plant", 160, 4, "Adds half again to the shields of the factory.", { requires: "refining", shieldsPct: 50, needs: "factory" }),
  B("hydro_plant", "Hydro Plant", 240, 4, "Adds half again to the shields of the factory and halves its pollution.", { requires: "electronics", shieldsPct: 50, needs: "factory", pollutionPct: 50 }),
  B("nuclear_plant", "Nuclear Plant", 240, 2, "Adds half again to the shields of the factory and halves its pollution.", { requires: "nuclear_power", shieldsPct: 50, needs: "factory", pollutionPct: 50 }),
  // Our own, from the modern advances of the extended tree (games on the 1991 tree never reach them).
  B("data_center", "Data Center", 160, 3, "Adds half again to the city's science, on top of the library.", { requires: "the_internet", sciencePct: 50, needs: "library" }),
  B("cell_tower", "Cell Tower", 60, 1, "Calms one unhappy citizen: friends and news are a call away.", { requires: "mobile_phones", content: 1 }),
  B("solar_plant", "Solar Plant", 200, 2, "Adds a quarter to the shields of the factory and halves its pollution.", { requires: "renewable_energy", shieldsPct: 25, needs: "factory", pollutionPct: 50 }),
  B("automated_office", "Automated Office", 120, 2, "Halves the trade lost to corruption, on top of a courthouse.", { requires: "artificial_intelligence", halveCorruption: true }),
  B("quantum_lab", "Quantum Lab", 240, 4, "Adds half again to science, on top of the data center.", { requires: "quantum_computing", sciencePct: 50, needs: "data_center" }),
];

export const BUILDING_BY_ID: Record<string, BuildingRule> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export function building(id: string): BuildingRule {
  const b = BUILDING_BY_ID[id];
  if (!b) throw new Error(`unknown building ${id}`);
  return b;
}
