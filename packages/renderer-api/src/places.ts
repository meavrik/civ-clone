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

/** A place's name to write on the map, centred on a square of the view (`tx`, `ty` from its top left). */
export interface PlaceLabel {
  region: number;
  name: string;
  kind: PlaceKind;
  /** A continent or island (written larger and spaced), not a water body or landform. */
  land: boolean;
  tx: number;
  ty: number;
}

/** The smallest part of a place on view that is named there, in squares. */
const SHOWN_MIN: Partial<Record<PlaceKind, number>> = { lake: 2, continent: 4, island: 2 };
const SHOWN_DEFAULT = 3;
/** The order labels are placed in, the first winning where two would overlap. */
const LABEL_ORDER: PlaceKind[] = ["continent", "ocean", "sea", "bay", "desert", "mountains", "ice", "forest", "jungle", "swamp", "tundra", "hills", "island", "lake"];

/**
 * The places to name in a view `cols` x `rows` squares from (x0, y0), for the player: each place
 * with enough explored squares on view, written on its square on view furthest inside it (away
 * from its edges and a square in from the view's sides), the first such square in reading order
 * on a tie. Labels come in `LABEL_ORDER`, bigger places first.
 */
export function placeLabels(state: GameState, viewer: number, x0: number, y0: number, cols: number, rows: number): PlaceLabel[] {
  const { map } = state;
  const g = map.geography;
  const me = state.players[viewer];
  if (!g || !me) return [];
  const depth = depthsOf(map, g);
  const best = new Map<number, { tx: number; ty: number; score: number; count: number; land: boolean }>();
  for (let ty = 0; ty < rows; ty++) {
    const y = y0 + ty;
    if (y < 0 || y >= map.height) continue;
    for (let tx = 0; tx < cols; tx++) {
      const x = wrapX(map, x0 + tx);
      const i = y * map.width + x;
      if (!me.explored[i]) continue;
      const inside = tx >= 1 && tx < cols - 1 ? 1 : 0;
      const consider = (r: number, d: number, land: boolean) => {
        const score = inside * 1000 + d;
        const b = best.get(r);
        if (!b) best.set(r, { tx, ty, score, count: 1, land });
        else {
          b.count++;
          if (score > b.score) Object.assign(b, { tx, ty, score });
        }
      };
      if (placeAt(map, x, y)) consider(g.place[i]!, depth.place[i]!, false);
      if (landAt(map, x, y)) consider(g.land[i]!, depth.land[i]!, true);
    }
  }
  const out: PlaceLabel[] = [];
  for (const [r, b] of best) {
    const region = g.regions[r]!;
    if (!region.name || b.count < (SHOWN_MIN[region.kind] ?? SHOWN_DEFAULT)) continue;
    out.push({ region: r, name: region.name, kind: region.kind, land: b.land, tx: b.tx, ty: b.ty });
  }
  const size = (l: PlaceLabel) => g.regions[l.region]!.size;
  out.sort((a, b) => LABEL_ORDER.indexOf(a.kind) - LABEL_ORDER.indexOf(b.kind) || size(b) - size(a) || a.region - b.region);
  // A name a premade world gives two landforms (a plateau's desert and its hills) is written once.
  const named = new Set<string>();
  return out.filter((l) => {
    if (named.has(l.name)) return false;
    named.add(l.name);
    return true;
  });
}

/** The square window's line on where a square lies: "The Sahara, Africa", "The Sea of Caesar". */
export function placeLine(state: GameState, x: number, y: number): string | null {
  const place = placeAt(state.map, x, y)?.name;
  const land = landAt(state.map, x, y)?.name;
  const parts = [place, land].filter((n): n is string => !!n);
  return parts.length ? placeTitle(parts.join(", ")) : null;
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
