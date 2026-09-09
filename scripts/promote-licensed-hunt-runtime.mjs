// Copy every verified Hunt variant into one production runtime bundle.
//
// Sources stay in YDIJ_PRIVATE_ROM_ART_PACK. Runtime only reads the copies
// written here. Collision and encounter tables are never copied.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ORIGINAL_HUNT_FIELD_BINDINGS,
  ORIGINAL_HUNT_TUTORIAL_BINDING
} from "../src/championship/gate/originalHuntFieldBindings.js";
import { originalMapAnimationTicksToMs } from "../src/championship/presentation/originalMapAnimationTiming.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1";
const PACK_ROOT = path.join(
  "R:",
  "Projects",
  "Championship2026",
  "YDIJ_PRIVATE_ROM_ART_PACK",
  "03_MAPS",
  "hunt-30-variants"
);
const DEST_REL = "assets/production/hunt/licensed-runtime-v1";
const DEST = path.join(root, DEST_REL);
const PACK_MANIFEST = path.join(PACK_ROOT, "manifest.json");
const LEGACY_DIR = path.join(root, "assets", "production", "hunt", "licensed-hm00-tutorial");

function fail(message) {
  throw new Error(`CHAMPIONSHIP_LICENSED_HUNT_RUNTIME: ${message}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function requiredGateFieldIds() {
  const ids = new Set([ORIGINAL_HUNT_TUTORIAL_BINDING.fieldId]);
  for (const binding of Object.values(ORIGINAL_HUNT_FIELD_BINDINGS)) {
    ids.add(binding.dayFieldId);
    ids.add(binding.nightFieldId);
  }
  return ids;
}

function nearest2xBatch(jobs) {
  if (jobs.length === 0) return;
  const jobsPath = path.join(DEST, "_nearest-jobs.json");
  fs.writeFileSync(jobsPath, JSON.stringify(jobs));
  const py = [
    "import json, sys",
    "from PIL import Image",
    "jobs = json.load(open(sys.argv[1], encoding='utf-8'))",
    "for job in jobs:",
    "    im = Image.open(job['src'])",
    "    if im.size != (1024, 1024):",
    "        raise SystemExit(f\"UNEXPECTED_NATIVE_SIZE:{im.size}:{job['src']}\")",
    "    im.resize((2048, 2048), Image.Resampling.NEAREST).save(job['dest'])"
  ].join("\n");
  const result = spawnSync("python", ["-c", py, jobsPath], { encoding: "utf8" });
  fs.rmSync(jobsPath, { force: true });
  if (result.status !== 0) fail(`NEAREST_2X_FAILED ${result.stderr || result.stdout || result.status}`);
}

function removeLegacyTutorialBundle() {
  if (!fs.existsSync(LEGACY_DIR)) return;
  fs.rmSync(LEGACY_DIR, { recursive: true, force: true });
}

if (!fs.existsSync(PACK_MANIFEST)) fail(`MISSING_PACK_MANIFEST:${PACK_MANIFEST}`);
const pack = JSON.parse(fs.readFileSync(PACK_MANIFEST, "utf8"));
if (!Array.isArray(pack.fields) || pack.fields.length !== 30) {
  fail(`UNEXPECTED_PACK_FIELD_COUNT:${pack.fields?.length}`);
}

const wanted = requiredGateFieldIds();
const packIds = new Set(pack.fields.map((field) => field.fieldId));
for (const fieldId of wanted) {
  if (!packIds.has(fieldId)) fail(`MISSING_PACK_FIELD:${fieldId}`);
}

fs.mkdirSync(DEST, { recursive: true });
const resizeJobs = [];
const runtimeFields = [];

for (const source of pack.fields) {
  const fieldDirRel = `${DEST_REL}/fields/${source.fieldId}`;
  const fieldDir = path.join(root, fieldDirRel);
  fs.mkdirSync(fieldDir, { recursive: true });
  const frames = [];
  const animation = source.animation;
  const animated = animation?.status === "PRESENT_EXACT_LAYER_COMPOSITED"
    && Array.isArray(animation.frames)
    && animation.frames.length > 0;

  if (animated) {
    for (const [index, animFrame] of animation.frames.entries()) {
      const destName = `frame-${String(index).padStart(2, "0")}.png`;
      const destPath = path.join(fieldDir, destName);
      const hd2x = index === 0 && source.faithfulHd2x?.file
        ? path.join(PACK_ROOT, source.faithfulHd2x.file)
        : null;
      if (hd2x && fs.existsSync(hd2x)) {
        fs.copyFileSync(hd2x, destPath);
      } else {
        const native = path.join(PACK_ROOT, animFrame.compositeFile);
        if (!fs.existsSync(native)) fail(`MISSING_COMPOSITE:${native}`);
        resizeJobs.push({ src: native, dest: destPath });
      }
      const rawTicks = animFrame.durationRawTicks;
      frames.push({
        src: `${fieldDirRel}/${destName}`.replaceAll("\\", "/"),
        sha256: null,
        durationRawTicks: rawTicks,
        durationMs: originalMapAnimationTicksToMs(rawTicks),
        durationEvidence: "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK"
      });
    }
  } else {
    const hd2x = source.faithfulHd2x?.file ? path.join(PACK_ROOT, source.faithfulHd2x.file) : null;
    if (!hd2x || !fs.existsSync(hd2x)) fail(`MISSING_HD2X:${source.fieldId}`);
    const destPath = path.join(fieldDir, "frame-00.png");
    fs.copyFileSync(hd2x, destPath);
    frames.push({
      src: `${fieldDirRel}/frame-00.png`.replaceAll("\\", "/"),
      sha256: null,
      durationMs: null
    });
  }

  runtimeFields.push({
    fieldId: source.fieldId,
    worldWidthPx: 2048,
    worldHeightPx: 2048,
    gameplayBinding: "EXTERNAL_EXISTING_RUNTIME",
    gateMapping: "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED",
    collisionBinding: "EXTERNAL_NOT_IN_ART_BUNDLE",
    frames
  });
}

nearest2xBatch(resizeJobs);

for (const field of runtimeFields) {
  for (const frame of field.frames) {
    const abs = path.join(root, frame.src);
    frame.sha256 = sha256File(abs);
  }
}

runtimeFields.sort((left, right) => left.fieldId.localeCompare(right.fieldId));

const manifest = {
  schemaVersion: 1,
  assetId: "art:hunt:licensed-runtime:v1",
  family: "HUNT",
  product: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  artifactMaturity: "LICENSED_PIXEL_FAITHFUL_NEAREST_HD_HUNT_FIELDS",
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
    researchPack: "NOT_RUNTIME_READABLE"
  },
  fieldCount: runtimeFields.length,
  tutorialFieldId: ORIGINAL_HUNT_TUTORIAL_BINDING.fieldId,
  originalHuntId: ORIGINAL_HUNT_TUTORIAL_BINDING.huntId,
  memoryPolicy: "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT",
  filter: "nearest",
  fields: runtimeFields,
  notes: [
    "One resident field at a time. Collision and encounters stay in Hunt runtime.",
    "hm00 is HUNT_TUTORIAL, not a Gate biome. Gate hunts load originalFields.dayFieldId.",
    "Night variants are stored; day/night selection remains untraced and is not invented.",
    "Extra animation frames without a pack HD2x file are 2x nearest of the native composite."
  ]
};

fs.writeFileSync(path.join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
removeLegacyTutorialBundle();
console.log(`Wrote licensed Hunt runtime: ${runtimeFields.length} fields, ${resizeJobs.length} nearest-enlarged frames.`);
