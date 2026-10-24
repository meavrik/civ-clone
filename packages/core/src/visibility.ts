import { unitType } from "./rules/units.js";
import { cityCulture, claims } from "./territory.js";
import { wrapX, type GameState, type Unit } from "./types.js";

/**
 * What a civilization sees now (`Player.visible`; asked for 2026-10-24: "an area of observability:
 * one tile beyond the empire's influence and borders, and round each unit outside them; some units
 * see further; in it the player sees every other civ's activity and units"): its land (the squares
 * its cities claim, `claims`) and one square beyond it all round, and round every unit as far as its
 * sight (`unitSight`: most see the squares next to them, scouts, warships and aircraft two out).
 * What it sees it has explored. Saves before version 30 (`narrowSight`) saw round their units, with
 * every unit's sight one but the warships' and aircraft's, and next to their cities only.
 */

/** Mark tiles within `radius` of (cx, cy) as explored and visible for a player. */
export function revealAround(state: GameState, player: number, cx: number, cy: number, radius: number): void {
  const p = state.players[player]!;
  const { width, height } = state.map;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const i = y * width + wrapX(state.map, cx + dx);
      p.explored[i] = 1;
      p.visible[i] = 1;
    }
  }
}

/** How many squares out a unit sees: its type's `sight`, one for a scout in saves before its `sightSince`. */
export function unitSight(state: GameState, u: Pick<Unit, "type">): number {
  const rule = unitType(u.type);
  return state.narrowSight && rule.sightSince !== undefined ? 1 : rule.sight;
}

/** The land every civilization holds (`claims`), for as long as no city is founded, lost, grown or shrunk in culture. */
interface LandSight {
  key: string;
  owner: Int16Array;
  /** Per player: the squares of its land and those next to them. */
  seen: Map<number, Int32Array>;
}
const landCache = new WeakMap<GameState, LandSight>();

/** What `claims` reads of the cities, so a change to any of them shows. */
function landKey(state: GameState): string {
  let key = "";
  for (const c of state.cities) key += `${c.id},${c.owner},${c.x},${c.y},${cityCulture(state, c)};`;
  return key;
}

/** The squares a civilization sees from its land: every square of it and every square next to one (y * width + x). */
export function landSight(state: GameState, player: number): Int32Array {
  const key = landKey(state);
  let land = landCache.get(state);
  if (!land || land.key !== key) {
    land = { key, owner: claims(state), seen: new Map() };
    landCache.set(state, land);
  }
  const hit = land.seen.get(player);
  if (hit) return hit;
  const { width, height } = state.map;
  const mark = new Uint8Array(width * height);
  const out: number[] = [];
  for (let i = 0; i < land.owner.length; i++) {
    if (land.owner[i] !== player) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const j = yy * width + wrapX(state.map, x + dx);
        if (mark[j]) continue;
        mark[j] = 1;
        out.push(j);
      }
    }
  }
  const seen = Int32Array.from(out);
  land.seen.set(player, seen);
  return seen;
}

/** Recompute the "currently seen" layer for a player: round its units, and its land and a square beyond (next to its cities in saves before version 30; nothing there before version 10). */
export function recomputeVisibility(state: GameState, player: number): void {
  const p = state.players[player]!;
  p.visible.fill(0);
  for (const u of state.units) {
    if (u.owner !== player) continue;
    revealAround(state, player, u.x, u.y, unitSight(state, u));
  }
  if (state.farContact) return;
  if (state.narrowSight) {
    for (const c of state.cities) if (c.owner === player) revealAround(state, player, c.x, c.y, 1);
    return;
  }
  for (const i of landSight(state, player)) {
    p.explored[i] = 1;
    p.visible[i] = 1;
  }
}
