import type { GameState, Unit, WorkKind } from "@civ/core";
import { LUNGE_MS, type BattleFrame, type UnitMotion } from "./motion.js";
import { UNIT_ATLASES, type UnitAtlas } from "./unit-atlas.js";

/**
 * What a unit looses from where it stands (a catapult's stone): its picture draws it leaving on the `impact` frame, and
 * from that frame's end the map carries it on to its foe (`shotOf`, `MotionTiming.shot`), the first blow landing with it.
 */
export interface UnitShot {
  /** Where the impact frame draws it: atlas pixels from that frame's anchor (its foot). */
  from: readonly [x: number, y: number];
  /** How long it flies, from the impact frame's end to its landing. */
  flightMs: number;
  /** How high its arc rises above the straight way, in squares. */
  arc: number;
}

/** Frames of an atlas (indices) played in turn, and how long each shows. */
export interface UnitAnimSequence {
  frames: number[];
  ms: number[];
}

/**
 * Units that move as the user drew them, laid out by tools/sprites/units/anim.ts into `UNIT_ATLASES`: the
 * militia's sheet of 14 frames (2026-10-28) and its walk of 6 (2026-10-30), the settlers' of 24 and their founding's
 * of 6 (2026-10-29) and their walk of 6 (2026-10-31). Each atlas has a rule here, named as it is: its display scale, whether the clothes take the
 * owner's colour, and the frame it stands centred on; a unit's rule (named after the unit) has its moves, and may
 * take frames from further atlases (`sheets`: the militia's walk is drawn larger than its first sheet), numbered on
 * after its own (`animSheet`). Everything to tune is here: each sequence's frames and how long each shows, the frame
 * held when idle and fortified, which attack frame strikes. A unit plays only the moves it has; an atlas of a moment
 * of its own (`settlers-found`) has a `show`.
 */
export interface UnitAnimRule {
  /** The atlas's pixels to a map square: one scale for every frame (the static pictures' is `UNIT_SQUARE`). */
  square: number;
  /** Drawn pixel for pixel (nearest neighbour), never smoothed. */
  pixelated: boolean;
  /** Its magenta clothes in its owner's colour (`recolourOwner`); else shown as drawn, as the still pictures are. */
  ownerColour: boolean;
  /**
   * Played over and over while a fight it is in lasts, attacking or defending (`fightStep`); the blow lands on frame
   * `impact` of it. With a `shot`, played once as it attacks (never as it defends), what it looses flying on.
   */
  attack?: UnitAnimSequence & { impact: number; shot?: UnitShot };
  /** Looped while it keeps watch. */
  sentry?: UnitAnimSequence;
  /** Played once when ordered to fortify, then `fortified` held. */
  fortify?: UnitAnimSequence;
  /** Looped while it steps from square to square (a slide or a refused step's nudge), each step lasting a whole cycle (`travelMs`). */
  travel?: UnitAnimSequence;
  /** Looped while it works the land, by job. */
  work?: Partial<Record<WorkKind, UnitAnimSequence>>;
  /** Played once when it wins a fight, from the moment its foe falls, through to its end even once the fight is over. */
  won?: UnitAnimSequence;
  /** A show's atlas: played once, start to end, by the web app for a moment of its own (`showFrame`). */
  show?: UnitAnimSequence;
  /** The show (its atlas's name) played on the square where a unit of this type founds a city (`foundingShow`, `founding.ts`). */
  found?: string;
  /**
   * Further atlases (by name, each with its own rule for its scale) whose frames this unit's sequences use, numbered on
   * after its own atlas's in this order: frame `n` past its own is frame `n` of the first, and so on (`animSheet`).
   */
  sheets?: string[];
  /** Held while nothing else plays. */
  idle: number;
  /** Held once fortified (the idle frame when absent). */
  fortified?: number;
}

/**
 * The settlers' work (2026-10-29, the user's sheet: "mine, irrigation, travel and road building"), each row of
 * the sheet a loop: ramming the road's stones with a mallet (raised overhead, brought down) while the woman lays
 * them; digging a ditch with a spade (pushed in, levered, the dirt thrown) while she draws water; swinging a pick
 * at the rock while she gathers the stones. A fortress is built as a road is, polluted land cleaned with the spade.
 */
const RAM: UnitAnimSequence = { frames: [6, 7, 8, 9, 10, 11], ms: [260, 170, 220, 90, 200, 240] };
const DIG: UnitAnimSequence = { frames: [12, 13, 14, 15, 16, 17], ms: [200, 180, 220, 180, 240, 200] };
const PICK: UnitAnimSequence = { frames: [18, 19, 20, 21, 22, 23], ms: [220, 170, 200, 90, 240, 170] };

export const UNIT_ANIMS: Record<string, UnitAnimRule> = {
  militia: {
    // The ready frame as tall as the militia's picture on the units sheet (235 pixels here for 166 at 240 a square).
    square: 340,
    pixelated: true,
    ownerColour: true,
    // Ready, anticipation, wind-up, strike, follow-through, recovery; the blow lands on the strike.
    attack: { frames: [0, 1, 2, 3, 4, 5], ms: [120, 100, 100, 80, 100, 140], impact: 3 },
    sentry: { frames: [6, 7, 8, 9], ms: [450, 350, 450, 550] },
    // Standing, lowering, kneeling, defensive hold.
    fortify: { frames: [10, 11, 12, 13], ms: [120, 140, 160, 180] },
    // Walking (2026-10-30, the user's sheet: "implement militia travel animation"), from its own atlas: frames 14-19
    // here; from the step after the one it stands in, as the settlers' walk, a whole cycle a square (`travelMs`).
    // Winning (the same day: "implement militia lost and won combat", then "remove the lost animation - only win. the
    // lost unit would vanish with effect"), from its own atlas: frames 20-25, the club raised and the fists up, the
    // proud stance held longest. Losing, it goes up in the burst as any unit.
    sheets: ["militia-travel", "militia-won"],
    travel: { frames: [15, 16, 17, 18, 19, 14], ms: [80, 80, 80, 80, 80, 80] },
    won: { frames: [20, 21, 22, 23, 24, 25], ms: [110, 120, 140, 170, 200, 500] },
    idle: 6,
    fortified: 13,
  },
  // The militia's walk: drawn larger than its first sheet and slimmer, side on (upright in the passing step 425 pixels
  // tall to the sentry's 244, 1.74 times; his head 95 to 60, 1.58 times), so its scale is between the two: the head
  // level with the standing man's, he looks the same size walking as standing. The first step centred in the square,
  // the rest in register with it.
  "militia-travel": {
    square: 560,
    pixelated: true,
    ownerColour: true,
    idle: 0,
  },
  // Winning: a sheet drawn at a size of its own (his head 66 pixels to the first sheet's 60, standing 352 to its 244),
  // so its own scale between the two, as the walk's; the first frame centred in the square, the rest in register.
  "militia-won": {
    square: 440,
    pixelated: true,
    ownerColour: true,
    idle: 0,
  },
  settlers: {
    // The walking family as tall as the settlers' picture on the units sheet (194 pixels here for 189 at 240 a square).
    square: 246,
    pixelated: true,
    // Shown as drawn, the magenta left magenta, as the still pictures are (the militia's colour was asked for).
    ownerColour: false,
    // Walking (2026-10-31, the user's sheet: "impl. settlers travel (move from tile to tile) animation"), from its own
    // atlas: frames 24-29 here, in place of the first sheet's travel row (whose first frame they still stand in); from
    // the step after the one they stand in, a whole cycle a square (`travelMs`), ending as they stand.
    sheets: ["settlers-travel"],
    travel: { frames: [25, 26, 27, 28, 29, 24], ms: [80, 80, 80, 80, 80, 80] },
    work: { road: RAM, railroad: RAM, fortress: RAM, irrigate: DIG, clean: DIG, mine: PICK },
    found: "settlers-found",
    idle: 0,
  },
  // The settlers' walk: the family of the first sheet's travel row drawn larger, its frames put in register by their
  // bodies (the passing steps were drawn 22 pixels ahead in their cells). 1.76 times as tall (340 pixels to 193, the
  // spade raised), the people themselves 1.8 to 1.84 times (the woman 272 to 152, the man 312 to 170), and twice as wide
  // (a longer stride), so scaled by the people: they walk as tall as they stand, a little wider.
  "settlers-travel": {
    square: 443,
    pixelated: true,
    ownerColour: false,
    idle: 0,
  },
  // The settlers founding their city (2026-10-29, the user's sheet, in place of the hut going up the same day: "for new
  // settlement epic effect"): the flag lifted, raised, planted; unfurled, flying, and the family cheering under it, the
  // cheer held longest. The sheet draws the family larger than the walking one (the woman 257 pixels tall for 159), so
  // its scale is as much larger: they stand as tall as they walked in (the moment's zoom brings them close, `FOUNDING`).
  "settlers-found": {
    square: 398,
    pixelated: true,
    ownerColour: false,
    show: { frames: [0, 1, 2, 3, 4, 5], ms: [500, 450, 500, 550, 650, 900] },
    idle: 5,
  },
  // The hoplite (2026-10-30, the user's sheet: "implement hoplite sprite-sheet"), the first in the layout every unit's
  // sheet now takes (`oneSheet`): walking, the thrust over the shield, the cheer with spear and shield raised, then the
  // watch and the kneel behind the shield, its spear levelled over the rim. The cutter puts the drawings in register
  // (`align` in tools/sprites/units/anim.ts: the sheet set the strike back and the follow-through forward in their
  // cells). The size of the phalanx's picture on the units sheet as it stands in its square (shrunk to fit, 286 pixels
  // a square): its shield (67x80 here, 71x76 there: 290) and its crest to its feet (209 here, 198 there: 302) between
  // them. The still picture's spear is drawn longer, so the sheet's stands a little shorter in the square.
  phalanx: oneSheet(296),
  // The catapult (2026-10-31, the user's sheet: "implement attached catapult states", redrawn the same day with its
  // crewman: "implement attached updated catapult sprite-sheet"): he pushes it on its turning wheels; raises the loaded
  // arm upright, winches it back and down to cocked, holds it, and lets go: the arm slams up, the stone flies off with
  // its trail, the cart bucks and he stumbles back; then it rests empty; he steps away from it and cheers, arms up; he
  // stands watch beside it with his staff. As wide as the first sheet's catapult alone (236x172 standing, the cart
  // smaller beside him), so at its scale: between as wide as the picture on the units sheet (192x197 there at 240 a
  // square: 295) and as much of the square (249). Its shot (asked for the same day: "too fast. should be with ease
  // in-out. slow prepare to fire - than throw stone", then "still very bad": it lunged onto its foe, jiggled with every
  // blow and its stone went nowhere): it stands its ground and shoots once a fight, eased in and out: the arm raised and
  // winched down slowly, held longest, then quick as the stone leaves (the sheet's frame of it), the spent arm settling
  // slowly; the stone flies on from where the sheet draws it (34 pixels across, its middle 127 right of the frame's foot
  // and 194 above: near the top of its square, over its foe's), comes down on its foe's feet in a short drop, and the
  // first blow lands with it (`strikeMs`).
  catapult: oneSheet(252, {
    attack: { frames: [6, 7, 8, 9, 10, 11], ms: [260, 220, 260, 300, 110, 480], impact: 4, shot: { from: [127, -194], flightMs: 340, arc: 0.25 } },
  }),
};

/**
 * The moves of a unit drawn in the one sheet every unit's now takes (since the hoplite, 2026-10-30): rows of 6 frames,
 * moving, the attack (striking on its fourth frame), the victory, then the watch (3) and fortifying (3), the unit
 * standing in the first watch frame. `square` is its scale; shown as drawn, the magenta left magenta, as the still
 * pictures are (the militia's colour was asked for).
 */
function oneSheet(square: number, more: Partial<UnitAnimRule> = {}): UnitAnimRule {
  return {
    square,
    pixelated: true,
    ownerColour: false,
    // A whole cycle a square (`travelMs`), from the step after the one it stands in.
    travel: { frames: [1, 2, 3, 4, 5, 0], ms: [80, 80, 80, 80, 80, 80] },
    // Ready, anticipation, wind-up, strike, follow-through, recovery; the blow lands on the strike.
    attack: { frames: [6, 7, 8, 9, 10, 11], ms: [120, 100, 100, 80, 100, 140], impact: 3 },
    // From the moment its foe falls, the last pose held longest.
    won: { frames: [12, 13, 14, 15, 16, 17], ms: [110, 120, 140, 170, 200, 500] },
    sentry: { frames: [18, 19, 20], ms: [450, 400, 550] },
    // Played once, the last held while fortified.
    fortify: { frames: [21, 22, 23], ms: [140, 160, 180] },
    idle: 18,
    fortified: 23,
    ...more,
  };
}

/** The frame show `id` (an atlas with a `show`) is on `elapsed` into it, its last held once it is over. */
export function showFrame(id: string, elapsed: number): number {
  const show = UNIT_ANIMS[id]?.show;
  if (!show) return UNIT_ANIMS[id]?.idle ?? 0;
  return show.frames[sequenceStep(show.ms, elapsed, false).step]!;
}

export type UnitAnimAction = "idle" | "sentry" | "attack" | "won" | "fortifying" | "fortified" | "travel" | `work:${WorkKind}`;

/**
 * Where frame `frame` of unit `type`'s moves is drawn: its own atlas's frames first, then each of its rule's `sheets`
 * in turn. The atlas's name and data, the frame within it, its scale and the frame it stands centred on.
 */
export function animSheet(type: string, frame: number): { id: string; atlas: UnitAtlas; frame: number; square: number; home: number } | null {
  const rule = UNIT_ANIMS[type];
  if (!rule) return null;
  let n = frame;
  for (const id of [type, ...(rule.sheets ?? [])]) {
    const atlas = UNIT_ATLASES[id];
    const own = UNIT_ANIMS[id];
    if (!atlas || !own) return null;
    if (n < atlas.frames.length) return { id, atlas, frame: n, square: own.square, home: own.idle };
    n -= atlas.frames.length;
  }
  return null;
}

/** How many frames unit `type`'s moves have, its own atlas's and its `sheets`' together. */
export function animFrameCount(type: string): number {
  const rule = UNIT_ANIMS[type];
  if (!rule) return 0;
  return [type, ...(rule.sheets ?? [])].reduce((n, id) => n + (UNIT_ATLASES[id]?.frames.length ?? 0), 0);
}

/** How long an attacker of `type` takes to its first strike, its attack's frames before it (`MotionTiming.strikeMs`); 0 for one with no attack. */
export function strikeMs(type: string): number {
  const attack = UNIT_ANIMS[type]?.attack;
  if (!attack) return 0;
  // A shot lands once its frame has shown it leaving and it has flown.
  const lead = attack.ms.slice(0, attack.shot ? attack.impact + 1 : attack.impact).reduce((a, b) => a + b, 0);
  return lead + (attack.shot?.flightMs ?? 0);
}

/** How long a step of a unit of `type` takes to show its walk whole (`MotionTiming.walkMs`); 0 for one that does not walk. */
export function travelMs(type: string): number {
  return UNIT_ANIMS[type]?.travel?.ms.reduce((a, b) => a + b, 0) ?? 0;
}

/** Unit type `type`'s moves and atlas, when it has them. */
export function unitAnim(type: string): { rule: UnitAnimRule; atlas: UnitAtlas } | null {
  const rule = UNIT_ANIMS[type];
  const atlas = UNIT_ATLASES[type];
  return rule && atlas ? { rule, atlas } : null;
}

/** The step of a sequence showing `ms` into it (the last once it is over, unless it loops), and whether it is over. */
export function sequenceStep(ms: readonly number[], elapsed: number, loop: boolean): { step: number; done: boolean } {
  const total = ms.reduce((a, b) => a + b, 0);
  if (!loop && elapsed >= total) return { step: ms.length - 1, done: true };
  let t = loop ? ((elapsed % total) + total) % total : Math.max(0, elapsed);
  for (let i = 0; i < ms.length; i++) {
    if (t < ms[i]!) return { step: i, done: false };
    t -= ms[i]!;
  }
  return { step: ms.length - 1, done: !loop };
}

/**
 * The attack's step `elapsed` into it. In a fight (`strikeAt`: when the first blow lands, `LUNGE_MS` after the
 * fight begins) the frames before the strike share that time, so the strike lands with the blow; the rest keep
 * their own timings. Without it (a preview) every frame keeps its timing.
 */
export function attackStep(rule: UnitAnimRule, elapsed: number, strikeAt?: number): { step: number; done: boolean } {
  if (!rule.attack) return { step: 0, done: true };
  const { ms, impact, shot } = rule.attack;
  if (strikeAt === undefined) return sequenceStep(ms, elapsed, false);
  const before = ms.slice(0, impact).reduce((a, b) => a + b, 0);
  // A shot's frame and flight come before its blow as well.
  const lead = shot ? strikeAt - ms[impact]! - shot.flightMs : strikeAt;
  const k = before > 0 ? Math.max(0, lead) / before : 1;
  return sequenceStep(ms.map((m, i) => (i < impact ? m * k : m)), elapsed, false);
}

/** What a unit does when nothing plays: from its orders, as far as it has the move (a settler on sentry stands). */
export function steadyAction(rule: UnitAnimRule, order: Unit["order"]): UnitAnimAction {
  if (order.kind === "sentry" && rule.sentry) return "sentry";
  if ((order.kind === "fortifying" || order.kind === "fortified") && rule.fortify) return "fortified";
  if (order.kind === "work" && rule.work?.[order.work]) return `work:${order.work}`;
  return "idle";
}

/** Orders as the animator tells them apart: their kind, and a settler's job. */
const orderKey = (order: Unit["order"]): string => (order.kind === "work" ? `work:${order.work}` : order.kind);

/** A looping sequence's frame `elapsed` into it. */
function looped(seq: UnitAnimSequence, elapsed: number): { frame: number; step: number; done: boolean } {
  const s = sequenceStep(seq.ms, elapsed, true);
  return { frame: seq.frames[s.step]!, ...s, done: false };
}

/**
 * The attack's step `elapsed` into a fight, over and over while it lasts (asked for 2026-10-30: "when fight in combat -
 * show militia fight animation as a cycle - not just once"): the first time through as `attackStep` (with `strikeAt`,
 * the strike landing with the first blow), then round again at the frames' own pace. `round` counts the times through.
 */
export function fightStep(rule: UnitAnimRule, elapsed: number, strikeAt?: number): { step: number; round: number } {
  if (!rule.attack) return { step: 0, round: 0 };
  const first = attackStep(rule, elapsed, strikeAt);
  if (!first.done) return { step: first.step, round: 0 };
  // One that shoots looses once a fight, then stands spent.
  if (rule.attack.shot) return { step: rule.attack.ms.length - 1, round: 0 };
  const { ms, impact } = rule.attack;
  const total = ms.reduce((a, b) => a + b, 0);
  const firstMs = strikeAt === undefined ? total : strikeAt + ms.slice(impact).reduce((a, b) => a + b, 0);
  const after = Math.max(0, elapsed - firstMs);
  return { step: sequenceStep(ms, after, true).step, round: 1 + Math.floor(after / total) };
}

/** The atlas frame a unit shows `elapsed` into `action`, the sequence's step, and whether a sequence played once is over. */
export function actionFrame(rule: UnitAnimRule, action: UnitAnimAction, elapsed: number, strikeAt?: number): { frame: number; step: number; done: boolean } {
  const still = (frame: number) => ({ frame, step: 0, done: false });
  switch (action) {
    case "idle": return still(rule.idle);
    case "fortified": return still(rule.fortified ?? rule.idle);
    case "sentry": return rule.sentry ? looped(rule.sentry, elapsed) : still(rule.idle);
    case "travel": return rule.travel ? looped(rule.travel, elapsed) : still(rule.idle);
    case "won": {
      // Once through, then back to its orders.
      if (!rule.won) return { ...still(rule.idle), done: true };
      const s = sequenceStep(rule.won.ms, elapsed, false);
      return { frame: rule.won.frames[s.step]!, ...s };
    }
    case "fortifying": {
      if (!rule.fortify) return { ...still(rule.fortified ?? rule.idle), done: true };
      const s = sequenceStep(rule.fortify.ms, elapsed, false);
      return { frame: rule.fortify.frames[s.step]!, ...s };
    }
    case "attack": {
      // Round and round while the fight lasts (the animator ends it with the fight).
      if (!rule.attack) return { ...still(rule.idle), done: true };
      const s = fightStep(rule, elapsed, strikeAt);
      return { frame: rule.attack.frames[s.step]!, step: s.step, done: false };
    }
    default: {
      const seq = rule.work?.[action.slice("work:".length) as WorkKind];
      return seq ? looped(seq, elapsed) : still(rule.idle);
    }
  }
}

interface Playing {
  action: UnitAnimAction;
  /** When the action began. */
  since: number;
  /** The orders last seen (`orderKey`), to tell a change, and what they had it do. */
  order: string;
  steady: UnitAnimAction;
  /** The fight it is fighting (the fight's start), so none is begun twice; whether it attacks; the last time through whose strike has landed. */
  fight?: number;
  attacking?: boolean;
  struck?: number;
}

/** One frame's poses: the atlas frame of each animated unit by id, and the units whose strike landed this frame (each time round). */
export interface UnitPoses {
  frames: Record<number, number>;
  impacts: number[];
}

/**
 * The animated units' poses, a UI side channel like `MotionPlayer` (never read by the rules, the AI or a replay):
 * `update` once a frame gives each animated unit's frame from the time since its action began. An action begins
 * only when it changes: its orders turn to sentry, fortify or a job (`fortifying` once, then the last frame held; a
 * unit first seen fortified is simply fortified; a job loops as long as it lasts), it steps across the map (`moving`,
 * the slides and nudges being shown: it walks while it goes, then back to what its orders say), or it fights in the
 * fight being shown, attacking or defending (keyed by the fight's start, so none begins twice; its attack round and
 * round while the fight is shown, `fightStep`: the attacker's timed from the fight's start so its first strike lands
 * with the first blow, the defender's from the lunge at its own pace; each strike reported in `impacts` as it lands),
 * and, once the fight is decided (the loser begins to burst, `BattleFighter.dying`), the winner its triumph (`won`,
 * played through even once the fight is over); then back to what its orders say; a finished fortify likewise. A unit plays only the moves its rule has. Redrawing,
 * moving the camera or picking units changes nothing.
 */
export class UnitAnimator {
  private units = new Map<number, Playing>();

  update(state: GameState, battle: BattleFrame | undefined, now: number, moving: readonly Pick<UnitMotion, "unit">[] = []): UnitPoses {
    const poses: UnitPoses = { frames: {}, impacts: [] };
    const seen = new Set<number>();
    const going = new Set(moving.map((m) => m.unit));
    for (const u of state.units) {
      const anim = unitAnim(u.type);
      if (!anim) continue;
      seen.add(u.id);
      const key = orderKey(u.order);
      const steady = steadyAction(anim.rule, u.order);
      let p = this.units.get(u.id);
      if (!p) this.units.set(u.id, (p = { action: steady, since: now, order: key, steady }));
      else if (key !== p.order) {
        const fortifies = steady === "fortified" && p.steady !== "fortified";
        const busy = p.action === "attack" || p.action === "won" || p.action === "travel";
        if (!busy && (p.action !== steady || fortifies)) Object.assign(p, { action: fortifies ? "fortifying" : steady, since: now });
        Object.assign(p, { order: key, steady });
      }
      // Walking while it goes; stopped, back to its orders.
      if (going.has(u.id) && anim.rule.travel && p.action !== "attack" && p.action !== "travel") Object.assign(p, { action: "travel", since: now });
      else if (!going.has(u.id) && p.action === "travel") Object.assign(p, { action: steady, since: now });
      this.pose(u.id, u.type, u.order, battle, now, poses);
    }
    // A fighter gone from the state already (it lost) keeps its moves while the fight is shown.
    for (const f of battle ? [battle.attacker, battle.defender] : []) {
      if (seen.has(f.unit) || !unitAnim(f.type)) continue;
      if (!this.units.has(f.unit)) this.units.set(f.unit, { action: "idle", since: now, order: "none", steady: "idle" });
      this.pose(f.unit, f.type, { kind: "none" }, battle, now, poses);
      seen.add(f.unit);
    }
    for (const id of this.units.keys()) if (!seen.has(id)) this.units.delete(id);
    return poses;
  }

  private pose(id: number, type: string, order: Unit["order"], battle: BattleFrame | undefined, now: number, poses: UnitPoses): void {
    const { rule } = unitAnim(type)!;
    const p = this.units.get(id)!;
    const side = battle ? (battle.attacker.unit === id ? "attacker" : battle.defender.unit === id ? "defender" : null) : null;
    // One that shoots does so only as it attacks; attacked, it stands as it was.
    if (battle && side && rule.attack && p.fight !== battle.start && !(side === "defender" && rule.attack.shot)) {
      // The attacker from the fight's start, its first strike with the first blow; the defender answers from that blow.
      const attacking = side === "attacker";
      Object.assign(p, { action: "attack", since: attacking ? battle.start : battle.start + (battle.strikeMs ?? LUNGE_MS), fight: battle.start, attacking, struck: -1 });
    }
    // The fight decided, as the loser begins to burst: the winner celebrates.
    if (battle && side && p.fight === battle.start) {
      const foe = side === "attacker" ? battle.defender : battle.attacker;
      if (foe.dying > 0 && rule.won && p.action === "attack") Object.assign(p, { action: "won", since: now });
    }
    // The fight over (or another one shown, not ours): back to its orders; a win plays on to its end.
    if (p.action === "attack" && (!side || battle!.start !== p.fight)) Object.assign(p, { action: steadyAction(rule, order), since: now });
    const strikeAt = battle?.strikeMs ?? LUNGE_MS;
    let shown = actionFrame(rule, p.action, now - p.since, p.action === "attack" && p.attacking ? strikeAt : undefined);
    if (p.action === "attack" && rule.attack) {
      const { round, step } = fightStep(rule, Math.max(0, now - p.since), p.attacking ? strikeAt : undefined);
      const landed = step >= rule.attack.impact ? round : round - 1;
      if (now >= p.since && landed > (p.struck ?? -1)) {
        p.struck = landed;
        poses.impacts.push(id);
      }
    }
    if (shown.done) {
      Object.assign(p, { action: steadyAction(rule, order), since: now });
      shown = actionFrame(rule, p.action, 0);
    }
    poses.frames[id] = shown.frame;
  }
}
