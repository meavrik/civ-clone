import type { WorkKind } from "../types.js";
import { CIV_PLACES, type CivPlaces } from "./civ-places.js";
import type { UnitDomain } from "./units.js";

/**
 * Colour slots, in this order everywhere. Each civilization has a fixed one,
 * as in the original: civilizations that share a colour are never in the same
 * game (the opponent draw skips a taken colour), so every civ on the map has
 * its own. The barbarians are always red. Pairs are chosen so each premade
 * world can still field seven civilizations: the Middle East's eight natives
 * all differ, and Europe's nine cover eight colours. Each renderer maps a slot
 * to its palette.
 */
export const CIV_COLORS = ["white", "green", "blue", "yellow", "cyan", "magenta", "grey", "orange", "red"] as const;
export type CivColor = (typeof CIV_COLORS)[number];

export function colorSlot(color: CivColor): number {
  return CIV_COLORS.indexOf(color);
}

/**
 * What a civilization's trait does. Each kind is applied in one place in the
 * engine; `pct` values are percentages added to (or, negative, taken from)
 * the base.
 */
export type TraitEffect =
  /** Settlers finish these jobs in half the turns. */
  | { kind: "fastWork"; work: WorkKind[] }
  /** Production costs: every wonder, these buildings or units, or every soldier (a land unit that can attack). */
  | { kind: "cost"; pct: number; wonders?: true; buildings?: string[]; units?: string[]; soldiers?: true }
  | { kind: "sciencePct"; pct: number }
  | { kind: "taxPct"; pct: number }
  /** Trade lost to corruption. */
  | { kind: "corruptionPct"; pct: number }
  /** More unhappy citizens made content in every city. */
  | { kind: "content"; amount: number }
  /** Share of the food box a city keeps when it grows (a granary keeps half; the better one counts). */
  | { kind: "growth"; keep: number }
  /** Size of the food box a city must fill to grow. */
  | { kind: "foodBoxPct"; pct: number }
  /** New units of these types, or of this domain, come out veterans; `who` names the types in a word or two. */
  | { kind: "veteran"; units?: string[]; domain?: UnitDomain; who?: string }
  /** More movement for units of these types or this domain, in whole squares; `who` names the types. */
  | { kind: "moves"; amount: number; units?: string[]; domain?: UnitDomain; who?: string }
  /** A revolution's anarchy lasts at most this many turns. */
  | { kind: "anarchy"; turns: number }
  /** Villages never hide barbarians and give twice the gold. */
  | { kind: "friendlyVillages" };

/** A civilization's own strengths: a named ability and an advance it begins with. Our departure: the original's civilizations were all alike. */
export interface CivTrait {
  name: string;
  /** A few words for the tribe choice. */
  short: string;
  /** One line for the reports and the opening message. */
  text: string;
  /** Known from the first turn (an advance with no prerequisites). */
  start: string;
  effects: TraitEffect[];
}

/** Playable civilizations: historical nations with a short list of their historical cities. */
export interface CivRule {
  id: string;
  name: string;
  adjective: string;
  leader: string;
  /** Colour of its units and cities; civilizations sharing one never meet in a game. */
  color: CivColor;
  cities: string[];
  /** Absent only for the barbarians. */
  trait?: CivTrait;
  /** The people in a sentence of our own, for the window a new game opens with. Absent only for the barbarians. */
  text?: string;
  /** Its own names for the places it finds first on a generated world (`CIV_PLACES`). Absent only for the barbarians. */
  places?: CivPlaces;
  /** Save version that brought it in: older saves drew their rivals without it (`NewGameOptions.roster`). */
  since?: number;
}

const FOOT = ["militia", "phalanx", "legion", "musketeers", "riflemen", "mech_inf"];
const MOUNTED = ["cavalry", "chariot", "knights"];

/** Each playable civilization's trait, by id. */
const TRAITS: Record<string, CivTrait> = {
  romans: { name: "Roads of Empire", short: "Fast roads", text: "Settlers build roads and railroads in half the time.", start: "bronze_working", effects: [{ kind: "fastWork", work: ["road", "railroad"] }] },
  babylonians: { name: "House of Tablets", short: "Cheap libraries", text: "Libraries and universities cost a third less.", start: "alphabet", effects: [{ kind: "cost", pct: -33, buildings: ["library", "university"] }] },
  egyptians: { name: "Pyramid Builders", short: "Cheaper wonders", text: "Wonders cost a fifth less.", start: "masonry", effects: [{ kind: "cost", pct: -20, wonders: true }] },
  greeks: { name: "Academies", short: "+25% science", text: "A quarter more science in every city.", start: "alphabet", effects: [{ kind: "sciencePct", pct: 25 }] },
  chinese: { name: "Granaries of the Realm", short: "Growth keeps food", text: "A growing city keeps a third of its food.", start: "pottery", effects: [{ kind: "growth", keep: 1 / 3 }] },
  indians: { name: "Peaceful Hearts", short: "+1 content", text: "One more content citizen in every city.", start: "ceremonial_burial", effects: [{ kind: "content", amount: 1 }] },
  aztecs: { name: "Floating Gardens", short: "Fast growth", text: "Cities need a fifth less food to grow.", start: "ceremonial_burial", effects: [{ kind: "foodBoxPct", pct: -20 }] },
  zulus: { name: "Impi", short: "Veteran infantry", text: "Foot soldiers are trained as veterans.", start: "bronze_working", effects: [{ kind: "veteran", units: FOOT, who: "Foot soldiers" }] },
  germans: { name: "Diligent Farmers", short: "Fast mines, farms", text: "Settlers mine and irrigate in half the time.", start: "masonry", effects: [{ kind: "fastWork", work: ["mine", "irrigate"] }] },
  americans: { name: "Constitution", short: "Short anarchy", text: "A revolution brings one turn of anarchy at most.", start: "the_wheel", effects: [{ kind: "anarchy", turns: 1 }] },
  russians: { name: "Vast Lands", short: "Half corruption", text: "Corruption takes half as much trade.", start: "horseback_riding", effects: [{ kind: "corruptionPct", pct: -50 }] },
  french: { name: "Cathedral Masons", short: "Cheap temples", text: "Temples, cathedrals and colosseums cost half.", start: "ceremonial_burial", effects: [{ kind: "cost", pct: -50, buildings: ["temple", "cathedral", "colosseum"] }] },
  english: { name: "Rule the Waves", short: "Faster ships", text: "Ships move one square further.", start: "alphabet", effects: [{ kind: "moves", amount: 1, domain: "sea" }] },
  mongols: { name: "Horse Lords", short: "Faster horsemen", text: "Mounted units move one square further.", start: "horseback_riding", effects: [{ kind: "moves", amount: 1, units: MOUNTED, who: "Mounted units" }] },
  spanish: { name: "Conquistadors", short: "Friendly villages", text: "Villages never hide barbarians and give twice the gold.", start: "horseback_riding", effects: [{ kind: "friendlyVillages" }] },
  vikings: { name: "Longships", short: "Veteran ships", text: "Ships are built as veterans.", start: "bronze_working", effects: [{ kind: "veteran", domain: "sea" }] },
  hittites: { name: "Iron and Chariots", short: "Cheap soldiers", text: "Soldiers cost a fifth less.", start: "the_wheel", effects: [{ kind: "cost", pct: -20, soldiers: true }] },
  persians: { name: "Satrapies", short: "+25% tax", text: "A quarter more tax in every city.", start: "pottery", effects: [{ kind: "taxPct", pct: 25 }] },
  hebrews: { name: "Exodus", short: "Faster settlers", text: "Settlers move one square further.", start: "ceremonial_burial", effects: [{ kind: "moves", amount: 1, units: ["settlers"], who: "Settlers" }] },
  japanese: { name: "Bushido", short: "Veteran horsemen", text: "Mounted units are trained as veterans.", start: "bronze_working", effects: [{ kind: "veteran", units: MOUNTED, who: "Mounted units" }] },
};

/** Each playable civilization in a sentence, by id: our own words, for the opening window. */
const TEXTS: Record<string, string> = {
  romans: "From a city of seven hills the Romans spread their law, their legions and their paved roads across the known world.",
  babylonians: "Between two great rivers the Babylonians wrote the first laws on clay and charted the wandering stars.",
  egyptians: "On the banks of the Nile the Egyptians raise tombs and temples meant to outlast time itself.",
  greeks: "Sailors, thinkers and athletes, the Greeks fill their city-states with schools, theatres and debate.",
  chinese: "Along their great rivers the Chinese farm, store grain against famine and keep a realm that endures.",
  indians: "In the lands of the Indus and the Ganges the Indians seek wisdom in patience, learning and peace.",
  aztecs: "On a lake in a high valley the Aztecs grow food on floating fields and raise a shining city.",
  zulus: "Herders of cattle and fearless fighters, the Zulus train every young man for the battle line.",
  germans: "Tribes of the deep forests, the Germans clear the land and work its fields and mines without rest.",
  americans: "A young nation of settlers, the Americans govern themselves by a written constitution.",
  russians: "Masters of endless forest and steppe, the Russians hold together lands too vast to cross.",
  french: "Heirs of the Franks, the French raise churches of stone and coloured glass toward the sky.",
  english: "An island people, the English look to the sea for their trade, their defence and new lands.",
  mongols: "Born in the saddle, the Mongols ride across the steppe faster than word of their coming.",
  spanish: "Proud and restless, the Spanish venture into unknown lands and seas in search of gold.",
  vikings: "Raiders and traders of the north, the Vikings sail their longships wherever water runs.",
  hittites: "Lords of the high plateau, the Hittites forge iron and drive the swiftest chariots of their age.",
  persians: "Rulers of many peoples, the Persians govern their wide provinces through loyal satraps.",
  hebrews: "A wandering people bound by one faith, the Hebrews journey in search of a promised land.",
  japanese: "An island people of the rising sun, the Japanese hold honour, discipline and the sword dear.",
};

export const CIVS: CivRule[] = [
  { id: "romans", name: "Romans", adjective: "Roman", leader: "Caesar", color: "white", cities: ["Rome", "Capua", "Ravenna", "Pompeii", "Neapolis", "Brundisium", "Syracuse", "Verona"] },
  { id: "babylonians", name: "Babylonians", adjective: "Babylonian", leader: "Hammurabi", color: "green", cities: ["Babylon", "Ur", "Nippur", "Uruk", "Eridu", "Lagash", "Kish", "Sippar"] },
  { id: "egyptians", name: "Egyptians", adjective: "Egyptian", leader: "Ramesses", color: "yellow", cities: ["Thebes", "Memphis", "Heliopolis", "Abydos", "Elephantine", "Giza", "Tanis", "Buto"] },
  { id: "greeks", name: "Greeks", adjective: "Greek", leader: "Alexander", color: "magenta", cities: ["Athens", "Sparta", "Corinth", "Thebes", "Argos", "Delphi", "Rhodes", "Miletus"] },
  { id: "chinese", name: "Chinese", adjective: "Chinese", leader: "Qin Shi Huang", color: "cyan", cities: ["Xianyang", "Luoyang", "Chengdu", "Hangzhou", "Nanjing", "Kaifeng", "Guangzhou", "Xi'an"] },
  { id: "indians", name: "Indians", adjective: "Indian", leader: "Ashoka", color: "grey", cities: ["Pataliputra", "Delhi", "Varanasi", "Ujjain", "Mathura", "Taxila", "Madurai", "Kanchi"] },
  { id: "aztecs", name: "Aztecs", adjective: "Aztec", leader: "Montezuma", color: "orange", cities: ["Tenochtitlan", "Texcoco", "Tlacopan", "Tlaxcala", "Cholula", "Xochimilco", "Tula", "Teotihuacan"] },
  { id: "zulus", name: "Zulus", adjective: "Zulu", leader: "Shaka", color: "green", cities: ["Ulundi", "Bulawayo", "Hlobane", "Isandlwana", "Mgungundlovu", "Nongoma", "Eshowe", "Zungeni"] },
  { id: "germans", name: "Germans", adjective: "German", leader: "Otto", color: "blue", cities: ["Berlin", "Aachen", "Hamburg", "Cologne", "Frankfurt", "Munich", "Leipzig", "Nuremberg"] },
  { id: "americans", name: "Americans", adjective: "American", leader: "Washington", color: "magenta", cities: ["Washington", "Philadelphia", "Boston", "New York", "Baltimore", "Charleston", "Richmond", "Albany"] },
  { id: "russians", name: "Russians", adjective: "Russian", leader: "Peter", color: "white", cities: ["Moscow", "Novgorod", "Kiev", "Vladimir", "Smolensk", "Tver", "Pskov", "Kazan"] },
  { id: "french", name: "French", adjective: "French", leader: "Charlemagne", color: "cyan", cities: ["Paris", "Orleans", "Reims", "Lyon", "Tours", "Rouen", "Bordeaux", "Marseille"] },
  { id: "english", name: "English", adjective: "English", leader: "Elizabeth", color: "green", cities: ["London", "York", "Winchester", "Canterbury", "Bristol", "Oxford", "Norwich", "Nottingham"] },
  { id: "mongols", name: "Mongols", adjective: "Mongol", leader: "Genghis Khan", color: "cyan", cities: ["Karakorum", "Samarkand", "Bukhara", "Khanbaliq", "Kashgar", "Otrar", "Sarai", "Tabriz"] },
  { id: "spanish", name: "Spanish", adjective: "Spanish", leader: "Isabella", color: "yellow", cities: ["Toledo", "Madrid", "Seville", "Cordoba", "Barcelona", "Valencia", "Granada", "Salamanca"] },
  { id: "vikings", name: "Vikings", adjective: "Viking", leader: "Harald", color: "grey", cities: ["Trondheim", "Uppsala", "Roskilde", "Bergen", "Birka", "Hedeby", "Kaupang", "Ribe"] },
  { id: "hittites", name: "Hittites", adjective: "Hittite", leader: "Suppiluliuma", color: "orange", cities: ["Hattusa", "Kanesh", "Carchemish", "Kussara", "Sapinuwa", "Nerik", "Arinna", "Tarsus"] },
  { id: "persians", name: "Persians", adjective: "Persian", leader: "Cyrus", color: "blue", cities: ["Persepolis", "Pasargadae", "Susa", "Ecbatana", "Rhagae", "Bactra", "Hecatompylos", "Arbela"] },
  { id: "hebrews", name: "Hebrews", adjective: "Hebrew", leader: "David", color: "white", cities: ["Jerusalem", "Hebron", "Shiloh", "Shechem", "Bethel", "Samaria", "Megiddo", "Jericho"], since: 11 },
  { id: "japanese", name: "Japanese", adjective: "Japanese", leader: "Tokugawa", color: "orange", cities: ["Kyoto", "Edo", "Osaka", "Nara", "Kamakura", "Nagoya", "Sendai", "Hakata"], since: 11 },
  { id: "barbarians", name: "Barbarians", adjective: "Barbarian", leader: "Attila", color: "red", cities: [] },
];

for (const c of CIVS) {
  const t = TRAITS[c.id];
  if (t) c.trait = t;
  const text = TEXTS[c.id];
  if (text) c.text = text;
  const places = CIV_PLACES[c.id];
  if (places) c.places = places;
}

export const CIV_BY_ID: Record<string, CivRule> = Object.fromEntries(CIVS.map((c) => [c.id, c]));

export function civ(id: string): CivRule {
  const c = CIV_BY_ID[id];
  if (!c) throw new Error(`unknown civ ${id}`);
  return c;
}
