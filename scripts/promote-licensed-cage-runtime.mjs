// Copy every verified Cage visual field into one production runtime bundle.
//
// Source is the already-composed faithful-hd40 baseline in this repo.
// Runtime only reads the PNG copies written here. ATR/COL/NBS/OPM stay out.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS,
  ORIGINAL_CAGE_STRUCTURAL_VISUALS,
  ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS
} from "../src/championship/presentation/originalCageVisualBindings.js";
import { originalMapAnimationTicksToMs } from "../src/championship/presentation/originalMapAnimationTiming.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1";
const SOURCE_REL = "docs/art/production/cage/faithful-hd40";
const SOURCE = path.join(root, SOURCE_REL);
const DEST_REL = "assets/production/cage/licensed-runtime-v1";
const DEST = path.join(root, DEST_REL);
const SOURCE_MANIFEST = path.join(SOURCE, "manifest.json");
const EXPECTED_FIELD_COUNT = 40;
const ANIMATED_FIELD_IDS = Object.freeze([
  "field_cm07_01",
  "field_cm09_01",
  "field_cm21_01",
  "field_cm39_01"
]);

function fail(message) {
  throw new Error(`CHAMPIONSHIP_LICENSED_CAGE_RUNTIME: ${message}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function requiredFieldIds() {
  const ids = new Set();
  for (const binding of ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS) ids.add(binding.fieldId);
  for (const binding of ORIGINAL_CAGE_STRUCTURAL_VISUALS) ids.add(binding.fieldId);
  for (const fieldId of ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS) ids.add(fieldId);
  return ids;
}

function visualRoleFor(fieldId) {
  const definition = ORIGINAL_CAGE_DEFINITION_VISUAL_BINDINGS.find((entry) => entry.fieldId === fieldId);
  if (definition) return definition.role;
  const structural = ORIGINAL_CAGE_STRUCTURAL_VISUALS.find((entry) => entry.fieldId === fieldId);
  if (structural) return structural.role;
  if (ORIGINAL_CAGE_UNREFERENCED_VISUAL_ASSETS.includes(fieldId)) return "UNREFERENCED_VISUAL_ASSET";
  fail(`UNKNOWN_VISUAL_ROLE:${fieldId}`);
}

if (!fs.existsSync(SOURCE_MANIFEST)) fail(`MISSING_SOURCE_MANIFEST:${SOURCE_MANIFEST}`);
const source = JSON.parse(fs.readFileSync(SOURCE_MANIFEST, "utf8"));
if (!Array.isArray(source.fields) || source.fields.length !== EXPECTED_FIELD_COUNT) {
  fail(`UNEXPECTED_SOURCE_FIELD_COUNT:${source.fields?.length}`);
}
if (JSON.stringify(source.animatedLayerFields) !== JSON.stringify(ANIMATED_FIELD_IDS)) {
  fail("ANIMATED_FIELD_LIST_DRIFT");
}

const wanted = requiredFieldIds();
if (wanted.size !== EXPECTED_FIELD_COUNT) fail(`REQUIRED_FIELD_COUNT_DRIFT:${wanted.size}`);
const packIds = new Set(source.fields.map((field) => field.fieldId));
for (const fieldId of wanted) {
  if (!packIds.has(fieldId)) fail(`MISSING_SOURCE_FIELD:${fieldId}`);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
const runtimeFields = [];

for (const entry of source.fields) {
  const fieldDirRel = `${DEST_REL}/fields/${entry.fieldId}`;
  const fieldDir = path.join(root, fieldDirRel);
  fs.mkdirSync(fieldDir, { recursive: true });

  const hd4x = path.join(SOURCE, entry.faithfulHd4x.file);
  if (!fs.existsSync(hd4x)) fail(`MISSING_HD4X:${entry.fieldId}`);
  const frame0 = path.join(fieldDir, "frame-00.png");
  fs.copyFileSync(hd4x, frame0);

  const frames = [{
    src: `${fieldDirRel}/frame-00.png`.replaceAll("\\", "/"),
    sha256: null,
    durationMs: null
  }];

  const animated = entry.animatedLayer?.status === "PRESENT_VERIFIED_ROM_DECODED";
  if (animated) {
    if (entry.animatedLayer.frameCount !== 2) fail(`UNEXPECTED_ANIM_FRAME_COUNT:${entry.fieldId}`);
    const ticks = entry.animatedLayer.frameDurationsRawTicks;
    if (!Array.isArray(ticks) || ticks.length !== 2) fail(`MISSING_ANIM_TICKS:${entry.fieldId}`);
    const extra = path.join(SOURCE, entry.animatedLayer.alternateFaithfulHd4xFrame.file);
    if (!fs.existsSync(extra)) fail(`MISSING_HD4X_FRAME_01:${entry.fieldId}`);
    const frame1 = path.join(fieldDir, "frame-01.png");
    fs.copyFileSync(extra, frame1);
    frames[0].durationRawTicks = ticks[0];
    frames[0].durationMs = originalMapAnimationTicksToMs(ticks[0]);
    frames[0].durationEvidence = "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK";
    frames.push({
      src: `${fieldDirRel}/frame-01.png`.replaceAll("\\", "/"),
      sha256: null,
      durationRawTicks: ticks[1],
      durationMs: originalMapAnimationTicksToMs(ticks[1]),
      durationEvidence: "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK"
    });
  }

  runtimeFields.push({
    fieldId: entry.fieldId,
    worldWidthPx: entry.faithfulHd4x.width,
    worldHeightPx: entry.faithfulHd4x.height,
    nativeWidthPx: entry.nativeOriginal.width,
    nativeHeightPx: entry.nativeOriginal.height,
    visualRole: visualRoleFor(entry.fieldId),
    gameplayBinding: "EXTERNAL_EXISTING_RUNTIME",
    gateMapping: "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED",
    collisionBinding: "EXTERNAL_NOT_IN_ART_BUNDLE",
    frames
  });
}

for (const field of runtimeFields) {
  for (const frame of field.frames) {
    frame.sha256 = sha256File(path.join(root, frame.src));
  }
}

runtimeFields.sort((left, right) => left.fieldId.localeCompare(right.fieldId));

const manifest = {
  schemaVersion: 1,
  assetId: "art:cage:licensed-runtime:v1",
  family: "CAGE",
  product: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  artifactMaturity: "LICENSED_PIXEL_FAITHFUL_NEAREST_HD_CAGE_FIELDS",
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
    sourceBaseline: SOURCE_REL
  },
  fieldCount: runtimeFields.length,
  defaultPreviewFieldId: "field_cm01_01",
  defaultPreviewNote: "CageDefinition 0 visual. VS1 habitat regions remain product-authored drop targets; this is not original ranch layout.",
  memoryPolicy: "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT",
  filter: "nearest",
  fields: runtimeFields,
  notes: [
    "One resident field at a time. Collision, ATR and ranch placement stay in Cage runtime.",
    "cm33/cm36/cm38 are stored unreferenced assets. cm29 is LID. cm28 is Waiting Room.",
    "Animated water/terrain uses verified raw ticks. Do not invent 60fps.",
    "CM27 center-mark removal is remake-only. This bundle keeps the exact original pixels."
  ]
};

fs.writeFileSync(path.join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote licensed Cage runtime: ${runtimeFields.length} fields, ${ANIMATED_FIELD_IDS.length} animated.`);
