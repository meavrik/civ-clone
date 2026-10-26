/**
 * Names of the world's great features (asked for 2026-10-25: "names for great masses of land or
 * water, like the great desert of..., lake x, the sea of..., x mountains; the name could be driven
 * from the civ or leader who discovers them first; on the premade maps give the real names").
 * `map/geography.ts` finds the places; the first civilization to see one names it from these: from its
 * own lists first (`CIV_PLACES`, since 2026-10-26), then after its leader, people and cities.
 */
export type PlaceKind =
  | "ocean" | "sea" | "bay" | "lake"
  | "continent" | "island"
  | "desert" | "mountains" | "hills" | "forest" | "jungle" | "swamp" | "tundra" | "ice";

/** The layers a square lies in: a water body or a landform (`place`), and a continent or island (`land`). */
export const LAND_KINDS: ReadonlySet<PlaceKind> = new Set(["continent", "island"]);
export const WATER_KINDS: ReadonlySet<PlaceKind> = new Set(["ocean", "sea", "bay", "lake"]);

export interface PlaceRule {
  /** A few words for one, for the news ("a great desert"). */
  noun: string;
  /** Which of the discoverer's own lists names one first (`CivPlaces` in `civ-places.ts`). */
  list: "lands" | "waters" | "wilds";
  /** How a name from that list is written for one: {name} the name ("the Sea of {name}"). */
  own: string[];
  /**
   * Names for one once the discoverer's own are used up, first unused in the world wins: {leader} the
   * discoverer's leader, {adj} its adjective (Roman), {people} its name (Romans), {city} each of its cities in turn.
   */
  names: string[];
  /** For one this big or bigger (squares of the original's world), these come first: its own names written so, then these. */
  great?: { size: number; own?: string[]; names: string[] };
}

export const PLACE_RULES: Readonly<Record<PlaceKind, PlaceRule>> = {
  ocean: { noun: "an ocean", list: "waters", own: ["the Ocean of {name}"], names: ["the {adj} Ocean", "the Ocean of {leader}", "the {city} Ocean"] },
  sea: { noun: "a sea", list: "waters", own: ["the Sea of {name}"], names: ["the Sea of {leader}", "the {adj} Sea", "the Sea of {city}", "the {city} Sea"] },
  bay: { noun: "a gulf", list: "waters", own: ["the Gulf of {name}"], names: ["the Bay of {city}", "the Gulf of {leader}", "{leader} Bay", "the {adj} Gulf", "the Gulf of {city}", "{city} Bay"] },
  lake: { noun: "a lake", list: "waters", own: ["Lake {name}"], names: ["Lake {leader}", "Lake {city}", "the {adj} Lake"] },
  continent: { noun: "a continent", list: "lands", own: ["{name}"], names: ["{leader's} Land", "the {adj} Lands", "New {city}", "{city} Land"] },
  island: { noun: "an island", list: "lands", own: ["{name}"], names: ["{leader} Island", "the Isle of {city}", "{adj} Island", "{city} Island", "New {city}"] },
  desert: {
    noun: "a desert",
    list: "wilds",
    own: ["the {name} Desert"],
    names: ["the {leader} Desert", "the {adj} Sands", "the Desert of {city}", "the {city} Sands"],
    great: { size: 16, own: ["the Great {name} Desert"], names: ["the Great Desert of {leader}", "the Great {adj} Desert"] },
  },
  mountains: { noun: "a mountain range", list: "wilds", own: ["the {name} Mountains"], names: ["the {leader} Mountains", "the {adj} Mountains", "the Mountains of {city}", "the {city} Range"] },
  hills: { noun: "a range of hills", list: "wilds", own: ["the {name} Hills"], names: ["the {leader} Hills", "the {adj} Hills", "the Hills of {city}", "the {city} Downs"] },
  forest: {
    noun: "a forest",
    list: "wilds",
    own: ["the {name} Forest"],
    names: ["the {leader} Forest", "the {adj} Woods", "the Forest of {city}", "the {city} Woods"],
    great: { size: 24, own: ["the Great {name} Forest"], names: ["the Great {adj} Forest", "the Great Forest of {leader}"] },
  },
  jungle: { noun: "a jungle", list: "wilds", own: ["the {name} Jungle"], names: ["the {adj} Jungle", "the {leader} Jungle", "the Jungle of {city}"] },
  swamp: { noun: "a marsh", list: "wilds", own: ["the {name} Marshes"], names: ["the {leader} Marshes", "the {adj} Fens", "the Marshes of {city}", "the {city} Swamp"] },
  tundra: { noun: "a tundra", list: "wilds", own: ["the {name} Tundra"], names: ["the {adj} Tundra", "the {leader} Barrens", "the {city} Tundra"] },
  ice: { noun: "an ice field", list: "wilds", own: ["the {name} Ice"], names: ["the {adj} Ice", "the {leader} Icefield", "the {city} Glacier"] },
};

/**
 * How places are found on a generated world, in squares of the original's 80x50 (a bigger world
 * scales sizes by its area and distances by its width).
 */
export const PLACES = {
  /** A body of water this small or smaller is a lake. */
  lakeMax: 12,
  /** One up to this size, away from the open sea, is a sea of its own (the Caspian). */
  inlandSeaMax: 120,
  /** The open water is cut into basins round centres at least this far apart through the water. */
  basinSpacing: 12,
  /** A basin smaller than this joins the neighbour it borders most. */
  basinMin: 24,
  /** A basin smaller than this is a gulf (`bay`), unless it is open water. */
  bayMax: 60,
  /** Water this far from land or further is open water... */
  openDepth: 3,
  /** ...and a basin this much of it open water is an ocean. */
  oceanShare: 0.3,
  /** Land of this size or bigger is a continent, smaller an island. */
  continentMin: 40,
  /** The smallest landform of each kind named. */
  landformMin: { desert: 4, mountains: 4, hills: 4, forest: 6, jungle: 5, swamp: 4, tundra: 6, ice: 4 } as Readonly<Record<string, number>>,
} as const;
