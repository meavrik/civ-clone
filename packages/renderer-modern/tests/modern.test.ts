import { describe, expect, it } from "vitest";
import { ADVANCES, applyCommand, CIV_COLORS, createUnit, newGame, revealAround, Terrain } from "@civ/core";
import { CLOUDS, PLAYER_COLORS } from "../src/theme.js";
import type { MainScreenView } from "@civ/renderer-api";
import { createModernRenderer, MODERN_H, MODERN_TILE, MODERN_W, type Context2D, type Gradient } from "../src/index.js";
import { paintIcon } from "../src/icons.js";
import { cityScene, civilizationsReport, ICONS, openResearch, setupMenu } from "@civ/renderer-api";

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
  fills: { x: number; y: number; w: number; h: number; style: string }[] = [];
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
  fillRect(x: number, y: number, w: number, h: number): void { this.seen(x + w, y + h); this.bump("fillRect"); this.fills.push({ x, y, w, h, style: String(this.fillStyle) }); }
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
    r.title(0);
    r.main(state, view);
    r.main(state, { ...view, inspect: { x: state.cities[0]!.x + 1, y: state.cities[0]!.y }, message: undefined, autoEnd: true });
    r.city(state, { city: state.cities[0]!.id });
    r.city(state, { city: state.cities[0]!.id, happy: true });
    r.cityView(state, { city: state.cities[0]!.id });
    r.cityView(state, { city: state.cities[0]!.id, picked: "palace" });
    const panel = openResearch(state, r.researchListRows, { discovered: ["bronze_working"], choosing: true, closable: false });
    r.research(state, panel);
    // Far along: a player who knows all but the last few, the list scrolled toward its end.
    const known = state.players[0]!.advances;
    state.players[0]!.advances = ADVANCES.map((a) => a.id).filter((id) => !["fusion_power", "quantum_computing"].includes(id));
    r.research(state, { ...panel, selected: "fusion_power", closable: true, top: 20 });
    state.players[0]!.advances = known;
    r.science(state);
    r.rates(state);
    for (const which of ["domestic", "military", "foreign", "score"] as const) r.advisor(state, which);
    r.diplomacy(state, { player: 1, line: "Greetings.", choices: ["Propose peace", "Farewell"] });
    r.end(["Citizens: 3", "Total score: 12"], "Modest");
    r.spaceship(state);
    r.report({ title: "Wonders of the World", lines: [{ text: "Pyramids", right: "Rome (Romans)", slot: 0 }], hint: "1 of 21 built" });
    r.report(civilizationsReport(state));
    r.menu(setupMenu({ step: "civ", world: null, historical: false, custom: null, difficulty: 2, opponents: 6, civ: "romans" }));
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
    let from = 0;
    // Every panel icon draws; a settler at work shows its job and the turns it still needs.
    for (const name of ICONS) paintIcon(ctx, name, 10, 10, 16);
    const home = state.cities[0]!;
    const worker = createUnit(state, "settlers", 0, home.x + 1, home.y);
    state.players[0]!.visible[worker.y * state.map.width + worker.x] = 1;
    worker.order = { kind: "work", work: "mine", turnsLeft: 7 };
    from = ctx.texts.length;
    r.main(state, { ...view, message: undefined, inspect: { x: worker.x, y: worker.y } });
    expect(ctx.texts.slice(from)).toContain("7");
    expect(ctx.texts.slice(from).some((t) => t.includes(" 7"))).toBe(true); // the job in the inspect box
    state.units = state.units.filter((u) => u.id !== worker.id);
    // While the view lingers on a unit that just acted, the panel shows it, not the next one;
    // with that unit gone the unit box stays empty instead of announcing the end of the turn.
    const trireme = state.units.find((u) => u.type === "trireme")!;
    from = ctx.texts.length;
    r.main(state, { ...view, message: undefined, focus: trireme.id });
    expect(ctx.texts.slice(from)).toContain("Trireme");
    const active = state.activeUnit;
    state.activeUnit = null;
    from = ctx.texts.length;
    r.main(state, { ...view, message: undefined, focus: null });
    expect(ctx.texts.slice(from).some((t) => t.includes("End of turn"))).toBe(false);
    from = ctx.texts.length;
    r.main(state, { ...view, message: undefined });
    expect(ctx.texts.slice(from).some((t) => t.includes("End of turn"))).toBe(true);
    state.activeUnit = active;
    r.menu({ title: "", items: ["City Status", "Military Advisor"], right: ["F1", "F2"], selected: 0, anchor: r.menuBarAnchor(2) });
    r.menu({ title: "Game", items: ["Save game", "Load game"], selected: 1, right: ["", "slot 2"] });
    r.textInput({ title: "Name the new city", text: "Rome", maxLength: 14 }, true);
    r.statusLine("Going to...");
    r.present();
    expect(ctx.calls.get("setTransform")).toBe(1);
    expect(ctx.calls.get("fillText")!).toBeGreaterThan(50);
    expect(ctx.texts).toContain("CIVILIZATION");
    expect(ctx.texts).toContain("Spaceship");
    for (const t of ["Game", "Orders", "Advisors", "World", "Wonders of the World", "City Status"]) expect(ctx.texts).toContain(t);
    expect(ctx.texts.some((t) => t.includes("Name the new city"))).toBe(true);
    // The viewport paints one clipped extra row and column while the camera glides.
    expect(ctx.maxX).toBeLessThanOrEqual(MODERN_W + 2 * MODERN_TILE);
    expect(ctx.maxY).toBeLessThanOrEqual(MODERN_H + 2 * MODERN_TILE);
  });

  it("shows the research under way in the panel and a note beside a refused unit", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx, () => 2);
    const { state, u, view } = world();
    state.players[0]!.researching = "pottery";
    r.beginFrame();
    r.main(state, { ...view, callout: { x: u.x, y: u.y, text: "No moves left for Settlers this turn." } });
    r.present();
    expect(ctx.texts.some((t) => t.includes("Pottery"))).toBe(true);
    expect(ctx.texts.join(" ")).toContain("No moves left for Settlers this turn.");
  });

  it("marks cities on the minimap, and borders there when they are shown", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx, () => 2);
    const { state, view } = world();
    const ours = PLAYER_COLORS[state.players[0]!.color % PLAYER_COLORS.length]!;
    // The minimap sits at the top of the panel, above y 150.
    const onMinimap = (f: { x: number; y: number }) => f.x < 240 && f.y < 150;
    const lines = () => ctx.fills.filter((f) => onMinimap(f) && f.style === ours && (f.w === 1 || f.h === 1)).length;
    r.beginFrame();
    r.main(state, { ...view, borders: false });
    expect(ctx.fills.filter((f) => onMinimap(f) && f.style === ours && f.w === 4 && f.h === 4)).toHaveLength(state.cities.length);
    expect(lines()).toBe(0);
    ctx.fills = [];
    r.main(state, { ...view, borders: true });
    expect(lines()).toBeGreaterThan(10);
  });

  it("maps points back to tiles, the minimap, menu rows and city slots", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx);
    const { state, view } = world();
    const bar = 30; // the menu bar sits above the map and the panel
    expect(r.tileAt(state, view, 100, 100)).toBeNull();
    expect(r.tileAt(state, view, 400, 10)).toBeNull();
    // The map's area (for edge scrolling) is where its squares answer, and nothing beyond.
    const m = r.mapView!;
    expect(m).toEqual({ x: 240, y: bar, width: 720, height: 600 - bar });
    expect(r.tileAt(state, view, m.x, m.y)).not.toBeNull();
    expect(r.tileAt(state, view, m.x + m.width - 1, m.y + m.height - 1)).not.toBeNull();
    expect(r.tileAt(state, view, m.x - 1, m.y)).toBeNull();
    expect(r.tileAt(state, view, m.x, m.y - 1)).toBeNull();
    const hit = r.tileAt(state, view, 240 + 48 * 3 + 5, bar + 48 * 2 + 5);
    expect(hit).toEqual({ x: ((view.originX + 3) % 80 + 80) % 80, y: view.originY + 2 });
    // Half a tile of camera pan shifts which tile sits under the same point.
    const panned = r.tileAt(state, { ...view, panX: 0.5, panY: 0 }, 240 + 48 * 3 + 30, bar + 48 * 2 + 5);
    expect(panned).toEqual({ x: ((view.originX + 4) % 80 + 80) % 80, y: view.originY + 2 });
    expect(r.minimapAt(state, 40 + 2 * 10, bar + 14 + 2 * 20)).toEqual({ x: 10, y: 20 });
    // The bar's five titles, left to right; each dropdown opens under its own title.
    const titles: number[] = [];
    for (let x = 0; x < 960; x += 4) { const t = r.menuBarHit(x, 15); if (titles.at(-1) !== t) titles.push(t); }
    expect(titles.filter((t) => t >= 0)).toEqual([0, 1, 2, 3, 4]);
    expect(r.menuBarHit(30, bar + 5)).toBe(-1);
    const anchors = [0, 1, 2, 3, 4].map((i) => r.menuBarAnchor(i));
    for (let i = 1; i < 5; i++) expect(anchors[i]!.x).toBeGreaterThan(anchors[i - 1]!.x);
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
    // The production card's Change and Buy buttons sit side by side under the price.
    expect(r.cityButtonAt(660 + 60, 92 + 150 + 17)).toBe("change");
    expect(r.cityButtonAt(800 + 60, 92 + 150 + 17)).toBe("buy");
    expect(r.cityButtonAt(660 + 60, 92 + 124)).toBeNull();
    expect(r.cityButtonAt(10, 590)).toBeNull();
    // The city's picture under the resource map is the View button; in the city view a click names a building.
    expect(r.cityButtonAt(20 + 120, 92 + 292 + 60)).toBe("view");
    const named = state.cities[0]!;
    named.buildings = ["palace"];
    const palace = cityScene(state, named).items.find((it) => it.id === "palace")!;
    expect(r.cityViewAt(state, { city: named.id }, 6 + (palace.x + palace.w / 2) * 3, 40 + (palace.y - 4) * 3)).toBe("palace");
    expect(r.cityViewAt(state, { city: named.id }, 480, 590)).toBeNull();
    // The city's units under the production card: those in the city first, each picked by its badge.
    const city = state.cities[0]!;
    createUnit(state, "phalanx", 0, city.x, city.y, city.id);
    const first = state.units.find((u) => u.owner === 0 && u.x === city.x && u.y === city.y)!;
    expect(r.cityUnitAt(state, { city: city.id }, 660 - 8 + 24, 92 + 242 + 24)).toBe(first.id);
    expect(r.cityUnitAt(state, { city: city.id }, 660 + 60, 92 + 150 + 17)).toBeNull();
  });
});

describe("modern fog of war", () => {
  it("hit-tests the research panel: its list, the card's links and the research button", () => {
    const ctx = new FakeContext();
    const r = createModernRenderer(ctx);
    const { state } = world();
    state.players[0]!.advances.push("alphabet", "code_of_laws", "ceremonial_burial");
    const panel = openResearch(state, r.researchListRows, { discovered: ["code_of_laws"], choosing: true, closable: false });
    const scan = () => {
      const found = new Set<string>();
      for (let y = 0; y < MODERN_H; y += 3) for (let x = 0; x < MODERN_W; x += 3) {
        const h = r.researchHit(state, panel, x, y);
        if (h) found.add(h.kind === "row" || h.kind === "link" ? `${h.kind}:${h.id}` : h.kind);
      }
      return found;
    };
    expect(panel.selected).toBe("monarchy");
    const hits = scan();
    expect(hits.has("row:monarchy")).toBe(true);
    expect(hits.has("row:literacy")).toBe(true); // coming later
    expect(hits.has("row:the_republic")).toBe(false);
    expect(hits.has("link:ceremonial_burial")).toBe(true);
    expect(hits.has("research")).toBe(true);
    expect(hits.has("close")).toBe(false);
    r.research(state, panel);
    expect(ctx.texts).toContain("Research Monarchy");
    expect(ctx.texts).toContain("Wise men discover Code of Laws!");
  });

  it("covers unexplored squares in clouds and draws nothing of what lies beneath", () => {
    const log: string[] = [];
    const ctx = new Proxy(new FakeContext(), {
      get(t, k) {
        const v = (t as unknown as Record<string | symbol, unknown>)[k];
        return typeof v === "function" ? (...a: unknown[]) => { log.push(`${String(k)}(${a.join(",")})`); return (v as (...x: unknown[]) => unknown).apply(t, a); } : v;
      },
      set(t, k, v) {
        log.push(`${String(k)}=${typeof v === "string" || typeof v === "number" ? v : "gradient"}`);
        (t as unknown as Record<string | symbol, unknown>)[k] = v;
        return true;
      },
    }) as Context2D;
    const state = newGame(7);
    const u = state.units[0]!;
    revealAround(state, 0, u.x + 2, u.y + 1, 2);
    const view: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false };
    const r = createModernRenderer(ctx);
    r.main(state, view); // a first frame warms the caches
    log.length = 0;
    r.main(state, view);
    const before = log.splice(0);
    expect(before).toContain(`fillStyle=${CLOUDS.base}`);
    const me = state.players[0]!;
    state.map.tiles.forEach((t, i) => {
      if (me.explored[i]) return;
      t.terrain = t.terrain === Terrain.Ocean ? Terrain.Desert : Terrain.Ocean;
      t.river = !t.river;
      t.road = true;
    });
    r.main(state, view);
    expect(log).toEqual(before);
  });
});
