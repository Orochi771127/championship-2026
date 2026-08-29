import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const crosswalkPath = path.join(root, "docs/art/ART_PRODUCTION_CROSSWALK.json");
const indexPath = path.join(root, "assets/production/ART_PRODUCTION_INDEX.json");
const checkOnly = process.argv.includes("--check");

const pilotCharacters = [
  "art:character:e000-digitama:rom-reference",
  "art:character:m001-zurumon:rom-reference",
  "art:character:m201-agumon:rom-reference",
  "art:character:m222-tentomon:rom-reference",
  "art:character:m226-hagurumon:rom-reference",
  "art:character:m228-palmon:rom-reference",
  "art:character:m352-peckmon:rom-reference",
  "art:character:m431-whamon:rom-reference"
];

const pilotVfx = [
  "art:vfx:battle-hitspark-big:nitro-reference",
  "art:vfx:battle-hypereffect:nitro-reference",
  "art:vfx:common-rain:nitro-reference",
  "art:vfx:common-spark:nitro-reference"
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function familyFor(asset) {
  if (asset.domain === "BATTLE_FIELD") return "battle";
  if (asset.domain === "CHARACTER") return "character";
  if (asset.domain === "CHARACTER_ANIMATION") return "character-animation";
  if (asset.domain === "THREE_D") return "3d";
  if (asset.domain === "UI") return "ui";
  if (asset.domain === "VFX") return "vfx";
  if (asset.domain === "MAP" && asset.assetKind === "CAGE_ENVIRONMENT_REFERENCE") return "cage";
  if (asset.domain === "MAP" && asset.assetKind === "HUNT_BIOME_REFERENCE") return "hunt";
  throw new Error(`Unsupported art family for ${asset.assetId}`);
}

function batchFor(asset, family) {
  if (family === "ui") return "A2_UI_HUD_SYSTEM";
  if (family === "cage") return "A3_RAISING_CAGE";
  if (family === "hunt") return "A4_GATE_HUNT";
  if (family === "character" || family === "character-animation") return "A5_LAUNCH_ROSTER_AND_A8_A11_EXPANSION";
  if (family === "battle") return "A6_BATTLE";
  if (family === "vfx") return pilotVfx.includes(asset.assetId) ? "A1_GOLDEN_ART_SLICE" : "A6_BATTLE_OR_A7_RELEASE_COMPLETION";
  if (family === "3d" && /^gate_select\//i.test(asset.logicalGroup)) return "A1_GOLDEN_ART_SLICE_THEN_A4_FINAL";
  if (family === "3d" && /^battle/i.test(asset.logicalGroup)) return "A6_BATTLE";
  if (family === "3d") return "A7_RELEASE_COMPLETION";
  throw new Error(`No batch for ${asset.assetId}`);
}

function rendererFor(asset) {
  if (asset.modernRenderer === "THREEJS_3D") return "THREE_BOUNDED";
  if (asset.domain === "UI") return "DOM_CSS_WITH_OPTIONAL_PIXI_DECORATION";
  return asset.modernRenderer || "LAYERED_2D";
}

function productionAssetId(asset, family) {
  const suffix = asset.assetId.replace(/^art:/, "").replace(/:rom-reference$|:nitro-reference$|:arena-reference$|:cage-reference$|:hunt-reference$/, "");
  return `production:${family}:${suffix}`;
}

function pilotBatchFor(asset) {
  if (pilotCharacters.includes(asset.assetId) || pilotVfx.includes(asset.assetId)) return "A1_GOLDEN_ART_SLICE";
  if (asset.assetId === "art:map:hm01:hunt-reference" || asset.assetId === "art:map:hm09:hunt-reference") return "A1_GOLDEN_ART_SLICE";
  if (asset.assetId === "art:three-d:gate-select-3d-worldmap-model:nitro-reference" || asset.assetId === "art:three-d:gate-select-earth:nitro-reference") return "A1_GOLDEN_ART_SLICE";
  if (asset.domain === "UI" && /gate|hunt|training|result|title/i.test(`${asset.logicalGroup} ${asset.originalFunction}`)) return "A1_COMPONENT_SAMPLE_ONLY";
  return null;
}

function countBy(records, key) {
  return Object.fromEntries([...new Set(records.map((record) => record[key]))].sort().map((value) => [value, records.filter((record) => record[key] === value).length]));
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeOrCheck(filePath, value) {
  const output = serialize(value);
  if (checkOnly) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== output) {
      throw new Error(`${path.relative(root, filePath)} is stale; run npm run art:a0:build`);
    }
    return;
  }
  fs.writeFileSync(filePath, output, "utf8");
}

// The managed workspace protects the committed Art-A registry from direct file
// access. Read the canonical HEAD blob so A0 cannot mutate or race that SSOT.
const registry = JSON.parse(execFileSync("git", ["show", "HEAD:docs/art/ART_ASSET_REGISTRY.json"], { cwd: root, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }));
if (!Array.isArray(registry.assets) || registry.assets.length !== 752) throw new Error("Expected the canonical 752-record Art-A registry");
if (new Set(registry.assets.map((asset) => asset.assetId)).size !== registry.assets.length) throw new Error("Duplicate Art-A asset IDs");

for (const required of [...pilotCharacters, ...pilotVfx]) {
  if (!registry.assets.some((asset) => asset.assetId === required)) throw new Error(`Missing A1 pilot reference ${required}`);
}

const records = registry.assets
  .map((asset) => {
    const family = familyFor(asset);
    const blockers = ["PRODUCTION_MASTER_NOT_CREATED", "HUMAN_VISUAL_APPROVAL_REQUIRED", "RUNTIME_VISUAL_QA_REQUIRED"];
    if (asset.domain === "CHARACTER" || asset.domain === "CHARACTER_ANIMATION") blockers.push("LAUNCH_96_OR_POSTLAUNCH_PACK_ASSIGNMENT_REQUIRED");
    if (/field_bm03_01|field_bm04_01/i.test(asset.logicalGroup) && asset.domain === "BATTLE_FIELD") blockers.push("ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE");
    return {
      referenceAssetId: asset.assetId,
      referenceDomain: asset.domain,
      referenceAssetKind: asset.assetKind,
      referenceLogicalGroup: asset.logicalGroup,
      referenceEvidenceStatus: asset.evidenceStatus,
      referenceRightsStatus: asset.rightsStatus,
      productionAssetId: productionAssetId(asset, family),
      family,
      renderer: rendererFor(asset),
      primaryBatch: batchFor(asset, family),
      pilotBatch: pilotBatchFor(asset),
      targetProductionRightsStatus: "LICENSED",
      productionRightsStatus: "UNKNOWN",
      rightsVerificationStatus: "OWNER_REPORTED_FULL_LICENSE_DOCUMENT_LINK_REQUIRED",
      productionStatus: "PLANNED_NOT_CREATED",
      runtimeManifestKey: null,
      productionFiles: [],
      humanApproved: false,
      readyForRuntime: false,
      shippingReady: false,
      replacementRequired: true,
      blockers
    };
  })
  .sort((left, right) => left.referenceAssetId.localeCompare(right.referenceAssetId));

const crosswalk = {
  schemaVersion: 1,
  project: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  authority: "OWNER_DIRECTIVE_2026_08_29_LICENSED_FAITHFUL_CAT_ADAPTATION",
  generatedFrom: "docs/art/ART_ASSET_REGISTRY.json",
  lifecycle: "A0_SPECIFICATION_LOCK",
  licenseGate: {
    ownerReportedStatus: "FULL_LICENSE_ACQUIRED",
    targetProductionRightsStatus: "LICENSED",
    documentVerification: "REQUIRED_BEFORE_READY_FOR_RUNTIME_OR_SHIPPING_PROMOTION",
    rule: "Reference rights and production rights remain separate until a production master and its licence evidence are linked."
  },
  rosterPlan: {
    totalSlots: 224,
    regularSlots: 216,
    eggSlots: 8,
    launchTarget: 96,
    postLaunchTarget: 128,
    postLaunchPacks: 4,
    entitiesPerPostLaunchPack: 32,
    direction: "CUTE_HAND_DRAWN_CAT_DOG_MAJORITY_WITH_OTHER_SPECIES_PRESERVED",
    fullRosterSpeciesMix: {
      cats: 72,
      dogs: 64,
      otherSpecies: 80,
      eggs: 8
    },
    launchSpeciesMix: {
      cats: 32,
      dogs: 28,
      otherSpecies: 32,
      eggs: 4
    },
    exactReleaseAssignment: "LOCK_AFTER_A1_PILOT_AND_RUNTIME_ACTION_COVERAGE_REVIEW"
  },
  a1Pilot: {
    characters: pilotCharacters,
    huntBiomes: ["art:map:hm01:hunt-reference", "art:map:hm09:hunt-reference"],
    gate3d: [
      "art:three-d:gate-select-3d-worldmap-model:nitro-reference",
      "art:three-d:gate-select-earth:nitro-reference"
    ],
    vfxReferences: pilotVfx,
    newProductionOnlyVfx: ["production:vfx:capture-tether-circle-resolution"],
    cageModuleCount: 12,
    uiFlow: ["RAISING_HOME", "GATE_SELECT", "HUNT_LOADOUT", "HUNT_HUD", "CAPTURE", "HUNT_RESULT"]
  },
  summary: {
    total: records.length,
    byFamily: countBy(records, "family"),
    byPrimaryBatch: countBy(records, "primaryBatch"),
    readyForRuntime: records.filter((record) => record.readyForRuntime).length,
    shippingReady: records.filter((record) => record.shippingReady).length
  },
  records
};

const registeredManifests = [
  "assets/production/temporary/int-rh2/manifest.json",
  "assets/production/temporary/vs2-hunt/manifest.json",
  "assets/production/gate/vs2-r1/manifest.json"
].map((manifestPath) => ({ manifestPath, manifest: readJson(manifestPath) }));

const productionIndex = {
  schemaVersion: 1,
  authority: "CHAMPIONSHIP_2026_ART_PRODUCTION",
  sourceCrosswalk: "docs/art/ART_PRODUCTION_CROSSWALK.json",
  promotionPolicy: "ONLY_EXPLICIT_ENTRIES_MAY_BE_RUNTIME_REGISTERED; SHIPPING_READY_REQUIRES_LICENSE_DOCUMENT_HUMAN_APPROVAL_AND_RUNTIME_QA",
  a0State: "SPECIFICATION_LOCKED_NO_NEW_ART_PROMOTED",
  summary: {
    registeredRuntimeBundles: registeredManifests.length,
    shippingReadyBundles: registeredManifests.filter(({ manifest }) => manifest.shippingStatus === "SHIPPING_READY").length
  },
  entries: registeredManifests.map(({ manifestPath, manifest }) => ({
    assetId: manifest.assetId,
    manifestPath,
    rightsStatus: manifest.rightsStatus,
    productionStatus: manifest.productionStatus,
    shippingStatus: manifest.shippingStatus,
    humanApproved: manifest.humanApproved,
    shippingReady: manifest.shippingStatus === "SHIPPING_READY",
    maturity: manifest.artifactMaturity || manifest.runtimeRole || "TEMPORARY_PRESENTATION"
  }))
};

writeOrCheck(crosswalkPath, crosswalk);
writeOrCheck(indexPath, productionIndex);
console.log(checkOnly ? "A0 generated files are current." : `Wrote ${records.length} production crosswalk records and ${registeredManifests.length} runtime index entries.`);
