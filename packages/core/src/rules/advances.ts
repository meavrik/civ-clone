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
  /** The age it belongs to, as the New Technology window names it (ours: the original had no eras). */
  era: Era;
  /** What it is, in a sentence of our own, for the New Technology window. */
  text: string;
}

export const ERAS = ["Ancient", "Classical", "Medieval", "Renaissance", "Industrial", "Modern", "Information", "Future"] as const;
export type Era = (typeof ERAS)[number];

/** Each advance's era and description (asked for 2026-10-23 with the New Technology window). */
const ABOUT: Record<string, [Era, string]> = {
  alphabet: ["Ancient", "A small set of signs, each standing for a sound, lets any word be written down and read back."],
  bronze_working: ["Ancient", "Copper melted with a little tin gives bronze: harder tools, sharper blades and the first fine castings."],
  ceremonial_burial: ["Ancient", "Laying the dead to rest with care and offerings binds a people together in shared belief."],
  animal_husbandry: ["Ancient", "Herds of sheep, goats and cattle, tamed and bred, give a steady supply of meat, milk, wool and hides."],
  horseback_riding: ["Ancient", "Riders on tamed horses cover ground far faster than anyone on foot, in peace and in war."],
  masonry: ["Ancient", "Cutting and fitting stone raises walls, homes and monuments that last for ages."],
  pottery: ["Ancient", "Clay shaped and fired in a kiln makes jars to carry water and keep grain through the winter."],
  the_wheel: ["Ancient", "Wheels under a cart let oxen haul heavy loads, and soon pull chariots into battle."],
  weaving: ["Ancient", "Thread crossed on a loom becomes cloth: warm clothing against the cold, and goods to trade."],
  writing: ["Ancient", "Marks on clay and papyrus keep records, laws and stories long after the speaker is gone."],
  code_of_laws: ["Ancient", "Rules set down for all to see replace the whims of chiefs with justice that can be known."],
  map_making: ["Ancient", "Charts of coasts and landmarks let sailors plan a voyage and find their way home again."],
  currency: ["Ancient", "Coins of a set weight and worth make buying, selling and paying taxes simple."],
  iron_working: ["Ancient", "Iron ore smelted in a hot forge gives a metal tougher, and far more common, than bronze."],
  mathematics: ["Ancient", "Numbers, counting frames and geometry let builders measure the land and plan great works."],
  mysticism: ["Ancient", "Seers read meaning in the stars and the spirits, and the temples gain a deeper hold on the people."],
  monarchy: ["Ancient", "A crowned ruler, upheld by law and custom, holds the realm together from one generation to the next."],
  literacy: ["Classical", "Reading spreads beyond a few scribes, and libraries gather the knowledge of the age."],
  trade: ["Classical", "Caravans carry goods between distant cities, and with them news, ideas and wealth."],
  construction: ["Classical", "Arches, mortar and wooden cranes let builders raise great halls, arenas and forts."],
  philosophy: ["Classical", "Thinkers question everything and argue it out in public, seeking the truth by reason."],
  astronomy: ["Classical", "Patient watching of the heavens charts the stars and planets and keeps the calendar true."],
  the_republic: ["Classical", "Citizens choose their leaders and vote on the laws in a senate of their own."],
  bridge_building: ["Classical", "Stone arches carry roads across rivers, joining lands the water kept apart."],
  engineering: ["Classical", "Gears, pulleys and careful design raise aqueducts and machines of great strength."],
  religion: ["Medieval", "Organised faith, with its priests and great temples, gives the people meaning and comfort."],
  medicine: ["Classical", "Healers study herbs and the body, and learn to treat sickness rather than only pray."],
  university: ["Medieval", "Scholars gather in halls of learning to teach, to dispute and to push knowledge further."],
  navigation: ["Renaissance", "Instruments that sight the sun and stars let ships cross open ocean and know where they are."],
  feudalism: ["Medieval", "Lords grant land to their knights in return for loyalty and service in war."],
  chivalry: ["Medieval", "Armoured knights on horseback, bound by a code of honour, rule the battlefield."],
  banking: ["Renaissance", "Counting houses lend, keep and move money, and trade grows on credit."],
  invention: ["Renaissance", "Workshops full of sketches and models turn bold ideas into working machines."],
  physics: ["Renaissance", "Experiments with levers, pendulums and weights reveal the rules that move all things."],
  gunpowder: ["Renaissance", "A mix of saltpetre, charcoal and sulphur drives shot from muskets and cannon."],
  theory_of_gravity: ["Renaissance", "One force pulls the apple to the ground and holds the planets in their paths."],
  magnetism: ["Renaissance", "The lodestone and the compass needle point north, guiding ships in any weather."],
  metallurgy: ["Renaissance", "Foundries master the casting of metal, from fine tools to great cannon."],
  chemistry: ["Renaissance", "Laboratories break matter down into its elements and learn how they combine."],
  democracy: ["Renaissance", "Every citizen has a vote, and the government answers to the people."],
  steam_engine: ["Industrial", "Steam under pressure turns wheels and drives machines, freeing work from muscle and wind."],
  explosives: ["Industrial", "Powerful blasting charges clear rock for mines, canals and roads."],
  conscription: ["Industrial", "The nation calls up its citizens and trains them into a great standing army."],
  electricity: ["Industrial", "Harnessed current carries power and messages along wires at lightning speed."],
  railroad: ["Industrial", "Locomotives on iron rails carry people and goods across the land at great speed."],
  industrialization: ["Industrial", "Factories full of machines, under smoking chimneys, turn out goods by the thousand."],
  atomic_theory: ["Industrial", "All matter is made of tiny atoms, each a nucleus circled by electrons."],
  the_corporation: ["Industrial", "Great companies owned by many shareholders take on ventures no one person could."],
  communism: ["Industrial", "Workers' movements call for the state to own the factories and share out what they make."],
  steel: ["Industrial", "Mills make strong, cheap steel by the ton, for rails, ships and towers."],
  electronics: ["Modern", "Vacuum tubes amplify faint signals, bringing radio and power stations to life."],
  refining: ["Industrial", "Crude oil is split in tall towers into fuels and oils of many kinds."],
  combustion: ["Industrial", "Fuel burned inside a cylinder drives the pistons: a small engine of great power."],
  automobile: ["Modern", "Motor cars give people the freedom to travel wherever they please."],
  flight: ["Modern", "Powered aircraft lift off at last and take to the skies."],
  mass_production: ["Modern", "Assembly lines build identical goods quickly and cheaply, for everyone."],
  genetic_engineering: ["Modern", "Reading and rewriting the code of life opens the way to cures for disease."],
  advanced_flight: ["Modern", "Jet engines carry aircraft higher, faster and farther than ever before."],
  labor_union: ["Modern", "Workers band together to bargain for better pay and safer work."],
  recycling: ["Modern", "Glass, paper and metal are sorted and made new instead of thrown away."],
  computers: ["Modern", "Machines that calculate and store data at great speed transform science and industry."],
  nuclear_fission: ["Modern", "Splitting heavy atoms releases enormous energy, for good or for terrible harm."],
  rocketry: ["Modern", "Rockets carry their own fuel and air, climbing far beyond the reach of any aircraft."],
  nuclear_power: ["Modern", "Reactors turn controlled fission into steady power for whole cities."],
  space_flight: ["Modern", "People leave the Earth behind, circle the planet and set out for other worlds."],
  plastics: ["Modern", "Light, strong materials made from oil can be moulded into almost anything."],
  superconductor: ["Modern", "Cooled to extreme cold, some materials carry current with no loss at all."],
  robotics: ["Modern", "Tireless machine arms weld, build and assemble with perfect precision."],
  fusion_power: ["Modern", "Fusing light atoms, as the sun does, promises clean and nearly endless energy."],
  future_tech: ["Future", "Discoveries beyond today's science carry civilization into the unknown."],
  the_internet: ["Information", "Computers linked around the globe share knowledge with anyone, anywhere."],
  mobile_phones: ["Information", "Every pocket holds a telephone, a camera and a window on the world."],
  renewable_energy: ["Information", "Wind, sun and water give power without burning any fuel."],
  artificial_intelligence: ["Information", "Machines learn from experience and begin to reason for themselves."],
  quantum_computing: ["Information", "Computers built on quantum physics solve problems no ordinary machine could."],
};

const A = (id: string, name: string, requires: string[], extra: Partial<AdvanceRule> = {}): AdvanceRule => {
  const about = ABOUT[id];
  if (!about) throw new Error(`advance ${id} has no era or text`);
  return { id, name, requires, era: about[0], text: about[1], ...extra };
};

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
