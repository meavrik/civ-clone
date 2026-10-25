import { readFileSync } from "node:fs";
import { MENU_BAR as DEV_MENU_BAR } from "@civ/renderer-api";
import { ratesAt, ratesRect } from "@civ/renderer-retro";
import { describe, expect, it } from "vitest";
import { droppedTitles, withoutTitles } from "../menu-bar.js";
import { Pinch, Recognizer } from "../src/gestures.js";
import { layoutFor, MAX_SCREEN_W, screenWidth } from "../src/layout.js";
import { MapPan, RELEASE_MS } from "../src/pan.js";
import { rateKeys } from "../src/rates.js";
import { scrollRows } from "../src/menus.js";

describe("layout", () => {
  it("lays the game out as wide as a phone held sideways, from the original's 320 up to a limit", () => {
    expect(screenWidth(844, 390, { top: 0, right: 47, bottom: 21, left: 47 })).toBe(Math.floor((200 * 750) / 369)); // 406
    expect(screenWidth(1180, 820, { top: 24, right: 0, bottom: 20, left: 0 })).toBe(320); // a tablet: no wider than 16:10 allows
    expect(screenWidth(2400, 600, { top: 0, right: 0, bottom: 0, left: 0 })).toBe(MAX_SCREEN_W);
    const l = layoutFor(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, 406, 200);
    expect(l.canvas.h).toBe(369); // the full height, and nearly the full width
    expect(l.canvas.w).toBeGreaterThanOrEqual(748);
  });


  it("fills the height of a phone held sideways, inside the notch and the home bar", () => {
    const l = layoutFor(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, 320, 200);
    expect(l.canvas.h).toBe(369);
    expect(l.canvas.w).toBe(590);
    expect(l.canvas.x).toBe(47 + Math.round((750 - 590) / 2));
    expect(l.scale).toBeCloseTo(590 / 320, 5);
  });

  it("fills the width of a phone held upright, centred top to bottom", () => {
    const l = layoutFor(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 320, 200);
    expect(l.canvas).toEqual({ x: 0, y: 47 + Math.round((763 - 244) / 2), w: 390, h: 244 });
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

describe("pinch zoom", () => {
  it("zooms in a step each time the fingers spread by a third again, and back out as they close", () => {
    const p = new Pinch(100, 1, [1, 2, 3]);
    expect(p.move(120)).toBeNull();
    expect(p.move(140)).toBe(2);
    expect(p.move(170)).toBeNull();
    expect(p.move(190)).toBe(3);
    expect(p.move(400)).toBeNull(); // no level past the last
    expect(p.move(290)).toBe(2); // and the way back starts from where the fingers got to
    expect(p.move(210)).toBe(1);
    expect(p.move(50)).toBeNull();
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

describe("rates by touch", () => {
  it("knows the bars and the rate each point of them stands for", () => {
    // The window stands in the middle of the screen; its three rows of blocks answer, nothing else.
    const o = ratesRect();
    const rowY = (row: string) => { for (let y = o.y; y < o.y + o.h; y++) if (ratesAt(o.x + 120, y)?.row === row) return y; return -1; };
    const left = (() => { for (let x = o.x; x < o.x + o.w; x++) if (ratesAt(x, rowY("tax"))) return x; return -1; })();
    expect(ratesAt(left + 2, rowY("tax"))).toEqual({ row: "tax", value: 0 });
    expect(ratesAt(left + 55, rowY("lux"))).toEqual({ row: "lux", value: 5 });
    expect(ratesAt(left + 112, rowY("sci"))).toEqual({ row: "sci", value: 10 });
    expect(ratesAt(left + 55, o.y + o.h - 4)).toBeNull();
    expect(ratesAt(o.x + 20, rowY("tax"))).toBeNull(); // the label
    expect(ratesAt(o.x + 20, rowY("tax"), true)).toEqual({ row: "tax", value: 0 }); // a finger sliding off the end keeps the bar
    // Over the phone's wide map the window stands in that screen's middle.
    expect(ratesAt(left + 2 + 80, rowY("tax"), false, 480)).toEqual({ row: "tax", value: 0 });
  });

  it("walks the rates to the one touched with the arrows the game takes", () => {
    const now = { tax: 4, lux: 2 };
    expect(rateKeys(now, "tax", 6)).toEqual(["ArrowRight", "ArrowRight"]);
    expect(rateKeys(now, "lux", 0)).toEqual(["ArrowDown", "ArrowDown"]);
    expect(rateKeys(now, "sci", 6)).toEqual(["ArrowLeft", "ArrowLeft"]); // science 4 to 6: tax 4 to 2
    expect(rateKeys(now, "tax", 4)).toEqual([]);
  });
});

describe("menus by touch", () => {
  it("scroll a long list under the finger, the choice staying on view, never past its ends", () => {
    const m = { title: "Build what?", items: Array.from({ length: 30 }, (_, i) => `Choice ${i}`), selected: 2 };
    scrollRows(m, 5, 11);
    expect(m).toMatchObject({ top: 5, selected: 5 });
    scrollRows(m, 100, 11);
    expect(m).toMatchObject({ top: 19, selected: 19 });
    m.selected = 25;
    scrollRows(m, -3, 11);
    expect(m).toMatchObject({ top: 16, selected: 25 });
    scrollRows(m, -100, 11);
    expect(m).toMatchObject({ top: 0, selected: 10 });
    // A list that fits does not move.
    const short = { title: "Pick", items: ["A", "B"], selected: 1 };
    scrollRows(short, 3, 11);
    expect(short).toEqual({ title: "Pick", items: ["A", "B"], selected: 1 });
  });
});

describe("the phone's menu bar", () => {
  const source = readFileSync(new URL("../../../packages/renderer-api/src/index.ts", import.meta.url), "utf8");
  const bar = (code: string) => /export const MENU_BAR = [^\n]*/.exec(code)![0];

  it("has no Orders (a tap on a unit opens them), and no Debug once deployed", () => {
    expect(DEV_MENU_BAR).toEqual(["Game", "Orders", "Advisors", "Diplomacy", "World", "Debug"]);
    expect(bar(withoutTitles(source, droppedTitles("serve")))).toBe('export const MENU_BAR = ["Game", "Advisors", "Diplomacy", "World", "Debug"] as const;');
    const built = withoutTitles(source, droppedTitles("build"));
    expect(bar(built)).toBe('export const MENU_BAR = ["Game", "Advisors", "Diplomacy", "World"] as const;');
    expect(built.replace(bar(built), "")).toBe(source.replace(bar(source), ""));
  });

  it("refuses to build if the titles are no longer written as it expects", () => {
    expect(() => withoutTitles('export const MENU_BAR = ["Game", "World"] as const;', ["Orders"])).toThrow(/Orders/);
    expect(() => withoutTitles("export const MENU_BAR = TITLES;", ["Orders"])).toThrow(/MENU_BAR/);
  });
});

