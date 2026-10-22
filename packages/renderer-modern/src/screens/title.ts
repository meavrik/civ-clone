import type { Context2D } from "../context.js";
import { circle, page, text } from "../draw.js";
import { H, UI, W } from "../theme.js";

/** Title: a dawn over the sea in soft gradients, the hills in silhouette, the name set wide. Original art. (The opening is retro's alone.) */
export function drawTitleScreen(ctx: Context2D): void {
  const horizon = Math.round(H * 0.6);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#0b1a3a");
  sky.addColorStop(0.55, "#2a4f8f");
  sky.addColorStop(0.85, "#d98c4a");
  sky.addColorStop(1, "#f6c15c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  // Sun with a glow.
  const glow = ctx.createRadialGradient(W / 2, horizon, 10, W / 2, horizon, 220);
  glow.addColorStop(0, "rgba(255, 230, 150, 0.85)");
  glow.addColorStop(1, "rgba(255, 200, 100, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, horizon);
  ctx.clip();
  circle(ctx, W / 2, horizon + 6, 70, "#ffe27a");
  ctx.restore();
  // Sea.
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, "#2f6fb3");
  sea.addColorStop(1, "#0f2a4e");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = "rgba(255, 220, 130, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = horizon + 10 + i * 12;
    const half = 10 + i * 14;
    ctx.beginPath();
    ctx.moveTo(W / 2 - half, y);
    ctx.lineTo(W / 2 + half, y);
    ctx.stroke();
  }
  // Hills in silhouette.
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const y = H - 110 + 26 * Math.sin(x / 110) + 14 * Math.sin(x / 41 + 2) + 6 * Math.sin(x / 17);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = "#17341f";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const y = H - 60 + 18 * Math.sin(x / 70 + 1) + 8 * Math.sin(x / 23);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = "#0e2416";
  ctx.fill();

  ctx.save();
  ctx.font = "600 64px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("CIVILIZATION", W / 2, 54);
  ctx.restore();
}

/** End of game: score sheet and rank. */
export function drawEndScreen(ctx: Context2D, lines: string[], rank: string): void {
  const box = page(ctx, W, H, "The End", "Press any key for a new game");
  let y = box.y + 8;
  for (const l of lines) {
    text(ctx, box.x + 24, y, l, { size: 17 });
    y += 28;
  }
  text(ctx, W / 2, H - 100, `Your rule was ${rank}.`, { size: 22, weight: "600", color: UI.accent, align: "center" });
}
