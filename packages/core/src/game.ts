import { selectNextUnit } from "./commands.js";
import { generateMap, type MapGenOptions } from "./map/generate.js";
import { createRng, nextInt } from "./rng.js";
import { MAP_HEIGHT, MAP_WIDTH, Terrain, type GameState, type Player } from "./types.js";
import { createUnit } from "./units.js";
import { recomputeVisibility } from "./visibility.js";

export interface NewGameOptions extends MapGenOptions {
  /** Difficulty 0 (Chieftain) .. 4 (Emperor). Affects starting units for now. */
  difficulty?: number;
  playerName?: string;
}

function makePlayer(id: number, name: string, color: number): Player {
  return {
    id,
    name,
    color,
    explored: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
    visible: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
  };
}

export function newGame(seed: number, opts: NewGameOptions = {}): GameState {
  const rng = createRng(seed);
  const map = generateMap(rng, opts);
  const state: GameState = {
    seed,
    rng,
    turn: 0,
    map,
    players: [makePlayer(0, opts.playerName ?? "Player", 0)],
    units: [],
    nextUnitId: 1,
    currentPlayer: 0,
    activeUnit: null,
  };

  // Starting position: open land on a decently sized continent, not polar.
  const sizes = new Map<number, number>();
  for (const t of map.tiles) if (t.terrain !== Terrain.Ocean) sizes.set(t.continent, (sizes.get(t.continent) ?? 0) + 1);
  const candidates: number[] = [];
  for (let y = 6; y < map.height - 6; y++)
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x]!;
      if ((t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains) && (sizes.get(t.continent) ?? 0) >= 40)
        candidates.push(y * map.width + x);
    }
  const pick = candidates.length ? candidates[nextInt(rng, candidates.length)]! : map.width * (map.height >> 1);
  const sx = pick % map.width;
  const sy = Math.floor(pick / map.width);

  const settlers = (opts.difficulty ?? 2) <= 1 ? 2 : 1;
  for (let i = 0; i < settlers; i++) createUnit(state, "settlers", 0, sx, sy);
  recomputeVisibility(state, 0);
  state.players[0]!.explored.set(state.players[0]!.visible);
  selectNextUnit(state, null);
  return state;
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
