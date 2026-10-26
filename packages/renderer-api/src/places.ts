import { landAt, NEIGHBOURS, placeAt, WATER_KINDS, wrapX, type GameState, type Geography, type PlaceKind, type Region, type WorldMap } from "@civ/core";

/**
 * The names of the world's places on the map (`map/geography.ts` in core): which to write where in
 * the view, the square window's line, and the note when our explorers find new ones.
 */

/** A place's name as a map label, without its "the" ("Sea of Caesar"). */
export function placeLabelText(name: string): string {
  return name.replace(/^the /, "");
}

/** A place's name at the start of a sentence ("The Sahara"). */
export function placeTitle(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** How deep each square lies inside its place and inside its land: 1 on the edge, more inward. */
interface Depths {
  place: Uint8Array;
  land: Uint8Array;
}
const depthCache = new WeakMap<Geography, Depths>();

function layerDepth(map: WorldMap, layer: Int16Array): Uint8Array {
  const { width: w, height: h } = map;
  const depth = new Uint8Array(w * h);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (layer[i]! < 0) continue;
    const x = i % w;
    const y = (i - x) / w;
    // The edge: next to another place, nothing, or the top or bottom of the world.
    let edge = false;
    for (const [dx, dy] of NEIGHBOURS) {
      if (y + dy < 0 || y + dy >= h || layer[(y + dy) * w + wrapX(map, x + dx)] !== layer[i]) { edge = true; break; }
    }
    if (edge) { depth[i] = 1; queue.push(i); }
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const x = c % w;
    const y = (c - x) / w;
    for (const [dx, dy] of NEIGHBOURS) {
      if (y + dy < 0 || y + dy >= h) continue;
      const j = (y + dy) * w + wrapX(map, x + dx);
      if (depth[j] || layer[j] !== layer[c]) continue;
      depth[j] = Math.min(255, depth[c]! + 1);
      queue.push(j);
    }
  }
  return depth;
}

function depthsOf(map: WorldMap, g: Geography): Depths {
  let d = depthCache.get(g);
  if (!d) {
    d = { place: layerDepth(map, g.place), land: layerDepth(map, g.land) };
    depthCache.set(g, d);
  }
  return d;
}

/** A place's name to write on the map: the squares of the view (from its top left) it may be centred on, the best first. */
export interface PlaceLabel {
  region: number;
  name: string;
  kind: PlaceKind;
  /** A continent or island (written larger and spaced), not a water body or landform. */
  land: boolean;
  at: { tx: number; ty: number }[];
}

/**
 * How near the unit in play a place must lie for its name to show, in squares (asked for 2026-10-25:
 * every name on view was "too crowded", then names near every unit still were: one name at a time, "the
 * closest to the unit").
 */
export const NAME_REACH = 2;

/**
 * The one place to name in a view `cols` x `rows` squares from (x0, y0): the place nearest the player's
 * unit in play (none when no unit of theirs is in play), from the explored squares on view within
 * `NAME_REACH` of it. The square it stands on names its sea or landform before its land (the Alps before
 * Europe), and nearer places come before further ones; a tie goes to the bigger place. The label may sit on
 * any square of that place near the unit: best a square in from the view's sides, clear of our units, on
 * another row than the unit (a name runs across its row), nearest the unit, furthest inside the place.
 */
export function placeLabel(state: GameState, viewer: number, x0: number, y0: number, cols: number, rows: number): PlaceLabel | null {
  const { map } = state;
  const g = map.geography;
  const me = state.players[viewer];
  const unit = state.activeUnit === null ? undefined : state.units.find((u) => u.id === state.activeUnit);
  if (!g || !me || !unit || unit.owner !== viewer) return null;
  const ours = new Set(state.units.filter((u) => u.owner === viewer).map((u) => u.y * map.width + u.x));
  const depth = depthsOf(map, g);
  // Every square of every place near the unit, with how far it lies.
  type Spot = { tx: number; ty: number; dx: number; dy: number; d: number; i: number };
  const spots = new Map<number, { land: boolean; d: number; at: Spot[] }>();
  for (let ty = 0; ty < rows; ty++) {
    const y = y0 + ty;
    const dy = y - unit.y;
    if (y < 0 || y >= map.height || Math.abs(dy) > NAME_REACH) continue;
    for (let tx = 0; tx < cols; tx++) {
      const x = wrapX(map, x0 + tx);
      let dx = ((x - unit.x) % map.width + map.width) % map.width;
      if (dx > map.width / 2) dx -= map.width;
      if (Math.abs(dx) > NAME_REACH) continue;
      const i = y * map.width + x;
      if (!me.explored[i]) continue;
      const spot = { tx, ty, dx, dy, d: dx * dx + dy * dy, i };
      const add = (r: number, land: boolean) => {
        if (!g.regions[r]?.name) return;
        const b = spots.get(r);
        if (!b) spots.set(r, { land, d: spot.d, at: [spot] });
        else { b.d = Math.min(b.d, spot.d); b.at.push(spot); }
      };
      if (placeAt(map, x, y)) add(g.place[i]!, false);
      if (landAt(map, x, y)) add(g.land[i]!, true);
    }
  }
  let best: [number, { land: boolean; d: number; at: Spot[] }] | null = null;
  for (const e of spots) {
    if (!best) { best = e; continue; }
    const [r, b] = e;
    const [br, bb] = best;
    const nearer = b.d - bb.d || Number(b.land) - Number(bb.land) || g.regions[br]!.size - g.regions[r]!.size;
    if (nearer < 0) best = e;
  }
  if (!best) return null;
  const [region, { land, at }] = best;
  const edge = (p: Spot) => (p.tx >= 1 && p.tx < cols - 1 ? 0 : 1);
  const layer = land ? depth.land : depth.place;
  at.sort((a, b) =>
    edge(a) - edge(b) ||
    Number(ours.has(a.i)) - Number(ours.has(b.i)) ||
    Number(a.dy === 0) - Number(b.dy === 0) ||
    Math.max(Math.abs(a.dx), Math.abs(a.dy)) - Math.max(Math.abs(b.dx), Math.abs(b.dy)) ||
    Math.abs(a.dx) - Math.abs(b.dx) ||
    layer[b.i]! - layer[a.i]!);
  const r = g.regions[region]!;
  return { region, name: r.name!, kind: r.kind, land, at: at.map(({ tx, ty }) => ({ tx, ty })) };
}

/**
 * The square window's title: its terrain, then where it lies ("Grassland, Ausonia"; "The Sahara, Africa"). The
 * terrain's word is left out when its place's name already says it ("The Apennine Mountains, Ausonia"), and
 * a water's name always stands for the sea it is ("The Sea of Neptune", "Lake Avernus").
 */
export function squareTitle(state: GameState, x: number, y: number, terrain: string, water: boolean): string {
  const place = placeAt(state.map, x, y)?.name;
  const land = landAt(state.map, x, y)?.name;
  const said = place !== undefined && (water || new RegExp(`\\b${terrain}\\b`, "i").test(place));
  return placeTitle([said ? undefined : terrain, place, land].filter((n): n is string => !!n).join(", "));
}

/** The places a player saw first (`Region.by`), by index into the geography's regions. */
export function placesFoundBy(state: GameState, player: number): number[] {
  const g = state.map.geography;
  if (!g) return [];
  const out: number[] = [];
  g.regions.forEach((r, i) => { if (r.by === player) out.push(i); });
  return out;
}

/** The note beside our explorer when it finds places: "Discovered: the Caesar Desert, Lake Capua"; past three, how many more. */
export function discoveryNote(regions: readonly Region[]): string {
  // Waters and continents first, as the bigger news.
  const rank = (r: Region) => (WATER_KINDS.has(r.kind) ? 0 : r.kind === "continent" || r.kind === "island" ? 1 : 2);
  const names = [...regions].sort((a, b) => rank(a) - rank(b) || b.size - a.size).map((r) => r.name).filter((n): n is string => !!n);
  const more = names.length - 3;
  return `Discovered: ${more > 1 ? `${names.slice(0, 3).join(", ")} and ${more} more` : names.join(", ")}`;
}
