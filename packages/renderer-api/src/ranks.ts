import { nextRank, rankOf, unitType, type RankId, type Unit } from "@civ/core";
import type { IconName } from "./icons.js";

/**
 * A unit's rank as the screens tell it (asked for 2026-10-25: ranks "that would indicate about the
 * unit experience in combat"): gold chevrons, one more a rank, in the unit box, the square's window
 * and on the owner's shield on the map; the rank's name before the unit's. A recruit wears none.
 */
export const RANK_ICON: Record<RankId, IconName | null> = { recruit: null, regular: "regular", veteran: "veteran", hardened: "hardened", elite: "elite" };

/** The insignia of a unit with this experience, or null for a recruit. */
export function rankIcon(xp: number): IconName | null {
  return RANK_ICON[rankOf(xp).id];
}

/** Is the unit's rank worth telling? A unit that fights, or one that has won a fight whatever it is. */
export function showsRank(u: Pick<Unit, "type" | "xp">): boolean {
  return unitType(u.type).attack > 0 || u.xp > 0;
}

/** The unit's name with its rank before it, but for a recruit: "Veteran Legion". */
export function rankedName(u: Pick<Unit, "type" | "xp">): string {
  const r = rankOf(u.xp);
  const name = unitType(u.type).name;
  return r.id === "recruit" ? name : `${r.name} ${name}`;
}

/** What the rank adds to the unit's attack and defence: "+50%"; nothing for a recruit. */
export function rankBonus(xp: number): string {
  const pct = Math.round((rankOf(xp).power - 1) * 100);
  return pct > 0 ? `+${pct}%` : "";
}

/** The unit box's line: insignia, rank and what it adds, "{veteran}Veteran +50%"; a recruit's is "Recruit". */
export function rankLine(xp: number): string {
  const icon = rankIcon(xp);
  const bonus = rankBonus(xp);
  return `${icon ? `{${icon}}` : ""}${rankOf(xp).name}${bonus ? ` ${bonus}` : ""}`;
}

/** How far the unit has come toward its next rank: "4/6 experience to Hardened", or "The highest rank". */
export function rankProgress(xp: number): string {
  const next = nextRank(xp);
  return next ? `${xp}/${next.xp} experience to ${next.name}` : "The highest rank";
}
