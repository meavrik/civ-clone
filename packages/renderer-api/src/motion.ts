import type { UnitStep } from "@civ/core";

/** A unit drawn between squares this frame instead of on its own square. */
export interface UnitMotion {
  unit: number;
  type: string;
  owner: number;
  /** Fractional map position; x may run past the seam (-0.5 or width - 0.5) and is wrapped when drawn. */
  x: number;
  y: number;
  /** Carried by this moving ship: not drawn on its own, the ship shows a stack. */
  aboard?: number;
}

export interface MotionTiming {
  /** Time one square takes. */
  stepMs: number;
  /** A long chain of steps (a railroad goto, a busy enemy turn) is sped up to fit in this. */
  maxMs: number;
  /** Map width, to slide the short way across the seam. */
  width: number;
}

interface Slide {
  step: UnitStep;
  dx: number;
  dy: number;
}

interface Beat {
  slides: Slide[];
  start: number;
  end: number;
}

const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * Plays unit steps as slides from square to square, one after another, the
 * way the original walked units across the map. A ship's cargo travels in
 * the same beat as the ship. Pure timing: the game state has already moved.
 */
export class MotionPlayer {
  private beats: Beat[] = [];

  /** Queue steps after whatever is still playing. */
  play(steps: readonly UnitStep[], now: number, timing: MotionTiming): void {
    const groups: Slide[][] = [];
    for (const step of steps) {
      let dx = step.toX - step.fromX;
      if (dx > timing.width / 2) dx -= timing.width;
      if (dx < -timing.width / 2) dx += timing.width;
      const slide = { step, dx, dy: step.toY - step.fromY };
      const last = groups.at(-1);
      if (step.aboard !== undefined && last && last[0]!.step.unit === step.aboard) last.push(slide);
      else groups.push([slide]);
    }
    if (!groups.length) return;
    const ms = Math.min(timing.stepMs, timing.maxMs / groups.length);
    let t = Math.max(now, this.beats.at(-1)?.end ?? now);
    for (const slides of groups) {
      this.beats.push({ slides, start: t, end: t + ms });
      t += ms;
    }
  }

  /** Where each unit with a slide still to come or under way is drawn at `now`. */
  at(now: number): UnitMotion[] {
    while (this.beats.length && this.beats[0]!.end <= now) this.beats.shift();
    const seen = new Map<number, UnitMotion>();
    for (const beat of this.beats) {
      const f = now <= beat.start ? 0 : ease(Math.min(1, (now - beat.start) / (beat.end - beat.start)));
      for (const { step, dx, dy } of beat.slides) {
        if (seen.has(step.unit)) continue;
        const m: UnitMotion = { unit: step.unit, type: step.type, owner: step.owner, x: step.fromX + dx * f, y: step.fromY + dy * f };
        if (step.aboard !== undefined) m.aboard = step.aboard;
        seen.set(step.unit, m);
      }
    }
    return [...seen.values()];
  }

  /** True while any slide has yet to finish. */
  busy(now: number): boolean {
    return (this.beats.at(-1)?.end ?? 0) > now;
  }

  /** Drop every slide; units snap to their squares. */
  clear(): void {
    this.beats = [];
  }
}
