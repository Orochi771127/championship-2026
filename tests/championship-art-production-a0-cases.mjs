import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { execFileSync } from "node:child_process";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
// 752 audited + 496 ROM-reconciled. See docs/art/ART_ROM_RECONCILIATION.md.
const EXPECTED_REGISTRY_UNITS = 1248;
const registry = JSON.parse(execFileSync("git", ["show", "HEAD:docs/art/ART_ASSET_REGISTRY.json"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");
const index = readJson("assets/production/ART_PRODUCTION_INDEX.json");

test("A0 crosswalk covers every audited decision unit exactly once", () => {
  assert.equal(registry.assets.length, EXPECTED_REGISTRY_UNITS);
  assert.equal(crosswalk.records.length, EXPECTED_REGISTRY_UNITS);
  assert.equal(new Set(crosswalk.records.map((record) => record.referenceAssetId)).size, EXPECTED_REGISTRY_UNITS);
  assert.deepEqual(crosswalk.records.map((record) => record.referenceAssetId).sort(), registry.assets.map((asset) => asset.assetId).sort());
});

test("licensed remake intent never silently promotes reference material", () => {
  for (const record of crosswalk.records) {
    assert.equal(record.referenceRightsStatus, "ROM_COPYRIGHTED_REFERENCE");
    assert.equal(record.productionRightsStatus, "UNKNOWN");
    assert.equal(record.targetProductionRightsStatus, "LICENSED");
    assert.equal(record.shippingReady, false);
    assert.equal(record.productionFiles.length, 0);
  }
  assert.equal(crosswalk.licenseGate.documentVerification, "REQUIRED_BEFORE_READY_FOR_RUNTIME_OR_SHIPPING_PROMOTION");
});

test("A1 is bounded and roster scaling remains gated", () => {
  assert.equal(crosswalk.a1Pilot.characters.length, 8);
  assert.equal(crosswalk.a1Pilot.huntBiomes.length, 2);
  assert.equal(crosswalk.a1Pilot.cageModuleCount, 12);
  assert.equal(crosswalk.rosterPlan.launchTarget, 96);
  assert.equal(crosswalk.rosterPlan.postLaunchPacks, 4);
  assert.equal(crosswalk.rosterPlan.entitiesPerPostLaunchPack, 32);
  assert.deepEqual(crosswalk.rosterPlan.launchSpeciesMix, { cats: 32, dogs: 28, otherSpecies: 32, eggs: 4 });
  assert.deepEqual(crosswalk.rosterPlan.fullRosterSpeciesMix, { cats: 72, dogs: 64, otherSpecies: 80, eggs: 8 });
});


test("production index registers current prototypes but promotes nothing", () => {
  assert.equal(index.entries.length, 3);
  assert.equal(index.summary.shippingReadyBundles, 0);
  for (const entry of index.entries) {
    assert.match(entry.manifestPath, /^assets\/production\//);
    assert.equal(fs.existsSync(entry.manifestPath), true);
    assert.notEqual(entry.rightsStatus, "ROM_COPYRIGHTED_REFERENCE");
    assert.equal(entry.shippingReady, false);
  }
});
