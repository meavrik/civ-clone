import { selectNextUnit } from "./commands.js";
import { generateMap, type MapGenOptions } from "./map/generate.js";
import { createRng, nextInt } from "./rng.js";
import { civ, CIVS } from "./rules/civs.js";
import { MAP_HEIGHT, MAP_WIDTH, Terrain, type GameState, type Player } from "./types.js";
import { createUnit } from "./units.js";
import { recomputeVisibility } from "./visibility.js";

export interface NewGameOptions extends MapGenOptions {
  /** Difficulty 0 (Chieftain) .. 4 (Emperor). */
  difficulty?: number;
  /** Civ id for the human player. */
  civ?: string;
  /** Number of AI opponents (0..6). */
  opponents?: number;
}

function makePlayer(id: number, civId: string, color: number, isAi: boolean): Player {
  return {
    id,
    civ: civId,
    name: civ(civId).name,
    isAi,
    alive: true,
    color,
    explored: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
    visible: new Uint8Array(MAP_WIDTH * MAP_HEIGHT),
    gold: 0,
    taxRate: 5,
    luxRate: 0,
    sciRate: 5,
    government: "despotism",
    science: 0,
    advances: [],
    researching: null,
    anarchyTurns: 0,
    pendingGovernment: null,
    difficulty: 2,
  };
}

export function newGame(seed: number, opts: NewGameOptions = {}): GameState {
  const rng = createRng(seed);
  const map = generateMap(rng, opts);
  const humanCiv = opts.civ ?? "romans";
  const others = CIVS.filter((c) => c.id !== humanCiv && c.id !== "barbarians");
  const opponents = Math.max(0, Math.min(others.length, opts.opponents ?? 2));
  const players: Player[] = [makePlayer(0, humanCiv, 0, false)];
  for (let i = 0; i < opponents; i++) {
    const pick = others.splice(nextInt(rng, others.length), 1)[0]!;
    players.push(makePlayer(players.length, pick.id, players.length, true));
  }
  const barbarians = players.length;
  players.push(makePlayer(barbarians, "barbarians", 5, true));

  const state: GameState = {
    seed,
    rng,
    turn: 0,
    map,
    players,
    units: [],
    cities: [],
    nextUnitId: 1,
    nextCityId: 1,
    relations: {},
    barbarians,
    currentPlayer: 0,
    activeUnit: null,
  };
  const difficulty = opts.difficulty ?? 2;
  for (const p of players) {
    p.difficulty = difficulty;
    p.gold = [100, 50, 0, 0, 0][difficulty] ?? 0;
  }

  // Starting positions: open land on decent continents, spread apart.
  const sizes = new Map<number, number>();
  for (const t of map.tiles) if (t.terrain !== Terrain.Ocean) sizes.set(t.continent, (sizes.get(t.continent) ?? 0) + 1);
  const candidates: number[] = [];
  for (let y = 6; y < map.height - 6; y++)
    for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y * map.width + x]!;
      if ((t.terrain === Terrain.Grassland || t.terrain === Terrain.Plains) && (sizes.get(t.continent) ?? 0) >= 40)
        candidates.push(y * map.width + x);
    }
  const starts: [number, number][] = [];
  const far = (x: number, y: number) =>
    starts.every(([sx, sy]) => Math.max(Math.min(Math.abs(sx - x), map.width - Math.abs(sx - x)), Math.abs(sy - y)) >= 10);
  for (const p of players) {
    if (p.id === barbarians) continue;
    let sx = 0;
    let sy = map.height >> 1;
    for (let tries = 0; tries < 200 && candidates.length; tries++) {
      const pick = candidates[nextInt(rng, candidates.length)]!;
      const x = pick % map.width;
      const y = Math.floor(pick / map.width);
      if (tries === 199 || far(x, y)) { sx = x; sy = y; break; }
    }
    starts.push([sx, sy]);
    const settlers = difficulty <= 1 || p.isAi ? 2 : 1;
    for (let i = 0; i < settlers; i++) createUnit(state, "settlers", p.id, sx, sy);
    recomputeVisibility(state, p.id);
    p.explored.set(p.visible);
  }
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
