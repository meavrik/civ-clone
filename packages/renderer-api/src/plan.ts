import { attackOdds, bestDefender, callsAt, canTradeRoute, checkMove, cityAt, cityById, findPath, moveAllowance, routeBonus, Terrain, unitAt, unitById, unitType, wrapX, type City, type GameState, type Unit } from "@civ/core";

/**
 * A move that waits for a second right-click on its square: what the map shows first, so that no single
 * click sends a unit across the map or into a fight. The route runs from the unit's first step to
 * the target; `text` is the note at its end ("3 turns", "Attack: 62%", "Take Rome", "Trade route +34").
 */
export interface MovePlan {
  unit: number;
  x: number;
  y: number;
  route: [number, number][];
  text: string;
}

/** The east-west step from `fromX` to an adjacent column `toX`, the short way round the wrap. */
function stepX(state: GameState, fromX: number, toX: number): number {
  let dx = wrapX(state.map, toX) - fromX;
  if (dx > 1) dx -= state.map.width;
  if (dx < -1) dx += state.map.width;
  return dx;
}

function adjacent(state: GameState, u: Unit, tx: number, ty: number): boolean {
  return Math.abs(stepX(state, u.x, tx)) <= 1 && Math.abs(ty - u.y) <= 1 && !(wrapX(state.map, tx) === u.x && ty === u.y);
}

/** Turns a unit takes along a route, this one counting as the first: each step costs what it would, a new turn refilling the moves. */
export function routeTurns(state: GameState, u: Unit, route: readonly [number, number][]): number {
  let moves = u.movesLeft;
  let turns = 1;
  let at = { x: u.x, y: u.y };
  const full = moveAllowance(state, u);
  for (const [x, y] of route) {
    if (moves <= 0) { turns++; moves = full; }
    const r = checkMove(state, { ...u, x: at.x, y: at.y, movesLeft: full, aboard: null }, stepX(state, at.x, x), y - at.y);
    moves = Math.max(0, moves - (r.ok ? r.cost : full));
    at = { x: wrapX(state.map, x), y };
  }
  return turns;
}

/** The way back to the city that supports a unit: the turns it takes, null where no route leads there. */
export interface HomeTrip {
  city: City;
  turns: number | null;
}

/** Unit `u`'s way home (the orders' Go home): null with no home city of its owner's to go to, or standing in it already. */
export function homeTrip(state: GameState, u: Unit): HomeTrip | null {
  const city = u.homeCity === null ? undefined : cityById(state, u.homeCity);
  if (!city || city.owner !== u.owner || (city.x === u.x && city.y === u.y)) return null;
  const route = findPath(state, u, city.x, city.y);
  return { city, turns: route && routeTurns(state, u, route) };
}

/** What caravan `u` would open by calling at the foreign city on (x, y), for the note ("Trade route +34"); null where it would open nothing. */
function tradeNote(state: GameState, u: Unit, x: number, y: number): string | null {
  const city = cityAt(state, x, y);
  if (!city || !callsAt(state, u, city) || canTradeRoute(state, u, city) !== null) return null;
  return `Trade route +${routeBonus(state, cityById(state, u.homeCity!)!, city)}`;
}

/**
 * What a right-click on (tx, ty) does with unit `id`: "step" when it moves next door at once (a plain
 * step, or a move the rules refuse, which then says why), a plan to show first when it would fight,
 * take a city, spend a caravan on a route or go further than next door, or null when the click has
 * nothing to do with the unit (its own square, or a square it has no route to).
 */
export function planMove(state: GameState, id: number, tx: number, ty: number): "step" | MovePlan | null {
  const u = unitById(state, id);
  if (!u || ty < 0 || ty >= state.map.height) return null;
  const x = wrapX(state.map, tx);
  if (x === u.x && ty === u.y) return null;
  const type = unitType(u.type);
  if (adjacent(state, u, x, ty)) {
    const trade = u.movesLeft > 0 ? tradeNote(state, u, x, ty) : null;
    if (trade) return { unit: id, x, y: ty, route: [[x, ty]], text: trade };
    const r = checkMove(state, u, stepX(state, u.x, x), ty - u.y);
    const soldier = type.attack > 0 && !type.flags?.includes("diplomat") && !type.flags?.includes("caravan");
    if (!r.ok && r.reason === "attack" && soldier) {
      const defender = bestDefender(state, x, ty, u);
      const odds = defender ? attackOdds(state, u, defender) : 1;
      return { unit: id, x, y: ty, route: [[x, ty]], text: `Attack: ${Math.round(odds * 100)}%` };
    }
    const city = cityAt(state, x, ty);
    if (r.ok && r.enemyCity && soldier && city && unitAt(state, x, ty).length === 0)
      return { unit: id, x, y: ty, route: [[x, ty]], text: `Take ${city.name}` };
    return "step";
  }
  // A land unit goes to sea only aboard one of its own ships waiting there.
  const to = state.map.tiles[ty * state.map.width + x]!;
  if (type.domain === "land" && to.terrain === Terrain.Ocean && !unitAt(state, x, ty).some((o) => o.owner === u.owner && unitType(o.type).domain === "sea")) return null;
  const route = findPath(state, u, x, ty);
  if (!route || route.length === 0) return null;
  const turns = routeTurns(state, u, route);
  const when = turns === 1 ? "This turn" : `${turns} turns`;
  const trade = tradeNote(state, u, x, ty);
  return { unit: id, x, y: ty, route, text: trade ? `${trade}: ${when.toLowerCase()}` : when };
}
