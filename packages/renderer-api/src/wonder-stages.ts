import { costFor, wonderBuilt, type City, type GameState } from "@civ/core";
import { BUILDING_CUTS } from "./building-art.js";

/**
 * The stages of a wonder's construction (2026-11-04, asked for with the user's sheet: "each wonder contain 3 stages of
 * construction to show in the city view while constructed - start, in-construction and finished wonder", "all other
 * woders would be provideded later on the same logic"). A wonder has them when the cuts do (tools/sprites/buildings/cut.ts,
 * `<id>-start` and `<id>-construction` beside its finished `<id>`, the three in one box, so they lie in register), so
 * another wonder's need only its sheet. Only the picture: the rules know shields.
 */
const STAGES = ["start", "construction"] as const;

/** The pictures of wonder `id` going up, in order, as ids of `BUILDING_CUTS`: none when it has no stages. */
export function wonderStages(id: string): string[] {
  const pictures = STAGES.map((stage) => `${id}-${stage}`);
  return pictures.every((p) => p in BUILDING_CUTS) ? pictures : [];
}

/**
 * The wonder `city` is raising and the picture of how far its shields have brought it, the stages shared evenly over its
 * cost; null when it raises none we can show: a wonder without stages, one standing already (its own, kept as its
 * production while it waits for a choice, or another city's) or a production only held until it chooses (`City.choosing`).
 */
export function wonderSite(state: GameState, city: City): { id: string; art: string } | null {
  const p = city.production;
  if (p.kind !== "wonder" || city.choosing || wonderBuilt(state, p.id)) return null;
  const stages = wonderStages(p.id);
  if (!stages.length) return null;
  const done = city.shields / costFor(state, city.owner, p);
  return { id: p.id, art: stages[Math.min(stages.length - 1, Math.floor(done * stages.length))]! };
}

/** A picture in a wonder's fast forward: how much of it stands from the ground up, and how much of that is gone again. */
export interface RiseLayer {
  art: string;
  reveal: number;
  cleared: number;
}

/**
 * Wonder `id` going up in fast forward as it is completed, `reveal` 0..1 of the way: each of its pictures in turn rises
 * from the ground in the place of the one before, the last the finished wonder. Null without stages: it rises whole.
 */
export function wonderRise(id: string, reveal: number): RiseLayer[] | null {
  const stages = wonderStages(id);
  if (!stages.length) return null;
  const pictures = [...stages, id];
  const at = reveal * pictures.length;
  const i = Math.min(pictures.length - 1, Math.floor(at));
  const up = at - i;
  const under = i > 0 && up < 1 ? [{ art: pictures[i - 1]!, reveal: 1, cleared: up }] : [];
  return [...under, { art: pictures[i]!, reveal: up, cleared: 0 }];
}
