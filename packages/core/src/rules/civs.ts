/**
 * Colour slots, in this order everywhere. Each civilization has a fixed one,
 * as in the original: civilizations that share a colour are never in the same
 * game (the opponent draw skips a taken colour), so every civ on the map has
 * its own. The barbarians are always red. Each renderer maps a slot to its palette.
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
  { id: "barbarians", name: "Barbarians", adjective: "Barbarian", leader: "Attila", color: "red", cities: [] },
];

export const CIV_BY_ID: Record<string, CivRule> = Object.fromEntries(CIVS.map((c) => [c.id, c]));

export function civ(id: string): CivRule {
  const c = CIV_BY_ID[id];
  if (!c) throw new Error(`unknown civ ${id}`);
  return c;
}
