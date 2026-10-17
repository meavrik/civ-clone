import { CITY_RADIUS, type GameState } from "@civ/core";

/**
 * Civilization borders, for drawing only (the original has none, and the
 * rules never read them). Each city claims the squares it can work (the
 * 21-square `CITY_RADIUS`); where cities of two civilizations reach the same
 * square, the nearer city takes it, then the older. Only cities the viewer
 * has explored count, so borders show nothing that lies under the fog.
 */
export interface Territory {
  width: number;
  height: number;
  /** Owning player of each square (y * width + x), or -1. */
  owner: Int16Array;
}

export function territory(state: GameState, viewer = state.currentPlayer): Territory {
  const { width, height } = state.map;
  const owner = new Int16Array(width * height).fill(-1);
  const near = new Float64Array(width * height).fill(Infinity);
  const explored = state.players[viewer]?.explored;
  // Older cities first, so on a tie the first claim stands.
  const cities = [...state.cities].sort((a, b) => a.id - b.id);
  for (const c of cities) {
    if (explored && !explored[c.y * width + c.x]) continue;
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
  return { width, height, owner };
}

/** Owner of square (x, y), wrapping east-west; -1 when unclaimed or off the map. */
export function ownerAt(t: Territory, x: number, y: number): number {
  if (y < 0 || y >= t.height) return -1;
  return t.owner[y * t.width + (((x % t.width) + t.width) % t.width)]!;
}

/**
 * One side of a claimed square where the border runs (the square beyond
 * belongs to someone else, or no one). `side` is 0 north, 1 east, 2 south,
 * 3 west, running west to east or north to south. A border line drawn just
 * inside it reaches past the square's corner at its start or end (`startOut`,
 * `endOut`, by one line width) where the border turns away round an inner
 * corner, so the line has no notch there.
 */
export interface BorderSide {
  side: number;
  startOut: boolean;
  endOut: boolean;
}

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
/** For each side: the sides at its start and its end. */
const ENDS = [[3, 1], [0, 2], [3, 1], [0, 2]] as const;

/** Where the border runs around square (x, y), for its owner; none on an unclaimed square. */
export function borderSides(t: Territory, x: number, y: number): BorderSide[] {
  const own = ownerAt(t, x, y);
  if (own < 0) return [];
  const differs = SIDES.map(([dx, dy]) => ownerAt(t, x + dx, y + dy) !== own);
  const out: BorderSide[] = [];
  SIDES.forEach(([dx, dy], side) => {
    if (!differs[side]) return;
    // Round an inner corner: the side next to this one is ours and so is the square diagonally beyond.
    const turns = (other: number) => {
      if (differs[other]) return false;
      const [ox, oy] = SIDES[other]!;
      return ownerAt(t, x + dx + ox, y + dy + oy) === own;
    };
    const [start, end] = ENDS[side]!;
    out.push({ side, startOut: turns(start), endOut: turns(end) });
  });
  return out;
}
