// VS2-PREP: current-repo protection for the frozen runtime invariants.
//
// These invariants were established across VS1 and are the reason the product can
// add a second screen without acquiring a second authority. They were previously
// covered only in the pre-migration research tree; this file gives them
// protection inside the product repository, without importing that tree.
//
// Nothing here is new policy. Each case pins an invariant the accepted VS1
// baseline already satisfies, so that VS2 cannot loosen one by accident.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CHAMPIONSHIP_SAVE_PORT_KIND,
  assertChampionshipSavePort,
  createNoopChampionshipSavePort
} from "../src/championship/kernel/ChampionshipSavePort.js";
import {
  CHAMPIONSHIP_SAVE_PORT_R2_KIND,
  CHAMPIONSHIP_SAVE_PORT_R2_POLICY,
  assertChampionshipSavePortR2,
  createChampionshipSavePortR2
} from "../src/championship/kernel/ChampionshipSavePortR2.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createFieldDefinition } from "../src/championship/field/fieldDefinition.js";
import { createFieldCollisionAdapter } from "../src/championship/field/fieldCollision.js";
import { computeFieldCameraWindow } from "../src/championship/field/fieldCamera.js";
import { getFieldFamilyProfile } from "../src/data/championship/r2/fields/fieldInventoryR2.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/entities.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    keys() { return [...data.keys()].sort(); }
  };
}

// ---------------------------------------------------------------------------
// Frozen zero-write research ports
// ---------------------------------------------------------------------------

test("the zero-write save port keeps its discard-on-exit policy and refuses persistent capability", () => {
  const port = createNoopChampionshipSavePort();
  assert.equal(port.kind, CHAMPIONSHIP_SAVE_PORT_KIND);
  assert.equal(port.policy, "MEMORY_ONLY_DISCARD_ON_EXIT");
  assert.deepEqual(
    { ...port.capabilities },
    { persistentRead: false, persistentWrite: false, persistentDelete: false }
  );
  assert.equal(port.inspect().committedWrites, 0);
  assert.equal(port.requestWrite({ requestId: "probe" }).accepted, false);
});

test("assertChampionshipSavePort rejects a port that claims persistence", () => {
  const honest = createNoopChampionshipSavePort();
  assert.equal(assertChampionshipSavePort(honest), true);

  const claimsWrite = { ...honest, capabilities: { persistentRead: false, persistentWrite: true, persistentDelete: false } };
  assert.throws(() => assertChampionshipSavePort(claimsWrite));

  const claimsPolicy = { ...honest, policy: "STANDALONE_LOCAL_PERSISTENCE" };
  assert.throws(() => assertChampionshipSavePort(claimsPolicy));
});

test("assertChampionshipSavePortR2 rejects a port that claims persistence or reports a persistent write", () => {
  const port = createChampionshipSavePortR2();
  assert.equal(assertChampionshipSavePortR2(port), true);
  assert.equal(port.kind, CHAMPIONSHIP_SAVE_PORT_R2_KIND);
  assert.equal(port.policy, CHAMPIONSHIP_SAVE_PORT_R2_POLICY);

  const claimsWrite = { ...port, capabilities: { ...port.capabilities, persistentWrite: true } };
  assert.throws(() => assertChampionshipSavePortR2(claimsWrite));

  const claimsNetwork = { ...port, capabilities: { ...port.capabilities, network: true } };
  assert.throws(() => assertChampionshipSavePortR2(claimsNetwork));

  const reportsWrite = { ...port, inspect: () => ({ ...port.inspect(), persistentWrites: 1 }) };
  assert.throws(() => assertChampionshipSavePortR2(reportsWrite));

  const reportsStorage = { ...port, inspect: () => ({ ...port.inspect(), browserStorageWrites: 1 }) };
  assert.throws(() => assertChampionshipSavePortR2(reportsStorage));
});

// ---------------------------------------------------------------------------
// One durable authority across a real product interaction
// ---------------------------------------------------------------------------

test("a full VS1 interaction leaves the R2 domain at zero persistent, storage and network writes", async () => {
  const storage = memoryStorage();
  const app = createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-28T12:00:00.000Z"
  });
  const started = await app.newGame();
  const residentId = started.snapshot.residents[0].residentId;
  app.select(residentId);
  app.care(residentId);
  app.moveToCage(residentId, presentation.cages[1].cageId);
  app.save();

  const boundary = app.getSession().inspectRaisingSaveBoundary();
  assert.equal(boundary.persistentWrites, 0, "the R2 domain must never acquire a durable write");
  assert.equal(boundary.browserStorageWrites, 0);
  assert.equal(boundary.networkMutations, 0);
  assert.equal(boundary.policy, CHAMPIONSHIP_SAVE_PORT_R2_POLICY);

  // Exactly one durable authority, and it is the standalone port.
  assert.equal(storage.keys().length, 1);
  assert.equal(app.savePort.capabilities.persistentWrite, true);
  await app.dispose();
});

// ---------------------------------------------------------------------------
// Frozen Hunt-field geometry
//
// VS2 builds on this: the original Hunt world is a large 128x128 modular field
// traversed by a camera, not a screen-sized scene. The bound is ROM-evidenced and
// must not drift when a viewport-shaped implementation arrives.
// ---------------------------------------------------------------------------

function huntFieldDefinition(fieldId, values) {
  const profile = getFieldFamilyProfile("HM");
  return createFieldDefinition({
    schemaVersion: 2,
    fieldId,
    family: "HM",
    collisionProfileId: profile.profileId,
    dimensions: { widthTiles: 128, heightTiles: 128 },
    tileSizePx: 16,
    chunkSizeTiles: 16,
    collisionData: { kind: "HM_SANITIZED_ATTRIBUTE_GRID", values: values ?? new Array(128 * 128).fill(0) }
  }, profile);
}

test("the Hunt field family stays fixed at 128 by 128 tiles", () => {
  const profile = getFieldFamilyProfile("HM");
  assert.deepEqual({ ...profile.fixedDimensions }, { widthTiles: 128, heightTiles: 128 });
  assert.equal(profile.originalDimensionStatus, "VERIFIED_BINARY");
  assert.equal(profile.collisionContract.executable, true);

  const definition = huntFieldDefinition("championship:2026:r2:field:hm-invariant-probe");
  assert.equal(definition.dimensions.widthTiles, 128);
  assert.equal(definition.dimensions.heightTiles, 128);

  // A screen-sized Hunt field is refused at the contract, not at review time.
  assert.throws(() => createFieldDefinition({
    schemaVersion: 2,
    fieldId: "championship:2026:r2:field:hm-screen-sized",
    family: "HM",
    collisionProfileId: profile.profileId,
    dimensions: { widthTiles: 24, heightTiles: 42 },
    tileSizePx: 16,
    chunkSizeTiles: 16,
    collisionData: { kind: "HM_SANITIZED_ATTRIBUTE_GRID", values: new Array(24 * 42).fill(0) }
  }, profile), /exactly 128 by 128/);
});

test("the Hunt collision rule stays bounded to the one verified bit and out-of-bounds", () => {
  const values = new Array(128 * 128).fill(0);
  values[(3 * 128) + 5] = 0x01;   // bit 0 set: the one ROM-verified blocking rule
  values[(4 * 128) + 5] = 0xfe;   // every other bit set: unresolved, not blocking
  const collision = createFieldCollisionAdapter(
    huntFieldDefinition("championship:2026:r2:field:hm-collision-probe", values)
  );

  const blocked = collision.evaluate({ x: 5, y: 3 });
  assert.equal(blocked.traversalAllowed, false);
  assert.equal(blocked.blockedByKnownRule, true);

  // Unknown bits stay unknown. Calling them passable or blocking are both
  // inventions, and the adapter must commit to neither.
  const unresolved = collision.evaluate({ x: 5, y: 4 });
  assert.equal(unresolved.traversalDecision, "UNKNOWN");
  assert.equal(unresolved.traversalAllowed, null);
  assert.equal(unresolved.unknownBitMask, 0xfe);

  const outside = collision.evaluate({ x: 128, y: 0 });
  assert.equal(outside.outOfBounds, true);
  assert.equal(outside.traversalAllowed, false);
});

test("a portrait viewport is a camera window over the world, never the world itself", () => {
  const definition = huntFieldDefinition("championship:2026:r2:field:hm-camera-probe");
  const worldSpanPx = 128 * 16;
  assert.equal(worldSpanPx, 2048);

  // 9:16 portrait, the product's reference viewport.
  const window = computeFieldCameraWindow(definition, {
    centerX: 0,
    centerY: 0,
    viewportWidth: 390,
    viewportHeight: 844
  });
  assert.ok(window.width < worldSpanPx && window.height < worldSpanPx, "the viewport must not span the world");
  // Clamped into the world rather than allowed to drift off it.
  assert.equal(window.left, 0);
  assert.equal(window.top, 0);

  const far = computeFieldCameraWindow(definition, {
    centerX: 99_999,
    centerY: 99_999,
    viewportWidth: 390,
    viewportHeight: 844
  });
  assert.equal(far.right, worldSpanPx);
  assert.equal(far.bottom, worldSpanPx);
});
