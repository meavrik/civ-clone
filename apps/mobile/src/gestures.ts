/**
 * One finger on the game screen: a tap is the web game's click, a press held still is its
 * right-click, and a finger that moves drags (the map, or the tech tree). Positions in CSS px,
 * times in ms. A second finger is ignored.
 */
export type Gesture =
  | { kind: "tap"; x: number; y: number }
  | { kind: "long"; x: number; y: number }
  | { kind: "dragStart"; x: number; y: number }
  | { kind: "drag"; dx: number; dy: number }
  | { kind: "dragEnd" };

export interface GestureOptions {
  /** How far a finger may wander and still tap or hold. */
  slop: number;
  /** How long a still finger takes to become a right-click. */
  longMs: number;
}

export const GESTURES: GestureOptions = { slop: 10, longMs: 450 };

export class Recognizer {
  private finger: { id: number; x0: number; y0: number; x: number; y: number; t0: number; phase: "down" | "drag" | "held" } | null = null;

  constructor(private readonly opts: GestureOptions = GESTURES) {}

  get busy(): boolean {
    return this.finger !== null;
  }

  down(id: number, x: number, y: number, t: number): void {
    if (this.finger) return;
    this.finger = { id, x0: x, y0: y, x, y, t0: t, phase: "down" };
  }

  move(id: number, x: number, y: number): Gesture[] {
    const f = this.finger;
    if (!f || f.id !== id || f.phase === "held") return [];
    const out: Gesture[] = [];
    if (f.phase === "down") {
      if (Math.hypot(x - f.x0, y - f.y0) <= this.opts.slop) return [];
      f.phase = "drag";
      out.push({ kind: "dragStart", x: f.x0, y: f.y0 });
      f.x = f.x0;
      f.y = f.y0;
    }
    out.push({ kind: "drag", dx: x - f.x, dy: y - f.y });
    f.x = x;
    f.y = y;
    return out;
  }

  /** While the finger rests: the right-click, once it has been held long enough. */
  tick(t: number): Gesture | null {
    const f = this.finger;
    if (!f || f.phase !== "down" || t - f.t0 < this.opts.longMs) return null;
    f.phase = "held";
    return { kind: "long", x: f.x0, y: f.y0 };
  }

  up(id: number, t: number): Gesture | null {
    const f = this.finger;
    if (!f || f.id !== id) return null;
    this.finger = null;
    if (f.phase === "drag") return { kind: "dragEnd" };
    if (f.phase === "held") return null;
    return t - f.t0 >= this.opts.longMs ? { kind: "long", x: f.x0, y: f.y0 } : { kind: "tap", x: f.x0, y: f.y0 };
  }

  cancel(id: number): Gesture | null {
    const f = this.finger;
    if (!f || f.id !== id) return null;
    this.finger = null;
    return f.phase === "drag" ? { kind: "dragEnd" } : null;
  }
}
