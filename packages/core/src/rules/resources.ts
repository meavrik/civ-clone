import { Terrain } from "../types.js";
import { inCatalogue } from "./catalogue.js";
import type { SpecialRule } from "./terrain.js";

/**
 * Strategic resources (our departure, asked for 2026-10-27, after Civilization III: "make some units
 * dependent on resources inside the civ borders - like legion need iron, musketeer or rifleman needs
 * gunpowder, horseman or chariot needs horses etc. also can exchange resources with other civs").
 * Five specials are strategic: a civilization holds one while a square of it lies inside its border
 * (`claims`), or while another civilization trades it one (`GameState.resourceTrades`), and a unit
 * that names it in `UnitTypeRule.needs` is built only then. Gunpowder is an advance here (the
 * Musketeers' own), so the musketeers and riflemen want its makings, Saltpeter.
 * The specials of the original's lattice were too rare to hang units on (one civilization in 24 held
 * any Iron at turn 220), so worlds since save version 33 also hold deposits (`Tile.deposit`): squares
 * of the terrains each lists, picked by a hash of the square (no RNG, so a seed keeps its draws), each
 * a special of that kind, drawn and yielding as one. Saves before version 33 load with `noResources`:
 * no deposits, and every unit built from its advance alone.
 */
export interface ResourceRule extends DepositRule {
  /** A few words of our own on what it is good for. */
  text: string;
  /**
   * The advance that shows it to a civilization (asked for 2026-10-28: "showing terrain resources only when relevant
   * to the civ - when got the resource related tech"), or the advance of any unit that needs it, whichever comes first
   * (`resourceRevealers`: Chivalry's Knights want Iron without Bronze Working). Until then its squares are plain
   * terrain to that civ: not drawn, yielding nothing of the special, not held. None for Horses and Coal, the 1991
   * game's own specials of plains and hills, seen from the start.
   */
  revealedBy?: string;
  /**
   * The units that need it stay out of a city's build menu until its civilization holds it (asked for 2026-11-02: "dont
   * show war-elephents until have elephents as resource"; half the civs never hold Elephants). Other resources' units
   * stand there faded, saying what they need. Only the menu: the rules are untouched.
   */
  unlisted?: true;
  /**
   * Its deposits at sea (asked for 2026-11-01: "add oil for water", with an oil rig over it; since save version 55,
   * `since`): open sea without a special, within `within` squares of land, `share` of those squares. Such a square serves
   * its civilization only with an oil rig on it (`Tile.rig`), as a land square does with a road: a Fishing Boat builds
   * one once its civilization knows `rig.advance` (the `rig` command, spending the boat, as it lays a fishery), and the
   * rig adds `rig.shields` to the square for whoever works it.
   */
  offshore?: { share: number; within: number; since: number; rig: { advance: string; shields: number } };
}

/**
 * A special that lies in deposits (`Tile.deposit`) besides the terrains' own lattice: a strategic resource
 * (`ResourceRule`), or a herd (`HERDS`), which only yields.
 */
export interface DepositRule {
  /** The special it is (`SpecialRule.name`), and its name. */
  id: string;
  /** Its special, wherever it lies. */
  special: SpecialRule;
  /** The terrains its deposits lie on, and the share of their squares without a special that hold one. */
  deposits: Partial<Record<Terrain, number>>;
  /** Its deposits lie only on this terrain or beside it (Elephants: in and at the edge of the jungle). */
  besides?: Terrain;
  /** The save version that brought it; worlds of older games (`GameState.catalogue`) hold none, and no unit there needs it. */
  since?: number;
}

// The specials themselves; the terrains whose own kind they are name the same objects (rules/terrain.ts).
export const HORSES: SpecialRule = { name: "Horses", shields: 2, learned: { advance: "animal_husbandry", food: 1 } };
export const IRON: SpecialRule = { name: "Iron", shields: 3, learned: { advance: "iron_working", shields: 1 }, since: 17 };
export const COAL: SpecialRule = { name: "Coal", shields: 2 };
// A little bitumen until Refining makes it oil.
export const OIL: SpecialRule = { name: "Oil", shields: 1, learned: { advance: "refining", shields: 3 }, since: 17 };
// Nitre scraped from dry ground and caves; the powder mills pay for it.
export const SALTPETER: SpecialRule = { name: "Saltpeter", shields: 1, learned: { advance: "gunpowder", shields: 1 } };
// Herds in the jungle and on the grass beside it (since save version 53); tamed, they give milk and hides as well.
export const ELEPHANTS: SpecialRule = { name: "Elephants", learned: { advance: "animal_husbandry", food: 1 } };

export const RESOURCES: readonly ResourceRule[] = [
  { id: "Horses", special: HORSES, deposits: { [Terrain.Grassland]: 0.03, [Terrain.Plains]: 0.05 }, text: "Mounts for riders and chariots." },
  { id: "Iron", special: IRON, deposits: { [Terrain.Hills]: 0.08, [Terrain.Mountains]: 0.08 }, text: "Blades, armour and guns.", revealedBy: "bronze_working" },
  { id: "Saltpeter", special: SALTPETER, deposits: { [Terrain.Desert]: 0.08, [Terrain.Tundra]: 0.06, [Terrain.Plains]: 0.02, [Terrain.Hills]: 0.025 }, text: "The makings of gunpowder.", revealedBy: "gunpowder" },
  { id: "Coal", special: COAL, deposits: { [Terrain.Hills]: 0.04, [Terrain.Forest]: 0.025, [Terrain.Swamp]: 0.04 }, text: "Fuel for steamships." },
  {
    id: "Oil", special: OIL, deposits: { [Terrain.Desert]: 0.06, [Terrain.Swamp]: 0.06, [Terrain.Tundra]: 0.05, [Terrain.Arctic]: 0.05, [Terrain.Jungle]: 0.02 },
    offshore: { share: 0.01, within: 2, since: 55, rig: { advance: "refining", shields: 1 } },
    text: "Fuel for engines on land, at sea and in the air.", revealedBy: "refining",
  },
  // Asked for 2026-11-01 ("war elephants - if any elephant resource available"): the jungle's own beasts, seen from the start.
  { id: "Elephants", special: ELEPHANTS, deposits: { [Terrain.Jungle]: 0.07, [Terrain.Grassland]: 0.05, [Terrain.Plains]: 0.05 }, besides: Terrain.Jungle, unlisted: true, text: "War beasts that put horses to flight.", since: 53 },
];

export const RESOURCE_BY_ID: Readonly<Record<string, ResourceRule>> = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

// Mutton and milk; tamed, more; Weaving spins their wool for trade.
export const SHEEP: SpecialRule = { name: "Sheep", food: 1, learned: [{ advance: "animal_husbandry", food: 1 }, { advance: "weaving", trade: 1 }], since: 61 };
// The caravans' beasts; tamed, milk as well.
export const CAMELS: SpecialRule = { name: "Camels", food: 1, trade: 2, learned: { advance: "animal_husbandry", food: 1 }, since: 61 };
// Hides and meat, as grassland's Resources gave a shield; tamed, more meat.
export const BISON: SpecialRule = { name: "Bison", shields: 1, learned: { advance: "animal_husbandry", food: 1 }, since: 61 };

/**
 * Herds (asked for 2026-11-03, with the user's sheet of resources: "sheep, bison, dear camel, seal - would get food bonus
 * with husbandry tech", "sheep cotton silk - would get bonus with weaving tech"; since save version 61): bonus resources
 * that lie in deposits as the strategic ones do, after their slices of the roll, so every other deposit lies where it
 * did, but only yield: no unit needs them, no one holds or trades them. Sheep graze the plains, camels the desert, bison
 * the grassland (the bison was the picture of grassland's Resources, gone from the land since save version 26). All seen
 * from the start, and Animal Husbandry tames each for a food more, as it does Horses, Game, Seals and Elephants.
 */
export const HERDS: readonly DepositRule[] = [
  { id: "Sheep", special: SHEEP, deposits: { [Terrain.Plains]: 0.06 }, since: 61 },
  { id: "Camels", special: CAMELS, deposits: { [Terrain.Desert]: 0.1 }, since: 61 },
  { id: "Bison", special: BISON, deposits: { [Terrain.Grassland]: 0.04 }, since: 61 },
];

/** Every special that lies in deposits, strategic resources and herds, by id. */
export const DEPOSIT_BY_ID: Readonly<Record<string, DepositRule>> = Object.fromEntries([...RESOURCES, ...HERDS].map((r) => [r.id, r]));

/** The save version that brought strategic resources and their deposits. */
export const RESOURCES_SINCE = 33;

/** The save version from which a resource with `revealedBy` is hidden from a civilization until it knows that advance. */
export const REVEAL_SINCE = 40;


/** The strategic resources of a game, in `RESOURCES` order: those its version knew (`GameState.catalogue`). */
export function resourcesIn(state: { catalogue?: number | undefined }): readonly ResourceRule[] {
  return state.catalogue === undefined ? RESOURCES : RESOURCES.filter((r) => inCatalogue(state, r));
}

/** The herds of a game: those its version knew (`GameState.catalogue`). */
export function herdsIn(state: { catalogue?: number | undefined }): readonly DepositRule[] {
  return HERDS.filter((r) => inCatalogue(state, r));
}

/** Whether a special is strategic (a resource units may need). */
export function isStrategic(special: SpecialRule | undefined): boolean {
  return special !== undefined && RESOURCE_BY_ID[special.name] !== undefined;
}
