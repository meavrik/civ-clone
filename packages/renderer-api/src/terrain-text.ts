import { Terrain } from "@civ/core";

/** A few words on each terrain for the square's window: what it is good for (our own words). */
export const TERRAIN_TEXT: Record<Terrain, string> = {
  [Terrain.Ocean]: "Open sea: fish to eat, and trade along the coast.",
  [Terrain.Grassland]: "Rich open land, the best for farms.",
  [Terrain.Plains]: "Open land for fields and herds, with a little timber.",
  [Terrain.Forest]: "Timber for building; slow going for armies.",
  [Terrain.Hills]: "Easy to hold, and rich in ore once mined.",
  [Terrain.Mountains]: "A wall to armies, with gold and iron in the rock.",
  [Terrain.Desert]: "Dry and poor, until water is brought to it.",
  [Terrain.Tundra]: "Cold, thin land at the edge of the ice.",
  [Terrain.Arctic]: "Ice where nothing grows.",
  [Terrain.Swamp]: "Wet and slow; drained, it becomes grassland.",
  [Terrain.Jungle]: "Thick and wet; cleared, it becomes grassland.",
};
