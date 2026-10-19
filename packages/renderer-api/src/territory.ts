import { claims, type GameState } from "@civ/core";

/**
 * Civilization borders, as drawn: the land each civilization claims (core's
 * `claims`: each city the squares within its border, which grows with its
 * culture; the nearer, then the more cultured, then the older city wins a
 * shared square). The rules read the same claims for trespass. Only cities the viewer has explored count, so borders show
 * nothing that lies under the fog.
 */
export interface Territory {
  width: number;
  height: number;
  /** Owning player of each square (y * width + x), or -1. */
  owner: Int16Array;
}

export function territory(state: GameState, viewer = state.currentPlayer): Territory {
  const { width, height } = state.map;
  const explored = state.players[viewer]?.explored;
  const owner = claims(state, (c) => !explored || explored[c.y * width + c.x] === 1);
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
