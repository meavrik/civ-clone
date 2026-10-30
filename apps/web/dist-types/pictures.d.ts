import { type GameState } from "@civ/core";
import { type ArtBox, type ArtSpot } from "@civ/renderer-api";
export interface PicturePlace {
    url: string;
    /** Where it goes on the canvas, in logical pixels of a canvas `logicalW` by `logicalH`. */
    x: number;
    y: number;
    w: number;
    h: number;
    logicalW: number;
    logicalH: number;
    /** "fill": the box is the picture's own shape; "contain": the whole picture, its shape kept, standing on the box's foot. */
    fit: "fill" | "contain";
    /** Stacking among the pictures: a higher one covers a lower (the city view's front rows cover its back ones). */
    z?: number;
    /** Ringed in light (the building last clicked in the city view). */
    glow?: boolean;
    /** How much of it stands, from its foot up, 0..1: a wonder rising in the city view; absent, whole. */
    reveal?: number;
    /** Darkened, as the screen it stands on is under a window. */
    dim?: boolean;
    /** Shaded as the map shades what is out of sight (a city there; `UNSEEN`, each colour at 62%). */
    unseen?: boolean;
    /** Only what lies inside this box (logical pixels, as `x`..`h`) shows: a unit at the map view's edge. */
    clip?: ArtBox;
    /** Where it lets what is drawn under it show through (logical pixels): a unit's shield, rank, orders. */
    holes?: ArtBox[];
    /** Tipped this many degrees about its foot (a ship going down), nothing of it showing below `water` (logical pixels down). */
    turn?: number;
    water?: number;
    /** Drawn pixel for pixel, never smoothed (an animated unit's frames), at whole screen pixels. */
    pixelated?: boolean;
    /** Mirrored, facing left (a unit, `UnitFacing`). */
    flip?: boolean;
}
/** The audience picture of civilization `player`'s leader, at a box of the canvas; null if it has none. */
export declare function scenePlace(state: GameState, player: number, box: Omit<PicturePlace, "url" | "fit">): PicturePlace | null;
/** A setup portrait (a ruler or a leader, by name) in a box of the canvas, whole and standing on its foot. */
export declare function portraitPlace(name: string, box: Omit<PicturePlace, "url" | "fit">): PicturePlace;
/** The picture of an advance for the New Technology window, whole in a box of the canvas; null if it has none. */
export declare function techPlace(id: string, box: Omit<PicturePlace, "url" | "fit">): PicturePlace | null;
/**
 * The pictures of buildings and units a drawn screen left spots for (`Surface.art`), back to front, on a
 * canvas `logicalW` by `logicalH` whose screen starts `dx` across; none showing past the screen (a list of
 * units running off it).
 */
export declare function buildingPlaces(spots: ArtSpot[], screen: {
    dx: number;
    logicalW: number;
    logicalH: number;
}): PicturePlace[];
/** Fetch the pictures of what the player's cities are building, so a Building Completed window never waits for one. */
export declare function preloadBuildings(state: GameState): void;
/** Fetch the picture of the advance under research before it is found, so its window never waits for it. */
export declare function preloadTech(id: string | null | undefined): void;
/**
 * Fetch and decode the pictures of every unit as a game starts or loads, so no unit waits for its own; and
 * make the animated units' frames in the colours of the game's civilizations, a few at a time.
 */
export declare function preloadUnits(state: GameState): void;
/** Fetch and decode the pictures of the cities as a game starts or loads (twelve: three ages by four sizes). */
export declare function preloadCities(): void;
/** Fetch and decode the audience pictures of a game's leaders as it starts, so an audience never waits for one. */
export declare function preloadScenes(state: GameState): void;
/** Show these pictures over `canvas` and no others. Call once a frame; it changes the page only where something moved. */
export declare function showPictures(canvas: HTMLCanvasElement, places: PicturePlace[]): void;
