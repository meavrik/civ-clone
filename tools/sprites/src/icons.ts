import { C, FEATURE_SHEET, ownerBox, PALETTE_RGBA, SPRITE_CLEAR, spriteSurface, Surface, TERRAIN_SHEET } from "@civ/renderer-retro";
import type { Image } from "./png.js";

/**
 * The mobile app's icon, drawn from the game's own sprites: a walled city on its square of
 * grassland, with `margin` retro pixels of sea round it (a maskable icon keeps its picture
 * inside the middle 80%).
 */
export function iconScene(margin: number): Surface {
  const size = 16 + 2 * margin;
  const s = Surface.fine(size, size);
  const ocean = spriteSurface(TERRAIN_SHEET, "ocean")!;
  for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) s.blit(ocean, x, y, SPRITE_CLEAR);
  const owner = C.WHITE!;
  s.blit(spriteSurface(TERRAIN_SHEET, "grassland")!, margin, margin, SPRITE_CLEAR);
  s.blit(ownerBox(owner), margin, margin, SPRITE_CLEAR);
  s.blit(spriteSurface(FEATURE_SHEET, "walls", owner)!, margin, margin, SPRITE_CLEAR);
  s.blit(spriteSurface(FEATURE_SHEET, "city", owner)!, margin, margin, SPRITE_CLEAR);
  return s;
}

/** A surface scaled to `px` square, nearest neighbour, opaque. */
export function iconImage(s: Surface, px: number): Image {
  const data = new Uint8Array(px * px * 4);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const p = s.fget(Math.floor((x * s.fw) / px), Math.floor((y * s.fh) / px)) * 4;
      data.set(PALETTE_RGBA.subarray(p, p + 3), (y * px + x) * 4);
      data[(y * px + x) * 4 + 3] = 255;
    }
  return { width: px, height: px, data };
}

/** Every icon the app's manifest and index.html name. */
export function appIcons(): { file: string; image: Image }[] {
  const plain = iconScene(2);
  const maskable = iconScene(6);
  return [
    { file: "icon-192.png", image: iconImage(plain, 192) },
    { file: "icon-512.png", image: iconImage(plain, 512) },
    { file: "maskable-512.png", image: iconImage(maskable, 512) },
    { file: "apple-touch-icon.png", image: iconImage(plain, 180) },
  ];
}
