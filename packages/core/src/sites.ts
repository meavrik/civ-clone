import { tileYield } from "./cities.js";
import { tileAsKnown } from "./resources.js";
import { CITY_RADIUS, getTile, Terrain, type GameState } from "./types.js";

/**
 * Where a city is worth founding, as the AI planner has always judged it (moved here unchanged so the
 * player's settlers can be shown the same, and a game's starts set on good land; asked for 2026-10-23).
 */

/** Squares a city may stand on: open land, hills, and desert or forest only by a river. */
export const SITE_CENTRES: ReadonlySet<Terrain> = new Set([Terrain.Grassland, Terrain.Plains, Terrain.Hills, Terrain.Desert, Terrain.Forest]);

/**
 * How near (squares, either way) a new city may stand to one of its own civilization's cities and to
 * anyone else's, as the planner founds them (asked for 2026-10-22) and the map suggests them.
 */
export const CITY_SPACING = { own: 4, foreign: 5 };

/** What a square nobody has seen counts for in a site's score: about a plain square of grassland. */
const UNKNOWN_SQUARE = 5;

/**
 * Value of founding a city at (x, y): yields of the 21-tile radius plus terrain bonuses; null if unfit.
 * With `known` (a player's explored squares) only what that player has seen counts: an unseen centre is
 * unfit, an unseen square of the radius counts `UNKNOWN_SQUARE` and is not land. With `player`, a resource
 * it has yet to reveal (`specialFor`) counts as the plain terrain under it.
 */
export function siteScore(state: GameState, x: number, y: number, known?: Uint8Array, player?: number): number | null {
  const t = getTile(state.map, x, y);
  if (!t || !SITE_CENTRES.has(t.terrain)) return null;
  if (known && !known[y * state.map.width + x]) return null;
  if ((t.terrain === Terrain.Desert || t.terrain === Terrain.Forest) && !t.river) return null;
  let score = 0;
  let land = 0;
  let sea = 0;
  for (let slot = 1; slot < CITY_RADIUS.length; slot++) {
    const [dx, dy] = CITY_RADIUS[slot]!;
    const square = getTile(state.map, x + dx, y + dy);
    if (!square) continue;
    const n = tileAsKnown(state, square, player);
    if (known && !known[(y + dy) * state.map.width + (((x + dx) % state.map.width) + state.map.width) % state.map.width]) {
      score += UNKNOWN_SQUARE;
      continue;
    }
    if (n.terrain === Terrain.Ocean) sea++;
    else land++;
    const yld = tileYield(state, n, false, "monarchy");
    score += yld.food * 3 + yld.shields * 2 + yld.trade * 1.5;
    if (n.special) score += 2;
  }
  if (land < 7) return null;
  if (t.river) score += 5;
  if (t.terrain === Terrain.Hills) score += 3;
  if (sea > 0) score += 2;
  return score;
}
