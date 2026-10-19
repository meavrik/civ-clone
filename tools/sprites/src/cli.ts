import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sheetFromImage, sheetImage, SHEETS, sheetText } from "@civ/renderer-retro";
import { appIcons } from "./icons.js";
import { decodePng, encodePng } from "./png.js";

/**
 * npm run sprites -- export [dir]            write units.png, terrain.png, features.png (default dir: art-export)
 * npm run sprites -- import <file.png> [sheet] read an edited sheet back into packages/renderer-retro/src/art
 * npm run sprites -- icons [dir]             draw the mobile app's icons (default dir: apps/mobile/public/icons)
 *
 * Sheets are 8 sprites wide at 1:1 scale; transparent pixels are clear and
 * magenta (#ff00ff, #800080) stands for the owner's colour and its dark
 * shade. Every other pixel must be a palette colour the sprite's legend
 * can name, or the import stops and lists the offending pixels.
 */
const ART_DIR = resolve(fileURLToPath(new URL("../../../packages/renderer-retro/src/art/", import.meta.url)));
const ICON_DIR = resolve(fileURLToPath(new URL("../../../apps/mobile/public/icons/", import.meta.url)));

export function artModule(sheet: string, text: string): string {
  return [
    `// ${sheet} sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with \`npm run sprites\`.`,
    "// Every character must be in the legend described in the comment lines below.",
    "export default String.raw`",
    text + "`;",
    "",
  ].join("\n");
}

function main(argv: string[]): number {
  const [cmd, ...args] = argv;
  if (cmd === "export") {
    const dir = resolve(args[0] ?? "art-export");
    mkdirSync(dir, { recursive: true });
    for (const [name, sheet] of Object.entries(SHEETS)) {
      const file = join(dir, `${name}.png`);
      writeFileSync(file, encodePng(sheetImage(sheet)));
      console.log(`wrote ${file} (${sheet.sprites.length} sprites)`);
    }
    return 0;
  }
  if (cmd === "import") {
    const file = args[0];
    if (!file) { console.error("usage: npm run sprites -- import <file.png> [sheet]"); return 2; }
    const name = args[1] ?? basename(file).replace(/\.png$/i, "");
    const sheet = SHEETS[name];
    if (!sheet) { console.error(`unknown sheet "${name}" (known: ${Object.keys(SHEETS).join(", ")})`); return 2; }
    let text: string;
    try {
      text = sheetFromImage(sheet, decodePng(readFileSync(file)));
    } catch (err) {
      console.error((err as Error).message);
      return 1;
    }
    const target = join(ART_DIR, `${name}.art.ts`);
    if (text === sheetText(sheet)) { console.log(`${name}: no changes`); return 0; }
    writeFileSync(target, artModule(name, text));
    console.log(`updated ${target}`);
    return 0;
  }
  if (cmd === "icons") {
    const dir = resolve(args[0] ?? ICON_DIR);
    mkdirSync(dir, { recursive: true });
    for (const { file, image } of appIcons()) {
      writeFileSync(join(dir, file), encodePng(image));
      console.log(`wrote ${join(dir, file)}`);
    }
    return 0;
  }
  console.error("usage: npm run sprites -- export [dir] | import <file.png> [sheet] | icons [dir]");
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
