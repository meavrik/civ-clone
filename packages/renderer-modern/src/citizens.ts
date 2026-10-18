import type { CitizenLook, CitizenMood } from "@civ/renderer-api";
import type { Context2D } from "./context.js";
import { CITIZEN } from "./theme.js";

type Pt = readonly [number, number];

/** A citizen's height from hat to shoes; they stand 28 apart, drawn about their centre line. */
export const CITIZEN_H = 44;

/** A figure is parts (filled shapes, round-capped limbs, discs) drawn twice: dark and fat as the rim, then in colour. */
type Part =
  | { shape: readonly Pt[]; color: string }
  | { limb: readonly Pt[]; width: number; color: string }
  | { disc: Pt; r: number; color: string };

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 10): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
}

const mirror = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [-x, y] as const);

function paint(ctx: Context2D, p: Part, rim: boolean): void {
  const color = rim ? CITIZEN.line : p.color;
  ctx.beginPath();
  if ("disc" in p) {
    ctx.arc(p.disc[0], p.disc[1], p.r + (rim ? 1.2 : 0), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }
  const pts = "shape" in p ? p.shape : p.limb;
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  if ("shape" in p) {
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (rim) { ctx.lineWidth = 2.4; ctx.stroke(); }
  } else {
    ctx.lineWidth = p.width + (rim ? 2.4 : 0);
    ctx.stroke();
  }
}

const HEAD: Pt = [0, 7.5];
const SHOULDER: Pt = [-6.6, 17.5];

/** The arms for a mood: down at the sides, raised in joy, crossed in a sulk, or one raised with a flask. */
function arms(mood: CitizenMood, sleeve: string, skin: string): Part[] {
  const down: Pt[] = [SHOULDER, [-8, 23], [-7.6, 28]];
  const up: Pt[] = [SHOULDER, [-9.6, 11], [-9.6, 4.6]];
  const pair = (left: Pt[], right: Pt[]): Part[] => [
    { limb: left, width: 3.6, color: sleeve },
    { limb: right, width: 3.6, color: sleeve },
    { disc: left[left.length - 1]!, r: 1.9, color: skin },
    { disc: right[right.length - 1]!, r: 1.9, color: skin },
  ];
  if (mood === "happy") return pair(up, mirror(up));
  if (mood === "scientist") return pair(down, mirror(up));
  if (mood === "unhappy") return pair([SHOULDER, [-8, 23], [4.6, 22.4]], [[6.6, 17.5], [8, 23.6], [-4.6, 23.8]]);
  return pair(down, mirror(down));
}

/** Paint a citizen with the top of their head at y and their centre line at x. */
export function paintCitizen(ctx: Context2D, x: number, y: number, mood: CitizenMood, look: CitizenLook): void {
  const [clothes, sleeve] = CITIZEN.clothes[mood];
  const skin = CITIZEN.skin[look.skin]!;
  const hair = CITIZEN.hair[look.hair]!;
  const legs = CITIZEN.legs[look.legs]!;
  const scarf = look.woman && look.style === 1;
  const hatted = mood === "entertainer" || mood === "taxman";
  const parts: Part[] = [];

  // Long hair and a headscarf hang behind the head and down to the shoulders.
  if (look.woman && !scarf) parts.push({ shape: [...arc(0, 7.5, 7, Math.PI, Math.PI * 2), [7.4, 17], [4.6, 18.5], [-4.6, 18.5], [-7.4, 17]], color: hair });
  if (scarf) parts.push({ shape: [...arc(0, 8, 7.6, Math.PI * 0.9, Math.PI * 2.1), [6.4, 17], [-6.4, 17]], color: legs });

  // Legs or skirt, body, neck, head.
  if (look.woman) {
    parts.push({ limb: [[-2.6, 39], [-2.6, 42]], width: 2.6, color: skin }, { limb: [[2.6, 39], [2.6, 42]], width: 2.6, color: skin });
    parts.push({ shape: [[-5.4, 27], [5.4, 27], [8.6, 40], [-8.6, 40]], color: clothes });
  } else {
    parts.push({ limb: [[-2.6, 29], [-2.8, 40.5]], width: 4.2, color: legs }, { limb: [[2.6, 29], [2.8, 40.5]], width: 4.2, color: legs });
    parts.push({ shape: [[-5.6, 27], [5.6, 27], [5.4, 31], [-5.4, 31]], color: legs });
  }
  parts.push({ shape: [[-5, 40.6], [-0.6, 40.6], [-0.6, 43], [-5.6, 43]], color: CITIZEN.shoe });
  parts.push({ shape: [[5, 40.6], [0.6, 40.6], [0.6, 43], [5.6, 43]], color: CITIZEN.shoe });
  parts.push({ shape: [[-7, 16.5], [7, 16.5], [5.6, 29], [-5.6, 29]], color: clothes });
  parts.push({ limb: [[0, 12.5], [0, 16]], width: 3.4, color: skin });
  parts.push(...arms(mood, sleeve, skin));
  parts.push({ disc: HEAD, r: scarf ? 5.4 : 6, color: skin });

  // Hair on top (a beard below), or the trade's hat.
  if (!scarf && !hatted) parts.push({ shape: [...arc(0, 7.5, 6.6, Math.PI * 1.02, Math.PI * 1.98), [4.6, 4.4], [0, 3.4], [-4.6, 4.4]], color: hair });
  if (!look.woman && look.style === 1) parts.push({ shape: [...arc(0, 7.5, 6.4, Math.PI * 0.05, Math.PI * 0.95), [-4.4, 9.4], [4.4, 9.4]], color: hair });
  if (mood === "entertainer") {
    parts.push({ shape: arc(0, 6, 6.8, Math.PI, Math.PI * 2), color: clothes });
    parts.push({ shape: [[-6.4, 5], [-1.6, 2.2], [-10, -1]], color: sleeve }, { shape: [[6.4, 5], [1.6, 2.2], [10, -1]], color: sleeve });
    parts.push({ disc: [-10, -1], r: 1.6, color: CITIZEN.bell }, { disc: [10, -1], r: 1.6, color: CITIZEN.bell });
  }
  if (mood === "taxman") {
    parts.push({ shape: arc(0, 4.6, 5, Math.PI, Math.PI * 2), color: CITIZEN.hat });
    parts.push({ limb: [[-8, 4.6], [8, 4.6]], width: 2, color: CITIZEN.hat });
    parts.push({ disc: [8.4, 30], r: 3.2, color: CITIZEN.coin });
  }
  if (mood === "scientist") parts.push({ shape: [[7.4, 3.4], [11.8, 3.4], [10.4, -0.4], [8.8, -0.4]], color: CITIZEN.flask });

  ctx.save();
  ctx.translate(x, y);
  for (const p of parts) paint(ctx, p, true);
  for (const p of parts) paint(ctx, p, false);

  // The face: eyes (behind glasses for a scientist) and a mouth that shows the mood.
  const [hx, hy] = HEAD;
  for (const ex of [-2.2, 2.2]) {
    ctx.beginPath();
    ctx.arc(hx + ex, hy, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = CITIZEN.line;
    ctx.fill();
  }
  if (mood === "scientist") {
    ctx.strokeStyle = CITIZEN.glass;
    ctx.lineWidth = 1;
    for (const ex of [-2.4, 2.4]) { ctx.beginPath(); ctx.arc(hx + ex, hy, 1.9, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.beginPath();
  if (mood === "happy" || mood === "entertainer") ctx.arc(hx, hy + 1.4, 2.4, Math.PI * 0.2, Math.PI * 0.8);
  else if (mood === "unhappy") ctx.arc(hx, hy + 5.6, 2.4, Math.PI * 1.2, Math.PI * 1.8);
  else { ctx.moveTo(hx - 1.6, hy + 3); ctx.lineTo(hx + 1.6, hy + 3); }
  ctx.strokeStyle = CITIZEN.line;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}
