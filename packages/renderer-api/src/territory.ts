import { claims, NEIGHBOURS, Terrain, wrapX, type GameState } from "@civ/core";
import { ANCHOR_CELL } from "./places.js";

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

/** Where a civilization's name goes on a map of its land (`territoryLabels`): a square, and how much land the name stands for. */
export interface TerritoryLabel {
  owner: number;
  x: number;
  y: number;
  /** Land squares in the piece named. */
  squares: number;
}

/**
 * Where to write each civilization's name over its land (asked for 2026-10-26, the world map: "show
 * borders as filled colors - if possible show civ names"): its biggest piece of explored land (claimed
 * squares joined side to side, across the east-west seam too), at the land square nearest the middle
 * of it, so the name sits on its land. Biggest first; nothing the viewer has not explored.
 */
export function territoryLabels(state: GameState, t: Territory, viewer = state.currentPlayer): TerritoryLabel[] {
  const { width, height } = t;
  const explored = state.players[viewer]!.explored;
  const seen = new Uint8Array(width * height);
  const best = new Map<number, TerritoryLabel>();
  for (let i = 0; i < width * height; i++) {
    const own = t.owner[i]!;
    if (own < 0 || seen[i] || !explored[i]) continue;
    // The piece, with x unwrapped from where it was entered, so a piece across the seam keeps its shape.
    const piece: { i: number; x: number; y: number }[] = [];
    const queue = [{ i, x: i % width, y: Math.floor(i / width) }];
    seen[i] = 1;
    while (queue.length) {
      const q = queue.pop()!;
      piece.push(q);
      for (const [dx, dy] of SIDES) {
        const y = q.y + dy;
        if (y < 0 || y >= height) continue;
        const x = q.x + dx;
        const j = y * width + (((x % width) + width) % width);
        if (seen[j] || !explored[j] || t.owner[j] !== own) continue;
        seen[j] = 1;
        queue.push({ i: j, x, y });
      }
    }
    // A name stands on land: a piece of sea alone (its land not yet explored) names no one.
    const land = piece.filter((p) => state.map.tiles[p.i]!.terrain !== Terrain.Ocean);
    if (!land.length || (best.get(own)?.squares ?? 0) >= land.length) continue;
    const mx = land.reduce((n, p) => n + p.x, 0) / land.length;
    const my = land.reduce((n, p) => n + p.y, 0) / land.length;
    const at = land.reduce((a, p) => ((p.x - mx) ** 2 + (p.y - my) ** 2 < (a.x - mx) ** 2 + (a.y - my) ** 2 ? p : a));
    best.set(own, { owner: own, x: at.i % width, y: at.y, squares: land.length });
  }
  return [...best.values()].sort((a, b) => b.squares - a.squares);
}

/** A civilization's name to write on the map (`civNameSpots`): the squares of the view (from its top left) it may be centred on, the best first. */
export interface CivNameSpot {
  owner: number;
  at: { tx: number; ty: number }[];
}

/**
 * Where to write each civilization's name on the map (asked for 2026-10-28: "show name of the civ on the
 * territory"). Fixed by its land alone, as the places' names are (`ANCHOR_CELL`), so a name stays put while
 * the camera moves: in each block of `ANCHOR_CELL` squares its explored land covers, the land square deepest
 * inside its border, never a city's square and none on the border's edge where it has an inside (on a tie the
 * nearest the middle of its land in the block, then the first in reading order). A city's first land (its 3x3)
 * holds nothing inside but the city, so no name until its border grows. For the view: each civilization with
 * an anchor on it a square in from its sides, its anchors nearest the view's middle first; the civilizations
 * with the most land on view first.
 */
export function civNameSpots(state: GameState, t: Territory, viewer: number, x0: number, y0: number, cols: number, rows: number): CivNameSpot[] {
  const { map } = state;
  const { width, height } = t;
  const explored = state.players[viewer]?.explored;
  if (!explored) return [];
  const own = (i: number) => (explored[i] ? t.owner[i]! : -1);
  // How deep each explored claimed square lies inside its owner's land: 1 on its edge (next to another's
  // land, no one's, the unexplored or the end of the world), more inward.
  const depth = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let i = 0; i < width * height; i++) {
    const o = own(i);
    if (o < 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of NEIGHBOURS) {
      if (y + dy < 0 || y + dy >= height || own((y + dy) * width + wrapX(map, x + dx)) !== o) { depth[i] = 1; queue.push(i); break; }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const x = c % width;
    const y = (c - x) / width;
    for (const [dx, dy] of NEIGHBOURS) {
      if (y + dy < 0 || y + dy >= height) continue;
      const j = (y + dy) * width + wrapX(map, x + dx);
      if (depth[j] || own(j) !== own(c)) continue;
      depth[j] = Math.min(255, depth[c]! + 1);
      queue.push(j);
    }
  }
  // The land a name may stand on, the deepest of it for each owner, and the middle of each owner's land in each block.
  const cities = new Set(state.cities.map((c) => c.y * width + c.x));
  const across = Math.ceil(width / ANCHOR_CELL.w);
  const cellOf = (x: number, y: number) => Math.floor(y / ANCHOR_CELL.h) * across + Math.floor(x / ANCHOR_CELL.w);
  const blocks = across * Math.ceil(height / ANCHOR_CELL.h);
  const land = (i: number) => own(i) >= 0 && map.tiles[i]!.terrain !== Terrain.Ocean;
  const ground = (i: number) => land(i) && !cities.has(i);
  // How deep its land goes (its cities' squares too: a young city's 3x3 has an inside, the city).
  const deepest = new Map<number, number>();
  for (let i = 0; i < width * height; i++) if (land(i)) deepest.set(own(i), Math.max(deepest.get(own(i)) ?? 0, depth[i]!));
  const middle = new Map<number, { n: number; x: number; y: number }>();
  for (let i = 0; i < width * height; i++) {
    if (!ground(i)) continue;
    const o = own(i);
    const x = i % width;
    const y = (i - x) / width;
    const key = o * blocks + cellOf(x, y);
    const m = middle.get(key) ?? { n: 0, x: 0, y: 0 };
    middle.set(key, { n: m.n + 1, x: m.x + x, y: m.y + y });
  }
  const best = new Map<number, { i: number; d: number; off: number }>();
  for (let i = 0; i < width * height; i++) {
    if (!ground(i)) continue;
    const o = own(i);
    if (depth[i]! < Math.min(2, deepest.get(o)!)) continue;
    const x = i % width;
    const y = (i - x) / width;
    const key = o * blocks + cellOf(x, y);
    const m = middle.get(key)!;
    const off = (x - m.x / m.n) ** 2 + (y - m.y / m.n) ** 2;
    const b = best.get(key);
    if (!b || depth[i]! > b.d || (depth[i] === b.d && off < b.off)) best.set(key, { i, d: depth[i]!, off });
  }
  // The view: each owner's land on it, and its anchors a square in from its sides, the nearest its middle first.
  const onView = new Map<number, number>();
  for (let ty = 0; ty < rows; ty++) {
    const y = y0 + ty;
    if (y < 0 || y >= height) continue;
    for (let tx = 0; tx < cols; tx++) {
      const o = own(y * width + wrapX(map, x0 + tx));
      if (o >= 0) onView.set(o, (onView.get(o) ?? 0) + 1);
    }
  }
  const spots = new Map<number, { tx: number; ty: number; d: number }[]>();
  for (const [key, { i }] of best) {
    const owner = Math.floor(key / blocks);
    const x = i % width;
    const tx = (((x - x0) % width) + width) % width;
    const ty = (i - x) / width - y0;
    if (tx < 1 || tx >= cols - 1 || ty < 0 || ty >= rows) continue;
    const list = spots.get(owner) ?? [];
    list.push({ tx, ty, d: (tx - (cols - 1) / 2) ** 2 + (ty - (rows - 1) / 2) ** 2 });
    spots.set(owner, list);
  }
  return [...spots]
    .map(([owner, at]) => ({ owner, at: at.sort((a, b) => a.d - b.d || a.ty - b.ty || a.tx - b.tx).map(({ tx, ty }) => ({ tx, ty })) }))
    .sort((a, b) => (onView.get(b.owner) ?? 0) - (onView.get(a.owner) ?? 0) || a.owner - b.owner);
}
