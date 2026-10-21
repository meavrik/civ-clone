import { Terrain, unitType, type Unit, type WorldMap } from "@civ/core";
import { courseGap, FIELD_E, FIELD_N, FIELD_S, FIELD_W, fieldLayout, hash, roadWays, WORK_ICON, type Explored, type RoadWays } from "@civ/renderer-api";
import { drawIcon } from "./icons.js";
import { drawText, textWidth } from "./font.js";
import { C, shade } from "./palette.js";
import { Surface } from "./surface.js";
import { TILE } from "./tiles.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { darker, FEATURE_SHEET, ownerBox, spriteSurface, UNIT_SHEET } from "./sprites/index.js";

/** Half-widths of a road in pixels: its beaten track, and the worn edge the grass breaks into. */
const ROAD_CORE = 0.6;
const ROAD_EDGE = 1.25;
/** Half-widths of a railroad: its sleepers on gravel, and the rails either side. */
const RAIL_CORE = 1;
const RAIL_EDGE = 2;
/** A railroad's sleepers lie across the road this many pixels apart (as near as fits along each course). */
const SLEEPER_GAP = 3;

/** Whether palette index `c` lies in a ramp. */
function inRamp(c: number, ramp: string): boolean {
  const base = shade(ramp, 0);
  return c >= base && c < base + 8;
}

const wayCache = new Map<string, Surface>();

/**
 * A road or railroad across one square (see `roadWays`), as a sprite keyed by
 * SPRITE_CLEAR. A road is a narrow track of beaten earth, worn here and there,
 * its edge broken by the grass; a railroad lays bright rails either side of
 * dark sleepers on gravel, spaced evenly along each course
 * so they meet the next square's. A road square with no links is a small
 * round patch.
 */
function waySurface(ways: RoadWays, x: number, y: number, rail: boolean): Surface {
  const key = `${rail ? "r" : "w"}${ways.key}`;
  const hit = wayCache.get(key);
  if (hit) return hit;
  const out = new Surface(TILE, TILE);
  out.fill(SPRITE_CLEAR);
  const surface = shade("earth", 6);
  const worn = shade("earth", 5);
  const edge = shade("earth", 2);
  const steel = shade("stone", 6);
  const ballast = shade("stone", 3);
  const sleeper = shade("earth", 1);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const u = (i + 0.5) / TILE;
      const v = (j + 0.5) / TILE;
      let d = Infinity;
      let along = 0;
      let gap = SLEEPER_GAP;
      for (const c of ways.courses) {
        const g = courseGap(c, u, v);
        if (g.gap * TILE >= d) continue;
        d = g.gap * TILE;
        along = g.along * TILE;
        gap = (g.length * TILE) / Math.max(1, Math.round((g.length * TILE) / SLEEPER_GAP));
      }
      if (ways.patch) d = Math.hypot(u - ways.patch[0], v - ways.patch[1]) * TILE - 1.5;
      const grain = hash(x * TILE + i, y * TILE + j, 7);
      let c = -1;
      if (rail) {
        if (d >= RAIL_CORE && d < RAIL_EDGE) c = steel;
        else if (d < RAIL_CORE) c = Math.abs(along / gap - Math.round(along / gap)) * gap < 0.5 ? sleeper : ballast;
      } else if (d < ROAD_CORE) c = grain < 0.25 ? worn : surface;
      else if (d < ROAD_EDGE && grain > 0.6) c = edge;
      if (c >= 0) out.set(i, j, c);
    }
  if (wayCache.size > 4096) wayCache.clear();
  wayCache.set(key, out);
  return out;
}

/** The road across square (x, y), as the viewer knows it (`explored`). */
export function drawRoad(s: Surface, dx: number, dy: number, map: WorldMap, explored: Explored, x: number, y: number): void {
  const ways = roadWays(map, explored, x, y);
  if (ways) s.blit(waySurface(ways, x, y, false), dx, dy, SPRITE_CLEAR);
}

/** The railroad across square (x, y), over its road. */
export function drawRailroad(s: Surface, dx: number, dy: number, map: WorldMap, explored: Explored, x: number, y: number): void {
  const ways = roadWays(map, explored, x, y, true);
  if (ways) s.blit(waySurface(ways, x, y, true), dx, dy, SPRITE_CLEAR);
}

/** Fortress: a square rampart with corner towers. */
export function drawFortress(s: Surface, dx: number, dy: number): void {
  const wall = shade("stone", 5);
  const dark = shade("stone", 2);
  s.frame(dx + 2, dy + 2, 12, 12, wall);
  s.frame(dx + 3, dy + 3, 10, 10, dark);
  for (const [tx, ty] of [[2, 2], [12, 2], [2, 12], [12, 12]] as const) s.rect(dx + tx, dy + ty, 2, 2, wall);
}

/** Pollution: a smear of dark specks across the tile. */
export function drawPollution(s: Surface, dx: number, dy: number): void {
  const c = shade("stone", 0);
  for (let i = 0; i < 14; i++) {
    const x = (i * 7 + 3) % TILE;
    const y = (i * 5 + 2) % TILE;
    s.set(dx + x, dy + y, c);
    s.set(dx + ((x + 1) % TILE), dy + y, c);
  }
}

/** Crops on irrigated plots (see `fieldLayout`), each as its light row and its dark row. */
const CROPS: readonly (readonly [number, number])[] = [
  [shade("plains", 6), shade("plains", 4)], // ripe grain
  [shade("grass", 6), shade("grass", 3)], // green shoots
  [shade("earth", 5), shade("earth", 3)], // ploughed earth
  [shade("sand", 6), shade("sand", 4)], // pale grain
];
/** Terrain whose relief stays above the fields: hills keep their knolls (the pixels of this ramp). */
const RELIEF: Partial<Record<Terrain, string>> = { [Terrain.Hills]: "earth" };
/** The canal through an irrigated square runs along this row. */
const CANAL = 7;

/**
 * Irrigation: the square's land turned to fields, plots of crops in rows either
 * side of a canal (see `fieldLayout`). `ground` is the square as drawn beneath
 * (`terrainSquare`): water in it (shore, river) stays, with a bank of the
 * terrain beside it that the canal cuts through, and so do the knolls of hills.
 * A strip of the terrain shows along each side, except toward irrigated
 * neighbours (`sides`, see `fieldSides`), where the fields and the canal run on.
 * The fields are laid in screen pixels over a ground as fine as the screen: a
 * screen pixel counts as water (or relief) if any of its fine pixels is.
 */
export function drawIrrigation(s: Surface, dx: number, dy: number, ground: Surface, terrain: Terrain, x: number, y: number, sides: number): void {
  const { plots, splits } = fieldLayout(x, y);
  const relief = RELIEF[terrain];
  const canal = shade("sea", 5);
  const last = TILE - 1;
  const gk = ground.k;
  /** Whether any fine pixel of the ground's screen pixel (i, j) lies in a ramp. */
  const any = (i: number, j: number, ramp: string) => {
    for (let fj = 0; fj < gk; fj++) for (let fi = 0; fi < gk; fi++) if (inRamp(ground.fget(i * gk + fi, j * gk + fj), ramp)) return true;
    return false;
  };
  const wet = (i: number, j: number) => i >= 0 && j >= 0 && i < TILE && j < TILE && any(i, j, "sea");
  for (let j = 0; j < TILE; j++) {
    if ((j === 0 && !(sides & FIELD_N)) || (j === last && !(sides & FIELD_S))) continue;
    const south = j > CANAL;
    const split = Math.round(splits[south ? 1 : 0] * TILE);
    for (let i = 0; i < TILE; i++) {
      if ((i === 0 && !(sides & FIELD_W)) || (i === last && !(sides & FIELD_E))) continue;
      if (wet(i, j) || (relief && any(i, j, relief))) continue;
      if (j === CANAL) { s.set(dx + i, dy + j, canal); continue; }
      if (wet(i - 1, j) || wet(i + 1, j) || wet(i, j - 1) || wet(i, j + 1)) continue;
      const plot = plots[(south ? 2 : 0) + (i >= split ? 1 : 0)]!;
      const [light, dark] = CROPS[plot.crop]!;
      s.set(dx + i, dy + j, (plot.across ? j : i) & 1 ? dark : light);
    }
  }
}

/** Mine: a rock mound with a timber-framed shaft and rails running out of it, from the features sheet. */
export function drawMine(s: Surface, dx: number, dy: number): void {
  const mine = spriteSurface(FEATURE_SHEET, "mine");
  if (mine) s.blit(mine, dx, dy, SPRITE_CLEAR);
}

export const UNIT_ABBR: Record<string, string> = {
  settlers: "S", militia: "M", phalanx: "P", legion: "L", cavalry: "C", chariot: "Ch",
  catapult: "Ca", knights: "K", musketeers: "Mu", cannon: "Cn", riflemen: "R", mech_inf: "MI",
  armor: "A", artillery: "Ar", diplomat: "D", caravan: "Cv", trireme: "T", sail: "Sl",
  frigate: "F", ironclad: "I", cruiser: "Cr", battleship: "B", submarine: "Su", carrier: "CV",
  transport: "Tr", fighter: "Ft", bomber: "Bo", nuclear: "N",
};

const spriteCache = new Map<string, Surface>();

/**
 * A unit as the map shows it: the owner's colour box with the unit's figure
 * from the units sheet on top. Clear pixels are SPRITE_CLEAR, so blit with
 * that key. A type missing from the sheet falls back to its letters.
 */
export function unitSprite(type: string, color: number): Surface {
  const key = `${type}:${color}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const s = new Surface(TILE, TILE);
  s.fill(SPRITE_CLEAR);
  s.blit(ownerBox(color), 0, 0, SPRITE_CLEAR);
  const figure = spriteSurface(UNIT_SHEET, type, color);
  if (figure) s.blit(figure, 0, 0, SPRITE_CLEAR);
  else {
    const label = UNIT_ABBR[type] ?? "?";
    drawText(s, Math.floor(8 - textWidth(label) / 2), 4, label, C.BLACK!);
  }
  void unitType;
  spriteCache.set(key, s);
  return s;
}

export function drawUnit(s: Surface, u: Pick<Unit, "type" | "order">, dx: number, dy: number, color: number, stacked: boolean): void {
  if (stacked) {
    // A second box edge peeking out shows a stack, like the original.
    s.rect(dx + 3, dy + 3, 13, 13, C.BLACK!);
    s.rect(dx + 4, dy + 4, 11, 11, darker(color));
  }
  s.blit(unitSprite(u.type, color), dx, dy, SPRITE_CLEAR);
  if (u.order.kind === "fortified") {
    s.frame(dx, dy, TILE, TILE, shade("stone", 6));
  } else if (u.order.kind === "sentry") {
    s.hline(dx + 4, dy + 15, 8, C.WHITE!);
  } else if (u.order.kind === "work") {
    // A settler at work wears a badge of its job in the top right corner.
    s.rect(dx + 7, dy, 9, 9, C.BLACK!);
    drawIcon(s, WORK_ICON[u.order.work], dx + 8, dy);
  }
}

/** A unit's hit points as a bar down its left edge: green, then yellow, then red as they run out. */
export function drawHpBar(s: Surface, dx: number, dy: number, hp: number, max: number): void {
  const ratio = Math.max(0, Math.min(1, hp / max));
  const h = hp > 0 ? Math.max(1, Math.round(12 * ratio)) : 0;
  s.rect(dx, dy + 1, 4, 14, C.BLACK!);
  if (h > 0) s.rect(dx + 1, dy + 2 + (12 - h), 2, h, ratio > 0.5 ? C.LGREEN! : ratio > 0.25 ? C.YELLOW! : C.LRED!);
}

/** The unit as a white silhouette: the flash of a blow landing on it. */
export function drawUnitFlash(s: Surface, type: string, color: number, dx: number, dy: number): void {
  const sprite = unitSprite(type, color);
  for (let y = 0; y < sprite.height; y++)
    for (let x = 0; x < sprite.width; x++) if (sprite.get(x, y) !== SPRITE_CLEAR) s.set(dx + x, dy + y, C.WHITE!);
}

function disc(s: Surface, cx: number, cy: number, r: number, color: number): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) s.set(cx + x, cy + y, color);
}

/** The end of a beaten unit, centred on (cx, cy), t from 0 to 1: a white-hot flash, flames flying out, then smoke. */
export function drawBurst(s: Surface, cx: number, cy: number, t: number): void {
  const core = Math.round((1 - t) * 6);
  if (core > 0) disc(s, cx, cy, core, t < 0.2 ? C.WHITE! : t < 0.45 ? C.YELLOW! : C.ORANGE!);
  const flame = t < 0.3 ? C.YELLOW! : t < 0.6 ? C.ORANGE! : t < 0.8 ? C.LRED! : C.DGREY!;
  const ember = t < 0.5 ? C.LRED! : C.DGREY!;
  const r = 2 + t * 10;
  const size = t < 0.6 ? 2 : 1;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + (k % 3) * 0.35;
    const d = r * (0.5 + ((k * 7) % 5) * 0.12);
    s.rect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), size, size, k % 2 ? flame : ember);
  }
}

/**
 * One side of a civilization's border (see `borderSides`) along the square at
 * (dx, dy): a line in the owner's colour on the square's edge pixels, reaching
 * one pixel past the corner where it rounds an inner corner, and a dotted line
 * of the darker shade just inside it.
 */
export function drawBorderSide(s: Surface, dx: number, dy: number, side: number, startOut: boolean, endOut: boolean, color: number, inner: number): void {
  const a = startOut ? -1 : 0;
  const b = endOut ? 16 : 15;
  const across = side === 0 || side === 2;
  const edge = side === 0 || side === 3 ? 0 : 15;
  const inside = edge === 0 ? 1 : 14;
  for (let t = a; t <= b; t++) {
    if (across) s.set(dx + t, dy + edge, color);
    else s.set(dx + edge, dy + t, color);
    if (t < 1 || t > 14 || (t + inside) & 1) continue;
    if (across) s.set(dx + t, dy + inside, inner);
    else s.set(dx + inside, dy + t, inner);
  }
}
