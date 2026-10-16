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

const B = (id: string, name: string, cost: number, upkeep: number, extra: Partial<BuildingRule> = {}): BuildingRule => ({
  id, name, cost, upkeep, ...extra,
});

export const BUILDINGS: BuildingRule[] = [
  B("palace", "Palace", 200, 0, { requires: "masonry" }),
  B("barracks", "Barracks", 40, 1, { barracks: true }),
  B("granary", "Granary", 60, 1, { requires: "pottery", granary: true }),
  B("temple", "Temple", 40, 1, { requires: "ceremonial_burial", content: 1 }),
  B("marketplace", "Marketplace", 80, 1, { requires: "currency", taxPct: 50, luxPct: 50 }),
  B("library", "Library", 80, 1, { requires: "writing", sciencePct: 50 }),
  B("courthouse", "Courthouse", 80, 1, { requires: "code_of_laws", halveCorruption: true }),
  B("city_walls", "City Walls", 120, 2, { requires: "masonry", wallsPct: 200 }),
  B("aqueduct", "Aqueduct", 120, 2, { requires: "construction", aqueduct: true }),
  B("bank", "Bank", 120, 3, { requires: "banking", taxPct: 50, luxPct: 50, needs: "marketplace" }),
  B("cathedral", "Cathedral", 160, 3, { requires: "religion", content: 3 }),
  B("university", "University", 160, 3, { requires: "university", sciencePct: 50, needs: "library" }),
  B("mass_transit", "Mass Transit", 160, 4, { requires: "mass_production", pollutionPct: 100 }),
  B("colosseum", "Colosseum", 100, 4, { requires: "construction", content: 3 }),
  B("factory", "Factory", 200, 4, { requires: "industrialization", shieldsPct: 50 }),
  B("mfg_plant", "Mfg. Plant", 320, 6, { requires: "robotics", shieldsPct: 50, needs: "factory" }),
  B("sdi_defense", "SDI Defense", 200, 4, { requires: "superconductor" }),
  B("recycling_center", "Recycling Center", 200, 2, { requires: "recycling", pollutionPct: 66 }),
  B("power_plant", "Power Plant", 160, 4, { requires: "refining", shieldsPct: 50, needs: "factory" }),
  B("hydro_plant", "Hydro Plant", 240, 4, { requires: "electronics", shieldsPct: 50, needs: "factory", pollutionPct: 50 }),
  B("nuclear_plant", "Nuclear Plant", 240, 2, { requires: "nuclear_power", shieldsPct: 50, needs: "factory", pollutionPct: 50 }),
];

export const BUILDING_BY_ID: Record<string, BuildingRule> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export function building(id: string): BuildingRule {
  const b = BUILDING_BY_ID[id];
  if (!b) throw new Error(`unknown building ${id}`);
  return b;
}
