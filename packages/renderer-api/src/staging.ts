import { landSight, type City, type GameState, type UnitAction, type UnitStep } from "@civ/core";

/**
 * The cities as the map shows them while the other civilizations' turns play back (asked for
 * 2026-10-29: "first need to finish all unit actions - and only than show the new city borders or
 * switch city civs if conquered"). The state has already moved on; the map draws the cities as they
 * stood when our turn ended, and so their borders, until the playback is over. A city taken, razed or
 * founded by a step the playback shows changes as that step lands: the conqueror has marched in.
 */

/**
 * The step that changes each city, by id, among the steps the playback shows: the conqueror's last
 * step onto a city that changed hands, a raider's onto one razed, its owner's onto one founded. A
 * city changed with no such step (out of sight, by a diplomat, grown) has none and waits for the end.
 */
export function cityChanges(before: readonly City[], after: readonly City[], played: readonly UnitAction[]): Map<number, UnitStep> {
  const lastStep = (x: number, y: number, by: (owner: number) => boolean): UnitStep | undefined => {
    for (let i = played.length - 1; i >= 0; i--) {
      const a = played[i]!;
      if (a.kind === "step" && a.toX === x && a.toY === y && by(a.owner)) return a;
    }
    return undefined;
  };
  const was = new Map(before.map((c) => [c.id, c]));
  const now = new Set(after.map((c) => c.id));
  const out = new Map<number, UnitStep>();
  for (const c of after) {
    if (was.get(c.id)?.owner === c.owner) continue;
    const s = lastStep(c.x, c.y, (o) => o === c.owner);
    if (s) out.set(c.id, s);
  }
  for (const c of before) {
    if (now.has(c.id)) continue;
    const s = lastStep(c.x, c.y, (o) => o !== c.owner);
    if (s) out.set(c.id, s);
  }
  return out;
}

/**
 * The cities to draw: each as it stood (`before`) until its step in `changes` has played (`playing`
 * says whether a step is still to play or under way), then as it is now; one founded since appears
 * then, one razed goes then.
 */
export function stagedCities(before: readonly City[], after: readonly City[], changes: ReadonlyMap<number, UnitStep>, playing: (a: UnitAction) => boolean): City[] {
  const changed = (id: number): boolean => {
    const s = changes.get(id);
    return s !== undefined && !playing(s);
  };
  const now = new Map(after.map((c) => [c.id, c]));
  const out: City[] = [];
  for (const c of before) {
    if (!changed(c.id)) out.push(c);
    else {
      const a = now.get(c.id);
      if (a) out.push(a);
    }
  }
  const was = new Set(before.map((c) => c.id));
  for (const c of after) if (!was.has(c.id) && changed(c.id)) out.push(c);
  return out;
}

/**
 * What the viewer sees while the map shows `staged`'s cities: what they see now, and what they saw
 * before (`sawBefore`) of the land those cities hold and a square beyond (core's `landSight`), so a
 * city of theirs still standing as theirs is not shaded out of sight before it falls.
 */
export function stagedSight(staged: GameState, viewer: number, visible: Uint8Array, sawBefore: Uint8Array): Uint8Array {
  const out = visible.slice();
  if (staged.farContact || staged.narrowSight) return out;
  for (const i of landSight(staged, viewer)) if (sawBefore[i] === 1) out[i] = 1;
  return out;
}
