import { advance, claimant, mapDistance, resourceAt, resourceKnown, RESOURCES, resourceHoldings, resourceSquares, revealedBy, tradesOf, tradeSides, UNIT_TYPES, type GameState } from "@civ/core";
import type { ReportLine, ReportPage } from "./index.js";

/** The units that need a strategic resource, by name, in the rules' order. */
export function resourceUnits(id: string): string[] {
  return UNIT_TYPES.filter((t) => t.needs?.includes(id)).map((t) => t.name);
}

/** Names in a short list: the first `max`, then how many more. */
function shortList(names: string[], max: number): string {
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** The square's window on a strategic resource: what needs it. */
export function resourceNote(id: string): string {
  return `{star} ${id} is needed for ${shortList(resourceUnits(id), 4)}`;
}

/**
 * Strategic Resources (Advisors): each resource, where we hold it (the cities whose land has it) or who
 * trades it us, or that we lack it, or the advance that will show it (`revealedBy`), with the units that
 * need it; then our trades. Saves before version 33 have none.
 */
export function resourcesReport(state: GameState): ReportPage {
  const me = state.currentPlayer;
  const title = "Strategic Resources";
  if (state.noResources) return { title, lines: [{ text: "In this game no unit needs a resource.", dim: true }] };
  const squares = resourceSquares(state, me);
  const holdings = resourceHoldings(state, me);
  const trades = tradesOf(state, me);
  const name = (p: number) => state.players[p]?.name ?? "?";
  const lines: ReportLine[] = [];
  for (const r of RESOURCES) {
    const h = holdings.find((x) => x.id === r.id)!;
    const from = trades.filter((t) => tradeSides(t, me).gets === r.id).map((t) => `the ${name(t.a === me ? t.b : t.a)}`);
    const cities = [...new Set((squares.get(r.id) ?? []).flatMap((sq) => { const c = claimant(state, sq.x, sq.y); return c ? [c.name] : []; }))];
    const where = h.own - h.exported > 0 ? `${h.own} near ${shortList(cities, 2)}` : from.length ? `from ${from.join(", ")}`
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
  return { title, lines, hint: "Trade in an audience, with Currency" };
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
  const owned = resourceSquares(state, viewer);
  for (const id of revealedBy(state, viewer, found)) {
    const squares = [...known].filter(([, k]) => k === id).map(([i]) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
    const ours = owned.get(id) ?? [];
    const isOurs = (q: { x: number; y: number }) => ours.some((o) => o.x === q.x && o.y === q.y);
    const near = squares.filter((q) => !isOurs(q) && cities.some((c) => mapDistance(map, c.x, c.y, q.x, q.y) <= NEARBY));
    const focus = [...ours].sort((a, b) => fromCapital(a) - fromCapital(b))[0] ?? [...near].sort((a, b) => fromCapital(a) - fromCapital(b))[0] ?? null;
    const land = ours.length ? `${ours.length} on our land` : "none on our land yet";
    out.push({ id, squares, focus, text: `${id} revealed: ${land}${near.length ? `, ${near.length} nearby` : ""}` });
  }
  return out;
}
