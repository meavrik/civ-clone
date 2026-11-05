import type { UnitAction, UnitBattle, UnitStep } from "@civ/core";
import type { Callout } from "./refusal.js";

/** A unit drawn somewhere other than its square this frame: sliding, or waiting for its turn to move or fight. */
export interface UnitMotion {
  unit: number;
  type: string;
  owner: number;
  /** Fractional map position; x may run past the seam (-0.5 or width - 0.5) and is wrapped when drawn. */
  x: number;
  y: number;
  /** Carried by this moving ship: not drawn on its own, the ship shows a stack. */
  aboard?: number;
  /** Shown with a stack behind it (companions that will fall with it). */
  stacked?: boolean;
  /** Hit points to show, when they differ from the unit's current ones (before a fight still to come). */
  hp?: number;
  maxHp?: number;
  /** Which way across it is going, once under way (a slide or a nudge): the way it faces. */
  heading?: -1 | 1;
}

/** One side of the fight being shown. */
export interface BattleFighter {
  unit: number;
  type: string;
  owner: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Its experience as the fight began: the rank it wears through it. */
  xp: number;
  stacked: boolean;
  /** 1 the instant a blow lands on it, fading to 0. */
  hit: number;
  /** 0 while it stands; 0..1 as it is destroyed (a burst, then nothing). */
  dying: number;
}

export interface BattleFrame {
  attacker: BattleFighter;
  defender: BattleFighter;
  /** When the fight began: tells one fight from the next. */
  start: number;
  /** How long after `start` the first blow lands: `LUNGE_MS`, or the attacker's wind-up (`MotionTiming.strikeMs`). */
  strikeMs?: number;
  /**
   * What the attacker looses (`MotionTiming.shot`: a catapult's stone), in map squares as the fighters' places are:
   * where it is in its flight, the ground under it, and once it is down, how far its dust has settled (0 in flight).
   */
  shot?: { x: number; y: number; ground: number; landed: number };
  /** Which way across the attacker strikes (0 straight up or down): it faces that way, the defender the other. */
  heading: -1 | 0 | 1;
}

/** The map held a moment between moves (`MotionPlayer.hold`): where the camera should go, and a note beside a square. */
export interface HoldFrame {
  /** Counts holds, so a new one can be told from the one before. */
  seq: number;
  centre?: { x: number; y: number };
  note?: Callout;
}

export interface MotionFrame {
  moving: UnitMotion[];
  battle?: BattleFrame;
  hold?: HoldFrame;
}

export interface MotionTiming {
  /** Time one square takes. */
  stepMs: number;
  /** A long chain of steps (a railroad goto, a busy enemy turn) is sped up to fit in this. */
  maxMs: number;
  /** Map width, to slide the short way across the seam. */
  width: number;
  /**
   * The units set off together: each one's first step in the first beat, its second in the second, and so on, rather than
   * one unit after another (a band of raiders, `watchTurn`). For steps only: fights keep their order.
   */
  together?: boolean;
  /** Longest a single fight takes; many fights share `battleTotalMs` and are sped up to fit. */
  battleMs?: number;
  battleTotalMs?: number;
  /** Longest a round of a fight takes (110 ms unless given). */
  roundMaxMs?: number;
  /**
   * The least a step of a unit of this type takes: an animated unit's walk (`travelMs`), so each step shows it whole
   * (asked for 2026-10-30: "cant see the walk - not enough time for a full cycle"); a chain of such steps longer than
   * `WALK_CHAIN_MS` is sped up to fit it.
   */
  walkMs?: (type: string) => number;
  /**
   * How long an attacker of this type takes to its first strike: an animated unit's attack frames before it
   * (`strikeMs` in unit-anim), so a slow wind-up shows whole (asked for 2026-10-31: the catapult "too fast ... slow
   * prepare to fire - than throw stone"). The fight's first blow waits for it, never sooner than `LUNGE_MS`; the
   * rounds after keep their pace, so the fight is that much longer.
   */
  strikeMs?: (type: string) => number;
  /**
   * What an attacker of this type looses from where it stands (`shotOf`: a catapult's stone; asked for 2026-10-31,
   * "catapult combat and animation still very bad": it lunged onto its foe like a soldier and its stone went nowhere):
   * it closes in for no lunge, and its shot flies from its picture to its foe's feet, the first blow landing with it.
   */
  shot?: (type: string) => ShotPace | null;
}

/** How a unit's shot flies (`MotionTiming.shot`). */
export interface ShotPace {
  /** When it leaves the frame that looses it (that frame's end), from the fight's start; it lands at the first blow. */
  releaseMs: number;
  /** How high its arc rises above the straight way, in squares. */
  arc: number;
  /** Where its picture leaves it: squares from the top left of the attacker's square, the attacker facing right. */
  from: { x: number; y: number };
}

/** A chain of walked steps (a goto along a road) takes at most this long, however many steps it has. */
export const WALK_CHAIN_MS = 2400;

/** Parts of a fight: the attacker closes in, the rounds, the loser's end. */
export const LUNGE_MS = 150;
export const DEATH_MS = 450;
/** How long a shot's dust takes to settle once it is down. */
export const LANDED_MS = 380;
/** Where a shot comes down: before its foe's feet, this far toward the attacker from the square's middle, this far down it. */
const SHOT_LANDS = { toward: 0.3, down: 0.9 };
const ROUND_MS = { min: 30, max: 110 };
/** How far toward the defender the attacker closes, in squares. */
const LUNGE = 0.3;
/** A refused move: the unit leans this far toward the square, springs back, and bumps once more, smaller. */
export const NUDGE_MS = 420;
const NUDGE = 0.3;

/** Where a nudged unit stands, as a fraction of the way toward the square it was refused, at time t (0..1). */
export function nudgeReach(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.55) return NUDGE * Math.sin((Math.PI * t) / 0.55);
  return NUDGE * 0.3 * Math.sin((Math.PI * (t - 0.55)) / 0.45);
}

/** The unit a nudge moves: where it stands and what to draw. */
export interface NudgedUnit {
  id: number;
  type: string;
  owner: number;
  x: number;
  y: number;
}

interface Slide {
  step: UnitStep;
  dx: number;
  dy: number;
}

type Beat =
  | { kind: "slide"; slides: Slide[]; start: number; end: number }
  | { kind: "hold"; hold: HoldFrame; start: number; end: number }
  | { kind: "nudge"; unit: NudgedUnit; dx: number; dy: number; start: number; end: number }
  | { kind: "battle"; battle: UnitBattle; dx: number; dy: number; roundMs: number; lungeMs: number; shot: ShotPace | null; start: number; end: number };

const ease = (t: number): number => t * t * (3 - 2 * t);

function seamDx(dx: number, width: number): number {
  if (dx > width / 2) return dx - width;
  if (dx < -width / 2) return dx + width;
  return dx;
}

/** Hit points of both sides after the first `n` rounds. */
function hpAfter(b: UnitBattle, n: number): [number, number] {
  let a = b.attacker.hp;
  let d = b.defender.hp;
  for (let i = 0; i < n && i < b.rounds.length; i++) {
    if (b.rounds[i]) d = Math.max(0, d - b.attacker.firepower);
    else a = Math.max(0, a - b.defender.firepower);
  }
  return [a, d];
}

type Paced =
  | { kind: "slide"; slides: Slide[]; ms: number }
  | { kind: "battle"; battle: UnitBattle; roundMs: number; lungeMs: number; shot: ShotPace | null; ms: number };

/** Actions as the beats they play in (a ship's cargo travels in the ship's beat), each with its length. */
function paced(actions: readonly UnitAction[], timing: MotionTiming): Paced[] {
  type Group = { kind: "slide"; slides: Slide[] } | { kind: "battle"; battle: UnitBattle };
  const groups: Group[] = [];
  /** How many steps each unit has taken so far, when they go together. */
  const taken = new Map<number, number>();
  for (const act of actions) {
    if (act.kind === "battle") { groups.push({ kind: "battle", battle: act }); continue; }
    const slide = { step: act, dx: seamDx(act.toX - act.fromX, timing.width), dy: act.toY - act.fromY };
    if (timing.together) {
      const k = taken.get(act.unit) ?? 0;
      taken.set(act.unit, k + 1);
      const beat = groups[k];
      if (beat?.kind === "slide") beat.slides.push(slide);
      else groups.push({ kind: "slide", slides: [slide] });
      continue;
    }
    const last = groups.at(-1);
    if (act.aboard !== undefined && last?.kind === "slide" && last.slides[0]!.step.unit === act.aboard) last.slides.push(slide);
    else groups.push({ kind: "slide", slides: [slide] });
  }
  const slides = groups.filter((g) => g.kind === "slide").length;
  const fights = groups.length - slides;
  const stepMs = slides ? Math.min(timing.stepMs, timing.maxMs / slides) : timing.stepMs;
  const fightMs = Math.min(timing.battleMs ?? 1600, Math.max(LUNGE_MS + DEATH_MS + ROUND_MS.min, (timing.battleTotalMs ?? 6000) / Math.max(1, fights)));
  const roundMax = timing.roundMaxMs ?? ROUND_MS.max;
  return groups.map((g): Paced => {
    // A unit that walks takes a whole step of its walk to cross a square (its cargo goes with it).
    const walk = (type: string) => Math.min(timing.walkMs?.(type) ?? 0, WALK_CHAIN_MS / slides);
    if (g.kind === "slide") {
      // Units going together wait for the slowest walker of the beat.
      const walkers = g.slides.filter((s) => s.step.aboard === undefined);
      return { kind: "slide", slides: g.slides, ms: Math.max(stepMs, ...(walkers.length ? walkers : g.slides.slice(0, 1)).map((s) => walk(s.step.type))) };
    }
    const n = Math.max(1, g.battle.rounds.length);
    const roundMs = Math.max(ROUND_MS.min, Math.min(roundMax, (fightMs - LUNGE_MS - DEATH_MS) / n));
    // The first blow waits for the attacker's wind-up.
    const lungeMs = Math.max(LUNGE_MS, timing.strikeMs?.(g.battle.attacker.type) ?? 0);
    const shot = timing.shot?.(g.battle.attacker.type) ?? null;
    return { kind: "battle", battle: g.battle, roundMs, lungeMs, shot, ms: lungeMs + n * roundMs + DEATH_MS };
  });
}

/** How long `MotionPlayer.play` takes over these actions at this pace. */
export function motionMs(actions: readonly UnitAction[], timing: MotionTiming): number {
  return paced(actions, timing).reduce((sum, p) => sum + p.ms, 0);
}

/**
 * Plays unit steps and fights in order, the way the original walked units
 * across the map: a step is a slide between squares (a ship's cargo travels
 * in the ship's beat); a fight is a lunge, a blow per round with hit points
 * draining, and a burst where the loser stood. Pure timing: the game state
 * has already moved on.
 */
export class MotionPlayer {
  private beats: Beat[] = [];
  private holds = 0;

  /** Queue actions after whatever is still playing. */
  play(actions: readonly UnitAction[], now: number, timing: MotionTiming): void {
    let t = Math.max(now, this.beats.at(-1)?.end ?? now);
    for (const p of paced(actions, timing)) {
      if (p.kind === "slide") this.beats.push({ kind: "slide", slides: p.slides, start: t, end: t + p.ms });
      else {
        const b = p.battle;
        this.beats.push({ kind: "battle", battle: b, dx: seamDx(b.defender.x - b.attacker.x, timing.width), dy: b.defender.y - b.attacker.y, roundMs: p.roundMs, lungeMs: p.lungeMs, shot: p.shot, start: t, end: t + p.ms });
      }
      t += p.ms;
    }
  }

  /**
   * Hold the map a moment after whatever is still playing: the camera may glide to `centre`
   * and a note stand beside a square. Nothing moves meanwhile.
   */
  hold(ms: number, now: number, what: { centre?: { x: number; y: number }; note?: Callout } = {}): void {
    const start = Math.max(now, this.beats.at(-1)?.end ?? now);
    this.beats.push({ kind: "hold", hold: { seq: ++this.holds, ...what }, start, end: start + ms });
  }

  /**
   * A move the rules refused: the unit leans toward the square it could not enter and springs
   * back, after whatever is still playing. A second nudge of the same unit replaces a waiting one.
   */
  nudge(unit: NudgedUnit, dx: number, dy: number, now: number): void {
    this.beats = this.beats.filter((b) => !(b.kind === "nudge" && b.unit.id === unit.id && b.start > now));
    const start = Math.max(now, this.beats.at(-1)?.end ?? now);
    this.beats.push({ kind: "nudge", unit, dx, dy, start, end: start + NUDGE_MS });
  }

  /** What to draw at `now`: units away from their squares, and the fight under way, if any. */
  at(now: number): MotionFrame {
    while (this.beats.length && this.beats[0]!.end <= now) this.beats.shift();
    const seen = new Map<number, UnitMotion>();
    let battle: BattleFrame | undefined;
    let hold: HoldFrame | undefined;
    for (const beat of this.beats) {
      if (beat.kind === "hold") {
        if (now >= beat.start && !hold) hold = beat.hold;
        continue;
      }
      if (beat.kind === "nudge") {
        const { unit } = beat;
        if (seen.has(unit.id)) continue;
        const reach = now <= beat.start ? 0 : nudgeReach((now - beat.start) / (beat.end - beat.start));
        const m: UnitMotion = { unit: unit.id, type: unit.type, owner: unit.owner, x: unit.x + beat.dx * reach, y: unit.y + beat.dy * reach };
        if (now >= beat.start && beat.dx) m.heading = beat.dx < 0 ? -1 : 1;
        seen.set(unit.id, m);
        continue;
      }
      if (beat.kind === "slide") {
        const f = now <= beat.start ? 0 : ease(Math.min(1, (now - beat.start) / (beat.end - beat.start)));
        for (const { step, dx, dy } of beat.slides) {
          if (seen.has(step.unit)) continue;
          const m: UnitMotion = { unit: step.unit, type: step.type, owner: step.owner, x: step.fromX + dx * f, y: step.fromY + dy * f };
          if (step.aboard !== undefined) m.aboard = step.aboard;
          // Turned the way it goes once its step begins; one still waiting its turn keeps its facing.
          if (now >= beat.start && dx) m.heading = dx < 0 ? -1 : 1;
          seen.set(step.unit, m);
        }
        continue;
      }
      const b = beat.battle;
      const loserStacked = b.alsoLost.length > 0;
      if (now >= beat.start && !battle && !seen.has(b.attacker.unit) && !seen.has(b.defender.unit)) {
        battle = this.fight(beat, now, loserStacked);
        // Both fighters belong to the fight now; neither is drawn anywhere else.
        seen.set(b.attacker.unit, { unit: b.attacker.unit, type: b.attacker.type, owner: b.attacker.owner, x: NaN, y: NaN });
        seen.set(b.defender.unit, { unit: b.defender.unit, type: b.defender.type, owner: b.defender.owner, x: NaN, y: NaN });
        continue;
      }
      // A fight still to come: both sides stand where they will meet, as they were before it.
      for (const [s, lost] of [[b.attacker, !b.attackerWon], [b.defender, b.attackerWon]] as const) {
        if (seen.has(s.unit)) continue;
        const m: UnitMotion = { unit: s.unit, type: s.type, owner: s.owner, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp };
        if (lost && loserStacked) m.stacked = true;
        seen.set(s.unit, m);
      }
    }
    const moving = [...seen.values()].filter((m) => !Number.isNaN(m.x));
    const frame: MotionFrame = { moving };
    if (battle) frame.battle = battle;
    if (hold) frame.hold = hold;
    return frame;
  }

  private fight(beat: Extract<Beat, { kind: "battle" }>, now: number, loserStacked: boolean): BattleFrame {
    const b = beat.battle;
    const e = now - beat.start;
    const n = b.rounds.length;
    const lunge = beat.lungeMs;
    const roundsEnd = lunge + n * beat.roundMs;
    let reach = LUNGE;
    let rounds = 0;
    let attackerHit = 0;
    let defenderHit = 0;
    let dying = 0;
    // A longer wind-up stands its ground until the last `LUNGE_MS` before the blow, then closes in.
    if (e < lunge) reach = LUNGE * ease(Math.max(0, e - (lunge - LUNGE_MS)) / LUNGE_MS);
    else if (e < roundsEnd) {
      const i = Math.min(n - 1, Math.floor((e - lunge) / beat.roundMs));
      const f = (e - lunge) / beat.roundMs - i;
      rounds = i + 1; // each round's blow lands as it begins
      if (b.rounds[i]) { defenderHit = 1 - f; reach = LUNGE + 0.12 * (1 - f); }
      else { attackerHit = 1 - f; reach = LUNGE - 0.08 * (1 - f); }
    } else {
      rounds = n;
      dying = Math.min(1, (e - roundsEnd) / DEATH_MS);
      // The winning attacker steps back to its square while the loser goes up in smoke.
      if (b.attackerWon) reach = LUNGE * (1 - ease(dying));
    }
    // One that shoots stands its ground throughout.
    if (beat.shot) reach = 0;
    const [ahp, dhp] = hpAfter(b, rounds);
    const attacker: BattleFighter = {
      unit: b.attacker.unit, type: b.attacker.type, owner: b.attacker.owner,
      x: b.attacker.x + beat.dx * reach, y: b.attacker.y + beat.dy * reach,
      hp: ahp, maxHp: b.attacker.maxHp, xp: b.attacker.xp, stacked: !b.attackerWon && loserStacked,
      hit: attackerHit, dying: b.attackerWon ? 0 : dying,
    };
    const defender: BattleFighter = {
      unit: b.defender.unit, type: b.defender.type, owner: b.defender.owner,
      x: b.defender.x, y: b.defender.y,
      hp: dhp, maxHp: b.defender.maxHp, xp: b.defender.xp, stacked: b.attackerWon && loserStacked,
      hit: defenderHit, dying: b.attackerWon ? dying : 0,
    };
    const shot = beat.shot ? this.shot(beat, beat.shot, e) : undefined;
    return { attacker, defender, start: beat.start, ...(lunge !== LUNGE_MS ? { strikeMs: lunge } : {}), ...(shot ? { shot } : {}), heading: beat.dx < 0 ? -1 : beat.dx > 0 ? 1 : 0 };
  }

  /**
   * A shot `e` into its fight: from where its picture leaves it (mirrored with an attacker facing left) in an arc to
   * the ground before its foe, its shadow running along the ground under it, down with the first blow; then its dust.
   */
  private shot(beat: Extract<Beat, { kind: "battle" }>, shot: ShotPace, e: number): BattleFrame["shot"] {
    const end = beat.lungeMs;
    if (e < shot.releaseMs || e >= end + LANDED_MS) return undefined;
    const b = beat.battle;
    const left = beat.dx < 0;
    const fx = b.attacker.x + (left ? 1 - shot.from.x : shot.from.x), fy = b.attacker.y + shot.from.y;
    const toward = left ? 1 : -1;
    const tx = b.attacker.x + beat.dx + 0.5 + toward * SHOT_LANDS.toward, ty = b.attacker.y + beat.dy + SHOT_LANDS.down;
    if (e >= end) return { x: tx, y: ty, ground: ty, landed: Math.max(0.001, (e - end) / LANDED_MS) };
    const t = Math.min(1, (e - shot.releaseMs) / Math.max(1, end - shot.releaseMs));
    const ground = b.attacker.y + SHOT_LANDS.down + (ty - b.attacker.y - SHOT_LANDS.down) * t;
    return { x: fx + (tx - fx) * t, y: fy + (ty - fy) * t - shot.arc * 4 * t * (1 - t), ground, landed: 0 };
  }

  /** True while this step or fight is queued or under way. */
  playing(action: UnitAction, now: number): boolean {
    return this.beats.some((b) => b.end > now && ((b.kind === "slide" && b.slides.some((s) => s.step === action)) || (b.kind === "battle" && b.battle === action)));
  }

  /** True while any slide or fight has yet to finish. */
  busy(now: number): boolean {
    return (this.beats.at(-1)?.end ?? 0) > now;
  }

  /** Drop everything queued; units snap to their squares. */
  clear(): void {
    this.beats = [];
  }
}
