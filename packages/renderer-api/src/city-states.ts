import { CITY_STATE, CITY_STATE_BY_ID, formatYear, turnToYear, type GameState, type TurnEvent } from "@civ/core";

/** "the city-state of Tyre" (`rules/city-states.ts`), by its rule's id. */
export function cityStateTitle(id: string): string {
  return `the city-state of ${CITY_STATE_BY_ID[id]?.name ?? id}`;
}

/** The window a city-state's demand for tribute opens (asked for 2026-10-29: "player could only conquer them or pay tribute"). */
export interface CityStateDemandCard {
  title: string;
  lines: string[];
  /** The buttons: pay, then refuse; with too little gold, refuse alone. */
  buttons: string[];
  canPay: boolean;
}

/** What a city-state's demand says to `viewer`: who marches where, the price and the peace it buys. */
export function cityStateDemandCard(state: GameState, ev: Extract<TurnEvent, { kind: "cityStateDemand" }>, viewer: number): CityStateDemandCard {
  const city = state.cities.find((c) => c.id === ev.from);
  const rule = city?.cityState !== undefined ? CITY_STATE_BY_ID[city.cityState] : undefined;
  const of = rule ? `, a city of the ${rule.people},` : "";
  const until = formatYear(turnToYear(state.turn + CITY_STATE.peaceTurns));
  const canPay = (state.players[viewer]?.gold ?? 0) >= ev.gold;
  const lines = [
    `{swords}The warriors of ${ev.name}${of} march on ${ev.target ?? "our land"}.`,
    `{purse}Pay ${ev.gold} gold and ${ev.name} leaves us be until ${until}. Refuse, and we fight.`,
  ];
  if (!canPay) lines.push("We have not the gold to pay.");
  return { title: `${ev.name} Demands Tribute`, lines, buttons: canPay ? [`Pay ${ev.gold} gold`, "Refuse"] : ["Refuse"], canPay };
}
