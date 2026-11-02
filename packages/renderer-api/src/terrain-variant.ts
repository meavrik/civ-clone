import { getTile, NEIGHBOURS, Terrain, type WorldMap } from "@civ/core";
import { knownSquare, type Explored } from "./coast.js";
import { valueNoise } from "./hash.js";

/**
 * Kinds of forest and mountains (the user's terrain sheet of 2026-11-02, asked for: "add the forest variety for
 * forests around the map - same for mountains"). Only the picture changes: the rules know one forest and one
 * mountains. A square's kind comes from the land round it, as a climate would have it (pines and birches by the
 * tundra, glaciers beside the ice, red rock beside the desert, snow on the inner peaks of a range), and where that
 * says nothing from slow noise of its world position, so a forest is one kind for some squares and another further
 * on. No randomness: the same square is the same kind every frame and game.
 *
 * Only squares the viewer has explored count (`explored`), as the shores do, so nothing is told of land still
 * hidden; a square at the edge of the explored land may take another kind as the land beside it comes to light.
 */
export type ForestKind = "broadleaf" | "pine" | "birch" | "autumn" | "mixed";
export type MountainKind = "grey" | "snow" | "red" | "ice";
export type TerrainVariant = ForestKind | MountainKind;

/** Lattice points of the noise per square: patches of one kind about this many squares across, inverted. */
const PATCH = 0.12;

/** What lies round a square, counting only squares the viewer knows. */
interface Surroundings {
  /** Tundra counts 1, arctic 2. */
  cold: number;
  arctic: number;
  /** Jungle and swamp. */
  wet: number;
  desert: number;
  plains: number;
  mountains: number;
  hills: number;
}

function surroundings(map: WorldMap, x: number, y: number, explored?: Explored): Surroundings {
  const s: Surroundings = { cold: 0, arctic: 0, wet: 0, desert: 0, plains: 0, mountains: 0, hills: 0 };
  for (const [dx, dy] of NEIGHBOURS) {
    if (!knownSquare(map, explored, x + dx, y + dy)) continue;
    const t = getTile(map, x + dx, Math.max(0, Math.min(map.height - 1, y + dy)))?.terrain;
    if (t === Terrain.Tundra) s.cold++;
    else if (t === Terrain.Arctic) { s.cold += 2; s.arctic++; }
    else if (t === Terrain.Jungle || t === Terrain.Swamp) s.wet++;
    else if (t === Terrain.Desert) s.desert++;
    else if (t === Terrain.Plains) s.plains++;
    else if (t === Terrain.Mountains) s.mountains++;
    else if (t === Terrain.Hills) s.hills++;
  }
  return s;
}

/** Slow noise in -1..1 at the square's middle, wrapping with the map. */
function patch(map: WorldMap, x: number, y: number, salt: number): number {
  return valueNoise(x + 0.5, y + 0.5, PATCH, map.width, salt);
}

/**
 * A forest's kind. Its chill is a slow noise, raised by tundra and ice beside it and by hills and peaks, lowered by
 * jungle, swamp and desert: the coldest are pines, then mixed woods and birches, then the broadleaf woods, autumn
 * colours in patches of their own among them.
 */
export function forestKind(map: WorldMap, x: number, y: number, explored?: Explored): ForestKind {
  const s = surroundings(map, x, y, explored);
  const chill = patch(map, x, y, 61) + 0.45 * Math.min(2, s.cold) + 0.12 * Math.min(3, s.mountains + s.hills) - 0.3 * Math.min(2, s.wet + s.desert);
  if (chill > 0.5) return "pine";
  const second = patch(map, x, y, 67);
  if (chill > 0.2) return second < -0.1 ? "mixed" : "birch";
  if (chill < -0.5 || s.wet > 0) return "broadleaf";
  if (second > 0.22) return "autumn";
  return second < -0.3 ? "mixed" : "broadleaf";
}

/**
 * A mountain's kind: a glacier beside the ice, snow beside the tundra, red rock beside the desert, snow on the inner
 * peaks of a range (four or more mountains round it), else grey, with snowy and red ranges in patches.
 */
export function mountainKind(map: WorldMap, x: number, y: number, explored?: Explored): MountainKind {
  const s = surroundings(map, x, y, explored);
  if (s.arctic > 0) return "ice";
  if (s.cold > 0) return "snow";
  if (s.desert > 0) return "red";
  const n = patch(map, x, y, 71);
  if (s.mountains >= 4 && n > -0.1) return "snow";
  if (n > 0.5) return "snow";
  if (n < -0.5 || (s.plains >= 3 && n < -0.15)) return "red";
  return "grey";
}

/** The kind of a forest or mountain square, as the viewer sees it; null for any other terrain. */
export function terrainVariant(map: WorldMap, x: number, y: number, explored?: Explored): TerrainVariant | null {
  const t = getTile(map, x, y)?.terrain;
  if (t === Terrain.Forest) return forestKind(map, x, y, explored);
  if (t === Terrain.Mountains) return mountainKind(map, x, y, explored);
  return null;
}
