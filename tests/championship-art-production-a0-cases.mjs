import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
// 752 audited + 496 ROM-reconciled. See docs/art/ART_ROM_RECONCILIATION.md.
const EXPECTED_REGISTRY_UNITS = 1248;
const registry = readJson("docs/art/ART_ASSET_REGISTRY.json");
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");
const index = readJson("assets/production/ART_PRODUCTION_INDEX.json");

test("A0 crosswalk covers every audited decision unit exactly once", () => {
  assert.equal(registry.assets.length, EXPECTED_REGISTRY_UNITS);
  assert.equal(crosswalk.records.length, EXPECTED_REGISTRY_UNITS);
  assert.equal(new Set(crosswalk.records.map((record) => record.referenceAssetId)).size, EXPECTED_REGISTRY_UNITS);
  assert.equal(new Set(crosswalk.records.map((record) => record.productionAssetId)).size, EXPECTED_REGISTRY_UNITS);
  assert.deepEqual(crosswalk.records.map((record) => record.referenceAssetId).sort(), registry.assets.map((asset) => asset.assetId).sort());
});

test("gameplay and database characters keep distinct deliverables and one shared palette decision", () => {
  const characters = crosswalk.records.filter((record) => record.family === "character");
  const gameplay = characters.filter((record) => record.referenceAssetKind === "CHARACTER_ENTITY_REFERENCE");
  const database = characters.filter((record) => record.referenceAssetKind === "CHARACTER_DB_ENTITY_REFERENCE");
  assert.equal(gameplay.length, 224);
  assert.equal(database.length, 224);
  assert.ok(gameplay.every((record) => record.productionAssetId.startsWith("production:character:gameplay:")));
  assert.ok(database.every((record) => record.productionAssetId.startsWith("production:character:database:")));
  assert.equal(new Set(characters.map((record) => record.paletteDecisionId)).size, 224);
  for (const record of gameplay) {
    const partnerId = record.referenceAssetId.replace(":rom-reference", ":db-reference");
    const partner = database.find((candidate) => candidate.referenceAssetId === partnerId);
    assert.ok(partner, partnerId);
    assert.equal(partner.paletteDecisionId, record.paletteDecisionId);
    assert.notEqual(partner.productionAssetId, record.productionAssetId);
  }
});

test("crosswalk carries registry blockers and confirmed production dependencies", () => {
  const recordsByReference = new Map(crosswalk.records.map((record) => [record.referenceAssetId, record]));
  for (const asset of registry.assets) {
    const record = recordsByReference.get(asset.assetId);
    assert.ok(record, asset.assetId);
    for (const blocker of asset.blockers) assert.ok(record.blockers.includes(blocker), `${asset.assetId} ${blocker}`);
  }
  const bm00 = recordsByReference.get("art:battle-field:field-bm00-00:shared-layer-reference");
  const bm01 = recordsByReference.get("art:battle-field:battle-normal:arena-reference");
  const bm07 = recordsByReference.get("art:battle-field:battle-cyberspace:arena-reference");
  assert.equal(bm00.productionAssetId, "production:battle:shared:field-bm00-00");
  assert.equal(bm01.productionAssetId, "production:battle:arena:field-bm01-01");
  assert.deepEqual(bm01.referenceDependencies, [bm00.referenceAssetId]);
  assert.deepEqual(bm01.productionDependencies, [bm00.productionAssetId]);
  assert.deepEqual(bm07.referenceDependencies, []);
  assert.deepEqual(bm07.productionDependencies, []);
});

test("licensed remake promotes Owner-indexed Hunt, Cage, Battle, and Nitro VFX runtime", () => {
  const promoted = crosswalk.records.filter((record) => record.readyForRuntime);
  assert.equal(promoted.length, 95);
  assert.ok(promoted.every((record) => record.family === "hunt" || record.family === "cage" || record.family === "battle" || record.family === "vfx"));
  const huntPromoted = promoted.filter((record) => record.family === "hunt");
  const cagePromoted = promoted.filter((record) => record.family === "cage");
  const battlePromoted = promoted.filter((record) => record.family === "battle");
  const vfxPromoted = promoted.filter((record) => record.family === "vfx");
  assert.equal(huntPromoted.length, 17);
  assert.equal(cagePromoted.length, 40);
  assert.equal(battlePromoted.length, 12);
  assert.equal(vfxPromoted.length, 26);
  assert.ok(vfxPromoted.every((record) => record.referenceAssetKind === "NITRO_3D_EFFECT_FAMILY"));
  const spriteVfx = crosswalk.records.filter((record) => record.family === "vfx" && record.referenceAssetKind !== "NITRO_3D_EFFECT_FAMILY");
  assert.ok(spriteVfx.length > 0);
  assert.ok(spriteVfx.every((record) => record.readyForRuntime === false));
  const shared = battlePromoted.find((record) => record.referenceLogicalGroup === "field_bm00_00");
  const cyber = battlePromoted.find((record) => record.referenceLogicalGroup === "field_bm07_01");
  const volcano = battlePromoted.find((record) => record.referenceLogicalGroup === "field_bm03_01");
  const hitspark = vfxPromoted.find((record) => record.referenceLogicalGroup === "battle/hitspark_big");
  assert.equal(shared.productionFiles.length, 10);
  assert.equal(cyber.productionFiles.length, 1);
  assert.ok(shared.productionFiles.every((file) => !file.includes("field_bm07_01")));
  assert.ok(volcano.blockers.includes("ANIMATED_LAYER_UNKNOWN_REQUIRES_TRACE"));
  assert.equal(hitspark.productionAssetId, "production:vfx:vfx:battle-hitspark-big");
  assert.ok(hitspark.blockers.includes("CLEAN_ROOM_ORIGINAL_REPLACEMENT_REQUIRED"));
  assert.ok(hitspark.productionFiles.some((file) => file.endsWith(".glb")));
  assert.deepEqual(
    huntPromoted.map((record) => record.referenceAssetId),
    [
      "art:map:hm00:hunt-reference",
      "art:map:hm01:hunt-reference",
      "art:map:hm02:hunt-reference",
      "art:map:hm03:hunt-reference",
      "art:map:hm04:hunt-reference",
      "art:map:hm05:hunt-reference",
      "art:map:hm06:hunt-reference",
      "art:map:hm08:hunt-reference",
      "art:map:hm09:hunt-reference",
      "art:map:hm10:hunt-reference",
      "art:map:hm11:hunt-reference",
      "art:map:hm13:hunt-reference",
      "art:map:hm14:hunt-reference",
      "art:map:hm15:hunt-reference",
      "art:map:hm16:hunt-reference",
      "art:map:hm17:hunt-reference",
      "art:map:hm18:hunt-reference"
    ]
  );
  const promotedIds = new Set(promoted.map((record) => record.referenceAssetId));
  const manifestByFamily = {
    cage: "assets/production/cage/licensed-runtime-v1/manifest.json",
    battle: "assets/production/battle/licensed-runtime-v1/manifest.json",
    vfx: "assets/production/vfx/licensed-runtime-v1/manifest.json",
    hunt: "assets/production/hunt/licensed-runtime-v1/manifest.json"
  };
  for (const record of crosswalk.records) {
    assert.equal(record.referenceRightsStatus, "ROM_COPYRIGHTED_REFERENCE");
    assert.equal(record.targetProductionRightsStatus, "LICENSED");
    assert.equal(record.shippingReady, false);
    if (promotedIds.has(record.referenceAssetId)) {
      assert.equal(record.productionRightsStatus, "LICENSED");
      assert.equal(record.humanApproved, true);
      assert.equal(record.readyForRuntime, true);
      assert.equal(record.replacementRequired, false);
      assert.ok(record.productionFiles.length > 0);
      assert.equal(record.runtimeManifestKey, manifestByFamily[record.family]);
      continue;
    }
    assert.equal(record.productionRightsStatus, "UNKNOWN");
    assert.equal(record.productionFiles.length, 0);
  }
  assert.equal(
    crosswalk.licenseGate.documentVerification,
    "OWNER_DECLARED_PRODUCTION_INDEX_IS_RUNTIME_AUTHORITY; SHIPPING_STILL_REQUIRES_QA"
  );
});

test("A1 is bounded and roster scaling remains gated", () => {
  assert.equal(crosswalk.a1Pilot.characters.length, 16);
  assert.equal(crosswalk.a1Pilot.characters.filter((id) => id.endsWith(":rom-reference")).length, 8);
  assert.equal(crosswalk.a1Pilot.characters.filter((id) => id.endsWith(":db-reference")).length, 8);
  assert.equal(crosswalk.a1Pilot.huntBiomes.length, 2);
  assert.deepEqual(crosswalk.a1Pilot.gate3d, []);
  assert.deepEqual(crosswalk.a1Pilot.battleSharedLayerPilot, [
    "art:battle-field:field-bm00-00:shared-layer-reference",
    "art:battle-field:battle-normal:arena-reference"
  ]);
  assert.equal(crosswalk.a1Pilot.cageModuleCount, 12);
  assert.equal(crosswalk.rosterPlan.launchTarget, 96);
  assert.equal(crosswalk.rosterPlan.postLaunchPacks, 4);
  assert.equal(crosswalk.rosterPlan.entitiesPerPostLaunchPack, 32);
  assert.deepEqual(crosswalk.rosterPlan.launchSpeciesMix, { cats: 32, dogs: 28, otherSpecies: 32, eggs: 4 });
  assert.deepEqual(crosswalk.rosterPlan.fullRosterSpeciesMix, { cats: 72, dogs: 64, otherSpecies: 80, eggs: 8 });
});


test("production index registers the licensed Hunt, Cage, Battle, and VFX pilots without shipping them", () => {
  assert.equal(index.entries.length, index.summary.registeredRuntimeBundles);
  assert.equal(new Set(index.entries.map(entry => entry.assetId)).size, index.entries.length);
  const battleEffects = index.entries.find(entry => entry.assetId === 'art:vfx:original-battle-2d:v1');
  assert.equal(battleEffects?.runtimeEligible, false);
  assert.equal(battleEffects?.rightsStatus, 'ORIGINAL_CREATED');
  assert.equal(battleEffects?.humanApproved, false);
  const cube = index.entries.find(entry => entry.assetId === "art:battle-select:menu-cube:v1");
  assert.equal(cube?.runtimeEligible, true);
  assert.equal(cube?.rightsStatus, "ORIGINAL_CREATED");
  assert.equal(cube?.humanApproved, false);
  assert.equal(index.summary.shippingReadyBundles, 0);
  assert.equal(index.rightsAuthority.uniqueSource, "THIS_INDEX");
  assert.equal(index.rightsAuthority.ownerStatus, "LICENSED");
  assert.equal(index.entries[0].assetId, "art:hunt:licensed-runtime:v1");
  assert.equal(index.entries[1].assetId, "art:cage:licensed-runtime:v1");
  assert.equal(index.entries[2].assetId, "art:battle:licensed-runtime:v1");
  assert.equal(index.entries[3].assetId, "art:vfx:licensed-runtime:v1");
  assert.equal(index.entries[0].rightsStatus, "LICENSED");
  assert.equal(index.entries[1].rightsStatus, "LICENSED");
  assert.equal(index.entries[2].rightsStatus, "LICENSED");
  assert.equal(index.entries[3].rightsStatus, "LICENSED");
  assert.equal(index.entries[0].shippingReady, false);
  assert.equal(index.entries[1].shippingReady, false);
  assert.equal(index.entries[2].shippingReady, false);
  assert.equal(index.entries[3].shippingReady, false);
  for (const entry of index.entries) {
    assert.match(entry.manifestPath, /^assets\/production\//);
    // Full manifest presence is verified by championship-art-local-manifests-cases.mjs.
    if (['art:vfx:battle-effects:local-reference:v1','art:audio:battle:local-reference:v1','art:vfx:raising-feedback:local-reference:v1','art:characters:hud:local-reference:v1','art:vfx:hunt-feedback:local-reference:v1'].includes(entry.assetId)) {
      assert.equal(entry.localOnly, true);
      assert.equal(entry.publicReleasePermitted, false);
      assert.equal(entry.runtimeScope, 'LOOPBACK_RESEARCH_ONLY');
      assert.equal(entry.rightsStatus, 'ROM_COPYRIGHTED_REFERENCE');
    } else assert.notEqual(entry.rightsStatus, "ROM_COPYRIGHTED_REFERENCE");
    assert.equal(entry.shippingReady, false);
  }
});
