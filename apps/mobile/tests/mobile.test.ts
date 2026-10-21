import { describe, expect, it } from "vitest";
import { Recognizer } from "../src/gestures.js";
import { keysFor, padFor } from "../src/keys.js";
import { BELOW, KEYS_W, layoutFor, PAD_W } from "../src/layout.js";
import { MapPan, RELEASE_MS } from "../src/pan.js";

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

describe("layout", () => {
  it("puts the controls either side of the screen on a phone held sideways", () => {
    const l = layoutFor(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, 320, 200);
    expect(l.mode).toBe("sides");
    expect(l.canvas.x).toBeGreaterThanOrEqual(47 + PAD_W);
    expect(l.canvas.x + l.canvas.w).toBeLessThanOrEqual(844 - 47 - KEYS_W);
    expect(l.canvas.h).toBeLessThanOrEqual(390 - 21);
    expect(l.canvas.w / l.canvas.h).toBeCloseTo(320 / 200, 1);
    expect(l.pad.x + l.pad.w).toBe(l.canvas.x);
    expect(l.keys.x).toBe(l.canvas.x + l.canvas.w);
  });

  it("puts them below the screen on a phone held upright, the screen as wide as the phone", () => {
    const l = layoutFor(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 320, 200);
    expect(l.mode).toBe("below");
    expect(l.canvas).toEqual({ x: 0, y: 47, w: 390, h: 244 });
    expect(l.pad.y).toBe(47 + 244);
    expect(l.pad.h).toBeGreaterThanOrEqual(BELOW);
    expect(l.keys.x).toBe(l.pad.x + l.pad.w);
  });

  it("picks whichever leaves the bigger screen", () => {
    for (const [w, h] of [[1180, 820], [820, 1180], [667, 375], [1024, 600], [600, 1024]] as const) {
      const l = layoutFor(w, h, NONE, 320, 200);
      const sides = Math.min((w - PAD_W - KEYS_W) / 320, h / 200);
      const below = Math.min(w / 320, (h - BELOW) / 200);
      expect(l.scale).toBeCloseTo(Math.max(sides, below), 2);
      expect(l.canvas.x).toBeGreaterThanOrEqual(0);
      expect(l.canvas.y + l.canvas.h).toBeLessThanOrEqual(h);
    }
  });
});

describe("gestures", () => {
  it("a quick touch is a tap where the finger landed", () => {
    const r = new Recognizer();
    r.down(1, 100, 50, 0);
    expect(r.move(1, 104, 53)).toEqual([]);
    expect(r.up(1, 120)).toEqual({ kind: "tap", x: 100, y: 50 });
    expect(r.busy).toBe(false);
  });

  it("a finger held still is a right-click, once, as soon as it has been held long enough", () => {
    const r = new Recognizer();
    r.down(1, 10, 20, 0);
    expect(r.tick(300)).toBeNull();
    expect(r.tick(460)).toEqual({ kind: "long", x: 10, y: 20 });
    expect(r.tick(600)).toBeNull();
    expect(r.move(1, 80, 80)).toEqual([]);
    expect(r.up(1, 700)).toBeNull();
  });

  it("a held finger lifted before the timer is still a right-click", () => {
    const r = new Recognizer();
    r.down(1, 10, 20, 0);
    expect(r.up(1, 500)).toEqual({ kind: "long", x: 10, y: 20 });
  });

  it("a finger that moves drags from where it landed, and never taps", () => {
    const r = new Recognizer();
    r.down(1, 0, 0, 0);
    expect(r.move(1, 30, 0)).toEqual([{ kind: "dragStart", x: 0, y: 0 }, { kind: "drag", dx: 30, dy: 0 }]);
    expect(r.move(1, 35, -4)).toEqual([{ kind: "drag", dx: 5, dy: -4 }]);
    expect(r.tick(1000)).toBeNull();
    expect(r.up(1, 1000)).toEqual({ kind: "dragEnd" });
  });

  it("a second finger is ignored", () => {
    const r = new Recognizer();
    r.down(1, 0, 0, 0);
    r.down(2, 50, 50, 10);
    expect(r.move(2, 200, 200)).toEqual([]);
    expect(r.up(2, 20)).toBeNull();
    expect(r.up(1, 30)).toEqual({ kind: "tap", x: 0, y: 0 });
  });
});

describe("map pan", () => {
  const map = { width: 80, height: 50 };
  const view = (originX: number, originY: number) => ({ originX, originY, blink: true });

  it("draws the map where the finger took it, the game's camera untouched", () => {
    const pan = new MapPan();
    const v = view(10, 10);
    expect(pan.shift(v, map, 12, 1, 0)).toBe(v);
    pan.grab();
    pan.drag(2.5, -1.25);
    const d = pan.shift(v, map, 12, 1, 16);
    expect(d).toMatchObject({ originX: 12, panX: 0.5, originY: 8, panY: 0.75 });
    expect(v).toEqual(view(10, 10));
  });

  it("wraps east-west and stops at the top and bottom of the world", () => {
    const pan = new MapPan();
    pan.grab();
    pan.drag(-12, -30);
    expect(pan.shift(view(5, 3), map, 12, 1, 0)).toMatchObject({ originX: 73, originY: 0, panY: 0 });
    pan.drag(0, 100);
    expect(pan.shift(view(5, 3), map, 12, 1, 0)).toMatchObject({ originY: 38 });
    pan.drag(80 * 3, 0);
    pan.shift(view(5, 3), map, 12, 1, 0);
    expect(Math.abs(pan.x)).toBeLessThanOrEqual(40);
  });

  it("glides back when the game moves its camera or another unit comes into play", () => {
    for (const [moved, active] of [[true, 1], [false, 2]] as const) {
      const pan = new MapPan();
      pan.shift(view(10, 10), map, 12, 1, 0);
      pan.grab();
      pan.drag(4, 0);
      pan.drop();
      expect(pan.shift(view(10, 10), map, 12, 1, 10).originX).toBe(14);
      pan.shift(view(moved ? 11 : 10, 10), map, 12, active, 100);
      pan.shift(view(moved ? 11.5 : 10, 10), map, 12, active, 100 + RELEASE_MS / 2);
      expect(pan.x).toBeGreaterThan(0);
      expect(pan.x).toBeLessThan(4);
      expect(pan.shift(view(moved ? 12 : 10, 10), map, 12, active, 100 + RELEASE_MS)).toEqual(view(moved ? 12 : 10, 10));
      expect(pan.panned).toBe(false);
    }
  });

  it("keeps the pan while the finger holds the map", () => {
    const pan = new MapPan();
    pan.shift(view(10, 10), map, 12, 1, 0);
    pan.grab();
    pan.drag(3, 0);
    pan.shift(view(11, 10), map, 12, 1, 50);
    pan.letGo(60);
    expect(pan.shift(view(11, 10), map, 12, 1, 60 + RELEASE_MS).originX).toBe(14);
  });
});

describe("controls", () => {
  it("offers what each screen of the web game answers to", () => {
    expect(keysFor({ screen: "map", activeUnit: false }).map((k) => k.code)).toEqual(["Enter", "F10"]);
    expect(keysFor({ screen: "map", activeUnit: true }).map((k) => k.code)).toContain("Escape");
    expect(keysFor({ screen: "city", activeUnit: true }).map((k) => k.code)).toEqual(["KeyC", "KeyB", "KeyH", "KeyV", "KeyN", "Escape"]);
    expect(keysFor({ screen: "input", activeUnit: true })).toEqual([]);
    expect(keysFor({ screen: "diplomacy", activeUnit: false }).map((k) => k.code)).toEqual(["Enter"]);
  });

  it("moves units in eight directions on the map and walks menus with the arrows", () => {
    const map = padFor("map")!;
    expect(map).toHaveLength(9);
    expect(new Set(map.map((p) => `${p.col},${p.row}`)).size).toBe(9);
    expect(map.find((p) => p.col === 0 && p.row === 0)!.code).toBe("Numpad7");
    expect(padFor("menu")!.map((p) => p.code).sort()).toEqual(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"]);
    expect(padFor("city")).toBeNull();
  });
});
