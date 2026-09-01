import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist/github-pages");
const required = [
  "index.html",
  "championship.html",
  ".nojekyll",
  "pages-build.json",
  "src/championship/app/main.js",
  "docs/contracts/championship/raising-home-presentation.v1.json",
  "docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json",
  "node_modules/pixi.js/dist/pixi.mjs",
  "node_modules/three/build/three.module.js",
  "node_modules/three/build/three.core.js"
];
for (const relative of required) {
  if (!fs.statSync(path.join(root, ...relative.split("/")), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`GitHub Pages output is missing ${relative}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "pages-build.json"), "utf8"));
if (
  manifest.target !== "GITHUB_PAGES_STATIC" ||
  manifest.faithfulInternalVfxIncluded !== false ||
  manifest.romDerivedBattleCatalogsIncluded !== false ||
  manifest.sourcePayloadIncluded !== false
) {
  throw new Error("GitHub Pages manifest crossed the public/internal asset boundary");
}

const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else files.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
}
collect(root);
const forbidden = files.filter((file) => /(?:internal-faithful-baseline|original-rom-conversion-v1)|^src\/championship\/battle\/battleCatalogs\.js$|^src\/data\/championship\/catalogs\/battle-[^/]+\.json$|\.(?:nds|nsbmd|nsbca|nsbta|nsbma|nsbva)$/i.test(file));
if (forbidden.length > 0) throw new Error(`Forbidden Pages files: ${forbidden.join(", ")}`);
console.log(`GitHub Pages validation passed: ${files.length} files, internal ROM-derived inputs excluded.`);
