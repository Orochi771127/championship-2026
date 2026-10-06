// Ranch expansion PROTOTYPE (2026-10-05): one non-paid annex deck of ten slots.
//
// What this file defends:
//  - a save that never takes the prototype grant keeps exactly its old shape;
//  - the annex keeps the original board's rules inside itself (masks, the
//    upper-row rule for two-row shapes, its own occupancy word, no rank gate);
//  - the grant and its revocation are versioned migrations, never a reset;
//  - the field ring, its art and the folded presentation agree on every point.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  RANCH_DECKS_LAYOUT,
  RANCH_EXPANSION_GRANT_PROTOTYPE,
  annexPlacementMask,
  isAnnexSlot,
  normalizeRanchExpansion,
  prototypeRanchExpansion,
  ranchRing,
  validateExpandedRanch
} from "../src/championship/cage/ranchExpansion.js";
import { NATIVE_RANCH_LAYOUT, originalStartingRanch } from "../src/championship/cage/nativeRanchLayout.js";
import { createCageEditRuntime } from "../src/championship/cage/cageEditRuntime.js";
import { listCageDefinitions } from "../src/championship/cage/cageCatalog.js";
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from "../src/championship/cage/ranchSlotGeometry.js";
import { createNativeRaisingGround as createOriginalGround, nativeRaisingSpawnPosition as originalSpawn } from "../src/championship/raising/nativeRaisingGround.js";
import { composeRanchRingGround, createRanchRaisingGround as createNativeRaisingGround, ranchRaisingSpawnPosition as nativeRaisingSpawnPosition,
  ringRaisingSpawnPosition } from "../src/championship/raising/nativeRaisingRanchRing.js";
import { createRaisingCageArtPlan as createOriginalArtPlan } from "../src/championship/presentation/raisingCageArtPlan.js";
import { composeRanchArtPlan, createRanchCageArtPlan as createRaisingCageArtPlan } from "../src/championship/presentation/raisingRanchArtPlan.js";
import { validateNativeRanch } from "../src/championship/cage/nativeRanchLayout.js";
import { RAISING_TOP_HEADROOM_NATIVE, raisingFieldViewport, raisingNativeToScreen, raisingScreenToNative } from "../src/championship/presentation/intRh2/raisingFieldViewport.js";
import { RANCH_ANNEX_BAND_OFFSET_NATIVE, RANCH_UPPER_ROW_CAP_NATIVE } from "../src/championship/presentation/raisingRanchArtPlan.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const cageManifest = JSON.parse(fs.readFileSync("assets/production/cage/licensed-runtime-v1/manifest.json", "utf8"));
const definitions = listCageDefinitions();
const owned = definitions.map((definition) => definition.shopRecordIndex).filter(Number.isInteger);
const moduleOf = (index) => definitions[index].moduleId;
const shapeOf = (index) => ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[index]];

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(String(key), String(value)),
    removeItem: (key) => data.delete(key), keys: () => [...data.keys()] };
}
const createApp = (storage = memoryStorage()) => createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages });

/** A granted runtime with cages placed at the given saved slots. */
function expandedRuntime(entries, tamerRank = 0) {
  const runtime = createCageEditRuntime({ initializeOriginal: true });
  runtime.grantExpansion(owned, tamerRank);
  for (const [index, slot] of entries) {
    runtime.selectModule(moduleOf(index), owned, tamerRank);
    assert.equal(runtime.placeAt(slot, owned, tamerRank).lastVerdict.reason, "PLACED", `${index}@${slot}`);
  }
  runtime.confirm(owned, tamerRank);
  return runtime;
}

test("the saved entitlement record is versioned and refuses anything it does not know", () => {
  assert.deepEqual(prototypeRanchExpansion(), { version: 1, decks: 1, grant: RANCH_EXPANSION_GRANT_PROTOTYPE });
  assert.deepEqual(normalizeRanchExpansion({ version: 1, decks: 1, grant: RANCH_EXPANSION_GRANT_PROTOTYPE }), prototypeRanchExpansion());
  assert.equal(normalizeRanchExpansion(null), null);
  for (const bad of [{ version: 2, decks: 1, grant: RANCH_EXPANSION_GRANT_PROTOTYPE }, { version: 1, decks: 2, grant: RANCH_EXPANSION_GRANT_PROTOTYPE },
    { version: 1, decks: 1, grant: "PAID" }, { version: 1, decks: 1, grant: RANCH_EXPANSION_GRANT_PROTOTYPE, price: 100 }, [], "x"]) {
    assert.throws(() => normalizeRanchExpansion(bad), /RANCH_EXPANSION/, JSON.stringify(bad));
  }
});

test("the annex keeps every original shape rule inside its own ten slots", () => {
  const expansion = prototypeRanchExpansion();
  for (const definition of definitions.filter((entry) => entry.cageDefinitionIndex !== 35)) {
    const shape = shapeOf(definition.cageDefinitionIndex);
    for (let local = 0; local < 10; local += 1) {
      const mask = annexPlacementMask({ moduleId: definition.moduleId, slotIndex: 20 + local }, expansion);
      const fits = ((shape << local) & ~0x3ff) === 0;
      const upperRowRule = !((shape & 0xaa) && (local & 1));
      assert.equal(mask === null ? null : mask, fits && upperRowRule ? shape << local : null, `${definition.cageDefinitionIndex}@${local}`);
    }
  }
  const start = originalStartingRanch().placements;
  // Overlap inside the annex, the Waiting Room, and a module used twice are refused.
  assert.equal(validateExpandedRanch([...start, { moduleId: moduleOf(2), slotIndex: 20 }], 14, expansion), true);
  assert.equal(validateExpandedRanch([...start, { moduleId: moduleOf(2), slotIndex: 20 }, { moduleId: moduleOf(3), slotIndex: 22 }], 14, expansion), false);
  assert.equal(validateExpandedRanch([...start, { moduleId: moduleOf(0), slotIndex: 20 }], 14, expansion), false, "cage 0 is already on the main board");
  assert.equal(validateExpandedRanch([...start.filter((p) => p.slotIndex !== 0), { moduleId: start[0].moduleId, slotIndex: 20 }], 14, expansion), false);
  // No annex without the grant.
  assert.equal(validateExpandedRanch([...start, { moduleId: moduleOf(2), slotIndex: 20 }], 14, null), false);
  assert.equal(isAnnexSlot(19), false);
  assert.equal(isAnnexSlot(29), true);
  assert.equal(isAnnexSlot(30), false);
});

test("a ranch that never takes the grant keeps its frame and save exactly", () => {
  const runtime = createCageEditRuntime({ initializeOriginal: true });
  const frame = runtime.getFrame(owned, 0);
  assert.equal("expansion" in frame, false);
  assert.equal(frame.slots.length, 20);
  assert.deepEqual(runtime.toSave(), originalStartingRanch());
  assert.equal(runtime.placeAt(20, owned, 0).lastVerdict.reason, "NOTHING_SELECTED");
  runtime.selectModule(moduleOf(2), owned, 0);
  assert.equal(runtime.placeAt(20, owned, 0).lastVerdict.reason, "OUT_OF_BOUNDS");
  // The legacy single-cell layout cannot take the grant.
  const legacy = createCageEditRuntime({ snapshot: { placements: [] } });
  assert.equal(legacy.grantExpansion(owned, 0).lastVerdict.reason, "EXPANSION_REQUIRES_NATIVE_RANCH");
  assert.equal("layoutVersion" in legacy.toSave(), false);
});

test("grant and revoke are a reversible, versioned migration; the annex ignores rank", () => {
  const runtime = expandedRuntime([[2, 20]], 0);
  const saved = runtime.toSave();
  assert.equal(saved.layoutVersion, RANCH_DECKS_LAYOUT);
  assert.deepEqual(saved.expansion, prototypeRanchExpansion());
  assert.deepEqual(saved.placements.at(-1), { moduleId: moduleOf(2), slotIndex: 20 });
  // Rank 0 opens 14 main slots; the annex is open regardless.
  const frame = runtime.getFrame(owned, 0);
  assert.equal(frame.unlockedCount, 14);
  assert.equal(frame.expansion.annexSlotCount, 10);
  assert.deepEqual(frame.slots.filter((slot) => slot.deck === 1 && slot.moduleId).map((slot) => slot.slotIndex), [20, 21, 22, 23, 24]);
  // Round trip through a snapshot.
  assert.deepEqual(createCageEditRuntime({ snapshot: saved }).toSave(), saved);
  // A two-row shape cannot start on the annex's lower row.
  runtime.selectModule(moduleOf(1), owned, 0);
  runtime.removePlacement(moduleOf(1), owned, 0);
  runtime.selectModule(moduleOf(1), owned, 0);
  assert.equal(runtime.placeAt(25, owned, 0).lastVerdict.reason, "FOOTPRINT_BLOCKED");
  assert.equal(runtime.placeAt(26, owned, 0).lastVerdict.reason, "PLACED");
  // Revoke refuses while the annex holds a cage, then restores version 1 exactly.
  assert.equal(runtime.revokeExpansion(owned, 0).lastVerdict.reason, "EXPANSION_NOT_EMPTY");
  runtime.revert(owned, 0);
  runtime.removePlacement(moduleOf(2), owned, 0);
  runtime.confirm(owned, 0);
  assert.equal(runtime.revokeExpansion(owned, 0).lastVerdict.reason, "EXPANSION_REVOKED");
  assert.deepEqual(runtime.toSave(), originalStartingRanch());
  // Snapshots that mix versions are refused rather than repaired.
  assert.throws(() => createCageEditRuntime({ snapshot: { ...saved, expansion: undefined } }), /RANCH_EXPANSION_REQUIRED/);
  assert.throws(() => createCageEditRuntime({ snapshot: { ...originalStartingRanch(), expansion: prototypeRanchExpansion() } }), /WITHOUT_DECKS/);
});

test("the field ring continues into the annex: cages, origins and spawns land there", () => {
  const save = expandedRuntime([[2, 20]]).toSave();
  for (const unlockedCount of [14, 20]) {
    const ground = createNativeRaisingGround({ ...save, unlockedCount });
    assert.equal(ground.width, (unlockedCount + 10) * 6);
    assert.equal(ground.annexStartPixel, unlockedCount * 48);
    const annexCage = ground.placement(2);
    assert.equal(annexCage.slotIndex, unlockedCount);
    assert.equal(annexCage.savedSlotIndex, 20);
    assert.deepEqual(ground.origin(2), [unlockedCount * 48, -24, 0]);
    let seed = 7;
    const spawn = nativeRaisingSpawnPosition(ground, 2, { next: () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 103 });
    assert.ok(spawn[0] >> 12 >= unlockedCount * 48, "spawned inside the annex");
    assert.equal(ground.cageAt(spawn[0] >> 12, spawn[1] >> 12)?.definitionIndex, 2);
    // Main-board cages keep their original ring slots and origins.
    assert.deepEqual(ground.origin(0), createOriginalGround({ ...originalStartingRanch(), unlockedCount }).origin(0));
  }
  // Without the grant the ring is the original board.
  const plain = ranchRing({ ...originalStartingRanch(), unlockedCount: 14 });
  assert.equal(plain.ringCount, 14);
  assert.equal(plain.annexStart, null);
  assert.deepEqual(plain.placements, originalStartingRanch().placements);
});

test("the annex is drawn as the honeycomb's next two rows, and the folded view maps every point both ways", () => {
  const runtime = expandedRuntime([[2, 20]]);
  const frame = runtime.getFrame(owned, 0);
  const plan = createRaisingCageArtPlan({ manifest: cageManifest, placements: frame.placements, layoutVersion: frame.layoutVersion,
    unlockedCount: frame.unlockedCount, expansion: frame.expansion });
  const unit = plan.wrapWidthPx / (24 * 48);
  // Field tops sit 88 native px apart and the upper row drops a 24 px top band,
  // so a third row's visible edge is 64 + 88 + 24 = 176 px down.
  assert.equal(RANCH_ANNEX_BAND_OFFSET_NATIVE, 64 + 88 + 24);
  assert.deepEqual(plan.fold, { splitPx: 14 * 48 * unit, ringPx: 24 * 48 * unit,
    bandOffsetPx: RANCH_ANNEX_BAND_OFFSET_NATIVE * unit, capPx: RANCH_UPPER_ROW_CAP_NATIVE * unit });
  const annexTile = plan.placements.find((tile) => tile.cageDefinitionIndex === 2 && !tile.foldCap);
  assert.equal(annexTile.x, 14 * 96 * unit / 2);
  // Every annex upper-row cell gets its dropped top band back as a cap, and
  // nothing else does: the cage at ring 14 and the Lids at 20 and 22.
  const caps = plan.placements.filter((tile) => tile.foldCap);
  assert.deepEqual(caps.map((tile) => tile.capOfSlot).sort((a, b) => a - b), [14, 20, 22]);
  for (const cap of caps) {
    const cell = plan.placements.find((tile) => tile.slotIndex === cap.capOfSlot);
    assert.deepEqual([cap.x, cap.y, cap.sourceRect.y, cap.sourceRect.height, cap.sourceRect.width],
      [cell.x, -RANCH_UPPER_ROW_CAP_NATIVE * unit, 0, RANCH_UPPER_ROW_CAP_NATIVE * unit, cell.sourceRect.width]);
  }
  // The original layout has no fold.
  const plain = createRaisingCageArtPlan({ manifest: cageManifest, placements: originalStartingRanch().placements,
    layoutVersion: NATIVE_RANCH_LAYOUT, unlockedCount: 14 });
  assert.equal("fold" in plain, false);

  const field = { presentationMode: "NATIVE_RANCH", nativePixelWorldScale: unit, worldWidthPx: plan.fold.splitPx, wrapWidthPx: null,
    worldHeightPx: 192 * unit, fold: { ...plan.fold, annexWidthPx: plan.fold.ringPx - plan.fold.splitPx } };
  const view = { width: 390, height: 723, scrollY: 0 };
  const fit = raisingFieldViewport(field, view);
  assert.equal(fit.scale * unit, 2, "two whole screen pixels per native pixel");
  // Headroom, the board and the annex rows below it: no gap between them.
  assert.equal(fit.scrollMaxY, (RAISING_TOP_HEADROOM_NATIVE + RANCH_ANNEX_BAND_OFFSET_NATIVE + 192) * 2 - (723 - 12));
  // Well inside each band, and where the two rows meet: a point near a main
  // lower-row centre (96, 120) stays on the main board, one near an annex
  // first-row centre (48, 208 in the main band's frame) goes to the annex.
  for (const [x, y, band] of [[40, 30, 0], [600, 150, 0], [14 * 48 + 20, 60, 1], [24 * 48 - 5, 170, 1], [96, 165, 0], [14 * 48 + 48, -11, 1]]) {
    const point = raisingNativeToScreen([x * 4096, y * 4096, 0], field, view, 0);
    assert.equal(point.band, band, `${x},${y}`);
    const back = raisingScreenToNative(point, field, view, 0);
    assert.ok(back.band === band && Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6, `${x},${y} -> ${JSON.stringify(back)}`);
  }
  // Past the annex's five columns nothing lies below the main board.
  const below = raisingScreenToNative({ x: fit.x + 600 * unit * fit.scale, y: fit.y + 300 * unit * fit.scale }, field, view, 0);
  assert.equal(below.band, 0);
});

test("the app grants, saves, reloads and revokes without touching anything else in the save", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  const before = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  app.openCageEdit();
  assert.equal(app.grantRanchExpansionPrototype().lastVerdict.reason, "EXPANSION_GRANTED");
  app.removeCagePlacement(moduleOf(15));
  app.selectCageModule(moduleOf(15));
  assert.equal(app.placeCageAt(21).lastVerdict.reason, "PLACED");
  app.confirmCageEdit();
  app.leaveScreen();
  app.save();
  const granted = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.equal(granted.schemaVersion, before.schemaVersion);
  assert.equal(granted.cageEdit.layoutVersion, RANCH_DECKS_LAYOUT);
  assert.deepEqual(granted.cageEdit.expansion, prototypeRanchExpansion());
  assert.deepEqual(granted.cageEdit.placements.find((p) => p.moduleId === moduleOf(15)), { moduleId: moduleOf(15), slotIndex: 21 });
  await app.dispose();

  const reloaded = createApp(storage);
  await reloaded.continueGame();
  reloaded.openCageEdit();
  assert.equal(reloaded.getCageEditFrame().layoutVersion, RANCH_DECKS_LAYOUT);
  assert.ok(reloaded.getCageEditFrame().slots.some((slot) => slot.slotIndex === 21 && slot.moduleId === moduleOf(15)));
  // Revoking needs an empty annex; once empty it writes the original version back.
  assert.equal(reloaded.revokeRanchExpansionPrototype().lastVerdict.reason, "EXPANSION_NOT_EMPTY");
  reloaded.removeCagePlacement(moduleOf(15));
  reloaded.selectCageModule(moduleOf(15));
  reloaded.placeCageAt(7);
  reloaded.confirmCageEdit();
  assert.equal(reloaded.revokeRanchExpansionPrototype().lastVerdict.reason, "EXPANSION_REVOKED");
  reloaded.leaveScreen();
  reloaded.save();
  const revoked = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(revoked.cageEdit, before.cageEdit);
  await reloaded.dispose();
});

test("a hand-edited save that breaks the expansion version is refused, not reset", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await app.newGame();
  app.save();
  await app.dispose();
  const original = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  for (const cageEdit of [
    { ...JSON.parse(original).cageEdit, expansion: prototypeRanchExpansion() },
    { ...JSON.parse(original).cageEdit, layoutVersion: RANCH_DECKS_LAYOUT },
    { ...JSON.parse(original).cageEdit, layoutVersion: RANCH_DECKS_LAYOUT, expansion: { ...prototypeRanchExpansion(), version: 9 } }
  ]) {
    storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify({ ...JSON.parse(original), cageEdit }));
    const written = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
    const broken = createApp(storage);
    // The save port reports it unreadable; Continue opens nothing.
    assert.equal(broken.canContinue().loadable, false);
    assert.equal(await broken.continueGame(), null);
    await broken.dispose();
    assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), written, "the save is left exactly as it was");
  }
});

// The ring repeats nativeRaisingGround.js / raisingCageArtPlan.js (both
// hash-locked by the cage authoring contract). Over every original layout the
// repeats must produce exactly what the originals produce.
test("the ring composer, spawn sampler and art plan repeat the originals exactly on every original layout", () => {
  const start = originalStartingRanch();
  const waiting = start.placements.filter((p) => p.slotIndex === 0);
  let layouts = 0;
  for (const unlockedCount of [14, 16, 18, 20]) {
    for (const definition of definitions.filter((entry) => entry.cageDefinitionIndex !== 35)) {
      for (let slot = 1; slot < unlockedCount; slot += 1) {
        const placements = [...waiting, { moduleId: definition.moduleId, slotIndex: slot }];
        if (!validateNativeRanch(placements, unlockedCount)) continue;
        layouts += 1;
        const frame = { layoutVersion: NATIVE_RANCH_LAYOUT, placements, unlockedCount };
        const original = createOriginalGround(frame), ring = composeRanchRingGround(ranchRing(frame));
        assert.deepEqual([ring.width, ring.height, ring.pixelWidth], [original.width, original.height, original.pixelWidth]);
        assert.deepEqual(ring.terrain, original.terrain);
        assert.deepEqual(ring.clearance, original.clearance);
        assert.deepEqual(ring.owners, original.owners);
        assert.deepEqual(ring.placements, original.placements);
        assert.equal("annexStartPixel" in ring, false);
        for (const placed of [35, definition.cageDefinitionIndex]) {
          assert.deepEqual(ring.origin(placed), original.origin(placed));
          let a = 11, b = 11;
          const rngA = { next: () => (a = (a * 69069 + 1) % 4294967296) % 103 }, rngB = { next: () => (b = (b * 69069 + 1) % 4294967296) % 103 };
          assert.deepEqual(ringRaisingSpawnPosition(ring, placed, rngA), originalSpawn(original, placed, rngB));
        }
        const artInput = { manifest: cageManifest, placements, layoutVersion: NATIVE_RANCH_LAYOUT, unlockedCount };
        let expected = null, refused = null;
        try { expected = createOriginalArtPlan(artInput); } catch (error) { refused = error.message; }
        if (refused) assert.throws(() => composeRanchArtPlan(artInput), (error) => error.message === refused);
        else assert.deepEqual(composeRanchArtPlan(artInput), expected);
      }
    }
  }
  assert.ok(layouts > 1000, `${layouts} layouts`);
  // A ranch without the grant is handed to the originals untouched.
  const frame = { ...start, unlockedCount: 14 };
  assert.deepEqual(createNativeRaisingGround(frame).terrain, createOriginalGround(frame).terrain);
  assert.deepEqual(createRaisingCageArtPlan({ manifest: cageManifest, ...frame }), createOriginalArtPlan({ manifest: cageManifest, ...frame }));
});
