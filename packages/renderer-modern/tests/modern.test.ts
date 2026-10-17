import { describe, expect, it } from "vitest";
import { applyCommand, CIV_COLORS, createUnit, newGame, revealAround } from "@civ/core";
import { PLAYER_COLORS } from "../src/theme.js";
import type { MainScreenView } from "@civ/renderer-api";
import { createModernRenderer, MODERN_H, MODERN_TILE, MODERN_W, type Context2D, type Gradient } from "../src/index.js";

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

describe("modern colours", () => {
  it("give every colour slot its own, clearly different colour", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(PLAYER_COLORS.length).toBe(CIV_COLORS.length);
    for (let i = 0; i < PLAYER_COLORS.length; i++)
      for (let j = i + 1; j < PLAYER_COLORS.length; j++) {
        const [a, b] = [rgb(PLAYER_COLORS[i]!), rgb(PLAYER_COLORS[j]!)];
        expect(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!), `${CIV_COLORS[i]} vs ${CIV_COLORS[j]}`).toBeGreaterThan(110);
      }
  });
});

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
    r.report({ title: "Wonders of the World", lines: [{ text: "Pyramids", right: "Rome (Romans)", slot: 0 }], hint: "1 of 21 built" });
    r.worldMap(state);
    r.main(state, { ...view, menuOpen: 2 });
    const settler = state.units.find((u) => u.type === "settlers") ?? state.units[0]!;
    const before = ctx.texts.length;
    r.main(state, { ...view, message: undefined, moving: [{ unit: settler.id, type: settler.type, owner: 0, x: settler.x + 0.5, y: settler.y }] });
    expect(ctx.texts.length).toBeGreaterThan(before);
    // A fight: both fighters with bars, a blow flashing, then the loser's burst; a wounded unit keeps its bar.
    const side = (unit: number, x: number, extra: Partial<{ hit: number; dying: number }>) =>
      ({ unit, type: "legion", owner: unit === settler.id ? 0 : 1, x, y: settler.y, hp: 4, maxHp: 10, stacked: false, hit: 0, dying: 0, ...extra });
    const arcs = ctx.calls.get("arc") ?? 0;
    r.main(state, { ...view, message: undefined, battle: { attacker: side(999, settler.x + 0.7, {}), defender: side(settler.id, settler.x, { hit: 0.8 }) } });
    r.main(state, { ...view, message: undefined, battle: { attacker: side(999, settler.x + 0.8, {}), defender: side(settler.id, settler.x, { dying: 0.5 }) } });
    expect(ctx.calls.get("arc")!).toBeGreaterThan(arcs + 10);
    settler.hp = 3;
    r.main(state, { ...view, message: undefined });
    settler.hp = 10;
    // While the view lingers on a unit that just acted, the panel shows it, not the next one;
    // with that unit gone the unit box stays empty instead of announcing the end of the turn.
    const trireme = state.units.find((u) => u.type === "trireme")!;
    let from = ctx.texts.length;
    r.main(state, { ...view, message: undefined, focus: trireme.id });
    expect(ctx.texts.slice(from)).toContain("Trireme");
    const active = state.activeUnit;
    state.activeUnit = null;
    from = ctx.texts.length;
    r.main(state, { ...view, message: undefined, focus: null });
    expect(ctx.texts.slice(from)).not.toContain("End of turn");
    from = ctx.texts.length;
    r.main(state, { ...view, message: undefined });
    expect(ctx.texts.slice(from)).toContain("End of turn");
    state.activeUnit = active;
    r.menu({ title: "", items: ["City Status", "Military Advisor"], right: ["F1", "F2"], selected: 0, anchor: r.menuBarAnchor(2) });
    r.menu({ title: "Game", items: ["Save game", "Load game"], selected: 1, right: ["", "slot 2"] });
    r.textInput({ title: "Name the new city", text: "Rome", maxLength: 14 }, true);
    r.statusLine("Going to...");
    r.present();
    expect(ctx.calls.get("setTransform")).toBe(1);
    expect(ctx.calls.get("fillText")!).toBeGreaterThan(50);
    expect(ctx.texts).toContain("E P O C H S");
    expect(ctx.texts).toContain("Spaceship");
    for (const t of ["Game", "Orders", "Advisors", "World", "Wonders of the World", "City Status"]) expect(ctx.texts).toContain(t);
    expect(ctx.texts.some((t) => t.includes("Name the new city"))).toBe(true);
    // The viewport paints one clipped extra row and column while the camera glides.
    expect(ctx.maxX).toBeLessThanOrEqual(MODERN_W + 2 * MODERN_TILE);
    expect(ctx.maxY).toBeLessThanOrEqual(MODERN_H + 2 * MODERN_TILE);
  });

  it("maps points back to tiles, the minimap, menu rows and city slots", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx);
    const { state, view } = world();
    const bar = 30; // the menu bar sits above the map and the panel
    expect(r.tileAt(state, view, 100, 100)).toBeNull();
    expect(r.tileAt(state, view, 400, 10)).toBeNull();
    const hit = r.tileAt(state, view, 240 + 48 * 3 + 5, bar + 48 * 2 + 5);
    expect(hit).toEqual({ x: ((view.originX + 3) % 80 + 80) % 80, y: view.originY + 2 });
    // Half a tile of camera pan shifts which tile sits under the same point.
    const panned = r.tileAt(state, { ...view, panX: 0.5, panY: 0 }, 240 + 48 * 3 + 30, bar + 48 * 2 + 5);
    expect(panned).toEqual({ x: ((view.originX + 4) % 80 + 80) % 80, y: view.originY + 2 });
    expect(r.minimapAt(state, 40 + 2 * 10, bar + 14 + 2 * 20)).toEqual({ x: 10, y: 20 });
    // The bar's four titles, left to right; each dropdown opens under its own title.
    const titles: number[] = [];
    for (let x = 0; x < 960; x += 4) { const t = r.menuBarHit(x, 15); if (titles.at(-1) !== t) titles.push(t); }
    expect(titles.filter((t) => t >= 0)).toEqual([0, 1, 2, 3]);
    expect(r.menuBarHit(30, bar + 5)).toBe(-1);
    const anchors = [0, 1, 2, 3].map((i) => r.menuBarAnchor(i));
    for (let i = 1; i < 4; i++) expect(anchors[i]!.x).toBeGreaterThan(anchors[i - 1]!.x);
    expect(anchors[0]!.y).toBeGreaterThanOrEqual(bar);
    // An anchored dropdown's first row sits right under the bar, not in the middle of the screen.
    const drop = { title: "", items: ["a", "b"], selected: 0, anchor: anchors[1]! };
    let top = -1;
    for (let y = 0; y < 600 && top < 0; y++) if (r.menuHit(drop, anchors[1]!.x + 40, y) === 0) top = y;
    expect(top).toBeGreaterThan(bar);
    expect(top).toBeLessThan(bar + 40);
    expect(r.minimapAt(state, 400, 300)).toBeNull();
    const menu = { title: "Game", items: ["a", "b", "c"], selected: 0 };
    expect(r.menuHit(menu, 480, 0)).toBe(-1);
    const rows = [0, 1, 2].map((i) => r.menuHit(menu, 480, 300 - 30 + i * 30));
    expect(new Set(rows).size).toBeGreaterThan(1);
    // A modal's choices sit below its paragraphs; the paragraphs are not clickable.
    const box = { title: "A Tribal Village", body: ["The elders welcome you with a gift of 50 gold.", "A second line."], items: ["OK", "Close"], selected: 0 };
    const hits = new Set<number>();
    for (let y = 0; y < 600; y += 2) hits.add(r.menuHit(box, 480, y));
    expect(hits).toEqual(new Set([-1, 0, 1]));
    let firstOk = -1;
    for (let y = 0; y < 600 && firstOk < 0; y++) if (r.menuHit(box, 480, y) === 0) firstOk = y;
    let firstPlain = -1;
    for (let y = 0; y < 600 && firstPlain < 0; y++) if (r.menuHit({ ...box, body: [] }, 480, y) === 0) firstPlain = y;
    expect(firstOk).toBeGreaterThan(firstPlain);
    expect(r.citySlotAt(20 + 48 * 2 + 10, 92 + 48 * 2 + 10)).toBe(0);
    expect(r.citySlotAt(20 + 48 * 4 + 10, 92 + 10)).toBeNull();
    expect(r.cityExitHit(10, 590)).toBe(true);
  });
});
