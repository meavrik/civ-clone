import { mkdirSync, writeFileSync } from "node:fs";
import { CIVS, newGame } from "@civ/core";
import { reignCard, traitBonuses, type MainScreenView } from "@civ/renderer-api";
import { describe, expect, it } from "vitest";
import { textWidth, wrapText } from "../src/font.js";
import { drawMainScreen, drawReign, REIGN_BONUS_ROWS, REIGN_BONUS_W, REIGN_TEXT_W, reignHit, reignPicture, reignRect } from "../src/index.js";
import { DIMMED } from "../src/palette.js";
import { Surface } from "../src/surface.js";
import { encodePng } from "./png.js";

const playable = CIVS.filter((c) => c.trait);

describe("the opening window", () => {
  it("tells of every people in three lines at most, and of what each tribe brings in the lines its panel holds", () => {
    for (const c of playable) {
      expect(c.text?.length ?? 0, c.id).toBeGreaterThan(40);
      expect(wrapText(c.text!, REIGN_TEXT_W).length, c.id).toBeLessThanOrEqual(3);
      const rows = traitBonuses(c.trait!).reduce((n, b) => n + wrapText(b.text, REIGN_BONUS_W).length, 0);
      expect(rows, c.id).toBeLessThanOrEqual(REIGN_BONUS_ROWS);
    }
  });

  it("says what each trait does in numbers, then the advance it starts with", () => {
    const by = (id: string) => traitBonuses(CIVS.find((c) => c.id === id)!.trait!).map((b) => `${b.icon} ${b.text}`);
    expect(by("romans")).toEqual(["road Roads and railroads in half the time", "bulb Starts knowing Bronze Working"]);
    expect(by("greeks")[0]).toBe("bulb +25% science in every city");
    expect(by("babylonians")[0]).toBe("house Library and University cost 33% less");
    expect(by("chinese")[0]).toBe("food A growing city keeps a third of its food");
    expect(by("zulus")[0]).toBe("veteran Foot soldiers start as veterans");
    expect(by("vikings")[0]).toBe("veteran Ships start as veterans");
    expect(by("hebrews")[0]).toBe("boot +1 move for settlers");
    expect(by("americans")[0]).toBe("crown Anarchy lasts 1 turn at most");
  });

  it("names our people, leader and year, and in a game of classic civilizations no bonuses", () => {
    const state = newGame(5, { opponents: 2, civ: "romans" });
    const card = reignCard(state);
    expect(card.name).toBe("The Romans");
    expect(card.under).toBe("Caesar, 4000 BC");
    expect(card.portrait).toBe("caesar");
    expect(card.trait).toBe("Roads of Empire");
    const classic = reignCard(newGame(5, { opponents: 2, civ: "romans", classicCivs: true }));
    expect(classic.trait).toBeNull();
    expect(classic.bonuses).toHaveLength(1);
  });

  it("draws a window over the darkened map, its portrait square, Begin and the close box answering to clicks", () => {
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    for (const civ of ["romans", "babylonians", "french", "japanese"]) {
      const state = newGame(7, { opponents: 2, civ });
      const u = state.units.find((x) => x.owner === 0)!;
      const map: MainScreenView = { originX: u.x - 7, originY: Math.max(0, u.y - 6), blink: false, placeNames: false };
      const s = Surface.screen();
      drawMainScreen(s, state, map);
      drawReign(s, state, {});
      writeFileSync(new URL(`./out/reign-${civ}.png`, import.meta.url), encodePng(s, 3));
    }
    const state = newGame(7, { opponents: 2, civ: "romans" });
    const hits = new Set<string | null>();
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) hits.add(reignHit({}, x, y));
    expect([...hits].sort()).toEqual(["begin", "close", null].sort());
    const o = reignRect();
    expect(o.x + o.w).toBeLessThanOrEqual(318);
    expect(o.y + o.h).toBeLessThanOrEqual(198);
    expect(reignHit({}, o.x + o.w / 2, o.y + o.h - 12)).toBe("begin");
    expect(reignHit({}, 5, 190)).toBeNull();
    const p = reignPicture();
    expect(p.w).toBe(p.h);
    expect(textWidth(reignCard(state).name.toUpperCase()) * 2).toBeLessThanOrEqual(o.w - 22);
    const before = Surface.screen();
    before.fill(7);
    drawReign(before, state, {});
    expect(before.get(2, 2)).toBe(DIMMED[7]); // the map darkened behind the window
    // On a wider screen (the phone's map) it stands in that screen's middle.
    const wide = reignRect(480);
    expect(wide.x).toBe(o.x + 80);
    expect(reignHit({}, wide.x + wide.w / 2, wide.y + wide.h - 12, 480)).toBe("begin");
  });
});
