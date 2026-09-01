import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
// 752 audited + 496 ROM-reconciled. See docs/art/ART_ROM_RECONCILIATION.md.
const EXPECTED_REGISTRY_UNITS = 1248;
const registry = JSON.parse(execFileSync("git", ["show", "HEAD:docs/art/ART_ASSET_REGISTRY.json"], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");
const index = readJson("assets/production/ART_PRODUCTION_INDEX.json");

assert.equal(registry.assets.length, EXPECTED_REGISTRY_UNITS);
assert.equal(crosswalk.records.length, EXPECTED_REGISTRY_UNITS);
assert.equal(new Set(crosswalk.records.map((record) => record.referenceAssetId)).size, EXPECTED_REGISTRY_UNITS);
assert.deepEqual(crosswalk.records.map((record) => record.referenceAssetId).sort(), registry.assets.map((asset) => asset.assetId).sort());
assert.equal(crosswalk.summary.shippingReady, 0);
assert.equal(crosswalk.summary.readyForRuntime, 0);
assert.equal(crosswalk.rosterPlan.launchTarget, 96);
assert.equal(crosswalk.rosterPlan.postLaunchPacks * crosswalk.rosterPlan.entitiesPerPostLaunchPack, 128);
assert.equal(crosswalk.rosterPlan.launchTarget + crosswalk.rosterPlan.postLaunchTarget, 224);
assert.equal(Object.values(crosswalk.rosterPlan.fullRosterSpeciesMix).reduce((sum, count) => sum + count, 0), 224);
assert.equal(Object.values(crosswalk.rosterPlan.launchSpeciesMix).reduce((sum, count) => sum + count, 0), 96);
assert.equal(crosswalk.rosterPlan.fullRosterSpeciesMix.cats + crosswalk.rosterPlan.fullRosterSpeciesMix.dogs, 136);
assert.equal(crosswalk.a1Pilot.characters.length, 8);
assert.equal(crosswalk.a1Pilot.huntBiomes.length, 2);
assert.equal(crosswalk.a1Pilot.cageModuleCount, 12);

for (const record of crosswalk.records) {
  assert.equal(record.referenceRightsStatus, "ROM_COPYRIGHTED_REFERENCE");
  assert.equal(record.productionRightsStatus, "UNKNOWN");
  assert.equal(record.targetProductionRightsStatus, "LICENSED");
  assert.equal(record.humanApproved, false);
  assert.equal(record.readyForRuntime, false);
  assert.equal(record.shippingReady, false);
  assert.equal(record.replacementRequired, true);
  assert.equal(record.productionFiles.length, 0);
  assert.ok(record.blockers.includes("PRODUCTION_MASTER_NOT_CREATED"));
}

assert.equal(index.entries.length, 3);
assert.equal(index.summary.shippingReadyBundles, 0);
for (const entry of index.entries) {
  assert.match(entry.manifestPath, /^assets\/production\//);
  assert.equal(fs.existsSync(path.join(root, entry.manifestPath)), true, entry.manifestPath);
  assert.notEqual(entry.rightsStatus, "ROM_COPYRIGHTED_REFERENCE");
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
console.log(`A0 art production validation passed: ${EXPECTED_REGISTRY_UNITS} crosswalk records, 3 non-shipping runtime bundles, 0 promotions.`);
