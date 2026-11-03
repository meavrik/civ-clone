import {
  CITY_STATE, CITY_STATE_BY_ID, demandOn, formatYear, offerPrice, peaceUntil, turnToYear, unitCityState, type City, type GameState, type TurnEvent,
} from "@civ/core";

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

/**
 * The city-state `viewer` sees at square (x, y): its city, on a square they have explored, or a soldier of it standing
 * there in their sight; undefined for anything else.
 */
export function cityStateAt(state: GameState, x: number, y: number, viewer: number): City | undefined {
  const me = state.players[viewer];
  if (!me) return undefined;
  const at = y * state.map.width + x;
  const city = state.cities.find((c) => c.x === x && c.y === y);
  if (city) return city.cityState !== undefined && city.owner === state.barbarians && me.explored[at] ? city : undefined;
  if (!me.visible[at]) return undefined;
  for (const u of state.units) {
    if (u.x !== x || u.y !== y || u.owner !== state.barbarians) continue;
    const home = unitCityState(state, u);
    if (home) return home;
  }
  return undefined;
}

/** The words of a city-state's people: "the Minoans". */
function people(city: City): string {
  const rule = city.cityState !== undefined ? CITY_STATE_BY_ID[city.cityState] : undefined;
  return rule ? `the ${rule.people}` : "a people of its own";
}

/**
 * The note the first time `viewer` comes upon a city-state (asked for 2026-11-03: "when encouter a city-state add a
 * small notification explanation about it"): what it is, what it does, and what can be done about it.
 */
export function cityStateIntro(city: City): { title: string; lines: string[] } {
  return {
    title: `${city.name}, a City-State`,
    lines: [
      `{city}A lone city of ${people(city)}, at war with all.`,
      "{swords}It raids its neighbours unless paid tribute.",
      "{purse}Click it or its soldiers to buy peace, or take it.",
    ],
  };
}

/** The window a click on a city-state's city or soldier opens (`cityStateCard`). */
export interface CityStateCard {
  title: string;
  lines: string[];
  /** Pay, then leave; with too little gold, leave alone; none while its peace holds (the close box). */
  buttons: string[];
  canPay: boolean;
  /** What its peace costs us: its standing demand, else its price (`offerPrice`). */
  price: number;
}

/**
 * What a city-state is to `viewer`, and its peace for sale (asked for 2026-11-03: "allow clicking each city-state
 * unit+city and asking to pay tribute to stop city aggresion"): how we stand with it (left be until a year, a demand
 * standing, or open to its raids), and the gold that buys `CITY_STATE.peaceTurns` of peace.
 */
export function cityStateCard(state: GameState, city: City, viewer: number): CityStateCard {
  const year = (turn: number) => formatYear(turnToYear(turn));
  const until = peaceUntil(state, city.id, viewer);
  const demand = demandOn(state, city.id, viewer);
  const price = offerPrice(state, city.id, viewer);
  const canPay = until === undefined && (state.players[viewer]?.gold ?? 0) >= price;
  const lines = [`{city}A lone city of ${people(city)}, size ${city.size}, at war with all.`];
  if (until !== undefined) lines.push(`{heart}Paid off: it leaves us be until ${year(until)}, unless we strike it.`);
  else {
    lines.push(demand ? `{swords}It demands ${demand.gold} gold of us, or its warriors march.` : "{swords}Its soldiers may strike us at any time.");
    lines.push(`{purse}Pay ${price} gold: it leaves us be until ${year(state.turn + CITY_STATE.peaceTurns)}.`);
    if (!canPay) lines.push("We have not the gold to pay.");
  }
  const buttons = until !== undefined ? [] : canPay ? [`Pay ${price} gold`, "Leave"] : ["Leave"];
  return { title: `${city.name}, a City-State`, lines, buttons, canPay, price };
}
