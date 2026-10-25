import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CIV_COLORS, TERRAIN_RULES, Terrain, UNIT_TYPES } from "@civ/core";
import {
  C,
  CITY_SHEET,
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
  it("cover every unit, terrain and special resource, plus cities of every age and size, walls, villages and mines", () => {
    for (const t of UNIT_TYPES) expect(UNIT_SHEET.byName.has(t.id), t.id).toBe(true);
    for (const name of ["ocean", "grassland", "plains", "forest", "hills", "mountains", "desert", "tundra", "arctic", "swamp", "jungle"])
      expect(TERRAIN_SHEET.byName.has(name), name).toBe(true);
    for (const rule of Object.values(TERRAIN_RULES))
      for (const sp of [rule.special, rule.second]) if (sp) expect(specialSprite(sp.name), sp.name).not.toBeNull();
    for (const name of ["walls", "walls_front", "hut", "mine"]) expect(FEATURE_SHEET.byName.has(name), name).toBe(true);
    // A city for every age and size, flying its owner's flag.
    for (const era of ["ancient", "medieval", "industrial"])
      for (const tier of ["village", "town", "city", "capital"]) {
        const name = `${era}-${tier}`;
        expect(CITY_SHEET.byName.has(name), name).toBe(true);
        expect(CITY_SHEET.byName.get(name)!.rows.join("").includes("P"), `${name} flag`).toBe(true);
      }
    // Every panel icon, at 8x8 so it sits in a line of text.
    expect(ICON_SHEET.size / ICON_SHEET.k).toBe(8); // as tall as a line of text, in screen pixels
    for (const name of ICONS) expect(ICON_SHEET.byName.has(name), name).toBe(true);
    // Every mood and trade of citizen, a man and a woman (the user's sheet).
    expect([...CITIZEN_SHEET.byName.keys()]).toEqual(MOODS.flatMap((m) => [`${m}-m`, `${m}-f`]));
  });

  it("draw every citizen from the user's sheet, a man or a woman for each mood and trade, the skin in their tone", () => {
    const look = (woman: boolean, skin: number) => ({ woman, style: 0, skin, hair: 0, legs: 0 }) as const;
    const pixels = (s: Surface) => Array.from(s.data).join();
    const fair = citizenSprite("content", look(false, 0));
    const deep = citizenSprite("content", look(false, 5));
    expect([fair.width, fair.height]).toEqual([CITIZEN_W, CITIZEN_H]);
    // The sheet's own skin, then each tone in its place: the clothes stay, only the skin changes.
    expect(fair.data.includes(shade("flesh", 6))).toBe(true);
    for (const c of [shade("flesh", 6), shade("flesh", 5), shade("flesh", 4)]) expect(deep.data.includes(c)).toBe(false);
    expect(deep.data.includes(shade("skin", 7))).toBe(true);
    const skins = new Set<number>([...[0, 1, 2, 3, 4, 5, 6].map((n) => shade("flesh", n)), shade("skin", 7), shade("skin", 4), shade("hide", 1)]);
    for (let i = 0; i < fair.data.length; i++) if (!skins.has(fair.data[i]!)) expect(deep.data[i]).toBe(fair.data[i]);
    expect(new Set([0, 1, 2, 3, 4, 5].map((n) => pixels(citizenSprite("content", look(false, n))))).size).toBe(6);
    // A woman is her own figure; hair, trousers and style play no part.
    expect(pixels(citizenSprite("content", look(true, 0)))).not.toBe(pixels(fair));
    expect(pixels(citizenSprite("content", { woman: false, style: 1, skin: 0, hair: 4, legs: 3 }))).toBe(pixels(fair));
    // Each mood or trade dressed in its own colour, outlined in the sheet's dark brown, never black.
    const bodies = new Set<number>();
    for (const mood of MOODS)
      for (const woman of [false, true]) {
        const s = citizenSprite(mood, look(woman, 0));
        expect(s.data.includes(C.BLACK!), mood).toBe(false);
        expect(s.data.includes(shade("skin", 0)), mood).toBe(true);
        // The clothes: the commonest colour after the clear, the outline and the skin.
        const counts = new Map<number, number>();
        for (const c of s.data) if (c !== SPRITE_CLEAR && c !== shade("skin", 0) && !skins.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
        if (!woman) bodies.add([...counts].sort((a, b) => b[1] - a[1])[0]![0]);
      }
    expect(bodies.size).toBe(MOODS.length);
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
    rows[2] = "..m.";
    expect(() => parseSheet("test", 4, `@thing\n${rows.join("\n")}`, ["grass"])).toThrow(/test\/thing \(2,2\): 'm' is not in the sprite legend/);
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
    drawText(s, 2, y, "Citizens (a man and a woman to a mood, two skins each)", C.WHITE!);
    y += 10;
    stipple(s, 0, y, s.width, 3 * 15, "panel");
    for (let row = 0; row < 3; row++)
      MOODS.forEach((mood, m) => [0, 1, 2, 3].forEach((k) => {
        const look = { woman: k % 2 === 1, style: k >= 2 ? 1 : 0, skin: (row * 2 + k) % 6, hair: (row * 3 + k + m) % 6, legs: (row + k) % 4 } as const;
        s.blit(citizenSprite(mood, look), 1 + (m * 4 + k) * 10 + m * 2, y + 1 + row * 15, SPRITE_CLEAR);
      }));
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    writeFileSync(new URL("./out/sprites.png", import.meta.url), encodePng(s, zoom));
    expect(s.data.length).toBeGreaterThan(0);
  });
});
