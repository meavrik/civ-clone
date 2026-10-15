/** Playable civilizations: historical nations with a short list of their historical cities. */
export interface CivRule {
  id: string;
  name: string;
  adjective: string;
  leader: string;
  cities: string[];
}

export const CIVS: CivRule[] = [
  { id: "romans", name: "Romans", adjective: "Roman", leader: "Caesar", cities: ["Rome", "Capua", "Ravenna", "Pompeii", "Neapolis", "Brundisium", "Syracuse", "Verona"] },
  { id: "babylonians", name: "Babylonians", adjective: "Babylonian", leader: "Hammurabi", cities: ["Babylon", "Ur", "Nippur", "Uruk", "Eridu", "Lagash", "Kish", "Sippar"] },
  { id: "egyptians", name: "Egyptians", adjective: "Egyptian", leader: "Ramesses", cities: ["Thebes", "Memphis", "Heliopolis", "Abydos", "Elephantine", "Giza", "Tanis", "Buto"] },
  { id: "greeks", name: "Greeks", adjective: "Greek", leader: "Alexander", cities: ["Athens", "Sparta", "Corinth", "Thebes", "Argos", "Delphi", "Rhodes", "Miletus"] },
  { id: "chinese", name: "Chinese", adjective: "Chinese", leader: "Qin Shi Huang", cities: ["Xianyang", "Luoyang", "Chengdu", "Hangzhou", "Nanjing", "Kaifeng", "Guangzhou", "Xi'an"] },
  { id: "indians", name: "Indians", adjective: "Indian", leader: "Ashoka", cities: ["Pataliputra", "Delhi", "Varanasi", "Ujjain", "Mathura", "Taxila", "Madurai", "Kanchi"] },
  { id: "aztecs", name: "Aztecs", adjective: "Aztec", leader: "Montezuma", cities: ["Tenochtitlan", "Texcoco", "Tlacopan", "Tlaxcala", "Cholula", "Xochimilco", "Tula", "Teotihuacan"] },
  { id: "zulus", name: "Zulus", adjective: "Zulu", leader: "Shaka", cities: ["Ulundi", "Bulawayo", "Hlobane", "Isandlwana", "Mgungundlovu", "Nongoma", "Eshowe", "Zungeni"] },
  { id: "barbarians", name: "Barbarians", adjective: "Barbarian", leader: "Attila", cities: [] },
];

export const CIV_BY_ID: Record<string, CivRule> = Object.fromEntries(CIVS.map((c) => [c.id, c]));

export function civ(id: string): CivRule {
  const c = CIV_BY_ID[id];
  if (!c) throw new Error(`unknown civ ${id}`);
  return c;
}
