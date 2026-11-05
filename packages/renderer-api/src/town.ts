import { BUILDINGS, getTile, knows, Terrain, type City, type GameState } from "@civ/core";
import { artLot, buildingArt } from "./art.js";
import { HOMES, homeAge, PICTURES, TREES, type Picture } from "./cityview.js";
import { hash, valueNoise } from "./hash.js";
import { HOUSE_ART } from "./house-art.js";
import { houseChoices, pickHouse } from "./houses.js";
import { wonderSite } from "./wonder-stages.js";
import { fieldsPicture, minePicture, type WorkPicture } from "./work-pictures.js";

/**
 * The city view as a town seen from above and to one side (2026-11-05, asked for: "redo the city view ... all together to
 * be more isometric and as a real town look"; every picture of the user's is drawn from a corner, so they stand on one
 * ground). The scene is the city's own square of the map and the squares round it, in `u` (down and right on the
 * screen, the map's east) and `v` (down and left, the map's south), counted in lots, `LOTS_A_SQUARE` to a square of the
 * map, with the crossroads at the town's heart at 0, 0: so the sea, hills and woods beyond the houses are the city's
 * own, and the town stops at the shore.
 *
 * Streets cross every `PITCH` lots, and each block between them holds four lots. The palace stands behind the
 * crossroads and the square before it, the marketplace on the square; each improvement has its own place round them,
 * built or not, and works that smoke or sprawl stand on one side beyond; wonders take a block each in the order they
 * rise, the back of the town first; and homes fill what is left outward. So nothing moves as a city grows: a lot keeps
 * what stands on it until something takes it. Variety comes from `hash`, never the game's RNG.
 */

/** The city view's size in retro pixels; the modern renderer paints it three times larger. */
export const SCENE_W = 316;
export const SCENE_H = 174;
/** A lot's diamond on the screen, retro pixels across and down. */
export const LOT_W = 20;
export const LOT_H = 10;
/** Where the crossroads stands in the scene: below the middle, room for the tall things at the back. */
const TOWN_X = SCENE_W / 2;
const TOWN_Y = 100;
/** Lots to a square of the map, along each side. */
export const LOTS_A_SQUARE = 8;
/** How far the squares round the city are read: the city's own and two out, as far as the scene's corners reach. */
const REACH = 2;
const SIDE = 2 * REACH + 1;
/** The width of a street, and of the main ones through the crossroads, in lots. */
const STREET = 0.34;
const MAIN_STREET = 0.46;
/** A street to the next: two lots and the street's room. */
const PITCH = 2.4;
/** Blocks either side of the crossroads. */
const BLOCKS = 4;
/** How much of a lot a house fills: its width in retro pixels for each of its sheet's pixels. */
const HOUSE_SCALE = 0.076;
/** From this wide a building takes a block of its own, not a lot. */
const WHOLE_BLOCK = 26;
/** The room left over a block for what stands on it: no picture stands taller (`artLot`). */
const TALLEST = 46;
const GATE_H = 26;
/** A patch of fields beside the square that holds them, in retro pixels (the sheet's `WORK_SQUARE` to it). */
const FIELD_SIZE = 46;
const MINE_SIZE = 38;

/** Works that smoke or sprawl: they keep to one side of the town. */
const OUTSKIRTS = new Set(["factory", "mfg_plant", "power_plant", "hydro_plant", "nuclear_plant", "recycling_center", "solar_plant", "sdi_defense"]);
/** What stands by the sea, where the land has one. */
const SEAFRONT = new Set(["harbour", "lighthouse", "colossus", "magellans", "darwins_voyage"]);

export const isoX = (u: number, v: number): number => TOWN_X + ((u - v) * LOT_W) / 2;
export const isoY = (u: number, v: number): number => TOWN_Y + ((u + v) * LOT_H) / 2;
/** The lot coordinates of a point of the scene. */
export const isoU = (x: number, y: number): number => (x - TOWN_X) / LOT_W + (y - TOWN_Y) / LOT_H;
export const isoV = (x: number, y: number): number => (y - TOWN_Y) / LOT_H - (x - TOWN_X) / LOT_W;

export interface SceneItem {
  /** The improvement or wonder shown ("city_walls" for the walls and their gate), a house's kind and lot ("bakery@12"), or "" for trees and hills. */
  id: string;
  kind: "wonder" | "building" | "home" | "tree" | "walls" | "gate" | "peak" | "mound" | "well" | "work";
  /** Its drawn picture, where it has one. */
  pic: Picture;
  /** Left edge and ground line. */
  x: number;
  y: number;
  /** The room it takes on the screen. */
  w: number;
  h: number;
  /** A wonder still going up: the picture of its stage (`wonderSite`), on the lot it will take finished. */
  site?: string;
  /** The house standing here (`HOUSES`). */
  house?: string;
  /** A tile improvement's picture (`WorkPicture`). */
  work?: WorkPicture;
  /** A tree's kind: 0 and 1 broad-leaved, 2 a pine, 3 a poplar. */
  tree?: number;
  /** A stretch of wall or a tower: its foot in lots, how tall in retro pixels, and which way it faces. */
  wall?: WallPiece;
}

export interface WallPiece {
  u0: number; v0: number; u1: number; v1: number;
  tall: number;
  /** A tower, not a stretch of wall. */
  tower?: boolean;
  /** Which side of the town it stands on: merlons along its outer edge. */
  side: "north" | "east" | "south" | "west";
}

export interface TownStreet {
  /** Its course in lots: u0, v0, u1, v1... */
  pts: number[];
  /** Its width in lots. */
  w: number;
  surface: "dirt" | "stone" | "asphalt";
}

/** A box of the ground, in lots. */
export interface GroundBox { u0: number; v0: number; u1: number; v1: number }

export interface CityScene {
  w: number;
  h: number;
  /** Salt of the city's noise and speckle. */
  salt: number;
  /** The city's own ground. */
  ground: Terrain;
  /** The land round the city as its owner knows it: `SIDE` by `SIDE` squares, north to south (`townTerrain`). */
  land: Terrain[];
  /** The town's age (`homeAge`). */
  age: number;
  /** Rivers winding through, as courses in lots. */
  rivers: number[][];
  streets: TownStreet[];
  /** The town square, paved, where there is one; and the open ground inside the gate. */
  squares: GroundBox[];
  /** The ground worn round what stands on it; each casts its shadow down the screen to the right. */
  yards: GroundBox[];
  /** Fields on the land round the town, flat on the ground, under everything else. */
  fields: { id: WorkPicture; x: number; y: number; w: number; h: number }[];
  /** Back to front, left to right: the order to draw them. */
  items: SceneItem[];
}

const NOTHING: Picture = { w: 0, h: 0, parts: [] };

/** The ground a point of the scene lies on, the borders between squares wandering a little (`land`, `salt`: a scene's). */
export function townTerrain(land: readonly Terrain[], salt: number, u: number, v: number): Terrain {
  const wu = u + valueNoise(u + 64, v + 64, 0.22, 1000, salt) * 1.5 + valueNoise(u + 64, v + 64, 0.9, 1000, salt + 1) * 0.35;
  const wv = v + valueNoise(u + 64, v + 64, 0.22, 1000, salt + 2) * 1.5 + valueNoise(u + 64, v + 64, 0.9, 1000, salt + 3) * 0.35;
  const dx = Math.max(-REACH, Math.min(REACH, Math.round(wu / LOTS_A_SQUARE)));
  const dy = Math.max(-REACH, Math.min(REACH, Math.round(wv / LOTS_A_SQUARE)));
  return land[(dy + REACH) * SIDE + dx + REACH]!;
}

interface Near { x: number; y: number; terrain: Terrain; river: boolean; road: boolean; irrigation: boolean; mine: boolean }

/** The squares round the city as its owner knows them: what lies unexplored is left as the city's own ground, never told. */
function surroundings(state: GameState, city: City): Near[] {
  const { map } = state;
  const explored = state.players[city.owner]!.explored;
  const own = getTile(map, city.x, city.y)?.terrain ?? Terrain.Grassland;
  const out: Near[] = [];
  for (let dy = -REACH; dy <= REACH; dy++)
    for (let dx = -REACH; dx <= REACH; dx++) {
      const x = ((city.x + dx) % map.width + map.width) % map.width;
      const y = city.y + dy;
      const tile = getTile(map, x, y);
      const seen = tile && (explored[y * map.width + x] ?? 0) > 0;
      out.push(seen ? { x, y, terrain: tile.terrain, river: tile.river, road: tile.road, irrigation: tile.irrigation, mine: tile.mine }
        : { x, y, terrain: own, river: false, road: false, irrigation: false, mine: false });
    }
  return out;
}

/** The river's courses in lots: from each square of it to its neighbours along the sides, kept off the town's heart. */
function riverCourses(near: Near[], salt: number): number[][] {
  const at = (dx: number, dy: number) => near[(dy + REACH) * SIDE + dx + REACH];
  const point = (dx: number, dy: number): [number, number] => {
    // The city's own stretch bends round the crossroads, through the blocks beside it.
    if (dx === 0 && dy === 0) return [(hash(1, 2, salt) < 0.5 ? -1 : 1) * PITCH * 1.5, (hash(2, 1, salt) < 0.5 ? -1 : 1) * PITCH * 1.5];
    return [dx * LOTS_A_SQUARE + (hash(dx, dy, salt) - 0.5) * 3, dy * LOTS_A_SQUARE + (hash(dy, dx, salt + 1) - 0.5) * 3];
  };
  const course = (a: [number, number], b: [number, number], k: number): number[] => {
    const pts: number[] = [];
    const nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    const bend = (hash(k, 3, salt) - 0.5) * 0.3;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const m = Math.sin(t * Math.PI) * (bend * Math.sin(t * Math.PI * 2 + k) + bend * 0.5);
      pts.push(a[0] + (b[0] - a[0]) * t + (nx / len) * m * len, a[1] + (b[1] - a[1]) * t + (ny / len) * m * len);
    }
    return pts;
  };
  const out: number[][] = [];
  for (let dy = -REACH; dy <= REACH; dy++)
    for (let dx = -REACH; dx <= REACH; dx++) {
      if (!at(dx, dy)!.river) continue;
      for (const [ox, oy] of [[1, 0], [0, 1]] as const) {
        const x = dx + ox, y = dy + oy;
        if (Math.abs(x) > REACH || Math.abs(y) > REACH) continue;
        const n = at(x, y)!;
        if (n.river || n.terrain === Terrain.Ocean) out.push(course(point(dx, dy), point(x, y), out.length + 1));
      }
      for (const [ox, oy] of [[-1, 0], [0, -1]] as const) {
        const x = dx + ox, y = dy + oy;
        if (Math.abs(x) <= REACH && Math.abs(y) <= REACH && at(x, y)!.terrain === Terrain.Ocean) out.push(course(point(dx, dy), point(x, y), out.length + 1));
      }
    }
  // A river known only here runs on across the scene.
  if (at(0, 0)!.river && !out.length) {
    const flat = hash(4, 4, salt) < 0.5;
    const end = (s: number): [number, number] => (flat ? [s * LOTS_A_SQUARE * 2, (hash(s, 1, salt) - 0.5) * 6] : [(hash(s, 2, salt) - 0.5) * 6, s * LOTS_A_SQUARE * 2]);
    out.push(course(end(-1), point(0, 0), 1), course(point(0, 0), end(1), 2));
  }
  return out;
}

/** Ground that is taken, on a grid of a quarter of a lot: by a river, a street, a lot. */
class Taken {
  private readonly cells = new Set<number>();
  private key(u: number, v: number): number { return (Math.round(u * 4) + 512) * 2048 + Math.round(v * 4) + 512; }
  has(u: number, v: number): boolean { return this.cells.has(this.key(u, v)); }
  /** Takes the ground within `r` lots of a point. */
  disc(u: number, v: number, r: number): void {
    for (let a = -r; a <= r; a += 0.25) for (let b = -r; b <= r; b += 0.25) if (a * a + b * b <= r * r) this.cells.add(this.key(u + a, v + b));
  }
  box(u0: number, v0: number, u1: number, v1: number): void {
    for (let a = u0; a <= u1; a += 0.25) for (let b = v0; b <= v1; b += 0.25) this.cells.add(this.key(a, b));
  }
}

interface Lot { u: number; v: number; index: number; block: Block; fits: boolean; used: boolean; rank: number }
interface Block { bu: number; bv: number; ring: number; u: number; v: number; lots: Lot[]; fits: boolean; held: boolean; rank: number }

/** Trees to a candidate spot, by the ground (the spots stand 0.8 of a lot apart). */
const TREE_SHARE: Record<Terrain, number> = {
  [Terrain.Ocean]: 0, [Terrain.Grassland]: 0.05, [Terrain.Plains]: 0.025, [Terrain.Forest]: 0.72, [Terrain.Hills]: 0.07, [Terrain.Mountains]: 0.02,
  [Terrain.Desert]: 0, [Terrain.Tundra]: 0.02, [Terrain.Arctic]: 0, [Terrain.Swamp]: 0.1, [Terrain.Jungle]: 0.8,
};
/** Peaks and hills to a square of them, drawn up from the ground. */
const PEAKS = 11;
const MOUNDS = 9;

const sceneKey = (city: City, near: Near[], known: number, site: string): string =>
  [city.id, city.size, city.owner, city.buildings, city.idle ?? "", city.wonders, site, known,
    near.map((n) => `${n.terrain}${+n.river}${+n.road}${+n.irrigation}${+n.mine}`)].join("|");
let last: { key: string; scene: CityScene } | null = null;

/** Lays out a city's view (the last one kept, so a screen may ask every frame, and may keep what it makes of it by the scene). */
export function cityScene(state: GameState, city: City): CityScene {
  const near = surroundings(state, city);
  const site = wonderSite(state, city);
  const key = sceneKey(city, near, state.players[city.owner]!.advances.length, site ? `${site.id}:${site.art}` : "");
  if (last?.key === key) return last.scene;
  const scene = layOut(state, city, near, site);
  last = { key, scene };
  return scene;
}

function layOut(state: GameState, city: City, near: Near[], site: { id: string; art: string } | null): CityScene {
  const w = SCENE_W;
  const h = SCENE_H;
  const known = state.players[city.owner]!.advances;
  const age = homeAge(known);
  const salt = city.id * 7919 + 13;
  const land = near.map((n) => n.terrain);
  const ground = land[(SIDE * SIDE - 1) / 2]!;
  const terrainAt = (u: number, v: number) => townTerrain(land, salt, u, v);
  const buildable = (u: number, v: number) => { const t = terrainAt(u, v); return t !== Terrain.Ocean && t !== Terrain.Mountains; };

  const rivers = riverCourses(near, salt);
  const taken = new Taken();
  const riverside = new Taken();
  for (const c of rivers) for (let i = 0; i < c.length; i += 2) { taken.disc(c[i]!, c[i + 1]!, 0.75); riverside.disc(c[i]!, c[i + 1]!, 2.5); }

  // The blocks and their lots, each lot's turn by its distance from the crossroads, a block's lots together.
  const blocks: Block[] = [];
  const lots: Lot[] = [];
  const onScreen = (u: number, v: number, across: number, tall: number) => {
    const x = isoX(u, v), y = isoY(u, v) + across / 4;
    return x - across / 2 >= 1 && x + across / 2 <= w - 1 && y - tall >= 1 && y <= h - 1;
  };
  const fits = (u: number, v: number) =>
    onScreen(u, v, 20, 22) && buildable(u, v) && [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].every(([a, b]) => buildable(u + a!, v + b!) && !taken.has(u + a!, v + b!));
  for (let bu = -BLOCKS; bu < BLOCKS; bu++)
    for (let bv = -BLOCKS; bv < BLOCKS; bv++) {
      const u = (bu + 0.5) * PITCH, v = (bv + 0.5) * PITCH;
      const ring = Math.max(bu < 0 ? -bu - 1 : bu, bv < 0 ? -bv - 1 : bv);
      const block: Block = { bu, bv, ring, u, v, lots: [], fits: false, held: false, rank: Math.hypot(u, v) + hash(bu, bv, salt) * 1.6 };
      for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) {
        const lot: Lot = { u: u + a, v: v + b, index: lots.length, block, fits: false, used: false, rank: 0 };
        lot.fits = fits(lot.u, lot.v);
        lot.rank = block.rank + hash(lot.index, 1, salt) * 0.9;
        block.lots.push(lot);
        lots.push(lot);
      }
      block.fits = block.lots.every((l) => l.fits) && onScreen(u, v, 40, TALLEST);
      blocks.push(block);
    }
  lots.sort((a, b) => a.rank - b.rank);
  const blockAt = (bu: number, bv: number) => blocks.find((b) => b.bu === bu && b.bv === bv)!;
  const hold = (b: Block) => { b.held = true; for (const l of b.lots) l.used = true; };
  const free = (b: Block) => b.fits && !b.held && b.lots.every((l) => !l.used);

  const items: SceneItem[] = [];
  const yards: GroundBox[] = [];
  const built = new Set<Block>();
  const lit = new Set<Lot>();
  const stand = (id: string, kind: SceneItem["kind"], pic: Picture, u: number, v: number, lotW: number, lotH: number, more: Partial<SceneItem> = {}) => {
    items.push({ id, kind, pic, x: Math.round(isoX(u, v) - lotW / 2), y: Math.min(h - 1, Math.round(isoY(u, v) + lotW / 4)), w: lotW, h: lotH, ...more });
  };
  const onBlock = (b: Block, id: string, kind: SceneItem["kind"], more: Partial<SceneItem> = {}) => {
    hold(b);
    built.add(b);
    for (const l of b.lots) lit.add(l);
    yards.push({ u0: b.u - 1.1, v0: b.v - 1.1, u1: b.u + 1.1, v1: b.v + 1.1 });
    const lotted = artLot(id, PICTURES[id]!);
    stand(id, kind, PICTURES[id]!, b.u, b.v, lotted.w, lotted.h, more);
  };
  const onLot = (l: Lot, id: string, kind: SceneItem["kind"], lotW: number, lotH: number, pic: Picture, more: Partial<SceneItem> = {}) => {
    l.used = true;
    built.add(l.block);
    lit.add(l);
    yards.push({ u0: l.u - 0.55, v0: l.v - 0.55, u1: l.u + 0.55, v1: l.v + 0.55 });
    stand(id, kind, pic, l.u, l.v, lotW, lotH, more);
  };

  // What stands, and how much room it will all want: a walled town is walled round the rings it fills.
  const standing = city.idle ? [...city.buildings, ...city.idle] : city.buildings;
  const buildings = standing.filter((b) => b !== "city_walls" && PICTURES[b]);
  const walled = standing.includes("city_walls");
  const homesWanted = 2 + city.size * 2;
  const wonders = city.wonders.filter((id) => PICTURES[id]);
  const room = homesWanted + buildings.reduce((n, id) => n + (artLot(id, PICTURES[id]!).w > WHOLE_BLOCK ? 4 : 1), 0);
  const wallRing = wonders.length || site || room > 30 ? 2 : 1;

  // The town's heart: the palace behind the crossroads, the square before it, and open ground inside the gate.
  const plaza = blockAt(0, 0);
  const hasPlaza = city.size >= 3 || buildings.length > 0;
  hold(plaza);
  if (buildings.includes("palace")) onBlock(blockAt(-1, -1), "palace", "building");
  const gateBlock = walled ? blockAt(wallRing, wallRing) : null;
  if (gateBlock) hold(gateBlock);

  // Blocks by the sea, nearest it first, when the land has any in sight.
  const coastal = land.includes(Terrain.Ocean);
  const seaFrom = (u: number, v: number): [number, number] | null => {
    for (let r = 1; r <= 8; r += 0.5)
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const)
        if (terrainAt(u + a * r, v + b * r) === Terrain.Ocean) return [a * r, b * r];
    return null;
  };
  const shoreBlocks = coastal ? blocks.filter((b) => b.fits).flatMap((b) => { const sea = seaFrom(b.u, b.v); return sea ? [{ b, sea }] : []; }).sort((a, b) => Math.hypot(...a.sea) - Math.hypot(...b.sea)) : [];
  // The block nearest the sea is the harbour's, built or not, so one built late moves no wonder.
  const shore = shoreBlocks.map((s) => s.b);
  const quay = shoreBlocks[0];

  // Every improvement has its place in every town, built or not, homes standing there until it comes: so nothing moves
  // when one is built, or stops being supported (`City.idle`), whatever order a city's lists hold them in. The rules'
  // order is roughly the order they come in, so the first stand nearest the crossroads.
  const kept = new Set<Block>([plaza, blockAt(-1, -1), blockAt(1, 1), blockAt(2, 2), ...(quay ? [quay.b] : [])]);
  const planned = new Map<string, Block | Lot>();
  const civic = BUILDINGS.map((b) => b.id).filter((id) => PICTURES[id] && !["palace", "city_walls", "marketplace", "harbour"].includes(id));
  const worksSide = hash(5, 5, salt) < 0.5 ? -1 : 1;
  const edge = blocks.filter((b) => b.ring >= 2 && b.fits && !kept.has(b)).sort((a, b) => worksSide * (b.u - b.v - (a.u - a.v)) + (b.ring - a.ring) * 4);
  for (const id of civic.filter((c) => OUTSKIRTS.has(c))) {
    const b = edge.find((k) => !kept.has(k));
    if (b) { kept.add(b); planned.set(id, b); }
  }
  // Every other block for the big ones, homes between them.
  const round = blocks.filter((b) => b.ring >= 1 && b.ring <= 2 && b.fits && !kept.has(b)).sort((a, b) => a.rank - b.rank);
  civic.filter((c) => !OUTSKIRTS.has(c) && artLot(c, PICTURES[c]!).w > WHOLE_BLOCK).forEach((id, i) => {
    const b = round[i * 2];
    if (b) { kept.add(b); planned.set(id, b); }
  });
  const open = lots.filter((l) => l.fits && !kept.has(l.block));
  civic.filter((c) => !OUTSKIRTS.has(c) && artLot(c, PICTURES[c]!).w <= WHOLE_BLOCK).forEach((id, i) => { const l = open[i]; if (l) planned.set(id, l); });
  const held = new Set(planned.values());

  // Wonders stand a block each on the second ring, the back of the town first, then round its sides.
  const landmarks = blocks.filter((b) => b.ring >= 2 && !kept.has(b) && b.lots.every((l) => !held.has(l))).sort((a, b) => a.ring - b.ring || a.bu + a.bv - (b.bu + b.bv) || hash(a.bu, a.bv, salt + 7) - hash(b.bu, b.bv, salt + 7));
  const raise = (id: string, kind: "wonder", more: Partial<SceneItem> = {}) => {
    const b = (SEAFRONT.has(id) ? shore.find((k) => k !== quay?.b && free(k)) : undefined) ?? landmarks.find((k) => k !== quay?.b && free(k)) ?? blocks.filter(free).sort((p, q) => q.rank - p.rank)[0];
    if (b) onBlock(b, id, kind, more);
  };
  wonders.forEach((id) => raise(id, "wonder"));
  // The wonder going up, where it will stand: the next of the city's wonders.
  if (site) raise(site.id, "wonder", { site: site.art });

  for (const id of buildings) {
    if (id === "palace") continue;
    const p = PICTURES[id]!;
    const lotted = artLot(id, p);
    if (id === "marketplace" && hasPlaza) { built.add(plaza); stand(id, "building", p, plaza.u, plaza.v, lotted.w, lotted.h); continue; }
    if (id === "harbour" && quay && free(quay.b)) {
      onBlock(quay.b, id, "building");
      yards.pop();
      // Its picture holds its own water: it stands out on the shore, that water meeting the sea.
      const r = Math.hypot(...quay.sea);
      const [su, sv] = [quay.sea[0] * (1 - 0.8 / r), quay.sea[1] * (1 - 0.8 / r)];
      const it = items[items.length - 1]!;
      it.x = Math.round(it.x + isoX(su, sv) - isoX(0, 0));
      it.y = Math.min(h - 1, Math.round(it.y + isoY(su, sv) - isoY(0, 0)));
      continue;
    }
    // Its own place; on land too narrow to hold them all, the nearest room left.
    const place = planned.get(id);
    if (place && "lots" in place && free(place)) { onBlock(place, id, "building"); continue; }
    if (place && "block" in place && !place.used) { onLot(place, id, "building", lotted.w, lotted.h, p); continue; }
    const big = lotted.w > WHOLE_BLOCK ? [...blocks].sort((a, b) => a.rank - b.rank).find(free) : undefined;
    if (big) { onBlock(big, id, "building"); continue; }
    const l = lots.find((k) => k.fits && !k.used);
    if (l) onLot(l, id, "building", lotted.w, lotted.h, p);
  }
  if (quay && free(quay.b)) quay.b.held = true; // left for the harbour

  // The homes fill what is left outward, a few lots left to gardens; a lot's house stays while the people's means allow it.
  const choices = houseChoices(known, age, city.size, ground);
  const oldHomes = HOMES[age]!;
  let homes = 0;
  const heartTo = 1 + city.size / 8;
  for (const l of lots) {
    if (homes >= homesWanted) break;
    if (!l.fits || l.used || hash(l.index, 9, salt) < 0.09) continue;
    const seaNear = coastal && [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([a, b]) => terrainAt(l.u + a!, l.v + b!) === Terrain.Ocean);
    const rule = pickHouse(choices, l.index, salt, { heart: l.block.ring < heartTo, water: seaNear || riverside.has(l.u, l.v) });
    const [cw, ch] = HOUSE_ART[rule.id]!;
    onLot(l, `${rule.id}@${l.index}`, "home", Math.round(cw * HOUSE_SCALE), Math.round(ch * HOUSE_SCALE), oldHomes[Math.floor(hash(l.index, 4, salt) * oldHomes.length)]!, { house: rule.id });
    homes++;
  }
  for (const it of lit) taken.box(it.u - 0.5, it.v - 0.5, it.u + 0.5, it.v + 0.5);

  // The walls round the rings the town fills, on the streets' lines, a gate at the corner nearest us.
  const wallAt = walled ? (wallRing + 1) * PITCH : 0;
  const onWall = (i: number) => walled && Math.abs(i) === wallRing + 1;

  // The streets along what is built: the side of a block that holds a lot, each joined to the crossroads.
  const surface: TownStreet["surface"] = knows(known, "automobile") ? "asphalt" : knows(known, "construction") ? "stone" : "dirt";
  const wander = [0.13, 0.09, 0.03, 0][age]!;
  const segment = new Map<string, [number, number, number, number]>();
  const node = (i: number, j: number) => (i + 16) * 64 + j + 16;
  const road = (i0: number, j0: number, i1: number, j1: number) => {
    const open = (u: number, v: number) => terrainAt(u, v) !== Terrain.Ocean && terrainAt(u, v) !== Terrain.Mountains;
    if (!open(((i0 + i1) / 2) * PITCH, ((j0 + j1) / 2) * PITCH)) return false;
    if (i0 === i1 && onWall(i0)) return false;
    if (j0 === j1 && onWall(j0)) return false;
    if (walled && ((Math.abs(i0) <= wallRing && Math.abs(i1) > wallRing + 1) || (Math.abs(j0) <= wallRing && Math.abs(j1) > wallRing + 1))) return false;
    const [a, b] = [node(i0, j0), node(i1, j1)].sort((p, q) => p - q);
    segment.set(`${a}:${b}`, [i0, j0, i1, j1]);
    return true;
  };
  for (const l of lit) {
    const { bu, bv } = l.block;
    const i = l.u < l.block.u ? bu : bu + 1, j = l.v < l.block.v ? bv : bv + 1;
    road(i, bv, i, bv + 1);
    road(bu, j, bu + 1, j);
  }
  if (built.size) { road(0, 0, 1, 0); road(0, 0, 0, 1); }
  if (hasPlaza) { road(0, 1, 1, 1); road(1, 0, 1, 1); }
  // Join what is cut off from the crossroads, by the shortest way along the grid.
  const steps = (i: number, j: number) => [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const;
  for (let tries = 0; tries < 24; tries++) {
    const links = new Map<number, [number, number][]>();
    for (const [i0, j0, i1, j1] of segment.values()) {
      (links.get(node(i0, j0)) ?? links.set(node(i0, j0), []).get(node(i0, j0))!).push([i1, j1]);
      (links.get(node(i1, j1)) ?? links.set(node(i1, j1), []).get(node(i1, j1))!).push([i0, j0]);
    }
    const reached = new Set([node(0, 0)]);
    const queue: [number, number][] = [[0, 0]];
    while (queue.length) for (const [a, b] of links.get(node(...queue.shift()!)) ?? []) if (!reached.has(node(a, b))) { reached.add(node(a, b)); queue.push([a, b]); }
    const away: [number, number][] = [];
    for (const [i0, j0, i1, j1] of segment.values()) if (!reached.has(node(i0, j0))) away.push([i0, j0]); else if (!reached.has(node(i1, j1))) away.push([i1, j1]);
    if (!away.length) break;
    // From the first cut-off corner, walk the open grid to anything reached.
    const from = new Map<number, [number, number] | null>([[node(...away[0]!), null]]);
    const walk: [number, number][] = [away[0]!];
    let hit: [number, number] | null = null;
    while (walk.length && !hit) {
      const [i, j] = walk.shift()!;
      for (const [a, b] of steps(i, j)) {
        if (Math.abs(a) > BLOCKS || Math.abs(b) > BLOCKS || from.has(node(a, b))) continue;
        const u = ((i + a) / 2) * PITCH, v = ((j + b) / 2) * PITCH;
        if (!buildable(u, v) || (i === a && onWall(i)) || (j === b && onWall(j))) continue;
        from.set(node(a, b), [i, j]);
        if (reached.has(node(a, b))) { hit = [a, b]; break; }
        walk.push([a, b]);
      }
    }
    if (!hit) break;
    for (let at: [number, number] = hit; ;) {
      const back = from.get(node(...at));
      if (!back) break;
      road(at[0], at[1], back[0], back[1]);
      at = back;
    }
  }
  const streets: TownStreet[] = [];
  const wobble = (a: number, b: number) => (hash(a, b, salt + 11) - 0.5) * 2;
  const course = (u0: number, v0: number, u1: number, v1: number, width: number, k: number) => {
    const pts: number[] = [];
    const len = Math.hypot(u1 - u0, v1 - v0);
    const n = Math.max(2, Math.ceil(len * 3));
    const nu = -(v1 - v0) / (len || 1), nv = (u1 - u0) / (len || 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = Math.sin(t * Math.PI) * wander * (wobble(k, 1) + 0.4 * Math.sin(t * Math.PI * 3 + k));
      const u = u0 + (u1 - u0) * t + nu * off, v = v0 + (v1 - v0) * t + nv * off;
      if (terrainAt(u, v) === Terrain.Ocean) break;
      pts.push(u, v);
    }
    if (pts.length < 4) return;
    streets.push({ pts, w: width, surface });
    for (let i = 0; i < pts.length; i += 2) taken.disc(pts[i]!, pts[i + 1]!, 0.4);
  };
  for (const [i0, j0, i1, j1] of segment.values()) course(i0 * PITCH, j0 * PITCH, i1 * PITCH, j1 * PITCH, (i0 === i1 ? i0 === 0 : j0 === 0) ? MAIN_STREET : STREET, node(i0, j0) + node(i1, j1));

  // Roads leave the town for the squares that have them; a walled town's only by its gate.
  if (!walled)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!near[(dy + REACH) * SIDE + dx + REACH]!.road) continue;
      let i = 0;
      while (segment.has([node(i * dx, i * dy), node((i + 1) * dx, (i + 1) * dy)].sort((p, q) => p - q).join(":"))) i++;
      if (i || built.size) course(i * dx * PITCH, i * dy * PITCH, dx * LOTS_A_SQUARE * 1.6, dy * LOTS_A_SQUARE * 1.6, STREET, 900 + dx * 3 + dy);
    }

  // The town square, and the road in from the gate.
  const squares: GroundBox[] = [];
  if (hasPlaza) { squares.push({ u0: 0.2, v0: 0.2, u1: PITCH - 0.2, v1: PITCH - 0.2 }); taken.box(0.2, 0.2, PITCH - 0.2, PITCH - 0.2); }
  if (hasPlaza && !buildings.includes("marketplace")) stand("", "well", NOTHING, plaza.u, plaza.v, 12, 12);

  if (walled) {
    const out = wallAt;
    const piece = (u0: number, v0: number, u1: number, v1: number, tall: number, side: WallPiece["side"], tower = false) => {
      const at = terrainAt((u0 + u1) / 2, (v0 + v1) / 2);
      if (at === Terrain.Ocean) return;
      const left = isoX(u0, v1), right = isoX(u1, v0), foot = isoY(u1, v1), top = isoY(u0, v0) - tall;
      items.push({ id: "city_walls", kind: "walls", pic: NOTHING, x: Math.round(left), y: Math.round(foot), w: Math.round(right - left), h: Math.round(foot - top), wall: { u0, v0, u1, v1, tall, side, ...(tower ? { tower } : {}) } });
      taken.box(u0 - 0.25, v0 - 0.25, u1 + 0.25, v1 + 0.25);
    };
    const thick = 0.14, run = PITCH / 2;
    // The gate stands at the corner nearest us, or where the sea takes that corner the nearest land along the walls.
    const steps = Math.round((out * 2) / run);
    const gateSpots: [number, number][] = [[out, out]];
    for (let i = 1; i <= steps; i++) gateSpots.push([out - i * run, out], [out, out - i * run]);
    for (let i = 1; i <= steps; i++) gateSpots.push([-out, out - i * run], [out - i * run, -out]);
    const gate = gateSpots.find(([u, v]) => buildable(u, v));
    const byGate = (u: number, v: number) => !!gate && Math.hypot(u - gate[0], v - gate[1]) < 1.7;
    const towerAt = (i: number) => i % 4 === 0;
    for (let i = 0; i * run < out * 2; i++) {
      const a = -out + i * run, b = a + run, m = (a + b) / 2;
      if (!byGate(m, -out)) piece(a, -out - thick, b, -out + thick, 9, "north");
      if (!byGate(-out, m)) piece(-out - thick, a, -out + thick, b, 9, "west");
      if (!byGate(out, m)) piece(out - thick, a, out + thick, b, 9, "east");
      if (!byGate(m, out)) piece(a, out - thick, b, out + thick, 9, "south");
      if (towerAt(i)) {
        if (!byGate(a, -out)) piece(a - 0.34, -out - 0.34, a + 0.34, -out + 0.34, 15, "north", true);
        if (i && !byGate(-out, a)) piece(-out - 0.34, a - 0.34, -out + 0.34, a + 0.34, 15, "west", true);
        if (!byGate(out, a)) piece(out - 0.34, a - 0.34, out + 0.34, a + 0.34, 15, "east", true);
        if (!byGate(a, out)) piece(a - 0.34, out - 0.34, a + 0.34, out + 0.34, 15, "south", true);
      }
    }
    // The gatehouse (the user's picture of the walls, seen from the front), and the way in and out by it.
    const art = buildingArt("city_walls");
    if (art && gate) {
      const [gu, gv] = gate;
      const gw = Math.round((GATE_H * art.w) / art.h);
      items.push({ id: "city_walls", kind: "gate", pic: PICTURES.city_walls!, x: Math.round(isoX(gu, gv) - gw / 2), y: Math.min(h - 1, Math.round(isoY(gu, gv) + 3)), w: gw, h: GATE_H });
      // In to the nearest crossing inside the walls, out away from the town.
      const inside = (c: number) => Math.max(-wallRing, Math.min(wallRing, Math.round(c / PITCH))) * PITCH;
      const [iu, iv] = [inside(gu), inside(gv)];
      const corner = gu === out && gv === out;
      if (corner && gateBlock?.fits) squares.push({ u0: out - PITCH + 0.2, v0: out - PITCH + 0.2, u1: out - 0.2, v1: out - 0.2 });
      course(iu, iv, gu, gv, MAIN_STREET, 700);
      course(gu, gv, gu + Math.sign(gu - iu) * 3, gv + Math.sign(gv - iv) * 3, MAIN_STREET, 701);
      taken.box(Math.min(iu, gu), Math.min(iv, gv), Math.max(iu, gu), Math.max(iv, gv));
    }
  }

  // Fields and mines on the squares round the town that have them.
  const fields: CityScene["fields"] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const n = near[(dy + REACH) * SIDE + dx + REACH]!;
      if (!dx && !dy) continue;
      const cu = dx * LOTS_A_SQUARE, cv = dy * LOTS_A_SQUARE;
      if (n.irrigation) {
        for (const [a, b] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]] as const) {
          const u = cu + a, v = cv + b;
          if (terrainAt(u, v) !== n.terrain || taken.has(u, v) || taken.has(u - 1.5, v) || taken.has(u + 1.5, v) || taken.has(u, v - 1.5) || taken.has(u, v + 1.5)) continue;
          fields.push({ id: fieldsPicture(state.map, n.x, n.y, { terrain: n.terrain, river: n.river }), x: Math.round(isoX(u, v) - FIELD_SIZE / 2), y: Math.round(isoY(u, v) - FIELD_SIZE / 2), w: FIELD_SIZE, h: FIELD_SIZE });
          taken.box(u - 1.8, v - 1.8, u + 1.8, v + 1.8);
        }
      }
      if (n.mine && !taken.has(cu, cv) && onScreen(cu, cv, MINE_SIZE, MINE_SIZE * 0.8)) {
        items.push({ id: "", kind: "work", pic: NOTHING, x: Math.round(isoX(cu, cv) - MINE_SIZE / 2), y: Math.round(isoY(cu, cv) + MINE_SIZE / 2), w: MINE_SIZE, h: MINE_SIZE, work: minePicture(n.terrain) });
        taken.box(cu - 1.5, cv - 1.5, cu + 1.5, cv + 1.5);
      }
    }

  // Hills and peaks stand on what ground is left of them, then the trees.
  for (let dy = -REACH; dy <= REACH; dy++)
    for (let dx = -REACH; dx <= REACH; dx++) {
      const t = land[(dy + REACH) * SIDE + dx + REACH]!;
      if (t !== Terrain.Mountains && t !== Terrain.Hills) continue;
      const peak = t === Terrain.Mountains;
      for (let k = 0; k < (peak ? PEAKS : MOUNDS); k++) {
        const u = (dx + (hash(k, dx + 7, salt + dy) - 0.5) * 0.95) * LOTS_A_SQUARE, v = (dy + (hash(dy + 7, k, salt - dx) - 0.5) * 0.95) * LOTS_A_SQUARE;
        const r = hash(k, 21, salt + dx * 3 + dy * 5);
        const across = peak ? 30 + r * 18 : 28 + r * 18, tall = peak ? 22 + r * 14 : 8 + r * 6;
        const x = isoX(u, v), y = isoY(u, v);
        if (x + across / 2 < 0 || x - across / 2 > w || y - tall > h || y < 2 || terrainAt(u, v) !== t || taken.has(u, v) || (peak ? false : Math.hypot(u, v) < 5)) continue;
        items.push({ id: "", kind: peak ? "peak" : "mound", pic: NOTHING, x: Math.round(x - across / 2), y: Math.round(y), w: Math.round(across), h: Math.round(tall) });
      }
    }
  const townEdge = Math.max(3, ...[...lit].map((l) => Math.hypot(l.u, l.v)));
  for (let a = -24; a <= 24; a++)
    for (let b = -24; b <= 24; b++) {
      const u = (a + hash(a, b, salt + 3) * 0.7) * 0.8, v = (b + hash(b, a, salt + 4) * 0.7) * 0.8;
      const x = isoX(u, v), y = isoY(u, v);
      if (x < 6 || x > w - 6 || y < 12 || y > h - 1) continue;
      const t = terrainAt(u, v);
      const share = Math.max(TREE_SHARE[t], t !== Terrain.Ocean && t !== Terrain.Desert && t !== Terrain.Arctic && Math.hypot(u, v) < townEdge ? 0.14 : 0);
      if (hash(a, b, salt + 5) >= share || taken.has(u, v)) continue;
      const r = hash(b, a, salt + 6);
      const kind = t === Terrain.Tundra || t === Terrain.Hills || t === Terrain.Mountains ? 2 : t === Terrain.Forest ? (r < 0.3 ? 2 : r < 0.65 ? 0 : 1) : r < 0.4 ? 0 : r < 0.7 ? 1 : r < 0.85 ? 2 : 3;
      const tree = TREES[Math.min(kind, TREES.length - 1)]!;
      items.push({ id: "", kind: "tree", pic: tree, x: Math.round(x - tree.w / 2), y: Math.round(y), w: tree.w, h: tree.h, tree: kind });
    }

  items.sort((a, b) => a.y - b.y || a.x - b.x);
  return { w, h, salt, ground, land, age, rivers, streets, squares, yards, fields, items };
}

/** The improvement, wonder or house whose picture covers a point of the scene (front-most first), or null: the bottom corners of its box lie outside its ground. */
export function sceneItemAt(scene: CityScene, x: number, y: number): SceneItem | null {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const it = scene.items[i]!;
    if (!it.id || x < it.x || x >= it.x + it.w || y < it.y - it.h || y >= it.y) continue;
    const cut = it.kind === "walls" ? 0 : (Math.abs(x - it.x - it.w / 2) / (it.w / 2) + (y - it.y + it.w / 4) / (it.w / 4));
    if (cut <= 1) return it;
  }
  return null;
}
