import { BUILDING_CUTS } from "./building-art.js";
import { CITY_ART } from "./city-art.js";
import { wonderStages } from "./wonder-stages.js";
import { HUT_ART } from "./hut-art.js";
import { RESOURCE_ART } from "./resource-art.js";
import { workArtPlace } from "./work-pictures.js";
import { UNIT_ART } from "./unit-art.js";
import { animSheet, unitAnim } from "./unit-anim.js";
import type { UnitAtlas } from "./unit-atlas.js";

/**
 * The user's pictures of the improvements, wonders and spaceship parts, shown as they are, never drawn into the palette:
 * the apps lay each over the canvas. Every one of the 51 has one; the drawn pictures stay as the fallback for an id
 * without one. The 27 improvements and 21 wonders are cuts of the user's sheets of them since 2026-11-04 (asked for:
 * "replace all building images with attached sprite-sheet"): `apps/web/src/buildings/<id>.png`, every pixel the sheet's,
 * cut by tools/sprites/buildings/cut.ts, their sizes in `BUILDING_CUTS`, the wonders with the stages of their construction
 * (`wonderStages`). The spaceship parts keep the first pictures (2026-10-24: "use the attached images for game buildings"):
 * `apps/web/src/buildings/<id>.webp`, the PNGs as supplied, WebP quality 92, alpha exact, each `ART_SIZE` square, the
 * part standing in it on clear ground; `BUILDING_ART` gives the box its drawing fills (x, y, w, h, measured from the
 * PNGs), so a screen fits the part, not its empty margin, to a place.
 */
export const ART_SIZE = 1254;
export { BUILDING_CUTS };

/**
 * Units still waiting for the user's pictures (added 2026-11-01, save version 53): the map shows each as its letters
 * on its owner's box (renderer-retro `UNIT_ABBR`) until they come. All four came the same day (the archer's, the war
 * elephant's, the explorer's and the fishing boat's), so none waits now.
 */
export const UNIT_PICTURES_WANTED: readonly string[] = [];

/** Improvements still waiting for the user's picture: their drawn one (`PICTURES`) stands in. The Harbour's came with the sheet of 2026-11-04, so none waits now. */
export const BUILDING_PICTURES_WANTED: readonly string[] = [];

export const BUILDING_ART: Readonly<Record<string, readonly [number, number, number, number]>> = {
  component: [268, 181, 718, 898],
  module: [69, 351, 1117, 613],
  structural: [41, 104, 1172, 1048],
};

export interface ArtBox { x: number; y: number; w: number; h: number }

/**
 * A place a screen leaves for a user's picture of a building (`Surface.art` in the retro renderer, the
 * apps lay the picture there): its drawing fills the box, shape kept, standing on its foot (`middle`:
 * centred up and down), `lit` ringed in light (the building last clicked in the city view).
 */
export interface ArtSpot extends ArtBox {
  id: string;
  /** A unit's picture (`unitArt`), not a building's: the box is its square, where it stands (`unitArtPlace`). */
  unit?: boolean;
  /** A city's picture on its square (`cityArt`, the id its age and size, "ancient-village"), standing as `cityArtPlace` puts it. */
  city?: boolean;
  /** A tribal village's picture on its square (`hutArt`, the id its kind, "thatch"), standing as `hutArtPlace` puts it. */
  hut?: boolean;
  /** A tile improvement's picture on its square (`workArt`, the id a `WorkPicture`, "mine"), as `workArtPlace` puts it. */
  work?: boolean;
  /** A resource's picture (`resourceArt`, the id its icon's name, "horses"), the box the room its icon takes, as `resourceArtPlace` puts it. */
  resource?: boolean;
  /** Out of sight: shaded as the map shades the squares it does not see now (`UNSEEN`, each colour at 62%). */
  unseen?: boolean;
  /** Only what lies inside shows: the map's view, for a unit at its edge. */
  clip?: ArtBox;
  /** Where the marks drawn on the canvas under the picture show through it (a unit's shield, rank, orders). */
  holes?: ArtBox[];
  /** A ship going down: tipped this many degrees (clockwise; negative lifts the bow) about the foot of its picture... */
  turn?: number;
  /** ...and nothing of it showing below this line (screen pixels down), its waterline. */
  water?: number;
  /** An animated unit's frame of its atlas (`UNIT_ATLASES`; its idle one when absent)... */
  frame?: number;
  /** ...and the colour its clothes take (its owner's, a palette index). */
  owner?: number;
  /** Facing left: the picture mirrored (an animated unit's about the anchor its feet stand on, any other's about its middle). */
  flip?: boolean;
  middle?: boolean;
  lit?: boolean;
  /** How much of the picture stands, from the ground up, 0..1: a wonder rising in the city view (absent: whole). */
  reveal?: number;
  /** Darkened with the screen it stands on, under a window (`dimScreen`). */
  dim?: boolean;
  /** Darkened to this share of its light, 0..1 (a unit supported away from its city, in the city screen's units box). */
  dark?: number;
  /** A faint gold glow traced round it, 0..1 how bright (the unit in play, `ACTIVE_GLOW`); absent: none. */
  contour?: number;
  /** How much of it shows, 0..1 (the unit in play blinking, `activeOpacity`); absent: whole. */
  opacity?: number;
}

/**
 * The user's pictures of the units (2026-10-28, their sheet of all 29: "USE AS IS - DO NOT regenerate"), shown as
 * they are wherever a unit stands (`apps/web/src/units/<id>.png`, cut from the sheet pixel for pixel by
 * tools/sprites/units/cut.ts). One scale for all, `UNIT_SQUARE` of the sheet's pixels to a map square, so they keep
 * the sizes the sheet gives them; one that would not fit its square (the carrier, the tank, the phalanx's spear)
 * shrinks to fit. A unit added since comes as a picture of its own, drawn at a size of its own, so with its own scale
 * (`UNIT_ART`'s third number: the archer's 1400, the war elephant's 1250, the explorer's and the fishing boat's 1600). Each stands centred across on the square's foot, a fine pixel up,
 * the aircraft (`ALOFT`) in the middle, in flight. The sprites stay for anything without a picture.
 */
export const UNIT_SQUARE = 240;
/** The share of its square a picture may fill, either way. */
const UNIT_FIT = 0.97;
/** The gap under a unit's feet, as a share of its square (a fine pixel). */
const UNIT_FOOT = 1 / 32;
const ALOFT = new Set(["fighter", "bomber"]);

/** Whether unit type `id` has a picture of the user's (or its moves, `unitAnim`). */
export function unitArt(id: string): boolean {
  return id in UNIT_ART || unitAnim(id) !== null;
}

/**
 * Where unit `spot.id`'s picture goes in its square (the spot's box). An animated unit's frame: its atlas's canvas
 * (`animSheet`: the unit's own, or one of its rule's `sheets`) at that atlas's scale, the anchor every frame there
 * stands on (the militia's front foot, the middle of a grid sheet's cell on its ground) placed where that atlas's
 * home frame (the unit's idle one, a further sheet's first) stands centred in the square on its foot, as any unit's
 * picture; the same box for every frame of an atlas, so only the drawing moves.
 */
export function unitArtPlace(spot: ArtSpot): ArtBox | null {
  const anim = unitAnim(spot.id);
  const sheet = anim ? animSheet(spot.id, spot.frame ?? anim.rule.idle) : null;
  if (sheet) return animPlace(spot, sheet.square, sheet.atlas, sheet.home);
  const size = UNIT_ART[spot.id];
  if (!size) return null;
  const [w, h, square = UNIT_SQUARE] = size;
  const k = Math.min(1 / square, UNIT_FIT / w, UNIT_FIT / h);
  const fw = w * k, fh = h * k;
  const top = ALOFT.has(spot.id) ? (1 - fh) / 2 : 1 - UNIT_FOOT - fh;
  return { x: spot.x + ((1 - fw) / 2) * spot.w, y: spot.y + top * spot.h, w: fw * spot.w, h: fh * spot.h };
}

function animPlace(spot: ArtSpot, square: number, atlas: UnitAtlas, home: number): ArtBox {
  const k = spot.w / square;
  const idle = atlas.frames[home]!;
  // The feet's place mirrors with the picture, so a unit turning round stands where its idle drawing was centred.
  const off = (atlas.anchor[0] - (idle.box[0] + idle.box[2] / 2)) * k;
  const footX = spot.x + spot.w / 2 + (spot.flip ? -off : off);
  const footY = spot.y + spot.h * (1 - UNIT_FOOT);
  // Mirrored about the feet: the canvas's room right of the anchor now lies left of it.
  const left = (spot.flip ? atlas.size[0] - atlas.anchor[0] : atlas.anchor[0]) * k;
  return { x: footX - left, y: footY - atlas.anchor[1] * k, w: atlas.size[0] * k, h: atlas.size[1] * k };
}

/**
 * The user's pictures of the cities (2026-10-29, their sheet of twelve, three ages by four sizes: "USE AS IS!!! DO NOT
 * regenerate"), shown as they are wherever a city stands (`apps/web/src/cities/<era>-<tier>.png`, cut from the sheet
 * pixel for pixel by tools/sprites/cities/cut.ts), by `cityLook`. One scale for all, the sheet's cell to a map square
 * (`CITY_SQUARE` of its pixels), so a village stands smaller than a capital as the sheet draws them; each centred across
 * on the square's foot, a fine pixel up, as a unit stands. The drawn icons stay for anything without a picture.
 */
export const CITY_SQUARE = 362;
export { CITY_ART };

/** Whether the city look `id` ("ancient-village") has a picture of the user's. */
export function cityArt(id: string): boolean {
  return id in CITY_ART;
}

/** Where city picture `spot.id` goes on its square (the spot's box). */
export function cityArtPlace(spot: ArtSpot): ArtBox | null {
  const size = CITY_ART[spot.id];
  if (!size) return null;
  const [w, h] = size;
  const k = Math.min(1 / CITY_SQUARE, UNIT_FIT / w, UNIT_FIT / h);
  const fw = w * k, fh = h * k;
  return { x: spot.x + ((1 - fw) / 2) * spot.w, y: spot.y + (1 - UNIT_FOOT - fh) * spot.h, w: fw * spot.w, h: fh * spot.h };
}

/**
 * The user's pictures of the tribal villages (2026-11-02, their sheet of five huts), shown as they are where a village
 * lies (`apps/web/src/huts/<kind>.png`, cut from the sheet pixel for pixel by tools/sprites/huts/cut.ts), the kind
 * by the land (`hutKind`). One scale for all, `HUT_SQUARE` of the sheet's pixels to a map square: a hut stands 0.7 of
 * its square across, a little wider than a city's village (the ancient one is 0.57 of its square), so a village is
 * easy to find among the resources (0.6 was easy to miss); centred across on the square's foot, a fine pixel up, as a
 * city stands. The drawn huts stay for anything without a picture.
 */
export const HUT_SQUARE = 500;
export { HUT_ART };

/** Whether the village kind `id` ("thatch") has a picture of the user's. */
export function hutArt(id: string): boolean {
  return id in HUT_ART;
}

/** Where village picture `spot.id` goes on its square (the spot's box). */
export function hutArtPlace(spot: ArtSpot): ArtBox | null {
  const size = HUT_ART[spot.id];
  if (!size) return null;
  const [w, h] = size;
  const k = Math.min(1 / HUT_SQUARE, UNIT_FIT / w, UNIT_FIT / h);
  const fw = w * k, fh = h * k;
  return { x: spot.x + ((1 - fw) / 2) * spot.w, y: spot.y + (1 - UNIT_FOOT - fh) * spot.h, w: fw * spot.w, h: fh * spot.h };
}

/**
 * The user's pictures of the resources (2026-11-03, their updated sheet: "USE AS IS!! do not regenerate assets"; before,
 * their sheets were drawn into the palette), shown as they are wherever a resource lies (`apps/web/src/resources/<id>.png`,
 * cut from the sheet pixel for pixel by tools/sprites/resources/cut.ts; Ivory, whose cell it left empty, is gone from the
 * game). One scale for all, the sheet's cell (`RESOURCE_CELL` of its pixels across) to the room an icon takes
 * on its square (the spot's box: `SPECIAL_SHARE` of the square in renderer-retro, at least the original's square), so
 * they keep the sizes the sheet gives them; each centred in it.
 */
export const RESOURCE_CELL = 256;
export { RESOURCE_ART };

/** Whether the resource icon `id` ("horses", "offshore_oil") has a picture of the user's. */
export function resourceArt(id: string): boolean {
  return id in RESOURCE_ART;
}

/** Where resource picture `spot.id` goes in its room (the spot's box). */
export function resourceArtPlace(spot: ArtSpot): ArtBox | null {
  const size = RESOURCE_ART[spot.id];
  if (!size) return null;
  const k = spot.w / RESOURCE_CELL;
  const w = size[0] * k, h = size[1] * k;
  return { x: spot.x + (spot.w - w) / 2, y: spot.y + (spot.h - h) / 2, w, h };
}

/** A spot as it lands where a screen copies its part at (`fromX`, `fromY`) to (`toX`, `toY`), `scale` times larger. */
export function moveArt(a: ArtSpot, fromX: number, fromY: number, toX: number, toY: number, scale = 1): ArtSpot {
  const at = (b: ArtBox): ArtBox => ({ x: toX + (b.x - fromX) * scale, y: toY + (b.y - fromY) * scale, w: b.w * scale, h: b.h * scale });
  return { ...a, ...at(a), ...(a.clip ? { clip: at(a.clip) } : {}), ...(a.holes ? { holes: a.holes.map(at) } : {}) };
}

/** The box the drawing of building `id`'s picture fills within it (a sheet's cut: all of it), or null when it has no picture. */
export function buildingArt(id: string): ArtBox | null {
  const cut = BUILDING_CUTS[id];
  if (cut) return { x: 0, y: 0, w: cut[0], h: cut[1] };
  const b = BUILDING_ART[id];
  return b ? { x: b[0], y: b[1], w: b[2], h: b[3] } : null;
}

/** No building's picture stands taller than this in the city view (the tallest drawn ones are 46). */
const LOT_MAX_H = 46;
/** The tallest picture of a wonder with stages (the Lighthouse's), which stands `LOT_MAX_H` high. */
const WONDER_TALLEST = Math.max(...Object.keys(BUILDING_CUTS).filter((id) => wonderStages(id).length).map((id) => BUILDING_CUTS[id]![1]));

/**
 * The room the picture of building `id` takes where its drawn picture (`pic`) would stand: the same
 * area, in the picture's own shape, never taller than the tallest drawn picture. Without a picture, `pic`'s.
 * A wonder with stages stands at one scale for all, keeping the sizes its sheet gives it (a drawn picture's area
 * brought the Colossus down from 44 high to 33, about the size of a temple).
 */
export function artLot(id: string, pic: { w: number; h: number }): { w: number; h: number } {
  const art = buildingArt(id);
  if (!art) return { w: pic.w, h: pic.h };
  if (wonderStages(id).length) return { w: Math.round((art.w * LOT_MAX_H) / WONDER_TALLEST), h: Math.round((art.h * LOT_MAX_H) / WONDER_TALLEST) };
  const aspect = art.w / art.h;
  const h = Math.min(LOT_MAX_H, Math.sqrt((pic.w * pic.h) / aspect));
  return { w: Math.round(h * aspect), h: Math.round(h) };
}

/**
 * Where to lay the whole picture of building `spot.id` (its square, or a sheet's cut) so that its drawing fills
 * the spot's box as large as it fits, shape kept: centred across, on the box's foot (or its middle).
 */
export function artPlace(spot: ArtSpot): ArtBox | null {
  if (spot.unit) return unitArtPlace(spot);
  if (spot.city) return cityArtPlace(spot);
  if (spot.hut) return hutArtPlace(spot);
  if (spot.work) return workArtPlace(spot);
  if (spot.resource) return resourceArtPlace(spot);
  const art = buildingArt(spot.id);
  if (!art) return null;
  const k = Math.min(spot.w / art.w, spot.h / art.h);
  const left = spot.x + (spot.w - art.w * k) / 2;
  const top = spot.middle ? spot.y + (spot.h - art.h * k) / 2 : spot.y + spot.h - art.h * k;
  const [w, h] = BUILDING_CUTS[spot.id] ?? [ART_SIZE, ART_SIZE];
  return { x: left - art.x * k, y: top - art.y * k, w: w * k, h: h * k };
}
