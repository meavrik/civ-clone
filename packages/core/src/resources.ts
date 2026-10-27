import { atWar, hasContact } from "./diplomacy.js";
import { RESOURCES, RESOURCE_BY_ID } from "./rules/resources.js";
import { specialOf } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { borderRadius, claimant, withinBorder } from "./territory.js";
import { getTile, wrapX, type GameState, type ResourceTrade } from "./types.js";

/**
 * Who holds which strategic resource (rules/resources.ts): the squares of it on a civilization's land
 * (`claims`), less those it trades away, and those traded to it (`GameState.resourceTrades`). A unit
 * that needs a resource is built only while its civilization holds it; units already in the field
 * keep going without. A civilization trades away only a square it holds and has not traded already,
 * never what it was traded itself, so a trade can hand over its last one. Trades end with a war
 * between the two, or when the one giving no longer holds the squares (`settleTrades`, as every
 * civilization's turn begins). Saves before version 33 (`noResources`) hold none and need none.
 */

/** What a civilization makes of one resource. */
export interface ResourceHolding {
  id: string;
  /** Squares of it on its land. */
  own: number;
  /** Of those, how many it trades away. */
  exported: number;
  /** How many it is traded. */
  imported: number;
  /** It may build what needs it. */
  has: boolean;
}

/** The squares of each strategic resource on `player`'s land, by resource id (each square once, counted for the city whose border holds it). */
export function resourceSquares(state: GameState, player: number): Map<string, { x: number; y: number }[]> {
  const out = new Map<string, { x: number; y: number }[]>();
  const { map } = state;
  const seen = new Set<number>();
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    const r = borderRadius(state, c);
    for (let dy = -r; dy <= r; dy++) {
      const y = c.y + dy;
      if (y < 0 || y >= map.height) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (!withinBorder(dx, dy, r)) continue;
        const x = wrapX(map, c.x + dx);
        const i = y * map.width + x;
        if (seen.has(i)) continue;
        const t = map.tiles[i]!;
        if (!t.special) continue;
        const id = specialOf(t)?.name;
        if (!id || !RESOURCE_BY_ID[id]) continue;
        seen.add(i);
        if (claimant(state, x, y)?.owner !== player) continue;
        const list = out.get(id);
        if (list) list.push({ x, y });
        else out.set(id, [{ x, y }]);
      }
    }
  }
  return out;
}

/** The trades `player` takes part in, oldest first; with `other`, only those between the two. */
export function tradesOf(state: GameState, player: number, other?: number): ResourceTrade[] {
  return (state.resourceTrades ?? []).filter((t) => (t.a === player || t.b === player) && (other === undefined || t.a === other || t.b === other));
}

/** What `player` gives in a trade (null if nothing), and what it gets. */
export function tradeSides(t: ResourceTrade, player: number): { gives: string | null; gets: string | null } {
  return t.a === player ? { gives: t.give, gets: t.take ?? null } : { gives: t.take ?? null, gets: t.give };
}

/** How `player` stands with every strategic resource, in `RESOURCES` order. */
export function resourceHoldings(state: GameState, player: number): ResourceHolding[] {
  const squares = resourceSquares(state, player);
  const trades = tradesOf(state, player);
  return RESOURCES.map((r) => {
    const own = squares.get(r.id)?.length ?? 0;
    let exported = 0;
    let imported = 0;
    for (const t of trades) {
      const { gives, gets } = tradeSides(t, player);
      if (gives === r.id) exported++;
      if (gets === r.id) imported++;
    }
    return { id: r.id, own, exported, imported, has: own - exported + imported > 0 };
  });
}

/** The strategic resources `player` holds now (all of them for the barbarians, who build from nothing; none asked in saves before version 33). */
export function heldResources(state: GameState, player: number): Set<string> {
  if (state.noResources || player === state.barbarians) return new Set(RESOURCES.map((r) => r.id));
  return new Set(resourceHoldings(state, player).filter((h) => h.has).map((h) => h.id));
}

export function hasResource(state: GameState, player: number, id: string): boolean {
  return heldResources(state, player).has(id);
}

/** The resources a unit type needs that `player` lacks; none in saves before version 33. `held` saves reckoning them again. */
export function missingResources(state: GameState, player: number, unitId: string, held?: Set<string>): string[] {
  const needs = unitType(unitId).needs;
  if (!needs?.length || state.noResources) return [];
  const have = held ?? heldResources(state, player);
  return needs.filter((n) => !have.has(n));
}

/** Can `player` trade `id` away: a square of it on its land that it does not trade already. */
export function canExport(state: GameState, player: number, id: string): boolean {
  if (state.noResources) return false;
  const h = resourceHoldings(state, player).find((x) => x.id === id);
  return h !== undefined && h.own - h.exported >= 1;
}

/** The resources `player` could trade away now. */
export function exportable(state: GameState, player: number): string[] {
  if (state.noResources) return [];
  return resourceHoldings(state, player).filter((h) => h.own - h.exported >= 1).map((h) => h.id);
}

/** May `a` and `b` trade resources: met, neither the barbarians, not at war. */
export function mayTrade(state: GameState, a: number, b: number): boolean {
  return !state.noResources && a !== b && a !== state.barbarians && b !== state.barbarians
    && state.players[a]?.alive === true && state.players[b]?.alive === true && hasContact(state, a, b) && !atWar(state, a, b);
}

/** Why `me` cannot let `them` have `give` for `take` (either may be absent, not both); null when it may go ahead. */
export function whyNoTrade(state: GameState, me: number, them: number, give?: string, take?: string): string | null {
  if (!mayTrade(state, me, them)) return "no trade";
  if (!give && !take) return "nothing to trade";
  if (give && (!RESOURCE_BY_ID[give] || !canExport(state, me, give))) return `no ${give} to spare`;
  if (take && (!RESOURCE_BY_ID[take] || !canExport(state, them, take))) return `they have no ${take} to spare`;
  if (give && hasResource(state, them, give)) return `they have ${give}`;
  if (take && hasResource(state, me, take)) return `we have ${take}`;
  return null;
}

/** Agree a trade (checked first with `whyNoTrade`): `from` lets `to` have `give`, and `to` lets `from` have `take` in a swap. */
export function addTrade(state: GameState, from: number, to: number, give: string, take?: string): ResourceTrade {
  const t: ResourceTrade = { a: from, b: to, give, ...(take ? { take } : {}), turn: state.turn };
  (state.resourceTrades ??= []).push(t);
  return t;
}

/** End every trade between `a` and `b` (a war, or one of them calls it off); the trades ended. */
export function endTrades(state: GameState, a: number, b: number): ResourceTrade[] {
  const ended = tradesOf(state, a, b);
  if (ended.length) state.resourceTrades = (state.resourceTrades ?? []).filter((t) => !ended.includes(t));
  return ended;
}

/**
 * Trades whose giver no longer holds the squares it gives (a city lost, a border shrunk), or whose
 * sides are at war or gone: the newest of a giver's go first, until what is left it can give. Run as
 * every civilization's turn begins. Each ended trade comes back with the side that could not keep it.
 */
export function settleTrades(state: GameState): { trade: ResourceTrade; by: number; why: "lost" | "war" }[] {
  const trades = state.resourceTrades;
  if (!trades?.length) return [];
  const ended: { trade: ResourceTrade; by: number; why: "lost" | "war" }[] = [];
  const drop = (t: ResourceTrade, by: number, why: "lost" | "war" = "lost") => { trades.splice(trades.indexOf(t), 1); ended.push({ trade: t, by, why }); };
  for (const t of [...trades]) if (!mayTrade(state, t.a, t.b)) drop(t, state.players[t.a]?.alive ? t.b : t.a, atWar(state, t.a, t.b) ? "war" : "lost");
  const givers = new Set(trades.flatMap((t) => (t.take ? [t.a, t.b] : [t.a])));
  for (const p of givers) {
    const squares = resourceSquares(state, p);
    for (const r of RESOURCES) {
      const own = squares.get(r.id)?.length ?? 0;
      const out = trades.filter((t) => tradeSides(t, p).gives === r.id);
      for (let i = out.length - 1; i >= 0 && out.length > own; i--) {
        if (!trades.includes(out[i]!)) continue;
        drop(out[i]!, p);
        out.splice(i, 1);
      }
    }
  }
  return ended;
}

/** A tile's strategic resource, if its special is one. */
export function resourceAt(state: GameState, x: number, y: number): string | null {
  const t = getTile(state.map, x, y);
  const id = t?.special ? specialOf(t)?.name : undefined;
  return id && RESOURCE_BY_ID[id] && !state.noResources ? id : null;
}
