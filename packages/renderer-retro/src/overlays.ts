import { Terrain, unitType, type Unit, type WorldMap } from "@civ/core";
import { courseGap, FIELD_E, FIELD_N, FIELD_S, FIELD_W, fieldLayout, hash, rankIcon, roadWays, WORK_ICON, type Explored, type RoadWays } from "@civ/renderer-api";
import { drawIcon, drawIconFine, iconInk } from "./icons.js";
import { drawText, textWidth } from "./font.js";
import { C, PLAYER_COLORS, shade } from "./palette.js";
import { DETAIL, Surface } from "./surface.js";
import { FINE, isWater, TILE, WATER } from "./tiles.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { darker, FEATURE_SHEET, ownerBox, spriteSurface, UNIT_SHEET } from "./sprites/index.js";

/**
 * Roads and railroads at the fine grain of the terrain art (32 pixels a square), in its flat fills
 * (asked for 2026-10-23: the old one-pixel track on the coarse grid did not match the terrain; then
 * "too wide, more subtle" and "drop the outline"). Widths are fine pixels from the course.
 */
const ROAD = {
  /** Packed earth out to here, lighter along the crown; no outline on land. */
  crown: 0.6,
  fill: 1.5,
  /** A bridge's railing, one pixel beyond the deck, where it crosses water. */
  outline: 2.3,
};
const RAIL = {
  /** Sleepers of dark timber across the road beneath; a steel rail either side, bright on top, shadowed outside. */
  sleeper: 2.6,
  railIn: 0.9,
  railTop: 1.6,
  railOut: 2.2,
};
/** A railroad's sleepers lie across it this many fine pixels apart (as near as fits along each course), two pixels thick. */
const SLEEPER_GAP = 4;
/** A bridge's planks lie across it this many fine pixels apart. */
const PLANK_GAP = 3;

/** Whether palette index `c` lies in a ramp. */
function inRamp(c: number, ramp: string): boolean {
  const base = shade(ramp, 0);
  return c >= base && c < base + 8;
}

/** What each fine pixel of a way is, before the ground decides (a bridge over water). */
const enum Way { None, Outline, Edge, Crown, Speck, Pebble, Sleeper, RailTop, RailFoot }

/** The colour of each kind of pixel: road and railroad on land, and the timber deck where a road crosses water. */
const LAND_WAY: Record<Way, number> = {
  [Way.None]: -1,
  [Way.Outline]: -1, // only a bridge's railing
  [Way.Edge]: shade("earth", 5),
  [Way.Crown]: shade("earth", 6),
  [Way.Speck]: shade("earth", 7),
  [Way.Pebble]: shade("earth", 3),
  [Way.Sleeper]: shade("earth", 1),
  [Way.RailTop]: shade("steel", 7),
  [Way.RailFoot]: shade("steel", 2),
};
const DECK = { outline: shade("earth", 0), plank: shade("earth", 4), seam: shade("earth", 2), rail: shade("earth", 1) };

/** A way's pixels: what each is (`Way`), whether a bridge's plank seam falls there, and the sprite on land. */
interface WayPixels { kinds: Uint8Array; seams: Uint8Array; sprite: Surface }
const wayCache = new Map<string, WayPixels>();

/**
 * A road or railroad across one square (see `roadWays`): each fine pixel's kind and the sprite of
 * it on land, keyed by SPRITE_CLEAR. A road is packed earth, lighter along its crown, with a few
 * pebbles and no outline; a railroad lays dark sleepers across the road with a
 * steel rail either side, bright on top and shadowed outside, the sleepers spaced evenly along each
 * course so they meet the next square's. A road square with no links is a round patch.
 */
function wayPixels(ways: RoadWays, x: number, y: number, rail: boolean): WayPixels {
  const key = `${rail ? "r" : "w"}${ways.key}`;
  const hit = wayCache.get(key);
  if (hit) return hit;
  const kinds = new Uint8Array(FINE * FINE);
  const seams = new Uint8Array(FINE * FINE);
  const sprite = Surface.fine(TILE, TILE);
  sprite.fill(SPRITE_CLEAR);
  for (let j = 0; j < FINE; j++)
    for (let i = 0; i < FINE; i++) {
      const u = (i + 0.5) / FINE;
      const v = (j + 0.5) / FINE;
      let d = Infinity;
      let along = 0;
      let gap = SLEEPER_GAP;
      for (const c of ways.courses) {
        const g = courseGap(c, u, v);
        if (g.gap * FINE >= d) continue;
        d = g.gap * FINE;
        along = g.along * FINE;
        gap = (g.length * FINE) / Math.max(1, Math.round((g.length * FINE) / SLEEPER_GAP));
      }
      if (ways.patch) d = Math.max(0, Math.hypot(u - ways.patch[0], v - ways.patch[1]) * FINE - 2.5);
      const grain = hash(x * FINE + i, y * FINE + j, 7);
      let k = Way.None;
      if (rail) {
        const onSleeper = Math.abs(along / gap - Math.round(along / gap)) * gap < 1;
        if (d >= RAIL.railIn && d < RAIL.railTop) k = Way.RailTop;
        else if (d >= RAIL.railTop && d < RAIL.railOut) k = Way.RailFoot;
        else if (d < RAIL.sleeper && (onSleeper || ways.patch)) k = Way.Sleeper;
      } else if (d < ROAD.crown) k = grain < 0.06 ? Way.Pebble : Way.Crown;
      else if (d < ROAD.fill) k = grain < 0.06 ? Way.Speck : grain > 0.96 ? Way.Pebble : Way.Edge;
      else if (d < ROAD.outline) k = Way.Outline;
      kinds[j * FINE + i] = k;
      seams[j * FINE + i] = Math.floor(along) % PLANK_GAP === 0 ? 1 : 0;
      if (LAND_WAY[k] >= 0) sprite.fset(i, j, LAND_WAY[k]);
    }
  const out = { kinds, seams, sprite };
  if (wayCache.size > 4096) wayCache.clear();
  wayCache.set(key, out);
  return out;
}

/**
 * The road across square (x, y), as the viewer knows it (`explored`), over `ground` (the square as
 * drawn beneath). Where a river's water runs under it the road is a bridge: a timber deck, its planks
 * across the way, railed in dark wood; elsewhere water stays water (a shore the course brushes).
 */
export function drawRoad(s: Surface, dx: number, dy: number, map: WorldMap, explored: Explored, x: number, y: number, ground?: Surface): void {
  const ways = roadWays(map, explored, x, y);
  if (!ways) return;
  const { kinds, seams, sprite } = wayPixels(ways, x, y, false);
  const wet = ground && ground.k === DETAIL && hasWater(ground) ? ground : null;
  if (!wet || !map.tiles[y * map.width + x]?.river) {
    if (!wet) { s.blit(sprite, dx, dy, SPRITE_CLEAR); return; }
    // Off the river, the road keeps to dry land: water under its course stays water.
    for (let j = 0; j < FINE; j++)
      for (let i = 0; i < FINE; i++) {
        const k = kinds[j * FINE + i]!;
        if (LAND_WAY[k as Way] >= 0 && !isWater(wet.fget(i, j))) s.fset(dx * s.k + i, dy * s.k + j, LAND_WAY[k as Way]);
      }
    return;
  }
  // Over a river: the deck is the road's width; its planks run across it, its outline is the railing.
  const deck = (i: number, j: number) => isWater(wet.fget(i, j));
  for (let j = 0; j < FINE; j++)
    for (let i = 0; i < FINE; i++) {
      const k = kinds[j * FINE + i]! as Way;
      if (k === Way.None) continue;
      let c = LAND_WAY[k];
      if (deck(i, j) || (k === Way.Outline && neighbourWet(deck, i, j))) {
        if (k === Way.Outline) c = DECK.rail;
        else c = seams[j * FINE + i] ? DECK.seam : DECK.plank;
      }
      if (c >= 0) s.fset(dx * s.k + i, dy * s.k + j, c);
    }
}

/** Ground pictures (cached and shared) with any water in them, remembered: most have none. */
const watery = new WeakMap<Surface, boolean>();
function hasWater(ground: Surface): boolean {
  let w = watery.get(ground);
  if (w === undefined) {
    w = false;
    for (let j = 0; j < FINE && !w; j++) for (let i = 0; i < FINE; i++) if (isWater(ground.fget(i, j))) { w = true; break; }
    watery.set(ground, w);
  }
  return w;
}

/** Whether a fine pixel beside (i, j), side or corner, is water. */
function neighbourWet(wet: (i: number, j: number) => boolean, i: number, j: number): boolean {
  for (let b = -1; b <= 1; b++)
    for (let a = -1; a <= 1; a++) {
      const ni = i + a;
      const nj = j + b;
      if ((a || b) && ni >= 0 && nj >= 0 && ni < FINE && nj < FINE && wet(ni, nj)) return true;
    }
  return false;
}

/** The railroad across square (x, y), over its road. */
export function drawRailroad(s: Surface, dx: number, dy: number, map: WorldMap, explored: Explored, x: number, y: number): void {
  const ways = roadWays(map, explored, x, y, true);
  if (ways) s.blit(wayPixels(ways, x, y, true).sprite, dx, dy, SPRITE_CLEAR);
}

/**
 * Shield grassland (the original's bands, `Tile.grassShield`): a small stone in the middle of the
 * square, as the 1991 game marked it, lit from the upper left with a one-pixel outline in its darkest
 * grey; where the ground there is water (a river) the stone keeps out of it.
 */
const STONE = [
  ".oooo.",
  "olllmo",
  "olmmdo",
  ".oooo.",
];
export function drawGrassShield(s: Surface, dx: number, dy: number, ground?: Surface): void {
  const c: Record<string, number> = { o: shade("rock", 0), l: shade("rock", 6), m: shade("rock", 4), d: shade("rock", 2) };
  const fx = dx * s.k + (FINE >> 1) - 3;
  const fy = dy * s.k + (FINE >> 1) + 3;
  STONE.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === ".") return;
    if (ground && ground.k === s.k && isWater(ground.fget((FINE >> 1) - 3 + i, (FINE >> 1) + 3 + j))) return;
    s.fset(fx + i, fy + j, c[ch]!);
  }));
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
  const canal = WATER.glint;
  const last = TILE - 1;
  const gk = ground.k;
  /** Whether any fine pixel of the ground's screen pixel (i, j) passes a test. */
  const anyFine = (i: number, j: number, test: (c: number) => boolean) => {
    for (let fj = 0; fj < gk; fj++) for (let fi = 0; fi < gk; fi++) if (test(ground.fget(i * gk + fi, j * gk + fj))) return true;
    return false;
  };
  const any = (i: number, j: number, ramp: string) => anyFine(i, j, (c) => inRamp(c, ramp));
  const wet = (i: number, j: number) => i >= 0 && j >= 0 && i < TILE && j < TILE && anyFine(i, j, isWater);
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
 * A unit's figure as the map shows it, standing free on the terrain: 32x32 fine pixels from the
 * units sheet, its cloth and flags in the owner's colour. Clear pixels are SPRITE_CLEAR, so blit
 * with that key. A type missing from the sheet falls back to its letters on the owner's box.
 */
export function unitSprite(type: string, color: number): Surface {
  const key = `${type}:${color}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  let s = spriteSurface(UNIT_SHEET, type, color);
  if (!s) {
    s = new Surface(TILE, TILE);
    s.fill(SPRITE_CLEAR);
    s.blit(ownerBox(color), 0, 0, SPRITE_CLEAR);
    const label = UNIT_ABBR[type] ?? "?";
    drawText(s, Math.floor(8 - textWidth(label) / 2), 4, label, C.BLACK!);
  }
  void unitType;
  spriteCache.set(key, s);
  return s;
}

/**
 * The owner's shield in a unit's top left corner, in the square's 32x32 grid of fine pixels:
 * black edged, the owner's colour, its right side darker, coming to a point.
 */
const SHIELD = [
  "kkkkkkkkk",
  "kPPPPPPpk",
  "kPPPPPPpk",
  "kPPPPPPpk",
  "kPPPPPPpk",
  "kPPPPPPpk",
  ".kPPPPpk.",
  ".kPPPPpk.",
  "..kPPpk..",
  "...kpk...",
  "....k....",
];
/**
 * Each colour slot's device on the shield, in CIV_COLORS order, drawn in the colour's darker partner over the
 * shield's face (`D`; asked for 2026-10-26: civilizations of colours alike were confused, "maybe a color blind
 * issue"). The colours the colour blind confuse bear devices least alike: green, yellow, orange and red (the
 * red-green blind) a half, nothing, a band and a saltire; white, cyan and grey a pale, a chevron and a roundel;
 * blue and magenta a cross and a base. A wounded unit's hit points cover the shield's top four rows, so each
 * device keeps its shape below them.
 */
export const DEVICES: readonly (readonly string[])[] = [
  // white: a pale
  ["", "....D....", "....D....", "....D....", "....D....", "....D....", "....D....", "....D....", "....D....", "....D...."],
  // green: per pale, the right half dark
  ["", "....DDDD.", "....DDDD.", "....DDDD.", "....DDDD.", "....DDDD.", "....DDDD.", "....DDDD.", "....DDDD.", "....D...."],
  // blue: a cross
  ["", "....D....", "....D....", "....D....", ".DDDDDDD.", "....D....", "....D....", "....D....", "....D....", "....D...."],
  // yellow: plain
  [],
  // cyan: a chevron
  ["", "", "", "....D....", "...DDD...", "..DD.DD..", ".DD...DD."],
  // magenta: a base, the point dark
  ["", "", "", "", "", "", "", ".DDDDDDD.", ".DDDDDDD.", ".DDDDDDD."],
  // grey: a roundel
  ["", "", "", "", "...DDD...", "...DDD...", "...DDD..."],
  // orange: a fess
  ["", "", "", "", "", ".DDDDDDD.", ".DDDDDDD."],
  // red (the barbarians): a saltire
  ["", "", ".D.....D.", "..D...D..", "...D.D...", "....D....", "...D.D...", "..D...D..", ".D.....D."],
];

/** The device a shield of this colour bears (an index into DEVICES), or -1 for a colour no civilization has. */
export function deviceOf(fill: number): number {
  return PLAYER_COLORS.indexOf(fill);
}

/** Where the shield sits, and where the second shield of a stack peeks out from behind it. */
export const SHIELD_AT = 1;
const STACK_SHIFT = 2;

/** A rectangle on the square at screen (dx, dy), placed in the square's 32x32 grid of fine pixels. */
export function gridRect(s: Surface, dx: number, dy: number, x: number, y: number, w: number, h: number, c: number): void {
  const f = s.k / DETAIL;
  s.frect(dx * s.k + Math.floor(x * f), dy * s.k + Math.floor(y * f), Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f)), c);
}

/** The owner's shield (SHIELD) at (x, y) of the square at screen (dx, dy), in its fine grid, bearing its colour's device. */
export function drawShield(s: Surface, dx: number, dy: number, x: number, y: number, fill: number, edge: number, device = deviceOf(fill)): void {
  const marks = DEVICES[device] ?? [];
  SHIELD.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === ".") return;
    const face = ch === "P" ? (marks[j]?.[i] === "D" ? edge : fill) : edge;
    gridRect(s, dx, dy, x + i, y + j, 1, 1, ch === "k" ? C.BLACK! : face);
  }));
}

/**
 * The unit's rank on the map: its gold chevrons (the rank's icon, one chevron a rank) in the square's
 * top right corner, standing a fine pixel in from the edges. A recruit wears none.
 */
export function drawRankMark(s: Surface, dx: number, dy: number, xp: number): void {
  const icon = rankIcon(xp);
  if (!icon) return;
  const ink = iconInk(icon);
  const f = s.k / DETAIL;
  drawIconFine(s, icon, dx * s.k + Math.round((TILE * DETAIL - 1 - ink.x - ink.w) * f), dy * s.k + Math.round((1 - ink.y) * f));
}

export function drawUnit(s: Surface, u: Pick<Unit, "type" | "order"> & { xp?: number }, dx: number, dy: number, color: number, stacked: boolean): void {
  s.blit(unitSprite(u.type, color), dx, dy, SPRITE_CLEAR);
  // Whose it is: the owner's shield, a second one peeking out from behind for a stack.
  if (stacked) drawShield(s, dx, dy, SHIELD_AT + STACK_SHIFT, SHIELD_AT + STACK_SHIFT, darker(color), darker(color), -1);
  drawShield(s, dx, dy, SHIELD_AT, SHIELD_AT, color, darker(color));
  if (u.order.kind === "fortified") {
    s.frame(dx, dy, TILE, TILE, shade("stone", 6));
  } else if (u.order.kind === "sentry") {
    s.hline(dx + 4, dy + 15, 8, C.WHITE!);
  } else if (u.order.kind === "work") {
    // A settler at work wears a badge of its job in the top right corner.
    s.rect(dx + 7, dy, 9, 9, C.BLACK!);
    drawIcon(s, WORK_ICON[u.order.work], dx + 8, dy);
  }
  // Its rank there otherwise.
  if (u.order.kind !== "work" && u.xp) drawRankMark(s, dx, dy, u.xp);
}

/**
 * A unit's hit points as a strip across the top of its shield (in the square's fine grid), the
 * owner's colour showing below: green, then yellow, then red as they run out.
 */
export function drawHpBar(s: Surface, dx: number, dy: number, hp: number, max: number): void {
  const ratio = Math.max(0, Math.min(1, hp / max));
  const inner = SHIELD[0]!.length - 2;
  const w = hp > 0 ? Math.max(1, Math.round(inner * ratio)) : 0;
  gridRect(s, dx, dy, SHIELD_AT, SHIELD_AT, inner + 2, 4, C.BLACK!);
  if (w > 0) gridRect(s, dx, dy, SHIELD_AT + 1, SHIELD_AT + 1, w, 2, ratio > 0.5 ? C.LGREEN! : ratio > 0.25 ? C.YELLOW! : C.LRED!);
}

/** The unit as a white silhouette: the flash of a blow landing on it. */
export function drawUnitFlash(s: Surface, type: string, color: number, dx: number, dy: number): void {
  const sprite = unitSprite(type, color);
  const flash = new Surface(sprite.width, sprite.height, undefined, sprite.k);
  for (let i = 0; i < sprite.data.length; i++) flash.data[i] = sprite.data[i] === SPRITE_CLEAR ? SPRITE_CLEAR : C.WHITE!;
  s.blit(flash, dx, dy, SPRITE_CLEAR);
  drawShield(s, dx, dy, SHIELD_AT, SHIELD_AT, color, darker(color));
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
