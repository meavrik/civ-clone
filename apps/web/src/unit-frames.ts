import { animFrameCount, animSheet, recolourOwner, unitAnim, UNIT_ANIMS } from "@civ/renderer-api";
import { PALETTE } from "@civ/renderer-retro";

/**
 * The frames of the animated units (renderer-api `unitAnim`: the user's militia, 2026-10-28, its walk, 2026-10-30, and
 * settlers, 2026-10-29) as pictures the web app lays over the canvas: each cut from its atlas (`animSheet`: the unit's
 * own or one of its rule's `sheets`, `units/<atlas>-anim.png`, one canvas a frame) and, for a unit whose rule says so
 * (`ownerColour`: the militia), its magenta clothes recoloured to an owner's colour (`recolourOwner`), made once a
 * frame and owner and kept. An atlas is fetched when first wanted; until it is in, there is no frame to show.
 */

const atlasUrl = (unit: string): string => new URL(`./units/${unit}-anim.png`, import.meta.url).href;

const atlases = new Map<string, HTMLImageElement | null>();
const waiting = new Map<string, (() => void)[]>();
const made = new Map<string, string>();

/** The atlas of `unit`, once it has loaded (null until then: asking starts the fetch, and `then` runs once it is in). */
function atlas(unit: string, then?: () => void): HTMLImageElement | null {
  const got = atlases.get(unit);
  if (got) return got;
  if (then) waiting.set(unit, [...(waiting.get(unit) ?? []), then]);
  if (got === undefined) {
    atlases.set(unit, null);
    const img = new Image();
    img.onload = () => {
      atlases.set(unit, img);
      for (const fn of waiting.get(unit) ?? []) fn();
      waiting.delete(unit);
    };
    img.src = atlasUrl(unit);
  }
  return null;
}

/**
 * Frame `frame` of `unit` in owner colour `owner` (a palette index; none, or a unit shown as drawn: the magenta as
 * drawn), as an image URL; null while its atlas loads.
 */
export function unitFrameUrl(unit: string, frame: number, colour: number | undefined): string | null {
  const anim = unitAnim(unit);
  const owner = anim?.rule.ownerColour ? colour : undefined;
  const key = `${unit}:${frame}:${owner ?? "-"}`;
  const hit = made.get(key);
  if (hit) return hit;
  const sheet = anim ? animSheet(unit, frame) : null;
  const img = sheet ? atlas(sheet.id) : null;
  if (!sheet || !img) return null;
  const [w, h] = sheet.atlas.size;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sheet.frame * w, 0, w, h, 0, 0, w, h);
  if (owner !== undefined) {
    const pixels = ctx.getImageData(0, 0, w, h);
    recolourOwner(pixels.data, PALETTE[owner]!);
    ctx.putImageData(pixels, 0, 0);
  }
  const url = canvas.toDataURL("image/png");
  made.set(key, url);
  return url;
}

/**
 * Make every frame of the animated units in these owner colours ahead of need, a few at a time between the
 * game's frames, handing each to `ready` (the web app decodes it there), so no move waits for its picture.
 */
export function prepareUnitFrames(owners: readonly number[], ready: (url: string) => void): void {
  const todo: [string, number, number][] = [];
  // An atlas that is only another unit's further sheet (the militia's walk) comes with that unit's frames.
  const further = new Set(Object.values(UNIT_ANIMS).flatMap((r) => r.sheets ?? []));
  for (const unit of Object.keys(UNIT_ANIMS)) {
    const anim = unitAnim(unit);
    if (!anim || further.has(unit)) continue;
    // The idle and fortified frames first: they show the most.
    const frames = [anim.rule.idle, anim.rule.fortified ?? anim.rule.idle, ...Array.from({ length: animFrameCount(unit) }, (_, i) => i)].filter((f, i, all) => all.indexOf(f) === i);
    // A unit shown as drawn needs its frames once, whatever the owners.
    for (const owner of anim.rule.ownerColour ? owners : owners.slice(0, 1)) for (const f of frames) todo.push([unit, f, owner]);
  }
  const step = () => {
    const until = performance.now() + 8;
    while (todo.length && performance.now() < until) {
      const [unit, frame, owner] = todo[0]!;
      const url = unitFrameUrl(unit, frame, owner);
      if (!url) { atlas(animSheet(unit, frame)?.id ?? unit, () => setTimeout(step, 0)); return; }
      todo.shift();
      ready(url);
    }
    if (todo.length) setTimeout(step, 0);
  };
  step();
}
