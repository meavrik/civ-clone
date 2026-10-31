import { hash, type BattleFrame } from "@civ/renderer-api";
import { C, DIMMED, shade } from "./palette.js";
import type { Surface } from "./surface.js";

/**
 * A shot in flight (a catapult's stone, `BattleFrame.shot`; asked for 2026-10-31: its stone went nowhere), at screen
 * point (x, y) over ground (gx, gy): a ball of grey about the size the catapult's picture draws its stone (five fine
 * pixels across at the map's scale), lit from the upper left and edged in its darkest grey, its shadow on the ground
 * under it; once down, the dust it throws up, puffs spreading and settling, clods falling back. Placed by the moment and
 * hashes, never the game's RNG. Drawn on the map under the pictures, so a unit's picture stands in front of it.
 */

const BALL = [" 000 ", "03320", "03220", "02210", " 000 "];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
const PUFFS = 9;
const CLODS = 6;

export function drawShot(s: Surface, shot: NonNullable<BattleFrame["shot"]>, x: number, y: number, gx: number, gy: number): void {
  const k = s.k;
  const fx = Math.round(x * k), fy = Math.round(y * k);
  if (shot.landed === 0) {
    // Its shadow, a flat smudge, smaller as the stone rises over it.
    const sx = Math.round(gx * k), sy = Math.round(gy * k);
    const half = gy - y > 6 ? 1 : 2;
    for (let dx = -half; dx <= half; dx++) for (const dy of [0, 1]) darken(s, sx + dx, sy + dy);
    // Light grey edged in its darkest, as the catapult's picture draws its stone.
    const inks = [shade("rock", 0), shade("rock", 2), shade("rock", 3), shade("steel", 7)];
    BALL.forEach((row, j) => [...row].forEach((c, i) => { if (c !== " ") s.fset(fx - 2 + i, fy - 2 + j, inks[Number(c)]!); }));
    return;
  }
  const t = shot.landed;
  // Dust thrown up and out, rising, spreading and thinning away.
  const dust = [shade("dune", 2), shade("mound", 6), shade("mound", 4)];
  for (let i = 0; i < PUFFS; i++) {
    const a = Math.PI * (1.05 + 0.9 * (i / (PUFFS - 1))) + (hash(i, 3, 71) - 0.5) * 0.3;
    const d = (1.5 + 6 * hash(i, 5, 71)) * Math.sqrt(t) * k;
    const px = fx + Math.cos(a) * d, py = fy + Math.sin(a) * d * 0.7 - 2 * t * k;
    const r = Math.round((1 + 1.5 * t) * (0.6 + 0.6 * hash(i, 7, 71)) * k / 2);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const qx = Math.round(px + dx), qy = Math.round(py + dy);
        if (BAYER[(qy & 3) * 4 + (qx & 3)]! < 1 - t * 0.9) s.fset(qx, qy, dust[(i + (dy < 0 ? 0 : 1)) % dust.length]!);
      }
  }
  // Clods flung up that fall back.
  for (let i = 0; i < CLODS; i++) {
    if (t > 0.8) break;
    const vx = (hash(i, 11, 71) - 0.5) * 9, vy = -(4 + 5 * hash(i, 13, 71));
    const cx = fx + vx * t * k, cy = fy + (vy * t + 14 * t * t) * k;
    s.fset(Math.round(cx), Math.round(cy), i % 2 ? shade("mound", 0) : shade("mound", 2));
  }
  // The flash of the strike, gone in a moment.
  if (t < 0.15) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (!dx || !dy) s.fset(fx + dx, fy + dy, C.WHITE!);
}

function darken(s: Surface, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= s.fw || y >= s.fh) return;
  const i = y * s.fw + x;
  s.data[i] = DIMMED[s.data[i]!]!;
}
