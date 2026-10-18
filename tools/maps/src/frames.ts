import type { Pt } from "./geo.js";

/**
 * How a premade world is cut out of the globe. Longitude and latitude map
 * to grid columns and rows through piecewise-linear breakpoints, so a frame
 * can give some regions more squares than others (Earth widens Europe and
 * the Middle East so their civilizations are not crammed together).
 */
export interface Frame {
  id: string;
  name: string;
  /** Name of the exported constant in the generated module. */
  constName: string;
  /** [longitude, column] breakpoints, columns ascending (0..80). */
  lon: [number, number][];
  /** [latitude, row] breakpoints, rows ascending (0..50). */
  lat: [number, number][];
  /** True when the frame spans the whole globe east to west. */
  global: boolean;
  /** First and last rows are polar ice. */
  polar: boolean;
  /** Column 0 is forced to sea so the east-west wrap cannot join two coasts by land. */
  seam: boolean;
  /** Rivers up to this Natural Earth scale rank are drawn... */
  riverRank: number;
  /** ...plus these by name. */
  riverNames?: string[];
  /** Lakes up to this scale rank are cut out of the land. */
  lakeRank: number;
  /** Historical homeland of every civilization with one in the frame. */
  homes: Record<string, Pt>;
  /** Lines drawn as sea (straits the grid would otherwise close). */
  water?: Pt[][];
  /** Lines drawn as land (isthmuses the grid would otherwise cut). */
  land?: Pt[][];
  /** Outlines filled with sea (waters the data no longer has). */
  seas?: Pt[][];
}

/** The Aral Sea before it was drained for irrigation. */
const ARAL: Pt[] = [[58.3, 45.5], [59.2, 46.6], [61.0, 46.7], [61.9, 45.4], [61.2, 44.0], [59.6, 43.4], [58.3, 44.2]];

const ROME: Pt = [12.5, 41.9];
const BABYLON: Pt = [44.4, 32.5];
const THEBES: Pt = [32.65, 25.7];
const ATHENS: Pt = [23.7, 38.0];
const BERLIN: Pt = [13.4, 52.5];
const MOSCOW: Pt = [37.6, 55.75];
const PARIS: Pt = [2.35, 48.85];
const LONDON: Pt = [-0.1, 51.5];
const TOLEDO: Pt = [-4.0, 39.86];
const TRONDHEIM: Pt = [10.4, 63.4];
const HATTUSA: Pt = [34.6, 40.0];
const PERSEPOLIS: Pt = [52.9, 29.9];
const JERUSALEM: Pt = [35.2, 31.8];

export const FRAMES: Frame[] = [
  {
    id: "earth",
    name: "Earth",
    constName: "EARTH",
    // The seam runs through the Bering Strait; the Old World gets the most columns.
    lon: [[-168, 0], [-30, 27], [-12, 31], [60, 56], [150, 74], [192, 80]],
    lat: [[84, 0], [72, 4], [60, 8], [30, 22], [-35, 44], [-62, 49], [-80, 50]],
    global: true,
    polar: true,
    seam: false,
    riverRank: 2,
    riverNames: ["Euphrates", "Firat", "Al Furat", "Tigris", "Dicle", "Indus", "Ganges", "Huang", "Volga", "Niger", "Rhine", "Rhein", "Murray", "Orinoco"],
    lakeRank: 1,
    seas: [ARAL],
    homes: {
      romans: ROME,
      babylonians: BABYLON,
      egyptians: THEBES,
      greeks: ATHENS,
      chinese: [108.7, 34.35],
      indians: [85.1, 25.6],
      aztecs: [-99.1, 19.4],
      zulus: [31.4, -28.3],
      germans: BERLIN,
      americans: [-77.0, 38.9],
      russians: MOSCOW,
      french: PARIS,
      english: LONDON,
      mongols: [102.8, 47.2],
      spanish: TOLEDO,
      vikings: TRONDHEIM,
      hittites: HATTUSA,
      persians: PERSEPOLIS,
      hebrews: JERUSALEM,
      japanese: [135.77, 35.01],
    },
  },
  {
    id: "europe",
    name: "Europe",
    constName: "EUROPE",
    lon: [[-11, 0], [47, 80]],
    lat: [[70.5, 0], [33, 50]],
    global: false,
    polar: false,
    seam: true,
    riverRank: 5,
    riverNames: ["Rhône", "Po", "Thames", "Don", "Dniester", "Garonne", "Duero", "Jordan", "Tisza", "Drava"],
    lakeRank: 3,
    homes: {
      english: LONDON,
      french: PARIS,
      spanish: TOLEDO,
      germans: BERLIN,
      romans: ROME,
      greeks: ATHENS,
      vikings: TRONDHEIM,
      russians: MOSCOW,
      hittites: HATTUSA,
    },
  },
  {
    id: "middle-east",
    name: "Middle East",
    constName: "MIDDLE_EAST",
    lon: [[20, 0], [70, 80]],
    lat: [[46, 0], [12, 50]],
    global: false,
    polar: false,
    seam: true,
    riverRank: 6,
    lakeRank: 4,
    seas: [ARAL],
    homes: {
      egyptians: THEBES,
      babylonians: BABYLON,
      greeks: ATHENS,
      hittites: HATTUSA,
      persians: PERSEPOLIS,
      indians: [68.1, 27.3],
      mongols: [66.97, 39.65],
      hebrews: JERUSALEM,
    },
  },
];

/** Piecewise-linear map from a value to grid units through [value, unit] breakpoints. */
export function toGrid(points: readonly [number, number][], v: number): number {
  const asc = points[points.length - 1]![0] > points[0]![0];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, ta] = points[i]!;
    const [b, tb] = points[i + 1]!;
    const last = i === points.length - 2;
    if ((asc ? v <= b : v >= b) || last) return ta + ((v - a) * (tb - ta)) / (b - a);
  }
  return points[0]![1];
}

/** Inverse of `toGrid`: grid units back to a value. */
export function fromGrid(points: readonly [number, number][], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const [a, ta] = points[i]!;
    const [b, tb] = points[i + 1]!;
    if (t <= tb || i === points.length - 2) return a + ((t - ta) * (b - a)) / (tb - ta);
  }
  return points[0]![0];
}

/** Longitude into the frame's own range (a global frame may run past 180). */
export function frameLon(frame: Frame, lon: number): number {
  if (!frame.global) return lon;
  const min = frame.lon[0]![0];
  let v = lon;
  while (v < min) v += 360;
  while (v >= min + 360) v -= 360;
  return v;
}

export function project(frame: Frame, [lon, lat]: Pt): [number, number] {
  return [toGrid(frame.lon, frameLon(frame, lon)), toGrid(frame.lat, lat)];
}

/** Longitude back into the data's -180..180 range. */
export function dataLon(lon: number): number {
  let v = lon;
  while (v >= 180) v -= 360;
  while (v < -180) v += 360;
  return v;
}
