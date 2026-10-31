import { unitArtPlace } from "./art.js";
import type { ShotPace } from "./motion.js";
import { animSheet, UNIT_ANIMS } from "./unit-anim.js";

/**
 * How unit `type`'s shot flies (`MotionTiming.shot`), when it looses one (a catapult's stone, `UnitShot`): when it leaves
 * the frame that draws it (that frame's end, the attack played at its own pace), how high it arcs, and where that frame
 * draws it, in squares from the top left of its square as the picture stands there facing right.
 */
export function shotOf(type: string): ShotPace | null {
  const attack = UNIT_ANIMS[type]?.attack;
  if (!attack?.shot) return null;
  const frame = attack.frames[attack.impact]!;
  const sheet = animSheet(type, frame);
  const box = unitArtPlace({ id: type, unit: true, x: 0, y: 0, w: 1, h: 1, frame });
  if (!sheet || !box) return null;
  const k = box.w / sheet.atlas.size[0];
  const [ax, ay] = sheet.atlas.anchor;
  return {
    releaseMs: attack.ms.slice(0, attack.impact + 1).reduce((a, b) => a + b, 0),
    arc: attack.shot.arc,
    from: { x: box.x + (ax + attack.shot.from[0]) * k, y: box.y + (ay + attack.shot.from[1]) * k },
  };
}
