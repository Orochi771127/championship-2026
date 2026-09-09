import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const crosswalkPath = path.join(root, "docs/art/ART_PRODUCTION_CROSSWALK.json");
const indexPath = path.join(root, "assets/production/ART_PRODUCTION_INDEX.json");
const checkOnly = process.argv.includes("--check");

const pilotGameplayCharacters = [
  "art:character:e000-digitama:rom-reference",
  "art:character:m001-zurumon:rom-reference",
  "art:character:m201-agumon:rom-reference",
  "art:character:m222-tentomon:rom-reference",
  "art:character:m226-hagurumon:rom-reference",
  "art:character:m228-palmon:rom-reference",
  "art:character:m352-peckmon:rom-reference",
  "art:character:m431-whamon:rom-reference"
];

const pilotDatabaseCharacters = pilotGameplayCharacters.map((assetId) => assetId.replace(":rom-reference", ":db-reference"));
const pilotCharacters = [...pilotGameplayCharacters, ...pilotDatabaseCharacters];

const pilotVfx = [
  "art:vfx:battle-hitspark-big:nitro-reference",
  "art:vfx:battle-hypereffect:nitro-reference",
  "art:vfx:common-rain:nitro-reference",
  "art:vfx:common-spark:nitro-reference"
];

const battleSharedLayerPilot = [
  "art:battle-field:field-bm00-00:shared-layer-reference",
  "art:battle-field:battle-normal:arena-reference"
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
  // Field art the ROM census found that belongs to neither the battle catalog nor
  // the Hunt biome set. It stays in its own family so it cannot be produced as a
  // biome or an arena before its consumer is traced.
  if (asset.domain === "MAP" && asset.assetKind === "FIELD_UNATTRIBUTED_REFERENCE") return "field-unattributed";
  throw new Error(`Unsupported art family for ${asset.assetId}`);
}

function batchFor(asset, family) {
  if (family === "ui") return "A2_UI_HUD_SYSTEM";
  if (family === "cage") return "A3_RAISING_CAGE";
  if (family === "hunt") return "A4_GATE_HUNT";
  if (family === "character" || family === "character-animation") return "A5_LAUNCH_ROSTER_AND_A8_A11_EXPANSION";
  if (family === "battle") return "A6_BATTLE";
  if (family === "field-unattributed") return "A7_RELEASE_COMPLETION";
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
  if (family === "character") {
    const tier = asset.assetKind === "CHARACTER_DB_ENTITY_REFERENCE" ? "database" : "gameplay";
    const entityId = asset.assetId.split(":")[2];
    return `production:character:${tier}:${entityId}`;
  }
  if (family === "battle") {
    const role = asset.assetKind === "BATTLE_FIELD_SHARED_LAYER_REFERENCE" ? "shared" : "arena";
    return `production:battle:${role}:${asset.logicalGroup.replaceAll("_", "-")}`;
  }
  const suffix = asset.assetId.replace(/^art:/, "").replace(/:rom-reference$|:nitro-reference$|:arena-reference$|:cage-reference$|:hunt-reference$|:db-reference$|:sprite-reference$|:font-reference$|:shared-layer-reference$|:field-reference$/, "");
  return `production:${family}:${suffix}`;
}

function pilotBatchFor(asset) {
  if (pilotCharacters.includes(asset.assetId) || pilotVfx.includes(asset.assetId)) return "A1_GOLDEN_ART_SLICE";
  if (battleSharedLayerPilot.includes(asset.assetId)) return "PILOT_BATTLE_SHARED_LAYER";
  if (asset.assetId === "art:map:hm01:hunt-reference" || asset.assetId === "art:map:hm09:hunt-reference") return "A1_GOLDEN_ART_SLICE";
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

// 752 units from the original filesystem audit plus 496 recovered by reconciling
// that audit against the ROM binary. The reconciliation generator owns this file;
// A0 consumes the generated working-tree view so dependency and blocker updates
// are validated before commit. See docs/art/ART_ROM_RECONCILIATION.md.
const EXPECTED_REGISTRY_UNITS = 1248;
const registry = readJson("docs/art/ART_ASSET_REGISTRY.json");
if (!Array.isArray(registry.assets) || registry.assets.length !== EXPECTED_REGISTRY_UNITS) throw new Error(`Expected the canonical ${EXPECTED_REGISTRY_UNITS}-record Art-A registry`);
if (new Set(registry.assets.map((asset) => asset.assetId)).size !== registry.assets.length) throw new Error("Duplicate Art-A asset IDs");

for (const required of [...pilotCharacters, ...pilotVfx, ...battleSharedLayerPilot]) {
  if (!registry.assets.some((asset) => asset.assetId === required)) throw new Error(`Missing A1 pilot reference ${required}`);
}

const productionIdsByReference = new Map(registry.assets.map((asset) => {
  const family = familyFor(asset);
  return [asset.assetId, productionAssetId(asset, family)];
}));

const records = registry.assets
  .map((asset) => {
    const family = familyFor(asset);
    const blockers = new Set(["PRODUCTION_MASTER_NOT_CREATED", "HUMAN_VISUAL_APPROVAL_REQUIRED", "RUNTIME_VISUAL_QA_REQUIRED", ...(asset.blockers || [])]);
    if (asset.domain === "CHARACTER" || asset.domain === "CHARACTER_ANIMATION") blockers.add("LAUNCH_96_OR_POSTLAUNCH_PACK_ASSIGNMENT_REQUIRED");
    const referenceDependencies = asset.dependencies || [];
    const productionDependencies = referenceDependencies
      .filter((dependency) => dependency.startsWith("art:"))
      .map((dependency) => {
        const productionId = productionIdsByReference.get(dependency);
        if (!productionId) throw new Error(`Missing production dependency for ${asset.assetId}: ${dependency}`);
        return productionId;
      });
    const paletteDecisionId = referenceDependencies.find((dependency) => dependency.startsWith("decision:character-palette:")) || null;
    return {
      referenceAssetId: asset.assetId,
      referenceDomain: asset.domain,
      referenceAssetKind: asset.assetKind,
      referenceLogicalGroup: asset.logicalGroup,
      referenceEvidenceStatus: asset.evidenceStatus,
      referenceRightsStatus: asset.rightsStatus,
      productionAssetId: productionAssetId(asset, family),
      paletteDecisionId,
      referenceDependencies,
      productionDependencies,
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
      blockers: [...blockers]
    };
  })
  .sort((left, right) => left.referenceAssetId.localeCompare(right.referenceAssetId));

if (new Set(records.map((record) => record.productionAssetId)).size !== records.length) {
  throw new Error("Duplicate productionAssetId values");
}

function applyOneLicensedMapFamily(targetRecords, { family, manifestPath, groupOf }) {
  const bundle = readJson(manifestPath);
  const filesByGroup = new Map();
  for (const field of bundle.fields) {
    const group = groupOf(field.fieldId);
    const files = filesByGroup.get(group) ?? [];
    files.push(...field.frames.map((frame) => frame.src));
    filesByGroup.set(group, files);
  }
  for (const record of targetRecords) {
    if (record.family !== family) continue;
    const files = filesByGroup.get(record.referenceLogicalGroup);
    if (!files) throw new Error(`Missing licensed ${family} pixels for ${record.referenceAssetId}`);
    record.productionRightsStatus = "LICENSED";
    record.rightsVerificationStatus = "OWNER_DECLARED_PRODUCTION_INDEX_IS_AUTHORITY";
    record.productionStatus = bundle.productionStatus;
    record.runtimeManifestKey = manifestPath;
    record.productionFiles = files;
    record.humanApproved = true;
    record.readyForRuntime = true;
    record.shippingReady = false;
    record.replacementRequired = false;
    record.blockers = record.blockers.filter((blocker) => blocker !== "PRODUCTION_MASTER_NOT_CREATED");
  }
}

function applyLicensedRuntimePromotions(targetRecords) {
  applyOneLicensedMapFamily(targetRecords, {
    family: "hunt",
    manifestPath: "assets/production/hunt/licensed-runtime-v1/manifest.json",
    groupOf(fieldId) {
      const match = /^field_(hm\d+)_\d+$/i.exec(fieldId);
      if (!match) throw new Error(`Unexpected licensed Hunt field id: ${fieldId}`);
      return match[1].toUpperCase();
    }
  });
  applyOneLicensedMapFamily(targetRecords, {
    family: "cage",
    manifestPath: "assets/production/cage/licensed-runtime-v1/manifest.json",
    groupOf(fieldId) {
      if (!/^field_cm\d+_\d+$/i.test(fieldId)) throw new Error(`Unexpected licensed Cage field id: ${fieldId}`);
      return fieldId;
    }
  });
  applyLicensedBattlePromotions(targetRecords);
  applyLicensedVfxPromotions(targetRecords);
}

function applyLicensedBattlePromotions(targetRecords) {
  const manifestPath = "assets/production/battle/licensed-runtime-v1/manifest.json";
  const bundle = readJson(manifestPath);
  const filesByField = new Map();
  for (const field of bundle.fields) {
    filesByField.set(field.fieldId, field.frames.map((frame) => frame.src));
  }
  const sharedFiles = bundle.fields
    .filter((field) => field.hasCommonLayer)
    .flatMap((field) => field.frames.map((frame) => frame.src));
  for (const record of targetRecords) {
    if (record.family !== "battle") continue;
    const files = record.referenceAssetKind === "BATTLE_FIELD_SHARED_LAYER_REFERENCE"
      ? sharedFiles
      : filesByField.get(record.referenceLogicalGroup);
    if (!files?.length) throw new Error(`Missing licensed battle pixels for ${record.referenceAssetId}`);
    record.productionRightsStatus = "LICENSED";
    record.rightsVerificationStatus = "OWNER_DECLARED_PRODUCTION_INDEX_IS_AUTHORITY";
    record.productionStatus = bundle.productionStatus;
    record.runtimeManifestKey = manifestPath;
    record.productionFiles = files;
    record.humanApproved = true;
    record.readyForRuntime = true;
    record.shippingReady = false;
    record.replacementRequired = false;
    record.blockers = record.blockers.filter((blocker) => blocker !== "PRODUCTION_MASTER_NOT_CREATED");
  }
}

function applyLicensedVfxPromotions(targetRecords) {
  const manifestPath = "assets/production/vfx/licensed-runtime-v1/manifest.json";
  const bundle = readJson(manifestPath);
  const filesByGroup = new Map();
  for (const system of bundle.systems) {
    filesByGroup.set(system.logicalGroup, [
      system.model,
      ...system.textures.map((texture) => texture.src),
      ...system.sidecars
    ]);
  }
  let promoted = 0;
  for (const record of targetRecords) {
    if (record.family !== "vfx" || record.referenceAssetKind !== "NITRO_3D_EFFECT_FAMILY") continue;
    const files = filesByGroup.get(record.referenceLogicalGroup);
    if (!files?.length) throw new Error(`Missing licensed VFX files for ${record.referenceAssetId}`);
    record.productionRightsStatus = "LICENSED";
    record.rightsVerificationStatus = "OWNER_DECLARED_PRODUCTION_INDEX_IS_AUTHORITY";
    record.productionStatus = bundle.productionStatus;
    record.runtimeManifestKey = manifestPath;
    record.productionFiles = files;
    record.humanApproved = true;
    record.readyForRuntime = true;
    record.shippingReady = false;
    record.replacementRequired = false;
    record.blockers = record.blockers.filter((blocker) => blocker !== "PRODUCTION_MASTER_NOT_CREATED");
    promoted += 1;
  }
  if (promoted !== 26) throw new Error(`Expected 26 licensed Nitro VFX records, got ${promoted}`);
}

applyLicensedRuntimePromotions(records);

// Four authored menu panels cover a bounded presentation, not the complete
// original model (which also has password/practice groups and untraced layers).
const cubeReference = records.find(record => record.referenceAssetId === "art:three-d:battle-menu-launcher13:nitro-reference");
const cubeManifestPath = "assets/production/battle/menu-cube-v1/manifest.json";
const cubePack = readJson(cubeManifestPath);
if (!cubeReference) throw new Error("Missing battle cube reference record");
cubeReference.boundedRuntimeReplacement = {
  assetId: cubePack.assetId,
  manifestPath: cubeManifestPath,
  scope: "FOUR_AUTHORED_MENU_PANELS_ONLY",
  rightsStatus: cubePack.rightsStatus,
  runtimeEligible: cubePack.runtimeEligible,
  humanApproved: cubePack.humanApproved,
  shippingReady: false,
  completeSourceCoverage: false
};

const crosswalk = {
  schemaVersion: 2,
  project: "DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD",
  authority: "OWNER_DIRECTIVE_2026_08_29_LICENSED_FAITHFUL_CAT_ADAPTATION",
  generatedFrom: "docs/art/ART_ASSET_REGISTRY.json",
  lifecycle: "A0_SPECIFICATION_LOCK",
  licenseGate: {
    ownerReportedStatus: "FULL_LICENSE_ACQUIRED",
    targetProductionRightsStatus: "LICENSED",
    documentVerification: "OWNER_DECLARED_PRODUCTION_INDEX_IS_RUNTIME_AUTHORITY; SHIPPING_STILL_REQUIRES_QA",
    rule: "ART_PRODUCTION_INDEX is the unique runtime rights source. Unlisted research pixels stay unread. Shipping still requires visual QA."
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
    gate3d: [],
    battleSharedLayerPilot,
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
  "assets/production/hunt/licensed-runtime-v1/manifest.json",
  "assets/production/cage/licensed-runtime-v1/manifest.json",
  "assets/production/battle/licensed-runtime-v1/manifest.json",
  "assets/production/vfx/licensed-runtime-v1/manifest.json",
  "assets/production/temporary/int-rh2/manifest.json",
  "assets/production/temporary/vs2-hunt/manifest.json",
  "assets/production/gate/vs2-r1/manifest.json",
  "assets/production/internal-battle-review/bm00-bm01-r1/runtime.review.json",
  "assets/production/internal-battle-review/bm02-r1/runtime.review.json",
  "assets/production/internal-battle-review/bm03-bm04-animated-r1/runtime.bm03.review.json",
  "assets/production/internal-battle-review/hardening-r2/runtime.bm04.review.json",
  "assets/production/internal-battle-review/bm05-bm11-static-r1/runtime.bm05.review.json",
  "assets/production/internal-battle-review/bm05-bm11-static-r1/runtime.bm06.review.json",
  "assets/production/internal-battle-review/bm07-cyberspace-r1/runtime.review.json",
  "assets/production/internal-battle-review/hardening-r2/runtime.bm08.review.json",
  "assets/production/internal-battle-review/bm05-bm11-static-r1/runtime.bm09.review.json",
  "assets/production/internal-battle-review/bm05-bm11-static-r1/runtime.bm10.review.json",
  "assets/production/internal-battle-review/hardening-r2/runtime.bm11.review.json",
  "assets/production/battle/menu-cube-v1/manifest.json",
  "assets/production/internal-faithful-baseline/characters-v1/manifest.json",
  "assets/production/ui/tooling-pilot-r1/manifest.json"
].map((manifestPath) => ({ manifestPath, manifest: readJson(manifestPath) }));

// Preserve the later R11 retirement and R13 loopback-only registrations when
// rebuilding A0. They are explicit entries, never a directory-wide promotion.
const laterEntries = [
  ["assets/production/vfx/original-battle-2d-v1/manifest.json", "HISTORICAL_R11_RETAINED_NOT_SELECTED"],
  ["assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json", "SOURCE_PNG_PIXELS_NATIVE_ORIGINS_151_BANKS_LOCAL_REVIEW"],
  ["assets/production/internal-faithful-baseline/battle-audio-v1/manifest.json", "SOURCE_SAMPLES_54_ORIGINAL_IDS_LOCAL_REVIEW"]
].map(([manifestPath, maturity]) => {
  const manifest = readJson(manifestPath);
  if (manifest.shippingReady !== false || manifest.humanApproved !== false || manifest.publicReleasePermitted !== false) {
    throw new Error(`Later registration requires explicit non-shipping scope: ${manifestPath}`);
  }
  if (manifest.localOnly === true) {
    if (manifest.runtimeScope !== "LOOPBACK_RESEARCH_ONLY" || manifest.rightsStatus !== "ROM_COPYRIGHTED_REFERENCE") throw new Error(`Invalid local reference: ${manifestPath}`);
    return {assetId:manifest.assetId,manifestPath,rightsStatus:manifest.rightsStatus,
      productionStatus:manifest.productionStatus ?? "OWNER_AUTHORIZED_LOCAL_REFERENCE",shippingStatus:"NOT_SHIPPING_READY",
      humanApproved:false,runtimeEligible:manifest.runtimeEligible,localOnly:true,runtimeScope:manifest.runtimeScope,
      publicReleasePermitted:false,shippingReady:false,maturity};
  }
  if (manifest.runtimeEligible !== false || manifest.productionStatus !== "RETIRED_GENERATED_REPLACEMENT_OWNER_CORRECTION") throw new Error(`Retired art cannot be re-enabled: ${manifestPath}`);
  return {assetId:manifest.assetId,manifestPath,rightsStatus:manifest.rightsStatus,productionStatus:manifest.productionStatus,
    shippingStatus:"NOT_SHIPPING_READY",humanApproved:false,runtimeEligible:false,shippingReady:false,maturity,publicReleasePermitted:false};
});

const productionIndex = {
  schemaVersion: 1,
  authority: "CHAMPIONSHIP_2026_ART_PRODUCTION",
  sourceCrosswalk: "docs/art/ART_PRODUCTION_CROSSWALK.json",
  promotionPolicy: "ONLY_EXPLICIT_INDEX_ENTRIES_MAY_BE_RUNTIME_REGISTERED; OWNER_DECLARED_LICENSED_PIXELS_MAY_BE_RUNTIME_ELIGIBLE; SHIPPING_READY_REQUIRES_HUMAN_APPROVAL_AND_RUNTIME_QA",
  a0State: "SPECIFICATION_LOCKED_LICENSED_PIXEL_RUNTIME_PILOT_NO_SHIPPING",
  rightsAuthority: {
    uniqueSource: "THIS_INDEX",
    ownerStatus: "LICENSED",
    ownerDirective: "docs/coordination/OWNER_DIRECTION.md#2026-09-02",
    researchPack: "NOT_RUNTIME_READABLE"
  },
  summary: {
    registeredRuntimeBundles: registeredManifests.length + laterEntries.length,
    shippingReadyBundles: registeredManifests.filter(({ manifest }) => manifest.shippingStatus === "SHIPPING_READY").length
  },
  entries: [...registeredManifests.map(({ manifestPath, manifest }) => ({
    assetId: manifest.assetId,
    manifestPath,
    rightsStatus: manifest.rightsStatus,
    productionStatus: manifest.productionStatus,
    shippingStatus: manifest.shippingStatus,
    humanApproved: manifest.humanApproved,
    ...(manifest.runtimeEligible === true ? { runtimeEligible: true } : {}),
    ...(manifest.publicReleasePermitted === false ? { publicReleasePermitted: false } : {}),
    shippingReady: manifest.shippingStatus === "SHIPPING_READY",
    maturity: manifest.artifactMaturity || manifest.runtimeRole || "TEMPORARY_PRESENTATION"
  })), ...laterEntries]
};

writeOrCheck(crosswalkPath, crosswalk);
writeOrCheck(indexPath, productionIndex);
console.log(checkOnly ? "A0 generated files are current." : `Wrote ${records.length} production crosswalk records and ${productionIndex.entries.length} registered index entries.`);
