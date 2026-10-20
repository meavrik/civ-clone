import { screenKind } from "./civ.js";
import { canvas, displayScale, logicalAt } from "./display.js";
import { GESTURES, Recognizer, type Gesture } from "./gestures.js";
import { pan, TILE_PX, tileUnder } from "./renderer.js";
import { syncText } from "./text.js";

/**
 * Fingers on the game screen become the mouse the web game knows: a tap is a click, a press held
 * still is a right-click (a unit's orders, a step onto the square next to it, the terrain window),
 * a drag pans the map or scrolls the tech tree. A real mouse is left to the browser.
 */
const fingers = new Recognizer();
const ring = document.getElementById("ring")!;
let holdTimer = 0;
let dragging: "map" | "list" | null = null;

function click(x: number, y: number, button: 0 | 2): void {
  canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y, button, buttons: button === 2 ? 2 : 1, bubbles: true, cancelable: true }));
}

function showRing(x: number, y: number, state: "" | "holding" | "fired"): void {
  ring.className = state;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
}

function act(g: Gesture | null): void {
  if (!g) return;
  switch (g.kind) {
    case "tap": {
      showRing(g.x, g.y, "");
      // A tap on the map shows that square: the view comes back from wherever it was dragged.
      if (screenKind() === "map" && tileUnder(...logicalAt(g.x, g.y))) pan.letGo(performance.now());
      click(g.x, g.y, 0);
      syncText(); // a prompt this opened takes the keyboard while the tap still counts as the player's
      break;
    }
    case "long":
      showRing(g.x, g.y, "fired");
      navigator.vibrate?.(12);
      click(g.x, g.y, 2);
      syncText();
      break;
    case "dragStart":
      showRing(g.x, g.y, "");
      dragging = screenKind() === "map" && tileUnder(...logicalAt(g.x, g.y)) ? "map" : screenKind() === "research" ? "list" : null;
      if (dragging === "map") pan.grab();
      break;
    case "drag": {
      const scale = displayScale();
      if (dragging === "map") pan.drag(-g.dx / (scale * TILE_PX), -g.dy / (scale * TILE_PX));
      else if (dragging === "list") {
        // The research list scrolls with the finger: the wheel it answers to moves a row for every 30 of its pixels, a row being 9 logical ones.
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: (-g.dy / scale / 9) * 30, deltaMode: 0, bubbles: true, cancelable: true }));
      }
      break;
    }
    case "dragEnd":
      if (dragging === "map") pan.drop();
      dragging = null;
      break;
  }
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  e.preventDefault(); // no mouse events made up from the touch: this layer makes its own
  if (fingers.busy) return;
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
  const gs = fingers.move(e.pointerId, e.clientX, e.clientY);
  if (gs.length) clearTimeout(holdTimer);
  for (const g of gs) act(g);
});

canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") return;
  clearTimeout(holdTimer);
  act(fingers.up(e.pointerId, performance.now()));
  if (ring.className === "holding") ring.className = "";
});

canvas.addEventListener("pointercancel", (e) => {
  clearTimeout(holdTimer);
  act(fingers.cancel(e.pointerId));
  ring.className = "";
});

// Safari makes mouse events and zooms from touches unless the touches themselves are refused.
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

// Any key on the map (the pad, the buttons or a keyboard) brings the view back to the game's camera.
addEventListener("keydown", () => {
  if (screenKind() === "map") pan.letGo(performance.now());
}, { capture: true });
