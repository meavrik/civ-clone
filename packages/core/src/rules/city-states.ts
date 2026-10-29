/**
 * City-states (asked for 2026-10-29: "generate ~30 single city-states civs ... randomize and placed in the start
 * of the game to encounter the real civs. no diplomacy or leader to talk to. always aggressive - player could only
 * conquer them or pay tribute ... only produce war units to attack occasionally"; "make sure on a start of a new game,
 * no civs gets to be alone on a mass of land"). Each is one city of a people of history not among the
 * civilizations, held by the barbarians' seat (always at war, never met or talked to), named for itself.
 */
export interface CityStateRule {
  id: string;
  /** The city's name, and the city-state's. */
  name: string;
  /** Its people, for the words: "Tyre, a city of the Phoenicians". */
  people: string;
}

export const CITY_STATES: readonly CityStateRule[] = [
  { id: "knossos", name: "Knossos", people: "Minoans" },
  { id: "mycenae", name: "Mycenae", people: "Mycenaeans" },
  { id: "troy", name: "Troy", people: "Trojans" },
  { id: "tyre", name: "Tyre", people: "Phoenicians" },
  { id: "sidon", name: "Sidon", people: "Phoenicians" },
  { id: "carthage", name: "Carthage", people: "Carthaginians" },
  { id: "ugarit", name: "Ugarit", people: "Canaanites" },
  { id: "nineveh", name: "Nineveh", people: "Assyrians" },
  { id: "damascus", name: "Damascus", people: "Arameans" },
  { id: "petra", name: "Petra", people: "Nabataeans" },
  { id: "palmyra", name: "Palmyra", people: "Palmyrenes" },
  { id: "byzantium", name: "Byzantium", people: "Byzantines" },
  { id: "veii", name: "Veii", people: "Etruscans" },
  { id: "axum", name: "Axum", people: "Aksumites" },
  { id: "meroe", name: "Meroe", people: "Kushites" },
  { id: "zimbabwe", name: "Zimbabwe", people: "Shona" },
  { id: "timbuktu", name: "Timbuktu", people: "Malians" },
  { id: "kilwa", name: "Kilwa", people: "Swahili" },
  { id: "mohenjo_daro", name: "Mohenjo-daro", people: "Harappans" },
  { id: "angkor", name: "Angkor", people: "Khmer" },
  { id: "pagan", name: "Pagan", people: "Burmese" },
  { id: "malacca", name: "Malacca", people: "Malays" },
  { id: "cuzco", name: "Cuzco", people: "Inca" },
  { id: "tiwanaku", name: "Tiwanaku", people: "Andeans" },
  { id: "tikal", name: "Tikal", people: "Maya" },
  { id: "palenque", name: "Palenque", people: "Maya" },
  { id: "cahokia", name: "Cahokia", people: "Mississippians" },
  { id: "venice", name: "Venice", people: "Venetians" },
  { id: "genoa", name: "Genoa", people: "Genoese" },
  { id: "ragusa", name: "Ragusa", people: "Ragusans" },
];

export const CITY_STATE_BY_ID: Readonly<Record<string, CityStateRule>> = Object.fromEntries(CITY_STATES.map((c) => [c.id, c]));

export function cityStateRule(id: string): CityStateRule {
  const r = CITY_STATE_BY_ID[id];
  if (!r) throw new Error(`unknown city-state ${id}`);
  return r;
}

/** The numbers city-states live by. */
export const CITY_STATE = {
  /** How many a game places on the original's 80-square-wide world; bigger worlds more, by width. */
  perGame: 8,
  /** Citizens at the start. */
  size: 2,
  /** A civilization alone on its land gets a city-state this far from its start (squares, either way)... */
  nearMin: 6,
  nearMax: 10,
  /** ...widened to this, when nothing fits nearer. */
  nearLimit: 14,
  /** The others stand this far from every start, and no further from the nearest than `farMax`. */
  farMin: 8,
  farMax: 16,
  /** No two city-states closer than this. */
  apart: 6,
  /** Soldiers each keeps home, fortified. */
  garrison: 2,
  /** Soldiers beyond the garrison it gathers before it sets out. */
  raid: 2,
  /** No raid before this turn (3400 BC): the civilizations found their first cities in peace. */
  grace: 30,
  /** A raid goes for the nearest city of a civilization this far off at most, on its own land. */
  reach: 12,
  /** Turns of peace tribute buys from one city-state. */
  peaceTurns: 20,
  /** Tribute's price: this share of what gold is worth to the payer (`goldScale`), in tens, at least `minPrice`. */
  price: 0.4,
  minPrice: 30,
} as const;
