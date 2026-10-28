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

/**
 * Where a place's name stands in the world (asked for 2026-10-26: the continent's name "follow the unit - fix
 * that - show static"): in each block of `ANCHOR_CELL` squares the place covers, its square furthest inside it
 * (the first in reading order on a tie), and none on its edge where it has an inside. Fixed by the world alone,
 * so a name stays where it is written while a unit walks about.
 */
export const ANCHOR_CELL = { w: 8, h: 6 } as const;
interface Anchors {
  place: Map<number, number[]>;
  land: Map<number, number[]>;
}
const anchorCache = new WeakMap<Geography, Anchors>();

function layerAnchors(map: WorldMap, layer: Int16Array, depth: Uint8Array): Map<number, number[]> {
  const deepest = new Map<number, number>();
  for (let i = 0; i < layer.length; i++) {
    const r = layer[i]!;
    if (r >= 0 && depth[i]! > (deepest.get(r) ?? 0)) deepest.set(r, depth[i]!);
  }
  const across = Math.ceil(map.width / ANCHOR_CELL.w);
  const best = new Map<string, number>();
  for (let i = 0; i < layer.length; i++) {
    const r = layer[i]!;
    if (r < 0 || depth[i]! < Math.min(2, deepest.get(r)!)) continue;
    const x = i % map.width;
    const cell = Math.floor((i - x) / map.width / ANCHOR_CELL.h) * across + Math.floor(x / ANCHOR_CELL.w);
    const key = `${r}:${cell}`;
    const b = best.get(key);
    if (b === undefined || depth[i]! > depth[b]!) best.set(key, i);
  }
  const out = new Map<number, number[]>();
  for (const i of best.values()) {
    const r = layer[i]!;
    out.set(r, [...(out.get(r) ?? []), i]);
  }
  return out;
}

function anchorsOf(map: WorldMap, g: Geography): Anchors {
  let a = anchorCache.get(g);
  if (!a) {
    const d = depthsOf(map, g);
    a = { place: layerAnchors(map, g.place, d.place), land: layerAnchors(map, g.land, d.land) };
    anchorCache.set(g, a);
  }
  return a;
}

/** The squares between two, as the crow flies (squared), the short way round the world's seam. */
function apart(map: WorldMap, i: number, x: number, y: number): number {
  const ix = i % map.width;
  let dx = Math.abs(ix - x) % map.width;
  if (dx > map.width / 2) dx = map.width - dx;
  const dy = (i - ix) / map.width - y;
  return dx * dx + dy * dy;
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
 * Europe), and nearer places come before further ones; a tie goes to the bigger place. The name is written
 * where the place's own anchors stand (`ANCHOR_CELL`), the one nearest the unit first, not beside the unit: an
 * anchor off the view or unexplored gives way to the place's explored square on view nearest it, a square in
 * from the view's sides.
 */
export function placeLabel(state: GameState, viewer: number, x0: number, y0: number, cols: number, rows: number): PlaceLabel | null {
  const { map } = state;
  const g = map.geography;
  const me = state.players[viewer];
  const unit = state.activeUnit === null ? undefined : state.units.find((u) => u.id === state.activeUnit);
  if (!g || !me || !unit || unit.owner !== viewer) return null;
  // Every place near the unit, with how far it lies.
  const near = new Map<number, { land: boolean; d: number }>();
  for (let dy = -NAME_REACH; dy <= NAME_REACH; dy++) {
    const y = unit.y + dy;
    if (y < 0 || y >= map.height || y < y0 || y >= y0 + rows) continue;
    for (let dx = -NAME_REACH; dx <= NAME_REACH; dx++) {
      const x = wrapX(map, unit.x + dx);
      const tx = ((x - x0) % map.width + map.width) % map.width;
      const i = y * map.width + x;
      if (tx >= cols || !me.explored[i]) continue;
      const d = dx * dx + dy * dy;
      const add = (r: number, land: boolean) => {
        if (!g.regions[r]?.name) return;
        const b = near.get(r);
        if (!b || d < b.d) near.set(r, { land, d });
      };
      if (placeAt(map, x, y)) add(g.place[i]!, false);
      if (landAt(map, x, y)) add(g.land[i]!, true);
    }
  }
  let best: [number, { land: boolean; d: number }] | null = null;
  for (const e of near) {
    if (!best) { best = e; continue; }
    const [r, b] = e;
    const [br, bb] = best;
    const nearer = b.d - bb.d || Number(b.land) - Number(bb.land) || g.regions[br]!.size - g.regions[r]!.size;
    if (nearer < 0) best = e;
  }
  if (!best) return null;
  const [region, { land }] = best;
  // The place's explored squares on view, those a square in from the sides if it has any.
  const fits = (x: number, y: number) => (land ? landAt(map, x, y) : placeAt(map, x, y)) === g.regions[region];
  const all: { tx: number; ty: number; i: number }[] = [];
  for (let ty = 0; ty < rows; ty++) {
    const y = y0 + ty;
    if (y < 0 || y >= map.height) continue;
    for (let tx = 0; tx < cols; tx++) {
      const x = wrapX(map, x0 + tx);
      const i = y * map.width + x;
      if (me.explored[i] && fits(x, y)) all.push({ tx, ty, i });
    }
  }
  const inner = all.filter((s) => s.tx >= 1 && s.tx < cols - 1);
  const shown = inner.length ? inner : all;
  if (!shown.length) return null;
  // Its anchors nearest the unit first, each written on itself or the shown square nearest it.
  const anchors = [...((land ? anchorsOf(map, g).land : anchorsOf(map, g).place).get(region) ?? [])]
    .sort((a, b) => apart(map, a, unit.x, unit.y) - apart(map, b, unit.x, unit.y) || a - b)
    .slice(0, 4);
  const at: { tx: number; ty: number }[] = [];
  for (const a of anchors) {
    const ax = a % map.width;
    const ay = (a - ax) / map.width;
    let pick = shown[0]!;
    for (const s of shown) if (apart(map, s.i, ax, ay) < apart(map, pick.i, ax, ay)) pick = s;
    if (!at.some((p) => p.tx === pick.tx && p.ty === pick.ty)) at.push({ tx: pick.tx, ty: pick.ty });
  }
  if (!at.length) at.push({ tx: shown[0]!.tx, ty: shown[0]!.ty });
  const r = g.regions[region]!;
  return { region, name: r.name!, kind: r.kind, land, at };
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

/**
 * The word written small under a land's name on the map (asked for 2026-10-27: a continent's name alone was
 * "not clear that is a continent name"): "continent" or "island"; null for any other place, or when the name
 * says it already ("the Isle of Capua").
 */
export function landWord(kind: PlaceKind, name: string): string | null {
  if (kind !== "continent" && kind !== "island") return null;
  return (kind === "island" ? /\b(isle|island)s?\b/i : /\bcontinents?\b/i).test(name) ? null : kind;
}

/** A continent's name on the minimap, written over square (x, y); `squares` is how much of it the viewer has explored. */
export interface ContinentLabel {
  region: number;
  name: string;
  x: number;
  y: number;
  squares: number;
}

/**
 * The continents `viewer` has found, to name on the minimap (asked for 2026-10-27: "when discovered add to the
 * minimap"): each continent with a name and a square of it explored, written over its explored square nearest
 * the middle of all it has explored of it (unwrapped across the world's seam), the most explored first.
 * Islands are left to the map: on the minimap they would crowd it.
 */
export function continentLabels(state: GameState, viewer: number): ContinentLabel[] {
  const { map } = state;
  const g = map.geography;
  const me = state.players[viewer];
  if (!g || !me) return [];
  const w = map.width;
  const found = new Map<number, { x: number; y: number }[]>();
  for (let i = 0; i < g.land.length; i++) {
    if (!me.explored[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    const r = landAt(map, x, y);
    if (r?.kind !== "continent" || !r.name) continue;
    const region = g.land[i]!;
    const squares = found.get(region);
    if (!squares) { found.set(region, [{ x, y }]); continue; }
    // Unwrapped from the first square found, so a continent across the seam keeps its shape.
    let dx = x - squares[0]!.x;
    if (dx > w / 2) dx -= w;
    if (dx < -w / 2) dx += w;
    squares.push({ x: squares[0]!.x + dx, y });
  }
  const out: ContinentLabel[] = [];
  for (const [region, squares] of found) {
    const mx = squares.reduce((n, p) => n + p.x, 0) / squares.length;
    const my = squares.reduce((n, p) => n + p.y, 0) / squares.length;
    const at = squares.reduce((a, p) => ((p.x - mx) ** 2 + (p.y - my) ** 2 < (a.x - mx) ** 2 + (a.y - my) ** 2 ? p : a));
    out.push({ region, name: g.regions[region]!.name!, x: ((at.x % w) + w) % w, y: at.y, squares: squares.length });
  }
  return out.sort((a, b) => b.squares - a.squares || a.region - b.region);
}

/** The places a player saw first (`Region.by`), by index into the geography's regions. */
export function placesFoundBy(state: GameState, player: number): number[] {
  const g = state.map.geography;
  if (!g) return [];
  const out: number[] = [];
  g.regions.forEach((r, i) => { if (r.by === player) out.push(i); });
  return out;
}

/**
 * The note beside our explorer when it finds places: "Discovered: the Caesar Desert, Lake Capua"; past three, how many
 * more. `resources`, strategic resources it came upon that we lack ("Discovered: Iron, Lake Capua"), come first.
 */
export function discoveryNote(regions: readonly Region[], resources: readonly string[] = []): string {
  // Waters and continents first, as the bigger news.
  const rank = (r: Region) => (WATER_KINDS.has(r.kind) ? 0 : r.kind === "continent" || r.kind === "island" ? 1 : 2);
  const names = [...resources, ...[...regions].sort((a, b) => rank(a) - rank(b) || b.size - a.size).map((r) => r.name).filter((n): n is string => !!n)];
  const more = names.length - 3;
  return `Discovered: ${more > 1 ? `${names.slice(0, 3).join(", ")} and ${more} more` : names.join(", ")}`;
}
