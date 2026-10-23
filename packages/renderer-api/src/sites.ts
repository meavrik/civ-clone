import { canFoundCity, CITY_SPACING, getTile, mapDistance, siteScore, unitById, unitType, wrapX, type GameState } from "@civ/core";

/** A square the map suggests for a city while settlers are in play; `best` marks the one to prefer. */
export interface SuggestedSite {
  x: number;
  y: number;
  best: boolean;
}

/** How far round the settlers the map looks, how many sites it marks, and what each square of walking costs a site. */
const SITE_REACH = 6;
const SITES_SHOWN = 3;
const STEP_COST = 4;

/** The last answer for each game, kept while nothing it reads has changed (it is asked every frame). */
const memo = new WeakMap<GameState, { key: string; sites: SuggestedSite[] }>();

/** A fingerprint of what a site search round (x, y) reads: the squares within reach and what the player knows of them. */
function windowKey(state: GameState, x0: number, y0: number, known: Uint8Array): number {
  const { map } = state;
  let h = 0;
  for (let dy = -SITE_REACH - 3; dy <= SITE_REACH + 3; dy++)
    for (let dx = -SITE_REACH - 3; dx <= SITE_REACH + 3; dx++) {
      const y = y0 + dy;
      if (y < 0 || y >= map.height) continue;
      const i = y * map.width + wrapX(map, x0 + dx);
      const t = map.tiles[i]!;
      const v = (t.terrain * 2 + (t.river ? 1 : 0)) * 64 + (t.road ? 1 : 0) + (t.irrigation ? 2 : 0) + (t.mine ? 4 : 0) + (t.special ? 8 : 0) + (t.pollution ? 16 : 0) + (known[i] ? 32 : 0) + t.continent * 4096;
      h = (Math.imul(h, 31) + v) | 0;
    }
  return h;
}

/**
 * Good squares near a settler unit to found a city on (asked for 2026-10-23), judged as the computer
 * players judge them (`siteScore`) from what its civilization has seen: on land it can walk to (its own
 * landmass), where the rules let a city stand, and as far from the cities it knows as the computer
 * players keep theirs (`CITY_SPACING`), the best few within reach, apart from each other, nearer ones
 * preferred. Empty for any other unit.
 */
export function settlerSites(state: GameState, unitId: number | null): SuggestedSite[] {
  const u = unitId === null ? undefined : unitById(state, unitId);
  if (!u || u.aboard !== null || !unitType(u.type).flags?.includes("settler")) return [];
  const me = state.players[u.owner];
  if (!me) return [];
  const { map } = state;
  const known = me.explored;
  const key = `${u.id},${u.x},${u.y},${state.cities.length},${windowKey(state, u.x, u.y, known)}`;
  const hit = memo.get(state);
  if (hit?.key === key) return hit.sites;
  const land = getTile(map, u.x, u.y)?.continent;
  const cities = state.cities.filter((c) => known[c.y * map.width + c.x] === 1);
  const found: { x: number; y: number; value: number }[] = [];
  for (let dy = -SITE_REACH; dy <= SITE_REACH; dy++)
    for (let dx = -SITE_REACH; dx <= SITE_REACH; dx++) {
      const x = wrapX(map, u.x + dx);
      const y = u.y + dy;
      if (y < 0 || y >= map.height || !known[y * map.width + x]) continue;
      const t = map.tiles[y * map.width + x]!;
      if (t.continent !== land || canFoundCity(state, x, y) !== null) continue;
      if (cities.some((c) => mapDistance(map, c.x, c.y, x, y) < (c.owner === u.owner ? CITY_SPACING.own : CITY_SPACING.foreign))) continue;
      const score = siteScore(state, x, y, known);
      if (score === null) continue;
      found.push({ x, y, value: score - STEP_COST * Math.max(Math.abs(dx), Math.abs(dy)) });
    }
  found.sort((a, b) => b.value - a.value || a.y - b.y || a.x - b.x);
  const sites: SuggestedSite[] = [];
  for (const f of found) {
    if (sites.length >= SITES_SHOWN) break;
    if (sites.some((s) => mapDistance(map, s.x, s.y, f.x, f.y) < CITY_SPACING.own)) continue;
    sites.push({ x: f.x, y: f.y, best: sites.length === 0 });
  }
  memo.set(state, { key, sites });
  return sites;
}
