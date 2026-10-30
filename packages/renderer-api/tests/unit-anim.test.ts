import { describe, expect, it } from "vitest";
import { createUnit, newGame, type UnitAction } from "@civ/core";
import {
  animFrameCount, animSheet, attackStep, FOUNDING, foundingMoment, foundingShow, isOwnerMagenta, motionMs, travelMs, WALK_CHAIN_MS, LUNGE_MS, recolourOwner, sequenceStep, showFrame, UNIT_ANIMS, UNIT_ATLASES, unitArtPlace, UnitAnimator,
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
    const fight = (dying: number): BattleFrame => ({ attacker: fighter(m.id, "militia"), defender: fighter(999, "phalanx", dying), start: 1000, heading: 1 });
    anim.update(state, fight(0), 1000);
    expect(rule.attack!.frames).toContain(anim.update(state, fight(0), 1400).frames[m.id]);
    // The phalanx begins to burst: the militia raises its club.
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
    for (const n of [...move.travel!.frames, ...Object.values(move.work!).flatMap((s) => s.frames), move.idle]) expect(settlers.frames[n]).toBeDefined();
  });

  it("plays each row for its job, the sheet's colours as drawn", () => {
    const rows = (seq: { frames: number[] }) => seq.frames.map((f) => settlers.frames[f]!.name.split("-")[0]);
    expect(new Set(rows(move.travel!))).toEqual(new Set(["travel"]));
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
    const battle: BattleFrame = { attacker: fighter(m.id, "militia"), defender: fighter(999, "phalanx"), start: 1000, heading: 1 };
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
    expect(motionMs(steps(1).map((s) => ({ ...s, type: "phalanx" })), timing)).toBe(120);
    expect(travelMs("phalanx")).toBe(0);
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
    const battle: BattleFrame = { attacker: fighter(s.id, "settlers"), defender: fighter(999, "phalanx"), start: 400, heading: 1 };
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
