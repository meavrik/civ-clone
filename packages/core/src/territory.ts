import { CITY_RADIUS, type City, type GameState } from "./types.js";

/**
 * A civilization's land: each city claims the squares it can work (the
 * 21-square `CITY_RADIUS`); where cities of two civilizations reach the same
 * square, the nearer city takes it, then the older. The rules read it for
 * trespass (`diplomacy.ts`); the renderers draw its edge as borders.
 */
export function claims(state: GameState, counts: (c: City) => boolean = () => true): Int16Array {
  const { width, height } = state.map;
  const owner = new Int16Array(width * height).fill(-1);
  const near = new Float64Array(width * height).fill(Infinity);
  // Older cities first, so on a tie the first claim stands.
  const cities = [...state.cities].sort((a, b) => a.id - b.id);
  for (const c of cities) {
    if (!counts(c)) continue;
    for (const [dx, dy] of CITY_RADIUS) {
      const y = c.y + dy;
      if (y < 0 || y >= height) continue;
      const i = y * width + (((c.x + dx) % width) + width) % width;
      const d = dx * dx + dy * dy;
      if (d >= near[i]!) continue;
      near[i] = d;
      owner[i] = c.owner;
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
    // The fat cross: within two squares each way, corners cut.
    if (dx > 2 || dy > 2 || (dx === 2 && dy === 2)) continue;
    const d = dx * dx + dy * dy;
    if (d < bestD || (d === bestD && best && c.id < best.id)) { best = c; bestD = d; }
  }
  return best ? best.owner : -1;
}
