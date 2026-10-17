import { MOVE_FRAC, TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { getTile, NEIGHBOURS, Terrain, wrapX, type GameState, type Unit } from "./types.js";

let DIST = new Float64Array(0);
let PREV = new Int32Array(0);
/** Squares no path may cross (foreign units and cities) and our own cities (ships may enter), per search. */
let BLOCKED = new Uint8Array(0);
let OWN_CITY = new Uint8Array(0);
/** The open list: a binary heap of (distance, square) kept in two parallel arrays. */
let HEAP_D = new Float64Array(1024);
let HEAP_I = new Int32Array(1024);

/**
 * Dijkstra over movement cost (in thirds) for a unit's domain. Enemy units
 * and cities are impassable except as the destination, so a goto can end in
 * an attack but never routes through one. Returns the step list (excluding
 * the start) or null. The heap compares and swaps exactly as a plain array
 * heap would, so among equally short routes the same one always wins (saved
 * games replay their gotos step for step).
 */
export function findPath(state: GameState, u: Unit, tx: number, ty: number): [number, number][] | null {
  const { width: w, height: h } = state.map;
  const type = unitType(u.type);
  const land = type.domain === "land";
  const target = ty * w + wrapX(state.map, tx);
  const start = u.y * w + u.x;
  if (start === target) return [];
  if (ty < 0 || ty >= h) return null;

  // Scratch buffers are reused between searches (sized to the map); every cell is reset here.
  if (DIST.length !== w * h) {
    DIST = new Float64Array(w * h);
    PREV = new Int32Array(w * h);
    BLOCKED = new Uint8Array(w * h);
    OWN_CITY = new Uint8Array(w * h);
  }
  const dist = DIST.fill(Infinity);
  const prev = PREV.fill(-1);
  const blocked = BLOCKED.fill(0);
  const ownCity = OWN_CITY.fill(0);
  dist[start] = 0;
  let size = 0;
  const push = (d: number, i: number) => {
    if (size === HEAP_D.length) {
      const nd = new Float64Array(size * 2);
      nd.set(HEAP_D);
      HEAP_D = nd;
      const ni = new Int32Array(size * 2);
      ni.set(HEAP_I);
      HEAP_I = ni;
    }
    const hd = HEAP_D;
    const hi = HEAP_I;
    let k = size++;
    hd[k] = d;
    hi[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hd[p]! <= hd[k]!) break;
      const td = hd[p]!; hd[p] = hd[k]!; hd[k] = td;
      const ti = hi[p]!; hi[p] = hi[k]!; hi[k] = ti;
      k = p;
    }
  };
  /** Pops the smallest into `top`; false when the heap is empty. */
  let topD = 0;
  let topI = 0;
  const pop = (): boolean => {
    if (size === 0) return false;
    const hd = HEAP_D;
    const hi = HEAP_I;
    topD = hd[0]!;
    topI = hi[0]!;
    size--;
    if (size > 0) {
      hd[0] = hd[size]!;
      hi[0] = hi[size]!;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < size && hd[l]! < hd[m]!) m = l;
        if (r < size && hd[r]! < hd[m]!) m = r;
        if (m === k) break;
        const td = hd[m]!; hd[m] = hd[k]!; hd[k] = td;
        const ti = hi[m]!; hi[m] = hi[k]!; hi[k] = ti;
        k = m;
      }
    }
    return true;
  };
  push(0, start);

  // Foreign units and cities are impassable (except as the destination); own cities let ships in.
  for (const o of state.units) if (o.owner !== u.owner) blocked[o.y * w + o.x] = 1;
  for (const c of state.cities) {
    if (c.owner === u.owner) ownCity[c.y * w + c.x] = 1;
    else blocked[c.y * w + c.x] = 1;
  }

  while (pop()) {
    const d = topD;
    const i = topI;
    if (d > dist[i]!) continue;
    if (i === target) break;
    const x = i % w;
    const y = Math.floor(i / w);
    const from = state.map.tiles[i]!;
    for (const [dx, dy] of NEIGHBOURS) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      const nx = wrapX(state.map, x + dx);
      const ni = ny * w + nx;
      const to = getTile(state.map, nx, ny)!;
      const isCity = ownCity[ni] === 1;
      if (land && to.terrain === Terrain.Ocean) {
        // Land units may path onto a friendly ship as the destination only.
        if (ni !== target) continue;
      } else if (!land && type.domain === "sea" && to.terrain !== Terrain.Ocean && !isCity) continue;
      if (ni !== target && blocked[ni] === 1) continue;
      let cost: number;
      if (!land) cost = MOVE_FRAC;
      else if (from.railroad && to.railroad) cost = 0;
      else if (from.road && to.road) cost = 1;
      else if (from.river && to.river && (dx === 0 || dy === 0)) cost = 1;
      else cost = TERRAIN_RULES[to.terrain].moveCost * MOVE_FRAC;
      const nd = d + cost;
      if (nd < dist[ni]!) {
        dist[ni] = nd;
        prev[ni] = i;
        push(nd, ni);
      }
    }
  }
  if (!Number.isFinite(dist[target])) return null;
  const path: [number, number][] = [];
  for (let i = target; i !== start; i = prev[i]!) path.push([i % w, Math.floor(i / w)]);
  path.reverse();
  return path;
}

/** Direction (dx, dy) from a unit toward the next step of a path, wrap-aware. */
export function stepDir(state: GameState, u: Unit, step: [number, number]): [number, number] {
  const w = state.map.width;
  let dx = step[0] - u.x;
  if (dx > 1) dx -= w;
  if (dx < -1) dx += w;
  return [Math.sign(dx), Math.sign(step[1] - u.y)];
}
