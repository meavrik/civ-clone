import { difficultyRule } from "./difficulty.js";

/**
 * The tech tree. Each advance has at most two prerequisites, as in the
 * original. Names are the historical concepts; the 1991 graph was checked
 * edge by edge against FreeCiv's civ1 ruleset (67 advances; Future Tech. is
 * our own cap). The Wheel and Mysticism have a single root, and there is no
 * Monotheism in this era. New games play an extended tree (`ADVANCES`);
 * games saved before version 9 keep the 1991 one (`CLASSIC_ADVANCES`, the
 * `classicAdvances` flag). Code reaches the right one with `advancesFor`.
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

export const CLASSIC_ADVANCES: AdvanceRule[] = [
  // ---- no prerequisites -----------------------------------------------------
  A("alphabet", "Alphabet", []),
  A("bronze_working", "Bronze Working", []),
  A("ceremonial_burial", "Ceremonial Burial", []),
  A("horseback_riding", "Horseback Riding", []),
  A("masonry", "Masonry", []),
  A("pottery", "Pottery", []),
  A("the_wheel", "The Wheel", []),
  // ---- ancient ---------------------------------------------------------------
  A("writing", "Writing", ["alphabet"]),
  A("code_of_laws", "Code of Laws", ["alphabet"]),
  A("map_making", "Map Making", ["alphabet"]),
  A("currency", "Currency", ["bronze_working"]),
  A("iron_working", "Iron Working", ["bronze_working"]),
  A("mathematics", "Mathematics", ["alphabet", "masonry"]),
  A("mysticism", "Mysticism", ["ceremonial_burial"]),
  A("monarchy", "Monarchy", ["ceremonial_burial", "code_of_laws"], { government: "monarchy" }),
  A("literacy", "Literacy", ["writing", "code_of_laws"]),
  A("trade", "Trade", ["currency", "code_of_laws"]),
  A("construction", "Construction", ["masonry", "currency"]),
  A("philosophy", "Philosophy", ["mysticism", "literacy"]),
  A("astronomy", "Astronomy", ["mysticism", "mathematics"]),
  A("the_republic", "The Republic", ["code_of_laws", "literacy"], { government: "republic" }),
  A("bridge_building", "Bridge Building", ["iron_working", "construction"]),
  A("engineering", "Engineering", ["the_wheel", "construction"]),
  A("religion", "Religion", ["philosophy", "writing"]),
  A("medicine", "Medicine", ["philosophy", "trade"]),
  A("university", "University", ["astronomy", "philosophy"]),
  A("navigation", "Navigation", ["map_making", "astronomy"]),
  A("feudalism", "Feudalism", ["masonry", "monarchy"]),
  A("chivalry", "Chivalry", ["feudalism", "horseback_riding"]),
  A("banking", "Banking", ["trade", "the_republic"]),
  A("invention", "Invention", ["literacy", "engineering"]),
  A("physics", "Physics", ["mathematics", "navigation"]),
  A("gunpowder", "Gunpowder", ["invention", "iron_working"]),
  A("theory_of_gravity", "Theory of Gravity", ["astronomy", "university"]),
  A("magnetism", "Magnetism", ["navigation", "physics"]),
  A("metallurgy", "Metallurgy", ["gunpowder", "university"]),
  A("chemistry", "Chemistry", ["university", "medicine"]),
  A("democracy", "Democracy", ["philosophy", "literacy"], { government: "democracy" }),
  A("steam_engine", "Steam Engine", ["physics", "invention"]),
  A("explosives", "Explosives", ["gunpowder", "chemistry"]),
  A("conscription", "Conscription", ["the_republic", "explosives"]),
  A("electricity", "Electricity", ["metallurgy", "magnetism"]),
  A("railroad", "Railroad", ["bridge_building", "steam_engine"]),
  A("industrialization", "Industrialization", ["railroad", "banking"]),
  A("atomic_theory", "Atomic Theory", ["theory_of_gravity", "physics"]),
  A("the_corporation", "The Corporation", ["banking", "industrialization"]),
  A("communism", "Communism", ["philosophy", "industrialization"], { government: "communism" }),
  A("steel", "Steel", ["metallurgy", "industrialization"]),
  A("electronics", "Electronics", ["electricity", "engineering"]),
  A("refining", "Refining", ["chemistry", "the_corporation"]),
  A("combustion", "Combustion", ["refining", "explosives"]),
  A("automobile", "Automobile", ["combustion", "steel"]),
  A("flight", "Flight", ["combustion", "physics"]),
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
  A("superconductor", "Superconductor", ["plastics", "mass_production"]),
  A("robotics", "Robotics", ["plastics", "computers"]),
  A("fusion_power", "Fusion Power", ["nuclear_power", "superconductor"]),
  A("future_tech", "Future Tech.", ["fusion_power", "genetic_engineering"]),
];

/**
 * The tree new games play, our additions to the 1991 one (asked for): Weaving (cloth for
 * the cold: arctic squares stop wearing units down) and Animal Husbandry (pastures: more food
 * from Horses, Game and Seals; Horseback Riding now needs it) at the start, and in place of
 * Future Tech. the advances the original never saw, each with an improvement of its own.
 */
export const ADVANCES: AdvanceRule[] = (() => {
  const tree = CLASSIC_ADVANCES
    .filter((a) => a.id !== "future_tech")
    .map((a) => (a.id === "horseback_riding" ? { ...a, requires: ["animal_husbandry"] } : a));
  const at = (id: string) => tree.findIndex((a) => a.id === id);
  tree.splice(at("horseback_riding"), 0, A("animal_husbandry", "Animal Husbandry", []));
  tree.splice(at("writing"), 0, A("weaving", "Weaving", ["pottery"]));
  tree.push(
    A("the_internet", "The Internet", ["computers", "the_corporation"]),
    A("mobile_phones", "Mobile Phones", ["the_internet", "plastics"]),
    A("renewable_energy", "Renewable Energy", ["recycling", "superconductor"]),
    A("artificial_intelligence", "Artificial Intelligence", ["robotics", "the_internet"]),
    A("quantum_computing", "Quantum Computing", ["superconductor", "artificial_intelligence"]),
  );
  return tree;
})();

/** The tree a game plays: the 1991 one for old saves, else ours. */
export function advancesFor(state: { classicAdvances?: boolean | undefined }): AdvanceRule[] {
  return state.classicAdvances ? CLASSIC_ADVANCES : ADVANCES;
}

/** Every advance of either tree by id, for names; prerequisites differ between the trees, so read those from `advancesFor`. */
export const ADVANCE_BY_ID: Record<string, AdvanceRule> = Object.fromEntries([...CLASSIC_ADVANCES, ...ADVANCES].map((a) => [a.id, a]));

export function advance(id: string): AdvanceRule {
  const a = ADVANCE_BY_ID[id];
  if (!a) throw new Error(`unknown advance ${id}`);
  return a;
}

export function knows(known: ReadonlySet<string> | string[], id: string): boolean {
  return Array.isArray(known) ? known.includes(id) : known.has(id);
}

/** Advances researchable now in a tree (`advancesFor(state)`): all prerequisites known, not yet known. */
export function availableAdvances(known: string[], tree: readonly AdvanceRule[]): AdvanceRule[] {
  const k = new Set(known);
  return tree.filter((a) => !k.has(a.id) && a.requires.every((r) => k.has(r)));
}

/** Beakers needed for the next advance: grows with each advance known. */
export function researchCost(knownCount: number, difficulty: number): number {
  return (knownCount + 1) * difficultyRule(difficulty).techCost;
}
