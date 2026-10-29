import { GOLD_WORTH, GOODWILL, PACTS } from "./rules/diplomacy.js";
import { unitType } from "./rules/units.js";
import { landOwner } from "./territory.js";
import { getTile, Terrain, type Alliance, type GameState, type Gift, type Relation, type Trespass, type Unit } from "./types.js";

function key(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function relation(state: GameState, a: number, b: number): Relation {
  if (a === b) return "peace";
  if (a === state.barbarians || b === state.barbarians) return "war";
  return state.relations[key(a, b)] ?? "none";
}

export function setRelation(state: GameState, a: number, b: number, r: Relation): void {
  if (a === b) return;
  state.relations[key(a, b)] = r;
}

export function atWar(state: GameState, a: number, b: number): boolean {
  return relation(state, a, b) === "war";
}

/** Has contact been made (any relation other than none)? */
export function hasContact(state: GameState, a: number, b: number): boolean {
  return relation(state, a, b) !== "none";
}

/** Have `a` and `b` a peace treaty? (Met without one, they are only in contact.) */
export function atPeace(state: GameState, a: number, b: number): boolean {
  return relation(state, a, b) === "peace";
}

/** The relation a first meeting leaves: contact, no treaty yet; peace at once in saves before version 15 (`peaceOnContact`). */
export function metRelation(state: GameState): Relation {
  return state.peaceOnContact ? "peace" : "contact";
}

/**
 * How far apart a unit or city of each side must come to meet: next to each
 * other, as in the original, so every unit (sight 1) sees whom it met. Saves
 * before version 10 met at two squares (`farContact`).
 */
export function contactRange(state: GameState): number {
  return state.farContact ? 2 : 1;
}

/**
 * Detect first contacts: a unit or city of `a` within `contactRange` of one of
 * `b`. Returns the ids of players newly contacted this call (relation set to
 * `metRelation`).
 */
export function detectContacts(state: GameState, a: number): number[] {
  const unmet = state.players.filter((p) => p.id !== a && p.alive && p.id !== state.barbarians && !hasContact(state, a, p.id));
  if (!unmet.length) return [];
  const met: number[] = [];
  const w = state.map.width;
  const range = contactRange(state);
  const near = (x1: number, y1: number, x2: number, y2: number) =>
    Math.abs(y1 - y2) <= range && Math.min(Math.abs(x1 - x2), w - Math.abs(x1 - x2)) <= range;
  const mine = [...state.units.filter((u) => u.owner === a), ...state.cities.filter((c) => c.owner === a)];
  for (const p of unmet) {
    const theirs = [...state.units.filter((u) => u.owner === p.id), ...state.cities.filter((c) => c.owner === p.id)];
    const touching = mine.some((m) => theirs.some((t) => near(m.x, m.y, t.x, t.y)));
    if (touching) {
      setRelation(state, a, p.id, metRelation(state));
      met.push(p.id);
    }
  }
  return met;
}

/** First contacts made by one unit of `u.owner` standing where it is (cheaper than `detectContacts`, for each step of a goto). */
export function meetAround(state: GameState, u: Unit): number[] {
  const unmet = new Set(state.players.filter((p) => p.id !== u.owner && p.alive && p.id !== state.barbarians && !hasContact(state, u.owner, p.id)).map((p) => p.id));
  if (!unmet.size) return [];
  const w = state.map.width;
  const range = contactRange(state);
  const near = (x: number, y: number) => Math.abs(y - u.y) <= range && Math.min(Math.abs(x - u.x), w - Math.abs(x - u.x)) <= range;
  const met: number[] = [];
  for (const t of [...state.units, ...state.cities]) {
    if (!unmet.has(t.owner) || !near(t.x, t.y)) continue;
    unmet.delete(t.owner);
    setRelation(state, u.owner, t.owner, metRelation(state));
    met.push(t.owner);
  }
  return met;
}

// ---- open borders and trespass ------------------------------------------------------

/** Have `a` and `b` opened their lands to each other's units? */
export function bordersOpen(state: GameState, a: number, b: number): boolean {
  return state.openBorders?.[key(a, b)] === true;
}

export function setBordersOpen(state: GameState, a: number, b: number, open: boolean): void {
  if (a === b) return;
  if (open) (state.openBorders ??= {})[key(a, b)] = true;
  else if (state.openBorders) delete state.openBorders[key(a, b)];
}

/**
 * Does `owner` mind units of `intruder` on its land? Once met and not at war,
 * without open borders: at war they are fair game, and before contact
 * nobody has asked anything. Never in saves before version 10 (`noTrespass`).
 */
export function mindsTrespass(state: GameState, owner: number, intruder: number): boolean {
  if (state.noTrespass || owner < 0 || owner === intruder || owner === state.barbarians || intruder === state.barbarians) return false;
  const r = relation(state, owner, intruder);
  return (r === "peace" || r === "contact") && !bordersOpen(state, owner, intruder) && !allied(state, owner, intruder);
}

/**
 * Whose land unit `u` trespasses on, or -1. Land units on land count; ships,
 * units aboard them, and diplomats and caravans (on errands to foreign
 * cities) do not.
 */
export function trespassOn(state: GameState, u: Unit): number {
  if (state.noTrespass) return -1;
  const t = unitType(u.type);
  if (t.domain !== "land" || u.aboard !== null || t.flags?.includes("diplomat") || t.flags?.includes("caravan")) return -1;
  if (getTile(state.map, u.x, u.y)?.terrain === Terrain.Ocean) return -1;
  const owner = landOwner(state, u.x, u.y);
  return mindsTrespass(state, owner, u.owner) ? owner : -1;
}

/** Units of `intruder` trespassing on `owner`'s land. */
export function trespassers(state: GameState, owner: number, intruder: number): Unit[] {
  if (!mindsTrespass(state, owner, intruder)) return [];
  return state.units.filter((u) => u.owner === intruder && trespassOn(state, u) === owner);
}

function trespassKey(owner: number, intruder: number): string {
  return `${owner}>${intruder}`;
}

/** `owner`'s latest demand that `intruder` leave its land, if it still stands. */
export function trespassRecord(state: GameState, owner: number, intruder: number): Trespass | undefined {
  return state.trespass?.[trespassKey(owner, intruder)];
}

/**
 * `owner` sees `intruder`'s units on its land with no demand standing: noted, a turn to leave before the
 * first demand (since save version 37; `askOnEntry` saves made it the first demand at once).
 */
export function noteTrespass(state: GameState, owner: number, intruder: number): Trespass {
  const k = trespassKey(owner, intruder);
  const had = state.trespass?.[k];
  if (had) return had;
  if (state.askOnEntry) return warnTrespass(state, owner, intruder);
  const rec = { turn: state.turn, warnings: 0 };
  (state.trespass ??= {})[k] = rec;
  return rec;
}

/** `owner` asks `intruder` to leave (again): one more warning. */
export function warnTrespass(state: GameState, owner: number, intruder: number): Trespass {
  const k = trespassKey(owner, intruder);
  const rec = { turn: state.turn, warnings: (state.trespass?.[k]?.warnings ?? 0) + 1 };
  (state.trespass ??= {})[k] = rec;
  return rec;
}

/** Forget `owner`'s grievance against `intruder` (they left, made a gift, opened borders, or went to war). */
export function forgiveTrespass(state: GameState, owner: number, intruder: number): void {
  if (state.trespass) delete state.trespass[trespassKey(owner, intruder)];
}

/**
 * At the start of `owner`'s turn: grievances against civilizations whose units have all gone are dropped,
 * and (since save version 37) units found on its land with nothing said yet are noted, to be asked off at
 * its next turn if they stay.
 */
export function clearTrespass(state: GameState, owner: number): void {
  for (const k of Object.keys(state.trespass ?? {})) {
    const [o, i] = k.split(">").map(Number) as [number, number];
    if (o === owner && !trespassers(state, o, i).length) delete state.trespass![k];
  }
  if (state.askOnEntry || state.noTrespass) return;
  for (const p of state.players) if (p.alive && trespassers(state, owner, p.id).length) noteTrespass(state, owner, p.id);
}

// ---- gold between civilizations -----------------------------------------------------

/** What gold is worth to `player` (`GOLD_WORTH`): more to a great, rich realm than to a young one. */
export function goldScale(state: GameState, player: number): number {
  let people = 0;
  for (const c of state.cities) if (c.owner === player) people += c.size;
  return GOLD_WORTH.base + Math.floor((state.players[player]?.gold ?? 0) * GOLD_WORTH.treasury) + GOLD_WORTH.perCitizen * people;
}

/** `from` gives `to` `gold`: kept, weighed by what gold is worth to `to` before it, while it may still sway them (`GOODWILL.turns`). */
export function recordGift(state: GameState, from: number, to: number, gold: number): Gift {
  const gift = { turn: state.turn, gold, share: gold / goldScale(state, to) };
  const k = `${from}>${to}`;
  const gifts = (state.gifts ??= {});
  gifts[k] = [...(gifts[k] ?? []).filter((g) => state.turn - g.turn < GOODWILL.turns), gift];
  return gift;
}

/** Whether `from`'s gifts of the last `GOODWILL.turns` turns, all told, leave `to` a step warmer toward it. Never in saves before version 37 (`noGoodwill`). */
export function goodwill(state: GameState, from: number, to: number): boolean {
  if (state.noGoodwill) return false;
  let share = 0;
  for (const g of state.gifts?.[`${from}>${to}`] ?? []) if (state.turn - g.turn < GOODWILL.turns) share += g.share;
  return share >= GOODWILL.share;
}

// ---- pacts and alliances (since save version 41) ------------------------------------

/** The turn `a` and `b`'s non-aggression pact runs out, while it stands. */
export function pactUntil(state: GameState, a: number, b: number): number | undefined {
  const until = state.pacts?.[key(a, b)];
  return until !== undefined && state.turn < until ? until : undefined;
}

/** Have `a` and `b` a non-aggression pact standing? */
export function hasPact(state: GameState, a: number, b: number): boolean {
  return pactUntil(state, a, b) !== undefined;
}

/** `a` and `b` sign a non-aggression pact: neither may declare war on the other for `PACTS.pactTurns`. */
export function signPact(state: GameState, a: number, b: number): void {
  if (a === b) return;
  (state.pacts ??= {})[key(a, b)] = state.turn + PACTS.pactTurns;
}

/** At a new turn: the pacts that run out now, gone (each pair once). */
export function endPacts(state: GameState): [number, number][] {
  const out: [number, number][] = [];
  for (const [k, until] of Object.entries(state.pacts ?? {})) {
    if (state.turn < until) continue;
    delete state.pacts![k];
    out.push(k.split(":").map(Number) as [number, number]);
  }
  return out;
}

/** `a` and `b`'s alliance, while its enemy still stands. */
export function alliance(state: GameState, a: number, b: number): Alliance | undefined {
  const al = state.alliances?.[key(a, b)];
  return al && state.players[al.against]?.alive ? al : undefined;
}

/** Are `a` and `b` allies? */
export function allied(state: GameState, a: number, b: number): boolean {
  return a !== b && alliance(state, a, b) !== undefined;
}

/** The civilizations allied with `a` against `enemy`. */
export function alliesAgainst(state: GameState, a: number, enemy: number): number[] {
  return state.players.filter((p) => p.id !== a && alliance(state, a, p.id)?.against === enemy).map((p) => p.id);
}

/** May `a` not declare war on `b`: a pact stands between them, or they are allies? */
export function warBarred(state: GameState, a: number, b: number): "pact" | "allied" | null {
  return allied(state, a, b) ? "allied" : hasPact(state, a, b) ? "pact" : null;
}

/**
 * `a` and `b` ally against `enemy`: a treaty between them if they had none, and the alliance; the caller
 * declares the wars it needs. One alliance a pair: a new one replaces the old.
 */
export function makeAlliance(state: GameState, a: number, b: number, enemy: number): void {
  if (relation(state, a, b) === "contact") setRelation(state, a, b, "peace");
  (state.alliances ??= {})[key(a, b)] = { against: enemy, turn: state.turn };
}

/** `a` makes peace with `enemy`: its alliances against it are over. The allies it leaves. */
export function leaveAlliances(state: GameState, a: number, enemy: number): number[] {
  const left = alliesAgainst(state, a, enemy);
  for (const b of left) delete state.alliances![key(a, b)];
  return left;
}

// ---- peace offers -------------------------------------------------------------------

/** The turn `from` last offered `to` peace, if ever. */
export function peaceOffered(state: GameState, from: number, to: number): number | undefined {
  return state.peaceOffers?.[`${from}>${to}`];
}
