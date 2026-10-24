/**
 * Wonders of the World: the 21 of the 1991 game, with costs, prerequisites
 * and obsolescence checked against FreeCiv's civ1 ruleset. Each can be
 * built once per game. Effects are data; cities.ts and the turn pass
 * interpret them. `obsolete` names the advance that ends the effect.
 */
export interface WonderRule {
  id: string;
  name: string;
  /** What it does, in a line: shown when a city completes it. */
  text: string;
  cost: number;
  requires: string;
  obsolete?: string;
  effect:
    | { kind: "contentAll"; amount: number } // every city of the owner
    | { kind: "contentCity"; amount: number } // the wonder's city
    | { kind: "contentContinent"; amount: number } // cities on the same continent
    | { kind: "noUnhappyCity" }
    | { kind: "sciencePct"; amount: number } // the wonder's city
    | { kind: "scienceAll"; amount: number } // every city of the owner
    | { kind: "tradeSquares"; amount: number } // the wonder's city: each square it works that yields trade (ocean squares only before save version 27)
    | { kind: "templeDouble" } // temples count double for the owner
    | { kind: "cathedralEverywhere" }
    | { kind: "noAnarchy" } // also: any government may be chosen
    | { kind: "seaMoves"; amount: number } // the owner's ships
    | { kind: "wallsEverywhere" }
    | { kind: "freeAdvances"; amount: number }
    | { kind: "revealMap" }
    | { kind: "allowNuclear" }
    | { kind: "greatLibrary" } // any advance two other civs know
    | { kind: "policeEverywhere" } // one unit abroad per city causes no unhappiness
    | { kind: "powerPlantContinent" }; // factories on the continent get a power plant's bonus and less pollution
}

const W = (id: string, name: string, text: string, cost: number, requires: string, effect: WonderRule["effect"], obsolete?: string): WonderRule =>
  obsolete ? { id, name, text, cost, requires, effect, obsolete } : { id, name, text, cost, requires, effect };

export const WONDERS: WonderRule[] = [
  W("pyramids", "Pyramids", "Governments change without anarchy, and any government may be chosen.", 300, "masonry", { kind: "noAnarchy" }, "communism"),
  W("hanging_gardens", "Hanging Gardens", "Calms one unhappy citizen in every city.", 300, "pottery", { kind: "contentAll", amount: 1 }, "invention"),
  W("colossus", "Colossus", "Every square its city works that yields trade yields one more.", 200, "bronze_working", { kind: "tradeSquares", amount: 1 }, "electricity"),
  W("lighthouse", "Lighthouse", "Our ships sail one square farther each turn.", 200, "map_making", { kind: "seaMoves", amount: 1 }, "magnetism"),
  W("great_library", "Great Library", "Teaches us any advance that two other civilizations know.", 300, "literacy", { kind: "greatLibrary" }, "electronics"),
  W("oracle", "Oracle", "Our temples calm twice as many citizens.", 300, "mysticism", { kind: "templeDouble" }, "religion"),
  W("great_wall", "Great Wall", "Every one of our cities defends as if walled.", 300, "masonry", { kind: "wallsEverywhere" }, "gunpowder"),
  W("copernicus", "Copernicus' Observatory", "Doubles the science of its city.", 300, "astronomy", { kind: "sciencePct", amount: 100 }, "automobile"),
  W("magellans", "Magellan's Expedition", "Our ships sail one square farther each turn.", 400, "navigation", { kind: "seaMoves", amount: 1 }),
  W("michelangelos", "Michelangelo's Chapel", "Acts as a cathedral in every one of our cities.", 300, "religion", { kind: "cathedralEverywhere" }, "communism"),
  W("shakespeares", "Shakespeare's Theatre", "No citizen of its city is ever unhappy.", 400, "medicine", { kind: "noUnhappyCity" }, "electronics"),
  W("isaac_newtons", "Isaac Newton's College", "Doubles the science of its city.", 400, "theory_of_gravity", { kind: "sciencePct", amount: 100 }, "nuclear_fission"),
  W("js_bachs", "J.S. Bach's Cathedral", "Calms two unhappy citizens in every city on its continent.", 400, "religion", { kind: "contentContinent", amount: 2 }),
  W("darwins_voyage", "Darwin's Voyage", "Brings two advances at once.", 300, "railroad", { kind: "freeAdvances", amount: 2 }),
  W("womens_suffrage", "Women's Suffrage", "One unit abroad from each city causes no unhappiness.", 600, "industrialization", { kind: "policeEverywhere" }),
  W("hoover_dam", "Hoover Dam", "Factories on its continent work as if they had a power plant.", 600, "electronics", { kind: "powerPlantContinent" }),
  W("manhattan_project", "Manhattan Project", "Opens the way to nuclear weapons.", 600, "nuclear_fission", { kind: "allowNuclear" }),
  W("united_nations", "United Nations", "Governments change without anarchy, and any government may be chosen.", 600, "communism", { kind: "noAnarchy" }),
  W("seti_program", "SETI Program", "Adds half again to the science of all our cities.", 600, "computers", { kind: "scienceAll", amount: 50 }),
  W("apollo_program", "Apollo Program", "Shows the whole world and opens the race to the stars.", 600, "space_flight", { kind: "revealMap" }),
  W("cure_for_cancer", "Cure for Cancer", "Calms one unhappy citizen in every city.", 600, "genetic_engineering", { kind: "contentAll", amount: 1 }),
];

export const WONDER_BY_ID: Record<string, WonderRule> = Object.fromEntries(WONDERS.map((w) => [w.id, w]));

export function wonder(id: string): WonderRule {
  const w = WONDER_BY_ID[id];
  if (!w) throw new Error(`unknown wonder ${id}`);
  return w;
}
