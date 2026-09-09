// Copy every verified Nitro 3D VFX conversion into one production runtime bundle.
//
// Source is the already-converted faithful-reference-26 baseline in this repo.
// Runtime only reads the GLB/PNG/JSON copies written here. Nitro binaries stay out.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ORIGINAL_NITRO_VFX_EVENT_ALIASES,
  ORIGINAL_NITRO_VFX_SYSTEM_COUNT,
  ORIGINAL_NITRO_VFX_SYSTEMS
} from "../src/championship/presentation/vfx/originalVfxSystemBindings.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1";
const SOURCE_REL = "docs/art/production/vfx/faithful-reference-26";
const SOURCE = path.join(root, SOURCE_REL);
const DEST_REL = "assets/production/vfx/licensed-runtime-v1";
const DEST = path.join(root, DEST_REL);
const SOURCE_MANIFEST = path.join(SOURCE, "manifest.json");
const SIDECARS = Object.freeze({
  "battle-hypereffect": {
    src: "assets/production/vfx/original-rom-conversion-v1/hypereffect/hypereffect.visibility.json",
    destName: "hypereffect.visibility.json"
  },
  "common-spark": {
    src: "assets/production/vfx/original-rom-conversion-v1/spark/spark.material-animation.json",
    destName: "spark.material-animation.json"
  }
});

function fail(message) {
  throw new Error(`CHAMPIONSHIP_LICENSED_VFX_RUNTIME: ${message}`);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

if (!fs.existsSync(SOURCE_MANIFEST)) fail(`MISSING_SOURCE_MANIFEST:${SOURCE_MANIFEST}`);
const source = JSON.parse(fs.readFileSync(SOURCE_MANIFEST, "utf8"));
if (!Array.isArray(source.systems) || source.systems.length !== ORIGINAL_NITRO_VFX_SYSTEM_COUNT) {
  fail(`UNEXPECTED_SOURCE_SYSTEM_COUNT:${source.systems?.length}`);
}

const wanted = new Set(ORIGINAL_NITRO_VFX_SYSTEMS.map((entry) => entry.logicalGroup));
const packGroups = new Set(source.systems.map((system) => system.logicalGroup));
for (const group of wanted) {
  if (!packGroups.has(group)) fail(`MISSING_SOURCE_SYSTEM:${group}`);
}
for (const group of packGroups) {
  if (!wanted.has(group)) fail(`UNEXPECTED_SOURCE_SYSTEM:${group}`);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

const runtimeSystems = [];

for (const entry of source.systems) {
  const binding = ORIGINAL_NITRO_VFX_SYSTEMS.find((item) => item.logicalGroup === entry.logicalGroup);
  const fieldDirRel = `${DEST_REL}/${entry.logicalGroup}`;
  const fieldDir = path.join(root, fieldDirRel);
  fs.mkdirSync(fieldDir, { recursive: true });

  let model = null;
  const textures = [];
  for (const output of entry.outputs) {
    const srcPath = path.join(root, output.path);
    if (!fs.existsSync(srcPath)) fail(`MISSING_SOURCE_OUTPUT:${output.path}`);
    const destName = path.basename(output.path);
    const destPath = path.join(fieldDir, destName);
    fs.copyFileSync(srcPath, destPath);
    const copied = {
      src: toPosix(`${fieldDirRel}/${destName}`),
      sha256: sha256File(destPath).toUpperCase(),
      bytes: fs.statSync(destPath).size
    };
    if (destName.toLowerCase().endsWith(".glb")) {
      if (model) fail(`MULTIPLE_GLB:${entry.logicalGroup}`);
      model = { ...copied, glb: output.glb };
    } else if (destName.toLowerCase().endsWith(".png")) {
      textures.push(copied);
    } else {
      fail(`UNEXPECTED_OUTPUT_KIND:${destName}`);
    }
  }
  if (!model) fail(`MISSING_GLB:${entry.logicalGroup}`);

  const sidecars = [];
  const sidecarSpec = SIDECARS[binding.systemId];
  if (sidecarSpec) {
    const sidecarSrc = path.join(root, sidecarSpec.src);
    if (!fs.existsSync(sidecarSrc)) fail(`MISSING_SIDECAR:${sidecarSpec.src}`);
    const destPath = path.join(fieldDir, sidecarSpec.destName);
    fs.copyFileSync(sidecarSrc, destPath);
    sidecars.push(toPosix(`${fieldDirRel}/${sidecarSpec.destName}`));
  }

  runtimeSystems.push({
    systemId: binding.systemId,
    logicalGroup: entry.logicalGroup,
    model: model.src,
    modelSha256: model.sha256,
    glb: model.glb,
    textures,
    sidecars,
    unsupportedSourceFormats: entry.unsupportedSourceFormats ?? [],
    triggerBinding: "EXTERNAL_PRESENTATION_EVENT_REQUIRED",
    playback: "CALLER_CONTROLLED_NO_PRIVATE_TICKER",
    gameplayBinding: "EXTERNAL_EXISTING_RUNTIME"
  });
}

runtimeSystems.sort((left, right) => left.systemId.localeCompare(right.systemId));

const manifest = {
  schemaVersion: 1,
  assetId: "art:vfx:licensed-runtime:v1",
  family: "VFX",
  product: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  artifactMaturity: "LICENSED_PIXEL_FAITHFUL_NITRO_VFX_GLB",
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
  systemCount: runtimeSystems.length,
  previewAliases: ORIGINAL_NITRO_VFX_EVENT_ALIASES,
  defaultPreviewSystemId: null,
  defaultPreviewNote: "No VFX is mounted by default. ?vfxArt= names one system for visual QA. The presentation layer does not infer hits, Hyper, Spark, or rain.",
  memoryPolicy: "ONE_ACTIVE_SYSTEM_PER_CHANNEL_CALLER_OWNED_TICKER",
  tickerPolicy: "CALLER_OWNED_UPDATE_DELTA_MS",
  gateEarthMounted: false,
  camera: "PRODUCT_AUTHORED_PREVIEW_FRAMING",
  systems: runtimeSystems,
  notes: [
    "Converted motion is authoritative only where apicula decoded it into the GLB.",
    "NSBVA/NSBMA remain UNKNOWN except the two copied JSON sidecars for hypereffect and spark.",
    "Gate Earth is not in this bundle and must stay unmounted.",
    "Do not invent battle or weather callers from these files."
  ]
};

fs.writeFileSync(path.join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote licensed VFX runtime: ${runtimeSystems.length} systems, ${Object.keys(SIDECARS).length} sidecars.`);
