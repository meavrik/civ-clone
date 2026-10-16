/**
 * Colour slots, in this order everywhere. Each civilization has a fixed one,
 * as in the original: civilizations that share a colour are never in the same
 * game (the opponent draw skips a taken colour), so every civ on the map has
 * its own. The barbarians are always red. Pairs are chosen so each premade
 * world can still field seven civilizations: the Middle East's seven natives
 * all differ, and Europe's nine cover eight colours. Each renderer maps a slot
 * to its palette.
 */
export const CIV_COLORS = ["white", "green", "blue", "yellow", "cyan", "magenta", "grey", "orange", "red"] as const;
export type CivColor = (typeof CIV_COLORS)[number];

export function colorSlot(color: CivColor): number {
  return CIV_COLORS.indexOf(color);
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
}

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
  { id: "barbarians", name: "Barbarians", adjective: "Barbarian", leader: "Attila", color: "red", cities: [] },
];

export const CIV_BY_ID: Record<string, CivRule> = Object.fromEntries(CIVS.map((c) => [c.id, c]));

export function civ(id: string): CivRule {
  const c = CIV_BY_ID[id];
  if (!c) throw new Error(`unknown civ ${id}`);
  return c;
}
