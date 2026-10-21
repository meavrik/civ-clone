import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CIV_COLORS, TERRAIN_RULES, Terrain, UNIT_TYPES } from "@civ/core";
import {
  C,
  drawText,
  FEATURE_SHEET,
  RESOURCE_SHEET,
  specialSprite,
  getTile,
  ownerBox,
  PALETTE,
  parseSheet,
  PLAYER_COLORS,
  SHEETS,
  sheetFromImage,
  sheetImage,
  sheetText,
  shade,
  SPRITE_CLEAR,
  spriteSurface,
  stipple,
  Surface,
  TERRAIN_SHEET,
  UNIT_SHEET,
  unitSprite,
} from "../src/index.js";
import { encodePng } from "./png.js";
import { CITIZEN_SHEET, ICON_SHEET, ICONS } from "../src/index.js";
import { citizenSprite, CITIZEN_H, CITIZEN_W } from "../src/citizens.js";

const MOODS = ["happy", "content", "unhappy", "entertainer", "taxman", "scientist"] as const;

describe("sprite sheets", () => {
  it("cover every unit, terrain and special resource, plus cities, walls, villages and mines", () => {
    for (const t of UNIT_TYPES) expect(UNIT_SHEET.byName.has(t.id), t.id).toBe(true);
    for (const name of ["ocean", "grassland", "plains", "forest", "hills", "mountains", "desert", "tundra", "arctic", "swamp", "jungle"])
      expect(TERRAIN_SHEET.byName.has(name), name).toBe(true);
    for (const rule of Object.values(TERRAIN_RULES))
      for (const sp of [rule.special, rule.second]) if (sp) expect(specialSprite(sp.name), sp.name).not.toBeNull();
    for (const name of ["city", "walls", "hut", "mine"]) expect(FEATURE_SHEET.byName.has(name), name).toBe(true);
    // Every panel icon, at 8x8 so it sits in a line of text.
    expect(ICON_SHEET.size).toBe(8);
    for (const name of ICONS) expect(ICON_SHEET.byName.has(name), name).toBe(true);
    // Every mood and trade of citizen, in both looks.
    for (const mood of MOODS) for (const name of [mood, `${mood}-2`]) expect(CITIZEN_SHEET.byName.has(name), name).toBe(true);
  });

  it("dress each citizen in their own colours, the mood's clothes kept", () => {
    const man = citizenSprite("content", { woman: false, style: 0, skin: 0, hair: 0, legs: 0 });
    const other = citizenSprite("content", { woman: false, style: 0, skin: 5, hair: 4, legs: 3 });
    expect([man.width, man.height]).toEqual([CITIZEN_W, CITIZEN_H]);
    expect(man.data.includes(C.WHITE!)).toBe(true);
    expect(other.data.includes(C.WHITE!)).toBe(true);
    expect(Array.from(man.data).join()).not.toBe(Array.from(other.data).join());
    // No stand-in colour survives the swap (in colours that share no index with one).
    const standIns = [shade("flesh", 6), shade("flesh", 4), shade("earth", 1), shade("earth", 3), shade("grey", 2), shade("grey", 1)];
    for (const mood of MOODS) for (const woman of [false, true]) for (const style of [0, 1] as const) {
      const s = citizenSprite(mood, { woman, style, skin: 5, hair: 4, legs: 3 });
      for (const c of standIns) expect(s.data.includes(c), `${mood} ${woman} ${style}`).toBe(false);
    }
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
    // A unit stands free, outlined in near black, its cloth in the owner's colour.
    const legion = unitSprite("legion", C.LBLUE!);
    expect(legion.data.includes(C.STEEL!)).toBe(true);
    expect(legion.data.includes(C.LBLUE!)).toBe(true);
    expect(legion.data[0]).toBe(SPRITE_CLEAR);
  });

  it("dump a preview sheet for review", () => {
    const zoom = 4;
    const cols = 14;
    const units = UNIT_SHEET.sprites.map((s) => s.name);
    const unitRows = Math.ceil(units.length / cols);
    const features = FEATURE_SHEET.sprites.length;
    const resources = RESOURCE_SHEET.sprites.length;
    const height = 12 + unitRows * 2 * 18 + 12 + 18 + 12 + Math.ceil(features / cols) * 18 + 12 + Math.ceil(resources / cols) * 18 + 12 + 3 * 15 + 4;
    // As fine as the screen, so the terrain shows its fine pixels.
    const s = Surface.fine(cols * 18 + 4, height);
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
    TERRAIN_SHEET.sprites.forEach((t, i) => s.blit(spriteSurface(TERRAIN_SHEET, t.name)!, 2 + i * 18, y));
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
    y += Math.ceil(features / cols) * 18 + 2;
    drawText(s, 2, y, "Resources", C.WHITE!);
    y += 10;
    RESOURCE_SHEET.sprites.forEach((r, i) => {
      const x = 2 + (i % cols) * 18;
      const yy = y + Math.floor(i / cols) * 18;
      s.blit(getTile(Terrain.Grassland, 0, 0), x, yy);
      s.blit(spriteSurface(RESOURCE_SHEET, r.name)!, x, yy, SPRITE_CLEAR);
    });
    y += Math.ceil(resources / cols) * 18 + 2;
    drawText(s, 2, y, "Citizens (four looks to a mood)", C.WHITE!);
    y += 10;
    stipple(s, 0, y, s.width, 3 * 15, "panel");
    for (let row = 0; row < 3; row++)
      MOODS.forEach((mood, m) => [0, 1, 2, 3].forEach((k) => {
        const look = { woman: k % 2 === 1, style: k >= 2 ? 1 : 0, skin: (row * 2 + k) % 6, hair: (row * 3 + k + m) % 6, legs: (row + k) % 4 } as const;
        s.blit(citizenSprite(mood, look), 2 + (m * 4 + k) * 8 + m * 4, y + 1 + row * 15, SPRITE_CLEAR);
      }));
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/sprites.png", import.meta.url), encodePng(s, zoom));
    expect(s.data.length).toBeGreaterThan(0);
  });
});
