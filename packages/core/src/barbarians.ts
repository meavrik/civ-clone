import { nextInt } from "./rng.js";
import { NEIGHBOURS, Terrain, wrapX, type GameState } from "./types.js";
import { createUnit } from "./units.js";

/**
 * Barbarian landings: from 1000 BC on, every so often a raiding party
 * appears on a coastal tile near a city of the strongest civ. The party
 * grows with the era (legions, then knights, then musketeers).
 */
export function maybeSpawnBarbarians(state: GameState): void {
  if (state.turn < 150) return; // ~1000 BC
  if (nextInt(state.rng, 100) >= 6) return;
  const targets = state.cities.filter((c) => c.owner !== state.barbarians);
  if (targets.length === 0) return;
  const city = targets[nextInt(state.rng, targets.length)]!;
  // Find a land tile 3..5 away that touches the sea.
  for (let tries = 0; tries < 40; tries++) {
    const dx = nextInt(state.rng, 11) - 5;
    const dy = nextInt(state.rng, 11) - 5;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) continue;
    const x = wrapX(state.map, city.x + dx);
    const y = city.y + dy;
    if (y < 1 || y >= state.map.height - 1) continue;
    const t = state.map.tiles[y * state.map.width + x]!;
    if (t.terrain === Terrain.Ocean || t.terrain === Terrain.Arctic) continue;
    const coastal = NEIGHBOURS.some(([ex, ey]) => {
      const ny = y + ey;
      return ny >= 0 && ny < state.map.height && state.map.tiles[ny * state.map.width + wrapX(state.map, x + ex)]!.terrain === Terrain.Ocean;
    });
    if (!coastal) continue;
    if (state.units.some((u) => u.x === x && u.y === y) || state.cities.some((c) => c.x === x && c.y === y)) continue;
    const era = state.turn < 250 ? 0 : state.turn < 350 ? 1 : 2;
    const types = [["legion", "legion", "militia"], ["knights", "legion", "catapult"], ["musketeers", "cannon", "knights"]][era]!;
    const count = 2 + nextInt(state.rng, 2);
    for (let i = 0; i < count; i++) createUnit(state, types[i % types.length]!, state.barbarians, x, y);
    return;
  }
}
