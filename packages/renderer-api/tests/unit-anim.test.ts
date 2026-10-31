import { describe, expect, it } from "vitest";
import { createUnit, newGame, type UnitAction, type UnitBattle } from "@civ/core";
import {
  animFrameCount, animSheet, attackStep, FOUNDING, foundingMoment, foundingShow, isOwnerMagenta, motionMs, MotionPlayer, shotOf, strikeMs, travelMs, WALK_CHAIN_MS, LUNGE_MS, recolourOwner, sequenceStep, showFrame, UNIT_ANIMS, UNIT_ATLASES, unitArtPlace, UnitAnimator,
  type BattleFighter, type BattleFrame,
} from "../src/index.js";

const rule = UNIT_ANIMS.militia!;
const atlas = UNIT_ATLASES.militia!;

describe("the militia's atlas", () => {
  it("has the 14 frames in their order, every drawing whole on one canvas, every front foot on its anchor", () => {
    expect(atlas.frames.map((f) => f.name)).toEqual([
      "ready", "anticipation", "wind-up", "strike", "follow-through", "recovery",
      "sentry-1", "sentry-2", "sentry-3", "sentry-4",
      "standing", "lowering", "kneeling", "defensive-hold",
    ]);
    const [w, h] = atlas.size;
    for (const f of atlas.frames) {
      const [x, y, bw, bh] = f.box;
      // Nothing clipped: the drawing, club and all, inside the canvas.
      expect(x, f.name).toBeGreaterThanOrEqual(0);
      expect(y, f.name).toBeGreaterThanOrEqual(0);
      expect(x + bw, f.name).toBeLessThanOrEqual(w);
      expect(y + bh, f.name).toBeLessThanOrEqual(h);
      // The drawing stands where the sheet had it round its anchor: translated, never scaled.
      const [sx, sy] = [f.source[0] + 2, f.source[1] + 2];
      expect([x - atlas.anchor[0], y - atlas.anchor[1]], f.name).toEqual([sx - f.anchor[0], sy - f.anchor[1]]);
      // The feet stand on the anchor's line.
      expect(y + bh, f.name).toBe(atlas.anchor[1]);
    }
    // The sequences name frames the atlas has.
    for (const n of [...rule.attack.frames, ...rule.sentry.frames, ...rule.fortify.frames, rule.idle, rule.fortified]) expect(atlas.frames[n]).toBeDefined();
  });

  it("stands every frame in the same place in its square, so only the drawing moves", () => {
    const boxes = atlas.frames.map((_, frame) => unitArtPlace({ id: "militia", unit: true, x: 100, y: 50, w: 16, h: 16, frame }));
    for (const b of boxes) expect(b).toEqual(boxes[0]);
    // The idle frame's drawing centred across the square, its feet a fine pixel above the square's foot.
    const b = boxes[0]!;
    const k = b.w / atlas.size[0];
    const idle = atlas.frames[rule.idle]!;
    expect(b.x + (idle.box[0] + idle.box[2] / 2) * k).toBeCloseTo(108, 6);
    expect(b.y + atlas.anchor[1] * k).toBeCloseTo(50 + 16 * (31 / 32), 6);
  });
});

describe("the militia's walk", () => {
  const walk = UNIT_ATLASES["militia-travel"]!;

  it("numbers its six frames on after the militia's own fourteen, each in register on its cell", () => {
    expect(walk.frames.map((f) => f.name)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `travel-${n}`));
    expect(animFrameCount("militia")).toBe(26);
    expect(animSheet("militia", 13)).toMatchObject({ id: "militia", frame: 13 });
    expect(animSheet("militia", 14)).toMatchObject({ id: "militia-travel", frame: 0, square: UNIT_ANIMS["militia-travel"]!.square, home: 0 });
    expect(animSheet("militia", 19)).toMatchObject({ id: "militia-travel", frame: 5 });
    expect(animSheet("militia", 20)).toMatchObject({ id: "militia-won", frame: 0 });
    expect(animSheet("militia", 25)).toMatchObject({ id: "militia-won", frame: 5 });
    expect(animSheet("militia", 26)).toBeNull();
    expect([...rule.travel!.frames].sort((a, b) => a - b)).toEqual([14, 15, 16, 17, 18, 19]);
    walk.frames.forEach((f, n) => expect(f.anchor[0], f.name).toBe((n % 3) * 512 + 256));
  });

  it("walks the size the militia stands, the first step centred in its square on the same foot", () => {
    // Drawn larger: 1.74 times as tall upright (425 pixels to the sentry's 244), its head 1.58 times (95 to 60); scaled between.
    const larger = UNIT_ANIMS["militia-travel"]!.square / rule.square;
    expect(larger).toBeGreaterThan(95 / 60);
    expect(larger).toBeLessThan(425 / 244);
    const at = (frame: number) => unitArtPlace({ id: "militia", unit: true, x: 100, y: 50, w: 16, h: 16, frame })!;
    const b = at(14);
    const k = b.w / walk.size[0];
    const first = walk.frames[0]!;
    expect(b.x + (first.box[0] + first.box[2] / 2) * k).toBeCloseTo(108, 6);
    expect(b.y + walk.anchor[1] * k).toBeCloseTo(50 + 16 * (31 / 32), 6);
    // Every step in the same box; the militia's own frames in theirs.
    for (const f of [15, 16, 17, 18, 19]) expect(at(f)).toEqual(b);
    expect(at(6)).not.toEqual(b);
  });

  it("is played while the militia steps across the map, then it stands again", () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    const m = createUnit(state, "militia", 0, u.x, u.y, null);
    const anim = new UnitAnimator();
    expect(anim.update(state, undefined, 0).frames[m.id]).toBe(rule.idle);
    const seen = new Set<number>();
    for (let t = 100; t < 1000; t += 20) seen.add(anim.update(state, undefined, t, [{ unit: m.id }]).frames[m.id]!);
    expect([...seen].sort((a, b) => a - b)).toEqual([14, 15, 16, 17, 18, 19]);
    expect(anim.update(state, undefined, 1100).frames[m.id]).toBe(rule.idle);
  });
});

describe("the militia winning a fight", () => {
  const fighter = (unit: number, type: string, dying = 0): BattleFighter => ({ unit, type, owner: 0, x: 0, y: 0, hp: 10, maxHp: 10, xp: 0, stacked: false, hit: 0, dying });
  const setup = () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    const m = createUnit(state, "militia", 0, u.x, u.y, null);
    return { state, m, anim: new UnitAnimator() };
  };

  it("has the sheet's six frames, numbered on after the walk; losing, it has none (it bursts as any unit)", () => {
    expect(UNIT_ATLASES["militia-won"]!.frames.map((f) => f.name)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `won-${n}`));
    expect(rule.won!.frames).toEqual([20, 21, 22, 23, 24, 25]);
    expect(UNIT_ATLASES["militia-lost"]).toBeUndefined();
  });

  it("celebrates as its foe falls, through to the end even once the fight is over, then back to its orders", () => {
    const { state, m, anim } = setup();
    anim.update(state, undefined, 0);
    const fight = (dying: number): BattleFrame => ({ attacker: fighter(m.id, "militia"), defender: fighter(999, "legion", dying), start: 1000, heading: 1 });
    anim.update(state, fight(0), 1000);
    expect(rule.attack!.frames).toContain(anim.update(state, fight(0), 1400).frames[m.id]);
    // The legion begins to burst: the militia raises its club.
    expect(anim.update(state, fight(0.1), 1500).frames[m.id]).toBe(20);
    const won = rule.won!.ms.reduce((a, b) => a + b, 0);
    const seen: number[] = [];
    for (let t = 1500; t < 1500 + won; t += 20) seen.push(anim.update(state, t < 1950 ? fight(0.5) : undefined, t).frames[m.id]!);
    expect(new Set(seen)).toEqual(new Set([20, 21, 22, 23, 24, 25]));
    expect(seen.at(-1)).toBe(25);
    expect(anim.update(state, undefined, 1500 + won + 20).frames[m.id]).toBe(rule.idle);
  });

  it("keeps the frames it stands in while it loses: the burst takes it", () => {
    const { state, m, anim } = setup();
    anim.update(state, undefined, 0);
    const fight = (dying: number): BattleFrame => ({ attacker: fighter(999, "legion"), defender: fighter(m.id, "militia", dying), start: 1000, heading: -1 });
    anim.update(state, fight(0), 1000);
    for (let t = 1500; t < 2000; t += 20) expect(rule.attack!.frames).toContain(anim.update(state, fight(0.2), t).frames[m.id]);
  });
});

describe("the settlers' atlas", () => {
  const settlers = UNIT_ATLASES.settlers!;
  const move = UNIT_ANIMS.settlers!;

  it("has the sheet's 24 frames in its rows, each standing in register: its cell's middle on its row's ground", () => {
    expect(settlers.frames.map((f) => f.name)).toEqual(["travel", "road", "irrigate", "mine"].flatMap((m) => [1, 2, 3, 4, 5, 6].map((n) => `${m}-${n}`)));
    const [w, h] = settlers.size;
    settlers.frames.forEach((f, n) => {
      const [x, y, bw, bh] = f.box;
      // Nothing clipped: raised mallet and pick, flying dirt, inside the canvas.
      expect(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h, f.name).toBe(true);
      // Translated, never scaled.
      expect([x - settlers.anchor[0], y - settlers.anchor[1]], f.name).toEqual([f.source[0] + 2 - f.anchor[0], f.source[1] + 2 - f.anchor[1]]);
      // The middle of its 256-pixel cell, the feet on or a pixel above the ground.
      expect(f.anchor[0], f.name).toBe((n % 6) * 256 + 128);
      expect(settlers.anchor[1] - (y + bh), f.name).toBeLessThanOrEqual(1);
    });
    for (const n of [...Object.values(move.work!).flatMap((s) => s.frames), move.idle]) expect(settlers.frames[n]).toBeDefined();
  });

  it("plays each row for its job, the sheet's colours as drawn", () => {
    const rows = (seq: { frames: number[] }) => seq.frames.map((f) => settlers.frames[f]!.name.split("-")[0]);
    const work = move.work!;
    for (const job of ["road", "railroad", "fortress"] as const) expect(new Set(rows(work[job]!)), job).toEqual(new Set(["road"]));
    for (const job of ["irrigate", "clean"] as const) expect(new Set(rows(work[job]!)), job).toEqual(new Set(["irrigate"]));
    expect(new Set(rows(work.mine!))).toEqual(new Set(["mine"]));
    expect(move.ownerColour).toBe(false);
    expect(move.attack ?? move.sentry ?? move.fortify).toBeUndefined();
  });

  it("stands the walking family where the still picture of the settlers stood, a little more than three quarters of a square tall", () => {
    const b = unitArtPlace({ id: "settlers", unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    const k = b.w / settlers.size[0];
    const idle = settlers.frames[move.idle]!;
    expect(b.x + (idle.box[0] + idle.box[2] / 2) * k).toBeCloseTo(8, 6);
    expect((idle.box[3] * k) / 16).toBeCloseTo(189 / 240, 1);
  });
});

describe("the settlers' walk", () => {
  const settlers = UNIT_ATLASES.settlers!;
  const walk = UNIT_ATLASES["settlers-travel"]!;
  const move = UNIT_ANIMS.settlers!;

  it("numbers its six frames on after the settlers' own 24, each translated whole, the bodies in register", () => {
    expect(walk.frames.map((f) => f.name)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `travel-${n}`));
    expect(animFrameCount("settlers")).toBe(30);
    expect(animSheet("settlers", 23)).toMatchObject({ id: "settlers", frame: 23 });
    expect(animSheet("settlers", 24)).toMatchObject({ id: "settlers-travel", frame: 0, square: UNIT_ANIMS["settlers-travel"]!.square, home: 0 });
    expect(animSheet("settlers", 29)).toMatchObject({ id: "settlers-travel", frame: 5 });
    expect(animSheet("settlers", 30)).toBeNull();
    expect([...move.travel!.frames].sort((a, b) => a - b)).toEqual([24, 25, 26, 27, 28, 29]);
    expect(move.travel!.frames.at(-1)).toBe(24);
    const [w, h] = walk.size;
    walk.frames.forEach((f, n) => {
      const [x, y, bw, bh] = f.box;
      expect(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h, f.name).toBe(true);
      expect([x - walk.anchor[0], y - walk.anchor[1]], f.name).toEqual([f.source[0] + 2 - f.anchor[0], f.source[1] + 2 - f.anchor[1]]);
      expect(walk.anchor[1] - (y + bh), f.name).toBeLessThanOrEqual(2);
      // Within a few dozen pixels of its 512-pixel cell's middle: the passing steps drawn ahead in theirs, set back.
      expect(Math.abs(f.anchor[0] - ((n % 3) * 512 + 256)), f.name).toBeLessThanOrEqual(30);
    });
  });

  it("walks the size the family stands, the first step centred in its square", () => {
    // Drawn larger: the people 1.8 to 1.84 times as tall as on the first sheet, the whole 1.76 times; scaled by the people.
    const larger = UNIT_ANIMS["settlers-travel"]!.square / move.square;
    expect(larger).toBeGreaterThan(walk.frames[0]!.box[3] / settlers.frames[0]!.box[3]);
    expect(larger).toBeLessThanOrEqual(1.84);
    const at = (frame: number) => unitArtPlace({ id: "settlers", unit: true, x: 100, y: 50, w: 16, h: 16, frame })!;
    const b = at(24);
    const k = b.w / walk.size[0];
    const first = walk.frames[0]!;
    expect(b.x + (first.box[0] + first.box[2] / 2) * k).toBeCloseTo(108, 6);
    // Every step in the same box; the settlers' own frames in theirs.
    for (const f of [25, 26, 27, 28, 29]) expect(at(f)).toEqual(b);
    expect(at(0)).not.toEqual(b);
  });

  it("is played while the settlers step across the map, then they stand again", () => {
    const state = newGame(2026);
    const s = state.units.find((u) => u.type === "settlers")!;
    const anim = new UnitAnimator();
    expect(anim.update(state, undefined, 0).frames[s.id]).toBe(move.idle);
    const seen = new Set<number>();
    for (let t = 100; t < 1000; t += 20) seen.add(anim.update(state, undefined, t, [{ unit: s.id }]).frames[s.id]!);
    expect([...seen].sort((a, b) => a - b)).toEqual([24, 25, 26, 27, 28, 29]);
    expect(anim.update(state, undefined, 1100).frames[s.id]).toBe(move.idle);
  });
});

describe("the phalanx's atlas", () => {
  const hoplite = UNIT_ATLASES.phalanx!;
  const move = UNIT_ANIMS.phalanx!;
  const frame = (name: string) => hoplite.frames.findIndex((f) => f.name === name);

  it("has the sheet's 24 frames in its rows, each translated whole onto its canvas, the feet on the ground", () => {
    expect(hoplite.frames.map((f) => f.name)).toEqual([
      ...[1, 2, 3, 4, 5, 6].map((n) => `travel-${n}`),
      "ready", "anticipation", "wind-up", "strike", "follow-through", "recovery",
      ...[1, 2, 3, 4, 5, 6].map((n) => `won-${n}`),
      "sentry-1", "sentry-2", "sentry-3", "lowering", "kneeling", "shield-wall",
    ]);
    const [w, h] = hoplite.size;
    hoplite.frames.forEach((f) => {
      const [x, y, bw, bh] = f.box;
      // Nothing clipped: the spear thrust out, raised and levelled, inside the canvas.
      expect(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h, f.name).toBe(true);
      // Translated, never scaled.
      expect([x - hoplite.anchor[0], y - hoplite.anchor[1]], f.name).toEqual([f.source[0] + 2 - f.anchor[0], f.source[1] + 2 - f.anchor[1]]);
      // On its row's ground, within a few pixels (the row's lowest point may be a spear's butt or the shield's rim).
      expect(hoplite.anchor[1] - (y + bh), f.name).toBeLessThanOrEqual(4);
    });
  });

  it("is put in register where the sheet set it awry: the thrust keeps its feet, the walk its body", () => {
    // On the sheet the strike stands 38 pixels behind the ready stance in its cell and the follow-through 35 ahead.
    const cellMiddle = (n: number) => (n % 6) * 256 + 128;
    const off = (name: string) => hoplite.frames[frame(name)]!.anchor[0] - cellMiddle(frame(name));
    expect(off("strike") - off("ready")).toBe(-38);
    expect(off("follow-through") - off("ready")).toBe(35);
    // The walk drifted back over its steps: set straight.
    expect(off("travel-1") - off("travel-6")).toBe(27);
    // The kneel is drawn in register behind its shield: left as the sheet has it.
    for (const name of ["lowering", "kneeling", "shield-wall"]) expect(off(name), name).toBe(0);
  });

  it("plays each row for its move, the sheet's colours as drawn", () => {
    const row = (frames: number[]) => new Set(frames.map((f) => Math.floor(f / 6)));
    expect(row(move.travel!.frames)).toEqual(new Set([0]));
    expect(row(move.attack!.frames)).toEqual(new Set([1]));
    expect(hoplite.frames[move.attack!.frames[move.attack!.impact]!]!.name).toBe("strike");
    expect(row(move.won!.frames)).toEqual(new Set([2]));
    expect(move.sentry!.frames.map((f) => hoplite.frames[f]!.name)).toEqual(["sentry-1", "sentry-2", "sentry-3"]);
    expect(move.fortify!.frames.map((f) => hoplite.frames[f]!.name)).toEqual(["lowering", "kneeling", "shield-wall"]);
    expect([hoplite.frames[move.idle]!.name, hoplite.frames[move.fortified!]!.name]).toEqual(["sentry-1", "shield-wall"]);
    expect(move.ownerColour).toBe(false);
    expect(travelMs("phalanx")).toBe(480);
  });

  it("stands the size of the phalanx's still picture in its square, centred in it", () => {
    const b = unitArtPlace({ id: "phalanx", unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    const k = b.w / hoplite.size[0];
    const idle = hoplite.frames[move.idle]!;
    expect(b.x + (idle.box[0] + idle.box[2] / 2) * k).toBeCloseTo(8, 6);
    // Crest to feet, 209 pixels here and 198 in the still picture, which is shrunk to fit its square (0.97 of its 277).
    expect(209 / move.square).toBeCloseTo(198 / (277 / 0.97), 1);
  });
});

describe("the catapult's atlas", () => {
  const catapult = UNIT_ATLASES.catapult!;
  const move = UNIT_ANIMS.catapult!;
  const frame = (name: string) => catapult.frames.find((f) => f.name === name)!;

  it("has the sheet's 24 frames in the one sheet's rows, put in register by the wheels: each near its cell's middle on its row's ground", () => {
    expect(catapult.frames.map((f) => f.name)).toEqual([
      ...[1, 2, 3, 4, 5, 6].map((n) => `travel-${n}`),
      "ready", "anticipation", "wind-up", "strike", "follow-through", "recovery",
      ...[1, 2, 3, 4, 5, 6].map((n) => `won-${n}`),
      "sentry-1", "sentry-2", "sentry-3", "fortify-1", "fortify-2", "fortify-3",
    ]);
    const [w, h] = catapult.size;
    catapult.frames.forEach((f, n) => {
      const [x, y, bw, bh] = f.box;
      expect(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h, f.name).toBe(true);
      // The cart drawn a little off from cell to cell, its wheels laid on the standing frame's (the cutter's `align`).
      expect(Math.abs(f.anchor[0] - ((n % 6) * 256 + 128)), f.name).toBeLessThanOrEqual(16);
      expect(f.anchor[1], f.name).toBe(catapult.frames[n - (n % 6)]!.anchor[1]);
    });
    // The stone loosed on the release flies off with its trail, lying across the next cell's edge: kept with the
    // release (its source reaching past the edge and up to the stone), not the frame after it.
    const [rx, ry, rw] = frame("follow-through").source;
    expect(rx + rw).toBeGreaterThan(1280 + 16);
    expect(ry).toBeLessThanOrEqual(276);
    expect(frame("recovery").source[1]).toBeGreaterThan(305);
  });

  it("plays the one sheet's moves, between as wide and as much of its square as the catapult's picture stood", () => {
    expect(move).toMatchObject({ idle: 18, fortified: 23, ownerColour: false, attack: { frames: [6, 7, 8, 9, 10, 11], impact: 4 } });
    expect(move.travel!.frames).toEqual(UNIT_ANIMS.phalanx!.travel!.frames);
    const b = unitArtPlace({ id: "catapult", unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    const k = b.w / catapult.size[0];
    const idle = catapult.frames[move.idle]!;
    expect(b.x + (idle.box[0] + idle.box[2] / 2) * k).toBeCloseTo(8, 6);
    // The still picture: 192x197 of 240 a square; the sheet's lower and longer.
    const across = (idle.box[2] * k) / 16, area = (idle.box[2] * idle.box[3] * k * k) / 256;
    expect(across).toBeGreaterThan(192 / 240);
    expect(area).toBeLessThan((192 * 197) / 240 / 240);
  });
});

describe("the settlers founding a city", () => {
  const found = UNIT_ATLASES["settlers-found"]!;

  it("has the sheet's six frames, each standing in register", () => {
    expect(found.frames.map((f) => f.name)).toEqual(["lift", "raise", "plant", "unfurl", "fly", "cheer"]);
    const [w, h] = found.size;
    found.frames.forEach((f, n) => {
      const [x, y, bw, bh] = f.box;
      expect(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h, f.name).toBe(true);
      expect([x - found.anchor[0], y - found.anchor[1]], f.name).toEqual([f.source[0] + 2 - f.anchor[0], f.source[1] + 2 - f.anchor[1]]);
      expect(f.anchor[0], f.name).toBe((n % 3) * 512 + 256);
    });
  });

  it("makes a moment of it: the view glides in, the flag goes up, light breaks once it unfurls, the name stands, then a hold", () => {
    const show = foundingShow("settlers")!;
    const rule = UNIT_ANIMS[show.id]!;
    const showMs = rule.show!.ms.reduce((a, b) => a + b, 0);
    expect(show).toEqual({ id: "settlers-found", ms: FOUNDING.leadMs + showMs + FOUNDING.holdMs });
    expect(foundingShow("militia")).toBeNull();
    const at = (ms: number) => foundingMoment(show.id, ms);
    // The glide: nothing yet at the start, all the way in by its end, the first frame meanwhile.
    expect(at(0)).toEqual({ frame: 0, zoom: 0, glory: 0, title: 0, done: false });
    expect(at(FOUNDING.zoomMs).zoom).toBe(1);
    expect(at(FOUNDING.leadMs - 1).frame).toBe(0);
    // Each frame in turn from the lead, the light from the unfurling, the name from the cheer.
    const starts = rule.show!.ms.map((_, n) => FOUNDING.leadMs + rule.show!.ms.slice(0, n).reduce((a, b) => a + b, 0));
    expect(starts.map((t) => at(t + 1).frame)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(at(starts[3]! - 1).glory).toBe(0);
    expect(at(starts[3]! + FOUNDING.riseMs).glory).toBe(1);
    expect(at(starts[5]! - 1).title).toBe(0);
    expect(at(starts[5]! + FOUNDING.riseMs).title).toBe(1);
    // Held on the cheer, then over.
    expect(at(show.ms - 1)).toMatchObject({ frame: 5, done: false });
    expect(at(show.ms).done).toBe(true);
    // The frames by themselves, as the preview plays them.
    expect([0, 500, 950, 1450, 2000, 2650, 9000].map((t) => showFrame(show.id, t))).toEqual([0, 1, 2, 3, 4, 5, 5]);
  });

  it("stands the family as tall as the settlers who walked in, though the sheet draws them larger", () => {
    // The woman: 257 pixels on this sheet, 159 on the walking one.
    expect(UNIT_ANIMS["settlers-found"]!.square / UNIT_ANIMS.settlers!.square).toBeCloseTo(257 / 159, 1);
  });
});

describe("animation timing", () => {
  it("steps through a sequence by elapsed time, looping or holding its last", () => {
    const ms = rule.sentry.ms;
    expect(sequenceStep(ms, 0, true).step).toBe(0);
    expect(sequenceStep(ms, ms[0]! - 1, true).step).toBe(0);
    expect(sequenceStep(ms, ms[0]!, true).step).toBe(1);
    const total = ms.reduce((a, b) => a + b, 0);
    expect(sequenceStep(ms, total + 1, true)).toEqual({ step: 0, done: false });
    expect(sequenceStep(rule.fortify.ms, 10_000, false)).toEqual({ step: 3, done: true });
  });

  it("lands the strike with the fight's first blow, the frames before it sharing the lunge", () => {
    expect(attackStep(rule, LUNGE_MS - 1, LUNGE_MS).step).toBe(rule.attack.impact - 1);
    expect(attackStep(rule, LUNGE_MS, LUNGE_MS).step).toBe(rule.attack.impact);
    // Without a fight (the preview) each frame keeps its own timing: the strike after 320 ms.
    expect(attackStep(rule, 319).step).toBe(2);
    expect(attackStep(rule, 320).step).toBe(3);
  });
});

describe("UnitAnimator", () => {
  const setup = () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    const m = createUnit(state, "militia", 0, u.x, u.y, null);
    return { state, m, anim: new UnitAnimator() };
  };
  const fighter = (unit: number, type: string): BattleFighter => ({ unit, type, owner: 0, x: 0, y: 0, hp: 10, maxHp: 10, xp: 0, stacked: false, hit: 0, dying: 0 });

  it("stands idle on the first sentry frame, loops on sentry, and holds still however often it is drawn", () => {
    const { state, m, anim } = setup();
    expect(anim.update(state, undefined, 0).frames[m.id]).toBe(rule.idle);
    expect(anim.update(state, undefined, 5000).frames[m.id]).toBe(rule.idle);
    m.order = { kind: "sentry" };
    const seen = new Set<number>();
    for (let t = 5000; t < 7000; t += 50) seen.add(anim.update(state, undefined, t).frames[m.id]!);
    expect([...seen].sort()).toEqual(rule.sentry.frames);
  });

  it("plays the fortify frames once when ordered to fortify, then holds the last; one first seen fortified just holds", () => {
    const { state, m, anim } = setup();
    anim.update(state, undefined, 0);
    m.order = { kind: "fortifying" };
    const frames = [0, 100, 200, 400, 560, 700, 2000].map((t) => anim.update(state, undefined, 1000 + t).frames[m.id]);
    expect(frames).toEqual([10, 10, 11, 12, 13, 13, 13]);
    // Fortified at the next turn: no replay.
    m.order = { kind: "fortified" };
    expect(anim.update(state, undefined, 4000).frames[m.id]).toBe(rule.fortified);
    const fresh = new UnitAnimator();
    expect(fresh.update(state, undefined, 0).frames[m.id]).toBe(rule.fortified);
    // Woken, it stands again.
    m.order = { kind: "none" };
    expect(anim.update(state, undefined, 5000).frames[m.id]).toBe(rule.idle);
  });

  it("fights round and round while the fight is shown, each strike reported once, then back to its orders", () => {
    const { state, m, anim } = setup();
    m.order = { kind: "sentry" };
    anim.update(state, undefined, 0);
    const battle: BattleFrame = { attacker: fighter(m.id, "militia"), defender: fighter(999, "legion"), start: 1000, heading: 1 };
    const impacts: number[] = [];
    const frames: number[] = [];
    // Drawn every 16 ms, and twice at some instants (a redraw): each strike still lands once. A fight of 1.6 s.
    for (let t = 1000; t < 2600; t += 16) {
      for (const again of [0, 0]) {
        void again;
        const poses = anim.update(state, battle, t);
        impacts.push(...poses.impacts);
        frames.push(poses.frames[m.id]!);
      }
    }
    // The first strike with the first blow, then one each time round: (1600 - 150 - 290) / 640 more, so three in all.
    expect(impacts).toEqual([m.id, m.id, m.id]);
    expect(frames[0]).toBe(0);
    expect(frames.filter((f, i) => f === 3 && frames[i - 1] !== 3).length).toBe(3);
    expect(anim.update(state, battle, 1000 + LUNGE_MS).frames[m.id]).toBe(rule.attack!.frames[rule.attack!.impact]);
    // Over (the fight no longer shown): back to its sentry loop.
    expect(rule.sentry!.frames).toContain(anim.update(state, undefined, 2700).frames[m.id]);
    // A new fight plays anew.
    const next = { ...battle, start: 3000 };
    expect(anim.update(state, next, 3000).frames[m.id]).toBe(0);
    expect(anim.update(state, next, 3000 + LUNGE_MS).impacts).toEqual([m.id]);
  });

  it("fights back when attacked, from the lunge at its own pace", () => {
    const { state, m, anim } = setup();
    anim.update(state, undefined, 0);
    const battle: BattleFrame = { attacker: fighter(999, "legion"), defender: fighter(m.id, "militia"), start: 1000, heading: -1 };
    const seen = new Set<number>();
    let strikes = 0;
    for (let t = 1000; t < 2600; t += 16) {
      const poses = anim.update(state, battle, t);
      seen.add(poses.frames[m.id]!);
      strikes += poses.impacts.length;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(rule.attack!.frames);
    // Its strike 320 ms after the lunge, then each 640 ms: 2 in the 1.45 s after it.
    expect(strikes).toBe(2);
    expect(anim.update(state, undefined, 2700).frames[m.id]).toBe(rule.idle);
  });

  it("walks a whole step of its walk a square: a step takes the walk's cycle, a long chain sped up", () => {
    const steps = (n: number): UnitAction[] => Array.from({ length: n }, (_, i) => ({ kind: "step", unit: 1, type: "militia", owner: 0, fromX: i, fromY: 0, toX: i + 1, toY: 0 }));
    const timing = { stepMs: 120, maxMs: 1000, width: 80, walkMs: travelMs };
    expect(travelMs("militia")).toBe(rule.travel!.ms.reduce((a, b) => a + b, 0));
    expect(motionMs(steps(1), timing)).toBe(travelMs("militia"));
    expect(motionMs(steps(3), timing)).toBe(3 * travelMs("militia"));
    expect(motionMs(steps(20), timing)).toBeLessThanOrEqual(WALK_CHAIN_MS);
    // A unit without a walk keeps the pace.
    expect(motionMs(steps(1).map((s) => ({ ...s, type: "legion" })), timing)).toBe(120);
    expect(travelMs("legion")).toBe(0);
  });

  const fight = (type: string, defender = "legion"): UnitBattle => ({
    kind: "battle",
    attacker: { unit: 1, type, owner: 0, x: 10, y: 10, hp: 10, maxHp: 10, firepower: 1 },
    defender: { unit: 2, type: defender, owner: 1, x: 11, y: 10, hp: 3, maxHp: 10, firepower: 1 },
    rounds: [true, true, true],
    attackerWon: true,
    alsoLost: [],
  });
  const pace = { stepMs: 120, maxMs: 1000, width: 80, battleMs: 2000, battleTotalMs: 2000, strikeMs, shot: shotOf };

  it("winds up whole before its first blow: the fight waits for it, standing its ground till it lunges, the rounds at their pace", () => {
    const wind = strikeMs("militia");
    expect(wind).toBe(rule.attack!.ms.slice(0, rule.attack!.impact).reduce((a, b) => a + b, 0));
    // A unit without moves keeps the lunge; the militia's fight is longer by its wind-up past it.
    expect(strikeMs("legion")).toBe(0);
    expect(motionMs([fight("militia")], pace) - motionMs([fight("legion")], pace)).toBe(wind - LUNGE_MS);
    const m = new MotionPlayer();
    m.play([fight("militia")], 0, pace);
    expect(m.at(wind - LUNGE_MS - 1).battle).toMatchObject({ strikeMs: wind, attacker: { x: 10 }, defender: { hp: 3 } });
    expect(m.at(wind - 1).battle!.attacker.x).toBeGreaterThan(10);
    expect(m.at(wind + 1).battle!.defender.hp).toBe(2);
    expect(m.at(wind + 1).battle!.shot).toBeUndefined();
  });

  it("shoots the catapult's stone from where it stands: it never closes in, the stone flies from its picture to its foe's feet", () => {
    const land = strikeMs("catapult");
    const attack = UNIT_ANIMS.catapult!.attack!;
    const shot = shotOf("catapult")!;
    // The stone leaves as the frame that draws it ends, and lands after its flight with the first blow.
    expect(shot.releaseMs).toBe(attack.ms.slice(0, attack.impact + 1).reduce((a, b) => a + b, 0));
    expect(land).toBe(shot.releaseMs + attack.shot!.flightMs);
    // Where the frame draws it: up and right of the catapult, inside its square.
    expect(shot.from.x).toBeGreaterThan(0.5);
    expect(shot.from.y).toBeLessThan(0.5);
    const still = new MotionPlayer();
    still.play([fight("catapult")], 0, pace);
    const seen: number[] = [];
    for (let t = 0; t < land + 1200; t += 10) {
      const b = still.at(t).battle;
      if (b) seen.push(b.attacker.x);
    }
    expect(new Set(seen)).toEqual(new Set([10]));
    const m = new MotionPlayer();
    m.play([fight("catapult")], 0, pace);
    expect(m.at(shot.releaseMs - 1).battle!.shot).toBeUndefined();
    const leaving = m.at(shot.releaseMs).battle!.shot!;
    expect([leaving.x, leaving.y]).toEqual([10 + shot.from.x, 10 + shot.from.y]);
    // It arcs above the straight way, its shadow on the ground under it, and comes down before the foe's feet.
    const mid = m.at((shot.releaseMs + land) / 2).battle!.shot!;
    expect(mid.y).toBeCloseTo((leaving.y + 10.9) / 2 - UNIT_ANIMS.catapult!.attack!.shot!.arc, 6);
    expect(mid.y).toBeLessThan((leaving.y + 10.9) / 2 - 0.2);
    expect(mid.ground).toBeGreaterThan(mid.y);
    const down = m.at(land + 1).battle!;
    expect(down.shot).toMatchObject({ x: 11.2, y: 10.9 });
    expect(down.shot!.landed).toBeGreaterThan(0);
    expect(down.defender.hp).toBe(2);
    // Attacking leftward it shoots from the picture mirrored.
    const back = new MotionPlayer();
    back.play([{ ...fight("catapult"), defender: { ...fight("catapult").defender, x: 9 } }], 0, pace);
    expect(back.at(shot.releaseMs).battle!.shot!.x).toBeCloseTo(11 - shot.from.x, 6);
  });

  it("plays the catapult's shot once a fight at its own pace, standing spent after; attacked, it stands as it was", () => {
    const attack = UNIT_ANIMS.catapult!.attack!;
    const land = strikeMs("catapult");
    const state = newGame(2026);
    const u = state.units[0]!;
    const c = createUnit(state, "catapult", 0, u.x, u.y, null);
    const anim = new UnitAnimator();
    anim.update(state, undefined, 0);
    const m = new MotionPlayer();
    m.play([fight("catapult")], 0, pace);
    const at = (t: number) => anim.update(state, { ...m.at(t).battle!, attacker: { ...m.at(t).battle!.attacker, unit: c.id } }, t).frames[c.id];
    const frames: number[] = [];
    for (let t = 0; t < land + 250; t += 10) frames.push(at(t)!);
    // Each frame in turn, once, the stone leaving on the release frame; then spent.
    expect(frames.filter((f, i) => f !== frames[i - 1])).toEqual(attack.frames);
    const releaseAt = attack.ms.slice(0, attack.impact).reduce((a, b) => a + b, 0);
    expect(frames[Math.floor((releaseAt + 10) / 10)]).toBe(attack.frames[attack.impact]);
    // Attacked, it keeps its standing frame.
    const anim2 = new UnitAnimator();
    anim2.update(state, undefined, 0);
    const d = new MotionPlayer();
    d.play([{ ...fight("legion", "catapult"), defender: { ...fight("legion", "catapult").defender, unit: c.id } }], 0, pace);
    for (let t = 0; t < 1200; t += 50) expect(anim2.update(state, d.at(t).battle, t).frames[c.id]).toBe(UNIT_ANIMS.catapult!.idle);
  });

  it("eases the catapult's shot in and out: raised and winched down slowly, held longest, quick as the stone leaves, settling slowly", () => {
    const [raised, drawn, cocked, held, loosed, spent] = UNIT_ANIMS.catapult!.attack!.ms as [number, number, number, number, number, number];
    expect(loosed).toBeLessThan(Math.min(raised, drawn, cocked, held, spent));
    expect(raised + drawn + cocked + held).toBeGreaterThan(900);
    expect(held).toBeGreaterThan(Math.max(raised, drawn, cocked));
    expect(Math.min(raised, cocked)).toBeGreaterThan(drawn);
    expect(spent).toBeGreaterThan(held);
  });
});

describe("UnitAnimator, the settlers", () => {
  const move = UNIT_ANIMS.settlers!;
  const setup = () => {
    const state = newGame(2026);
    const s = state.units.find((u) => u.type === "settlers")!;
    return { state, s, anim: new UnitAnimator() };
  };
  const fighter = (unit: number, type: string): BattleFighter => ({ unit, type, owner: 0, x: 0, y: 0, hp: 10, maxHp: 10, xp: 0, stacked: false, hit: 0, dying: 0 });

  it("walks while it steps across the map, and stands again once it stops", () => {
    const { state, s, anim } = setup();
    expect(anim.update(state, undefined, 0).frames[s.id]).toBe(move.idle);
    // Under way, from the step after the one it stands in; on through the cycle however long the slides last.
    const going = [{ unit: s.id }];
    expect(anim.update(state, undefined, 1000, going).frames[s.id]).toBe(move.travel!.frames[0]);
    const seen = new Set<number>();
    for (let t = 1000; t < 2400; t += 20) seen.add(anim.update(state, undefined, t, going).frames[s.id]!);
    expect([...seen].sort((a, b) => a - b)).toEqual([...move.travel!.frames].sort((a, b) => a - b));
    expect(anim.update(state, undefined, 2400).frames[s.id]).toBe(move.idle);
    // Another unit's steps are not its own.
    expect(anim.update(state, undefined, 2500, [{ unit: 999 }]).frames[s.id]).toBe(move.idle);
  });

  it("works the land in its job's loop as long as the job lasts; on sentry it stands", () => {
    const { state, s, anim } = setup();
    anim.update(state, undefined, 0);
    for (const [job, seq] of [["road", move.work!.road!], ["irrigate", move.work!.irrigate!], ["mine", move.work!.mine!], ["fortress", move.work!.road!]] as const) {
      s.order = { kind: "work", work: job, turnsLeft: 3 };
      const seen = new Set<number>();
      for (let t = 0; t < 3000; t += 20) seen.add(anim.update(state, undefined, 10_000 + t).frames[s.id]!);
      expect([...seen].sort((a, b) => a - b), job).toEqual([...seq.frames].sort((a, b) => a - b));
      // The turn ending (a turn less to go) leaves the loop running.
      s.order = { kind: "work", work: job, turnsLeft: 2 };
      expect(seq.frames, job).toContain(anim.update(state, undefined, 13_000).frames[s.id]);
    }
    s.order = { kind: "sentry" };
    expect(anim.update(state, undefined, 20_000).frames[s.id]).toBe(move.idle);
    s.order = { kind: "fortified" };
    expect(anim.update(state, undefined, 21_000).frames[s.id]).toBe(move.idle);
  });

  it("goes back to its job once it has walked, and never plays an attack it has no frames for", () => {
    const { state, s, anim } = setup();
    s.order = { kind: "work", work: "mine", turnsLeft: 5 };
    anim.update(state, undefined, 0);
    expect(move.travel!.frames).toContain(anim.update(state, undefined, 100, [{ unit: s.id }]).frames[s.id]);
    expect(move.work!.mine!.frames).toContain(anim.update(state, undefined, 300).frames[s.id]);
    const battle: BattleFrame = { attacker: fighter(s.id, "settlers"), defender: fighter(999, "legion"), start: 400, heading: 1 };
    const poses = anim.update(state, battle, 400 + LUNGE_MS);
    expect(poses.impacts).toEqual([]);
    expect(move.work!.mine!.frames).toContain(poses.frames[s.id]);
  });
});

describe("the owner's colour on the clothes", () => {
  it("takes the magenta's shades and leaves skin, wood and brown cloth alone", () => {
    const px = (rgb: number[]) => new Uint8Array([...rgb, 255]);
    const owner = [85, 85, 255] as const;
    for (const other of [[250, 169, 101], [87, 48, 13], [135, 68, 30], [39, 21, 3], [66, 17, 26], [128, 128, 128]]) {
      const p = px(other);
      expect(recolourOwner(p, owner), `${other}`).toBe(0);
      expect([...p.slice(0, 3)]).toEqual(other);
    }
    // The lit face is the owner's colour; a shade of it darker as much; a highlight lighter.
    const lit = px([217, 0, 163]);
    recolourOwner(lit, owner);
    [85, 85, 255].forEach((c, i) => expect(Math.abs(lit[i]! - c)).toBeLessThanOrEqual(2));
    const shade = px([104, 0, 89]);
    recolourOwner(shade, owner);
    expect(shade[2]!).toBeLessThan(160);
    const shine = px([255, 40, 210]);
    recolourOwner(shine, owner);
    expect(shine[0]!).toBeGreaterThan(85);
    expect(isOwnerMagenta(83, 1, 54)).toBe(true);
    expect(isOwnerMagenta(82, 28, 24)).toBe(false);
  });
});
