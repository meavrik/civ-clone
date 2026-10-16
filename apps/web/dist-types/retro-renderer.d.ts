import type { Renderer } from "@civ/renderer-api";
/** The 1991-style renderer behind the screen API: a 320x200 indexed framebuffer blitted through the palette. */
export declare function createRetroRenderer(canvas: HTMLCanvasElement): Renderer;
