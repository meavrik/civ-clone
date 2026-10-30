import { atWar, cityAt, CITY_STATE_BY_ID, civ, mapDistance, rankOf, RANKS, unitType, type GameState, type UnitAction, type UnitBattle, type UnitStep } from "@civ/core";
import { motionMs, type MotionTiming } from "./motion.js";
import { travelMs } from "./unit-anim.js";
import type { Callout } from "./refusal.js";

/**
 * What the player watches of the other civilizations' turns, as the original
 * showed them: every move of an enemy (a civilization at war with us, the
 * barbarians) on squares we could see, one unit at a time, the map gliding to
 * each before it moves; each fight with our units announced beside the
 * attacker and its outcome said beside our square. Other civilizations' moves
 * play only where the map already looks. Pure: the web app queues the beats on
 * its `MotionPlayer` and moves its camera at each hold's `centre`.
 */
export type WatchBeat =
  | { kind: "hold"; ms: number; centre?: { x: number; y: number }; note?: Callout }
  | { kind: "play"; actions: UnitAction[]; timing: MotionTiming };

export interface WatchCamera {
  /** The square at the top left of the map view, and how many squares it shows. */
  originX: number;
  originY: number;
  tilesX: number;
  tilesY: number;
}

export interface WatchOptions {
  viewer: number;
  camera: WatchCamera;
  /** Squares the viewer saw during those turns (before or after). */
  seen: (x: number, y: number) => boolean;
  /** How long the camera takes to glide to a new square. */
  glideMs: number;
}

/** Paces per kind of move: an enemy's slow enough to follow, anyone else's brisk, our gotos as our own orders. */
export const WATCH_PACE = {
  threat: { stepMs: 220, maxMs: 1800, battleMs: 2400, battleTotalMs: 2400, roundMaxMs: 170 },
  other: { stepMs: 140, maxMs: 1200, battleMs: 1400, battleTotalMs: 1400 },
  own: { stepMs: 120, maxMs: 1000, battleMs: 1600, battleTotalMs: 1600 },
};
/** A moment's pause once the camera has arrived, before the unit moves. */
export const SETTLE_MS = 150;
/** How long a fight's announcement stands before the blows, and its outcome after. */
export const ANNOUNCE_MS = 650;
export const OUTCOME_MS = 1100;
/** A turn's playback longer than this is sped up (to no more than a little under three times as fast). */
export const WATCH_BUDGET_MS = 20000;
const MIN_SPEED = 0.35;

type Kind = keyof typeof WATCH_PACE;
type Leg = { kind: "leg"; owner: number; steps: UnitStep[] } | { kind: "fight"; battle: UnitBattle };

/** Steps by one unit in a row (and its ship's cargo) as legs; each fight stands alone. */
function legs(actions: readonly UnitAction[]): Leg[] {
  const out: Leg[] = [];
  for (const a of actions) {
    if (a.kind === "battle") { out.push({ kind: "fight", battle: a }); continue; }
    const last = out.at(-1);
    const lead = last?.kind === "leg" ? last.steps[0]! : undefined;
    if (last?.kind === "leg" && lead && (a.unit === lead.unit || a.aboard === lead.unit)) last.steps.push(a);
    else out.push({ kind: "leg", owner: a.owner, steps: [a] });
  }
  return out;
}

const article = (word: string): string => (/^[AEIOU]/i.test(word) ? "an" : "a");

/** "Babylonian Legion": the owner's adjective and the unit's name; a city-state's, "Legion of Tyre" (`cityState`, its rule's id). */
export function unitTitle(state: GameState, owner: number, type: string, cityState?: string): string {
  const own = cityState !== undefined ? CITY_STATE_BY_ID[cityState] : undefined;
  if (own) return `${unitType(type).name} of ${own.name}`;
  const p = state.players[owner];
  let adj = "";
  try { adj = p ? civ(p.civ).adjective : ""; } catch { /* a civilization since renamed */ }
  return adj ? `${adj} ${unitType(type).name}` : unitType(type).name;
}

/** The fight's announcement, beside the attacker. */
export function attackNote(state: GameState, b: UnitBattle, viewer: number): string {
  const rank = rankOf(b.attacker.xp);
  const title = b.attacker.owner === viewer ? unitType(b.attacker.type).name : unitTitle(state, b.attacker.owner, b.attacker.type, b.attacker.cityState);
  return `${rank.id === "recruit" ? "" : `${rank.name} `}${title} attacks!`;
}

/** The rank a fight raised the winner to, as a few words after the fight's: ", now Veteran". */
function risen(b: UnitBattle): string {
  const rank = b.promoted && RANKS.find((r) => r.id === b.promoted);
  return rank ? `, now ${rank.name}` : "";
}

/** What became of the viewer's side, beside the defender's square. */
export function outcomeNote(b: UnitBattle, viewer: number): string {
  const defending = b.defender.owner === viewer;
  const ours = defending ? b.defender : b.attacker;
  const won = defending ? !b.attackerWon : b.attackerWon;
  const name = unitType(ours.type).name;
  if (won) return defending ? `${name} holds${risen(b)}!` : `${name} wins${risen(b)}!`;
  const more = b.alsoLost.length;
  return more ? `${name} and ${more} more lost` : `${name} destroyed`;
}

/** Where a fight was, in words: "in Rome", "near Rome", or nothing when no known city is close. */
export function fightPlace(state: GameState, b: UnitBattle, viewer: number): string {
  const { x, y } = b.defender;
  const here = cityAt(state, x, y);
  if (here) return ` in ${here.name}`;
  const p = state.players[viewer];
  let best: { name: string; d: number; ours: boolean } | undefined;
  for (const c of state.cities) {
    if (p && p.explored[c.y * state.map.width + c.x] !== 1) continue;
    const d = mapDistance(state.map, x, y, c.x, c.y);
    const ours = c.owner === viewer;
    // Our own cities first when they are about as close.
    const better = !best || d + (ours ? 0 : 1) < best.d + (best.ours ? 0 : 1);
    if (d <= 6 && better) best = { name: c.name, d, ours };
  }
  return best ? ` near ${best.name}` : "";
}

/**
 * The turn's fights with the viewer's units, one line each ("{swords} A Babylonian Legion destroyed
 * our Phalanx near Rome."), the same fight told once with a count ("... in Rome (x2)."), at most `max` lines.
 */
export function fightReport(state: GameState, fights: readonly UnitBattle[], viewer: number, max = 6): string[] {
  const lines: string[] = [];
  const count = new Map<string, number>();
  for (const b of fights) {
    const defending = b.defender.owner === viewer;
    if (!defending && b.attacker.owner !== viewer) continue;
    const them = defending ? b.attacker : b.defender;
    const ours = defending ? b.defender : b.attacker;
    const foe = unitTitle(state, them.owner, them.type, them.cityState);
    const mine = unitType(ours.type).name;
    const more = b.alsoLost.length ? ` and ${b.alsoLost.length} more` : "";
    const where = fightPlace(state, b, viewer);
    const line = defending
      ? (b.attackerWon ? `${capital(article(foe))} ${foe} destroyed our ${mine}${more}${where}` : `Our ${mine}${where} beat off ${article(foe)} ${foe}${risen(b)}`)
      : (b.attackerWon ? `Our ${mine} defeated ${article(foe)} ${foe}${where}${risen(b)}` : `Our ${mine}${more} fell attacking ${article(foe)} ${foe}${where}`);
    if (!count.has(line)) lines.push(line);
    count.set(line, (count.get(line) ?? 0) + 1);
  }
  const out = lines.map((l) => `{swords} ${l}${(count.get(l) ?? 1) > 1 ? ` (x${count.get(l)})` : ""}.`);
  if (out.length <= max) return out;
  const rest = lines.slice(max - 1).reduce((n, l) => n + (count.get(l) ?? 1), 0);
  return [...out.slice(0, max - 1), `{swords} And ${rest} more fights.`];
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The beats of a playback, from the actions of the other civilizations' turns (and our gotos as ours began). */
export function watchTurn(state: GameState, actions: readonly UnitAction[], o: WatchOptions): WatchBeat[] {
  const { width: w, height: h } = state.map;
  const cam = { ...o.camera };
  const hostile = (owner: number) => owner !== o.viewer && atWar(state, o.viewer, owner);
  // Square (x, y) on screen, at least `margin` squares in from the edge.
  const inView = (x: number, y: number, margin: number) => {
    const rx = (((x - cam.originX) % w) + w) % w;
    const ry = y - cam.originY;
    return rx >= margin && rx <= cam.tilesX - 1 - margin && ry >= margin && ry <= cam.tilesY - 1 - margin;
  };
  const centreOn = (squares: readonly (readonly [number, number])[]): { x: number; y: number } => {
    // The middle of their bounds, measured from the first square the short way round the seam.
    const [x0, y0] = squares[0]!;
    let lo = 0, hi = 0, top = y0, bottom = y0;
    for (const [x, y] of squares) {
      let dx = (((x - x0) % w) + w) % w;
      if (dx > w / 2) dx -= w;
      lo = Math.min(lo, dx); hi = Math.max(hi, dx);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const x = (((x0 + Math.round((lo + hi) / 2)) % w) + w) % w;
    const y = Math.round((top + bottom) / 2);
    // Where the web app's camera will stand once it has centred there.
    cam.originX = (((x - (cam.tilesX >> 1)) % w) + w) % w;
    cam.originY = Math.max(0, Math.min(h - cam.tilesY, y - (cam.tilesY >> 1)));
    return { x, y };
  };
  /** A hold for the camera, if these squares are not well on screen; its length. */
  const follow = (squares: readonly (readonly [number, number])[], out: WatchBeat[]): number => {
    if (squares.every(([x, y]) => inView(x, y, 1))) return 0;
    out.push({ kind: "hold", ms: o.glideMs + SETTLE_MS, centre: centreOn(squares) });
    return o.glideMs + SETTLE_MS;
  };

  const beats: WatchBeat[] = [];
  // An animated unit walks a whole step of its walk a square (`travelMs`).
  const play = (acts: UnitAction[], kind: Kind) => beats.push({ kind: "play", actions: acts, timing: { ...WATCH_PACE[kind], width: w, walkMs: travelMs } });
  for (const leg of legs(actions)) {
    if (leg.kind === "fight") {
      const b = leg.battle;
      const squares = [[b.defender.x, b.defender.y], [b.attacker.x, b.attacker.y]] as const;
      if (b.attacker.owner === o.viewer || b.defender.owner === o.viewer) {
        // Always shown: the map goes there, says who attacks, plays the blows and says what came of it.
        const glide = follow(squares, beats);
        const hold = beats.at(-1);
        const note = { x: b.attacker.x, y: b.attacker.y, text: attackNote(state, b, o.viewer) };
        if (glide && hold?.kind === "hold") { hold.ms += ANNOUNCE_MS; hold.note = note; }
        else beats.push({ kind: "hold", ms: ANNOUNCE_MS, note });
        play([b], "threat");
        beats.push({ kind: "hold", ms: OUTCOME_MS, note: { x: b.defender.x, y: b.defender.y, text: outcomeNote(b, o.viewer) } });
      } else if ((o.seen(b.attacker.x, b.attacker.y) || o.seen(b.defender.x, b.defender.y)) && squares.some(([x, y]) => inView(x, y, 0))) play([b], "other");
      continue;
    }
    const steps = leg.steps.filter((s) => o.seen(s.fromX, s.fromY) || o.seen(s.toX, s.toY));
    if (!steps.length) continue;
    const squares: [number, number][] = [[steps[0]!.fromX, steps[0]!.fromY], ...steps.map((s) => [s.toX, s.toY] as [number, number])];
    const kind: Kind = leg.owner === o.viewer ? "own" : hostile(leg.owner) ? "threat" : "other";
    if (kind === "threat") { follow(squares, beats); play(steps, kind); }
    else if (squares.some(([x, y]) => inView(x, y, 0))) play(steps, kind);
  }
  return fitBudget(beats, o.glideMs);
}

/** How long the beats take to play. */
export function watchMs(beats: readonly WatchBeat[]): number {
  return beats.reduce((sum, b) => sum + (b.kind === "hold" ? b.ms : motionMs(b.actions, b.timing)), 0);
}

/** A long playback, sped up to fit the budget as far as it may go: the camera's glides keep their time. */
function fitBudget(beats: WatchBeat[], glideMs: number): WatchBeat[] {
  const total = watchMs(beats);
  if (total <= WATCH_BUDGET_MS) return beats;
  const k = Math.max(MIN_SPEED, WATCH_BUDGET_MS / total);
  return beats.map((b): WatchBeat => {
    if (b.kind === "hold") return { ...b, ms: b.centre ? glideMs + (b.ms - glideMs) * k : b.ms * k };
    const t = b.timing;
    const timing: MotionTiming = { ...t, stepMs: t.stepMs * k, maxMs: t.maxMs * k };
    if (t.battleMs !== undefined) timing.battleMs = t.battleMs * k;
    if (t.battleTotalMs !== undefined) timing.battleTotalMs = t.battleTotalMs * k;
    return { ...b, timing };
  });
}
