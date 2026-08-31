// Presentation packs -- skins bind to slots; gameplay does not.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ACTIVE_PRESENTATION_PACK_ID,
  PRESENTATION_PACK_IDS,
  getPresentationPack,
  listPresentationPacks,
  resolvePresentationSlot
} from "../src/championship/presentation/presentationPack.js";

const index = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
const runtimeIds = new Set(index.entries.map((entry) => entry.assetId));

test("the active pack is the temporary prototype currently loaded by Pixi", () => {
  assert.equal(ACTIVE_PRESENTATION_PACK_ID, PRESENTATION_PACK_IDS.TEMPORARY_PROTOTYPE);
  const pack = getPresentationPack();
  assert.equal(pack.runtimeEligible, true);
  assert.equal(pack.role, "CURRENT_RUNTIME");
  for (const slotId of ["raisingHome", "huntField", "gateSelect"]) {
    const resolved = resolvePresentationSlot(slotId);
    assert.equal(resolved.runtimeEligible, true);
    assert.equal(runtimeIds.has(resolved.assetId), true, `${slotId} must point at a registered production bundle`);
  }
});

test("Option A is the default public skin and is not yet runtime-eligible", () => {
  const pack = getPresentationPack(PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL);
  assert.equal(pack.role, "DEFAULT_PUBLIC_SKIN");
  assert.equal(pack.visualFamily, "LICENSED_FAITHFUL_HD");
  assert.equal(pack.runtimeEligible, false);
  assert.equal(resolvePresentationSlot("raisingHome", pack.packId).bound, false);
  assert.equal(resolvePresentationSlot("huntField", pack.packId).bound, false);
  assert.equal(listPresentationPacks().length, 2);
});

test("unknown packs and slots are refused rather than guessed", () => {
  assert.throws(() => getPresentationPack("championship:pack:cat-dog"), /UNKNOWN_PRESENTATION_PACK/);
  assert.throws(() => resolvePresentationSlot("battleField"), /UNKNOWN_PRESENTATION_SLOT/);
});
