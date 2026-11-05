import { knows, Terrain } from "@civ/core";
import { hash } from "./hash.js";
import { HOUSE_ART } from "./house-art.js";

/**
 * The houses of a town in the city view (2026-11-05, asked for with the user's sheet: "for the city view add random houses
 * to be scattered around by the civ time-frame, size and advances"): 24 homes and workshops, a row of the sheet an age,
 * shown as they are (`apps/web/src/houses/<id>.png`, cut pixel for pixel by tools/sprites/houses/cut.ts). Only the picture:
 * the rules know a city's size. What stands on a lot goes by what its people have:
 * - the time: `age`, the row, against the age of the civilization (`homeAge`), each age back a smaller share of the
 *   homes, gone after three; a house its advance brings early counts as of the age;
 * - the size of the city: `size`, the smallest that builds one (shops and inns want customers, tenements a crowd);
 * - the advances: `needs`, the one that brings it (a potter's yard with Pottery, a bungalow with the Automobile);
 * - the place: `lands` it suits (adobe on dry ground), a fisher's hut only by the water, and tall `heart` houses to the
 *   middle of the town, thinning out toward its edge.
 */
export interface HouseRule {
  id: string;
  name: string;
  /** A line for the city view's bar. */
  text: string;
  age: 0 | 1 | 2 | 3;
  needs?: string;
  size?: number;
  lands?: readonly Terrain[];
  /** Only near the sea or a river. */
  water?: boolean;
  /** Keeps to the middle of the town. */
  heart?: boolean;
  /** How common it is among the homes of its age: a workshop less so than a home. */
  share?: number;
}

const DRY = [Terrain.Desert, Terrain.Plains, Terrain.Hills, Terrain.Tundra];
const GREEN = [Terrain.Grassland, Terrain.Forest, Terrain.Swamp, Terrain.Jungle, Terrain.Hills, Terrain.Tundra];
/** A workshop's share of the homes of its age. */
const TRADE = 0.4;

export const HOUSES: readonly HouseRule[] = [
  { id: "round_hut", name: "Round hut", text: "mud walls under a thatch of straw", age: 0 },
  { id: "adobe_house", name: "Adobe house", text: "sun-dried brick, the roof reached by ladder", age: 0, lands: DRY },
  { id: "white_cottage", name: "Whitewashed cottage", text: "fired tiles keep out the rain", age: 0, needs: "pottery" },
  { id: "courtyard_house", name: "Courtyard house", text: "the home of a family with coin to spare", age: 0, needs: "currency", size: 3 },
  { id: "fishers_hut", name: "Fisher's hut", text: "nets drying by the door", age: 0, water: true },
  { id: "stone_cottage", name: "Stone cottage", text: "laid dry, built to last", age: 0, needs: "masonry" },

  { id: "timber_house", name: "Timber house", text: "a storey of oak on a footing of stone", age: 1, needs: "construction" },
  { id: "mossy_cottage", name: "Mossy cottage", text: "old stone, its roof gone green", age: 1, needs: "construction", lands: GREEN },
  { id: "bakery", name: "Bakery", text: "the oven lit before dawn", age: 1, needs: "trade", size: 4, share: TRADE },
  { id: "potters_yard", name: "Potter's yard", text: "a kiln and a shelf of pots for sale", age: 1, needs: "pottery", size: 3, share: TRADE },
  { id: "carpenters_shed", name: "Carpenter's shed", text: "saw, bench and seasoning planks", age: 1, needs: "iron_working", size: 3, share: TRADE },
  { id: "inn", name: "Inn", text: "a bench, a sign and a bed for travellers", age: 1, needs: "trade", size: 5, share: TRADE },

  { id: "town_house", name: "Town house", text: "shutters, a balcony and a good address", age: 2, needs: "invention", size: 5, heart: true },
  { id: "brick_terrace", name: "Brick terrace", text: "two front doors under one long roof", age: 2, needs: "industrialization", size: 6, heart: true },
  { id: "greengrocer", name: "Greengrocer", text: "crates of fruit out under the awning", age: 2, needs: "banking", size: 6, share: TRADE },
  { id: "stair_house", name: "House on the stair", text: "a vine trained over the outside steps", age: 2, needs: "engineering" },
  { id: "warehouse", name: "Warehouse", text: "barrels waiting for the next wagon", age: 2, needs: "railroad", size: 6, share: TRADE },
  { id: "tenement", name: "Tenement", text: "four floors, and washing on every one", age: 2, needs: "industrialization", size: 8, heart: true, share: 0.7 },

  { id: "bungalow", name: "Bungalow", text: "a porch and a patch of lawn", age: 3, needs: "automobile" },
  { id: "flats", name: "Block of flats", text: "balconies and a flat roof", age: 3, needs: "steel", size: 10, heart: true, share: 0.7 },
  { id: "corner_cafe", name: "Corner cafe", text: "tables out on the pavement", age: 3, needs: "electricity", size: 6, share: TRADE },
  { id: "garage", name: "Garage", text: "tools, tyres and a roller door", age: 3, needs: "automobile", share: TRADE },
  { id: "solar_house", name: "Solar house", text: "panels on the roof, a tank beside them", age: 3, needs: "renewable_energy" },
  { id: "garden_house", name: "Garden house", text: "curved walls and a garden on top", age: 3, needs: "recycling" },
];

export const HOUSE_BY_ID: Readonly<Record<string, HouseRule>> = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

/** The share of a town's homes that are of each age back from its own: its own, then fewer, none after three. */
const OLDER = [1, 0.45, 0.12, 0];

/** How a town of this age, size and knowledge on this ground builds: each house it can have and how readily. */
export function houseChoices(known: string[], age: number, size: number, ground: Terrain): { rule: HouseRule; weight: number }[] {
  return HOUSES.flatMap((rule) => {
    if (rule.needs && !knows(known, rule.needs)) return [];
    if (size < (rule.size ?? 1) || (rule.lands && !rule.lands.includes(ground))) return [];
    const weight = (OLDER[Math.max(0, age - rule.age)] ?? 0) * (rule.share ?? 1);
    return weight > 0 ? [{ rule, weight }] : [];
  });
}

/**
 * The house on a lot among `choices`: each draws by a hash of the lot and of itself, its weight in its favour, and the
 * lowest draw stands. So a lot keeps its house when a new kind comes, unless the new kind draws lower (a town changes
 * house by house, never all at once). `heart` a lot near the middle of the town, `water` one near the water.
 */
export function pickHouse(choices: { rule: HouseRule; weight: number }[], lot: number, salt: number, at: { heart: boolean; water: boolean }): HouseRule {
  let best: HouseRule | null = null;
  let low = Infinity;
  for (const { rule, weight } of choices) {
    if (rule.water && !at.water) continue;
    const w = rule.heart ? weight * (at.heart ? 1.5 : 0.3) : weight;
    const draw = -Math.log(Math.max(1e-9, hash(lot, HOUSE_INDEX[rule.id]!, salt))) / w;
    if (draw < low) { low = draw; best = rule; }
  }
  return best ?? HOUSES[0]!;
}

const HOUSE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(HOUSES.map((h, i) => [h.id, i + 1]));

/** Whether the house `id` has a picture of the user's. */
export function houseArt(id: string): boolean {
  return id in HOUSE_ART;
}
