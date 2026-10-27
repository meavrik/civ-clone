import { Terrain } from "../types.js";
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
export interface ResourceRule {
  /** The special it is (`SpecialRule.name`), and its name. */
  id: string;
  /** Its special, wherever it lies. */
  special: SpecialRule;
  /** The terrains its deposits lie on, and the share of their squares without a special that hold one. */
  deposits: Partial<Record<Terrain, number>>;
  /** A few words of our own on what it is good for. */
  text: string;
}

// The specials themselves; the terrains whose own kind they are name the same objects (rules/terrain.ts).
export const HORSES: SpecialRule = { name: "Horses", shields: 2, learned: { advance: "animal_husbandry", food: 1 } };
export const IRON: SpecialRule = { name: "Iron", shields: 3, learned: { advance: "iron_working", shields: 1 }, since: 17 };
export const COAL: SpecialRule = { name: "Coal", shields: 2 };
// A little bitumen until Refining makes it oil.
export const OIL: SpecialRule = { name: "Oil", shields: 1, learned: { advance: "refining", shields: 3 }, since: 17 };
// Nitre scraped from dry ground and caves; the powder mills pay for it.
export const SALTPETER: SpecialRule = { name: "Saltpeter", shields: 1, learned: { advance: "gunpowder", shields: 1 } };

export const RESOURCES: readonly ResourceRule[] = [
  { id: "Horses", special: HORSES, deposits: { [Terrain.Grassland]: 0.03, [Terrain.Plains]: 0.05 }, text: "Mounts for riders and chariots." },
  { id: "Iron", special: IRON, deposits: { [Terrain.Hills]: 0.08, [Terrain.Mountains]: 0.08 }, text: "Blades, armour and guns." },
  { id: "Saltpeter", special: SALTPETER, deposits: { [Terrain.Desert]: 0.08, [Terrain.Tundra]: 0.06, [Terrain.Plains]: 0.02, [Terrain.Hills]: 0.025 }, text: "The makings of gunpowder." },
  { id: "Coal", special: COAL, deposits: { [Terrain.Hills]: 0.04, [Terrain.Forest]: 0.025, [Terrain.Swamp]: 0.04 }, text: "Fuel for steamships." },
  { id: "Oil", special: OIL, deposits: { [Terrain.Desert]: 0.06, [Terrain.Swamp]: 0.06, [Terrain.Tundra]: 0.05, [Terrain.Arctic]: 0.05, [Terrain.Jungle]: 0.02 }, text: "Fuel for engines on land, at sea and in the air." },
];

export const RESOURCE_BY_ID: Readonly<Record<string, ResourceRule>> = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

/** The save version that brought strategic resources and their deposits. */
export const RESOURCES_SINCE = 33;

/** Whether a special is strategic (a resource units may need). */
export function isStrategic(special: SpecialRule | undefined): boolean {
  return special !== undefined && RESOURCE_BY_ID[special.name] !== undefined;
}
