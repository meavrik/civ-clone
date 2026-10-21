import { unitType, type City, type Unit } from "@civ/core";
import type { Context2D } from "./context.js";
import { circle, fillRound, measure, strokeRound, text } from "./draw.js";
import { COMBAT, ICON, PLAYER_COLORS, PLAYER_DARK, TILE, UI, WALLS } from "./theme.js";
import { WORK_ICON, type CityMood } from "@civ/renderer-api";
import { paintIcon } from "./icons.js";

export const UNIT_ABBR: Record<string, string> = {
  settlers: "S", militia: "M", phalanx: "P", legion: "L", cavalry: "C", chariot: "Ch",
  catapult: "Ca", knights: "K", musketeers: "Mu", cannon: "Cn", riflemen: "R", mech_inf: "MI",
  armor: "A", artillery: "Ar", diplomat: "D", caravan: "Cv", barbarian_leader: "BL", trireme: "T", sail: "Sl",
  frigate: "F", ironclad: "I", cruiser: "Cr", battleship: "B", submarine: "Su", carrier: "CV",
  transport: "Tr", fighter: "Ft", bomber: "Bo", nuclear: "N",
};

export function playerColor(slot: number): string {
  const n = PLAYER_COLORS.length;
  return PLAYER_COLORS[((slot % n) + n) % n]!;
}
export function playerDark(slot: number): string {
  const n = PLAYER_DARK.length;
  return PLAYER_DARK[((slot % n) + n) % n]!;
}

/** A unit badge: rounded shield in the owner's colour with the type's letters; a hull for ships, wings for aircraft. */
export function paintBadge(ctx: Context2D, x: number, y: number, type: string, slot: number, size = 34): void {
  const t = unitType(type);
  const r = size * 0.24;
  const bx = x + (TILE - size) / 2;
  const by = y + (TILE - size) / 2;
  if (t.domain === "sea") {
    ctx.fillStyle = "#1b2a3a";
    ctx.beginPath();
    ctx.moveTo(bx - 3, by + size - 6);
    ctx.lineTo(bx + size + 3, by + size - 6);
    ctx.lineTo(bx + size - 4, by + size + 3);
    ctx.lineTo(bx + 4, by + size + 3);
    ctx.closePath();
    ctx.fill();
  } else if (t.domain === "air") {
    ctx.fillStyle = "#cfd6dd";
    ctx.fillRect(bx - 5, by + size / 2 - 2, size + 10, 4);
  }
  fillRound(ctx, bx, by, size, size, r, playerColor(slot));
  strokeRound(ctx, bx + 1, by + 1, size - 2, size - 2, r, playerDark(slot), 2.5);
  const label = UNIT_ABBR[type] ?? "?";
  text(ctx, bx + size / 2, by + size / 2 - 9, label, { size: label.length > 1 ? 15 : 17, weight: "bold", color: "#111820", align: "center" });
}

export interface UnitLook {
  stacked: boolean;
  active: boolean;
}

export function paintUnit(ctx: Context2D, x: number, y: number, u: Pick<Unit, "type" | "order" | "veteran">, slot: number, look: UnitLook): void {
  if (look.stacked) {
    fillRound(ctx, x + 11, y + 11, 34, 34, 8, "rgba(0,0,0,0.55)");
  }
  if (look.active) {
    strokeRound(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 10, UI.accent, 3);
  }
  paintBadge(ctx, x, y, u.type, slot);
  if (u.order.kind === "fortified") strokeRound(ctx, x + 9, y + 9, TILE - 18, TILE - 18, 7, "rgba(255,255,255,0.85)", 2);
  else if (u.order.kind === "sentry") text(ctx, x + TILE - 6, y + 2, "z", { size: 12, weight: "bold", color: "#fff", align: "right", shadow: true });
  if (u.veteran) circle(ctx, x + 9, y + 9, 4, UI.accent);
  if (u.order.kind === "work") {
    // A settler at work wears a badge of its job and the turns it still needs.
    const label = String(u.order.turnsLeft);
    const w = 26 + measure(ctx, label, 11, "bold");
    const bx = x + TILE - w - 1;
    fillRound(ctx, bx, y + 1, w, 19, 9.5, ICON.badge);
    strokeRound(ctx, bx + 0.5, y + 1.5, w - 1, 18, 9, UI.accent, 1.2);
    paintIcon(ctx, WORK_ICON[u.order.work], bx + 3, y + 2.5, 16);
    text(ctx, bx + 21, y + 4, label, { size: 11, weight: "bold", color: UI.ink });
  }
}

/** City marker: a dark block in the owner's colour frame with a cluster of buildings and the size badge. */
/** City walls: a band of stone round the city's box with battlements along the top. */
function paintWalls(ctx: Context2D, x: number, y: number): void {
  const merlons = [1.5, 11, 20.5, 30, 39.5];
  // The outline first, a little proud of the stone, then the stone and the lit tops of the battlements.
  fillRound(ctx, x, y + 3.5, TILE, TILE - 3.5, 6, WALLS.dark);
  ctx.fillStyle = WALLS.dark;
  for (const m of merlons) ctx.fillRect(x + m - 0.75, y, 8.5, 6);
  fillRound(ctx, x + 1, y + 4.5, TILE - 2, TILE - 5.5, 5, WALLS.stone);
  ctx.fillStyle = WALLS.stone;
  for (const m of merlons) ctx.fillRect(x + m, y + 0.75, 7, 6);
  ctx.fillStyle = WALLS.lit;
  for (const m of merlons) ctx.fillRect(x + m, y + 0.75, 7, 1.5);
}

/**
 * A city on the map: the owner's ring and skyline, walls, the population, a shield in the corner when units
 * are inside (`garrisoned`) and a flag for the `mood` (`cityMood`, the viewer's own cities only): red in
 * disorder, yellow one lost happy citizen from it, green while the city celebrates.
 */
export function paintCity(ctx: Context2D, x: number, y: number, city: City, slot: number, garrisoned = false, mood: CityMood | null = null): void {
  const color = playerColor(slot);
  // Walls ring the box, which sits a little further in to leave them room.
  const inset = city.buildings.includes("city_walls") ? 6 : 3;
  if (inset > 3) paintWalls(ctx, x, y);
  fillRound(ctx, x + inset, y + inset, TILE - 2 * inset, TILE - 2 * inset, 8, "#1c2430");
  strokeRound(ctx, x + inset, y + inset, TILE - 2 * inset, TILE - 2 * inset, 8, color, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x + 10, y + 22, 8, 14);
  ctx.fillRect(x + 20, y + 14, 9, 22);
  ctx.fillRect(x + 31, y + 26, 7, 10);
  ctx.fillStyle = "#1c2430";
  ctx.fillRect(x + 22, y + 18, 2, 2);
  ctx.fillRect(x + 26, y + 18, 2, 2);
  ctx.fillRect(x + 22, y + 24, 2, 2);
  ctx.fillRect(x + 26, y + 24, 2, 2);
  const n = String(city.size);
  const bw = Math.max(16, measure(ctx, n, 12, "bold") + 8);
  fillRound(ctx, x + TILE - bw - 2, y + TILE - 18, bw, 16, 8, "#f4f6f8");
  text(ctx, x + TILE - 2 - bw / 2, y + TILE - 17, n, { size: 12, weight: "bold", color: "#111820", align: "center" });
  if (mood) {
    ctx.fillStyle = mood === "disorder" ? UI.danger : mood === "unrest" ? UI.accent : UI.ok;
    ctx.fillRect(x + 6, y + 4, 8, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 5, y + 4, 2, 14);
  }
  if (garrisoned) {
    // A small white shield at the top right, clear of the disorder flag.
    const sx = x + TILE - 17;
    const sy = y + 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 14, sy);
    ctx.lineTo(sx + 14, sy + 8);
    ctx.quadraticCurveTo(sx + 14, sy + 13, sx + 7, sy + 16);
    ctx.quadraticCurveTo(sx, sy + 13, sx, sy + 8);
    ctx.closePath();
    ctx.fillStyle = "#f4f6f8";
    ctx.fill();
    ctx.strokeStyle = "#111820";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#8a96a3";
    ctx.fillRect(sx + 4, sy + 4, 6, 3);
  }
}

/** The city's name under its tile, in a dark pill. */
export function paintCityLabel(ctx: Context2D, x: number, y: number, name: string, slot: number): void {
  const w = measure(ctx, name, 12, "600") + 12;
  const lx = x + TILE / 2 - w / 2;
  const ly = y + TILE - 2;
  fillRound(ctx, lx, ly, w, 16, 8, "rgba(10, 14, 20, 0.78)");
  text(ctx, x + TILE / 2, ly + 1, name, { size: 12, weight: "600", color: playerColor(slot), align: "center" });
}

/** A unit's hit points as a slim bar under its badge: green, then amber, then red as they run out. */
export function paintHpBar(ctx: Context2D, x: number, y: number, hp: number, max: number): void {
  const ratio = Math.max(0, Math.min(1, hp / max));
  const w = TILE - 16;
  fillRound(ctx, x + 8, y + TILE - 8, w, 6, 3, COMBAT.hpBack);
  if (ratio > 0) fillRound(ctx, x + 9, y + TILE - 7, Math.max(4, (w - 2) * ratio), 4, 2, ratio > 0.5 ? COMBAT.hpGood : ratio > 0.25 ? COMBAT.hpFair : COMBAT.hpPoor);
}

/** The flash of a blow landing: a white glow over the badge, `strength` 0..1. */
export function paintHitFlash(ctx: Context2D, x: number, y: number, strength: number): void {
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * Math.min(1, strength) * 0.85;
  fillRound(ctx, x + 6, y + 6, TILE - 12, TILE - 12, 10, COMBAT.flash);
  ctx.globalAlpha = alpha;
}

/** The end of a beaten unit, centred on (cx, cy), t from 0 to 1: a fireball that swells and fades, embers, then smoke. */
export function paintBurst(ctx: Context2D, cx: number, cy: number, t: number): void {
  const alpha = ctx.globalAlpha;
  const r = 8 + t * 28;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, COMBAT.burstCore);
  g.addColorStop(0.45, COMBAT.burstMid);
  g.addColorStop(1, COMBAT.burstEdge);
  ctx.globalAlpha = alpha * (1 - t);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalAlpha = alpha * Math.min(1, 1.6 - t);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + (k % 3) * 0.4;
    const d = r * (0.6 + ((k * 7) % 5) * 0.12);
    circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, (1 - t) * 3 + 1.5, k % 2 && t < 0.6 ? COMBAT.ember : COMBAT.smoke);
  }
  ctx.globalAlpha = alpha;
}
