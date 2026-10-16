import { unitType, type Unit } from "@civ/core";
import { drawText, textWidth } from "./font.js";
import { C, shade } from "./palette.js";
import { Surface } from "./surface.js";
import { TILE } from "./tiles.js";

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
 * Original placeholder unit art: a shield-shaped badge in the owner's colour
 * with the unit's abbreviation, a bar for land, a hull for sea, wings for air.
 * The real sprite set replaces this module; `unitSprite` keeps its contract.
 */
export function unitSprite(type: string, color: number): Surface {
  const key = `${type}:${color}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const s = new Surface(TILE, TILE);
  const domain = unitType(type).domain;
  const edge = C.BLACK!;
  // badge
  s.rect(2, 2, 12, 11, color);
  s.frame(2, 2, 12, 11, edge);
  s.hline(3, 13, 10, edge);
  s.hline(4, 14, 8, edge);
  s.rect(4, 13, 8, 1, color);
  s.rect(5, 14, 6, 1, color);
  if (domain === "sea") {
    s.hline(1, 12, 14, shade("earth", 2));
    s.hline(2, 13, 12, shade("earth", 3));
  } else if (domain === "air") {
    s.hline(0, 7, 16, C.LGREY!);
  }
  const label = UNIT_ABBR[type] ?? "?";
  drawText(s, Math.floor(8 - textWidth(label) / 2), 4, label, edge);
  spriteCache.set(key, s);
  return s;
}

export function drawUnit(s: Surface, u: Unit, dx: number, dy: number, color: number, stacked: boolean): void {
  if (stacked) {
    // A second badge edge peeking out shows a stack, like the original.
    s.rect(dx + 4, dy + 4, 12, 12, C.BLACK!);
  }
  s.blit(unitSprite(u.type, color), dx, dy, 0);
  if (u.order.kind === "fortified") {
    s.frame(dx + 1, dy + 1, 14, 14, shade("stone", 6));
  } else if (u.order.kind === "sentry") {
    s.hline(dx + 5, dy + 15, 6, C.WHITE!);
  }
}
