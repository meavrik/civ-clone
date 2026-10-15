import { generateMap, type MapGenOptions } from "./map/generate.js";
import { createRng } from "./rng.js";
import { MAP_HEIGHT, MAP_WIDTH, type GameState } from "./types.js";

export function newGame(seed: number, opts: MapGenOptions = {}): GameState {
  const rng = createRng(seed);
  const map = generateMap(rng, opts);
  return {
    seed,
    rng,
    turn: 0,
    map,
    explored: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
  };
}

/** Original calendar: 4000 BC start, 20 years/turn until 1 AD, then slower. */
export function turnToYear(turn: number): number {
  if (turn < 200) return -4000 + turn * 20;
  if (turn < 250) return (turn - 200) * 10 + 1;
  if (turn < 300) return 500 + (turn - 250) * 5;
  if (turn < 350) return 750 + (turn - 300) * 2;
  return 850 + (turn - 350);
}

export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : `${year} AD`;
}

/** Reveal a radius around (x, y) for player 0. */
export function reveal(state: GameState, cx: number, cy: number, radius = 1): void {
  const { width, height } = state.map;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = (((cx + dx) % width) + width) % width;
      state.explored[y * width + x] = 1;
    }
  }
}
