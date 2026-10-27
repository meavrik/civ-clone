import { claimant, RESOURCES, resourceHoldings, resourceSquares, tradesOf, tradeSides, UNIT_TYPES, type GameState } from "@civ/core";
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
 * trades it us, or that we lack it, with the units that need it; then our trades. Saves before version 33
 * have none.
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
    const where = h.own - h.exported > 0 ? `${h.own} near ${shortList(cities, 2)}` : from.length ? `from ${from.join(", ")}` : h.own ? "all traded away" : "none";
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
