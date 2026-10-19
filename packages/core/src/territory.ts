import { building } from "./rules/buildings.js";
import { CULTURE } from "./rules/culture.js";
import type { City, GameState } from "./types.js";

/**
 * A civilization's land: each city claims the squares within its border, which
 * reaches further as the city's culture mounts (`borderRadius`). Where cities of
 * two civilizations reach the same square, the nearer city takes it, then the
 * one with more culture, then the older. The rules read it for trespass
 * (`diplomacy.ts`); the renderers draw its edge as borders. Saves before
 * culture (`fixedBorders`) keep each city to the 21 squares it works, the
 * nearer then the older city winning.
 */

/** Culture a city gathers in a turn: a little from its people, more from its temples, libraries and wonders. */
export function cultureRate(_state: GameState, city: City): number {
  let n = CULTURE.base + Math.floor(city.size / CULTURE.perCitizens);
  for (const b of city.buildings) n += building(b).culture ?? 0;
  return n + city.wonders.length * CULTURE.wonder;
}

/** How many squares out a city's border reaches: 1 when founded, one more at each culture level. */
export function borderRadius(state: GameState, city: City): number {
  if (state.fixedBorders) return 2;
  let r = 1;
  for (const need of CULTURE.levels) if (city.culture >= need) r++;
  return r;
}

/** The culture a city needs for its border to grow again; null once it reaches as far as borders go. */
export function nextBorderLevel(state: GameState, city: City): number | null {
  if (state.fixedBorders) return null;
  return CULTURE.levels.find((need) => city.culture < need) ?? null;
}

/** Whether a square (dx, dy) from a city lies within a border of radius r: a disc filled out at its rim (radius 2 is the 21-square fat cross). */
export function withinBorder(dx: number, dy: number, r: number): boolean {
  return dx * dx + dy * dy <= r * r + r;
}

/** Whether `c`, at squared distance d from a square, takes it from the city holding it so far. */
function beats(state: GameState, c: City, d: number, holder: City | null, holderD: number): boolean {
  if (!holder || d < holderD) return true;
  if (d > holderD) return false;
  if (!state.fixedBorders && c.culture !== holder.culture) return c.culture > holder.culture;
  return c.id < holder.id;
}

/** The owner of every square (y * width + x), or -1; only cities `counts` accepts reach out (the renderers count those the viewer knows). */
export function claims(state: GameState, counts: (c: City) => boolean = () => true): Int16Array {
  const { width, height } = state.map;
  const owner = new Int16Array(width * height).fill(-1);
  const near = new Float64Array(width * height).fill(Infinity);
  const holder: (City | null)[] = new Array<City | null>(width * height).fill(null);
  for (const c of state.cities) {
    if (!counts(c)) continue;
    const r = borderRadius(state, c);
    for (let dy = -r; dy <= r; dy++) {
      const y = c.y + dy;
      if (y < 0 || y >= height) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (!withinBorder(dx, dy, r)) continue;
        const i = y * width + (((c.x + dx) % width) + width) % width;
        const d = dx * dx + dy * dy;
        if (!beats(state, c, d, holder[i]!, near[i]!)) continue;
        near[i] = d;
        holder[i] = c;
        owner[i] = c.owner;
      }
    }
  }
  return owner;
}

/** Whose land square (x, y) is, as `claims` has it; -1 when no city reaches it. */
export function landOwner(state: GameState, x: number, y: number): number {
  const w = state.map.width;
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of state.cities) {
    let dx = Math.abs(c.x - x) % w;
    if (dx > w / 2) dx = w - dx;
    const dy = Math.abs(c.y - y);
    if (!withinBorder(dx, dy, borderRadius(state, c))) continue;
    const d = dx * dx + dy * dy;
    if (beats(state, c, d, best, bestD)) { best = c; bestD = d; }
  }
  return best ? best.owner : -1;
}
