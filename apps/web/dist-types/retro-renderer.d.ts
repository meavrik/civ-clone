import type { Renderer } from "@civ/renderer-api";
/**
 * The 1991-style renderer behind the screen API: an indexed framebuffer laid out on 320x200,
 * its terrain twice as fine (640x400 canvas pixels), blitted through the palette.
 */
export declare function createRetroRenderer(canvas: HTMLCanvasElement): Renderer;
