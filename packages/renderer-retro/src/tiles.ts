import { specialOf, Terrain, type Tile, type WorldMap } from "@civ/core";
import { coastLevel, coastPatch, DEEP, DEEP_EDGE, fogLevel, fogPatch, clearingPatch, BLEND_REACH, groundOwner, LAND, landOwner, riverShape, SHORE, strokeDistance, type CoastPatch, type Explored, type Lifting } from "@civ/renderer-api";
import { FEATURE_SHEET, RESOURCE_SHEET, spriteSurface, TERRAIN_SHEET } from "./sprites/index.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
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

const cache = new Map<number, Surface>();

/**
 * The terrain sprite for a square (TILE pixels across, FINE fine pixels), the same on every
 * square: the art is lit from the upper left, so it is never mirrored.
 */
export function getTile(terrain: Terrain, _x: number, _y: number): Surface {
  let t = cache.get(terrain);
  if (!t) {
    t = spriteSurface(TERRAIN_SHEET, TERRAIN_SPRITE[terrain]) ?? undefined;
    if (!t) throw new Error(`terrain sheet has no sprite for ${TERRAIN_SPRITE[terrain]}`);
    cache.set(terrain, t);
  }
  return t;
}

/** Open sea, away from any land. */
function deepTile(_x: number, _y: number): Surface {
  let t = cache.get(-1);
  if (!t) {
    t = spriteSurface(TERRAIN_SHEET, "deep_ocean") ?? undefined;
    if (!t) throw new Error("terrain sheet has no sprite for deep_ocean");
    cache.set(-1, t);
  }
  return t;
}

/** The ground each land terrain stands on: forest, hills and mountains are drawn on grassland. */
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
/** Terrains that are all texture, with no ground showing between things standing on it. */
const SOLID = new Set<Terrain>([Terrain.Jungle]);
/** Fewer pixels than this, apart from the ground's colour, are part of its texture (blades, specks, tufts). */
const OBJECT_MIN = 16;

interface Layers {
  /** The ground alone: the sprite with everything standing on it painted over in the ground's colour. */
  ground: Uint8Array;
  /** 1 where something stands on the ground (a tree, a peak, a dune, a pool), drawn over any blend. */
  objects: Uint8Array;
}
const layerCache = new Map<Terrain, Layers>();

/**
 * A terrain sprite split into ground and the things on it. The ground's colour is the sprite's
 * commonest one (and colours close to it); any patch of other colours of OBJECT_MIN pixels or
 * more, joined corner to corner, is a thing standing on the ground.
 */
function layers(terrain: Terrain): Layers {
  const hit = layerCache.get(terrain);
  if (hit) return hit;
  const src = getTile(terrain, 0, 0).data;
  const n = FINE * FINE;
  const objects = new Uint8Array(n);
  let out: Layers;
  if (SOLID.has(terrain)) out = { ground: src.slice(0, n), objects };
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
  layerCache.set(terrain, out);
  return out;
}

/** The ground a land square of `terrain` lends its neighbours where it reaches over the border. */
function groundOf(terrain: Terrain): Uint8Array {
  return layers(GROUND[terrain]).ground;
}

/** Whether land square `p` has a known land neighbour on other ground, so their borders blend. */
function blends(p: CoastPatch): boolean {
  if (p.depth[4] !== LAND) return false;
  const own = GROUND[p.terrain[4]!];
  return p.depth.some((d, i) => d === LAND && GROUND[p.terrain[i]!] !== own);
}

/** Whether a point at (u, v) of land square `p` could be pushed into a land square on other ground than `own`. */
function reachesOther(p: CoastPatch, own: Terrain, u: number, v: number): boolean {
  const c0 = u < BLEND_REACH ? 0 : 1;
  const c1 = u > 1 - BLEND_REACH ? 2 : 1;
  const r0 = v < BLEND_REACH ? 0 : 1;
  const r1 = v > 1 - BLEND_REACH ? 2 : 1;
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const i = r * 3 + c;
      if (i !== 4 && p.depth[i] === LAND && GROUND[p.terrain[i]!] !== own) return true;
    }
  return false;
}

const squareCache = new Map<string, Surface>();

/** Half a river's width in screen pixels at width 1: two pixels of water, more toward the sea. */
const RIVER_HALF = 1;
/** The pale bank either side of a river, in screen pixels (a fine pixel). */
const RIVER_BANK = 0.5;

/** Water drawn over land and along shores, in the coastal sea's blues: surf, shallows, rivers. */
export const WATER = {
  surf: shade("ice", 6),
  shallow: shade("ice", 2),
  river: shade("ocean", 7),
  glint: shade("ice", 3),
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
export function terrainSquare(map: WorldMap, x: number, y: number, explored?: Explored): Surface {
  const p = coastPatch(map, x, y, explored);
  const river = riverShape(map, x, y, explored);
  const own = p.terrain[4]!;
  const plain = p.depth[4] === DEEP ? deepTile(x, y) : getTile(own, x, y);
  const blend = blends(p);
  if (!p.mixed && !river && !blend) return plain;
  const key = river ? `${p.key}|${river.key}` : p.key;
  const hit = squareCache.get(key);
  if (hit) return hit;
  const out = Surface.fine(TILE, TILE);
  const sea = getTile(Terrain.Ocean, x, y).data;
  const deep = deepTile(x, y).data;
  const { surf, shallow, river: water, glint, bank } = WATER;
  for (let j = 0; j < FINE; j++)
    for (let i = 0; i < FINE; i++) {
      const u = (i + 0.5) / FINE;
      const v = (j + 0.5) / FINE;
      const at = j * FINE + i;
      const g = p.mixed ? coastLevel(p, u, v) : p.depth[4]!;
      const k = g < SHORE ? landOwner(p, u, v) : -1;
      let c: number;
      if (!p.mixed && !blend) c = plain.data[at]!;
      else if (k === 4) {
        // Land: its own art, unless another ground reaches over the border here; what stands on it stays.
        const o = blend && !layers(own).objects[at] && reachesOther(p, GROUND[own], u, v) ? groundOwner(p, u, v) : -1;
        c = o < 0 || GROUND[p.terrain[o]!] === GROUND[own] ? plain.data[at]! : groundOf(p.terrain[o]!)[at]!;
      } else if (k >= 0) {
        // Land reaching into a water square shows its ground, split between land neighbours as land is.
        const o = groundOwner(p, u, v);
        c = groundOf(p.terrain[o >= 0 ? o : k]!)[at]!;
      } else if (g < SHORE + 0.07) c = surf;
      else if (g < 0.8) c = shallow;
      else if (g < DEEP_EDGE - 0.06) c = sea[at]!;
      else if (g < DEEP_EDGE + 0.06) c = (i + j) & 1 ? sea[at]! : deep[at]!;
      else c = deep[at]!;
      if (river && k >= 0)
        // Distances in screen pixels (dist * TILE), so a river is as wide as it was before the fine grain.
        for (const st of river.strokes) {
          const { dist, width } = strokeDistance(st, u, v);
          if (dist * TILE < width * RIVER_HALF) { c = h(i, j, 9) < RIVER_GLINT ? glint : water; break; }
          if (dist * TILE < width * RIVER_HALF + RIVER_BANK) c = bank;
        }
      out.data[at] = c;
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
export function fogSquare(map: WorldMap, explored: Explored, x: number, y: number, lifting?: Lifting): Surface | null {
  const p = fogPatch(map, explored, x, y, lifting);
  if (p.cover[4]! < 1 && !p.edge) return null;
  const hit = fogCache.get(p.key);
  if (hit) return hit;
  const out = new Surface(TILE, TILE);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const u = (i + 0.5) / TILE;
      const v = (j + 0.5) / TILE;
      out.data[j * TILE + i] = fogLevel(p, u, v, FOG_EDGE) <= BAYER[(j & 3) * 4 + (i & 3)]! ? SPRITE_CLEAR : C.BLACK!;
    }
  if (fogCache.size > 4096) fogCache.clear();
  fogCache.set(p.key, out);
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
export function unseenSquare(map: WorldMap, visible: Explored, x: number, y: number): Uint8Array | "all" | null {
  if (y < 0 || y >= map.height) return null;
  if (visible[y * map.width + (((x % map.width) + map.width) % map.width)]) return null;
  const p = clearingPatch(map, visible, x, y);
  if (!p.edge) return "all";
  const hit = unseenCache.get(p.key);
  if (hit) return hit;
  const out = new Uint8Array(TILE * TILE);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++)
      out[j * TILE + i] = fogLevel(p, (i + 0.5) / TILE, (j + 0.5) / TILE, FOG_EDGE) > BAYER[(j & 3) * 4 + (i & 3)]! ? 0 : 1;
  if (unseenCache.size > 4096) unseenCache.clear();
  unseenCache.set(p.key, out);
  return out;
}

/** Shades what is drawn on the square at (dx, dy) through `UNSEEN`, where `mask` (from `unseenSquare`) says it is out of sight. */
export function shadeUnseen(s: Surface, dx: number, dy: number, mask: Uint8Array | "all"): void {
  const k = s.k;
  for (let j = 0; j < TILE; j++) {
    const y = dy + j;
    if (y < 0 || y >= s.height) continue;
    for (let i = 0; i < TILE; i++) {
      const x = dx + i;
      if (x < 0 || x >= s.width || (mask !== "all" && !mask[j * TILE + i])) continue;
      let o = y * k * s.fw + x * k;
      for (let b = 0; b < k; b++, o += s.fw) for (let a = 0; a < k; a++) s.data[o + a] = UNSEEN[s.data[o + a]!]!;
    }
  }
}

/** A special's picture by its name (lower case in the resources sheet). */
export function specialSprite(name: string): Surface | null {
  return spriteSurface(RESOURCE_SHEET, name.toLowerCase());
}

/** A square's special resource, drawn over its terrain. */
export function drawSpecial(s: Surface, dx: number, dy: number, tile: Tile): void {
  const name = specialOf(tile)?.name;
  const icon = name ? specialSprite(name) : null;
  if (icon) { s.blit(icon, dx, dy, SPRITE_CLEAR); return; }
  s.rect(dx + 10, dy + 10, 3, 3, C.YELLOW!);
}

/** A minor tribe's village. */
export function drawHut(s: Surface, dx: number, dy: number): void {
  const hut = spriteSurface(FEATURE_SHEET, "hut");
  if (hut) s.blit(hut, dx, dy, SPRITE_CLEAR);
}
