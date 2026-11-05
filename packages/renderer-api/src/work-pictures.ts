import { NEIGHBOURS, Terrain, type City, type Tile, type WorldMap } from "@civ/core";
import { hash } from "./hash.js";
import type { ArtBox, ArtSpot } from "./art.js";
import { WORK_ART } from "./work-art.js";

/**
 * The user's pictures of tile improvements (2026-11-02, their sheet of sixteen: "implement updated tile improvements"),
 * shown as they are on the squares that hold them (`apps/web/src/works/<id>.png`, cut from the sheet pixel for pixel by
 * tools/sprites/works/cut.ts): irrigated fields of four kinds, a mine and a quarry, an oil pump, an offshore rig, a
 * fishing net and a pier. Only the pictures: the rules know one irrigation and one mine. The sheet's roads and bridge
 * are drawn in code along the roads' courses (in its colours), and its logging camp waits for a work the rules have
 * not got.
 */
export type WorkPicture =
  | "fields_ploughed" | "fields_crops" | "fields_wheat" | "fields_irrigated"
  | "mine" | "quarry" | "oil_pump" | "oil_rig" | "fishing_net" | "pier";
export { WORK_ART };

/** The kinds of field that suit each land, the likelier repeated; a river's square has canals (`fieldsPicture`). */
const FIELDS_ON: Partial<Record<Terrain, readonly WorkPicture[]>> = {
  [Terrain.Grassland]: ["fields_crops", "fields_crops", "fields_irrigated"],
  [Terrain.Plains]: ["fields_wheat", "fields_wheat", "fields_crops"],
  [Terrain.Desert]: ["fields_ploughed", "fields_ploughed", "fields_wheat"],
  [Terrain.Hills]: ["fields_crops", "fields_ploughed"],
  [Terrain.Tundra]: ["fields_ploughed"],
};

/** The kinds of field that suit a square, the likelier repeated; a river's has canals. */
export function fieldKinds(tile: Pick<Tile, "terrain" | "river">): readonly WorkPicture[] {
  return tile.river ? ["fields_irrigated", "fields_irrigated", ...(FIELDS_ON[tile.terrain] ?? ["fields_crops"])] : FIELDS_ON[tile.terrain] ?? ["fields_crops"];
}

/**
 * The fields of an irrigated square, by its land: green crops on grassland and hills, wheat on the plains, ploughed
 * earth in the desert and the tundra, one of a few for each land by a hash of the square; on a river, fields with
 * canals of its water.
 */
export function fieldsPicture(map: WorldMap, x: number, y: number, tile: Pick<Tile, "terrain" | "river">): WorkPicture {
  if (tile.river) return "fields_irrigated";
  const kinds = FIELDS_ON[tile.terrain] ?? ["fields_crops"];
  const wx = ((x % map.width) + map.width) % map.width;
  return kinds[Math.floor(hash(wx, y, 89) * kinds.length)]!;
}

/** A mine's picture: a quarry cut into mountains, a timbered shaft anywhere else (hills, desert). */
export function minePicture(terrain: Terrain): WorkPicture {
  return terrain === Terrain.Mountains ? "quarry" : "mine";
}

/** Order in which a city looks round it for the sea to set its pier in: the sides first, south, east, west, north. */
const PIER_SIDES: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [-1, 0], [0, -1], ...NEIGHBOURS.filter(([dx, dy]) => dx !== 0 && dy !== 0)];

/**
 * The square of the sea where a city with a Harbour has its pier, as the viewer knows the land (`known`): the first
 * of its neighbours, sides before corners, that is sea; null for a city inland or without a Harbour.
 */
export function pierSquare(map: WorldMap, city: Pick<City, "x" | "y" | "buildings">, known: (x: number, y: number) => boolean): [number, number] | null {
  if (!city.buildings.includes("harbour")) return null;
  for (const [dx, dy] of PIER_SIDES) {
    const x = (((city.x + dx) % map.width) + map.width) % map.width;
    const y = city.y + dy;
    if (y < 0 || y >= map.height || !known(x, y)) continue;
    if (map.tiles[y * map.width + x]!.terrain === Terrain.Ocean) return [x, y];
  }
  return null;
}

/**
 * One scale for all, the sheet's cell to a map square (`WORK_SQUARE` of its pixels), so fields fill most of a square
 * and a mine stands smaller, as the sheet draws them; each centred on its square.
 */
export const WORK_SQUARE = 350;

/** Whether `id` is an improvement with a picture of the user's. */
export function workArt(id: string): boolean {
  return id in WORK_ART;
}

/** Where improvement picture `spot.id` goes on its square (the spot's box). */
export function workArtPlace(spot: ArtSpot): ArtBox | null {
  const size = WORK_ART[spot.id];
  if (!size) return null;
  const [w, h] = size;
  const k = Math.min(1 / WORK_SQUARE, 0.97 / w, 0.97 / h);
  const fw = w * k, fh = h * k;
  return { x: spot.x + ((1 - fw) / 2) * spot.w, y: spot.y + ((1 - fh) / 2) * spot.h, w: fw * spot.w, h: fh * spot.h };
}
