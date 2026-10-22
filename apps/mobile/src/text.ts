import type { TextInputState } from "@civ/renderer-api";
import { press, screenKind } from "./civ.js";
import { shown } from "./renderer.js";

/**
 * The game asks for a line of text (a city's name) by reading keys. A phone has none until a text
 * field takes focus, so while the game asks, a field at the top of the screen (clear of the
 * keyboard) edits the game's own text, and its OK and Cancel are the game's Enter and Esc.
 */
const form = document.getElementById("ask") as HTMLFormElement;
const field = form.querySelector("input")!;
const title = form.querySelector(".title")!;
const cancel = form.querySelector(".cancel")!;
let open = false;
let bound: TextInputState | undefined;

field.addEventListener("input", () => {
  if (!bound) return;
  bound.text = field.value.slice(0, bound.maxLength);
});
// The field's keys are its own: the game would take them twice.
field.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Escape") { e.preventDefault(); press("Escape", "Escape"); }
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  press("Enter", "Enter");
});
cancel.addEventListener("pointerup", () => press("Escape", "Escape"));

/** Show, fill or put away the field to match the game: each frame, and right after a tap or button that may have opened a prompt. */
export function syncText(): void {
  const asking = screenKind() === "input";
  if (asking && !open) {
    open = true;
    form.hidden = false;
    field.value = "";
    field.focus();
  }
  if (asking && shown.input && shown.input !== bound) {
    bound = shown.input;
    title.textContent = bound.title;
    field.maxLength = bound.maxLength;
    field.value = bound.text;
    field.select();
  } else if (asking && bound && document.activeElement !== field) field.value = bound.text; // typed on a keyboard
  if (!asking && open) {
    open = false;
    bound = undefined;
    field.blur();
    form.hidden = true;
  }
}

function frame(): void {
  syncText();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
