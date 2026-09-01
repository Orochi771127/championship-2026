import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const census = readJson("docs/art/ROM_ART_CENSUS.json");
const registry = readJson("docs/art/ART_ASSET_REGISTRY.json");

const CENSUS_SOURCE = "YDIJ ROM art census";
const romDerived = registry.assets.filter((asset) => asset.source === CENSUS_SOURCE);
const audited = registry.assets.filter((asset) => asset.source !== CENSUS_SOURCE);
const kinds = (kind) => romDerived.filter((asset) => asset.assetKind === kind);

test("census is derived from the expected ROM", () => {
  assert.equal(census.rom.sha256, "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1");
  assert.equal(census.rom.gameCode, "YDIJ");
  assert.equal(census.rom.fatEntries, 6419);
  assert.equal(census.rom.arm9Overlays, 22);
});

test("registry keeps the audited units and the ROM-recovered units", () => {
  assert.equal(audited.length, 752);
  assert.equal(romDerived.length, 496);
  assert.equal(registry.assets.length, 1248);
  const reconciliation = registry.authoritySnapshot.romReconciliation;
  assert.equal(reconciliation.auditedUnits, 752);
  assert.equal(reconciliation.romDerivedUnits, 496);
  assert.equal(reconciliation.romSha256, census.rom.sha256);
});

test("every registry baseline agrees with the ROM census", () => {
  for (const [key, value] of Object.entries(census.baselines)) {
    const baseline = registry.summary.baselines[key];
    assert.ok(baseline, `registry is missing baseline ${key}`);
    assert.equal(baseline.expected, value, `${key} expected`);
    assert.equal(baseline.observed, value, `${key} observed`);
  }
  // The three the filesystem scan got wrong, pinned so they cannot regress.
  assert.equal(registry.summary.baselines.huntBiomes.expected, 17);
  assert.equal(registry.summary.baselines.nitro3dFiles.expected, 59);
  assert.equal(registry.summary.baselines.nitro3dUnique.expected, 58);
  // And the ones the ROM confirmed, so a future edit cannot quietly drift them.
  assert.equal(registry.summary.baselines.battleFields.expected, 11);
  assert.equal(registry.summary.baselines.entities.expected, 224);
  assert.equal(registry.summary.baselines.mainAnimationSlots.expected, 40);
  assert.equal(registry.summary.baselines.subAnimationSlots.expected, 13);
});

test("the database character tier is registered as its own tier", () => {
  assert.equal(kinds("CHARACTER_DB_ENTITY_REFERENCE").length, 224);
  assert.equal(census.tiers.characterDatabase.entities, 224);
  assert.equal(census.tiers.characterDatabase.files, 1792);
  assert.equal(census.tiers.characterGameplay.files, 1792);
  // Its animation contract is smaller than the gameplay contract, not a copy of it.
  assert.equal(census.animationContracts.databaseMain.regularSlots, 4);
  assert.equal(census.animationContracts.databaseSub.regularSlots, 3);
  assert.equal(kinds("CHARACTER_ANIMATION_SLOT_CONTRACT").length, 7);
});

test("the 2D sprite effect library and font tier are registered", () => {
  assert.equal(kinds("VFX_2D_SPRITE_FAMILY").length, 187);
  assert.equal(census.tiers.spriteEffects.families, 187);
  assert.equal(kinds("UI_FONT_REFERENCE").length, 7);
  assert.equal(census.tiers.fonts.files, 7);
});

test("the recovered hunt biome and shared battle layer are registered", () => {
  assert.ok(census.tiers.huntBiomeIds.includes("hm00"));
  assert.equal(census.tiers.huntBiomeIds.length, 17);
  assert.equal(registry.assets.filter((asset) => asset.assetId === "art:map:hm00:hunt-reference").length, 1);
  assert.equal(kinds("BATTLE_FIELD_SHARED_LAYER_REFERENCE").length, 1);
  assert.equal(census.tiers.battleFieldSharedLayer, "field_bm00_00");
  assert.equal(kinds("FIELD_UNATTRIBUTED_REFERENCE").length, 3);
});

test("reconciliation promotes nothing and leaks no source pixels", () => {
  for (const asset of romDerived) {
    assert.equal(asset.rightsStatus, "ROM_COPYRIGHTED_REFERENCE", asset.assetId);
    assert.equal(asset.shippingStatus, "ORIGINAL_REPLACEMENT_REQUIRED", asset.assetId);
    assert.equal(asset.replacementRequired, true, asset.assetId);
    assert.equal(asset.disposition, "REBUILD", asset.assetId);
    assert.ok(asset.blockers.length > 0, asset.assetId);
    // Components cite ROM-internal NitroFS paths only; nothing resolves on disk.
    for (const component of asset.components) {
      assert.match(component.path, /^rom:\//, `${asset.assetId} ${component.path}`);
    }
  }
});

test("unattributed field art stays unattributed until traced", () => {
  for (const asset of kinds("FIELD_UNATTRIBUTED_REFERENCE")) {
    assert.equal(asset.evidenceStatus, "UNKNOWN_REQUIRES_TRACE", asset.assetId);
    assert.equal(asset.modernRenderer, "UNKNOWN_REQUIRES_TRACE", asset.assetId);
    assert.ok(asset.blockers.includes("ORIGINAL_ATTRIBUTION_UNKNOWN_REQUIRES_TRACE"), asset.assetId);
  }
});
