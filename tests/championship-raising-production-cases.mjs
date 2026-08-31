// Product Raising state -- enclosed Hunt instances become raisable home members.
//
// Original capture creates a CreatureInstance, not a species flag and not an
// R2 snapshot resident. The frozen R2 roster stays exactly three starters.
// These tests pin the product layer: assignment, given name, and reload.

import assert from "node:assert/strict";
import test from "node:test";

import {
  assignCreatureToCage,
  createRaisingProductionState,
  normalizeProductGivenName,
  normalizeRaisingProductionState,
  recordCareInteraction,
  recordEnclosedCreature,
  renameEnclosedCreature
} from "../src/championship/app/championshipRaisingProduction.js";

const CAGES = [
  "championship:2026:cage:moonwell-pool",
  "championship:2026:cage:quiet-hollow"
];
const STARTERS = [
  "resident:greyshade-cat",
  "resident:blazetail-kit",
  "resident:crystalfin-seahorse"
];

function fresh() {
  return createRaisingProductionState({ cageIds: CAGES, creatureIds: STARTERS });
}

test("an enclosed instance is assigned to a cage and can be cared for", () => {
  const after = recordEnclosedCreature(fresh(), {
    instanceId: "championship:2026:instance:0001",
    speciesId: "championship:creature:blazetail-kit",
    displayName: "BLAZETAIL KIT",
    cageId: CAGES[0]
  });

  assert.equal(after.collection.length, 1);
  assert.equal(after.assignments["championship:2026:instance:0001"], CAGES[0]);
  assert.equal(after.interactions["championship:2026:instance:0001"].careCount, 0);
  assert.equal(after.collection[0].displayName, "BLAZETAIL KIT");

  const cared = recordCareInteraction(after, "championship:2026:instance:0001", "2026-08-30T00:00:00.000Z");
  assert.equal(cared.interactions["championship:2026:instance:0001"].careCount, 1);

  const moved = assignCreatureToCage(cared, "championship:2026:instance:0001", CAGES[1], { cageIds: CAGES });
  assert.equal(moved.assignments["championship:2026:instance:0001"], CAGES[1]);
});

test("a given name is trimmed and kept, and empty names are refused", () => {
  assert.equal(normalizeProductGivenName("  Ember  "), "Ember");
  assert.throws(() => normalizeProductGivenName("   "), /INVALID_GIVEN_NAME/);
  assert.throws(() => normalizeProductGivenName("x".repeat(25)), /INVALID_GIVEN_NAME/);

  const named = renameEnclosedCreature(
    recordEnclosedCreature(fresh(), {
      instanceId: "championship:2026:instance:0001",
      speciesId: "championship:creature:blazetail-kit",
      displayName: "BLAZETAIL KIT",
      cageId: CAGES[0]
    }),
    "championship:2026:instance:0001",
    " Ember "
  );
  assert.equal(named.collection[0].displayName, "Ember");
});

test("reload restores the enclosed instance assignment and name, not an R2 resident", () => {
  const stored = recordEnclosedCreature(fresh(), {
    instanceId: "championship:2026:instance:0001",
    speciesId: "championship:creature:blazetail-kit",
    displayName: "Ember",
    cageId: CAGES[1],
    originGateId: "championship:2026:gate:canyon"
  });

  const restored = normalizeRaisingProductionState(stored, { cageIds: CAGES, creatureIds: STARTERS });
  assert.equal(restored.collection.length, 1);
  assert.equal(restored.collection[0].displayName, "Ember");
  assert.equal(restored.assignments["championship:2026:instance:0001"], CAGES[1]);
  assert.equal(restored.assignments[STARTERS[0]], CAGES[0]);
  assert.equal(Object.keys(restored.assignments).length, 4);
});
