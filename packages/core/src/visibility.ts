import { unitType } from "./rules/units.js";
import { wrapX, type GameState } from "./types.js";

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

/** Recompute the "currently seen" layer for a player from its units. */
export function recomputeVisibility(state: GameState, player: number): void {
  const p = state.players[player]!;
  p.visible.fill(0);
  for (const u of state.units) {
    if (u.owner !== player) continue;
    revealAround(state, player, u.x, u.y, unitType(u.type).sight);
  }
}
