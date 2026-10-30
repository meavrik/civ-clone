import type { GameState } from "@civ/core";
import type { BattleFrame, UnitMotion } from "./motion.js";

/**
 * Which way each unit faces on the map (asked for 2026-10-28: "flip units to face the direction they are moving
 * or attacking towards"), a UI side channel like `MotionPlayer` (never read by the rules, the AI or a replay):
 * the pictures are drawn facing right, and a unit turns left or right as it steps or is nudged across (its
 * `UnitMotion.heading`, once its step is under way) or attacks (`BattleFrame.heading`; its defender turns to face
 * it), then keeps that way; a step straight up or down keeps it. A unit that changed squares with no motion shown
 * (a move made out of sight) turns the way it went, the short way round the seam.
 */
export class UnitFacing {
  private left = new Set<number>();
  private lastX = new Map<number, number>();

  /** Update from the state and what the map shows this frame; the ids of the units facing left. */
  update(state: GameState, shown: { moving?: readonly UnitMotion[] | undefined; battle?: BattleFrame | undefined }): Record<number, true> {
    const width = state.map.width;
    const turn = (id: number, way: number) => {
      if (way < 0) this.left.add(id);
      else if (way > 0) this.left.delete(id);
    };
    const moving = new Set((shown.moving ?? []).map((m) => m.unit));
    const battle = shown.battle;
    if (battle) moving.add(battle.attacker.unit).add(battle.defender.unit);
    const alive = new Set<number>();
    for (const u of state.units) {
      alive.add(u.id);
      const was = this.lastX.get(u.id);
      if (was !== undefined && was !== u.x && !moving.has(u.id)) {
        let dx = u.x - was;
        if (dx > width / 2) dx -= width;
        else if (dx < -width / 2) dx += width;
        turn(u.id, dx);
      }
      this.lastX.set(u.id, u.x);
    }
    for (const m of shown.moving ?? []) if (m.heading) turn(m.unit, m.heading);
    if (battle) {
      turn(battle.attacker.unit, battle.heading);
      turn(battle.defender.unit, -battle.heading);
    }
    for (const id of this.lastX.keys()) if (!alive.has(id) && !moving.has(id)) { this.lastX.delete(id); this.left.delete(id); }
    return Object.fromEntries([...this.left].map((id) => [id, true]));
  }
}
