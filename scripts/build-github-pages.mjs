import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.resolve(process.argv[2] ?? path.join(repoRoot, "dist/github-pages"));
const relativeOutput = path.relative(repoRoot, outputRoot);

if (!relativeOutput || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput) || !relativeOutput.replaceAll("\\", "/").startsWith("dist/")) {
  throw new Error(`Refusing to replace unsafe Pages output: ${outputRoot}`);
}

const trackedBytes = execFileSync("git", [
  "ls-files", "-z", "--",
  "championship.html",
  "src",
  "assets/production",
  "docs/contracts/championship/raising-home-presentation.v1.json",
  "docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json"
]);
const trackedFiles = trackedBytes.toString("utf8").split("\0").filter(Boolean);
const dependencyFiles = [
  "node_modules/pixi.js/dist/pixi.mjs",
  "node_modules/three/build/three.module.js",
  "node_modules/three/build/three.core.js",
  "node_modules/three/examples/jsm/loaders/GLTFLoader.js",
  "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js",
  "node_modules/three/examples/jsm/utils/SkeletonUtils.js"
];

// These files are useful in the private repository but are direct ROM-derived
// production inputs. They are deliberately absent from the public Pages build
// until the release/rights gate is opened.
const privateRepositoryOnlyPath = /^(?:assets\/production\/internal-character-review\/|src\/championship\/battle\/battleCatalogs\.js|src\/data\/championship\/catalogs\/battle-[^/]+\.json)$/;

function copy(relativePath, destinationPath = relativePath) {
  const source = path.join(repoRoot, ...relativePath.split("/"));
  const destination = path.join(outputRoot, ...destinationPath.split("/"));
  if (!fs.statSync(source, { throwIfNoEntry: false })?.isFile()) throw new Error(`Pages input is missing: ${relativePath}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
for (const file of trackedFiles) {
  if (!privateRepositoryOnlyPath.test(file.replaceAll("\\", "/"))) copy(file);
}
for (const file of dependencyFiles) copy(file);
copy("championship.html", "index.html");
fs.writeFileSync(path.join(outputRoot, ".nojekyll"), "");

const forbiddenPath = /(?:^|\/)(?:internal-character-review|internal-faithful-baseline|original-rom-conversion-v1)(?:\/|$)|^src\/championship\/battle\/battleCatalogs\.js$|^src\/data\/championship\/catalogs\/battle-[^/]+\.json$|\.(?:nds|nsbmd|nsbca|nsbta|nsbma|nsbva)$/i;
const outputFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else outputFiles.push(path.relative(outputRoot, absolute).split(path.sep).join("/"));
  }
}
collect(outputRoot);
const forbiddenFiles = outputFiles.filter((file) => forbiddenPath.test(file));
if (forbiddenFiles.length > 0) throw new Error(`Forbidden internal/source assets entered Pages output:\n${forbiddenFiles.join("\n")}`);

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = {
  schemaVersion: 1,
  target: "GITHUB_PAGES_STATIC",
  commit,
  entry: "index.html",
  fileCount: outputFiles.length + 1,
  faithfulInternalVfxIncluded: false,
  romDerivedBattleCatalogsIncluded: false,
  sourcePayloadIncluded: false,
  saveStorage: "BROWSER_LOCAL_STORAGE"
};
fs.writeFileSync(path.join(outputRoot, "pages-build.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`GitHub Pages build: ${manifest.fileCount} files at ${outputRoot}`);
