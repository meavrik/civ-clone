import { drawText, drawTextCentered } from "../font.js";
import { C, shade } from "../palette.js";
import { SCREEN_H, SCREEN_W, Surface } from "../surface.js";
import { DIM, drawWindow, GOLD, INK } from "../widgets.js";

/**
 * Title screen: an original sunrise-over-sea composition in the palette,
 * with the game's own name. No external imagery.
 */
export function drawTitleScreen(s: Surface, blink: boolean): void {
  const horizon = 118;
  const cx = 160;
  // Sky: deep ocean blue at the top warming to sand at the horizon, dithered between ramp steps.
  const sky = [shade("ocean", 0), shade("ocean", 1), shade("ocean", 2), shade("ocean", 3), shade("sand", 2), shade("sand", 4), shade("sand", 6)];
  for (let y = 0; y < horizon; y++) {
    const f = (y / horizon) * (sky.length - 1);
    const a = Math.floor(f);
    const t = f - a;
    for (let x = 0; x < SCREEN_W; x++) {
      const d = ((x ^ y) & 1) ? 0.25 : 0.75; // 2x2 ordered dither
      s.set(x, y, sky[t > d ? Math.min(a + 1, sky.length - 1) : a]!);
    }
  }
  // Sun, half risen.
  const r = 26;
  for (let y = -r; y <= 0; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) s.set(cx + x, horizon + y, y > -4 ? shade("sand", 7) : C.YELLOW!);
  // Sea with a sun path.
  for (let y = horizon; y < 156; y++) {
    const depth = (y - horizon) / (156 - horizon);
    for (let x = 0; x < SCREEN_W; x++) {
      const inPath = Math.abs(x - cx) < 6 + depth * 30;
      const wave = ((x * 5 + y * 11) % 13) < 2;
      let c = depth < 0.5 ? shade("ocean", 2) : shade("ocean", 1);
      if (wave) c = shade("ocean", 3);
      if (inPath && ((x + y) & 1) === 0 && ((x * 3 + y * 7) % 5) < 3) c = shade("sand", 6);
      s.set(x, y, c);
    }
  }
  // Land: a dark shore and rolling hills in silhouette, fully filled to the bottom.
  for (let x = 0; x < SCREEN_W; x++) {
    const h = 154 + Math.floor(8 * Math.sin(x / 19) + 5 * Math.sin(x / 7 + 2) + 3 * Math.sin(x / 3));
    for (let y = Math.min(h, 156); y < SCREEN_H; y++) {
      const c = y < h ? shade("ocean", 1) : y < h + 2 ? shade("grass", 4) : y < h + 10 ? shade("grass", 1) : shade("earth", 0);
      s.set(x, y, c);
    }
  }
  drawTextCentered(s, SCREEN_W / 2, 18, "E P O C H S", C.WHITE!, C.BLACK!);
  drawTextCentered(s, SCREEN_W / 2, 30, "an empire game in the 1991 style", shade("sand", 7), C.BLACK!);
  if (blink) drawTextCentered(s, SCREEN_W / 2, 184, "Press any key", C.WHITE!, C.BLACK!);
}

/** End of game: score sheet and rank. */
export function drawEndScreen(s: Surface, lines: string[], rank: string): void {
  s.fill(C.BLACK!);
  drawWindow(s, 30, 24, SCREEN_W - 60, SCREEN_H - 48, "The End", { centred: true });
  let y = 50;
  for (const l of lines) {
    drawText(s, 48, y, l, INK);
    y += 10;
  }
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 56, `Your rule was ${rank}.`, GOLD);
  drawTextCentered(s, SCREEN_W / 2, SCREEN_H - 36, "Press any key for a new game", DIM);
}
