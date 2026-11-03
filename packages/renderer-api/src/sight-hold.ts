/**
 * Sight the map keeps showing after it is lost, until the fighting is over (asked for 2026-11-03: "when city is
 * conquered or unit is lost - visibilty around should stay until the battle is COMPLETLY over and all fight animations
 * and all enemy and player units done fighting"): the web app holds what was seen before a fight that cost sight, or
 * as its turn ended (`hold`), shows it with what is seen now (`shown`), and lets it go once every slide, fight and the
 * news after them are done (`release`). A UI side channel: the rules' `Player.visible` is untouched.
 */
export class SightHold {
  private held: Uint8Array | null = null;
  private cache: { frame: number; sight: Uint8Array } | null = null;

  /** Whether some sight is held. */
  get holding(): boolean {
    return this.held !== null;
  }

  /** Keep what was seen in `saw` seen, with what is held already. */
  hold(saw: Uint8Array): void {
    if (!this.held || this.held.length !== saw.length) this.held = saw.slice();
    else for (let i = 0; i < saw.length; i++) if (saw[i]) this.held[i] = 1;
    this.cache = null;
  }

  release(): void {
    this.held = null;
    this.cache = null;
  }

  /** What is seen on the map: `now`, and what is held; worked out once a `frame`. */
  shown(now: Uint8Array, frame: number): Uint8Array {
    if (!this.held) return now;
    if (this.cache?.frame === frame) return this.cache.sight;
    const sight = now.slice();
    for (let i = 0; i < sight.length; i++) if (this.held[i]) sight[i] = 1;
    this.cache = { frame, sight };
    return sight;
  }
}

/** Whether any square seen in `saw` is not seen in `now`. */
export function sightLost(saw: Uint8Array, now: Uint8Array): boolean {
  for (let i = 0; i < saw.length; i++) if (saw[i] && !now[i]) return true;
  return false;
}
