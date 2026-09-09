// Copy every verified Battle static field into one production runtime bundle.
//
// Sources stay in YDIJ_PRIVATE_ROM_ART_PACK. Runtime only reads the 4x nearest
// PNG copies written here. ATR/COL/NBS/OPM and BM03/BM04 animation stay out.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ORIGINAL_BATTLE_FIELD_BINDINGS,
  ORIGINAL_BATTLE_FIELD_COUNT
} from "../src/championship/presentation/originalBattleFieldBindings.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1";
const PACK_ROOT = path.join(
  "R:",
  "Projects",
  "Championship2026",
  "YDIJ_PRIVATE_ROM_ART_PACK",
  "03_MAPS",
  "battle-11-native-gallery"
);
const DEST_REL = "assets/production/battle/licensed-runtime-v1";
const DEST = path.join(root, DEST_REL);
const NATIVE_WIDTH = 416;
const NATIVE_HEIGHT = 272;
const WORLD_WIDTH = 1664;
const WORLD_HEIGHT = 1088;

function fail(message) {
  throw new Error(`CHAMPIONSHIP_LICENSED_BATTLE_RUNTIME: ${message}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function nearest4xBatch(jobs) {
  if (jobs.length === 0) return;
  const jobsPath = path.join(DEST, "_nearest-jobs.json");
  fs.writeFileSync(jobsPath, JSON.stringify(jobs));
  const py = [
    "import json, sys",
    "from PIL import Image",
    "jobs = json.load(open(sys.argv[1], encoding='utf-8'))",
    "for job in jobs:",
    "    im = Image.open(job['src'])",
    `    if im.size != (${NATIVE_WIDTH}, ${NATIVE_HEIGHT}):`,
    "        raise SystemExit(f\"UNEXPECTED_NATIVE_SIZE:{im.size}:{job['src']}\")",
    `    im.resize((${WORLD_WIDTH}, ${WORLD_HEIGHT}), Image.Resampling.NEAREST).save(job['dest'])`
  ].join("\n");
  const result = spawnSync("python", ["-c", py, jobsPath], { encoding: "utf8" });
  fs.rmSync(jobsPath, { force: true });
  if (result.status !== 0) fail(`NEAREST_4X_FAILED ${result.stderr || result.stdout || result.status}`);
}

if (ORIGINAL_BATTLE_FIELD_BINDINGS.length !== ORIGINAL_BATTLE_FIELD_COUNT) {
  fail(`BINDING_COUNT_DRIFT:${ORIGINAL_BATTLE_FIELD_BINDINGS.length}`);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

const resizeJobs = [];
const runtimeFields = [];

for (const binding of ORIGINAL_BATTLE_FIELD_BINDINGS) {
  const native = path.join(PACK_ROOT, binding.fieldId, "clean", "native_static_game_view.png");
  if (!fs.existsSync(native)) fail(`MISSING_CLEAN_STATIC:${native}`);

  const fieldDirRel = `${DEST_REL}/fields/${binding.fieldId}`;
  const fieldDir = path.join(root, fieldDirRel);
  fs.mkdirSync(fieldDir, { recursive: true });
  const destPath = path.join(fieldDir, "frame-00.png");
  resizeJobs.push({ src: native, dest: destPath });

  runtimeFields.push({
    fieldId: binding.fieldId,
    identifier: binding.identifier,
    arenaIndex: binding.arenaIndex,
    worldWidthPx: WORLD_WIDTH,
    worldHeightPx: WORLD_HEIGHT,
    nativeWidthPx: NATIVE_WIDTH,
    nativeHeightPx: NATIVE_HEIGHT,
    nativeSha256: sha256File(native),
    visualRole: "BATTLE_ARENA",
    hasCommonLayer: binding.hasCommonLayer,
    animationStatus: binding.animationStatus,
    objectLayerId: binding.objectLayerId,
    gameplayBinding: "EXTERNAL_EXISTING_RUNTIME",
    gateMapping: "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED",
    collisionBinding: "EXTERNAL_NOT_IN_ART_BUNDLE",
    frames: [{
      src: `${fieldDirRel}/frame-00.png`.replaceAll("\\", "/"),
      sha256: null,
      durationMs: null
    }]
  });
}

nearest4xBatch(resizeJobs);

for (const field of runtimeFields) {
  for (const frame of field.frames) {
    frame.sha256 = sha256File(path.join(root, frame.src));
  }
}

runtimeFields.sort((left, right) => left.fieldId.localeCompare(right.fieldId));

const manifest = {
  schemaVersion: 1,
  assetId: "art:battle:licensed-runtime:v1",
  family: "BATTLE",
  product: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  artifactMaturity: "LICENSED_PIXEL_FAITHFUL_NEAREST_HD_BATTLE_FIELDS",
  productionStatus: "OWNER_APPROVED_LICENSED_PIXEL_RUNTIME",
  shippingStatus: "NOT_SHIPPING_READY",
  humanApproved: true,
  runtimeEligible: true,
  shippingReady: false,
  rightsStatus: "LICENSED",
  rights: {
    status: "LICENSED",
    authority: "assets/production/ART_PRODUCTION_INDEX.json",
    ownerDirective: "docs/coordination/OWNER_DIRECTION.md#2026-09-02",
    sourceRomSha256: SOURCE_ROM_SHA256,
    researchPack: "NOT_RUNTIME_READABLE",
    sourceGallery: "YDIJ_PRIVATE_ROM_ART_PACK/03_MAPS/battle-11-native-gallery"
  },
  fieldCount: runtimeFields.length,
  defaultPreviewFieldId: "field_bm01_01",
  defaultPreviewNote: "Default arenaIndex 0 is BATTLE_NORMAL. Match-to-arena mapping is untraced. Native 416x272 is contain-fit into the 3:2 field band; do not stretch.",
  memoryPolicy: "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT",
  filter: "nearest",
  fields: runtimeFields,
  notes: [
    "One resident field at a time. Collision, ATR and stand positions stay in battle runtime.",
    "Clean static views already include the shared common layer and field objects. Do not composite field_bm00_00 a second time.",
    "BATTLE_CYBERSPACE has no common layer. Ten other arenas catalog-link field_bm00_00_common.",
    "BM03 and BM04 keep one static frame. BSAR placement and timing remain UNKNOWN_REQUIRES_TRACE."
  ]
};

fs.writeFileSync(path.join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote licensed Battle runtime: ${runtimeFields.length} static fields, 0 animated.`);
