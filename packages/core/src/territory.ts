import { building } from "./rules/buildings.js";
import { ACCRUED_CULTURE, CULTURE, INFLUENCE } from "./rules/culture.js";
import type { City, GameState } from "./types.js";

/**
 * A civilization's land: each city claims the squares within its border, which
 * reaches further as the city's culture grows (`borderRadius`). Where cities of
 * two civilizations reach the same square, the nearer city takes it, then the
 * one with more culture, then the older. The rules read it for trespass
 * (`diplomacy.ts`); the renderers draw its edge as borders. Saves before
 * culture (`fixedBorders`) keep each city to the 21 squares it works, the
 * nearer then the older city winning.
 */

/** A city's culture: one for each citizen, its buildings' share and its wonders'. Saves before version 14 gathered it turn by turn (`City.culture`). */
export function cityCulture(state: GameState, city: City): number {
  if (state.accruedCulture) return city.culture;
  let n = city.size * CULTURE.perCitizen;
  for (const b of city.buildings) n += building(b).culture ?? 0;
  return n + city.wonders.length * CULTURE.wonder;
}

/** A civilization's influence: the culture of all its cities. */
export function civInfluence(state: GameState, player: number): number {
  let n = 0;
  for (const c of state.cities) if (c.owner === player) n += cityCulture(state, c);
  return n;
}

export type Esteem = "admired" | "respected" | "scorned";

/** How civilization `judge` regards `of`'s influence against its own: admired when far greater, scorned when far less (`INFLUENCE`). */
export function esteem(state: GameState, judge: number, of: number): Esteem {
  const theirs = civInfluence(state, judge) + INFLUENCE.floor;
  const ours = civInfluence(state, of) + INFLUENCE.floor;
  if (ours >= theirs * INFLUENCE.admired) return "admired";
  if (theirs >= ours * INFLUENCE.scorned) return "scorned";
  return "respected";
}

/** Culture a city gathered in a turn in saves before version 14 (`accruedCulture`): a little from its people, more from its temples, libraries and wonders. */
export function cultureRate(_state: GameState, city: City): number {
  let n = ACCRUED_CULTURE.base + Math.floor(city.size / ACCRUED_CULTURE.perCitizens);
  for (const b of city.buildings) n += ACCRUED_CULTURE.buildings[b] ?? 0;
  return n + city.wonders.length * ACCRUED_CULTURE.wonder;
}

function cultureLevels(state: GameState): readonly number[] {
  return state.accruedCulture ? ACCRUED_CULTURE.levels : CULTURE.levels;
}

/** How many squares out a border reaches for a city with this much culture: 1 when founded, one more at each level. */
function radiusFor(state: GameState, culture: number): number {
  if (state.fixedBorders) return 2;
  let r = 1;
  for (const need of cultureLevels(state)) if (culture >= need) r++;
  return r;
}

/** How many squares out a city's border reaches: 1 when founded, one more at each culture level. */
export function borderRadius(state: GameState, city: City): number {
  return radiusFor(state, cityCulture(state, city));
}

/** The culture a city needs for its border to grow again; null once it reaches as far as borders go. */
export function nextBorderLevel(state: GameState, city: City): number | null {
  if (state.fixedBorders) return null;
  const culture = cityCulture(state, city);
  return cultureLevels(state).find((need) => culture < need) ?? null;
}

/** Whether a square (dx, dy) from a city lies within a border of radius r: a disc filled out at its rim (radius 2 is the 21-square fat cross). */
export function withinBorder(dx: number, dy: number, r: number): boolean {
  return dx * dx + dy * dy <= r * r + r;
}

/** Whether `c` (with this culture), at squared distance d from a square, takes it from the city holding it so far. */
function beats(state: GameState, c: City, culture: number, d: number, holder: City | null, holderCulture: number, holderD: number): boolean {
  if (!holder || d < holderD) return true;
  if (d > holderD) return false;
  if (!state.fixedBorders && culture !== holderCulture) return culture > holderCulture;
  return c.id < holder.id;
}

/** The owner of every square (y * width + x), or -1; only cities `counts` accepts reach out (the renderers count those the viewer knows). */
export function claims(state: GameState, counts: (c: City) => boolean = () => true): Int16Array {
  const { width, height } = state.map;
  const owner = new Int16Array(width * height).fill(-1);
  const near = new Float64Array(width * height).fill(Infinity);
  const holder: (City | null)[] = new Array<City | null>(width * height).fill(null);
  const held = new Float64Array(width * height);
  for (const c of state.cities) {
    if (!counts(c)) continue;
    const culture = cityCulture(state, c);
    const r = radiusFor(state, culture);
    for (let dy = -r; dy <= r; dy++) {
      const y = c.y + dy;
      if (y < 0 || y >= height) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (!withinBorder(dx, dy, r)) continue;
        const i = y * width + (((c.x + dx) % width) + width) % width;
        const d = dx * dx + dy * dy;
        if (!beats(state, c, culture, d, holder[i]!, held[i]!, near[i]!)) continue;
        near[i] = d;
        holder[i] = c;
        held[i] = culture;
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
  let bestCulture = 0;
  let bestD = Infinity;
  for (const c of state.cities) {
    let dx = Math.abs(c.x - x) % w;
    if (dx > w / 2) dx = w - dx;
    const dy = Math.abs(c.y - y);
    const culture = cityCulture(state, c);
    if (!withinBorder(dx, dy, radiusFor(state, culture))) continue;
    const d = dx * dx + dy * dy;
    if (beats(state, c, culture, d, best, bestCulture, bestD)) { best = c; bestCulture = culture; bestD = d; }
  }
  return best ? best.owner : -1;
}
