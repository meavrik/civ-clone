import { describe, expect, it } from "vitest";
import { createUnit, newGame, type UnitStep } from "@civ/core";
import { MotionPlayer, UNIT_ANIMS, UNIT_ATLASES, unitArtPlace, UnitFacing, type BattleFighter, type UnitMotion } from "../src/index.js";

describe("UnitFacing", () => {
  const setup = () => {
    const state = newGame(2026);
    const u = state.units[0]!;
    return { state, u, facing: new UnitFacing() };
  };
  const motion = (unit: number, heading?: -1 | 1): UnitMotion => ({ unit, type: "militia", owner: 0, x: 0, y: 0, ...(heading ? { heading } : {}) });

  it("faces right until it goes left, keeps its way going up or down, and turns back going right", () => {
    const { state, u, facing } = setup();
    expect(facing.update(state, {})).toEqual({});
    expect(facing.update(state, { moving: [motion(u.id, -1)] })).toEqual({ [u.id]: true });
    // A step straight down (no heading) and the slide over: still left.
    expect(facing.update(state, { moving: [motion(u.id)] })).toEqual({ [u.id]: true });
    expect(facing.update(state, {})).toEqual({ [u.id]: true });
    expect(facing.update(state, { moving: [motion(u.id, 1)] })).toEqual({});
  });

  it("turns a unit that changed squares with nothing shown the way it went, the short way round the seam", () => {
    const { state, u, facing } = setup();
    facing.update(state, {});
    u.x -= 1;
    expect(facing.update(state, {})[u.id]).toBe(true);
    // From the first column to the last is one step left, not across the world.
    const x = u.x;
    u.x = 0;
    facing.update(state, {});
    u.x = state.map.width - 1;
    expect(facing.update(state, {})[u.id]).toBe(true);
    u.x = 0;
    expect(facing.update(state, {})[u.id]).toBeUndefined();
    u.x = x;
  });

  it("turns an attacker toward its defender and the defender toward it", () => {
    const { state, u, facing } = setup();
    const foe = createUnit(state, "militia", 1, u.x - 1, u.y, null);
    const side = (unit: number): BattleFighter => ({ unit, type: "militia", owner: 0, x: 0, y: 0, hp: 10, maxHp: 10, xp: 0, stacked: false, hit: 0, dying: 0 });
    const poses = facing.update(state, { battle: { attacker: side(u.id), defender: side(foe.id), start: 0, heading: -1 } });
    expect(poses).toEqual({ [u.id]: true });
  });

  it("is turned by a step only once the step is under way", () => {
    const { state, u } = setup();
    const step = (from: number, to: number): UnitStep => ({ kind: "step", unit: u.id, type: u.type, owner: 0, fromX: from, fromY: u.y, toX: to, toY: u.y }) as UnitStep;
    const player = new MotionPlayer();
    player.hold(500, 0);
    player.play([step(u.x, u.x - 1)], 0, { stepMs: 200, maxMs: 2000, width: state.map.width });
    // Waiting behind the hold: drawn where it starts, not yet turned.
    expect(player.at(100).moving[0]?.heading).toBeUndefined();
    expect(player.at(600).moving[0]?.heading).toBe(-1);
  });
});

describe("a picture facing left", () => {
  it("is mirrored about its feet: the animated militia's anchor keeps the mirrored spot", () => {
    const atlas = UNIT_ATLASES.militia!, rule = UNIT_ANIMS.militia!;
    const right = unitArtPlace({ id: "militia", unit: true, x: 0, y: 0, w: 16, h: 16 })!;
    const left = unitArtPlace({ id: "militia", unit: true, x: 0, y: 0, w: 16, h: 16, flip: true })!;
    const k = right.w / atlas.size[0];
    const footRight = right.x + atlas.anchor[0] * k;
    // Mirrored, the anchor lies as far from the canvas's right edge as it lay from its left.
    const footLeft = left.x + (atlas.size[0] - atlas.anchor[0]) * k;
    // Each way, the idle drawing is centred in the square.
    const idle = atlas.frames[rule.idle]!;
    const mid = (idle.box[0] + idle.box[2] / 2 - atlas.anchor[0]) * k;
    expect(footRight + mid).toBeCloseTo(8, 6);
    expect(footLeft - mid).toBeCloseTo(8, 6);
    expect([left.y, left.w, left.h]).toEqual([right.y, right.w, right.h]);
    // A still picture keeps its box: it turns round its middle.
    expect(unitArtPlace({ id: "legion", unit: true, x: 0, y: 0, w: 16, h: 16, flip: true })).toEqual(unitArtPlace({ id: "legion", unit: true, x: 0, y: 0, w: 16, h: 16 }));
  });
});
