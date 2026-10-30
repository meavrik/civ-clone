/**
 * The game's sound (asked for 2026-10-27): short effects and a looping tune, all made in the browser with the
 * Web Audio API from oscillators and noise, on notes of our own, so nothing is downloaded or recorded. Silent
 * until the first key, click or touch (browsers allow sound only then). Sound and Music are switches in
 * Game > Options, kept per browser. Nothing here touches the game: the app calls `play` as things happen.
 */
export type Sfx = "click" | "deny" | "found" | "built" | "wonder" | "tech" | "clash" | "hit" | "boom" | "triumph" | "lament" | "war" | "turn" | "gift" | "meet" | "sink";
/** A note of an effect: when it starts (s), its pitch (MIDI number), length, wave and loudness; `to` slides the pitch there. */
export interface Tone {
    at: number;
    note: number;
    dur: number;
    wave: OscillatorType;
    vol: number;
    to?: number;
}
/** A burst of noise: when, how long, how loud, and how dark (a low-pass cut-off in Hz). */
export interface Hiss {
    at: number;
    dur: number;
    vol: number;
    cut: number;
}
export interface SfxRecipe {
    tones?: Tone[];
    hiss?: Hiss[];
}
/** Each effect, as data. Notes are MIDI numbers (60 middle C). */
export declare const SFX: Readonly<Record<Sfx, SfxRecipe>>;
/**
 * The tune under the map (ours): two eight-bar halves in D dorian, a square-wave lead in eighths over a
 * triangle bass in quarters, about 94 beats a minute; it loops. null is a rest; a note held is repeated as -1.
 */
export declare const TUNE: {
    /** Seconds an eighth note lasts. */
    readonly step: 0.32;
    readonly lead: readonly (number | null)[];
    /** A quarter note each: two lead steps. */
    readonly bass: readonly (number | null)[];
};
/** A note's pitch in Hz (MIDI 69 is A 440). */
export declare function hz(note: number): number;
/** How long an effect lasts, in seconds. */
export declare function sfxLength(r: SfxRecipe): number;
/** The sound of the game: effects on `play`, the tune while music is on and the page is shown. */
export declare class GameSound {
    sound: boolean;
    music: boolean;
    private ctx;
    private sfxOut;
    private musicOut;
    private noise;
    /** The next step of the tune to schedule, and when it starts. */
    private nextStep;
    private nextAt;
    private timer;
    constructor();
    /** Start the audio on a key, click or touch (the first one that lets the browser play), and hush it while the page is hidden. */
    attach(target: Window): void;
    setSound(on: boolean): void;
    setMusic(on: boolean): void;
    /** An effect, now (nothing while the sound is off or not yet allowed). */
    play(name: Sfx): void;
    private save;
    private unlock;
    private tone;
    private hiss;
    private startTune;
    private stopTune;
    private scheduleTune;
}
