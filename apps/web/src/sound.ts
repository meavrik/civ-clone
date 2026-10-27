/**
 * The game's sound (asked for 2026-10-27): short effects and a looping tune, all made in the browser with the
 * Web Audio API from oscillators and noise, on notes of our own, so nothing is downloaded or recorded. Silent
 * until the first key, click or touch (browsers allow sound only then). Sound and Music are switches in
 * Game > Options, kept per browser. Nothing here touches the game: the app calls `play` as things happen.
 */

export type Sfx =
  | "click" | "deny" | "found" | "built" | "wonder" | "tech" | "clash" | "hit" | "boom"
  | "triumph" | "lament" | "war" | "turn" | "gift" | "meet" | "sink";

/** A note of an effect: when it starts (s), its pitch (MIDI number), length, wave and loudness; `to` slides the pitch there. */
export interface Tone { at: number; note: number; dur: number; wave: OscillatorType; vol: number; to?: number }
/** A burst of noise: when, how long, how loud, and how dark (a low-pass cut-off in Hz). */
export interface Hiss { at: number; dur: number; vol: number; cut: number }
export interface SfxRecipe { tones?: Tone[]; hiss?: Hiss[] }

/** A run of notes, one after another, each `step` seconds. */
function run(notes: number[], step: number, wave: OscillatorType, vol: number, last = step * 2): Tone[] {
  return notes.map((note, i) => ({ at: i * step, note, dur: i === notes.length - 1 ? last : step * 0.9, wave, vol }));
}

/** Each effect, as data. Notes are MIDI numbers (60 middle C). */
export const SFX: Readonly<Record<Sfx, SfxRecipe>> = {
  click: { tones: [{ at: 0, note: 84, dur: 0.03, wave: "square", vol: 0.06 }] },
  deny: { tones: [{ at: 0, note: 50, to: 45, dur: 0.16, wave: "square", vol: 0.08 }] },
  found: { tones: run([72, 76, 79, 84], 0.07, "triangle", 0.18) },
  built: { tones: [...run([67, 72], 0.1, "square", 0.07, 0.3), ...run([60, 64], 0.1, "triangle", 0.12, 0.3)] },
  wonder: { tones: [...run([60, 64, 67, 72, 76, 79, 84], 0.09, "square", 0.07, 0.6), ...run([48, 55, 60], 0.21, "triangle", 0.14, 0.6)] },
  tech: { tones: run([88, 95, 100], 0.06, "triangle", 0.14, 0.25) },
  clash: { tones: [{ at: 0, note: 45, dur: 0.06, wave: "square", vol: 0.08 }], hiss: [{ at: 0, dur: 0.12, vol: 0.18, cut: 2400 }] },
  hit: { hiss: [{ at: 0, dur: 0.06, vol: 0.16, cut: 3500 }] },
  boom: { tones: [{ at: 0, note: 40, to: 28, dur: 0.4, wave: "square", vol: 0.1 }], hiss: [{ at: 0, dur: 0.45, vol: 0.24, cut: 700 }] },
  triumph: { tones: [...run([72, 76, 79, 84, 79, 84], 0.11, "square", 0.07, 0.5), ...run([48, 52, 55, 60], 0.165, "triangle", 0.13, 0.5)] },
  lament: { tones: run([69, 65, 62, 57], 0.24, "triangle", 0.16, 0.7) },
  war: { tones: run([50, 50, 45], 0.14, "square", 0.08, 0.4), hiss: [0, 0.14, 0.28].map((at) => ({ at, dur: 0.1, vol: 0.14, cut: 500 })) },
  turn: { tones: run([72, 67], 0.08, "triangle", 0.1, 0.18) },
  gift: { tones: run([83, 88, 91], 0.05, "triangle", 0.12, 0.2) },
  meet: { tones: run([62, 69, 74], 0.12, "square", 0.06, 0.4) },
  // A ship going down: a splash, then the hull's groan falling away under bubbling water.
  sink: {
    tones: [{ at: 0.05, note: 50, to: 31, dur: 1.2, wave: "triangle", vol: 0.16 }, ...run([74, 71, 77, 72], 0.17, "triangle", 0.05, 0.08).map((t) => ({ ...t, at: t.at + 0.45 }))],
    hiss: [{ at: 0, dur: 0.35, vol: 0.2, cut: 1600 }, { at: 0.3, dur: 0.9, vol: 0.1, cut: 500 }],
  },
};

/**
 * The tune under the map (ours): two eight-bar halves in D dorian, a square-wave lead in eighths over a
 * triangle bass in quarters, about 94 beats a minute; it loops. null is a rest; a note held is repeated as -1.
 */
export const TUNE = {
  /** Seconds an eighth note lasts. */
  step: 0.32,
  lead: [
    74, null, 77, 81, 79, -1, 77, 76, 74, null, 76, 77, 72, -1, -1, null,
    74, null, 77, 81, 84, -1, 83, 81, 79, null, 76, 77, 74, -1, -1, null,
    81, null, 79, 77, 76, -1, 74, 72, 74, null, 77, 79, 81, -1, -1, null,
    84, null, 81, 79, 77, -1, 76, 72, 74, null, 76, 72, 74, -1, -1, null,
  ] as readonly (number | null)[],
  /** A quarter note each: two lead steps. */
  bass: [
    50, 45, 50, 45, 48, 43, 48, 43, 50, 45, 50, 45, 48, 43, 50, null,
    41, 48, 41, 48, 48, 43, 48, 43, 50, 45, 50, 45, 45, 52, 50, null,
  ] as readonly (number | null)[],
} as const;

/** A note's pitch in Hz (MIDI 69 is A 440). */
export function hz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** How long an effect lasts, in seconds. */
export function sfxLength(r: SfxRecipe): number {
  return Math.max(0, ...(r.tones ?? []).map((t) => t.at + t.dur), ...(r.hiss ?? []).map((h) => h.at + h.dur));
}

const STORE = "epochs.sound";

/** The switches, kept per browser (both on unless turned off). */
function loadSwitches(): { sound: boolean; music: boolean } {
  try {
    const raw = localStorage.getItem(STORE);
    const v = raw ? (JSON.parse(raw) as { sound?: boolean; music?: boolean }) : {};
    return { sound: v.sound !== false, music: v.music !== false };
  } catch {
    return { sound: true, music: true };
  }
}

/** The sound of the game: effects on `play`, the tune while music is on and the page is shown. */
export class GameSound {
  sound: boolean;
  music: boolean;
  private ctx: AudioContext | null = null;
  private sfxOut: GainNode | null = null;
  private musicOut: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** The next step of the tune to schedule, and when it starts. */
  private nextStep = 0;
  private nextAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const s = loadSwitches();
    this.sound = s.sound;
    this.music = s.music;
  }

  /** Start the audio on a key, click or touch (the first one that lets the browser play), and hush it while the page is hidden. */
  attach(target: Window): void {
    const wake = () => this.unlock();
    for (const kind of ["pointerdown", "keydown", "touchend"] as const) target.addEventListener(kind, wake, { capture: true });
    target.document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (target.document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  setSound(on: boolean): void {
    this.sound = on;
    this.save();
  }

  setMusic(on: boolean): void {
    this.music = on;
    this.save();
    if (on) this.startTune();
    else this.stopTune();
  }

  /** An effect, now (nothing while the sound is off or not yet allowed). */
  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.sound || !this.sfxOut || ctx.state !== "running") return;
    const r = SFX[name];
    const t0 = ctx.currentTime + 0.01;
    for (const t of r.tones ?? []) this.tone(this.sfxOut, t0 + t.at, t.note, t.dur, t.wave, t.vol, t.to);
    for (const h of r.hiss ?? []) this.hiss(t0 + h.at, h.dur, h.vol, h.cut);
  }

  private save(): void {
    try { localStorage.setItem(STORE, JSON.stringify({ sound: this.sound, music: this.music })); } catch { /* storage may be blocked: the switch lasts the session */ }
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.sfxOut = ctx.createGain();
      this.sfxOut.gain.value = 0.9;
      this.sfxOut.connect(ctx.destination);
      this.musicOut = ctx.createGain();
      this.musicOut.gain.value = 0.55;
      this.musicOut.connect(ctx.destination);
      const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = n.getChannelData(0);
      // Noise from a fixed hash, so no Math.random (the sound never touches the game, but stays reproducible).
      let x = 0x9e3779b9;
      for (let i = 0; i < data.length; i++) {
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        data[i] = ((x >>> 0) / 0xffffffff) * 2 - 1;
      }
      this.noise = n;
    }
    if (this.ctx.state !== "running") void this.ctx.resume().then(() => { if (this.music) this.startTune(); });
    else if (this.music) this.startTune();
  }

  private tone(out: AudioNode, at: number, note: number, dur: number, wave: OscillatorType, vol: number, to?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(hz(note), at);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(hz(to), at + dur);
    // A quick attack and a decay to silence, so notes never click.
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private hiss(at: number, dur: number, vol: number, cut: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cut;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(env).connect(this.sfxOut!);
    src.start(at);
    src.stop(at + dur + 0.02);
  }

  private startTune(): void {
    const ctx = this.ctx;
    if (!ctx || this.timer !== null || ctx.state !== "running") return;
    this.musicOut!.gain.cancelScheduledValues(ctx.currentTime);
    this.musicOut!.gain.setValueAtTime(0.55, ctx.currentTime);
    this.nextAt = ctx.currentTime + 0.1;
    // Schedule a little ahead, a few times a second (timers wander; the audio clock does not).
    this.timer = setInterval(() => this.scheduleTune(), 120);
    this.scheduleTune();
  }

  private stopTune(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    if (ctx && this.musicOut) {
      this.musicOut.gain.cancelScheduledValues(ctx.currentTime);
      this.musicOut.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
    }
  }

  private scheduleTune(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOut || ctx.state !== "running") return;
    const { step, lead, bass } = TUNE;
    if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + 0.05; // after a hidden spell: pick up from now
    while (this.nextAt < ctx.currentTime + 0.6) {
      const i = this.nextStep % lead.length;
      const note = lead[i];
      if (note !== null && note !== undefined && note >= 0) {
        // Held through the steps marked -1 after it.
        let held = 1;
        while (lead[(i + held) % lead.length] === -1) held++;
        this.tone(this.musicOut, this.nextAt, note, step * held * 0.92, "square", 0.035);
      }
      if (i % 2 === 0) {
        const b = bass[(i / 2) % bass.length];
        if (b !== null && b !== undefined) this.tone(this.musicOut, this.nextAt, b, step * 1.8, "triangle", 0.09);
      }
      this.nextStep++;
      this.nextAt += step;
    }
  }
}
