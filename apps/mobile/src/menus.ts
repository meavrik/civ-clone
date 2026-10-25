import type { MenuState } from "@civ/renderer-api";

/**
 * A menu's rows moved `by` (down the list when positive) under a dragging finger, `rows` of them on
 * view: never past either end, the choice going along to stay on view, as the game keeps it (`keepInView`).
 */
export function scrollRows(m: MenuState, by: number, rows: number): void {
  if (rows >= m.items.length || by === 0) return;
  const top = Math.max(0, Math.min(m.items.length - rows, (m.top ?? 0) + by));
  m.top = top;
  m.selected = Math.max(top, Math.min(top + rows - 1, m.selected));
}
