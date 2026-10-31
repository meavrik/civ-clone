import { atWar, goldScale, hasContact } from "./diplomacy.js";
import { researchCostFor } from "./levels.js";
import { advancesFor } from "./rules/advances.js";
import { GIFT_WORTH } from "./rules/diplomacy.js";
import { addTrade, whyNoTrade } from "./resources.js";
import type { DealSide, GameState, ResourceTrade } from "./types.js";

/**
 * Exchanges (asked for 2026-10-31: "add exchange as a inner new section. were you can exchange several things with one
 * another - gold, techs and resources. resources given could provide a steady income (+sum each turn) for a civ"; since
 * save version 51): two civilizations hand each other gold, advances and strategic resources at once (the `exchange`
 * command), and a side receiving resources may pay gold a turn for them, for as long as each trade stands
 * (`ResourceTrade.pay`, paid as the payer's turn begins, `payTrades`). Whether a computer leader agrees is the AI's
 * (`exchangeAnswer`); the rules only check that each side has what it gives.
 */

/** At most this much gold a turn on one side of an exchange. */
export const MAX_PER_TURN = 50;

/** What an advance is worth to `to`, in gold: the beakers of its next advance (`GIFT_WORTH.perBeaker`). */
export function advanceWorth(state: GameState, to: number): number {
  return Math.round(researchCostFor(state, to) * GIFT_WORTH.perBeaker);
}

/** What a strategic resource is worth to `to`, in gold: a share of what gold is worth to it (`GIFT_WORTH.resource`). */
export function resourceWorth(state: GameState, to: number): number {
  return Math.round(goldScale(state, to) * GIFT_WORTH.resource);
}

/** Whether a side of an exchange holds nothing. */
export function emptySide(side: DealSide): boolean {
  return !side.gold && !side.perTurn && !side.advances?.length && !side.resources?.length;
}

/** Why `from` cannot hand `to` its side of an exchange, or null. */
function whyNoSide(state: GameState, from: number, to: number, side: DealSide, other: DealSide): string | null {
  const giver = state.players[from]!;
  const taker = state.players[to]!;
  const whole = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n >= 0);
  if (!whole(side.gold) || !whole(side.perTurn)) return "bad amount";
  if ((side.gold ?? 0) > giver.gold) return "not enough gold";
  if ((side.perTurn ?? 0) > MAX_PER_TURN) return "too much a turn";
  // Gold a turn pays for the resources the other side gives.
  if (side.perTurn && !other.resources?.length) return "nothing to pay for";
  const advances = side.advances ?? [];
  if (new Set(advances).size !== advances.length) return "an advance twice";
  const tree = advancesFor(state);
  for (const a of advances) {
    if (!tree.some((t) => t.id === a) || !giver.advances.includes(a)) return `no ${a} to give`;
    if (taker.advances.includes(a)) return `they know ${a}`;
  }
  const resources = side.resources ?? [];
  if (new Set(resources).size !== resources.length) return "a resource twice";
  for (const r of resources) {
    const why = whyNoTrade(state, from, to, r);
    if (why) return why;
  }
  return null;
}

/** Why `me` and `them` cannot exchange `give` (from `me`) for `take` (from `them`), or null when they may. */
export function whyNoExchange(state: GameState, me: number, them: number, give: DealSide, take: DealSide): string | null {
  const a = state.players[me];
  const b = state.players[them];
  if (!a || !b || me === them || !a.alive || !b.alive || me === state.barbarians || them === state.barbarians) return "no one to trade with";
  if (!hasContact(state, me, them)) return "no contact";
  if (atWar(state, me, them)) return "at war";
  if (emptySide(give) && emptySide(take)) return "nothing to trade";
  return whyNoSide(state, me, them, give, take) ?? whyNoSide(state, them, me, take, give);
}

/** Hand over each side of an exchange (checked first with `whyNoExchange`); `learn` grants an advance to its receiver. */
export function applyExchange(state: GameState, me: number, them: number, give: DealSide, take: DealSide, learn: (player: number, advance: string) => void): void {
  const hand = (from: number, to: number, side: DealSide, other: DealSide) => {
    const gold = side.gold ?? 0;
    state.players[from]!.gold -= gold;
    state.players[to]!.gold += gold;
    for (const a of side.advances ?? []) learn(to, a);
    // Each resource a lasting trade, the other side's gold a turn shared among them (the first takes what is left over).
    const trades: ResourceTrade[] = (side.resources ?? []).map((r) => addTrade(state, from, to, r));
    const pay = other.perTurn ?? 0;
    if (pay && trades.length) {
      const each = Math.floor(pay / trades.length);
      trades.forEach((t, i) => {
        const share = each + (i === 0 ? pay - each * trades.length : 0);
        if (share > 0) t.pay = share;
      });
    }
  };
  hand(me, them, give, take);
  hand(them, me, take, give);
}

/**
 * As `player`'s turn begins it pays for the resources it receives by the turn (`ResourceTrade.pay`); a trade it
 * cannot pay for ends. The trades ended, with the side that could not keep them.
 */
export function payTrades(state: GameState, player: number): ResourceTrade[] {
  const trades = state.resourceTrades;
  if (!trades?.length) return [];
  const ended: ResourceTrade[] = [];
  const payer = state.players[player]!;
  for (const t of [...trades]) {
    if (t.b !== player || !t.pay) continue;
    if (payer.gold >= t.pay) {
      payer.gold -= t.pay;
      state.players[t.a]!.gold += t.pay;
    } else {
      trades.splice(trades.indexOf(t), 1);
      ended.push(t);
    }
  }
  return ended;
}

/** The gold `player` gains (or, below nought, pays) a turn by its resource trades. */
export function tradeIncome(state: GameState, player: number): number {
  let gold = 0;
  for (const t of state.resourceTrades ?? []) {
    if (!t.pay) continue;
    if (t.a === player) gold += t.pay;
    if (t.b === player) gold -= t.pay;
  }
  return gold;
}
