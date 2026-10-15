/**
 * Wonders of the World. Each can be built once per game. Effects are data;
 * cities.ts and the turn pass interpret them. `obsolete` names the advance
 * that ends the effect.
 */
export interface WonderRule {
  id: string;
  name: string;
  cost: number;
  requires: string;
  obsolete?: string;
  effect:
    | { kind: "contentAll"; amount: number } // every city of the owner
    | { kind: "contentCity"; amount: number } // the wonder's city
    | { kind: "contentContinent"; amount: number } // cities on the same continent
    | { kind: "noUnhappyCity" }
    | { kind: "sciencePct"; amount: number } // the wonder's city
    | { kind: "shieldPerWorkedTile" } // +1 shield on tiles already producing shields
    | { kind: "oceanTrade"; amount: number } // the wonder's city
    | { kind: "templeDouble" } // temples count double for the owner
    | { kind: "cathedralEverywhere" }
    | { kind: "freeUpkeepCheap" } // 1-gold improvements are free
    | { kind: "noAnarchy" }
    | { kind: "seaMoves"; amount: number }
    | { kind: "safeTriremes" }
    | { kind: "wallsEverywhere" }
    | { kind: "freeAdvances"; amount: number }
    | { kind: "revealMap" }
    | { kind: "allowNuclear" }
    | { kind: "diplomacy" }
    | { kind: "upgradeUnits" }
    | { kind: "greatLibrary" }
    | { kind: "policeEverywhere" }
    | { kind: "factoryBonus"; amount: number };
}

const W = (id: string, name: string, cost: number, requires: string, effect: WonderRule["effect"], obsolete?: string): WonderRule =>
  obsolete ? { id, name, cost, requires, effect, obsolete } : { id, name, cost, requires, effect };

export const WONDERS: WonderRule[] = [
  W("pyramids", "Pyramids", 300, "bronze_working", { kind: "noAnarchy" }, "communism"),
  W("hanging_gardens", "Hanging Gardens", 300, "pottery", { kind: "contentAll", amount: 1 }, "railroad"),
  W("colossus", "Colossus", 200, "bronze_working", { kind: "oceanTrade", amount: 1 }, "electricity"),
  W("lighthouse", "Lighthouse", 200, "map_making", { kind: "safeTriremes" }, "magnetism"),
  W("great_library", "Great Library", 300, "literacy", { kind: "greatLibrary" }, "university"),
  W("oracle", "Oracle", 300, "mysticism", { kind: "templeDouble" }, "religion"),
  W("great_wall", "Great Wall", 300, "masonry", { kind: "wallsEverywhere" }, "gunpowder"),
  W("copernicus", "Copernicus' Observatory", 300, "astronomy", { kind: "sciencePct", amount: 100 }),
  W("magellans", "Magellan's Expedition", 400, "navigation", { kind: "seaMoves", amount: 1 }),
  W("michelangelos", "Michelangelo's Chapel", 300, "monotheism", { kind: "cathedralEverywhere" }),
  W("shakespeares", "Shakespeare's Theatre", 300, "medicine", { kind: "noUnhappyCity" }),
  W("king_richards", "King Richard's Crusade", 300, "chivalry", { kind: "shieldPerWorkedTile" }, "automobile"),
  W("isaac_newtons", "Isaac Newton's College", 400, "theory_of_gravity", { kind: "sciencePct", amount: 100 }),
  W("js_bachs", "J.S. Bach's Cathedral", 400, "religion", { kind: "contentContinent", amount: 2 }),
  W("darwins_voyage", "Darwin's Voyage", 300, "railroad", { kind: "freeAdvances", amount: 2 }),
  W("womens_suffrage", "Women's Suffrage", 600, "industrialization", { kind: "policeEverywhere" }),
  W("hoover_dam", "Hoover Dam", 600, "electronics", { kind: "factoryBonus", amount: 25 }),
  W("adam_smiths", "Adam Smith's Trading Co.", 400, "the_corporation", { kind: "freeUpkeepCheap" }),
  W("manhattan_project", "Manhattan Project", 600, "nuclear_fission", { kind: "allowNuclear" }),
  W("united_nations", "United Nations", 600, "communism", { kind: "diplomacy" }),
  W("apollo_program", "Apollo Program", 600, "space_flight", { kind: "revealMap" }),
  W("cure_for_cancer", "Cure for Cancer", 600, "genetic_engineering", { kind: "contentAll", amount: 1 }),
];

export const WONDER_BY_ID: Record<string, WonderRule> = Object.fromEntries(WONDERS.map((w) => [w.id, w]));

export function wonder(id: string): WonderRule {
  const w = WONDER_BY_ID[id];
  if (!w) throw new Error(`unknown wonder ${id}`);
  return w;
}
