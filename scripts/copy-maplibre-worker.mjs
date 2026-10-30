// maplibre-gl 6 loads its web worker from a file next to its own script. Bundlers
// (Turbopack) inline the script into a chunk, so that sibling file is missing at
// runtime ("Worker failed to load"). Serve the worker from /public instead; see
// setWorkerUrl() in components/ui/map/ActivityMap.tsx.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(join(pkgDir, "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.js"));
