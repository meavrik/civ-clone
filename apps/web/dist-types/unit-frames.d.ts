/**
 * Frame `frame` of `unit` in owner colour `owner` (a palette index; none, or a unit shown as drawn: the magenta as
 * drawn), as an image URL; null while its atlas loads.
 */
export declare function unitFrameUrl(unit: string, frame: number, colour: number | undefined): string | null;
/**
 * Make every frame of the animated units in these owner colours ahead of need, a few at a time between the
 * game's frames, handing each to `ready` (the web app decodes it there), so no move waits for its picture.
 */
export declare function prepareUnitFrames(owners: readonly number[], ready: (url: string) => void): void;
