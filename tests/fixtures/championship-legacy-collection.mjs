// Test-only historical save import. Never enables an unverified capture route.
import assert from "node:assert/strict";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../../src/championship/app/championshipStandaloneSave.js";
import { recordEnclosedCreature } from "../../src/championship/app/championshipRaisingProduction.js";
import { allocateRaisingInstanceIdentity } from "../../src/championship/raising/raisingInstanceIdentity.js";

export async function restoreLegacyIndividual(app, storage, displayName = "Legacy", speciesId = "species-004") {
  const checkpoint = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  try {
    assert.equal(app.save().phase, "SAVED");
    const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
    const allocated = allocateRaisingInstanceIdentity(saved.instanceIdentity, {
      creature: saved.creature, collection: saved.raising.collection, assignments: saved.raising.assignments
    });
    const entry = {
      instanceId: allocated.instanceId, speciesId, displayName,
      enclosedAt: "2026-09-05T00:00:00.000Z", originGateId: app.getGates()[0].gateId,
      cageId: Object.values(saved.raising.assignments)[0]
    };
    saved.raising = recordEnclosedCreature(saved.raising, entry);
    saved.instanceIdentity = allocated.state;
    storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
    await app.continueGame();
    return entry;
  } finally {
    // Loading a fixture changes this in-memory test session, not its checkpoint.
    if (checkpoint === null) storage.removeItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
    else storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, checkpoint);
    // This test-only helper explicitly restores storage behind the live app.
    // Acknowledge that controlled baseline; ordinary stale tabs cannot do this
    // through inspection/retry and are covered by save-conflict-cases.
    app.savePort.read({adopt:true});
  }
}
