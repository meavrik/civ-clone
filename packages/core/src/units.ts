import { knows } from "./rules/advances.js";
import { CLEAN_TURNS, FORTRESS_TURNS, MOVE_FRAC, RAILROAD_TURNS_FACTOR, TERRAIN_RULES } from "./rules/terrain.js";
import { CLASSIC_FIREPOWER, CLASSIC_HP, unitType, type UnitTypeRule } from "./rules/units.js";
import { getTile, NEIGHBOURS, Terrain, wrapX, type GameState, type Tile, type Unit, type WorkKind } from "./types.js";

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
    hp: maxHp(state, type),
    order: { kind: "none" },
    homeCity,
    aboard: null,
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

/** Cargo a ship is carrying. */
export function cargo(state: GameState, ship: Unit): Unit[] {
  return state.units.filter((u) => u.aboard === ship.id);
}

/** A friendly ship on the tile with room for one more. */
export function shipWithRoom(state: GameState, owner: number, x: number, y: number): Unit | undefined {
  return unitAt(state, x, y).find((s) => {
    if (s.owner !== owner) return false;
    const t = unitType(s.type);
    return t.domain === "sea" && (t.capacity ?? 0) > cargo(state, s).length;
  });
}

export type MoveResult =
  | { ok: true; cost: number; board?: number; disembark?: boolean; enemyCity?: boolean }
  | { ok: false; reason: "no-moves" | "off-map" | "terrain" | "rough" | "zoc" | "occupied" | "attack" | "full" };

/** Does this unit type need a road onto rough ground in this game? */
export function needsRoads(state: GameState, type: UnitTypeRule): boolean {
  return !state.classicTerrain && type.domain === "land" && type.wheeled === true;
}

/** Can a land unit of this type enter this land square? Wheeled units take rough ground only along a road. */
export function canEnter(state: GameState, type: UnitTypeRule, to: Tile): boolean {
  return !needsRoads(state, type) || !TERRAIN_RULES[to.terrain].rough || to.road;
}

/**
 * Share of full hit points a land unit of `owner` loses ending its turn on
 * (x, y): harsh ground wears units down, except within reach of the owner's
 * cities (the 21 squares a city works), on a river or a special, or once the
 * owner knows the advance that ends it. 0 when the square is safe.
 */
export function attrition(state: GameState, owner: number, x: number, y: number): number {
  if (state.classicTerrain) return 0;
  const t = getTile(state.map, x, y);
  const harsh = t && TERRAIN_RULES[t.terrain].attrition;
  if (!t || !harsh || t.river || t.special || knows(state.players[owner]!.advances, harsh.until)) return 0;
  const w = state.map.width;
  const supplied = state.cities.some((c) => {
    if (c.owner !== owner) return false;
    const dx = Math.min(Math.abs(c.x - x), w - Math.abs(c.x - x));
    const dy = Math.abs(c.y - y);
    return dx <= 2 && dy <= 2 && dx + dy < 4;
  });
  return supplied ? 0 : harsh.share;
}

/**
 * Original movement rules:
 *  - terrain cost is paid in full; a unit with ANY moves left may always enter
 *  - road-to-road or river-to-river moves cost 1/3
 *  - land units enter ocean only by boarding a friendly ship with room, and
 *    leave a ship only onto land; ships enter land only at a friendly city
 *  - (ours) wheeled units enter rough ground only along a road; attacking
 *    onto it is still allowed, since the attacker never moves in
 *  - zones of control: a land unit may not move from a tile adjacent to an
 *    enemy to another tile adjacent to an enemy, unless the destination
 *    holds a friendly unit or city
 *  - an enemy-occupied destination is an attack (resolved by the caller)
 */
export function checkMove(state: GameState, u: Unit, dx: number, dy: number): MoveResult {
  if (u.movesLeft <= 0) return { ok: false, reason: "no-moves" };
  const ny = u.y + dy;
  const to = getTile(state.map, u.x + dx, ny);
  if (!to) return { ok: false, reason: "off-map" };
  const from = getTile(state.map, u.x, u.y)!;
  const type = unitType(u.type);
  const nx = wrapX(state.map, u.x + dx);
  const friendlyCity = state.cities.find((c) => c.x === nx && c.y === ny && c.owner === u.owner);
  const enemyCity = state.cities.find((c) => c.x === nx && c.y === ny && c.owner !== u.owner);

  const occupants = unitAt(state, nx, ny);
  if (occupants.some((o) => o.owner !== u.owner)) return { ok: false, reason: "attack" };
  const friendlyThere = occupants.length > 0 || !!friendlyCity;

  let board: number | undefined;
  let disembark = false;
  if (type.domain === "land") {
    if (to.terrain === Terrain.Ocean) {
      const ship = shipWithRoom(state, u.owner, nx, ny);
      if (!ship) return { ok: false, reason: occupants.length ? "full" : "terrain" };
      board = ship.id;
    } else {
      if (!canEnter(state, type, to)) return { ok: false, reason: "rough" };
      if (u.aboard !== null) disembark = true;
    }
  } else if (type.domain === "sea") {
    if (to.terrain !== Terrain.Ocean && !friendlyCity) return { ok: false, reason: "terrain" };
  }

  if (
    type.domain === "land" &&
    !type.flags?.includes("ignoreZoc") &&
    !friendlyThere &&
    !enemyCity &&
    enemyAdjacent(state, u.owner, u.x, u.y) &&
    enemyAdjacent(state, u.owner, nx, ny)
  )
    return { ok: false, reason: "zoc" };

  let cost: number;
  if (type.domain !== "land" || board !== undefined) cost = MOVE_FRAC;
  else if (from.railroad && to.railroad) cost = 0;
  else if (from.road && to.road) cost = 1;
  else if (from.river && to.river && (dx === 0 || dy === 0)) cost = 1;
  else cost = TERRAIN_RULES[to.terrain].moveCost * MOVE_FRAC;
  const r: MoveResult = { ok: true, cost };
  if (board !== undefined) r.board = board;
  if (disembark) r.disembark = true;
  if (enemyCity) r.enemyCity = true;
  return r;
}

/** Full hit points of a unit type under this game's rules. */
export function maxHp(state: GameState, type: string): number {
  return state.classicCombat ? CLASSIC_HP : unitType(type).hp;
}

/** Hit points a won round takes off the enemy under this game's rules. */
export function firepower(state: GameState, type: string): number {
  return state.classicCombat ? CLASSIC_FIREPOWER : unitType(type).firepower;
}

/**
 * One square a unit moved, for the UI to animate. `aboard` names the ship
 * that carried it along.
 */
export interface UnitStep {
  kind: "step";
  unit: number;
  type: string;
  owner: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  aboard?: number;
}

/** One side of a fight, as it stood when the fight began. */
export interface BattleSide {
  unit: number;
  type: string;
  owner: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  firepower: number;
}

/** A fight, round by round, for the UI to animate. */
export interface UnitBattle {
  kind: "battle";
  attacker: BattleSide;
  defender: BattleSide;
  /** Who won each round, in order: true for the attacker. */
  rounds: boolean[];
  attackerWon: boolean;
  /** Units lost along with the loser: the rest of a stack in the open, a sunk ship's cargo. */
  alsoLost: number[];
}

export type UnitAction = UnitStep | UnitBattle;

/**
 * Every step and fight since the current player's turn began, in order;
 * endTurn empties it. Not game state: replays and the AI never read it.
 */
export const lastActions: UnitAction[] = [];

export function applyMove(state: GameState, u: Unit, dx: number, dy: number, r: Extract<MoveResult, { ok: true }>): void {
  const fromX = u.x;
  const fromY = u.y;
  u.x = wrapX(state.map, u.x + dx);
  u.y += dy;
  lastActions.push({ kind: "step", unit: u.id, type: u.type, owner: u.owner, fromX, fromY, toX: u.x, toY: u.y });
  u.movesLeft = Math.max(0, u.movesLeft - r.cost);
  if (u.order.kind === "fortified" || u.order.kind === "fortifying" || u.order.kind === "sentry")
    u.order = { kind: "none" };
  if (r.board !== undefined) {
    u.aboard = r.board;
    u.order = { kind: "sentry" };
    u.movesLeft = 0;
  } else if (r.disembark) u.aboard = null;
  // A moving ship carries its cargo.
  if (unitType(u.type).domain === "sea")
    for (const c of cargo(state, u)) {
      lastActions.push({ kind: "step", unit: c.id, type: c.type, owner: c.owner, fromX: c.x, fromY: c.y, toX: u.x, toY: u.y, aboard: u.id });
      c.x = u.x;
      c.y = u.y;
    }
}

/** Which settler work is possible on the unit's tile, with turns required. */
export function workOptions(state: GameState, u: Unit): Partial<Record<WorkKind, number>> {
  if (!unitType(u.type).flags?.includes("settler") || u.aboard !== null) return {};
  const t = getTile(state.map, u.x, u.y)!;
  const r = TERRAIN_RULES[t.terrain];
  const known = state.players[u.owner]!.advances;
  const out: Partial<Record<WorkKind, number>> = {};
  if (r.irrigate && !t.irrigation && (r.irrigate.becomes !== undefined || hasWaterNearby(state, u.x, u.y)))
    out.irrigate = r.irrigate.turns;
  if (r.mine && !t.mine) out.mine = r.mine.turns;
  if (r.road.turns > 0 && !t.road && !t.river) out.road = r.road.turns;
  if (t.road && !t.railroad && knows(known, "railroad")) out.railroad = Math.max(2, r.road.turns * RAILROAD_TURNS_FACTOR);
  if (!t.fortress && t.terrain !== Terrain.Ocean && knows(known, "construction") && !state.cities.some((c) => c.x === u.x && c.y === u.y))
    out.fortress = FORTRESS_TURNS;
  if (t.pollution) out.clean = CLEAN_TURNS;
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
