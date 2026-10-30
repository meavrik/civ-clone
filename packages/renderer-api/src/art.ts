import { CITY_ART } from "./city-art.js";
import { UNIT_ART } from "./unit-art.js";
import { animSheet, unitAnim } from "./unit-anim.js";
import type { UnitAtlas } from "./unit-atlas.js";

/**
 * The user's pictures of the improvements, wonders and spaceship parts (2026-10-24, asked for: "use the
 * attached images for game buildings"), shown as they are, never drawn into the palette: the apps lay each
 * over the canvas (`apps/web/src/buildings/<id>.webp`, the PNGs as supplied, WebP quality 92, alpha exact).
 * Each is `ART_SIZE` square, the building standing in it on clear ground; `BUILDING_ART` gives the box its
 * drawing fills (x, y, w, h, measured from the PNGs), so a screen fits the building, not its empty margin,
 * to a place. Every one of the 50 has one (Barracks, Granary and the Great Library came last, 2026-10-24);
 * the drawn pictures stay as the fallback for an id without one.
 */
export const ART_SIZE = 1254;

export const BUILDING_ART: Readonly<Record<string, readonly [number, number, number, number]>> = {
  apollo_program: [359, 70, 555, 1087],
  aqueduct: [39, 353, 1176, 627],
  automated_office: [272, 232, 711, 816],
  bank: [142, 186, 972, 889],
  barracks: [105, 334, 1044, 668],
  cathedral: [151, 155, 953, 980],
  cell_tower: [438, 115, 382, 1044],
  city_walls: [67, 371, 1121, 591],
  colosseum: [90, 334, 1075, 646],
  colossus: [422, 70, 399, 1113],
  component: [268, 181, 718, 898],
  copernicus: [233, 258, 789, 764],
  courthouse: [231, 244, 792, 807],
  cure_for_cancer: [180, 293, 894, 710],
  darwins_voyage: [191, 123, 873, 1015],
  data_center: [168, 223, 918, 782],
  factory: [176, 238, 902, 836],
  granary: [169, 261, 988, 818],
  great_library: [99, 130, 1057, 998],
  great_wall: [76, 342, 1102, 529],
  hanging_gardens: [148, 269, 981, 716],
  hoover_dam: [51, 370, 1153, 569],
  hydro_plant: [88, 379, 1115, 572],
  isaac_newtons: [147, 235, 1033, 810],
  js_bachs: [206, 185, 842, 884],
  library: [199, 295, 856, 666],
  lighthouse: [336, 107, 582, 1004],
  magellans: [293, 74, 669, 1104],
  manhattan_project: [224, 318, 861, 680],
  marketplace: [130, 403, 995, 547],
  mass_transit: [232, 253, 792, 732],
  mfg_plant: [95, 377, 1064, 547],
  michelangelos: [100, 336, 1054, 630],
  module: [69, 351, 1117, 613],
  nuclear_plant: [97, 365, 1087, 582],
  oracle: [321, 297, 713, 671],
  palace: [77, 313, 1100, 679],
  power_plant: [173, 252, 906, 808],
  pyramids: [51, 342, 1151, 603],
  quantum_lab: [138, 241, 979, 796],
  recycling_center: [68, 289, 1121, 695],
  sdi_defense: [211, 275, 834, 756],
  seti_program: [130, 96, 994, 1087],
  shakespeares: [65, 213, 1123, 946],
  solar_plant: [100, 491, 1055, 392],
  structural: [41, 104, 1172, 1048],
  temple: [135, 234, 985, 773],
  united_nations: [177, 237, 921, 820],
  university: [101, 58, 1052, 1105],
  womens_suffrage: [221, 298, 812, 658],
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
}

/**
 * The user's pictures of the units (2026-10-28, their sheet of all 29: "USE AS IS - DO NOT regenerate"), shown as
 * they are wherever a unit stands (`apps/web/src/units/<id>.png`, cut from the sheet pixel for pixel by
 * tools/sprites/units/cut.ts). One scale for all, `UNIT_SQUARE` of the sheet's pixels to a map square, so they keep
 * the sizes the sheet gives them; one that would not fit its square (the carrier, the tank, the phalanx's spear)
 * shrinks to fit. Each stands centred across on the square's foot, a fine pixel up, the aircraft (`ALOFT`) in
 * the middle, in flight. The sprites stay for anything without a picture.
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
  const [w, h] = size;
  const k = Math.min(1 / UNIT_SQUARE, UNIT_FIT / w, UNIT_FIT / h);
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

/** A spot as it lands where a screen copies its part at (`fromX`, `fromY`) to (`toX`, `toY`), `scale` times larger. */
export function moveArt(a: ArtSpot, fromX: number, fromY: number, toX: number, toY: number, scale = 1): ArtSpot {
  const at = (b: ArtBox): ArtBox => ({ x: toX + (b.x - fromX) * scale, y: toY + (b.y - fromY) * scale, w: b.w * scale, h: b.h * scale });
  return { ...a, ...at(a), ...(a.clip ? { clip: at(a.clip) } : {}), ...(a.holes ? { holes: a.holes.map(at) } : {}) };
}

/** The box the drawing of building `id`'s picture fills within its square, or null when it has no picture. */
export function buildingArt(id: string): ArtBox | null {
  const b = BUILDING_ART[id];
  return b ? { x: b[0], y: b[1], w: b[2], h: b[3] } : null;
}

/** No building's picture stands taller than this in the city view (the tallest drawn ones are 46). */
const LOT_MAX_H = 46;

/**
 * The room the picture of building `id` takes where its drawn picture (`pic`) would stand: the same
 * area, in the picture's own shape, never taller than the tallest drawn picture. Without a picture, `pic`'s.
 */
export function artLot(id: string, pic: { w: number; h: number }): { w: number; h: number } {
  const art = buildingArt(id);
  if (!art) return { w: pic.w, h: pic.h };
  const aspect = art.w / art.h;
  const h = Math.min(LOT_MAX_H, Math.sqrt((pic.w * pic.h) / aspect));
  return { w: Math.round(h * aspect), h: Math.round(h) };
}

/**
 * Where to lay the whole picture of building `spot.id` (its square) so that its drawing fills the
 * spot's box as large as it fits, shape kept: centred across, on the box's foot (or its middle).
 */
export function artPlace(spot: ArtSpot): ArtBox | null {
  if (spot.unit) return unitArtPlace(spot);
  if (spot.city) return cityArtPlace(spot);
  const art = buildingArt(spot.id);
  if (!art) return null;
  const k = Math.min(spot.w / art.w, spot.h / art.h);
  const left = spot.x + (spot.w - art.w * k) / 2;
  const top = spot.middle ? spot.y + (spot.h - art.h * k) / 2 : spot.y + spot.h - art.h * k;
  return { x: left - art.x * k, y: top - art.y * k, w: ART_SIZE * k, h: ART_SIZE * k };
}
