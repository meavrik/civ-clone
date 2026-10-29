import { wonder, wonderBuilt, type GameState } from "@civ/core";

/**
 * A wonder one of the viewer's cities was building that another city finished first (asked for
 * 2026-10-29: "if another civ wonder is completed before yours - show indication for it. now the
 * production just halt and move to another without a notice - also let the player select the next
 * production"). The rules keep the city on it until its box fills, then turn it to its default
 * (core's `outbuilt` event); the player is told as soon as it stands elsewhere and picks what comes next.
 */
export interface WonderLost {
  city: number;
  wonder: string;
}

/** The viewer's cities still building a wonder that stands in another city now: each wants a new choice. */
export function wondersLost(state: GameState, viewer: number): WonderLost[] {
  const out: WonderLost[] = [];
  for (const c of state.cities)
    if (c.owner === viewer && c.production.kind === "wonder" && wonderBuilt(state, c.production.id)) out.push({ city: c.id, wonder: c.production.id });
  return out;
}

/**
 * The words over the city's build menu: who finished the wonder and where, and the shields the city
 * keeps (all of them for another improvement or wonder; the menu's turns count what a choice keeps).
 */
export function wonderLostNotice(state: GameState, lost: WonderLost, viewer: number): { title: string; lines: string[] } | null {
  const city = state.cities.find((c) => c.id === lost.city);
  if (!city) return null;
  const name = wonder(lost.wonder).name;
  const holder = state.cities.find((c) => c.wonders.includes(lost.wonder));
  const where = !holder ? `{star} ${name} was completed elsewhere.`
    : holder.owner === viewer ? `{star} ${name} was completed in ${holder.name}.`
    : `{star} ${name} was completed in ${holder.name} by the ${state.players[holder.owner]?.name ?? "others"}.`;
  const kept = city.shields > 0 ? `{shield} ${city.name} keeps its ${city.shields} shields: build what next?` : `{shield} ${city.name} must build something else.`;
  return { title: "Wonder Built Elsewhere", lines: [where, kept] };
}
