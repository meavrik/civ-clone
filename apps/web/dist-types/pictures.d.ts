import { type GameState } from "@civ/core";
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
}
/** The audience picture of civilization `player`'s leader, at a box of the canvas; null if it has none. */
export declare function scenePlace(state: GameState, player: number, box: Omit<PicturePlace, "url" | "fit">): PicturePlace | null;
/** A setup portrait (a ruler or a leader, by name) in a box of the canvas, whole and standing on its foot. */
export declare function portraitPlace(name: string, box: Omit<PicturePlace, "url" | "fit">): PicturePlace;
/** The picture of an advance for the New Technology window, whole in a box of the canvas; null if it has none. */
export declare function techPlace(id: string, box: Omit<PicturePlace, "url" | "fit">): PicturePlace | null;
/** Fetch the picture of the advance under research before it is found, so its window never waits for it. */
export declare function preloadTech(id: string | null | undefined): void;
/** Fetch and decode the audience pictures of a game's leaders as it starts, so an audience never waits for one. */
export declare function preloadScenes(state: GameState): void;
/** Show these pictures over `canvas` and no others. Call once a frame; it changes the page only where something moved. */
export declare function showPictures(canvas: HTMLCanvasElement, places: PicturePlace[]): void;
