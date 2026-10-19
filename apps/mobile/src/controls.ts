import { game, press, screenKind } from "./civ.js";
import { onLayout, place } from "./display.js";
import { keysFor, padFor, type Key, type PadKey } from "./keys.js";
import type { Layout } from "./layout.js";
import { syncText } from "./text.js";

/**
 * The buttons beside (or below) the game screen: a direction pad and the keys each screen of the
 * web game answers to, rebuilt when the screen changes. Each press is a key for the web game.
 */
const pad = document.getElementById("pad")!;
const keys = document.getElementById("keys")!;
let shownFor = "";

/** An arrow pointing `deg` degrees clockwise from up, or the middle's dot. */
function glyph(p: PadKey): string {
  if (p.col === 1 && p.row === 1) return `<svg viewBox="-10 -10 20 20"><circle r="3.5"/></svg>`;
  const deg = (Math.atan2(p.col - 1, 1 - p.row) * 180) / Math.PI;
  return `<svg viewBox="-10 -10 20 20"><polygon points="0,-8 7,-1 2.5,-1 2.5,7 -2.5,7 -2.5,-1 -7,-1" transform="rotate(${deg})"/></svg>`;
}

/**
 * A button pressing `k`. The pad answers as the finger lands, like a key held down; the others as
 * it lifts, like a button (and so a prompt they open may take the keyboard on a phone).
 */
function button(className: string, html: string, k: { code: string; key: string }, label: string, onLand: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.tabIndex = -1;
  b.className = className;
  b.innerHTML = html;
  b.setAttribute("aria-label", label);
  const go = () => {
    press(k.code, k.key);
    syncText();
  };
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.classList.add("down");
    if (onLand) go();
  });
  b.addEventListener("pointerup", () => {
    if (!onLand && b.classList.contains("down")) go();
    b.classList.remove("down");
  });
  b.addEventListener("pointercancel", () => b.classList.remove("down"));
  return b;
}

function build(screen: string, activeUnit: boolean): void {
  const dirs = padFor(screen);
  pad.replaceChildren(...(dirs ?? []).map((p) => {
    const b = button("dir", glyph(p), p, p.code, true);
    b.style.gridColumn = `${p.col + 1}`;
    b.style.gridRow = `${p.row + 1}`;
    return b;
  }));
  keys.replaceChildren(...keysFor({ screen, activeUnit }).map((k: Key) => button("key", k.label, k, k.label, false)));
}

function arrange(layout: Layout): void {
  place(pad, layout.pad);
  place(keys, layout.keys);
  document.body.dataset.layout = layout.mode;
  // Pad buttons as big as the area allows, up to a thumb and a half.
  const cell = Math.max(32, Math.min(64, Math.floor((Math.min(layout.pad.w, layout.pad.h) - 24) / 3)));
  pad.style.setProperty("--cell", `${cell}px`);
}

onLayout(arrange);

function frame(): void {
  const screen = screenKind();
  const activeUnit = (game()?.state?.activeUnit ?? null) !== null;
  const key = `${screen}|${activeUnit}`;
  if (key !== shownFor) {
    shownFor = key;
    build(screen, activeUnit);
  }
  syncText();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
