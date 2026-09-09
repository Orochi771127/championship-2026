// Build the internal character material set from the Owner-supplied art pack.
// No image editing, ROM binaries, gameplay tables, or inferred action bindings.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pack = path.resolve(process.argv[2] ?? path.join(repo, "../YDIJ_PRIVATE_ROM_ART_PACK"));
const sourceRoot = path.join(pack, "02_CHARACTERS/use-ready-pixi-hd4x-224");
const outputRelative = "assets/production/internal-faithful-baseline/characters-v1";
const outputRoot = path.join(repo, outputRelative);
const indexPath = path.join(repo, "assets/production/ART_PRODUCTION_INDEX.json");
const indexBefore = fs.readFileSync(indexPath);
const assetId = "art:characters:licensed-internal:v1";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function safeSource(directory, name) {
  requireValue(typeof name === "string" && /^[\w.-]+$/.test(name), `Unsafe source name: ${name}`);
  const file = path.join(directory, name);
  requireValue(fs.realpathSync(file).startsWith(`${fs.realpathSync(sourceRoot)}${path.sep}`), "Source outside pack");
  return file;
}
const packMetadata = read(path.join(pack, "00_METADATA/PACK_MANIFEST.json"));
requireValue(packMetadata.classification.rightsStatus === "LICENSED", "Owner-licensed source pack required");
const master = read(path.join(sourceRoot, "manifest.json"));
requireValue(master.entityCount === 224 && master.batches.length === 7, "Incomplete source roster");
const species = read(path.join(repo, "src/data/championship/catalogs/creature-species.r1.json"));
const jobs = new Map();
const records = [];
const counts = { entities: 0, eggs: 0, regular: 0, cells: 0, sequences: 0, atlasPages: 0, bytes: 0 };
function schedule(relative, bytes) {
  requireValue(!jobs.has(relative), `Duplicate output: ${relative}`);
  jobs.set(relative, bytes);
  return { path: relative, sha256: hash(bytes), bytes: bytes.length };
}
for (const batch of master.batches) {
  requireValue(/^batch-0[1-7]$/.test(batch.directory), "Invalid batch directory");
  const batchRoot = path.join(sourceRoot, batch.directory);
  const batchManifest = read(path.join(batchRoot, "manifest.json"));
  for (const record of batchManifest.records) {
    requireValue(/^[em]\d{3}_[a-z0-9_]+$/.test(record.entityId), "Invalid entity identity");
    const entityRoot = path.join(batchRoot, record.entityId);
    const sourceRuntimeFile = safeSource(entityRoot, record.runtime);
    const sourceRuntimeBytes = fs.readFileSync(sourceRuntimeFile);
    requireValue(hash(sourceRuntimeBytes) === record.runtimeSha256, `Runtime hash mismatch: ${record.entityId}`);
    const runtime = JSON.parse(sourceRuntimeBytes);
    requireValue(runtime.entityId === record.entityId, "Runtime identity mismatch");
    const files = [];
    const sideCounts = {};
    for (const sideName of ["main", "sub"]) {
      const sourceSide = record[sideName];
      const runtimeSide = runtime.sides[sideName];
      const keys = new Set();
      requireValue(runtimeSide.atlases.length === sourceSide.atlasPages.length, "Atlas page count mismatch");
      for (const [pageIndex, page] of sourceSide.atlasPages.entries()) {
        const runtimePage = runtimeSide.atlases[pageIndex];
        requireValue(runtimePage.data === page.data && runtimePage.image === page.image, "Runtime atlas path mismatch");
        for (const kind of ["image", "data"]) {
          const bytes = fs.readFileSync(safeSource(entityRoot, page[kind]));
          requireValue(hash(bytes) === page[`${kind}Sha256`], `Atlas hash mismatch: ${record.entityId}/${page[kind]}`);
          files.push(schedule(`${record.entityId}/${page[kind]}`, bytes));
        }
        const atlas = read(safeSource(entityRoot, page.data));
        requireValue(atlas.meta.image === page.image, "Atlas image dependency mismatch");
        requireValue(page.width <= 2048 && page.height <= 2048, "Atlas exceeds mobile budget");
        for (const [key, frame] of Object.entries(atlas.frames)) {
          requireValue(!keys.has(key), `Duplicate cell: ${key}`);
          requireValue(frame.frame.x >= 0 && frame.frame.y >= 0
            && frame.frame.x + frame.frame.w <= page.width
            && frame.frame.y + frame.frame.h <= page.height, `Out-of-bounds cell: ${key}`);
          keys.add(key);
        }
        counts.atlasPages += 1;
      }
      requireValue(keys.size === sourceSide.cellCount, "Cell count mismatch");
      requireValue(runtimeSide.animations.length === sourceSide.sequenceCount, "Sequence count mismatch");
      for (const animation of runtimeSide.animations) {
        requireValue(animation.frames.length > 0, "Empty animation");
        for (const frame of animation.frames) requireValue(keys.has(frame.texture) && frame.ticks > 0, "Invalid animation frame");
        // Archival semantic aliases are hypotheses, not executable bindings.
        animation.semanticAlias = null;
        animation.semanticEvidence = "UNKNOWN_REQUIRES_TRACE";
      }
      counts.cells += keys.size;
      counts.sequences += runtimeSide.animations.length;
      sideCounts[sideName] = { cells: keys.size, sequences: runtimeSide.animations.length,
        rgbaBytes: sourceSide.atlasPages.reduce((sum, page) => sum + page.width * page.height * 4, 0) };
    }
    runtime.artProfile.runtimeEligible = true;
    runtime.artProfile.shippingReady = false;
    runtime.artProfile.publicReleasePermitted = false;
    runtime.artProfile.normalPresentation = "STATIC_FIRST_SOURCE_FRAME_UNTIL_ACTION_BINDING_IS_VERIFIED";
    files.push(schedule(`${record.entityId}/runtime.json`, Buffer.from(serialize(runtime))));
    records.push({ entityId: record.entityId, kind: record.kind,
      runtime: `${record.entityId}/runtime.json`, sourceRuntimeSha256: hash(sourceRuntimeBytes), sides: sideCounts, files });
    counts.entities += 1;
    counts[record.kind === "egg" ? "eggs" : "regular"] += 1;
  }
}
requireValue(new Set(records.map((record) => record.entityId)).size === 224 && counts.eggs === 8, "Roster completeness mismatch");
const entityIds = new Set(records.map((record) => record.entityId));
const bindings = species.records.map((record) => {
  requireValue(entityIds.has(record.lookupKey), `Unmatched species: ${record.recordIndex}/${record.lookupKey}`);
  return { speciesId: `species-${String(record.recordIndex).padStart(3, "0")}`, entityId: record.lookupKey };
});
counts.bytes = [...jobs.values()].reduce((sum, bytes) => sum + bytes.length, 0);
const manifest = { schemaVersion: 1, assetId, runtimeEligible: true, shippingReady: false,
  productionStatus: "OWNER_AUTHORIZED_INTERNAL_CHARACTER_MATERIALS", shippingStatus: "NOT_SHIPPING_READY",
  artifactMaturity: "PIXEL_FAITHFUL_224_RAW_TIMELINES_STATIC_NORMAL_PRESENTATION",
  publicReleasePermitted: false, humanApproved: false, rightsStatus: "LICENSED",
  ownerDirective: "docs/coordination/OWNER_DIRECTION.md#2026-09-02",
  sourceRomSha256: packMetadata.sourceRom.sha256,
  sourcePack: "YDIJ_PRIVATE_ROM_ART_PACK/02_CHARACTERS/use-ready-pixi-hd4x-224",
  visualPolicy: "EXACT_EXISTING_RGBA_ATLASES_NO_REDRAW_NO_RECOLOR",
  animationBinding: "UNKNOWN_REQUIRES_TRACE_STATIC_FIRST_SOURCE_FRAME",
  memoryPolicy: "ONLY_SCENE_SPECIES_MAIN_ATLASES_LOAD_ON_ENTRY_UNLOAD_ON_EXIT",
  counts, speciesBindings: bindings, records };
jobs.set("manifest.json", Buffer.from(serialize(manifest)));
// Validate the entire input and all output collisions before writing anything.
for (const [relative, bytes] of jobs) {
  const destination = path.join(outputRoot, relative);
  requireValue(!fs.existsSync(destination) || hash(fs.readFileSync(destination)) === hash(bytes), `Existing output differs; preserve and review: ${relative}`);
}
requireValue(fs.readFileSync(indexPath).equals(indexBefore), "ART_INDEX_CHANGED_ABORT_AND_REREAD");
for (const [relative, bytes] of jobs) {
  const destination = path.join(outputRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!fs.existsSync(destination)) fs.writeFileSync(destination, bytes, { flag: "wx" });
}
const index = JSON.parse(indexBefore);
const entry = { assetId, manifestPath: `${outputRelative}/manifest.json`, rightsStatus: "LICENSED",
  productionStatus: manifest.productionStatus, shippingStatus: manifest.shippingStatus, humanApproved: false,
  runtimeEligible: true, publicReleasePermitted: false, shippingReady: false, maturity: manifest.artifactMaturity };
const prior = index.entries.findIndex((item) => item.assetId === assetId);
if (prior < 0) index.entries.push(entry); else index.entries[prior] = entry;
index.summary.registeredRuntimeBundles = index.entries.length;
index.summary.shippingReadyBundles = index.entries.filter((item) => item.shippingReady === true).length;
requireValue(fs.readFileSync(indexPath).equals(indexBefore), "ART_INDEX_CHANGED_ABORT_AND_REREAD");
fs.writeFileSync(`${indexPath}.character-pending`, serialize(index), { flag: "wx" });
requireValue(fs.readFileSync(indexPath).equals(indexBefore), "ART_INDEX_CHANGED_ABORT_AND_REREAD");
fs.renameSync(`${indexPath}.character-pending`, indexPath);
console.log(JSON.stringify({ outputRelative, ...counts, speciesBindings: bindings.length, sourceValidated: true, shippingReady: false }));
