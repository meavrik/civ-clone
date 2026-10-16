import { describe, expect, it } from "vitest";
import { applyCommand, createUnit, newGame, revealAround } from "@civ/core";
import type { MainScreenView } from "@civ/renderer-api";
import { createModernRenderer, MODERN_H, MODERN_W, type Context2D, type Gradient } from "../src/index.js";

/** Records what the renderer asks of the canvas; width of text is a flat per-character estimate. */
class FakeContext implements Context2D {
  fillStyle: string | Gradient = "#000";
  strokeStyle: string | Gradient = "#000";
  lineWidth = 1;
  lineCap: Context2D["lineCap"] = "butt";
  lineJoin: Context2D["lineJoin"] = "miter";
  font = "";
  textAlign: Context2D["textAlign"] = "left";
  textBaseline: Context2D["textBaseline"] = "top";
  globalAlpha = 1;
  shadowColor = "";
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  calls = new Map<string, number>();
  texts: string[] = [];
  maxX = 0;
  maxY = 0;
  private bump(name: string): void { this.calls.set(name, (this.calls.get(name) ?? 0) + 1); }
  private seen(x: number, y: number): void { if (Number.isFinite(x) && Number.isFinite(y)) { this.maxX = Math.max(this.maxX, x); this.maxY = Math.max(this.maxY, y); } }
  save(): void { this.bump("save"); }
  restore(): void { this.bump("restore"); }
  setTransform(): void { this.bump("setTransform"); }
  translate(): void {}
  scale(): void {}
  beginPath(): void { this.bump("beginPath"); }
  closePath(): void {}
  moveTo(x: number, y: number): void { this.seen(x, y); }
  lineTo(x: number, y: number): void { this.seen(x, y); }
  arc(x: number, y: number): void { this.seen(x, y); this.bump("arc"); }
  quadraticCurveTo(_cx: number, _cy: number, x: number, y: number): void { this.seen(x, y); }
  rect(x: number, y: number): void { this.seen(x, y); }
  fill(): void { this.bump("fill"); }
  stroke(): void { this.bump("stroke"); }
  clip(): void { this.bump("clip"); }
  fillRect(x: number, y: number, w: number, h: number): void { this.seen(x + w, y + h); this.bump("fillRect"); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.seen(x + w, y + h); this.bump("strokeRect"); }
  clearRect(): void {}
  fillText(text: string, x: number, y: number): void { this.seen(x, y); this.texts.push(text); this.bump("fillText"); }
  measureText(text: string): { width: number } { return { width: text.length * 8 }; }
  createLinearGradient(): Gradient { return { addColorStop() {} }; }
  createRadialGradient(): Gradient { return { addColorStop() {} }; }
}

function world() {
  const state = newGame(2026, { opponents: 2 });
  const u = state.units[0]!;
  revealAround(state, 0, u.x, u.y, 9);
  applyCommand(state, { type: "found", unit: u.id });
  const m = createUnit(state, "militia", 0, u.x + 2, u.y + 1);
  applyCommand(state, { type: "fortify", unit: m.id });
  createUnit(state, "trireme", 0, u.x + 1, u.y - 2);
  const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: true, message: "Zone of control" };
  return { state, u, view };
}

describe("modern renderer", () => {
  it("draws every screen within its 960x600 frame", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx, () => 2);
    const { state, view } = world();
    r.beginFrame();
    r.title(true);
    r.main(state, view);
    r.main(state, { ...view, inspect: { x: state.cities[0]!.x + 1, y: state.cities[0]!.y }, message: undefined, autoEnd: true });
    r.city(state, { city: state.cities[0]!.id });
    r.discovery(state, "bronze_working");
    r.science(state);
    r.rates(state);
    for (const which of ["domestic", "military", "foreign", "score"] as const) r.advisor(state, which);
    r.diplomacy(state, 1, "Greetings.");
    r.end(["Citizens: 3", "Total score: 12"], "Modest");
    r.spaceship(state);
    r.menu({ title: "Game", items: ["Save game", "Load game"], selected: 1, right: ["", "slot 2"] });
    r.textInput({ title: "Name the new city", text: "Rome", maxLength: 14 }, true);
    r.statusLine("Going to...");
    r.present();
    expect(ctx.calls.get("setTransform")).toBe(1);
    expect(ctx.calls.get("fillText")!).toBeGreaterThan(50);
    expect(ctx.texts).toContain("E P O C H S");
    expect(ctx.texts).toContain("Spaceship");
    expect(ctx.texts.some((t) => t.includes("Name the new city"))).toBe(true);
    expect(ctx.maxX).toBeLessThanOrEqual(MODERN_W + 48);
    expect(ctx.maxY).toBeLessThanOrEqual(MODERN_H + 48);
  });

  it("maps points back to tiles, the minimap, menu rows and city slots", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx);
    const { state, view } = world();
    expect(r.tileAt(state, view, 100, 100)).toBeNull();
    const hit = r.tileAt(state, view, 240 + 48 * 3 + 5, 48 * 2 + 5);
    expect(hit).toEqual({ x: ((view.originX + 3) % 80 + 80) % 80, y: view.originY + 2 });
    expect(r.minimapAt(state, 40 + 2 * 10, 14 + 2 * 20)).toEqual({ x: 10, y: 20 });
    expect(r.minimapAt(state, 400, 300)).toBeNull();
    const menu = { title: "Game", items: ["a", "b", "c"], selected: 0 };
    expect(r.menuHit(menu, 480, 0)).toBe(-1);
    const rows = [0, 1, 2].map((i) => r.menuHit(menu, 480, 300 - 30 + i * 30));
    expect(new Set(rows).size).toBeGreaterThan(1);
    expect(r.citySlotAt(20 + 48 * 2 + 10, 92 + 48 * 2 + 10)).toBe(0);
    expect(r.citySlotAt(20 + 48 * 4 + 10, 92 + 10)).toBeNull();
    expect(r.cityExitHit(10, 590)).toBe(true);
  });
});
