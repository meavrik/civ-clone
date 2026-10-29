import { building, computeCity, type CityTurnEvent, type GameState } from "@civ/core";

/**
 * The treasury's outlook (asked for 2026-10-29: "show a message/notification when going to run out of money",
 * "on the left pane menu - show the gold/money added/removed each turn"): what the cities bring in and pay out
 * a turn, and how long the gold lasts at that. Since save version 42 a treasury that cannot meet a turn's upkeep
 * stops supporting buildings until the books balance (core `balanceTreasury`); before, a city sold one.
 */
export interface TreasuryOutlook {
  /** Gold in the treasury now. */
  gold: number;
  /** Taxes a turn, and the buildings' upkeep a turn. */
  tax: number;
  upkeep: number;
  /** What the treasury gains a turn (less than 0: loses). */
  net: number;
  /** The turn's end at which the upkeep can no longer be met at this rate (1: this one); null while the gold holds. */
  dryIn: number | null;
}

/** The treasury of `player` as its turn stands: taxes, upkeep and how many turns the gold lasts. */
export function treasuryOutlook(state: GameState, player: number): TreasuryOutlook {
  let tax = 0;
  let upkeep = 0;
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    const r = computeCity(state, c);
    tax += r.tax;
    upkeep += r.buildingUpkeep;
  }
  const gold = state.players[player]?.gold ?? 0;
  const net = tax - upkeep;
  // After k turns' ends the treasury holds gold + k * net: the first k that leaves it short.
  const dryIn = net >= 0 ? (gold < 0 ? 1 : null) : gold < 0 ? 1 : Math.floor(gold / -net) + 1;
  return { gold, tax, upkeep, net, dryIn };
}

/** How many turns ahead the player hears that the gold is running out. */
export const DRY_WARNING_TURNS = 3;

/** The warning that the treasury runs dry within `DRY_WARNING_TURNS`: its words and the turn it runs dry at (`dryAt`, the web app's once-only key). */
export interface TreasuryWarning {
  title: string;
  lines: string[];
  dryAt: number;
}

/** What a dry treasury leads to, by the save's rules. */
function whatFollows(state: GameState): string {
  return state.sellWhenBroke ? "a city sells a building to pay." : "buildings stop being supported until the books balance.";
}

/** A warning when `player`'s gold runs out within `DRY_WARNING_TURNS` turns at this rate; null while it holds longer. */
export function treasuryWarning(state: GameState, player: number): TreasuryWarning | null {
  const t = treasuryOutlook(state, player);
  if (t.dryIn === null || t.dryIn > DRY_WARNING_TURNS) return null;
  const books = `{coin}${t.tax} in, {purse}${t.upkeep} out`;
  const lines = t.dryIn === 1
    ? [`Our ${t.gold} gold cannot pay this turn's upkeep: ${books}.`, `As the turn ends, ${whatFollows(state)}`]
    : [`Our ${t.gold} gold runs out in ${t.dryIn} turns: ${books} a turn.`, `Then ${whatFollows(state)}`];
  lines.push("Raise taxes, or stop supporting a building.");
  return { title: "Treasury Running Dry", lines, dryAt: state.turn + t.dryIn - 1 };
}

/** How many cities the notice of buildings stopped names before it sums up the rest. */
const NOTICE_CITIES = 5;

/**
 * The notice of buildings a dry treasury stopped supporting (core's "unsupported" city events): each city with
 * what it stopped and the gold a turn that saves, the upkeep cut in all, and how the books stand now.
 */
export function unsupportedNotice(state: GameState, events: CityTurnEvent[], player: number): { title: string; lines: string[] } {
  const byCity = new Map<number, CityTurnEvent[]>();
  for (const e of events) if (e.kind === "unsupported") byCity.set(e.city, [...(byCity.get(e.city) ?? []), e]);
  const upkeep = (e: CityTurnEvent): number => e.upkeep ?? (e.building ? building(e.building).upkeep : 0);
  const total = [...byCity.values()].flat().reduce((n, e) => n + upkeep(e), 0);
  const lines = ["Our treasury is empty. To pay the upkeep, these buildings are no longer supported:"];
  const cities = [...byCity.entries()];
  for (const [id, evs] of cities.slice(0, NOTICE_CITIES)) {
    const name = state.cities.find((c) => c.id === id)?.name ?? "A city";
    const names = evs.map((e) => e.detail ?? "");
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    lines.push(`{city}${name}: ${list}, -${evs.reduce((n, e) => n + upkeep(e), 0)}{purse}`);
  }
  const rest = cities.slice(NOTICE_CITIES);
  if (rest.length) {
    const count = rest.reduce((n, [, evs]) => n + evs.length, 0);
    lines.push(`{city}${count} more in ${rest.length} ${rest.length === 1 ? "city" : "cities"}, -${rest.reduce((n, [, evs]) => n + evs.reduce((m, e) => m + upkeep(e), 0), 0)}{purse}`);
  }
  const net = treasuryOutlook(state, player).net;
  const now = net > 0 ? `the treasury now gains ${net} a turn` : net === 0 ? "the books now balance" : `the treasury still loses ${-net} a turn`;
  lines.push(`Upkeep cut by ${total} gold a turn: ${now}.`);
  lines.push("A city's Improvements list supports them again (Use).");
  return { title: "Buildings Unsupported", lines };
}
