import { getTile, Terrain, type WorldMap } from "@civ/core";
import { hash } from "./hash.js";

/**
 * The kinds of tribal village (the user's sheet of 2026-11-02, asked for: "replace huts in game with attached veriety
 * of huts"): a round hut thatched in straw, a timber hall, a mud-brick house, a hide tent on poles, a stone cottage
 * with a chimney. A village's kind suits the land it stands on (adobe in the desert, tents on the plains and the
 * tundra, timber in the woods, stone in the hills), one of a few for each land picked by a hash of its square, so
 * villages on the same land are not all alike. Only the picture: the rules know one village.
 */
export type HutKind = "thatch" | "timber" | "adobe" | "tent" | "cottage";

/** The kinds that suit each land, the likelier repeated. */
const HUTS_ON: Record<Terrain, readonly HutKind[]> = {
  [Terrain.Ocean]: ["thatch"],
  [Terrain.Grassland]: ["thatch", "thatch", "cottage", "timber"],
  [Terrain.Plains]: ["tent", "tent", "thatch", "adobe"],
  [Terrain.Forest]: ["timber", "timber", "cottage"],
  [Terrain.Hills]: ["cottage", "cottage", "timber"],
  [Terrain.Mountains]: ["cottage"],
  [Terrain.Desert]: ["adobe", "adobe", "tent"],
  [Terrain.Tundra]: ["tent", "tent", "cottage"],
  [Terrain.Arctic]: ["tent"],
  [Terrain.Swamp]: ["timber", "thatch"],
  [Terrain.Jungle]: ["thatch", "thatch", "timber"],
};

/** The kind of the village on square (x, y), by the land it stands on. */
export function hutKind(map: WorldMap, x: number, y: number): HutKind {
  const kinds = HUTS_ON[getTile(map, x, y)?.terrain ?? Terrain.Grassland];
  const wx = ((x % map.width) + map.width) % map.width;
  return kinds[Math.floor(hash(wx, y, 83) * kinds.length)]!;
}
