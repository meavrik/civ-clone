import { Surface } from "@civ/renderer-retro";
/** 320x200 indexed framebuffer -> integer-scaled canvas. */
export declare const canvas: HTMLCanvasElement;
export declare const screen: Surface;
export declare function fitCanvas(): void;
export declare function present(): void;
/** Canvas event position in framebuffer pixels. */
export declare function toScreen(e: MouseEvent): [number, number];
