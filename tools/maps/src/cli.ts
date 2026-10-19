import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "@civ/sprites-tool";
import { WORLD_SIZES, type WorldSize } from "@civ/core";
import { buildWorld, worldModule, type BuiltWorld, type GeoData } from "./build.js";
import { FRAMES } from "./frames.js";
import { polylines, readGeo, shapes } from "./geo.js";

/**
 * npm run maps [-- world-id ...]
 *
 * Rebuilds the premade worlds in packages/core/src/map/worlds from Natural
 * Earth's 1:50m land, lakes, rivers and geography regions (public domain,
 * downloaded once into tools/maps/.cache), each at every world size, and
 * writes a preview PNG of each size into tools/maps/out (`earth-large.png`).
 */
const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const CACHE = join(ROOT, ".cache");
const OUT = join(ROOT, "out");
const WORLDS = resolve(ROOT, "../../packages/core/src/map/worlds");
const SOURCE = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/";
const LAYERS = {
  land: "ne_50m_land.geojson",
  lakes: "ne_50m_lakes.geojson",
  regions: "ne_50m_geography_regions_polys.geojson",
  rivers: "ne_50m_rivers_lake_centerlines.geojson",
};

async function fetchLayer(file: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true });
    console.log(`downloading ${file}`);
    const res = await fetch(SOURCE + file);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

async function main(ids: string[]): Promise<void> {
  const data: GeoData = {
    land: shapes(readGeo(await fetchLayer(LAYERS.land))),
    lakes: shapes(readGeo(await fetchLayer(LAYERS.lakes))),
    regions: shapes(readGeo(await fetchLayer(LAYERS.regions))),
    rivers: polylines(readGeo(await fetchLayer(LAYERS.rivers))),
  };
  mkdirSync(OUT, { recursive: true });
  const frames = ids.length ? FRAMES.filter((f) => ids.includes(f.id)) : FRAMES;
  if (!frames.length) throw new Error(`unknown world (known: ${FRAMES.map((f) => f.id).join(", ")})`);
  for (const frame of frames) {
    const built = {} as Record<WorldSize, BuiltWorld>;
    for (const { id: size, width, height } of WORLD_SIZES) {
      const t0 = performance.now();
      const world = buildWorld(frame, data, size);
      built[size] = world;
      writeFileSync(join(OUT, `${frame.id}-${size}.png`), encodePng(world.preview));
      console.log(`${frame.name} ${width}x${height}: ${Math.round(performance.now() - t0)} ms`);
      for (const line of world.report) console.log(`  ${line}`);
    }
    writeFileSync(join(WORLDS, `${frame.id}.ts`), worldModule(frame, built));
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
