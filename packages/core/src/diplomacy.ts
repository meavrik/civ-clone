import type { GameState, Relation } from "./types.js";

function key(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function relation(state: GameState, a: number, b: number): Relation {
  if (a === b) return "peace";
  if (a === state.barbarians || b === state.barbarians) return "war";
  return state.relations[key(a, b)] ?? "none";
}

export function setRelation(state: GameState, a: number, b: number, r: Relation): void {
  if (a === b) return;
  state.relations[key(a, b)] = r;
}

export function atWar(state: GameState, a: number, b: number): boolean {
  return relation(state, a, b) === "war";
}

/** Has contact been made (any relation other than none)? */
export function hasContact(state: GameState, a: number, b: number): boolean {
  return relation(state, a, b) !== "none";
}

/**
 * Detect first contacts: a unit or city of `a` within sight (two tiles) of
 * one of `b`. Returns the ids of players newly contacted this call
 * (relation set to peace).
 */
export const CONTACT_RANGE = 2;

export function detectContacts(state: GameState, a: number): number[] {
  const met: number[] = [];
  const w = state.map.width;
  const near = (x1: number, y1: number, x2: number, y2: number) =>
    Math.abs(y1 - y2) <= CONTACT_RANGE && Math.min(Math.abs(x1 - x2), w - Math.abs(x1 - x2)) <= CONTACT_RANGE;
  const mine = [...state.units.filter((u) => u.owner === a), ...state.cities.filter((c) => c.owner === a)];
  for (const p of state.players) {
    if (p.id === a || !p.alive || p.id === state.barbarians || hasContact(state, a, p.id)) continue;
    const theirs = [...state.units.filter((u) => u.owner === p.id), ...state.cities.filter((c) => c.owner === p.id)];
    const touching = mine.some((m) => theirs.some((t) => near(m.x, m.y, t.x, t.y)));
    if (touching) {
      setRelation(state, a, p.id, "peace");
      met.push(p.id);
    }
  }
  return met;
}
