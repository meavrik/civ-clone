import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CIV_COLORS, TERRAIN_RULES, Terrain, UNIT_TYPES } from "@civ/core";
import {
  C,
  drawText,
  FEATURE_SHEET,
  getTile,
  ownerBox,
  PALETTE,
  parseSheet,
  PLAYER_COLORS,
  SHEETS,
  sheetFromImage,
  sheetImage,
  sheetText,
  SPRITE_CLEAR,
  spriteSurface,
  Surface,
  TERRAIN_SHEET,
  UNIT_SHEET,
  unitSprite,
} from "../src/index.js";
import { encodePng } from "./png.js";
import { ICON_SHEET, ICONS } from "../src/index.js";

describe("sprite sheets", () => {
  it("cover every unit, terrain and special resource, plus cities, walls and villages", () => {
    for (const t of UNIT_TYPES) expect(UNIT_SHEET.byName.has(t.id), t.id).toBe(true);
    for (const name of ["ocean", "grassland", "plains", "forest", "hills", "mountains", "desert", "tundra", "arctic", "swamp", "jungle"])
      expect(TERRAIN_SHEET.byName.has(name), name).toBe(true);
    for (const rule of Object.values(TERRAIN_RULES)) if (rule.special) expect(FEATURE_SHEET.byName.has(rule.special.name.toLowerCase()), rule.special.name).toBe(true);
    for (const name of ["city", "walls", "hut"]) expect(FEATURE_SHEET.byName.has(name), name).toBe(true);
    // Every panel icon, at 8x8 so it sits in a line of text.
    expect(ICON_SHEET.size).toBe(8);
    for (const name of ICONS) expect(ICON_SHEET.byName.has(name), name).toBe(true);
  });

  it("round-trip through an image unchanged", () => {
    for (const sheet of Object.values(SHEETS)) expect(sheetFromImage(sheet, sheetImage(sheet))).toBe(sheetText(sheet));
  });

  it("reject a colour outside the palette, and say where", () => {
    const img = sheetImage(UNIT_SHEET);
    img.data.set([12, 34, 56, 255], (3 * img.width + 5) * 4); // settlers, pixel (5,3)
    expect(() => sheetFromImage(UNIT_SHEET, img)).toThrow(/settlers \(5,3\): #0c2238 is not in this sprite's palette/);
  });

  it("reject a character outside the legend, and say where", () => {
    const rows = Array.from({ length: 4 }, () => "....");
    rows[2] = "..q.";
    expect(() => parseSheet("test", 4, `@thing\n${rows.join("\n")}`, ["grass"])).toThrow(/test\/thing \(2,2\): 'q' is not in the sprite legend/);
    expect(() => parseSheet("test", 4, "@thing\n....\n....", ["grass"])).toThrow(/2 rows, expected 4/);
  });

  it("give every colour slot its own, clearly different colour", () => {
    expect(PLAYER_COLORS.length).toBe(CIV_COLORS.length);
    for (let i = 0; i < PLAYER_COLORS.length; i++)
      for (let j = i + 1; j < PLAYER_COLORS.length; j++) {
        const [a, b] = [PALETTE[PLAYER_COLORS[i]!]!, PALETTE[PLAYER_COLORS[j]!]!];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(d, `${CIV_COLORS[i]} vs ${CIV_COLORS[j]}`).toBeGreaterThan(110);
      }
  });

  it("paints owner colours and keeps black drawable", () => {
    const box = ownerBox(C.LGREEN!);
    expect(box.get(1, 1)).toBe(C.BLACK);
    expect(box.get(5, 5)).toBe(C.LGREEN);
    expect(box.get(0, 0)).toBe(SPRITE_CLEAR);
    const legion = unitSprite("legion", C.LBLUE!);
    expect(legion.data.includes(C.BLACK!)).toBe(true);
    expect(legion.data.includes(C.LBLUE!)).toBe(true);
  });

  it("dump a preview sheet for review", () => {
    const zoom = 4;
    const cols = 14;
    const units = UNIT_SHEET.sprites.map((s) => s.name);
    const unitRows = Math.ceil(units.length / cols);
    const terrains = TERRAIN_SHEET.sprites.length;
    const features = FEATURE_SHEET.sprites.length;
    const height = 12 + unitRows * 2 * 18 + 12 + 18 + 12 + Math.ceil(features / cols) * 18 + 4;
    const s = new Surface(cols * 18 + 4, height);
    s.fill(C.DGREY!);
    let y = 2;
    drawText(s, 2, y, "Units (two civilizations)", C.WHITE!);
    y += 10;
    for (const owner of [PLAYER_COLORS[0]!, PLAYER_COLORS[2]!]) {
      units.forEach((u, i) => s.blit(unitSprite(u, owner), 2 + (i % cols) * 18, y + Math.floor(i / cols) * 18, SPRITE_CLEAR));
      y += unitRows * 18;
    }
    y += 2;
    drawText(s, 2, y, "Terrain", C.WHITE!);
    y += 10;
    for (let t = 0; t < terrains; t++) s.blit(getTile(t as Terrain, 0, 0), 2 + t * 18, y);
    y += 18 + 2;
    drawText(s, 2, y, "Features", C.WHITE!);
    y += 10;
    FEATURE_SHEET.sprites.forEach((f, i) => {
      const x = 2 + (i % cols) * 18;
      const yy = y + Math.floor(i / cols) * 18;
      s.blit(getTile(Terrain.Grassland, 0, 0), x, yy);
      if (f.name === "city" || f.name === "walls") s.blit(ownerBox(PLAYER_COLORS[1]!), x, yy, SPRITE_CLEAR);
      s.blit(spriteSurface(FEATURE_SHEET, f.name, PLAYER_COLORS[1]!)!, x, yy, SPRITE_CLEAR);
    });
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/sprites.png", import.meta.url), encodePng(s, zoom));
    expect(s.data.length).toBeGreaterThan(0);
  });
});
