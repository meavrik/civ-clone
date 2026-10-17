import { unitType, type Unit } from "@civ/core";
import { WORK_ICON } from "@civ/renderer-api";
import { drawIcon } from "./icons.js";
import { drawText, textWidth } from "./font.js";
import { C, shade } from "./palette.js";
import { Surface } from "./surface.js";
import { TILE } from "./tiles.js";
import { SPRITE_CLEAR } from "./sprites/sheet.js";
import { darker, ownerBox, spriteSurface, UNIT_SHEET } from "./sprites/index.js";

/** Road segments toward neighbouring road tiles. Mask bits follow NEIGHBOURS order. */
export function drawRoad(s: Surface, dx: number, dy: number, mask: number): void {
  const c = shade("earth", 4);
  const cx = dx + 7;
  const cy = dy + 7;
  const ends: [number, number][] = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  let any = false;
  ends.forEach(([ex, ey], i) => {
    if (!(mask & (1 << i))) return;
    any = true;
    for (let t = 0; t <= 8; t++) {
      s.set(cx + Math.round((ex * t * 8) / 8), cy + Math.round((ey * t * 8) / 8), c);
      s.set(cx + 1 + Math.round((ex * t * 8) / 8), cy + Math.round((ey * t * 8) / 8), c);
    }
  });
  s.rect(cx, cy, 2, 2, c);
  if (!any) s.rect(cx - 1, cy - 1, 4, 4, c); // isolated stub
}

/** Railroad: a dark rail along each connected direction with cross-ties, over the road. */
export function drawRailroad(s: Surface, dx: number, dy: number, mask: number): void {
  const rail = shade("stone", 1);
  const tie = shade("earth", 2);
  const cx = dx + 7;
  const cy = dy + 7;
  const ends: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  let any = false;
  ends.forEach(([ex, ey], i) => {
    if (!(mask & (1 << i))) return;
    any = true;
    for (let t = 0; t <= 8; t++) {
      const px = cx + ex * t;
      const py = cy + ey * t;
      s.set(px, py, t % 3 === 1 ? tie : rail);
      s.set(px + (ey !== 0 ? 1 : 0), py + (ex !== 0 && ey === 0 ? 1 : 0), t % 3 === 1 ? tie : rail);
    }
  });
  s.rect(cx, cy, 2, 2, rail);
  if (!any) s.rect(cx - 2, cy - 1, 6, 4, rail);
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

/** Irrigation: two short furrow rows in the tile's lower half. */
export function drawIrrigation(s: Surface, dx: number, dy: number): void {
  const c = shade("ocean", 5);
  for (let i = 0; i < 3; i++) {
    s.hline(dx + 2, dy + 3 + i * 4, 5, c);
    s.hline(dx + 9, dy + 3 + i * 4, 5, c);
  }
}

/** Mine: a dark shaft mouth with a timber frame. */
export function drawMine(s: Surface, dx: number, dy: number): void {
  s.rect(dx + 9, dy + 8, 5, 5, C.BLACK!);
  s.hline(dx + 8, dy + 7, 7, shade("earth", 5));
  s.vline(dx + 8, dy + 7, 6, shade("earth", 5));
  s.vline(dx + 14, dy + 7, 6, shade("earth", 5));
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
