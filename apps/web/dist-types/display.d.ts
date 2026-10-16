/**
 * The one canvas on the page, fitted to the window for whichever renderer is
 * active: a crisp integer-scaled framebuffer for the retro renderer, a
 * device-pixel-ratio-aware surface for the modern one. Renderers draw in
 * their own logical size; mouse positions are mapped back into it.
 */
export declare const canvas: HTMLCanvasElement;
export declare function configureDisplay(width: number, height: number, pixelated: boolean): void;
export declare function fitCanvas(): void;
/** Backing-store pixels per logical unit, for a renderer that draws straight onto the canvas. */
export declare function backingScale(): number;
/** Canvas event position in the active renderer's logical units. */
export declare function toLogical(e: MouseEvent): [number, number];
