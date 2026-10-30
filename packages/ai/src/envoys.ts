import { applyCommand, atWar, canExport, hasContact, hasResource, mayTrade, nextInt, RESOURCES, temperToward, whyNoTrade, type GameState, type Player } from "@civ/core";
import { attitude, resourcePrice, spareResources, strength, wantsResource } from "./planner.js";

/**
 * What a computer leader asks of a human player, or gives them (asked for 2026-10-27: "let computer leaders
 * use the new diplomacy on you"): a leader far the stronger demands tribute, a friendly one with gold to
 * spare sends a gift, and one that lacks a strategic resource the player can spare asks for it, for one of
 * its own or for gold. The player answers in an audience (core's `answer`); a refused demand is a grievance
 * (`attitude`) and may bring war from the asker. Toward human players only, so all-AI games are unchanged;
 * never in saves before version 38 (`quietLeaders`). How strong a leader must be to demand, how often it does,
 * how much and how often a refusal means war go by the player's level (`TemperRule`, since save version 47;
 * Prince's are the numbers before: three times the strength, 10% a turn, a quarter to half, war half the time).
 */
export const ENVOYS = {
  /** A demand for tribute: from a leader at least `TemperRule.tributeRatio` times the player's strength, not friendly, with an army of at least `tributeArmy`... */
  tributeArmy: 8,
  /** ...when the player holds this much gold, at most every `tributeGap` turns, `TemperRule.tributeChance` percent a turn. */
  tributeFloor: 30,
  tributeGap: 20,
  /** The most of the player's treasury a demand asks, whatever the level. */
  tributeMost: 0.75,
  /** A refused demand is a grievance this many turns; the asker, still that much the stronger, goes to war `TemperRule.refusalWar` percent of the time. */
  grudgeTurns: 20,
  /** A gift: from a friendly leader holding `giftFloor` gold and 10 more a city, a tenth of it (at least 20), every `giftGap` turns at most, `giftChance` percent a turn. */
  giftFloor: 150,
  giftShare: 0.1,
  giftGap: 20,
  giftChance: 4,
  /** A request for a resource: every `askGap` turns at most, `askChance` percent a turn. */
  askGap: 15,
  askChance: 10,
} as const;

/** Each human player `me` has met and is not at war with: one word at most a turn at their court, whoever speaks. */
export function courtPlayers(state: GameState, me: number): void {
  if (state.quietLeaders) return;
  for (const o of state.players) {
    if (o.isAi || !o.alive || o.id === me || o.id === state.barbarians || !hasContact(state, me, o.id) || atWar(state, me, o.id)) continue;
    // A demand refused this very round: a leader still far the stronger may take it by force.
    const temper = temperToward(state, o.id);
    if (state.refusals?.[`${o.id}>${me}`] === state.turn && temper.tributeRatio !== null && strength(state, me) >= strength(state, o.id) * temper.tributeRatio) {
      if (nextInt(state.rng, 100) < temper.refusalWar) applyCommand(state, { type: "declareWar", player: o.id, reason: "tribute" });
      continue;
    }
    if (spokenTo(state, o.id)) continue;
    if (demandTribute(state, me, o) || askResource(state, me, o)) continue;
    sendGift(state, me, o);
  }
}

/** Has any leader already demanded, asked, given or offered peace at `player`'s court this turn? */
function spokenTo(state: GameState, player: number): boolean {
  const to = `>${player}`;
  for (const [k, p] of Object.entries(state.proposals ?? {})) if (k.endsWith(to) && p.turn === state.turn) return true;
  for (const [k, turn] of Object.entries(state.peaceOffers ?? {})) if (k.endsWith(to) && turn === state.turn) return true;
  for (const [k, gifts] of Object.entries(state.gifts ?? {})) if (k.endsWith(to) && gifts.some((g) => g.turn === state.turn)) return true;
  return false;
}

/** Did `me` ask `player` this kind of thing within `gap` turns? */
function askedWithin(state: GameState, me: number, player: number, kind: "tribute" | "resource", gap: number): boolean {
  const last = state.asked?.[`${me}>${player}>${kind}`];
  return last !== undefined && state.turn - last < gap;
}

/**
 * A leader far the stronger, and not friendly, demands a share of the player's treasury: at Prince a quarter at
 * three times their strength, half at six; the level moves both the strength it takes and the share (`TemperRule`).
 */
function demandTribute(state: GameState, me: number, o: Player): boolean {
  const temper = temperToward(state, o.id);
  if (temper.tributeRatio === null) return false;
  const mine = strength(state, me);
  const theirs = strength(state, o.id);
  if (mine < ENVOYS.tributeArmy || mine < theirs * temper.tributeRatio || o.gold < ENVOYS.tributeFloor || attitude(state, me, o.id) === "friendly") return false;
  const paid = state.tributePaid?.[`${o.id}>${me}`];
  if (askedWithin(state, me, o.id, "tribute", ENVOYS.tributeGap) || (paid !== undefined && state.turn - paid < ENVOYS.tributeGap)) return false;
  if (nextInt(state.rng, 100) >= temper.tributeChance) return false;
  const share = Math.min(ENVOYS.tributeMost, temper.tributeShare * Math.max(0.25, Math.min(0.5, 0.25 + (mine / Math.max(1, theirs) - temper.tributeRatio) / 12)));
  const amount = Math.max(10, Math.floor((o.gold * share) / 10) * 10);
  return applyCommand(state, { type: "demandTribute", player: o.id, amount }).ok;
}

/**
 * A leader lacking a strategic resource it wants, which the player can spare, asks for it: for one of its
 * own spares the player lacks (one the player would use first), else for what it is worth to the player in
 * gold (`resourcePrice`), if it has so much. Not while hostile.
 */
function askResource(state: GameState, me: number, o: Player): boolean {
  if (!mayTrade(state, me, o.id) || attitude(state, me, o.id) === "hostile" || askedWithin(state, me, o.id, "resource", ENVOYS.askGap)) return false;
  const want = RESOURCES.map((r) => r.id).find((id) => !hasResource(state, me, id) && wantsResource(state, me, id) && canExport(state, o.id, id));
  if (!want) return false;
  const spares = spareResources(state, me).filter((id) => !hasResource(state, o.id, id) && !whyNoTrade(state, o.id, me, want, id));
  const give = spares.find((id) => wantsResource(state, o.id, id)) ?? spares[0];
  const gold = resourcePrice(state, o.id);
  if (!give && gold > state.players[me]!.gold) return false;
  if (nextInt(state.rng, 100) >= ENVOYS.askChance) return false;
  return applyCommand(state, { type: "askResource", player: o.id, want, ...(give ? { give } : { gold }) }).ok;
}

/** A friendly leader with gold to spare sends a tenth of its treasury now and then. */
function sendGift(state: GameState, me: number, o: Player): boolean {
  const p = state.players[me]!;
  if (attitude(state, me, o.id) !== "friendly" || p.gold < ENVOYS.giftFloor + 10 * state.cities.filter((c) => c.owner === me).length) return false;
  if ((state.gifts?.[`${me}>${o.id}`] ?? []).some((g) => state.turn - g.turn < ENVOYS.giftGap)) return false;
  if (nextInt(state.rng, 100) >= ENVOYS.giftChance) return false;
  const amount = Math.max(20, Math.floor((p.gold * ENVOYS.giftShare) / 10) * 10);
  return applyCommand(state, { type: "giveGold", player: o.id, amount }).ok;
}
