import { advance, claimant, getTile, inCatalogue, mapDistance, resourceAt, resourceKnown, resourceRoaded, resourcesIn, resourceHoldings, resourceSquares, revealedBy, Terrain, tradesOf, tradeSides, UNIT_TYPES, type GameState, type ResourceHolding } from "@civ/core";
import type { ReportLine, ReportPage } from "./index.js";

/** The units that need a strategic resource, by name, in the rules' order. */
export function resourceUnits(id: string): string[] {
  return UNIT_TYPES.filter((t) => t.needs?.includes(id)).map((t) => t.name);
}

/** Names in a short list: the first `max`, then how many more. */
function shortList(names: string[], max: number): string {
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** The square's window on a strategic resource, under the title that names it: what needs it. */
export function resourceNote(id: string): string {
  return `Needed for ${shortList(resourceUnits(id), 4)}`;
}

/** The resources `player` lacks that lie on its land with no road on their squares (a square serves only with one, since save version 43, or a river, since 48). */
export function resourcesWantingRoads(state: GameState, player: number): string[] {
  if (state.noResources) return [];
  return resourceHoldings(state, player).filter((h) => !h.has && h.unroaded > h.unrigged).map((h) => h.id);
}

/** The resources `player` lacks that lie in its waters with no oil rig on their squares (since save version 55), and none on its land wanting a road. */
export function resourcesWantingRigs(state: GameState, player: number): string[] {
  if (state.noResources) return [];
  return resourceHoldings(state, player).filter((h) => !h.has && h.unrigged > 0 && h.unroaded === h.unrigged).map((h) => h.id);
}

/** What a resource's squares that do not serve us want: a road on land, an oil rig at sea, or either. */
function wanted(h: Pick<ResourceHolding, "unroaded" | "unrigged">): string {
  return h.unrigged === 0 ? "a road" : h.unrigged === h.unroaded ? "an oil rig" : "a road or an oil rig";
}

/** Whether a game has deposits at sea (`ResourceRule.offshore`; since save version 55). */
function offshoreIn(state: GameState): boolean {
  return resourcesIn(state).some((r) => r.offshore !== undefined && inCatalogue(state, r.offshore));
}

/**
 * What the build menu says of resources a road would bring into use, one line of its window (asked for 2026-10-31: "keep
 * in one text line - do not break", then "too short now"; the menu's `oneLine`): "Our Iron lies unused: build a road on
 * its square", "Our Iron and Horses lie unused: build roads on them", past two "Our Iron, Horses and 2 more lie unused:
 * build roads on them".
 */
export function roadNote(ids: string[]): string | null {
  if (!ids.length) return null;
  if (ids.length === 1) return `{road} Our ${ids[0]} lies unused: build a road on its square`;
  const names = ids.length === 2 ? `${ids[0]} and ${ids[1]}` : `${ids[0]}, ${ids[1]} and ${ids.length - 2} more`;
  return `{road} Our ${names} lie unused: build roads on them`;
}

/** What the build menu says of resources at sea an oil rig would bring into use (since save version 55): "Our Oil lies unused at sea: a Fishing Boat builds a rig". */
export function rigNote(ids: string[]): string | null {
  if (!ids.length) return null;
  return `{rig} Our ${ids.join(" and ")} ${ids.length === 1 ? "lies" : "lie"} unused at sea: a Fishing Boat builds a rig`;
}

/**
 * Strategic Resources (Advisors): each resource, where we hold it (the cities whose land has it, with a road on
 * its square) or who trades it us, the squares still wanting their road, or that we lack it, or the advance that
 * will show it (`revealedBy`), with the units that need it; then our trades. Saves before version 33 have none.
 */
export function resourcesReport(state: GameState): ReportPage {
  const me = state.currentPlayer;
  const title = "Strategic Resources";
  if (state.noResources) return { title, lines: [{ text: "In this game no unit needs a resource.", dim: true }] };
  const squares = resourceSquares(state, me, true);
  const holdings = resourceHoldings(state, me);
  const trades = tradesOf(state, me);
  const name = (p: number) => state.players[p]?.name ?? "?";
  const lines: ReportLine[] = [];
  const near = (roaded: boolean, id: string): string[] => [...new Set((squares.get(id) ?? []).flatMap((sq) => {
    const c = resourceRoaded(state, getTile(state.map, sq.x, sq.y)!) === roaded ? claimant(state, sq.x, sq.y) : null;
    return c ? [c.name] : [];
  }))];
  for (const r of resourcesIn(state)) {
    const h = holdings.find((x) => x.id === r.id)!;
    const from = trades.filter((t) => tradeSides(t, me).gets === r.id).map((t) => `the ${name(t.a === me ? t.b : t.a)}`);
    const roadless = h.unroaded ? `, ${h.unroaded} no road` : "";
    const where = h.own - h.exported > 0 ? `${h.own} near ${shortList(near(true, r.id), 2)}${roadless}` : from.length ? `from ${from.join(", ")}${roadless}`
      : h.unroaded ? `no road near ${shortList(near(false, r.id), 2)}`
      : h.own ? "all traded away" : !resourceKnown(state, me, r.id) && r.revealedBy ? `unseen until ${advance(r.revealedBy).name}` : "none";
    lines.push({ text: r.id, right: where, dim: !h.has });
    lines.push({ text: `  ${shortList(resourceUnits(r.id), 3)}`, dim: true });
  }
  for (const t of trades) {
    const other = t.a === me ? t.b : t.a;
    const { gives, gets } = tradeSides(t, me);
    const deal = gives && gets ? `our ${gives} for their ${gets}` : gives ? `our ${gives}, a gift` : `their ${gets}`;
    lines.push({ text: `Trade: ${deal}`, right: `the ${name(other)}`, slot: state.players[other]!.color });
  }
  const roads = state.roadlessResources ? "" : state.riverNeedsRoad ? "A square serves with a road on it.  " : "A square serves with a road or river on it.  ";
  return { title, lines, hint: `${roads}Trade in an audience, with Currency` };
}

/** How the player stands with a strategic resource, as the Resources window's badge says it. */
export type ResourceStatus = "held" | "imported" | "road" | "away" | "none" | "unseen";

/** One resource in the Resources window (`resourcesView`). */
export interface ResourceEntry {
  id: string;
  status: ResourceStatus;
  /** The badge's word: "Held", "Traded in", "Wants road", "Traded away", "None", "Unseen". */
  badge: string;
  /** Where it lies, whom it comes from, or what is missing: "2 squares near Memphis, Giza; 1 to the Babylonians". */
  detail: string;
  /** The unit types that need it, in the rules' order (`UnitTypeRule.needs`). */
  units: string[];
  /** Units of those we could build now but for it (we know their advance). */
  buildable: string[];
}

/** A trade in the Resources window: the other civilization, what goes each way, and gold a turn either way. */
export interface ResourceTradeEntry {
  player: number;
  slot: number;
  text: string;
  /** Gold a turn it brings us (above nought) or costs us (below); 0 for none. */
  gold: number;
}

export interface ResourcesView {
  entries: ResourceEntry[];
  trades: ResourceTradeEntry[];
  /** Gold a turn our trades bring in, all told (or cost, below nought). */
  income: number;
  /** A word under it all: how a square serves, and where to trade. */
  hint: string;
  /** In a game without strategic resources, all the window says. */
  none?: string;
}

export const RESOURCE_BADGES: Record<ResourceStatus, string> = {
  held: "Held", imported: "Traded in", road: "Wants road", away: "Traded away", none: "None", unseen: "Unseen",
};

/** The badge of a resource whose only squares at hand lie at sea without their oil rig (since save version 55). */
export const RIG_BADGE = "Wants rig";

/**
 * The Resources window (Advisors > Resources; redone 2026-10-31, asked for: "improve the resources main window"): for each
 * strategic resource whether we hold it and where, whom it comes from, which squares still want a road, or that we lack
 * it or have yet to see it (`revealedBy`), with the units that need it; then our trades, with the gold a turn each brings
 * or costs (`ResourceTrade.pay`, since save version 51).
 */
export function resourcesView(state: GameState, me = state.currentPlayer): ResourcesView {
  const roads = state.roadlessResources ? "" : (state.riverNeedsRoad ? "A square serves with a road on it." : "A square serves with a road or river on it.") + (offshoreIn(state) ? " At sea, an oil rig." : "");
  if (state.noResources) return { entries: [], trades: [], income: 0, hint: "", none: "In this game no unit needs a resource." };
  const squares = resourceSquares(state, me, true);
  const holdings = resourceHoldings(state, me);
  const trades = tradesOf(state, me);
  const known = state.players[me]!.advances;
  const people = (p: number) => `the ${state.players[p]?.name ?? "?"}`;
  const near = (roaded: boolean, id: string): string[] => [...new Set((squares.get(id) ?? []).flatMap((sq) => {
    const c = resourceRoaded(state, getTile(state.map, sq.x, sq.y)!) === roaded ? claimant(state, sq.x, sq.y) : null;
    return c ? [c.name] : [];
  }))];
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  const entries = resourcesIn(state).map((r): ResourceEntry => {
    const h = holdings.find((x) => x.id === r.id)!;
    const needs = UNIT_TYPES.filter((t) => t.needs?.includes(r.id));
    const units = needs.map((t) => t.id);
    const buildable = needs.filter((t) => !t.requires || known.includes(t.requires)).map((t) => t.id);
    const to = trades.filter((t) => tradeSides(t, me).gives === r.id).map((t) => people(t.a === me ? t.b : t.a));
    const from = trades.filter((t) => tradeSides(t, me).gets === r.id).map((t) => people(t.a === me ? t.b : t.a));
    // `own` counts the squares serving us (a road or river on them), `unroaded` the rest.
    const kept = h.own - h.exported;
    const roadless = h.unroaded ? `${plural(h.unroaded, "square")} near ${shortList(near(false, r.id), 2)} ${h.unroaded === 1 ? "wants" : "want"} ${wanted(h)}` : "";
    const away = to.length ? `to ${shortList(to, 2)}` : "";
    let status: ResourceStatus;
    let detail: string;
    // Unseen until its advance, unless it comes to us by trade already.
    if (!h.has && !resourceKnown(state, me, r.id) && r.revealedBy) {
      status = "unseen";
      detail = `Shows on the map with ${advance(r.revealedBy).name}`;
    } else if (h.has && kept > 0) {
      status = "held";
      detail = [`${plural(kept, "square")} near ${shortList(near(true, r.id), 2)}`, roadless && `${h.unroaded} more ${h.unroaded === 1 ? "wants" : "want"} ${wanted(h)}`, away && `${h.exported} ${away}`].filter(Boolean).join("; ");
    } else if (h.has) {
      status = "imported";
      detail = [`From ${shortList(from, 2)}`, roadless].filter(Boolean).join("; ");
    } else if (h.unroaded) {
      status = "road";
      detail = h.unrigged === h.unroaded ? `${roadless}: a Fishing Boat builds one` : `${roadless}: build one to use it`;
    } else if (h.own) {
      status = "away";
      detail = `All traded ${away}`;
    } else {
      status = "none";
      detail = "None on our land: trade for it, or settle where it lies";
    }
    const badge = status === "road" && h.unrigged === h.unroaded ? RIG_BADGE : RESOURCE_BADGES[status];
    return { id: r.id, status, badge, detail, units, buildable };
  });
  let income = 0;
  const tradeEntries = trades.map((t): ResourceTradeEntry => {
    const other = t.a === me ? t.b : t.a;
    const { gives, gets } = tradeSides(t, me);
    const them = people(other);
    const text = gives && gets ? `Our ${gives} for ${them}' ${gets}` : gives ? `Our ${gives} to ${them}` : `${gets} from ${them}`;
    // Gold a turn: paid by the receiver (`b`) to the giver (`a`).
    const gold = t.pay ? (t.a === me ? t.pay : -t.pay) : 0;
    income += gold;
    return { player: other, slot: state.players[other]!.color, text: gold || gives && gets ? text : gives ? `${text}, a gift` : text, gold };
  });
  return { entries, trades: tradeEntries, income, hint: [roads, "Trade in an audience, with Currency."].filter(Boolean).join("  ") };
}

/**
 * The strategic resources `viewer` sees on the map: each square it has explored holding one it has revealed
 * (`resourceKnown`), as a map index to the resource's id. The web app tells of squares new to it (`resourceFinds`).
 */
export function knownResourceSquares(state: GameState, viewer: number): Map<number, string> {
  const out = new Map<number, string>();
  const p = state.players[viewer];
  if (!p || state.noResources) return out;
  const { width, tiles } = state.map;
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i]!.special || !p.explored[i]) continue;
    const id = resourceAt(state, i % width, Math.floor(i / width), viewer);
    if (id) out.set(i, id);
  }
  return out;
}

/** A strategic resource an advance has just shown `viewer` (`ResourceRule.revealedBy`; asked for 2026-10-28). */
export interface ResourceReveal {
  id: string;
  /** Its squares the viewer has explored, ringed for a moment (`MainScreenView.revealed`). */
  squares: { x: number; y: number }[];
  /** The square the map goes to: ours nearest the capital, else the nearest one near our cities; null when none is. */
  focus: { x: number; y: number } | null;
  /** "Iron revealed: 2 on our land, 3 nearby", or "Iron revealed: none on our land yet". */
  text: string;
}

/** How far from our cities (squares, either way) a square of a revealed resource counts as nearby. */
const NEARBY = 6;

/** What advances `found` revealed to `viewer` (core `revealedBy`), one entry a resource; none in saves before version 40. */
export function resourceReveals(state: GameState, viewer: number, found: readonly string[]): ResourceReveal[] {
  const known = knownResourceSquares(state, viewer);
  const cities = state.cities.filter((c) => c.owner === viewer);
  const capital = cities.find((c) => c.buildings.includes("palace")) ?? cities[0];
  const { map } = state;
  const fromCapital = (q: { x: number; y: number }) => (capital ? mapDistance(map, capital.x, capital.y, q.x, q.y) : 0);
  const out: ResourceReveal[] = [];
  const owned = resourceSquares(state, viewer, true);
  for (const id of revealedBy(state, viewer, found)) {
    const squares = [...known].filter(([, k]) => k === id).map(([i]) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
    const ours = owned.get(id) ?? [];
    const isOurs = (q: { x: number; y: number }) => ours.some((o) => o.x === q.x && o.y === q.y);
    const near = squares.filter((q) => !isOurs(q) && cities.some((c) => mapDistance(map, c.x, c.y, q.x, q.y) <= NEARBY));
    const focus = [...ours].sort((a, b) => fromCapital(a) - fromCapital(b))[0] ?? [...near].sort((a, b) => fromCapital(a) - fromCapital(b))[0] ?? null;
    const unserved = ours.filter((q) => !resourceRoaded(state, getTile(map, q.x, q.y)!));
    const roadless = unserved.length;
    const want = wanted({ unroaded: roadless, unrigged: unserved.filter((q) => getTile(map, q.x, q.y)!.terrain === Terrain.Ocean).length });
    const land = ours.length ? `${ours.length} on our land${roadless ? ` (${roadless} wanting ${want})` : ""}` : "none on our land yet";
    out.push({ id, squares, focus, text: `${id} revealed: ${land}${near.length ? `, ${near.length} nearby` : ""}` });
  }
  return out;
}
