import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const outputRoot = path.resolve(repo, "assets/production/internal-faithful-baseline/v1");
const expectedRoot = path.resolve(repo, "assets/production/internal-faithful-baseline");
if (!outputRoot.startsWith(`${expectedRoot}${path.sep}`)) throw new Error("Unsafe internal baseline target");

const sources = [
  ["characterRoster", "docs/art/production/characters/faithful-hd224"],
  ["uiHud", "docs/art/production/ui/faithful-hd96"],
  ["cageFields", "docs/art/production/cage/hd-remaster-v1"],
  ["huntField", "docs/art/production/hunt/hd-remaster-v1"],
  ["vfx", "docs/art/production/vfx/faithful-reference-26"]
];

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listFiles(root) {
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(absolute));
    else output.push(absolute);
  }
  return output;
}

function ensureHardLink(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) {
    const sourceStat = fs.statSync(source);
    const destinationStat = fs.statSync(destination);
    if (sourceStat.size === destinationStat.size && hash(source) === hash(destination)) return "REUSED";
    fs.unlinkSync(destination);
  }
  try {
    fs.linkSync(source, destination);
    return "HARD_LINK";
  } catch (error) {
    fs.copyFileSync(source, destination);
    return `COPY_FALLBACK:${error.code ?? "UNKNOWN"}`;
  }
}

const slots = {};
let totalFiles = 0;
let logicalBytes = 0;
let hardLinks = 0;
let copyFallbacks = 0;

for (const [slotId, relativeSource] of sources) {
  const sourceRoot = path.resolve(repo, relativeSource);
  if (!fs.statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Missing source: ${relativeSource}`);
  const files = [];
  for (const source of listFiles(sourceRoot).sort()) {
    const relative = path.relative(sourceRoot, source);
    const destination = path.join(outputRoot, slotId, relative);
    const linkMode = ensureHardLink(source, destination);
    const stat = fs.statSync(source);
    totalFiles += 1;
    logicalBytes += stat.size;
    hardLinks += Number(linkMode === "HARD_LINK" || linkMode === "REUSED");
    copyFallbacks += Number(linkMode.startsWith("COPY_FALLBACK"));
    files.push({
      path: path.relative(repo, destination).split(path.sep).join("/"),
      source: path.relative(repo, source).split(path.sep).join("/"),
      bytes: stat.size,
      sha256: hash(source),
      linkMode
    });
  }
  slots[slotId] = {
    state: "DIRECT_INTERNAL_BASELINE_READY",
    source: relativeSource,
    fileCount: files.length,
    logicalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files
  };
}

for (const slotId of ["raisingHome", "battleFields", "gateSelect", "packaging"]) {
  slots[slotId] = {
    state: "NOT_READY_USE_TEMPORARY_FALLBACK",
    source: null,
    fileCount: 0,
    logicalBytes: 0,
    files: []
  };
}

const manifest = {
  schemaVersion: 1,
  packId: "championship:pack:faithful-original",
  role: "OWNER_AUTHORIZED_NON_PUBLIC_INTERNAL_BASELINE",
  binding: "DIRECT_NO_USER_FACING_LOADER",
  publicReleasePermitted: false,
  shippingReady: false,
  sourcePayloadIncluded: false,
  gameplayOrSaveChangesPermitted: false,
  complete: false,
  readySlotCount: Object.values(slots).filter((slot) => slot.state === "DIRECT_INTERNAL_BASELINE_READY").length,
  totalSlotCount: Object.keys(slots).length,
  totalFiles,
  logicalBytes,
  hardLinks,
  copyFallbacks,
  slots
};
fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Internal faithful baseline: ${manifest.readySlotCount}/${manifest.totalSlotCount} slots, ${totalFiles} files, ${(logicalBytes / 1048576).toFixed(2)} logical MiB.`);
