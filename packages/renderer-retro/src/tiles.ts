import { RESOURCE_BY_ID, specialFor, Terrain, type GameState, type Tile, type WorldMap } from "@civ/core";
import { coastLevel, coastPatch, DEEP, DEEP_EDGE, fogLevel, fogPatch, clearingPatch, BLEND_REACH, groundOwner, hutArt, LAND, workArt, landOwner, mountainKind, riverShape, SHORE, strokeDistance, terrainVariant, type ArtBox, type ArtSpot, type CoastPatch, type Explored, type HutKind, type Lifting, type TerrainVariant } from "@civ/renderer-api";
import { FEATURE_SHEET, RESOURCE_SHEET, spriteSurface, TERRAIN_SHEET } from "./sprites/index.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { layPicture, type SquarePictures } from "./art-holes.js";
import { drawResourceMark } from "./resource-marks.js";
import { C, PALETTE, shade, UNSEEN } from "./palette.js";
import { DETAIL, Surface } from "./surface.js";

/**
 * A map square is TILE screen pixels across. Its terrain is drawn as fine as
 * the screen (see `DETAIL`): FINE pixels across, from the terrain sheet, with
 * coasts and rivers blended in here a fine pixel at a time. Everything drawn
 * over the terrain (works, specials, units, cities, fog) stays in screen pixels.
 */
export const TILE = 16;
/** Fine pixels across a square's terrain. */
export const FINE = TILE * DETAIL;

/**
 * Screen pixels across a square of the main map: TILE, the original's, unless set larger (`setMapTile`; a
 * trial of bigger squares, 2026-11-02: "enlarge the base tile size and all that related (units, cities etc)").
 * The map then works out its terrain, shores, rivers, roads, fog and borders at that size, draws the small
 * things on a square (works, resources, villages) at the original's and lays them on it larger, and lays the
 * pictures of units and cities over the larger square; marks (shields, hit points, names) keep their size.
 * The city screen's map and the square's window keep TILE.
 */
export let MAP_TILE = TILE;
export function setMapTile(t: number): void {
  MAP_TILE = Math.max(TILE, Math.round(t));
}

/** A square's picture at TILE (FINE fine pixels), stretched to `t` screen pixels a side; cached per picture and size. */
const stretched = new WeakMap<Surface, Map<number, Surface>>();
export function stretchSquare(src: Surface, t: number): Surface {
  if (t === src.width) return src;
  let sizes = stretched.get(src);
  if (!sizes) stretched.set(src, (sizes = new Map()));
  let out = sizes.get(t);
  if (!out) {
    out = new Surface(t, t, undefined, src.k);
    out.blitScaled(src, 0, 0, t, t);
    sizes.set(t, out);
  }
  return out;
}

let scratch: Surface | null = null;
/**
 * Draws what `draw` puts on a square at the original's size (TILE) on the square at (dx, dy), `t` pixels a
 * side: straight on it at TILE, else on a clear square laid over it stretched (works, resources, villages).
 */
export function onSquare(s: Surface, dx: number, dy: number, t: number, draw: (on: Surface, x: number, y: number) => void): void {
  if (t === TILE) { draw(s, dx, dy); return; }
  scratch ??= Surface.fine(TILE, TILE);
  scratch.fill(SPRITE_CLEAR);
  draw(scratch, 0, 0);
  s.blitScaled(scratch, dx, dy, t, t, SPRITE_CLEAR);
}

/** Tiny deterministic hash for per-tile texture noise (not game RNG). */
function h(x: number, y: number, salt: number): number {
  let n = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const TERRAIN_SPRITE: Record<Terrain, string> = {
  [Terrain.Ocean]: "ocean",
  [Terrain.Grassland]: "grassland",
  [Terrain.Plains]: "plains",
  [Terrain.Forest]: "forest",
  [Terrain.Hills]: "hills",
  [Terrain.Mountains]: "mountains",
  [Terrain.Desert]: "desert",
  [Terrain.Tundra]: "tundra",
  [Terrain.Arctic]: "arctic",
  [Terrain.Swamp]: "swamp",
  [Terrain.Jungle]: "jungle",
};

/**
 * The sprite of each kind of forest and mountains (`terrainVariant`; the user's sheet of 2026-11-02): the
 * broadleaf forest and the grey mountains are the terrains' own sprites.
 */
const VARIANT_SPRITE: Record<TerrainVariant, string> = {
  broadleaf: "forest",
  pine: "forest_pine",
  birch: "forest_birch",
  autumn: "forest_autumn",
  mixed: "forest_mixed",
  grey: "mountains",
  snow: "mountains_snow",
  red: "mountains_red",
  ice: "mountains_ice",
};

const cache = new Map<string, Surface>();

/** A terrain sprite by name (TILE pixels across, FINE fine pixels). */
function terrainSprite(name: string): Surface {
  let t = cache.get(name);
  if (!t) {
    t = spriteSurface(TERRAIN_SHEET, name) ?? undefined;
    if (!t) throw new Error(`terrain sheet has no sprite for ${name}`);
    cache.set(name, t);
  }
  return t;
}

/**
 * The terrain sprite for a square (TILE pixels across, FINE fine pixels), the same on every
 * square: the art is lit from the upper left, so it is never mirrored. Forests and mountains
 * come in kinds (`squareSprite`); this is the terrain's own.
 */
export function getTile(terrain: Terrain, _x: number, _y: number): Surface {
  return terrainSprite(TERRAIN_SPRITE[terrain]);
}

/** Open sea, away from any land. */
function deepTile(_x: number, _y: number): Surface {
  return terrainSprite("deep_ocean");
}

/** The sprite of square (x, y), of `terrain`, as the viewer sees it: a forest or mountains of their kind, else the terrain's own. */
export function squareSprite(map: WorldMap, x: number, y: number, terrain: Terrain, explored?: Explored): string {
  const kind = terrain === Terrain.Forest || terrain === Terrain.Mountains ? terrainVariant(map, x, y, explored) : null;
  return kind ? VARIANT_SPRITE[kind] : TERRAIN_SPRITE[terrain];
}

/** The ground each land terrain stands on: forest, hills and mountains are drawn on grassland (glaciers on the ice, `groundAt`). */
const GROUND: Record<Terrain, Terrain> = {
  [Terrain.Ocean]: Terrain.Ocean,
  [Terrain.Grassland]: Terrain.Grassland,
  [Terrain.Plains]: Terrain.Plains,
  [Terrain.Forest]: Terrain.Grassland,
  [Terrain.Hills]: Terrain.Grassland,
  [Terrain.Mountains]: Terrain.Grassland,
  [Terrain.Desert]: Terrain.Desert,
  [Terrain.Tundra]: Terrain.Tundra,
  [Terrain.Arctic]: Terrain.Arctic,
  [Terrain.Swamp]: Terrain.Swamp,
  [Terrain.Jungle]: Terrain.Jungle,
};
/** Sprites that are all texture, with no ground showing between things standing on it. */
const SOLID = new Set<string>(["jungle"]);
/** Fewer pixels than this, apart from the ground's colour, are part of its texture (blades, specks, tufts). */
const OBJECT_MIN = 16;

interface Layers {
  /** The ground alone: the sprite with everything standing on it painted over in the ground's colour. */
  ground: Uint8Array;
  /** 1 where something stands on the ground (a tree, a peak, a dune, a pool), drawn over any blend. */
  objects: Uint8Array;
}
const layerCache = new Map<string, Layers>();

/**
 * A terrain sprite split into ground and the things on it. The ground's colour is the sprite's
 * commonest one (and colours close to it); any patch of other colours of OBJECT_MIN pixels or
 * more, joined corner to corner, is a thing standing on the ground.
 */
function layers(sprite: string): Layers {
  const hit = layerCache.get(sprite);
  if (hit) return hit;
  const src = terrainSprite(sprite).data;
  const n = FINE * FINE;
  const objects = new Uint8Array(n);
  let out: Layers;
  if (SOLID.has(sprite)) out = { ground: src.slice(0, n), objects };
  else {
    const count = new Map<number, number>();
    for (let i = 0; i < n; i++) count.set(src[i]!, (count.get(src[i]!) ?? 0) + 1);
    const base = [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const [br, bg, bb] = PALETTE[base]!;
    const near = (c: number) => { const [r, g, b] = PALETTE[c]!; return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) < 24; };
    const seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (seen[s] || near(src[s]!)) continue;
      const patch = [s];
      seen[s] = 1;
      for (let q = 0; q < patch.length; q++) {
        const at = patch[q]!;
        const px = at % FINE;
        const py = (at - px) / FINE;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= FINE || ny >= FINE) continue;
            const t = ny * FINE + nx;
            if (seen[t] || near(src[t]!)) continue;
            seen[t] = 1;
            patch.push(t);
          }
      }
      if (patch.length >= OBJECT_MIN) for (const at of patch) objects[at] = 1;
    }
    const ground = src.slice(0, n);
    for (let i = 0; i < n; i++) if (objects[i]) ground[i] = base;
    out = { ground, objects };
  }
  layerCache.set(sprite, out);
  return out;
}

/** The ground a land square on `ground` (`groundAt`) lends its neighbours where it reaches over the border. */
function groundOf(ground: Terrain): Uint8Array {
  return layers(TERRAIN_SPRITE[ground]).ground;
}

/** The ground land square (x, y) of `terrain` stands on as the viewer sees it: a glacier's is the ice's (`mountainKind`). */
function groundAt(map: WorldMap, x: number, y: number, terrain: Terrain, explored?: Explored): Terrain {
  if (terrain === Terrain.Mountains && mountainKind(map, x, Math.max(0, Math.min(map.height - 1, y)), explored) === "ice") return Terrain.Arctic;
  return GROUND[terrain];
}

/** The ground of each square of patch `p` (land; other squares keep their terrain). */
function patchGrounds(map: WorldMap, p: CoastPatch, explored?: Explored): Terrain[] {
  return p.terrain.map((t, i) => (p.depth[i] === LAND ? groundAt(map, p.x + (i % 3) - 1, p.y + Math.floor(i / 3) - 1, t, explored) : t));
}

/** Whether land square `p` has a known land neighbour on other ground (`grounds`), so their borders blend. */
function blends(p: CoastPatch, grounds: Terrain[]): boolean {
  if (p.depth[4] !== LAND) return false;
  return p.depth.some((d, i) => d === LAND && grounds[i] !== grounds[4]);
}

/** Whether a point at (u, v) of land square `p` could be pushed into a land square on other ground than its own. */
function reachesOther(p: CoastPatch, grounds: Terrain[], u: number, v: number): boolean {
  const c0 = u < BLEND_REACH ? 0 : 1;
  const c1 = u > 1 - BLEND_REACH ? 2 : 1;
  const r0 = v < BLEND_REACH ? 0 : 1;
  const r1 = v > 1 - BLEND_REACH ? 2 : 1;
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const i = r * 3 + c;
      if (i !== 4 && p.depth[i] === LAND && grounds[i] !== grounds[4]) return true;
    }
  return false;
}

const squareCache = new Map<string, Surface>();

/** Half a river's width in screen pixels at width 1: two pixels of water, more toward the sea. */
const RIVER_HALF = 1;
/** The pale bank either side of a river, in screen pixels (a fine pixel). */
const RIVER_BANK = 0.5;

/**
 * Water drawn over land and along shores: surf and shallows in the coastal sea's blues, rivers in the blues of the
 * river tile of the user's sheet of 2026-11-02 (deep blue, brighter streaks, a pale bank; the tile is not drawn
 * itself, since a river runs from square to square).
 */
export const WATER = {
  surf: shade("ice", 6),
  shallow: shade("ice", 2),
  river: shade("sea", 2),
  glint: shade("sea", 3),
  bank: shade("ice", 4),
};
/** Whether a palette colour is water drawn over land (a river, shallows), which fields leave clear. */
export function isWater(c: number): boolean {
  return c === WATER.river || c === WATER.glint || c === WATER.shallow || c === WATER.bank;
}
/** Share of a river's water that glints. */
const RIVER_GLINT = 0.07;

/**
 * A map square as drawn: its terrain sprite, with the shore and the edge of
 * deep water wandering across its borders (see `coastLevel`), and its river
 * meandering through (see `riverShape`). Where land meets land on other
 * ground (grass and sand, say), the line between them wanders too (see
 * `groundOwner`): the neighbour's ground reaches in, under whatever stands on
 * this square's (trees, peaks, dunes). Land that spills into a water square
 * shows its ground; next to the shore runs a line of surf, then a band of
 * shallows. Rivers show on land only, so a mouth runs on until it meets water.
 * Squares the player has not explored (`explored`) are left out of the blend.
 * Every fine pixel is worked out on its own (FINE x FINE), so shores and rivers
 * are as fine as the terrain art.
 */
export function terrainSquare(map: WorldMap, x: number, y: number, explored?: Explored, t = TILE): Surface {
  const p = coastPatch(map, x, y, explored);
  const river = riverShape(map, x, y, explored);
  const own = p.depth[4] === DEEP ? "deep_ocean" : squareSprite(map, x, y, p.terrain[4]!, explored);
  const plain = terrainSprite(own);
  const grounds = patchGrounds(map, p, explored);
  const blend = blends(p, grounds);
  if (!p.mixed && !river && !blend) return stretchSquare(plain, t);
  // The patch's key names its terrain; the kinds and grounds also read the squares round its own.
  const key = (t === TILE ? "" : `${t}@`) + (river ? `${p.key}|${river.key}` : p.key) + `|${own}|${grounds.join(",")}`;
  const hit = squareCache.get(key);
  if (hit) return hit;
  // Worked out a fine pixel at a time at the square's size (`t`), the art read from its FINE grid under each.
  const F = t * DETAIL;
  const out = Surface.fine(t, t);
  const sea = getTile(Terrain.Ocean, x, y).data;
  const deep = deepTile(x, y).data;
  const { surf, shallow, river: water, glint, bank } = WATER;
  for (let j = 0; j < F; j++)
    for (let i = 0; i < F; i++) {
      const u = (i + 0.5) / F;
      const v = (j + 0.5) / F;
      const at = Math.floor(v * FINE) * FINE + Math.floor(u * FINE);
      const g = p.mixed ? coastLevel(p, u, v) : p.depth[4]!;
      const k = g < SHORE ? landOwner(p, u, v) : -1;
      let c: number;
      if (!p.mixed && !blend) c = plain.data[at]!;
      else if (k === 4) {
        // Land: its own art, unless another ground reaches over the border here; what stands on it stays.
        const o = blend && !layers(own).objects[at] && reachesOther(p, grounds, u, v) ? groundOwner(p, u, v) : -1;
        c = o < 0 || grounds[o] === grounds[4] ? plain.data[at]! : groundOf(grounds[o]!)[at]!;
      } else if (k >= 0) {
        // Land reaching into a water square shows its ground, split between land neighbours as land is.
        const o = groundOwner(p, u, v);
        c = groundOf(grounds[o >= 0 ? o : k]!)[at]!;
      } else if (g < SHORE + 0.07) c = surf;
      else if (g < 0.8) c = shallow;
      else if (g < DEEP_EDGE - 0.06) c = sea[at]!;
      else if (g < DEEP_EDGE + 0.06) c = (i + j) & 1 ? sea[at]! : deep[at]!;
      else c = deep[at]!;
      if (river && k >= 0)
        // Distances in screen pixels of the original's square (dist * TILE), so a river is as wide as it was before
        // the fine grain, and as much of a larger square.
        for (const st of river.strokes) {
          const { dist, width } = strokeDistance(st, u, v);
          if (dist * TILE < width * RIVER_HALF) { c = h(i, j, 9) < RIVER_GLINT ? glint : water; break; }
          if (dist * TILE < width * RIVER_HALF + RIVER_BANK) c = bank;
        }
      out.data[j * F + i] = c;
    }
  // A square is 1 KB as fine as this; a large world is 16000 squares, so the whole of one fits.
  if (squareCache.size > 16384) squareCache.clear();
  squareCache.set(key, out);
  return out;
}

/** 4x4 ordered dither thresholds, for the fog's drifting edge and the fog lifting off a square. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

const fogCache = new Map<string, Surface>();
/** How soft the drifting edge of the fog is (see `fogLevel`): crisp, so only a thin band is dithered. */
const FOG_EDGE = 0.5;

/**
 * The fog drawn over square (x, y), or null when it has none: solid black on
 * an unexplored square, and on an explored square beside one, black drifting
 * in from that side with a ragged edge, dithered out to clear pixels
 * (SPRITE_CLEAR). Fog still lifting off a square just explored (`lifting`)
 * dissolves through the same dither. The edge follows world position, so it
 * runs on across square borders.
 */
export function fogSquare(map: WorldMap, explored: Explored, x: number, y: number, lifting?: Lifting, t = TILE): Surface | null {
  const p = fogPatch(map, explored, x, y, lifting);
  if (p.cover[4]! < 1 && !p.edge) return null;
  const key = t === TILE ? p.key : `${t}@${p.key}`;
  const hit = fogCache.get(key);
  if (hit) return hit;
  const out = new Surface(t, t);
  for (let j = 0; j < t; j++)
    for (let i = 0; i < t; i++) {
      const u = (i + 0.5) / t;
      const v = (j + 0.5) / t;
      out.data[j * t + i] = fogLevel(p, u, v, FOG_EDGE) <= BAYER[(j & 3) * 4 + (i & 3)]! ? SPRITE_CLEAR : C.BLACK!;
    }
  if (fogCache.size > 4096) fogCache.clear();
  fogCache.set(key, out);
  return out;
}

const unseenCache = new Map<string, Uint8Array | "all">();

/**
 * Which pixels of square (x, y) lie out of the viewer's sight (core's
 * `visible`), for `shadeUnseen`: null on a square in sight (never shaded, so
 * everything inside the borders and the ring beyond stands wholly clear;
 * asked for 2026-10-24), "all" on one out of sight with no seen square
 * beside it, else a mask (TILE x TILE, 1 to shade) on a square out of sight
 * where the seen squares beside it clear a ragged way in (`clearingPatch`),
 * dithered as the fog's edge is.
 */
export function unseenSquare(map: WorldMap, visible: Explored, x: number, y: number, t = TILE): Uint8Array | "all" | null {
  if (y < 0 || y >= map.height) return null;
  if (visible[y * map.width + (((x % map.width) + map.width) % map.width)]) return null;
  const p = clearingPatch(map, visible, x, y);
  if (!p.edge) return "all";
  const key = t === TILE ? p.key : `${t}@${p.key}`;
  const hit = unseenCache.get(key);
  if (hit) return hit;
  const out = new Uint8Array(t * t);
  for (let j = 0; j < t; j++)
    for (let i = 0; i < t; i++)
      out[j * t + i] = fogLevel(p, (i + 0.5) / t, (j + 0.5) / t, FOG_EDGE) > BAYER[(j & 3) * 4 + (i & 3)]! ? 0 : 1;
  if (unseenCache.size > 4096) unseenCache.clear();
  unseenCache.set(key, out);
  return out;
}

/** Shades what is drawn on the square at (dx, dy) through `UNSEEN`, where `mask` (from `unseenSquare`) says it is out of sight. */
export function shadeUnseen(s: Surface, dx: number, dy: number, mask: Uint8Array | "all", t = TILE): void {
  const k = s.k;
  for (let j = 0; j < t; j++) {
    const y = dy + j;
    if (y < 0 || y >= s.height) continue;
    for (let i = 0; i < t; i++) {
      const x = dx + i;
      if (x < 0 || x >= s.width || (mask !== "all" && !mask[j * t + i])) continue;
      let o = y * k * s.fw + x * k;
      for (let b = 0; b < k; b++, o += s.fw) for (let a = 0; a < k; a++) s.data[o + a] = UNSEEN[s.data[o + a]!]!;
    }
  }
}

/** A special's icon's name in the resources sheet (lower case, words joined: "Offshore Oil" is offshore_oil). */
const iconName = (name: string) => name.toLowerCase().replace(/ /g, "_");

/** A special's picture by its name (`iconName`). */
export function specialSprite(name: string): Surface | null {
  return spriteSurface(RESOURCE_SHEET, iconName(name));
}

/**
 * The mark of the resource on the square at (dx, dy), `t` a side, as `viewer` knows it (`drawResourceMark`), for a
 * city standing on it: none for oil under a rig; `shaded` out of sight, as the city's picture is.
 */
export function drawSpecialMark(s: Surface, dx: number, dy: number, state: GameState, tile: Tile, viewer: number, t = TILE, shaded = false): void {
  const name = specialFor(state, tile, viewer)?.name;
  if (!name || tile.rig) return;
  drawResourceMark(s, dx, dy, iconName(tile.terrain === Terrain.Ocean && RESOURCE_BY_ID[name]?.offshore ? `Offshore ${name}` : name), t, shaded);
}

/**
 * How much of a square larger than the original's a resource's icon takes across (asked for 2026-11-02: "on tile
 * resources are bit too big now - reduce size": stretched with the 20-pixel squares they had filled them): on the
 * 20-pixel squares the icon's own 32 fine pixels, as drawn. Never smaller than that, so on the original's squares
 * (the phone, the city screen, the square's window, the map zoomed out) an icon is its own size, no pixel dropped.
 */
export const SPECIAL_SHARE = 0.8;

/**
 * A square's special resource as `viewer` knows it (`specialFor`: none while a resource is still hidden from it), drawn
 * over its terrain on a square `t` pixels a side, centred, `SPECIAL_SHARE` of it across; with `corner`, where a city or
 * a work's picture stands on the square, as its mark in the top right corner (`drawResourceMark`), the city or the
 * work whole beside it. Given `pics`, oil on land
 * with a road built to it (so serving whoever holds the land, `resourceRoaded`; a river alone serves too, but raises
 * no pump in the wilds) stands as an oil pump in its place, the user's picture (2026-11-02, the sheet of tile
 * improvements), as the rig stands for the oil at sea.
 */
export function drawSpecial(s: Surface, dx: number, dy: number, state: GameState, tile: Tile, viewer: number, t = TILE, pics?: SquarePictures, corner = false): void {
  const name = specialFor(state, tile, viewer)?.name;
  // An oil rig stands for the oil under it (the rig's picture, or `drawRig`).
  if (!name || tile.rig) return;
  if (pics && name === "Oil" && tile.terrain !== Terrain.Ocean && (tile.road || tile.railroad) && workArt("oil_pump")) {
    layPicture(s, { id: "oil_pump", work: true, x: dx, y: dy, w: t, h: t, clip: pics.room }, pics.laid);
    return;
  }
  // A resource's deposit at sea has an icon of its own (`ResourceRule.offshore`; since save version 55).
  const sprite = tile.terrain === Terrain.Ocean && RESOURCE_BY_ID[name]?.offshore ? `Offshore ${name}` : name;
  if (corner) { drawResourceMark(s, dx, dy, iconName(sprite), t); return; }
  const icon = specialSprite(sprite);
  if (!icon) { s.rect(dx + 10, dy + 10, 3, 3, C.YELLOW!); return; }
  const k = s.k;
  // In whole fine pixels, the margin either side alike.
  const fine = Math.max(icon.fw, Math.round(t * SPECIAL_SHARE * k));
  const off = Math.floor((t * k - fine) / 2) / k;
  if (fine === icon.fw) s.blit(icon, dx + off, dy + off, SPRITE_CLEAR);
  else s.blitScaled(icon, dx + off, dy + off, fine / k, fine / k, SPRITE_CLEAR);
}

/**
 * A minor tribe's village. Given `picture` (its kind, `hutKind`, and where the screen lays its pictures), a kind the
 * user drew (`hutArt`) is laid as its picture (`layPicture`, `t` pixels a side; the apps lay it there as it is, what
 * the screen draws over it later showing through) and returned; else the drawn huts, at the original's size.
 */
export function drawHut(s: Surface, dx: number, dy: number, picture?: { kind: HutKind } & SquarePictures, t = TILE): ArtSpot | null {
  if (picture && hutArt(picture.kind)) return layPicture(s, { id: picture.kind, hut: true, x: dx, y: dy, w: t, h: t, clip: picture.room }, picture.laid);
  const hut = spriteSurface(FEATURE_SHEET, "hut");
  if (hut) s.blit(hut, dx, dy, SPRITE_CLEAR);
  return null;
}
