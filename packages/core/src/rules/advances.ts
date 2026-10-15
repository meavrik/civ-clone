/**
 * The tech tree. Each advance has at most two prerequisites, as in the
 * original. Names are the historical concepts; the dependency graph here is
 * reconstructed from memory and should be verified line by line against
 * FreeCiv's civ1 ruleset before the AI phase, since beeline choices depend on
 * it. Changing data here needs no code changes.
 */
export interface AdvanceRule {
  id: string;
  name: string;
  requires: string[];
  /** Government unlocked by this advance, if any. */
  government?: string;
}

const A = (id: string, name: string, requires: string[], extra: Partial<AdvanceRule> = {}): AdvanceRule => ({
  id, name, requires, ...extra,
});

export const ADVANCES: AdvanceRule[] = [
  // ---- no prerequisites -----------------------------------------------------
  A("alphabet", "Alphabet", []),
  A("bronze_working", "Bronze Working", []),
  A("ceremonial_burial", "Ceremonial Burial", []),
  A("horseback_riding", "Horseback Riding", []),
  A("masonry", "Masonry", []),
  A("pottery", "Pottery", []),
  // ---- ancient ---------------------------------------------------------------
  A("writing", "Writing", ["alphabet"]),
  A("code_of_laws", "Code of Laws", ["alphabet"]),
  A("map_making", "Map Making", ["alphabet"]),
  A("currency", "Currency", ["bronze_working"]),
  A("iron_working", "Iron Working", ["bronze_working"]),
  A("the_wheel", "The Wheel", ["horseback_riding"]),
  A("mathematics", "Mathematics", ["alphabet", "masonry"]),
  A("mysticism", "Mysticism", ["ceremonial_burial", "alphabet"]),
  A("monarchy", "Monarchy", ["ceremonial_burial", "code_of_laws"], { government: "monarchy" }),
  A("literacy", "Literacy", ["writing", "code_of_laws"]),
  A("trade", "Trade", ["pottery", "code_of_laws"]),
  A("construction", "Construction", ["pottery", "currency"]),
  A("philosophy", "Philosophy", ["mysticism", "literacy"]),
  A("astronomy", "Astronomy", ["mysticism", "mathematics"]),
  A("the_republic", "The Republic", ["code_of_laws", "literacy"], { government: "republic" }),
  A("bridge_building", "Bridge Building", ["iron_working", "construction"]),
  A("engineering", "Engineering", ["the_wheel", "construction"]),
  A("religion", "Religion", ["philosophy", "writing"]),
  A("monotheism", "Monotheism", ["philosophy", "religion"]),
  A("medicine", "Medicine", ["philosophy", "trade"]),
  A("university", "University", ["astronomy", "philosophy"]),
  A("navigation", "Navigation", ["map_making", "astronomy"]),
  A("feudalism", "Feudalism", ["masonry", "monarchy"]),
  A("chivalry", "Chivalry", ["feudalism", "horseback_riding"]),
  A("banking", "Banking", ["trade", "the_republic"]),
  A("invention", "Invention", ["literacy", "engineering"]),
  A("physics", "Physics", ["navigation", "literacy"]),
  A("gunpowder", "Gunpowder", ["invention", "iron_working"]),
  A("theory_of_gravity", "Theory of Gravity", ["astronomy", "physics"]),
  A("magnetism", "Magnetism", ["navigation", "physics"]),
  A("metallurgy", "Metallurgy", ["gunpowder", "university"]),
  A("chemistry", "Chemistry", ["university", "medicine"]),
  A("democracy", "Democracy", ["banking", "invention"], { government: "democracy" }),
  A("steam_engine", "Steam Engine", ["physics", "invention"]),
  A("explosives", "Explosives", ["gunpowder", "chemistry"]),
  A("conscription", "Conscription", ["the_republic", "metallurgy"]),
  A("electricity", "Electricity", ["metallurgy", "magnetism"]),
  A("railroad", "Railroad", ["bridge_building", "steam_engine"]),
  A("industrialization", "Industrialization", ["railroad", "banking"]),
  A("atomic_theory", "Atomic Theory", ["theory_of_gravity", "physics"]),
  A("the_corporation", "The Corporation", ["industrialization", "electricity"]),
  A("communism", "Communism", ["philosophy", "industrialization"], { government: "communism" }),
  A("steel", "Steel", ["electricity", "industrialization"]),
  A("electronics", "Electronics", ["electricity", "engineering"]),
  A("refining", "Refining", ["chemistry", "the_corporation"]),
  A("combustion", "Combustion", ["refining", "explosives"]),
  A("automobile", "Automobile", ["combustion", "steel"]),
  A("flight", "Flight", ["combustion", "theory_of_gravity"]),
  A("mass_production", "Mass Production", ["automobile", "the_corporation"]),
  A("genetic_engineering", "Genetic Engineering", ["medicine", "the_corporation"]),
  A("advanced_flight", "Advanced Flight", ["flight", "electricity"]),
  A("labor_union", "Labor Union", ["mass_production", "communism"]),
  A("recycling", "Recycling", ["mass_production", "democracy"]),
  A("computers", "Computers", ["electronics", "mathematics"]),
  A("nuclear_fission", "Nuclear Fission", ["atomic_theory", "mass_production"]),
  A("rocketry", "Rocketry", ["advanced_flight", "electronics"]),
  A("nuclear_power", "Nuclear Power", ["nuclear_fission", "electronics"]),
  A("space_flight", "Space Flight", ["computers", "rocketry"]),
  A("plastics", "Plastics", ["refining", "space_flight"]),
  A("superconductor", "Superconductor", ["nuclear_power", "computers"]),
  A("robotics", "Robotics", ["plastics", "computers"]),
  A("fusion_power", "Fusion Power", ["nuclear_power", "superconductor"]),
  A("future_tech", "Future Tech.", ["fusion_power", "genetic_engineering"]),
];

export const ADVANCE_BY_ID: Record<string, AdvanceRule> = Object.fromEntries(ADVANCES.map((a) => [a.id, a]));

export function advance(id: string): AdvanceRule {
  const a = ADVANCE_BY_ID[id];
  if (!a) throw new Error(`unknown advance ${id}`);
  return a;
}

export function knows(known: ReadonlySet<string> | string[], id: string): boolean {
  return Array.isArray(known) ? known.includes(id) : known.has(id);
}

/** Advances researchable now: all prerequisites known, not yet known. */
export function availableAdvances(known: string[]): AdvanceRule[] {
  const k = new Set(known);
  return ADVANCES.filter((a) => !k.has(a.id) && a.requires.every((r) => k.has(r)));
}

/** Beakers needed for the next advance: grows with each advance known. */
export function researchCost(knownCount: number, difficulty: number): number {
  const perTech = [8, 10, 12, 14, 16][difficulty] ?? 12;
  return (knownCount + 1) * perTech;
}
