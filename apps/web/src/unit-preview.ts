import {
  animSheet, C, PALETTE_RGBA, showFrame, spriteSurface, TERRAIN_SHEET, UNIT_ANIMS, UNIT_ATLASES, unitArtPlace, UnitAnimator,
  type BattleFighter, type BattleFrame,
} from "@civ/renderer-retro";
import type { GameState, Unit, WorkKind } from "@civ/core";
import { unitFrameUrl } from "./unit-frames.js";

/**
 * A development page (unit-preview.html, served by the dev server only) for the animated units (`?unit=settlers`,
 * `?unit=settlers-found`; the militia without one): every frame of the unit's atlas with its source rectangle, bounds
 * and anchor; each of its moves (attack, sentry, fortify; travel and each job; a show, over and over, by `showFrame`)
 * played by the game's own `UnitAnimator` and placed by its
 * `unitArtPlace` on grass, sand, forest and ocean, in two owners' colours and as drawn; play, pause, single steps
 * and speed on a clock of its own; and, for a unit that attacks, a count of the strikes against the fights (one each
 * time round the attack, the first with the fight's first blow), to catch a fight with none.
 */

const UNIT = new URLSearchParams(location.search).get("unit") ?? "militia";
const rule = UNIT_ANIMS[UNIT]!;
const atlas = UNIT_ATLASES[UNIT]!;
document.title = `Unit moves preview: ${UNIT}`;
document.getElementById("heading")!.textContent = `Unit moves preview: ${UNIT}`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tiles = $<HTMLCanvasElement>("tiles"), framesCanvas = $<HTMLCanvasElement>("frames"), sheetCanvas = $<HTMLCanvasElement>("sheet");
const play = $<HTMLButtonElement>("play"), stepButton = $<HTMLButtonElement>("step"), speed = $<HTMLSelectElement>("speed");
const squareInput = $<HTMLInputElement>("square"), tileInput = $<HTMLInputElement>("tile");
const cross = $<HTMLInputElement>("cross"), onion = $<HTMLInputElement>("onion"), smooth = $<HTMLInputElement>("smooth");
const stats = $<HTMLSpanElement>("stats");
squareInput.value = String(rule.square);
squareInput.addEventListener("input", () => { const v = Number(squareInput.value); if (v >= 50) rule.square = v; });

// ---- the units and the fights, on the page's own clock ---------------------------------------------------------
const CYCLE = 2500, FIGHT = 1600, FORTIFIED = 1800, WALKING = 1600;
/** One unit a move the rule has: its row's name, its frames, and its orders (an attacker, a walker and a fortifier change theirs each cycle). */
type Move = { id: number; name: string; frames: number[]; order: Unit["order"]; role?: "attack" | "travel" | "fortify" | "show" };
const moves: Move[] = [];
const add = (name: string, frames: number[], order: Unit["order"], role?: Move["role"]) => moves.push({ id: moves.length + 1, name, frames, order, ...(role ? { role } : {}) });
if (rule.attack) add("Attack", rule.attack.frames, { kind: "none" }, "attack");
if (rule.sentry) add("Sentry", rule.sentry.frames, { kind: "sentry" });
if (rule.fortify) add("Fortify", rule.fortify.frames, { kind: "none" }, "fortify");
if (rule.travel) add("Travel", rule.travel.frames, { kind: "none" }, "travel");
for (const [job, seq] of Object.entries(rule.work ?? {}) as [WorkKind, { frames: number[] }][])
  if (!moves.some((m) => m.frames === seq.frames)) add(`Work: ${job}`, seq.frames, { kind: "work", work: job, turnsLeft: 3 });
if (rule.show) add("Show", rule.show.frames, { kind: "none" }, "show");
const shower = moves.find((m) => m.role === "show");
const units = moves.map((m) => ({ id: m.id, type: UNIT, owner: 0, order: m.order }));
const state = { units } as unknown as GameState;
const attackerId = moves.find((m) => m.role === "attack")?.id;
const fortifier = units.find((u) => moves[u.id - 1]!.role === "fortify");
const walker = moves.find((m) => m.role === "travel")?.id;
const fighter = (id: number, type: string): BattleFighter => ({ unit: id, type, owner: 0, x: 0, y: 0, hp: 10, maxHp: 10, xp: 0, stacked: false, hit: 0, dying: 0 });
const animator = new UnitAnimator();
let clock = 0;
let frames: Record<number, number> = {};
const strikes = new Map<number, number>();

function advance(to: number): void {
  clock = to;
  const start = Math.floor(clock / CYCLE) * CYCLE;
  const battle: BattleFrame | undefined = attackerId && clock - start < FIGHT ? { attacker: fighter(attackerId, UNIT), defender: fighter(99, "phalanx"), start, heading: 1 } : undefined;
  if (battle && !strikes.has(start)) strikes.set(start, 0);
  if (fortifier) fortifier.order = { kind: clock - start < FORTIFIED ? "fortifying" : "none" };
  // The walker goes for most of each cycle, then stands.
  const moving = walker && clock - start < WALKING ? [{ unit: walker }] : [];
  const poses = animator.update(state, battle, clock, moving);
  for (const id of poses.impacts) if (id === attackerId && battle) strikes.set(battle.start, strikes.get(battle.start)! + 1);
  frames = poses.frames;
  // A show plays once in the game; here, over and over, a pause on its last frame between.
  if (shower) frames[shower.id] = showFrame(UNIT, clock % (rule.show!.ms.reduce((a, b) => a + b, 0) + 800));
}

let playing = true;
let last = performance.now();
play.addEventListener("click", () => { playing = !playing; play.textContent = playing ? "Pause" : "Play"; });
stepButton.addEventListener("click", () => {
  // To the next change of any unit's frame.
  playing = false;
  play.textContent = "Play";
  const before = JSON.stringify(frames);
  for (let t = clock + 5; t < clock + CYCLE; t += 5) {
    advance(t);
    if (JSON.stringify(frames) !== before) break;
  }
});

// ---- pictures ------------------------------------------------------------------------------------------------
const images = new Map<string, HTMLImageElement>();
function image(url: string | null): HTMLImageElement | null {
  if (!url) return null;
  let img = images.get(url);
  if (!img) { img = new Image(); img.src = url; images.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
const sheetUrl = new URL(`../../../tools/sprites/units/${UNIT}-anim.png`, import.meta.url).href;
const atlasImg = () => image(new URL(`./units/${UNIT}-anim.png`, import.meta.url).href);

const terrainTiles = new Map<string, HTMLCanvasElement>();
function terrain(name: string): HTMLCanvasElement {
  let c = terrainTiles.get(name);
  if (c) return c;
  const s = spriteSurface(TERRAIN_SHEET, name)!;
  c = document.createElement("canvas");
  c.width = s.fw;
  c.height = s.fh;
  const ctx = c.getContext("2d")!;
  const data = ctx.createImageData(s.fw, s.fh);
  for (let i = 0; i < s.data.length; i++) data.data.set(PALETTE_RGBA.subarray(s.data[i]! * 4, s.data[i]! * 4 + 4), i * 4);
  ctx.putImageData(data, 0, 0);
  terrainTiles.set(name, c);
  return c;
}

const TERRAINS = [["grassland", "Grass"], ["desert", "Sand"], ["forest", "Forest"], ["ocean", "Ocean"]] as const;
const OWNERS: [number | undefined, string][] = [[C.LBLUE!, "blue"], [C.YELLOW!, "yellow"], [undefined, "as drawn"]];
const MOVES: [number, string, number[]][] = moves.map((m) => [m.id, m.name, m.frames]);

function line(ctx: CanvasRenderingContext2D, colour: string, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
}
function crosshair(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "#0ff";
  ctx.fillRect(Math.round(x - r), Math.round(y), r * 2 + 1, 1);
  ctx.fillRect(Math.round(x), Math.round(y - r), 1, r * 2 + 1);
}

function drawTiles(): void {
  const tile = Math.max(32, Number(tileInput.value) || 128);
  const pad = Math.round(tile * 0.45), label = 150;
  const cell = tile + 2 * pad;
  tiles.width = label + TERRAINS.length * cell;
  tiles.height = MOVES.length * OWNERS.length * cell;
  const ctx = tiles.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, tiles.width, tiles.height);
  ctx.font = "13px system-ui";
  let row = 0;
  for (const [id, move, sequence] of MOVES)
    for (const [owner, ownerName] of OWNERS) {
      const y0 = row++ * cell;
      ctx.fillStyle = "#ddd";
      ctx.fillText(`${move}, ${ownerName}`, 8, y0 + cell / 2 - 6);
      ctx.fillStyle = "#999";
      const sheet = animSheet(UNIT, frames[id] ?? rule.idle);
      ctx.fillText(`frame ${frames[id] ?? "-"} (${sheet?.atlas.frames[sheet.frame]?.name ?? ""})`, 8, y0 + cell / 2 + 12);
      TERRAINS.forEach(([name], col) => {
        const x0 = label + col * cell;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, cell, cell);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        // The square and its neighbours' ground round it, so a club reaching out shows on terrain.
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.drawImage(terrain(name), x0 + pad + dx * tile, y0 + pad + dy * tile, tile, tile);
        line(ctx, "rgba(0,0,0,0.5)", x0 + pad, y0 + pad, tile, tile);
        const scale = tile / 16;
        const place = (frame: number) => unitArtPlace({ id: UNIT, unit: true, x: 0, y: 0, w: 16, h: 16, frame })!;
        const draw = (frame: number, alpha: number) => {
          const img = image(unitFrameUrl(UNIT, frame, owner));
          if (!img) return;
          const b = place(frame);
          ctx.globalAlpha = alpha;
          ctx.imageSmoothingEnabled = smooth.checked;
          ctx.drawImage(img, Math.round(x0 + pad + b.x * scale), Math.round(y0 + pad + b.y * scale), Math.round(b.w * scale), Math.round(b.h * scale));
          ctx.globalAlpha = 1;
        };
        if (onion.checked) for (const f of sequence) draw(f, 0.3);
        const frame = frames[id] ?? rule.idle;
        draw(frame, 1);
        if (cross.checked) {
          const b = place(frame);
          // The frame's own atlas: the unit's, or one of its further sheets.
          const { atlas: own, frame: local } = animSheet(UNIT, frame)!;
          const k = (b.w / own.size[0]) * scale;
          const bx = x0 + pad + b.x * scale, by = y0 + pad + b.y * scale;
          line(ctx, "#888", bx, by, b.w * scale, b.h * scale);
          const box = own.frames[local]!.box;
          line(ctx, "#ee3", bx + box[0] * k, by + box[1] * k, box[2] * k, box[3] * k);
          crosshair(ctx, bx + own.anchor[0] * k, by + own.anchor[1] * k, 8);
        }
        ctx.restore();
      });
    }
}

function drawFrames(): void {
  const img = atlasImg();
  const [w, h] = atlas.size;
  const s = 0.5, cols = 7, text = 62;
  const cw = Math.ceil(w * s) + 12, ch = Math.ceil(h * s) + text;
  framesCanvas.width = cols * cw;
  framesCanvas.height = Math.ceil(atlas.frames.length / cols) * ch;
  const ctx = framesCanvas.getContext("2d")!;
  ctx.fillStyle = "#2a3326";
  ctx.fillRect(0, 0, framesCanvas.width, framesCanvas.height);
  ctx.font = "11px system-ui";
  atlas.frames.forEach((f, n) => {
    const x = (n % cols) * cw + 6, y = Math.floor(n / cols) * ch + 4;
    ctx.imageSmoothingEnabled = false;
    if (img) ctx.drawImage(img, n * w, 0, w, h, x, y, w * s, h * s);
    line(ctx, "#888", x, y, w * s, h * s);
    line(ctx, "#ee3", x + f.box[0] * s, y + f.box[1] * s, f.box[2] * s, f.box[3] * s);
    crosshair(ctx, x + atlas.anchor[0] * s, y + atlas.anchor[1] * s, 10);
    ctx.fillStyle = "#ddd";
    ctx.fillText(`${n} ${f.name}`, x, y + h * s + 13);
    ctx.fillStyle = "#999";
    ctx.fillText(`source ${f.source.join(", ")}`, x, y + h * s + 27);
    ctx.fillText(`anchor ${f.anchor.join(", ")}`, x, y + h * s + 41);
    ctx.fillText(`drawing ${f.box[2]}x${f.box[3]} at ${f.box[0]}, ${f.box[1]}`, x, y + h * s + 55);
  });
}

let sheetDrawn = false;
function drawSheet(): void {
  const img = image(sheetUrl);
  if (!img || sheetDrawn) return;
  const s = 0.5;
  sheetCanvas.width = img.naturalWidth * s;
  sheetCanvas.height = img.naturalHeight * s;
  const ctx = sheetCanvas.getContext("2d")!;
  ctx.fillStyle = "#2a3326";
  ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  ctx.drawImage(img, 0, 0, sheetCanvas.width, sheetCanvas.height);
  ctx.font = "12px system-ui";
  atlas.frames.forEach((f, n) => {
    line(ctx, "#f55", f.source[0] * s, f.source[1] * s, f.source[2] * s, f.source[3] * s);
    crosshair(ctx, f.anchor[0] * s, f.anchor[1] * s, 6);
    ctx.fillStyle = "#f88";
    ctx.fillText(String(n), f.source[0] * s + 3, f.source[1] * s + 13);
  });
  sheetDrawn = true;
}

function frame(now: number): void {
  // At most a tenth of a second a frame: a hidden tab or a slow start never skips a fight.
  if (playing) advance(clock + Math.min(100, now - last) * Number(speed.value));
  last = now;
  drawTiles();
  drawFrames();
  drawSheet();
  const fights = [...strikes.entries()].filter(([start]) => clock - start >= FIGHT);
  const wrong = fights.filter(([, n]) => n < 1).length;
  stats.textContent = attackerId
    ? `clock ${(clock / 1000).toFixed(2)} s · fights ${fights.length} · strikes ${fights.reduce((a, [, n]) => a + n, 0)} · fights never struck ${wrong}`
    : `clock ${(clock / 1000).toFixed(2)} s`;
  stats.className = wrong ? "bad" : "";
  requestAnimationFrame(frame);
}
advance(0);
requestAnimationFrame(frame);
