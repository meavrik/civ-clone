import { civ, type CivRule } from "../rules/civs.js";
import { LAND_KINDS, PLACE_RULES, PLACES, WATER_KINDS, type PlaceKind } from "../rules/places.js";
import { MAP_WIDTH, NEIGHBOURS, Terrain, wrapX, type GameState, type WorldMap } from "../types.js";

/**
 * The world's great features and their names (asked for 2026-10-25; `rules/places.ts`). Each square
 * lies in up to two places: a water body or a landform (`place`: an ocean, sea, gulf or lake; a desert,
 * range, forest, jungle, marsh, tundra or ice field) and, on land, a continent or island (`land`).
 * A generated world finds them from its terrain as dealt (`findGeography`); a premade world carries
 * its real ones (`premadeGeography`, drawn by `tools/maps` from Natural Earth). The first civilization
 * to see a square of a place discovers it (`discoverSquare`, from `revealAround`), and a place without
 * a real name takes one from that civilization's leader, people or cities (`PLACE_RULES`). Nothing in
 * the rules reads them: no RNG, no save version.
 */
export interface Region {
  kind: PlaceKind;
  /** Squares in it. */
  size: number;
  /** Real on a premade world; else given by the civilization that saw it first. */
  name?: string;
  /** The player who saw it first (never the barbarians), and when. */
  by?: number;
  turn?: number;
}

export interface Geography {
  regions: Region[];
  /** Each square's water body or landform (an index into `regions`), -1 for none. */
  place: Int16Array;
  /** Each land square's continent or island, -1 at sea or for none. */
  land: Int16Array;
}

/** A real place on a premade world: its kind and name ("the Sahara", "Lake Victoria", "Africa"). */
export type PlaceName = readonly [PlaceKind, string];

/**
 * A premade world's real places at one size: a name table per layer and rows of one character per
 * square (`PLACE_CHARS`, "." for none). A sea square's character in `place` indexes `waters`, a land
 * square's `landforms`; `land` indexes `lands`.
 */
export interface PlaceTable {
  waters: readonly PlaceName[];
  landforms: readonly PlaceName[];
  lands: readonly PlaceName[];
  place: readonly string[];
  land: readonly string[];
}

/** The characters naming places in a `PlaceTable`'s rows, by index: printable ASCII but . " and \, then the Latin letters from À. */
export const PLACE_CHARS = [
  ...Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).filter((c) => c !== "." && c !== '"' && c !== "\\"),
  ...Array.from({ length: 0x250 - 0xc0 }, (_, i) => String.fromCharCode(0xc0 + i)).filter((c) => c !== "\u00d7" && c !== "\u00f7"),
].join("");

/** Squares of `map` in one piece with square i (8-neighbour, wrapping east-west) that share its key; a key below 0 is in none. */
function components(map: WorldMap, key: (i: number) => number): number[][] {
  const { width: w, height: h } = map;
  const seen = new Uint8Array(w * h);
  const out: number[][] = [];
  for (let i = 0; i < w * h; i++) {
    const k = key(i);
    if (k < 0 || seen[i]) continue;
    const comp = [i];
    seen[i] = 1;
    for (let q = 0; q < comp.length; q++) {
      const x = comp[q]! % w;
      const y = (comp[q]! - x) / w;
      for (const [dx, dy] of NEIGHBOURS) {
        if (y + dy < 0 || y + dy >= h) continue;
        const j = (y + dy) * w + wrapX(map, x + dx);
        if (seen[j] || key(j) !== k) continue;
        seen[j] = 1;
        comp.push(j);
      }
    }
    out.push(comp);
  }
  return out;
}

/** Steps from each square to the nearest square that fails `inside` (0 there), through the eight neighbours. */
function depthIn(map: WorldMap, inside: (i: number) => boolean): Int32Array {
  const { width: w, height: h } = map;
  const depth = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (!inside(i)) { depth[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const x = c % w;
    const y = (c - x) / w;
    for (const [dx, dy] of NEIGHBOURS) {
      if (y + dy < 0 || y + dy >= h) continue;
      const j = (y + dy) * w + wrapX(map, x + dx);
      if (depth[j] !== -1) continue;
      depth[j] = depth[c]! + 1;
      queue.push(j);
    }
  }
  // A world all of one kind: every square as deep as the world is wide.
  for (let i = 0; i < w * h; i++) if (depth[i] === -1) depth[i] = w;
  return depth;
}

/** The landforms terrain makes: mountains and hills together make a range (of mountains or of hills). */
export type LandformGroup = "desert" | "range" | "forest" | "jungle" | "swamp" | "tundra" | "ice";

/** The landform a terrain makes part of, or null (grassland and plains make none). */
export function landformGroup(t: Terrain): LandformGroup | null {
  switch (t) {
    case Terrain.Desert: return "desert";
    case Terrain.Mountains: case Terrain.Hills: return "range";
    case Terrain.Forest: return "forest";
    case Terrain.Jungle: return "jungle";
    case Terrain.Swamp: return "swamp";
    case Terrain.Tundra: return "tundra";
    case Terrain.Arctic: return "ice";
    default: return null;
  }
}
const LANDFORMS = ["desert", "range", "forest", "jungle", "swamp", "tundra", "ice"] as const;

/** Whether a square's terrain still belongs to a landform of that kind (settlers and warming change it). */
export function fitsLandform(kind: PlaceKind, t: Terrain): boolean {
  const f = landformGroup(t);
  return f === "range" ? kind === "mountains" || kind === "hills" : f === kind;
}

/**
 * Splits a body of open water into basins: centres picked from the water furthest from land,
 * each at least `basinSpacing` steps through the water from every other, every square going to
 * the nearest centre; a basin smaller than `basinMin` joins the neighbour it borders most.
 */
function basins(map: WorldMap, body: number[], depth: Int32Array): number[][] {
  const { width: w, height: h } = map;
  const k = w / MAP_WIDTH;
  const spacing = Math.max(2, Math.round(PLACES.basinSpacing * k));
  const inBody = new Uint8Array(w * h);
  for (const i of body) inBody[i] = 1;
  const steps = (c: number, f: (j: number) => void) => {
    const x = c % w;
    const y = (c - x) / w;
    for (const [dx, dy] of NEIGHBOURS) {
      if (y + dy < 0 || y + dy >= h) continue;
      const j = (y + dy) * w + wrapX(map, x + dx);
      if (inBody[j]) f(j);
    }
  };
  const order = [...body].sort((a, b) => depth[b]! - depth[a]! || a - b);
  const covered = new Uint8Array(w * h);
  const dist = new Int32Array(w * h);
  const seeds: number[] = [];
  for (const s of order) {
    if (covered[s]) continue;
    seeds.push(s);
    const reached = [s];
    covered[s] = 1;
    dist[s] = 0;
    for (let q = 0; q < reached.length; q++) {
      const c = reached[q]!;
      if (dist[c]! + 1 >= spacing) continue;
      steps(c, (j) => {
        if (covered[j]) return;
        covered[j] = 1;
        dist[j] = dist[c]! + 1;
        reached.push(j);
      });
    }
  }
  const basin = new Int32Array(w * h).fill(-1);
  const queue = [...seeds];
  seeds.forEach((s, b) => { basin[s] = b; });
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    steps(c, (j) => {
      if (basin[j] !== -1) return;
      basin[j] = basin[c]!;
      queue.push(j);
    });
  }
  const min = Math.round(PLACES.basinMin * k * k);
  for (;;) {
    const size = new Map<number, number>();
    for (const i of body) size.set(basin[i]!, (size.get(basin[i]!) ?? 0) + 1);
    if (size.size <= 1) break;
    let small = -1;
    for (const [b, n] of size) if (n < min && (small === -1 || n < size.get(small)! || (n === size.get(small)! && b < small))) small = b;
    if (small === -1) break;
    const border = new Map<number, number>();
    for (const i of body) {
      if (basin[i] !== small) continue;
      steps(i, (j) => { if (basin[j] !== small) border.set(basin[j]!, (border.get(basin[j]!) ?? 0) + 1); });
    }
    let into = -1;
    for (const [b, n] of border) if (into === -1 || n > border.get(into)! || (n === border.get(into)! && b < into)) into = b;
    if (into === -1) break;
    for (const i of body) if (basin[i] === small) basin[i] = into;
  }
  const out = new Map<number, number[]>();
  for (const i of [...body].sort((a, b) => a - b)) {
    const list = out.get(basin[i]!);
    if (list) list.push(i);
    else out.set(basin[i]!, [i]);
  }
  return [...out.values()];
}

/** A generated world's places, from its terrain as dealt; none named yet. */
export function findGeography(map: WorldMap): Geography {
  const { width: w, height: h, tiles } = map;
  const k = w / MAP_WIDTH;
  const scaled = (v: number) => Math.max(1, Math.round(v * k * k));
  const regions: Region[] = [];
  const place = new Int16Array(w * h).fill(-1);
  const land = new Int16Array(w * h).fill(-1);
  const add = (squares: number[], kind: PlaceKind, layer: Int16Array) => {
    for (const i of squares) layer[i] = regions.length;
    regions.push({ kind, size: squares.length });
  };
  const water = (i: number) => tiles[i]!.terrain === Terrain.Ocean;

  // Waters: small bodies are lakes, middling ones inland seas, the open water basins.
  const depth = depthIn(map, water);
  for (const body of components(map, (i) => (water(i) ? 0 : -1))) {
    if (body.length <= scaled(PLACES.lakeMax)) add(body, "lake", place);
    else if (body.length <= scaled(PLACES.inlandSeaMax)) add(body, "sea", place);
    else
      for (const b of basins(map, body, depth)) {
        const open = b.filter((i) => depth[i]! >= Math.round(PLACES.openDepth * k)).length / b.length;
        const small = b.length < scaled(PLACES.bayMax);
        add(b, open >= PLACES.oceanShare ? (small ? "sea" : "ocean") : small ? "bay" : "sea", place);
      }
  }

  // Landforms: deserts, ranges, forests... in one piece; the polar ice whatever its size.
  for (const comp of components(map, (i) => {
    const f = water(i) ? null : landformGroup(tiles[i]!.terrain);
    return f ? LANDFORMS.indexOf(f) : -1;
  })) {
    const form = landformGroup(tiles[comp[0]!]!.terrain)!;
    let kind: PlaceKind;
    if (form === "range") {
      const peaks = comp.filter((i) => tiles[i]!.terrain === Terrain.Mountains).length;
      kind = peaks >= Math.max(2, comp.length / 4) ? "mountains" : "hills";
    } else kind = form;
    const polar = comp.some((i) => i < w || i >= (h - 1) * w);
    if (polar || comp.length >= scaled(PLACES.landformMin[kind] ?? 4)) add(comp, kind, place);
  }

  // Continents and islands; rows of ice at the poles are an ice field, not land of their own.
  const iceRow = (y: number) => tiles.slice(y * w, (y + 1) * w).every((t) => t.terrain === Terrain.Arctic);
  const poles = [iceRow(0), iceRow(h - 1)];
  const polarSquare = (i: number) => (i < w && poles[0]) || (i >= (h - 1) * w && poles[1]);
  for (const comp of components(map, (i) => (water(i) || polarSquare(i) ? -1 : 0)))
    add(comp, comp.length >= scaled(PLACES.continentMin) ? "continent" : "island", land);
  return { regions, place, land };
}

/** A premade world's real places from its table (`skip`: squares whose terrain differs from the table's, left in none). */
export function premadeGeography(map: WorldMap, table: PlaceTable, skip?: ReadonlySet<number>): Geography {
  const { width: w, height: h, tiles } = map;
  const regions: Region[] = [];
  const place = new Int16Array(w * h).fill(-1);
  const land = new Int16Array(w * h).fill(-1);
  const made = new Map<string, number>();
  const put = (layer: Int16Array, key: string, entry: PlaceName | undefined, i: number) => {
    if (!entry) return;
    let r = made.get(key);
    if (r === undefined) {
      r = regions.length;
      made.set(key, r);
      regions.push({ kind: entry[0], size: 0, name: entry[1] });
    }
    layer[i] = r;
    regions[r]!.size++;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (skip?.has(i)) continue;
      const wet = tiles[i]!.terrain === Terrain.Ocean;
      const a = PLACE_CHARS.indexOf(table.place[y]?.[x] ?? ".");
      if (a >= 0) put(place, `${wet ? "w" : "f"}${a}`, (wet ? table.waters : table.landforms)[a], i);
      const b = PLACE_CHARS.indexOf(table.land[y]?.[x] ?? ".");
      if (b >= 0 && !wet) put(land, `l${b}`, table.lands[b], i);
    }
  return { regions, place, land };
}

/** The water body or landform at a square (a landform only while the square's terrain still fits it). */
export function placeAt(map: WorldMap, x: number, y: number): Region | undefined {
  const g = map.geography;
  if (!g || y < 0 || y >= map.height) return undefined;
  const i = y * map.width + wrapX(map, x);
  const r = g.regions[g.place[i]!];
  if (!r) return undefined;
  const t = map.tiles[i]!.terrain;
  if (WATER_KINDS.has(r.kind)) return t === Terrain.Ocean ? r : undefined;
  return fitsLandform(r.kind, t) ? r : undefined;
}

/** The continent or island a land square lies on. */
export function landAt(map: WorldMap, x: number, y: number): Region | undefined {
  const g = map.geography;
  if (!g || y < 0 || y >= map.height) return undefined;
  const i = y * map.width + wrapX(map, x);
  return map.tiles[i]!.terrain === Terrain.Ocean ? undefined : g.regions[g.land[i]!];
}

/** "I" .. "X" and on, for a name that every pattern has used. */
function roman(n: number): string {
  const parts: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of parts) while (n >= v) { out += s; n -= v; }
  return out;
}

/** The landform kinds in the order a landform borrows another kind's names once its own are used up. */
const WILD_KINDS: PlaceKind[] = ["mountains", "hills", "forest", "desert", "swamp", "jungle", "tundra", "ice"];

/** A civilization's own names for a place of a kind (`CivPlaces`): a landform's own kind's first, then the other landforms'. */
function ownNames(c: CivRule, kind: PlaceKind): string[] {
  const p = c.places;
  if (!p) return [];
  const list = PLACE_RULES[kind].list;
  if (list !== "wilds") return p[list];
  return [...new Set([...(p.wilds[kind] ?? []), ...WILD_KINDS.flatMap((w) => p.wilds[w] ?? [])])];
}

/** A name a civilization would give a place, and the name from its own lists it is made of (null for one after its leader). */
interface Naming {
  name: string;
  own: string | null;
}

function namings(kind: PlaceKind, size: number, civId: string, k: number): Naming[] {
  const rule = PLACE_RULES[kind];
  const c = civ(civId);
  const great = rule.great && size >= rule.great.size * k * k ? rule.great : null;
  const out: Naming[] = [];
  const add = (name: string, own: string | null) => { if (!out.some((n) => n.name === name)) out.push({ name, own }); };
  for (const own of ownNames(c, kind)) for (const p of [...(great?.own ?? []), ...rule.own]) add(p.replace("{name}", own), own);
  const possessive = c.leader.endsWith("s") ? `${c.leader}'` : `${c.leader}'s`;
  for (const p of [...(great?.names ?? []), ...rule.names]) {
    const base = p.replace("{leader's}", possessive).replace("{leader}", c.leader).replace("{adj}", c.adjective).replace("{people}", c.name);
    for (const city of base.includes("{city}") ? c.cities : [null]) add(city === null ? base : base.replace("{city}", city), null);
  }
  return out;
}

/**
 * The names a civilization would give a place of that kind and size, in its order of preference: its own
 * names written for the kind (`CIV_PLACES`, the great place's way first), then after its leader, people and cities.
 */
export function placeNames(kind: PlaceKind, size: number, civId: string, k = 1): string[] {
  return namings(kind, size, civId, k).map((n) => n.name);
}

/** Whether a name of a civilization's own already stands in a place's name (the Sea of Neptune holds Neptune). */
function holds(name: string, own: string): boolean {
  const at = name.indexOf(own);
  if (at < 0) return false;
  const word = (ch: string | undefined) => ch !== undefined && /[A-Za-z]/.test(ch);
  return !word(name[at - 1]) && !word(name[at + own.length]);
}

function discoverRegion(state: GameState, g: Geography, r: number, player: number): void {
  const region = g.regions[r];
  if (!region || region.by !== undefined) return;
  region.by = player;
  region.turn = state.turn;
  if (region.name) return;
  const used = new Set<string>();
  for (const o of g.regions) if (o.name) used.add(o.name);
  const choices = namings(region.kind, region.size, state.players[player]!.civ, state.map.width / MAP_WIDTH);
  const names = choices.map((n) => n.name);
  // Each of its own names goes to one place before any goes to a second (the Sea of Neptune, then the Gulf of
  // Salacia, not the Gulf of Neptune), then again, written for the new kind; then names after its leader.
  const fresh = (n: Naming) => n.own !== null && ![...used].some((u) => holds(u, n.own!));
  let name = choices.find((n) => fresh(n) && !used.has(n.name))?.name ?? names.find((n) => !used.has(n));
  for (let n = 2; !name; n++) name = names.map((s) => `${s} ${roman(n)}`).find((s) => !used.has(s));
  region.name = name;
}

/** A player has just explored square i: the places it lies in are discovered, named if they have no name yet. */
export function discoverSquare(state: GameState, player: number, i: number): void {
  const g = state.map.geography;
  if (!g || player === state.barbarians || state.players[player]?.civ === "barbarians") return;
  const a = g.place[i]!;
  if (a >= 0 && g.regions[a]!.by === undefined) discoverRegion(state, g, a, player);
  const b = g.land[i]!;
  if (b >= 0 && g.regions[b]!.by === undefined) discoverRegion(state, g, b, player);
}

/** Every place a player has explored a square of is discovered (after a whole map is revealed at once). */
export function discoverExplored(state: GameState, player: number): void {
  const p = state.players[player];
  if (!p || !state.map.geography) return;
  for (let i = 0; i < p.explored.length; i++) if (p.explored[i]) discoverSquare(state, player, i);
}

/** Whether a place is a continent or island (`land`) rather than a water body or landform. */
export function isLandmass(r: Region): boolean {
  return LAND_KINDS.has(r.kind);
}
