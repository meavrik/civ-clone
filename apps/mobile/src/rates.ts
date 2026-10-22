import type { RateRow } from "@civ/renderer-retro";

/**
 * The rates screen takes arrow keys only (`ratesKey` in apps/web/src/main.ts: Left/Right tax,
 * Up/Down luxury, science the rest). A touch on a bar asks for a rate there; these are the keys
 * that walk the rates to it from where they are. The game refuses a step that would take any rate
 * below nothing or past the government's limit, as it does for a keyboard, and the bar stops there.
 */
export function rateKeys(now: { tax: number; lux: number }, row: RateRow, value: number): string[] {
  const steps = (n: number, up: string, down: string) => Array<string>(Math.abs(n)).fill(n > 0 ? up : down);
  switch (row) {
    case "tax": return steps(value - now.tax, "ArrowRight", "ArrowLeft");
    case "lux": return steps(value - now.lux, "ArrowUp", "ArrowDown");
    case "sci": return steps(10 - now.lux - value - now.tax, "ArrowRight", "ArrowLeft"); // science moves against tax
  }
}
