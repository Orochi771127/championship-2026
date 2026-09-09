import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
// 752 audited + 496 ROM-reconciled. See docs/art/ART_ROM_RECONCILIATION.md.
const EXPECTED_REGISTRY_UNITS = 1248;
const registry = readJson("docs/art/ART_ASSET_REGISTRY.json");
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");
const index = readJson("assets/production/ART_PRODUCTION_INDEX.json");

assert.equal(registry.assets.length, EXPECTED_REGISTRY_UNITS);
assert.equal(crosswalk.records.length, EXPECTED_REGISTRY_UNITS);
assert.equal(new Set(crosswalk.records.map((record) => record.referenceAssetId)).size, EXPECTED_REGISTRY_UNITS);
assert.equal(new Set(crosswalk.records.map((record) => record.productionAssetId)).size, EXPECTED_REGISTRY_UNITS);
assert.deepEqual(crosswalk.records.map((record) => record.referenceAssetId).sort(), registry.assets.map((asset) => asset.assetId).sort());
assert.equal(crosswalk.summary.shippingReady, 0);
assert.equal(crosswalk.summary.readyForRuntime, 95);
assert.equal(crosswalk.rosterPlan.launchTarget, 96);
assert.equal(crosswalk.rosterPlan.postLaunchPacks * crosswalk.rosterPlan.entitiesPerPostLaunchPack, 128);
assert.equal(crosswalk.rosterPlan.launchTarget + crosswalk.rosterPlan.postLaunchTarget, 224);
assert.equal(Object.values(crosswalk.rosterPlan.fullRosterSpeciesMix).reduce((sum, count) => sum + count, 0), 224);
assert.equal(Object.values(crosswalk.rosterPlan.launchSpeciesMix).reduce((sum, count) => sum + count, 0), 96);
assert.equal(crosswalk.rosterPlan.fullRosterSpeciesMix.cats + crosswalk.rosterPlan.fullRosterSpeciesMix.dogs, 136);
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

const recordsByReference = new Map(crosswalk.records.map((record) => [record.referenceAssetId, record]));
const characters = crosswalk.records.filter((record) => record.family === "character");
const gameplayCharacters = characters.filter((record) => record.referenceAssetKind === "CHARACTER_ENTITY_REFERENCE");
const databaseCharacters = characters.filter((record) => record.referenceAssetKind === "CHARACTER_DB_ENTITY_REFERENCE");
assert.equal(gameplayCharacters.length, 224);
assert.equal(databaseCharacters.length, 224);
assert.ok(gameplayCharacters.every((record) => record.productionAssetId.startsWith("production:character:gameplay:")));
assert.ok(databaseCharacters.every((record) => record.productionAssetId.startsWith("production:character:database:")));
assert.equal(new Set(characters.map((record) => record.paletteDecisionId)).size, 224);
for (const record of gameplayCharacters) {
  const partner = recordsByReference.get(record.referenceAssetId.replace(":rom-reference", ":db-reference"));
  assert.ok(partner, record.referenceAssetId);
  assert.equal(partner.paletteDecisionId, record.paletteDecisionId);
  assert.notEqual(partner.productionAssetId, record.productionAssetId);
}

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

for (const record of crosswalk.records) {
  assert.equal(record.referenceRightsStatus, "ROM_COPYRIGHTED_REFERENCE");
  assert.equal(record.targetProductionRightsStatus, "LICENSED");
  assert.equal(record.shippingReady, false);
  if ((record.family === "hunt" || record.family === "cage" || record.family === "battle" || record.family === "vfx") && record.readyForRuntime) {
    assert.equal(record.productionRightsStatus, "LICENSED");
    assert.equal(record.humanApproved, true);
    assert.equal(record.replacementRequired, false);
    assert.ok(record.productionFiles.length > 0);
    assert.equal(
      record.runtimeManifestKey,
      {
        cage: "assets/production/cage/licensed-runtime-v1/manifest.json",
        battle: "assets/production/battle/licensed-runtime-v1/manifest.json",
        vfx: "assets/production/vfx/licensed-runtime-v1/manifest.json",
        hunt: "assets/production/hunt/licensed-runtime-v1/manifest.json"
      }[record.family]
    );
    continue;
  }
  assert.equal(record.productionRightsStatus, "UNKNOWN");
  assert.equal(record.humanApproved, false);
  assert.equal(record.readyForRuntime, false);
  assert.equal(record.replacementRequired, true);
  assert.equal(record.productionFiles.length, 0);
  assert.ok(record.blockers.includes("PRODUCTION_MASTER_NOT_CREATED"));
}

assert.equal(crosswalk.summary.readyForRuntime, 95);

assert.equal(index.entries.length, index.summary.registeredRuntimeBundles);
assert.equal(new Set(index.entries.map(e => e.assetId)).size, index.entries.length, "duplicate production asset IDs");
assert.equal(new Set(index.entries.map(e => e.manifestPath)).size, index.entries.length, "duplicate manifest registration");
const cube = index.entries.find(entry => entry.assetId === "art:battle-select:menu-cube:v1");
assert.equal(cube?.runtimeEligible, true);
assert.equal(cube?.rightsStatus, "ORIGINAL_CREATED");
assert.equal(cube?.humanApproved, false);
assert.equal(index.summary.shippingReadyBundles, 0);
assert.equal(index.rightsAuthority.ownerStatus, "LICENSED");
for (const entry of index.entries) {
  assert.match(entry.manifestPath, /^assets\/production\//);
  assert.equal(fs.existsSync(path.join(root, entry.manifestPath)), true, entry.manifestPath);
  if (entry.rightsStatus === "ROM_COPYRIGHTED_REFERENCE") {
    const allowed = {
      "art:vfx:battle-effects:local-reference:v1": "assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json",
      "art:audio:battle:local-reference:v1": "assets/production/internal-faithful-baseline/battle-audio-v1/manifest.json"
    };
    assert.equal(entry.manifestPath, allowed[entry.assetId], "unapproved original reference registration");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, entry.manifestPath), "utf8"));
    for (const scoped of [entry, manifest]) {
      assert.equal(scoped.localOnly, true);
      assert.equal(scoped.runtimeScope, "LOOPBACK_RESEARCH_ONLY");
      assert.equal(scoped.publicReleasePermitted, false);
      assert.equal(scoped.shippingReady, false);
    }
  }
  assert.equal(entry.shippingReady, false);
  assert.notEqual(entry.shippingStatus, "SHIPPING_READY");
}

const serialized = JSON.stringify({ crosswalk, index });
assert.doesNotMatch(serialized, /R:\\\\|research[\\/]+original-evidence|\.nsbmd|\.nds\b/i);

for (const required of [
  "docs/art/CHAMPIONSHIP_2026_LICENSED_REMAKE_STYLE_BIBLE.md",
  "docs/art/ART_PRODUCTION_BATCH_PLAN.md",
  "docs/art/ART_PRODUCTION_CROSSWALK.json",
  "assets/production/ART_PRODUCTION_INDEX.json"
]) assert.equal(fs.existsSync(path.join(root, required)), true, required);

const deterministic = spawnSync(process.execPath, ["scripts/build-art-production-a0.mjs", "--check"], { cwd: root, encoding: "utf8" });
assert.equal(deterministic.status, 0, deterministic.stderr || deterministic.stdout);
console.log(`A0 art production validation passed: ${EXPECTED_REGISTRY_UNITS} crosswalk records, ${index.entries.length} registered bundles, ${index.entries.filter(e=>e.runtimeEligible===true).length} runtime-eligible (including scoped local references), ${crosswalk.summary.readyForRuntime} crosswalk units ready-for-runtime, 0 shipping.`);
