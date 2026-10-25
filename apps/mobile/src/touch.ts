import { shipStats } from "@civ/core";
import { IMPROVEMENT_LINE_H, ratesAt, TOUCH_MENU } from "@civ/renderer-retro";
import { game, press, screenKind } from "./civ.js";
import { canvas, displayScale, logicalAt } from "./display.js";
import { GESTURES, Pinch, Recognizer, type Gesture } from "./gestures.js";
import { rateKeys } from "./rates.js";
import { chooseAt, mapZoom, narrowPoint, ordersAbove, pan, scrollMenu, setMapZoom, shown, TILE_PX, tileUnder, ZOOMS } from "./renderer.js";
import { screenW } from "./display.js";
import { syncText } from "./text.js";

/**
 * Fingers on the game screen become the mouse the web game knows: a tap is a click, a press held
 * still is a right-click (the square's window), a drag pans the map or scrolls the research list (on
 * a city screen its improvements, in a long menu its rows), and two fingers on the map pinch it in or
 * out (`ZOOMS`).
 * There are no buttons beside the screen, so the few things the game takes from keys only are
 * touches here: a tap or a held finger on our unit opens its orders just above it (the menu bar has
 * no Orders on a phone), a tap on a setup card's Choose button picks it, a touch on a rates bar sets
 * that rate, a tap on a spaceship ready to go asks to launch it, and a press held on a city screen
 * renames the city. A real mouse is left to the browser.
 */
const fingers = new Recognizer();
const ring = document.getElementById("ring")!;
let holdTimer = 0;
let dragging: "map" | "list" | "rates" | "menu" | null = null;
/** How far a drag over a long menu has gone since it last moved the menu a row, in CSS px. */
let menuDrag = 0;
/** Where the dragging finger is now, and where a drag along a rates bar started (it keeps that bar). */
const at = { x: 0, y: 0 };
let barY = 0;

function click(x: number, y: number, button: 0 | 2): void {
  canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y, button, buttons: button === 2 ? 2 : 1, bubbles: true, cancelable: true }));
}

function showRing(x: number, y: number, state: "" | "holding" | "fired"): void {
  ring.className = state;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
}

/** Set the rate of the bar at point (x, y) to what the point stands for; false off the bars. */
function setRate(x: number, y: number, held: boolean): boolean {
  // The window stands in the middle of whatever is under it: the wide map, or a 320x200 screen.
  const hit = ratesAt(...narrowPoint(...logicalAt(x, y)), held, shown.wide ? screenW() : undefined);
  const me = game()?.state?.players[0];
  if (!hit || !me) return false;
  for (const key of rateKeys({ tax: me.taxRate, lux: me.luxRate }, hit.row, hit.value)) press(key, key);
  return true;
}

/**
 * A tap, or a finger held (asked for 2026-10-25), on a square of the map where our units stand: one of
 * them comes into play as the game picks it, and its orders open over it (the game's Esc), as buttons.
 * In a city a tap opens the city as ever; a finger held there opens the orders of the unit in play
 * when it stands in the city, else the square's window.
 */
function ordersAt(x: number, y: number, held = false): boolean {
  const st = game()?.state;
  const sq = tileUnder(...logicalAt(x, y));
  if (!st || !sq) return false;
  const here = (id: number | null) => st.units.some((u) => u.id === id && u.x === sq.x && u.y === sq.y);
  if (!st.units.some((u) => u.owner === 0 && u.x === sq.x && u.y === sq.y)) return false;
  if (st.cities.some((c) => c.x === sq.x && c.y === sq.y)) {
    if (!held || !here(st.activeUnit)) return false;
  } else if (!here(st.activeUnit)) click(x, y, 0);
  if (screenKind() === "menu") return true; // several of ours: the game lists them to pick from
  if (!here(st.activeUnit)) return true; // none of them can move this turn: the game said so
  ordersAbove(st.activeUnit);
  press("Escape", "Escape");
  if (screenKind() !== "menu") ordersAbove(null);
  return true;
}

/** Our spaceship is built enough to go and still on the ground. */
function readyToLaunch(): boolean {
  const ship = game()?.state?.players[0]?.spaceship;
  return !!ship && ship.launched === null && shipStats(ship).launchable;
}

function act(g: Gesture | null): void {
  if (!g) return;
  const screen = screenKind();
  switch (g.kind) {
    case "tap": {
      showRing(g.x, g.y, "");
      if (screen === "rates" && setRate(g.x, g.y, false)) break;
      if (screen === "spaceship" && readyToLaunch()) { press("Enter", "Enter"); break; }
      if (screen === "setup" && chooseAt(...logicalAt(g.x, g.y))) { press("Enter", "Enter"); break; }
      if (screen === "map" && ordersAt(g.x, g.y)) break;
      // A tap on the map shows that square: the view comes back from wherever it was dragged.
      if (screen === "map" && tileUnder(...logicalAt(g.x, g.y))) pan.letGo(performance.now());
      click(g.x, g.y, 0);
      syncText(); // a prompt this opened takes the keyboard while the tap still counts as the player's
      break;
    }
    case "long":
      showRing(g.x, g.y, "fired");
      navigator.vibrate?.(12);
      if (screen === "city") press("KeyN", "n"); // the city's name, in the game's prompt
      else if (screen === "map" && ordersAt(g.x, g.y, true)) break; // our unit: its orders
      else click(g.x, g.y, 2);
      syncText();
      break;
    case "dragStart": {
      showRing(g.x, g.y, "");
      at.x = g.x;
      at.y = g.y;
      const [px, py] = logicalAt(g.x, g.y);
      dragging = screen === "rates" && ratesAt(px, py, false, shown.wide ? screenW() : undefined) ? "rates" : screen === "map" && tileUnder(px, py) ? "map" : screen === "research" || screen === "city" ? "list" : screen === "menu" && game()?.menu ? "menu" : null;
      menuDrag = 0;
      if (dragging === "rates") setRate(g.x, (barY = g.y), true);
      if (dragging === "map") pan.grab();
      break;
    }
    case "drag": {
      at.x += g.dx;
      at.y += g.dy;
      const scale = displayScale();
      if (dragging === "map") pan.drag(-g.dx / (scale * TILE_PX * mapZoom()), -g.dy / (scale * TILE_PX * mapZoom()));
      else if (dragging === "list") {
        // The list scrolls with the finger: the wheel it answers to moves a row for every 30 of its pixels, a
        // row being 9 logical ones in the research list, IMPROVEMENT_LINE_H in a city's improvements.
        const row = screen === "city" ? IMPROVEMENT_LINE_H : 9;
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: (-g.dy / scale / row) * 30, deltaMode: 0, bubbles: true, cancelable: true }));
      } else if (dragging === "menu") {
        // The rows follow the finger, one for every row's height it travels.
        const menu = game()?.menu;
        const row = TOUCH_MENU.row * scale;
        menuDrag -= g.dy;
        const rows = Math.trunc(menuDrag / row);
        if (menu && rows) { menuDrag -= rows * row; scrollMenu(menu, rows); }
      } else if (dragging === "rates") setRate(at.x, barY, true);
      break;
    }
    case "dragEnd":
      if (dragging === "map") pan.drop();
      dragging = null;
      break;
  }
}

/** The fingers on the screen, and the pinch two of them are making on the map. */
const touching = new Map<number, { x: number; y: number }>();
let pinch: Pinch | null = null;

function spread(): { d: number; mid: [number, number] } {
  const [a, b] = [...touching.values()];
  return { d: Math.hypot(b!.x - a!.x, b!.y - a!.y), mid: [(a!.x + b!.x) / 2, (a!.y + b!.y) / 2] };
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  e.preventDefault(); // no mouse events made up from the touch: this layer makes its own
  lockSideways();
  touching.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touching.size === 2 && !pinch && screenKind() === "map") {
    // A second finger on the map: the first one's tap, hold or drag is off, and the two pinch.
    clearTimeout(holdTimer);
    for (const id of touching.keys()) act(fingers.cancel(id));
    ring.className = "";
    pinch = new Pinch(spread().d, mapZoom(), ZOOMS);
    return;
  }
  if (pinch || fingers.busy) return;
  fingers.down(e.pointerId, e.clientX, e.clientY, performance.now());
  try {
    canvas.setPointerCapture(e.pointerId); // the finger's moves stay ours off the canvas
  } catch { /* a pointer already gone */ }
  showRing(e.clientX, e.clientY, "holding");
  clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => act(fingers.tick(performance.now())), GESTURES.longMs);
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") return;
  if (touching.has(e.pointerId)) touching.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) {
    if (touching.size < 2) return;
    const { d, mid } = spread();
    const z = pinch.move(d);
    if (z !== null) {
      setMapZoom(z, logicalAt(...mid));
      navigator.vibrate?.(8);
    }
    return;
  }
  const gs = fingers.move(e.pointerId, e.clientX, e.clientY);
  if (gs.length) clearTimeout(holdTimer);
  for (const g of gs) act(g);
});

canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") return;
  touching.delete(e.pointerId);
  if (pinch) {
    if (!touching.size) pinch = null; // the pinch is over once every finger is off
    return;
  }
  clearTimeout(holdTimer);
  act(fingers.up(e.pointerId, performance.now()));
  if (ring.className === "holding") ring.className = "";
});

canvas.addEventListener("pointercancel", (e) => {
  touching.delete(e.pointerId);
  if (pinch && !touching.size) pinch = null;
  clearTimeout(holdTimer);
  act(fingers.cancel(e.pointerId));
  ring.className = "";
});

/** The game plays sideways only: where the browser lets a page hold the phone that way (an installed app, full screen), it does. */
let locked = false;
function lockSideways(): void {
  if (locked) return;
  locked = true;
  const o = screen.orientation as ScreenOrientation & { lock?: (to: string) => Promise<void> };
  o?.lock?.("landscape").catch(() => {});
}

// Safari makes mouse events and zooms from touches unless the touches themselves are refused.
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

// Any key on the map (a keyboard's) brings the view back to the game's camera.
addEventListener("keydown", () => {
  if (screenKind() === "map") pan.letGo(performance.now());
}, { capture: true });
