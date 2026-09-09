import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateRuntimeBattleArenaArtReview } from "../src/championship/presentation/runtimeBattleArenaArtReview.js";

const root = process.cwd();
const batchRoot = path.join(root, "docs/art/production/battle/bm03-bm04-animated-r1");
const runtimeRoot = path.join(root, "assets/production/internal-battle-review/bm03-bm04-animated-r1");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const trace = readJson("docs/research/BATTLE_BM03_BM04_ANIMATION_TRACE_2026-09-02.json");
const manifest = readJson("docs/art/production/battle/bm03-bm04-animated-r1/manifest.json");
const receipt = readJson("docs/art/production/battle/bm03-bm04-animated-r1/receipt.json");
const catalog = readJson("src/data/championship/catalogs/battle-arenas.r1.json");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("BM03/BM04 trace closes placement and timing with metadata only", () => {
  assert.equal(trace.inputPolicy, "EXTERNAL_RESEARCH_ONLY_NO_PAYLOAD_WRITTEN");
  assert.equal(trace.result, "PLACEMENT_TIMING_AND_COMPOSITION_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT");
  assert.equal(trace.fields.length, 2);
  const bm03 = trace.fields.find((item) => item.fieldId === "field_bm03_01");
  const bm04 = trace.fields.find((item) => item.fieldId === "field_bm04_01");
  assert.deepEqual(bm03.frameDurationsRawTicks, [50, 50]);
  assert.deepEqual(bm04.frameDurationsRawTicks, [20, 20]);
  for (const field of trace.fields) {
    assert.equal(field.sourceEvidence, "VERIFIED_ROM_PAYLOAD_HASH_AND_BSAR_STRUCTURE");
    assert.deepEqual(field.gridCells, [52, 34]);
    assert.deepEqual(field.dimensionsPixels, [416, 272]);
    assert.deepEqual(field.originPixels, [0, 0]);
    assert.equal(field.frameCount, 2);
    assert.equal(field.compositionOrder, "ANIMATED_TERRAIN_BED_THEN_STATIC_TERRAIN_AND_OBJECTS_THEN_BM00_COMMON");
    assert.equal(field.semanticClaim, "FIELD_ANIMATION_ONLY_NO_GAMEPLAY_MEANING");
  }
});

test("catalog and manifests retain both original animation and shared-layer facts", () => {
  for (const arena of receipt.arenas) {
    const record = catalog.records.find((item) => item.string04 === arena.fieldId);
    assert.ok(record);
    assert.equal(record.string08, "field_bm00_00_common");
    assert.equal(record.string0C, `${arena.fieldId}_anim`);
    const runtime = readJson(arena.runtimeManifest);
    const checked = validateRuntimeBattleArenaArtReview(runtime);
    assert.equal(checked.arena.layers.length, 3);
    assert.deepEqual(checked.arena.layers.map((layer) => layer.role), [
      "ANIMATED_TERRAIN_BED", "ARENA_TERRAIN", "CANONICAL_SHARED_LAYER"
    ]);
    assert.deepEqual(checked.arena.dependencies, ["production:battle:shared:field-bm00-00"]);
    assert.equal(checked.arena.animation.frameCount, 2);
    assert.equal(checked.runtimeEligible, false);
    assert.equal(checked.shippingReady, false);
  }
});

test("original-created frames, alpha terrain, masks, composites and viewports match receipts", () => {
  assert.equal(receipt.arenas.length, 2);
  for (const arena of receipt.arenas) {
    const source = path.join(batchRoot, arena.source.file);
    assert.deepEqual(pngHeader(source), { width: 1536, height: 1024, colorType: 2 });
    assert.equal(sha256(source), arena.source.sha256);
    assert.ok(arena.mask.coverage > 0.04 && arena.mask.coverage < 0.50);
    const mask = path.join(batchRoot, arena.mask.file);
    assert.equal(pngHeader(mask).colorType, 0);
    assert.equal(sha256(mask), arena.mask.sha256);
    const terrain = path.join(root, arena.terrainOverlay.file);
    assert.deepEqual(pngHeader(terrain), { width: 1536, height: 1024, colorType: 6 });
    assert.equal(sha256(terrain), arena.terrainOverlay.sha256);
    assert.equal(arena.animationFrames.length, 2);
    assert.notEqual(arena.animationFrames[0].sha256, arena.animationFrames[1].sha256);
    for (const frame of arena.animationFrames) {
      const file = path.join(root, frame.src);
      assert.deepEqual(pngHeader(file), { width: 1536, height: 1024, colorType: 2 });
      assert.equal(sha256(file), frame.sha256);
    }
    assert.equal(arena.compositeFrames.length, 2);
    assert.equal(arena.viewportChecks.length, 10);
    for (const item of [...arena.compositeFrames, ...arena.viewportChecks]) {
      const file = path.join(batchRoot, item.file);
      assert.equal(sha256(file), item.sha256);
    }
  }
});

test("BM04 object separation remains explicit and promotion stays closed", () => {
  const bm03 = receipt.arenas.find((item) => item.key === "bm03");
  const bm04 = receipt.arenas.find((item) => item.key === "bm04");
  assert.equal(bm03.productionObjectSeparationRequired, false);
  assert.equal(bm04.referenceObjectLayerPresent, true);
  assert.equal(bm04.productionObjectSeparationRequired, true);
  assert.equal(receipt.promotion.humanApproved, false);
  assert.equal(receipt.promotion.readyForRuntime, false);
  assert.equal(receipt.promotion.shippingReady, false);
  assert.equal(manifest.reviewPolicy.runtimeQaPassed, true);
});

test("runtime animated bundle contains no copied Nitro or ROM payload", () => {
  const forbidden = /\.(?:nds|narc|ncgr|nclr|nscr|bsa|bin)$/i;
  const files = fs.readdirSync(runtimeRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile()).map((entry) => entry.name);
  assert.deepEqual(files.filter((file) => forbidden.test(file)), []);
});
