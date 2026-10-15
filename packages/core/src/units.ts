import { MOVE_FRAC, TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { getTile, NEIGHBOURS, Terrain, wrapX, type GameState, type Unit } from "./types.js";

export function unitAt(state: GameState, x: number, y: number): Unit[] {
  const wx = wrapX(state.map, x);
  return state.units.filter((u) => u.x === wx && u.y === y);
}

export function unitById(state: GameState, id: number): Unit | undefined {
  return state.units.find((u) => u.id === id);
}

export function fullMoves(u: Unit): number {
  return unitType(u.type).moves * MOVE_FRAC;
}

export function createUnit(state: GameState, type: string, owner: number, x: number, y: number, homeCity: number | null = null): Unit {
  const u: Unit = {
    id: state.nextUnitId++,
    type,
    owner,
    x: wrapX(state.map, x),
    y,
    movesLeft: 0,
    veteran: false,
    order: { kind: "none" },
    homeCity,
  };
  u.movesLeft = fullMoves(u);
  state.units.push(u);
  return u;
}

/** Is an enemy land unit adjacent to (x, y)? Used for zones of control. */
export function enemyAdjacent(state: GameState, owner: number, x: number, y: number): boolean {
  for (const [dx, dy] of NEIGHBOURS) {
    const ny = y + dy;
    if (ny < 0 || ny >= state.map.height) continue;
    const nx = wrapX(state.map, x + dx);
    if (state.units.some((u) => u.owner !== owner && u.x === nx && u.y === ny && unitType(u.type).domain === "land"))
      return true;
  }
  return false;
}

export type MoveResult =
  | { ok: true; cost: number }
  | { ok: false; reason: "no-moves" | "off-map" | "terrain" | "zoc" | "occupied" | "attack" };

/**
 * Original movement rules:
 *  - terrain cost is paid in full; a unit with ANY moves left may always enter
 *    (the fractional-chance rule arrived in the sequel, not here)
 *  - road-to-road or river-to-river moves cost 1/3
 *  - land units cannot enter ocean; sea units cannot enter land (ports later)
 *  - zones of control: a land unit may not move from a tile adjacent to an
 *    enemy to another tile adjacent to an enemy, unless the destination holds
 *    a friendly unit (or a city, once cities exist)
 */
export function checkMove(state: GameState, u: Unit, dx: number, dy: number): MoveResult {
  if (u.movesLeft <= 0) return { ok: false, reason: "no-moves" };
  const ny = u.y + dy;
  const to = getTile(state.map, u.x + dx, ny);
  if (!to) return { ok: false, reason: "off-map" };
  const from = getTile(state.map, u.x, u.y)!;
  const type = unitType(u.type);

  if (type.domain === "land" && to.terrain === Terrain.Ocean) return { ok: false, reason: "terrain" };
  if (type.domain === "sea" && to.terrain !== Terrain.Ocean) return { ok: false, reason: "terrain" };

  const occupants = unitAt(state, u.x + dx, ny);
  if (occupants.some((o) => o.owner !== u.owner)) return { ok: false, reason: "attack" }; // combat: phase 5
  const friendlyThere = occupants.length > 0;

  if (
    type.domain === "land" &&
    !type.flags?.includes("ignoreZoc") &&
    !friendlyThere &&
    enemyAdjacent(state, u.owner, u.x, u.y) &&
    enemyAdjacent(state, u.owner, u.x + dx, ny)
  )
    return { ok: false, reason: "zoc" };

  let cost: number;
  if (type.domain !== "land") cost = MOVE_FRAC;
  else if (from.road && to.road) cost = 1;
  else if (from.river && to.river && (dx === 0 || dy === 0)) cost = 1;
  else cost = TERRAIN_RULES[to.terrain].moveCost * MOVE_FRAC;
  return { ok: true, cost };
}

export function applyMove(state: GameState, u: Unit, dx: number, dy: number, cost: number): void {
  u.x = wrapX(state.map, u.x + dx);
  u.y += dy;
  u.movesLeft = Math.max(0, u.movesLeft - cost);
  if (u.order.kind === "fortified" || u.order.kind === "fortifying" || u.order.kind === "sentry")
    u.order = { kind: "none" };
}

/** Which settler work is possible on the unit's tile, with turns required. */
export function workOptions(state: GameState, u: Unit): { irrigate?: number; mine?: number; road?: number } {
  if (!unitType(u.type).flags?.includes("settler")) return {};
  const t = getTile(state.map, u.x, u.y)!;
  const r = TERRAIN_RULES[t.terrain];
  const out: { irrigate?: number; mine?: number; road?: number } = {};
  if (r.irrigate && !t.irrigation && (r.irrigate.becomes !== undefined || hasWaterNearby(state, u.x, u.y)))
    out.irrigate = r.irrigate.turns;
  if (r.mine && !t.mine) out.mine = r.mine.turns;
  if (r.road.turns > 0 && !t.road && !t.river) out.road = r.road.turns;
  return out;
}

/** Irrigation needs an adjacent (orthogonal) ocean, river or irrigated tile. */
export function hasWaterNearby(state: GameState, x: number, y: number): boolean {
  if (getTile(state.map, x, y)?.river) return true;
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    const t = getTile(state.map, x + dx, y + dy);
    if (t && (t.terrain === Terrain.Ocean || t.river || t.irrigation)) return true;
  }
  return false;
}
