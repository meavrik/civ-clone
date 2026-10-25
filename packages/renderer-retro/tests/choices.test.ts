import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { setupCards, setupMenu, type MenuState, type SetupState } from "@civ/renderer-api";
import { choiceAt, choicesRect, drawChoices, drawSetupChoose, drawSetupScreen, drawTitleScreen, isStone, ORDER_CHOICES, SETUP_CHOICES, setupChooseAt, setupChooseRect, setupPictureSpots, Surface } from "../src/index.js";
import { encodePng } from "./png.js";

const setup = (step: SetupState["step"], extra: Partial<SetupState> = {}): SetupState =>
  ({ step, world: null, historical: false, custom: null, difficulty: 2, opponents: 6, civ: "romans", ...extra });

/** Each choice's hits, counted pixel by pixel over the screen: the button under each point, -1 off them. */
function hitAreas(m: MenuState, w: number, style: typeof SETUP_CHOICES): number[] {
  const n = new Array<number>(m.items.length).fill(0);
  for (let y = 0; y < 200; y++) for (let x = 0; x < w; x++) { const i = choiceAt(m, x, y, w, style); if (i >= 0) n[i]!++; }
  return n;
}

describe("menus as buttons (the phone app)", () => {
  it("lay out every starting question as a column of large buttons, the title screen's below the game's name", () => {
    const title: MenuState = { title: "", items: ["Continue: Romans, 4000 BC", "Start a new game", "Play on a premade world", "Customize world", "Load a saved game"], selected: 0 };
    const questions = (["world", "size", "starts", "landMass", "temperature", "climate", "age", "opponents"] as const).map((step) => setupMenu(setup(step)));
    for (const m of [title, ...questions]) {
      const r = choicesRect(m, 320, SETUP_CHOICES);
      expect(r, m.title).not.toBeNull();
      expect(r!.y + r!.h).toBeLessThanOrEqual(200);
      // One column: every button the same, each answering over its whole face.
      const areas = hitAreas(m, 320, SETUP_CHOICES);
      expect(new Set(areas).size, m.title).toBe(1);
      expect(areas[0]).toBeGreaterThanOrEqual(SETUP_CHOICES.minW * SETUP_CHOICES.h);
    }
    expect(choicesRect(title, 320, SETUP_CHOICES)!.y).toBeGreaterThanOrEqual(SETUP_CHOICES.top!);
    const s = Surface.screen();
    drawTitleScreen(s, 1e9);
    drawChoices(s, title, SETUP_CHOICES);
    writeFileSync(new URL("./out/choices-title.png", import.meta.url), encodePng(s, 3));
    const t = Surface.screen();
    drawTitleScreen(t, 1e9);
    drawChoices(t, setupMenu(setup("opponents")), SETUP_CHOICES);
    writeFileSync(new URL("./out/choices-opponents.png", import.meta.url), encodePng(t, 3));
  });

  it("leave to the rows what has text, too many choices, or a map square", () => {
    const slots: MenuState = { title: "Load which game?", items: Array.from({ length: 10 }, (_, i) => `${i}. Romans, 2150 BC, turn ${i * 40}`), selected: 0 };
    expect(choicesRect(slots, 320, SETUP_CHOICES)).toBeNull();
    expect(choicesRect({ title: "Buy?", body: ["50 gold"], items: ["Buy", "Not now"], selected: 0 }, 320, SETUP_CHOICES)).toBeNull();
    expect(choicesRect({ title: "Nothing", items: [], selected: 0 }, 320, SETUP_CHOICES)).toBeNull();
  });

  it("lay a unit's orders two across, three when two would run off the screen, at their anchor", () => {
    const orders = (n: number): MenuState => ({ title: "Settlers: orders", items: Array.from({ length: n }, (_, i) => `Order ${i}`), selected: 0, anchor: { x: 300, y: 150 } });
    const nine = choicesRect(orders(9), 406, ORDER_CHOICES)!;
    expect(nine.h).toBe(17 + 5 * ORDER_CHOICES.h + 4 * ORDER_CHOICES.gap + 8);
    // At its anchor, kept on the screen.
    expect(nine.x + nine.w).toBeLessThanOrEqual(406);
    expect(nine.y + nine.h).toBeLessThanOrEqual(200);
    const many = choicesRect(orders(18), 406, ORDER_CHOICES)!;
    expect(many.h).toBeLessThanOrEqual(200);
    expect(many.h).toBeLessThan(17 + 9 * ORDER_CHOICES.h + 8);
    // Each order's button answers over its whole face, the gaps between them to none.
    const areas = hitAreas(orders(9), 406, ORDER_CHOICES);
    for (const a of areas) expect(a).toBe(areas[0]);
    const s = new Surface(406, 200, undefined, 2);
    drawChoices(s, { ...orders(9), items: ["Found city", "Irrigate (5 turns)", "Mine (15 turns)", "Road (2 turns)", "Fortify", "Sentry", "Wait", "Skip turn", "Disband"] }, ORDER_CHOICES);
    writeFileSync(new URL("./out/choices-orders.png", import.meta.url), encodePng(s, 3));
  });

  it("put the cards' Choose button in their panel, clear of the pictures and of every tribe's and level's words", () => {
    for (const cards of [setupCards(setup("difficulty"))!, setupCards(setup("civ"))!]) {
      const b = setupChooseRect(cards);
      expect(setupChooseAt(cards, b.x + 2, b.y + 2)).toBe(true);
      expect(setupChooseAt(cards, b.x - 1, b.y)).toBe(false);
      cards.cards.forEach((_, sel) => {
        for (const p of setupPictureSpots(cards, sel)) expect(p.x >= b.x + b.w || p.x + p.w <= b.x || p.y >= b.y + b.h || p.y + p.h <= b.y).toBe(true);
        // Without the button its place is bare stone: no words run under it.
        const s = Surface.screen();
        drawSetupScreen(s, cards, sel, 0);
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (!isStone(s.get(x, y))) throw new Error(`${cards.title} ${sel}: ink at ${x},${y}`);
      });
    }
    const s = Surface.screen();
    const tribes = setupCards(setup("civ"))!;
    drawSetupScreen(s, tribes, 2, 0);
    drawSetupChoose(s, tribes);
    writeFileSync(new URL("./out/setup-choose.png", import.meta.url), encodePng(s, 3));
  });
});
