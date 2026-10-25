import { landformGroup, NEIGHBOURS, PLACE_CHARS, Terrain, type LandformGroup, type PlaceKind, type PlaceName, type PlaceTable } from "@civ/core";
import { HAND_ZONES, type Zone } from "./climate.js";
import { prop, type Pt, type Shape } from "./geo.js";

/**
 * A premade world's real places (the game's `premadeGeography`): every square gets the name of the
 * water body or landform it lies in and of the continent or island it lies on, as far as Natural
 * Earth (lakes, deserts, ranges, plateaus, basins, islands, continents) and the hand outlines below
 * (seas and oceans, which the cached data lacks, and a few forests, ice sheets and marshes) know them.
 * A square goes to the most important place covering it (Natural Earth's scale rank, then the
 * smaller); water left over takes the nearest name across the water, a landform's squares the
 * nearest within a step or two of the same landform, land the nearest on its landmass.
 */

/** A hand-drawn place: lon/lat outlines (split at the 180th meridian), its kind and name. */
interface HandPlace {
  kind: PlaceKind | "range";
  name: string;
  rings: Pt[][];
  /** Before Natural Earth's places of this rank or worse (default: after all of them). */
  rank?: number;
}

const box = (w: number, s: number, e: number, n: number): Pt[] => [[w, s], [e, s], [e, n], [w, n]];

/**
 * Seas, gulfs and oceans, the first covering a square winning: the smaller seas before those they
 * open into, the oceans last. Rough outlines: only the water inside counts, so they may run over land.
 */
const WATERS: HandPlace[] = [
  // Inland seas.
  { kind: "sea", name: "the Caspian Sea", rings: [box(46.5, 36.5, 55, 47.5)] },
  { kind: "sea", name: "the Aral Sea", rings: [box(57.5, 43, 62.5, 47)] },
  // The Mediterranean and the Black Sea.
  { kind: "sea", name: "the Sea of Azov", rings: [box(34.8, 45.2, 39.5, 47.4)] },
  { kind: "sea", name: "the Sea of Marmara", rings: [box(26.5, 40.2, 29.9, 41.1)] },
  { kind: "sea", name: "the Black Sea", rings: [box(27, 40.8, 42, 46.8)] },
  { kind: "sea", name: "the Aegean Sea", rings: [box(22.6, 35.3, 28.3, 41)] },
  { kind: "sea", name: "the Adriatic Sea", rings: [[[12.2, 45.8], [13.9, 45.8], [19.9, 41.8], [19.6, 40.2], [18.5, 40], [16.5, 41.2], [12.2, 44.2]]] },
  { kind: "sea", name: "the Ionian Sea", rings: [[[15.1, 35.8], [22.4, 35.8], [22.4, 36.4], [21.3, 37.6], [20.3, 39.6], [19.6, 40.2], [18.6, 40.1], [17.3, 40.5], [16.4, 39.9], [15.1, 38.3]]] },
  { kind: "sea", name: "the Tyrrhenian Sea", rings: [[[9.3, 39], [12.5, 38.1], [15.6, 38.2], [16.1, 38.6], [15.6, 40], [12.5, 41.5], [10.5, 44], [9.3, 44]]] },
  { kind: "sea", name: "the Bay of Biscay", rings: [[[-8.2, 43.3], [-1, 43.3], [-1, 47.5], [-4.8, 48.4], [-8.2, 43.8]]] },
  { kind: "bay", name: "the Gulf of Suez", rings: [box(32.2, 27.6, 33.8, 30)] },
  { kind: "sea", name: "the Red Sea", rings: [box(32, 12.4, 43.5, 30)] },
  { kind: "sea", name: "the Mediterranean Sea", rings: [box(-5.6, 30, 37, 46)] },
  // Northern Europe.
  { kind: "bay", name: "the Gulf of Finland", rings: [box(22.8, 59.2, 30.5, 60.8)] },
  { kind: "bay", name: "the Gulf of Bothnia", rings: [box(17, 60, 25.8, 66)] },
  { kind: "sea", name: "the Baltic Sea", rings: [box(9.5, 53.5, 30, 60.2)] },
  { kind: "sea", name: "the English Channel", rings: [[[-5.7, 48.3], [1.6, 48.3], [1.6, 51.1], [-5.7, 50.2]]] },
  { kind: "sea", name: "the Irish Sea", rings: [box(-6.5, 51.8, -2.7, 55)] },
  { kind: "sea", name: "the North Sea", rings: [[[-3.5, 56], [-0.5, 51], [1.6, 51], [9.5, 53], [9.5, 57.5], [8, 58], [5, 62], [-1.5, 60.8], [-3.5, 58.6]]] },
  { kind: "sea", name: "the White Sea", rings: [box(32, 63.5, 44.5, 66.8)] },
  { kind: "sea", name: "the Norwegian Sea", rings: [[[-13, 65], [-7, 62], [5, 61.5], [12, 66], [19, 70.2], [19, 74], [0, 73], [-8, 68]]] },
  { kind: "sea", name: "the Barents Sea", rings: [[[19, 70], [33, 69], [44, 66], [48, 68], [55, 68.5], [59, 70], [57, 72], [52, 74], [56, 76], [65, 80], [19, 80]]] },
  { kind: "sea", name: "the Kara Sea", rings: [[[57, 69], [66, 68.5], [75, 66.5], [84, 70], [100, 76], [100, 80], [66, 81], [58, 77]]] },
  { kind: "sea", name: "the Laptev Sea", rings: [box(100, 71, 140, 79)] },
  { kind: "sea", name: "the East Siberian Sea", rings: [box(140, 68, 180, 78)] },
  { kind: "sea", name: "the Chukchi Sea", rings: [box(-180, 66, -156, 75)] },
  { kind: "sea", name: "the Beaufort Sea", rings: [box(-156, 69, -124, 76)] },
  { kind: "sea", name: "the Greenland Sea", rings: [[[-20, 70], [-8, 68], [0, 73], [19, 74], [15, 79], [-15, 81]]] },
  // North America.
  { kind: "bay", name: "Baffin Bay", rings: [box(-80, 68, -55, 78)] },
  { kind: "bay", name: "Hudson Bay", rings: [[[-95, 51], [-76, 51], [-76, 62.5], [-70, 62.5], [-70, 70], [-86, 70], [-95, 66]]] },
  { kind: "sea", name: "the Labrador Sea", rings: [[[-64, 53], [-45, 58], [-45, 66], [-62, 66], [-64, 60]]] },
  { kind: "bay", name: "the Gulf of St. Lawrence", rings: [[[-67, 47.5], [-60, 45.8], [-56, 47], [-56, 51.5], [-67, 51]]] },
  { kind: "sea", name: "the Caribbean Sea", rings: [[[-89, 9], [-60, 9], [-60.5, 17], [-64.5, 18.2], [-68, 18], [-74.5, 19.8], [-77.5, 20], [-84.9, 21.9], [-87, 21.5], [-89, 16]]] },
  { kind: "bay", name: "the Gulf of Mexico", rings: [box(-98, 17.5, -80.8, 31)] },
  { kind: "bay", name: "the Gulf of California", rings: [[[-114.8, 31.8], [-112.5, 31.8], [-109, 27], [-105.5, 23], [-109.5, 22.8], [-110, 24], [-112, 26.5]]] },
  { kind: "bay", name: "the Gulf of Alaska", rings: [box(-155, 54, -130, 61)] },
  { kind: "sea", name: "the Bering Sea", rings: [box(162, 52, 180, 66), box(-180, 52, -157, 66)] },
  // East Asia.
  { kind: "sea", name: "the Sea of Okhotsk", rings: [[[135, 53], [140, 46], [143, 43.5], [146, 43.3], [156.5, 51], [163, 62], [135, 62]]] },
  { kind: "sea", name: "the Sea of Japan", rings: [[[127.5, 34.5], [130.5, 33.8], [132, 34.2], [135, 35.5], [136.5, 37], [139.5, 38], [140, 41], [141.5, 43], [141.7, 45.5], [142, 46.5], [141.8, 52], [140, 52], [127.5, 40]]] },
  { kind: "sea", name: "the Yellow Sea", rings: [box(117.5, 34, 126.8, 41)] },
  { kind: "sea", name: "the East China Sea", rings: [[[119.5, 25], [122, 25], [123.7, 24.3], [127, 26], [129.5, 28.5], [130.5, 31], [129.8, 33.4], [126.8, 34], [121.8, 31.5], [120.5, 28]]] },
  { kind: "bay", name: "the Gulf of Thailand", rings: [[[99, 6.2], [104.8, 8.5], [104.8, 14], [99, 14]]] },
  { kind: "sea", name: "the South China Sea", rings: [[[103, 1.5], [105.5, -2], [109, -3], [110, 0], [117, 4], [119.5, 9], [120.5, 14], [120.3, 18.5], [121.8, 22], [120, 23], [117, 23.5], [110, 21.5], [106, 20], [109, 12], [105, 9], [100.5, 13.5], [100.5, 6]]] },
  { kind: "sea", name: "the Philippine Sea", rings: [[[126.5, 5], [136, 5], [146, 13], [146, 35], [136.5, 34], [132, 32], [130.5, 31], [129.5, 28.5], [127, 26], [123.7, 24.3], [122, 22], [124, 18.5], [126.3, 8]]] },
  { kind: "sea", name: "the Sulu Sea", rings: [[[117, 6], [122.5, 6], [122.5, 11.5], [119.5, 11.5]]] },
  { kind: "sea", name: "the Celebes Sea", rings: [[[118.5, 1], [126, 1], [126, 7], [120, 7]]] },
  { kind: "sea", name: "the Java Sea", rings: [[[105, -6.5], [117, -8], [119, -5], [117, -3], [110, -2.5], [106, -2.5]]] },
  { kind: "sea", name: "the Banda Sea", rings: [box(119, -8.3, 132, -3)] },
  // Australia and the south-west Pacific.
  { kind: "bay", name: "the Gulf of Carpentaria", rings: [box(135.5, -17.8, 142, -11.5)] },
  { kind: "sea", name: "the Arafura Sea", rings: [[[130, -11.5], [141, -11.5], [141, -6], [134, -4], [130, -8]]] },
  { kind: "sea", name: "the Timor Sea", rings: [[[122, -14.5], [130, -14.5], [130, -8.5], [125, -8.5], [122, -11]]] },
  { kind: "sea", name: "the Coral Sea", rings: [[[143, -30], [166, -30], [166, -11], [155, -10], [150, -10.5], [143, -9.5]]] },
  { kind: "sea", name: "the Tasman Sea", rings: [[[148, -47], [166.5, -47], [172, -34.5], [166, -30], [151, -30]]] },
  { kind: "bay", name: "the Great Australian Bight", rings: [box(123, -35.5, 136, -31)] },
  // The Indian Ocean's seas.
  { kind: "sea", name: "the Andaman Sea", rings: [box(93.8, 6, 99, 16.5)] },
  { kind: "bay", name: "the Bay of Bengal", rings: [box(79.8, 5.8, 93.8, 23)] },
  { kind: "bay", name: "the Persian Gulf", rings: [box(47.5, 23.8, 56.4, 30.5)] },
  { kind: "bay", name: "the Gulf of Oman", rings: [box(56.4, 22.5, 61.5, 26.5)] },
  { kind: "bay", name: "the Gulf of Aden", rings: [[[43.3, 10.5], [51.3, 10.5], [51.3, 15], [43.3, 13]]] },
  { kind: "sea", name: "the Arabian Sea", rings: [box(51, 5, 77.5, 26)] },
  { kind: "sea", name: "the Mozambique Channel", rings: [[[34, -25.5], [44.5, -25.5], [44.5, -11.5], [39, -11.5]]] },
  // The Atlantic's.
  { kind: "bay", name: "the Gulf of Guinea", rings: [box(-8, -2, 10, 6.5)] },
  // Oceans.
  { kind: "ocean", name: "the Arctic Ocean", rings: [box(-180, 79, 180, 90)] },
  { kind: "ocean", name: "the Southern Ocean", rings: [box(-180, -90, 180, -56)] },
  { kind: "ocean", name: "the North Atlantic Ocean", rings: [[[-60, 0], [10, 0], [10, 60], [-40, 60], [-70, 40], [-74, 25], [-65, 15]]] },
  { kind: "ocean", name: "the South Atlantic Ocean", rings: [[[-50, 0], [10, 0], [18, -34], [20, -56], [-65, -56], [-55, -35], [-35, -8]]] },
  { kind: "ocean", name: "the Indian Ocean", rings: [[[20, -56], [20, -35], [40, -10], [50, 5], [80, 5], [95, 0], [105, -8], [115, -22], [130, -35], [147, -45], [147, -56]]] },
  { kind: "ocean", name: "the North Pacific Ocean", rings: [[[120, 0], [180, 0], [180, 58], [155, 55], [145, 35], [130, 20]], [[-180, 0], [-82, 0], [-90, 12], [-110, 22], [-125, 40], [-140, 58], [-180, 58]]] },
  { kind: "ocean", name: "the South Pacific Ocean", rings: [[[148, -56], [180, -56], [180, 0], [160, 0], [160, -10], [152, -25], [148, -40]], [[-180, -56], [-70, -56], [-75, -20], [-81, -5], [-82, 0], [-180, 0]]] },
];

/** Landforms the data lacks: the forests, ice sheets, tundras and marshes of the world, roughly. */
const LANDFORMS: HandPlace[] = [
  { kind: "ice", name: "the Greenland Ice Sheet", rank: 0, rings: [box(-75, 59, -10, 84)] },
  { kind: "ice", name: "the Antarctic Ice Sheet", rank: 0, rings: [box(-180, -90, 180, -60)] },
  { kind: "ice", name: "the Arctic Ice Pack", rank: 0, rings: [box(-180, 79, 180, 90)] },
  { kind: "forest", name: "the Siberian Taiga", rings: [box(60, 48, 180, 72)] },
  { kind: "forest", name: "the Russian Taiga", rings: [box(30, 54, 60, 68)] },
  { kind: "forest", name: "the Scandinavian Taiga", rings: [box(5, 58, 30, 71)] },
  { kind: "forest", name: "the Boreal Forest", rings: [box(-170, 47, -52, 70)] },
  { kind: "forest", name: "the Hercynian Forest", rings: [box(5, 47, 25, 54)] },
  { kind: "tundra", name: "the Siberian Tundra", rings: [box(60, 64, 180, 78)] },
  { kind: "tundra", name: "the Alaskan Tundra", rings: [box(-170, 58, -140, 72)] },
  { kind: "jungle", name: "the Amazon Rainforest", rings: [box(-80, -18, -44, 8)] },
  { kind: "jungle", name: "the Congo Rainforest", rings: [box(8, -8, 32, 6)] },
  { kind: "jungle", name: "the Sundaland Rainforest", rings: [box(95, -11, 141, 8)] },
  { kind: "jungle", name: "the New Guinea Rainforest", rings: [box(141, -11, 156, 0)] },
  { kind: "swamp", name: "the Everglades", rings: [box(-82, 25, -80, 28)] },
  { kind: "swamp", name: "the Vasyugan Swamp", rings: [box(70, 55, 85, 60)] },
];

/** The landforms a climate zone makes. */
const ZONE_FORMS: Partial<Record<Zone, LandformGroup[]>> = {
  mountains: ["range"], hills: ["range"], aridHigh: ["desert", "range"], desert: ["desert"], arid: ["desert"],
  swamp: ["swamp"], wetForest: ["swamp", "forest"], jungle: ["jungle"], jungleMix: ["jungle", "forest"],
};

/** The landforms a Natural Earth region of this class may name. */
const CLASS_FORMS: Record<string, LandformGroup[]> = {
  Desert: ["desert"],
  "Range/mtn": ["range"],
  Plateau: ["range", "desert"],
  Basin: ["jungle", "desert", "swamp"],
  Tundra: ["tundra"],
  Wetlands: ["swamp"],
  Delta: ["swamp"],
  Lowland: ["tundra", "swamp"],
  Foothills: ["jungle", "range"],
};

/** Natural Earth regions of other classes that name a landform, and names put better than the data's own. */
const NAMED: Record<string, { name: string; forms?: LandformGroup[] }> = {
  "ARABIAN PENINSULA": { name: "the Arabian Desert", forms: ["desert"] },
  "NULLARBOR PLAIN": { name: "the Nullarbor Plain", forms: ["desert"] },
  PATAGONIA: { name: "the Patagonian Desert", forms: ["desert"] },
  Ogaden: { name: "the Ogaden", forms: ["desert"] },
  BALUCHISTAN: { name: "Baluchistan", forms: ["desert", "range"] },
  SUDD: { name: "the Sudd", forms: ["swamp"] },
  LAPLAND: { name: "Lapland", forms: ["tundra"] },
  "BAJA CALIFORNIA": { name: "the Vizcaíno Desert", forms: ["desert"] },
  "AMAZON BASIN": { name: "the Amazon Rainforest" },
  "CONGO BASIN": { name: "the Congo Rainforest" },
  "TARIM BASIN": { name: "the Taklamakan Desert" },
  "GREAT BASIN": { name: "the Great Basin Desert" },
  "PLATEAU OF TIBET": { name: "the Tibetan Plateau" },
  "PENÍNSULA IBÉRICA": { name: "the Meseta" },
  "AHAGGAR MTS.": { name: "the Ahaggar Mountains" },
  APPENNINI: { name: "the Apennines" },
  PAMIRS: { name: "the Pamirs" },
  "Niger Delta": { name: "the Niger Delta" },
  "CORD. CENTRAL": { name: "the Cordillera Central" },
  "CORD. OCCIDENTAL": { name: "the Cordillera Occidental" },
  "CRYSTAL MOUNTAINS": { name: "the Crystal Mountains" },
  "COLUMBIA MTS.": { name: "the Columbia Mountains" },
  "SOUTHERN ALPS": { name: "the Southern Alps" },
  "Southern Ghats": { name: "the Southern Ghats" },
  "STANOVOY UPLAND": { name: "the Stanovoy Upland" },
  "GUIANA SHIELD": { name: "the Guiana Shield" },
  "PLANALTO CENTRAL": { name: "the Planalto Central" },
  "Campos Sertão": { name: "the Sertão" },
  "Sarïr Kalanshiyu ar Ramli al Kabi": { name: "the Calanshio Sand Sea" },
  TASMANIA: { name: "Tasmania" },
  "ELLESMERE  ISLAND": { name: "Ellesmere Island" },
  "SOLOMON ISANDS": { name: "the Solomon Islands" },
  "ISLAND OF NEWFOUNDLAND": { name: "Newfoundland" },
  "Hawai‘i": { name: "Hawaii" },
  JAPAN: { name: "the Japanese Islands" },
  "WEST INDIES": { name: "the West Indies" },
};

const WORDS: Record<string, string> = { "MTS.": "Mountains", "MTS": "Mountains", "RA.": "Range", "PEN.": "Peninsula", "PLAT.": "Plateau", "I.": "Island", "IS.": "Islands", "CORD.": "Cordillera", "ARCH.": "Archipelago" };

/** A Natural Earth name in title case ("ROCKY MOUNTAINS" to "Rocky Mountains"), its abbreviations spelled out. */
function titleCase(name: string): string {
  return name.split(/\s+/).map((w) => WORDS[w.toUpperCase()] ?? (w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(" ");
}

/** A Natural Earth region's name as the game shows it, with "the" where English puts one. */
function regionName(props: Record<string, unknown>, cls: string): string {
  const raw = prop(props, "NAME");
  const fixed = NAMED[raw]?.name;
  if (fixed) return fixed;
  const name = prop(props, "NAME_EN") || titleCase(raw);
  if (cls === "Continent" || cls === "Island") return name;
  if (cls === "Island group") return /s$|Islands|Isles|Archipelago|Indies/.test(name) ? `the ${name}` : name;
  return /^(Mount|Lake) /.test(name) ? name : `the ${name}`;
}

/** A lake's name as the game shows it ("Lago Titicaca" to "Lake Titicaca", "the Dead Sea"). */
function lakeName(raw: string): string {
  let name = raw.replace(/^(Lago de |Lago |Lac |Ozero |Lake )/, "Lake ");
  const hu = /^(.+) (Hu|Nuur|Co|Köli)$/.exec(name);
  if (hu) name = `Lake ${hu[1]}`;
  return /Sea|meer$/.test(name) ? `the ${name}` : name;
}

interface Candidate {
  kind: PlaceKind | "range";
  name: string;
  /** Lower wins where several cover a square. */
  rank: number;
  area: number;
  cov: Float32Array;
}

export interface PlaceInput {
  terrain: readonly Terrain[];
  /** Each square's landmass (build.ts `landmasses`), -1 at sea. */
  landmass: Int32Array;
  W: number;
  H: number;
  lakes: readonly Shape[];
  regions: readonly Shape[];
  /** Fraction of each square inside the rings. */
  cover: (rings: readonly (readonly Pt[])[]) => Float32Array;
}

export interface BuiltPlaces {
  table: PlaceTable;
  report: string[];
}

export function buildPlaces(input: PlaceInput): BuiltPlaces {
  const { terrain, landmass, W, H, cover } = input;
  const N = W * H;
  const k = W / 80;
  const wet = (i: number) => terrain[i] === Terrain.Ocean;
  const form = (i: number) => (wet(i) ? null : landformGroup(terrain[i]!));
  const near = (i: number, f: (j: number) => void) => {
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of NEIGHBOURS) if (y + dy >= 0 && y + dy < H) f((y + dy) * W + (((x + dx) % W) + W) % W);
  };
  const areaOf = (cov: Float32Array) => cov.reduce((s, c) => s + c, 0);
  const candidate = (kind: Candidate["kind"], name: string, rank: number, cov: Float32Array): Candidate => ({ kind, name, rank, area: areaOf(cov), cov });

  // ---- candidates -------------------------------------------------------------------------
  const lakes: Candidate[] = [];
  for (const l of input.lakes) {
    const raw = prop(l.props, "name");
    if (!raw || !/lake/i.test(prop(l.props, "featurecla"))) continue;
    lakes.push(candidate("lake", lakeName(raw), 0, cover(l.rings)));
  }
  const seas = WATERS.map((s, n) => candidate(s.kind, s.name, n, cover(s.rings)));
  const forms: { c: Candidate; forms: readonly LandformGroup[] }[] = [];
  const lands: { c: Candidate; cls: number }[] = [];
  for (const r of input.regions) {
    const cls = prop(r.props, "FEATURECLA");
    const raw = prop(r.props, "NAME");
    const rank = Number(prop(r.props, "SCALERANK"));
    const landClass = ["Island", "Island group", "Continent"].indexOf(cls);
    if (landClass >= 0) {
      const name = regionName(r.props, cls);
      lands.push({ c: candidate(cls === "Continent" ? "continent" : "island", name, rank, cover(r.rings)), cls: landClass });
      continue;
    }
    const allowed = CLASS_FORMS[cls] ?? NAMED[raw]?.forms;
    if (!allowed) continue;
    // A region of another class (a peninsula, a land) only names what the landforms leave.
    forms.push({ c: candidate("range", regionName(r.props, cls), CLASS_FORMS[cls] ? rank : Math.max(rank, 4.5), cover(r.rings)), forms: allowed });
  }
  for (const z of HAND_ZONES) {
    const allowed = ZONE_FORMS[z.zone];
    if (z.name && allowed) forms.push({ c: candidate("range", z.name, 5, cover([z.ring])), forms: allowed });
  }
  for (const p of LANDFORMS) forms.push({ c: candidate(p.kind, p.name, p.rank ?? 5, cover(p.rings)), forms: [p.kind === "range" ? "range" : (p.kind as LandformGroup)] });
  const better = (a: Candidate, b: Candidate | undefined) => !b || a.rank < b.rank || (a.rank === b.rank && a.area < b.area);

  // ---- each square's place ------------------------------------------------------------------
  const place: (Candidate | undefined)[] = new Array(N);
  const land: (Candidate | undefined)[] = new Array(N);
  for (let i = 0; i < N; i++) {
    if (wet(i)) {
      let best: Candidate | undefined;
      for (const l of lakes) if (l.cov[i]! >= 0.25 && (!best || l.cov[i]! > best.cov[i]!)) best = l;
      if (!best) best = seas.find((s) => s.cov[i]! >= 0.4);
      place[i] = best;
      continue;
    }
    const f = form(i);
    if (f)
      for (const { c, forms: allowed } of forms) if (allowed.includes(f) && c.cov[i]! >= 0.3 && better(c, place[i])) place[i] = c;
    let top: { c: Candidate; cls: number } | undefined;
    for (const l of lands)
      if (l.c.cov[i]! >= 0.3 && (!top || l.cls < top.cls || (l.cls === top.cls && better(l.c, top.c)))) top = l;
    land[i] = top?.c;
  }

  // Leftovers take the nearest name: across the water, within two steps (more on a finer grid) of
  // the same landform, anywhere on the same landmass.
  const spread = (layer: (Candidate | undefined)[], joins: (a: number, b: number) => boolean, reach: number) => {
    const dist = new Int32Array(N).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < N; i++) if (layer[i]) { dist[i] = 0; queue.push(i); }
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q]!;
      if (dist[c]! >= reach) continue;
      near(c, (j) => {
        if (dist[j] !== -1 || !joins(c, j)) return;
        dist[j] = dist[c]! + 1;
        layer[j] = layer[c];
        queue.push(j);
      });
    }
  };
  spread(place, (a, b) => wet(a) && wet(b), N);
  spread(place, (a, b) => !wet(a) && form(a) !== null && form(a) === form(b), Math.max(2, Math.round(2 * k)));
  spread(land, (a, b) => !wet(b) && landmass[a] === landmass[b], N);

  // ---- tables and rows ------------------------------------------------------------------------
  // A range is mountains where a quarter of its squares are peaks, else hills.
  const peaks = new Map<Candidate, [number, number]>();
  for (let i = 0; i < N; i++) {
    const c = place[i];
    if (!c || c.kind !== "range" || wet(i)) continue;
    const t = peaks.get(c) ?? [0, 0];
    t[0] += terrain[i] === Terrain.Mountains ? 1 : 0;
    t[1]++;
    peaks.set(c, t);
  }
  const kindOf = (c: Candidate, i: number): PlaceKind => {
    if (c.kind !== "range") return c.kind;
    const f = form(i);
    if (f !== "range") return f === null ? "hills" : f;
    const [m, n] = peaks.get(c)!;
    return m >= Math.max(1, n / 4) ? "mountains" : "hills";
  };
  const waters: PlaceName[] = [];
  const landforms: PlaceName[] = [];
  const landNames: PlaceName[] = [];
  const code = (list: PlaceName[], entry: PlaceName) => {
    let n = list.findIndex(([kind, name]) => kind === entry[0] && name === entry[1]);
    if (n < 0) { n = list.length; list.push(entry); }
    const ch = PLACE_CHARS[n];
    if (ch === undefined) throw new Error(`more than ${PLACE_CHARS.length} places of a layer`);
    return ch;
  };
  const placeRows: string[] = [];
  const landRows: string[] = [];
  const sizes = new Map<string, number>();
  for (let y = 0; y < H; y++) {
    let a = "";
    let b = "";
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const p = place[i];
      if (p) {
        const entry: PlaceName = [kindOf(p, i), p.name];
        a += code(wet(i) ? waters : landforms, entry);
        sizes.set(entry[1], (sizes.get(entry[1]) ?? 0) + 1);
      } else a += ".";
      const l = wet(i) ? undefined : land[i];
      b += l ? code(landNames, [l.kind as PlaceKind, l.name]) : ".";
    }
    placeRows.push(a);
    landRows.push(b);
  }
  const unnamed = (layer: (Candidate | undefined)[], on: (i: number) => boolean) => {
    let n = 0;
    for (let i = 0; i < N; i++) if (on(i) && !layer[i]) n++;
    return n;
  };
  const report = [
    `places: ${waters.length} waters, ${landforms.length} landforms, ${landNames.length} lands; unnamed squares: ${unnamed(place, wet)} sea, ${unnamed(place, (i) => form(i) !== null)} landform, ${unnamed(land, (i) => !wet(i))} land`,
  ];
  return { table: { waters, landforms, lands: landNames, place: placeRows, land: landRows }, report };
}
