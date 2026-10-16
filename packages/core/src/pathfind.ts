import { MOVE_FRAC, TERRAIN_RULES } from "./rules/terrain.js";
import { unitType } from "./rules/units.js";
import { getTile, NEIGHBOURS, Terrain, wrapX, type GameState, type Unit } from "./types.js";

/**
 * Dijkstra over movement cost (in thirds) for a unit's domain. Enemy units
 * and cities are impassable except as the destination, so a goto can end in
 * an attack but never routes through one. Returns the step list (excluding
 * the start) or null.
 */
export function findPath(state: GameState, u: Unit, tx: number, ty: number): [number, number][] | null {
  const { width: w, height: h } = state.map;
  const type = unitType(u.type);
  const land = type.domain === "land";
  const target = ty * w + wrapX(state.map, tx);
  const start = u.y * w + u.x;
  if (start === target) return [];

  const dist = new Float64Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  dist[start] = 0;
  // Simple binary heap.
  const heap: [number, number][] = [[0, start]];
  const push = (d: number, i: number) => {
    heap.push([d, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p]![0] <= heap[k]![0]) break;
      [heap[p], heap[k]] = [heap[k]!, heap[p]!];
      k = p;
    }
  };
  const pop = (): [number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        k = m;
      }
    }
    return top;
  };

  // Foreign units and cities are impassable (except as the destination); own cities let ships in.
  const blockedSet = new Set<number>();
  const ownCities = new Set<number>();
  for (const o of state.units) if (o.owner !== u.owner) blockedSet.add(o.y * w + o.x);
  for (const c of state.cities) (c.owner === u.owner ? ownCities : blockedSet).add(c.y * w + c.x);
  const blocked = (i: number): boolean => blockedSet.has(i);

  while (heap.length) {
    const [d, i] = pop()!;
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
      const isCity = ownCities.has(ni);
      if (land && to.terrain === Terrain.Ocean) {
        // Land units may path onto a friendly ship as the destination only.
        if (ni !== target) continue;
      } else if (!land && type.domain === "sea" && to.terrain !== Terrain.Ocean && !isCity) continue;
      if (ni !== target && blocked(ni)) continue;
      let cost: number;
      if (!land) cost = MOVE_FRAC;
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
