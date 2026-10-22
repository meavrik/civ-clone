import { type GameState } from "@civ/core";
/** The picture's name for civilization `player`, if its leader has one. */
export declare function sceneOf(state: GameState, player: number): string | undefined;
/** Fetch the pictures of a game's leaders as it starts, so an audience never waits for one. */
export declare function preloadScenes(state: GameState): void;
export interface ScenePlace {
    name: string;
    /** Where it goes on the canvas, in logical pixels of a canvas `logicalW` by `logicalH`. */
    x: number;
    y: number;
    w: number;
    h: number;
    logicalW: number;
    logicalH: number;
}
/** Show the picture at its place over `canvas`, or hide it (null). Call once a frame; it changes the page only when something moved. */
export declare function showScene(canvas: HTMLCanvasElement, at: ScenePlace | null): void;
