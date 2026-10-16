import { Terrain } from "@civ/core";
import type { Pt } from "./geo.js";

/**
 * Terrain is picked per square from a weighted mix. The mix comes from the
 * strongest climate zone covering the square (Natural Earth's named deserts,
 * ranges, basins and plains, plus a few zones drawn here), or from the
 * latitude when no zone does. Smooth noise picks within the mix, so forests
 * and hills come in patches rather than salt and pepper.
 */
export type Zone =
  | "ice" | "mountains" | "hills" | "desert" | "arid" | "aridHigh" | "swamp" | "wetForest" | "jungle"
  | "jungleMix" | "tundra" | "boreal" | "steppe" | "savanna" | "prairie" | "meadow" | "green" | "delta"
  | "highland" | "coldHigh" | "medHigh" | "hillyGreen";

type Mix = [Terrain, number][];
const { Grassland: G, Plains: P, Forest: F, Hills: H, Mountains: M, Desert: D, Tundra: T, Arctic: A, Swamp: S, Jungle: J } = Terrain;

export const MIXES: Record<Zone, Mix> = {
  ice: [[A, 100]],
  mountains: [[M, 70], [H, 30]],
  hills: [[H, 70], [F, 10], [P, 10], [M, 10]],
  desert: [[D, 88], [P, 7], [H, 5]],
  arid: [[D, 45], [P, 45], [H, 10]],
  aridHigh: [[D, 35], [P, 30], [H, 30], [M, 5]],
  swamp: [[S, 60], [G, 25], [F, 15]],
  wetForest: [[F, 45], [S, 35], [G, 15], [T, 5]],
  jungle: [[J, 75], [F, 10], [S, 10], [G, 5]],
  jungleMix: [[J, 45], [F, 25], [G, 20], [S, 10]],
  tundra: [[T, 90], [F, 5], [H, 5]],
  boreal: [[F, 55], [T, 15], [S, 10], [G, 10], [H, 10]],
  steppe: [[P, 55], [G, 40], [H, 5]],
  savanna: [[P, 50], [G, 35], [F, 10], [H, 5]],
  prairie: [[G, 55], [P, 35], [F, 10]],
  meadow: [[G, 45], [F, 30], [P, 20], [S, 5]],
  green: [[G, 65], [P, 30], [S, 5]],
  delta: [[G, 55], [S, 35], [P, 10]],
  highland: [[P, 40], [H, 35], [G, 15], [F, 10]],
  coldHigh: [[M, 35], [H, 35], [T, 20], [D, 10]],
  medHigh: [[P, 35], [H, 35], [G, 15], [F, 15]],
  hillyGreen: [[F, 35], [H, 35], [G, 30]],
};

/** Lower wins when several zones cover a square. */
const PRIORITY: Zone[] = [
  "ice", "mountains", "desert", "coldHigh", "hills", "swamp", "delta", "jungle", "tundra", "aridHigh", "arid",
  "wetForest", "jungleMix", "green", "hillyGreen", "medHigh", "highland", "boreal", "steppe", "savanna", "prairie", "meadow",
];
export const ZONE_RANK = new Map<Zone, number>(PRIORITY.map((z, i) => [z, i]));

/** Ranges that read as hills rather than peaks at this scale. */
const LOW_RANGES = new Set([
  "URAL MOUNTAINS", "APPALACHIAN MTS.", "GREAT DIVIDING RANGE", "APPENNINI", "WESTERN GHATS", "EASTERN GHATS", "Vindhya Range",
  "CRYSTAL MOUNTAINS", "MITUMBA MTS.", "ATLAS SAHARIEN", "TIBESTI MTS.", "AHAGGAR MTS.", "AÏR MTS.", "HEJAZ MTS.", "Central Highlands",
  "Nan Ling Mts.", "Wuyi Mts.", "Dabie Mts.", "Siwalik Hills", "ETHIOPIAN HIGHLANDS", "CARPATHIAN MOUNTAINS", "GUIANA HIGHLANDS",
]);

/** Named Natural Earth regions with a zone of their own (the class decides the rest). */
const BY_NAME: Record<string, Zone | null> = {
  PUNJAB: "green",
  CAATINGAS: "arid",
  "BETPAQDALA DESERT": "arid",
  "Mu Us Desert": "arid",
  "PLATEAU OF TIBET": "coldHigh",
  "Polar Plateau": "ice",
  "WESTERN PLATEAU": "arid",
  "PENÍNSULA IBÉRICA": "medHigh",
  "BRAZILIAN HIGHLANDS": "savanna",
  "CENTRAL SIBERIAN PLATEAU": "boreal",
  "MONGOLIAN PLATEAU": "steppe",
  "DECCAN PLATEAU": "highland",
  "COLORADO PLATEAU": "aridHigh",
  "ALTI-PLANICIE MEXICANA": "aridHigh",
  ALTIPLANO: "aridHigh",
  "KATANGA PLATEAU": "savanna",
  "GUIANA SHIELD": "jungleMix",
  "KAZAKH UPLAND": "steppe",
  "Ustyurt Plateau": "arid",
  "Loess Plateau": "highland",
  "CANADIAN SHIELD": "boreal",
  "KAZAKH STEPPE": "steppe",
  "PONTIC STEPPE": "steppe",
  "TURAN LOWLAND": "arid",
  SAHEL: "savanna",
  "GREAT PLAINS": "steppe",
  PAMPAS: "prairie",
  LLANOS: "savanna",
  "NORTHERN EUROPEAN PLAIN": "meadow",
  "NORTH CHINA PLAIN": "green",
  "MANCHURIAN PLAIN": "prairie",
  "GANGES PLAIN": "green",
  "CENTRAL LOWLAND": "prairie",
  "COASTAL PLAIN": "meadow",
  "NULLARBOR PLAIN": "arid",
  "NORTH SLOPE": "tundra",
  "Yukon Flats": "boreal",
  "LES LAURENTIDES": "boreal",
  "Iwembere Steppe": "savanna",
  "CONGO BASIN": "jungle",
  "AMAZON BASIN": "jungle",
  "GREAT BASIN": "desert",
  "TARIM BASIN": "desert",
  "GREAT ARTESIAN BASIN": "arid",
  "MURRAY-DARLING BASIN": "steppe",
  "SICHUAN BASIN": "hillyGreen",
  "Junggar Basin": "arid",
  "Qaidam Basin": "desert",
  SUDD: "swamp",
  Mesopotamia: "green",
  ANATOLIA: "medHigh",
  PATAGONIA: "steppe",
  BALUCHISTAN: "aridHigh",
  LAPLAND: "boreal",
  Ogaden: "arid",
  "Hexi Corridor": "arid",
  Riverina: "steppe",
  "WESTERN SIBERIAN PLAIN": "wetForest",
  "NORTH SIBERIAN LOWLAND": "tundra",
  "KOLYMA LOWLAND": "tundra",
  "CASPIAN DEPRESSION": "arid",
  "VYCHEGDA LOWLAND": "boreal",
  SELVAS: "jungle",
  YUNGAS: "jungleMix",
  PIEDMONT: "hillyGreen",
  "GREAT RIFT VALLEY": "savanna",
  "Fergana Valley": "green",
  "Central Valley": "green",
  "ARABIAN PENINSULA": "desert",
  "SOMALI PENINSULA": "arid",
  "INDOCHINA PENINSULA": "jungleMix",
  "MALAY PENINSULA": "jungle",
  "BAJA CALIFORNIA": "desert",
  FLORIDA: "swamp",
  KOREA: "hillyGreen",
  GREENLAND: "ice",
  ICELAND: "tundra",
  ANTARCTICA: "ice",
  "NEW GUINEA": "jungle",
  BORNEO: "jungle",
  SUMATRA: "jungle",
  SULAWESI: "jungle",
  JAVA: "jungle",
  "MALAY ARCHIPELAGO": "jungleMix",
  PHILIPPINES: "jungleMix",
  JAPAN: "hillyGreen",
  "NEW ZEALAND": "hillyGreen",
  "QUEEN ELIZABETH ISLANDS": "tundra",
  "ARCTIC ARCHIPELAGO": "tundra",
};

/** Zone for one Natural Earth geography region, or null to ignore it. */
export function regionZone(cls: string, name: string, rank: number): Zone | null {
  if (name in BY_NAME) return BY_NAME[name]!;
  switch (cls) {
    case "Range/mtn": return rank >= 4 || LOW_RANGES.has(name) ? "hills" : "mountains";
    case "Desert": return "desert";
    case "Tundra": return "tundra";
    case "Delta": return "delta";
    case "Wetlands": return "swamp";
    case "Plateau": return "highland";
    default: return null;
  }
}

/** Zones the data lacks, drawn by hand as rough lon/lat outlines. */
export const HAND_ZONES: { zone: Zone; ring: Pt[] }[] = [
  // Mountains and hills
  { zone: "mountains", ring: [[29.5, 37], [33, 36.3], [36, 36.8], [37.8, 37.8], [36, 38.4], [32, 37.6], [30, 37.6]] }, // Taurus
  { zone: "hills", ring: [[35.3, 33], [36.3, 34.6], [36.9, 34.4], [36, 33]] }, // Lebanon
  { zone: "hills", ring: [[-6, 56.5], [-5, 58.6], [-3, 58.6], [-2.2, 57], [-4, 56.3]] }, // Scottish Highlands
  { zone: "hills", ring: [[2, 44.4], [4.5, 44.4], [4.5, 46], [2, 46]] }, // Massif Central
  { zone: "hills", ring: [[20.3, 40.8], [21.3, 38.6], [22.4, 38.9], [21.5, 41.2]] }, // Pindus
  { zone: "hills", ring: [[21.6, 37], [22.9, 36.5], [23.2, 37.6], [22.3, 38.2], [21.5, 37.8]] }, // Peloponnese
  { zone: "hills", ring: [[54, 38], [57, 38.2], [60.5, 36.6], [59.5, 36.2], [56, 37.2], [54, 37.5]] }, // Kopet Dag
  { zone: "hills", ring: [[67.5, 28], [69, 31], [70.5, 32.3], [70.9, 31], [69.2, 28]] }, // Sulaiman
  { zone: "hills", ring: [[56, 24.3], [58.5, 23.7], [59.8, 22.4], [58, 22.9], [56.2, 23.6]] }, // Hajar
  // Dry lands
  { zone: "aridHigh", ring: [[49, 36], [57, 37.5], [61, 35], [63, 30], [61.5, 25.5], [57, 27], [52, 28], [48, 32]] }, // Iranian plateau
  { zone: "desert", ring: [[32.3, 31.2], [34.9, 31.6], [35.1, 29.5], [34.2, 27.7], [32.6, 29.9]] }, // Sinai and Negev
  { zone: "desert", ring: [[31.5, 30], [34, 28], [36, 24], [37.5, 22], [36.5, 22], [33, 24], [31, 29.5]] }, // Eastern Desert
  { zone: "arid", ring: [[19, -31], [25, -31], [25, -33.5], [19, -33.5]] }, // Karoo
  // Wet lands
  { zone: "wetForest", ring: [[24, 51.3], [30, 51.3], [30.5, 52.4], [24, 52.4]] }, // Pripyat marshes
  { zone: "swamp", ring: [[46, 30.6], [47.8, 30.6], [47.8, 31.8], [46, 31.8]] }, // Mesopotamian marshes
  { zone: "green", ring: [[7.8, 45.5], [12.3, 45.5], [12.3, 44.7], [9, 44.7]] }, // Po valley
  { zone: "prairie", ring: [[19, 47.8], [22, 47.8], [21.5, 45.5], [19, 45.5]] }, // Hungarian plain
  { zone: "green", ring: [[29.5, 31.6], [32.4, 31.6], [31.8, 30], [31, 30]] }, // Nile delta
  // Rain forest
  { zone: "jungle", ring: [[-13, 10], [-8, 9], [0, 8], [9, 7], [12, 4], [9, 3], [-8, 4], [-14, 8]] }, // Guinea coast
  { zone: "jungle", ring: [[-92, 17], [-88, 21.5], [-86, 21], [-83, 14], [-77, 9], [-78, 7], [-83, 8], [-88, 13], [-92, 15]] }, // Central America
  { zone: "jungleMix", ring: [[86, 22], [90, 27], [96, 28], [97, 23], [92, 20], [88, 21]] }, // Bengal and Assam
  { zone: "jungle", ring: [[72.5, 19], [74.5, 19], [77, 9], [76, 8], [72.5, 16]] }, // Malabar coast
  { zone: "jungleMix", ring: [[-48, -5], [-35, -5], [-35, -10], [-41, -23], [-49, -29], [-50, -25], [-44, -15]] }, // Atlantic forest
  { zone: "jungle", ring: [[49, -12], [51, -16], [48, -25], [47, -25], [48, -16]] }, // eastern Madagascar
  { zone: "jungle", ring: [[92, -11], [155, -11], [155, 18], [110, 21], [97, 21]] }, // south-east Asia and the islands
  { zone: "hillyGreen", ring: [[104, 22], [122, 24], [122, 31], [110, 32], [104, 30]] }, // southern China
];

/** Terrain mix by distance from the equator when no zone applies. */
export function latitudeMix(lon: number, lat: number): Mix {
  const a = Math.abs(lat);
  if (a >= 74) return [[A, 70], [T, 30]];
  if (a >= 66) return [[T, 80], [F, 15], [H, 5]];
  if (a >= 58) return [[F, 55], [T, 20], [S, 10], [G, 10], [P, 5]];
  if (a >= 48) return [[F, 40], [G, 35], [P, 20], [S, 5]];
  // Mediterranean: drier and more broken.
  if (lat >= 30 && lat < 45 && lon >= -10 && lon <= 45) return [[P, 35], [G, 25], [H, 25], [F, 15]];
  if (a >= 35) return [[G, 40], [P, 25], [F, 25], [H, 10]];
  if (a >= 25) return [[G, 35], [P, 30], [F, 20], [H, 15]];
  if (a >= 12) return [[P, 45], [G, 35], [F, 10], [H, 5], [D, 5]];
  return [[G, 40], [P, 30], [F, 25], [H, 5]];
}

/** Pick from a mix with a uniform 0..1 draw. */
export function pick(mix: Mix, u: number): Terrain {
  const total = mix.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [t, w] of mix) {
    acc += w / total;
    if (u < acc) return t;
  }
  return mix[mix.length - 1]![0];
}

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smoothly interpolated lattice noise, period `w` across so it meets itself at the seam. */
function valueNoise(x: number, y: number, w: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i: number, j: number) => hash(((i % w) + w) % w, j, seed);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

/**
 * Patchy noise for every square of a w x h grid, uniform over 0..1: mostly
 * a smooth field (so forests and hills come in patches), a little per-square
 * jitter, then ranked so each mix gets exactly its share.
 */
export function patchNoise(w: number, h: number, seed: number): Float32Array {
  const SCALE = 2.5;
  const period = Math.round(w / SCALE);
  const raw = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) raw[y * w + x] = 0.65 * valueNoise((x * period) / w, y / SCALE, period, seed) + 0.35 * hash(x, y, seed + 7919);
  const order = Array.from(raw.keys()).sort((a, b) => raw[a]! - raw[b]!);
  const out = new Float32Array(w * h);
  order.forEach((i, rank) => { out[i] = rank / order.length; });
  return out;
}
