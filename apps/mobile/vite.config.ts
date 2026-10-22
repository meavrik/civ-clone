import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath, type Plugin } from "vite";
import { withoutDebugMenu } from "./debug-menu.js";

const here = (path: string) => normalizePath(fileURLToPath(new URL(path, import.meta.url)));

/**
 * The web game's main.ts, unchanged, with three of its modules swapped for the phone's: the
 * display (the screen fills the phone), the renderer (the map pans
 * under a finger) and the save slots (the turn so far is saved when the phone puts the game away).
 */
const WEB_MAIN = here("../web/src/main.ts");
const SWAPS: Record<string, string> = {
  "./display.js": here("src/display.ts"),
  "./retro-renderer.js": here("src/renderer.ts"),
  "./storage.js": here("src/storage.ts"),
};

function webGame(): Plugin {
  return {
    name: "epochs-mobile:web-game",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer || normalizePath(importer.split("?")[0]!) !== WEB_MAIN) return null;
      return SWAPS[source] ?? null;
    },
  };
}

/** No Debug menu in the deployed app (debug-menu.ts); the dev server keeps it. */
const RENDERER_API = here("../../packages/renderer-api/src/index.ts");

function noDebugMenu(): Plugin {
  return {
    name: "epochs-mobile:no-debug-menu",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (normalizePath(id.split("?")[0]!) !== RENDERER_API) return null;
      try {
        return withoutDebugMenu(code);
      } catch (err) {
        this.error((err as Error).message);
      }
    },
  };
}

function filesIn(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => normalizePath(relative(dir, join(e.parentPath, e.name))));
  } catch {
    return [];
  }
}

/** sw.js: service-worker.js with every file of the build to cache, under a name that changes when any of them does. */
function serviceWorker(): Plugin {
  let publicDir = "";
  return {
    name: "epochs-mobile:service-worker",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const template = readFileSync(here("service-worker.js"), "utf8");
      const hash = createHash("sha256").update(template);
      const files: string[] = [];
      for (const [name, out] of Object.entries(bundle)) {
        if (name.endsWith(".map")) continue;
        files.push(name);
        hash.update(name).update(out.type === "chunk" ? out.code : out.source);
      }
      for (const name of filesIn(publicDir)) {
        files.push(name);
        hash.update(name).update(readFileSync(join(publicDir, name)));
      }
      files.sort();
      const code = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__FILES__", JSON.stringify(["./", ...files.map((f) => `./${f}`)]));
      this.emitFile({ type: "asset", fileName: "sw.js", source: code });
    },
  };
}

export default defineConfig({
  // Relative, so the build plays from any folder of a site.
  base: "./",
  server: { port: 5180 },
  preview: { port: 4180 },
  build: { target: "es2022" },
  plugins: [webGame(), noDebugMenu(), serviceWorker()],
});
