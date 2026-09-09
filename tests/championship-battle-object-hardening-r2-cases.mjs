import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  loadRuntimeBattleArenaArtReview,
  validateRuntimeBattleArenaArtReview
} from "../src/championship/presentation/runtimeBattleArenaArtReview.js";

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const trace = readJson("docs/research/BATTLE_BM04_BM08_BM11_OBJECT_TRACE_2026-09-02.json");
const receipt = readJson("docs/art/production/battle/hardening-r2/receipt.json");
const runtimeRoot = path.join(root, "assets/production/internal-battle-review/hardening-r2");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

function pixiDouble() {
  class Container {
    constructor(options = {}) {
      this.label = options.label;
      this.children = [];
      this.scale = { set() {} };
      this.position = { set() {} };
    }
    addChild(...children) { this.children.push(...children); }
    destroy() {}
  }
  class Sprite {
    constructor(texture) {
      this.texture = texture;
      this.position = { set() {} };
    }
  }
  return {
    Assets: {
      async load(src) { return { src }; },
      async unload() {}
    },
    Container,
    Sprite
  };
}

test("BM04/BM08/BM11 object evidence is metadata-only and keeps exact placements", () => {
  assert.equal(trace.dataBoundary, "METADATA_ONLY_NO_PIXEL_PALETTE_TILE_OR_NITRO_PAYLOAD");
  assert.equal(trace.result, "OBJECT_PLACEMENT_AND_FRAME_STRUCTURE_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT");
  const fields = Object.fromEntries(trace.fields.map((field) => [field.fieldId, field]));
  assert.deepEqual([fields.field_bm04_01.placementCount, fields.field_bm08_01.placementCount, fields.field_bm11_01.placementCount], [7, 1, 1]);
  assert.deepEqual([fields.field_bm04_01.cellCount, fields.field_bm08_01.cellCount, fields.field_bm11_01.cellCount], [4, 1, 2]);
  assert.deepEqual(fields.field_bm04_01.placements.map(({ sourceX, sourceY }) => [sourceX, sourceY]), [
    [24, 79], [208, 55], [24, 271], [392, 79], [392, 271], [352, 295], [400, 271]
  ]);
  assert.deepEqual(fields.field_bm08_01.placements.map(({ sourceX, sourceY }) => [sourceX, sourceY]), [[368, 304]]);
  assert.deepEqual(fields.field_bm11_01.placements[0].frames.map((frame) => frame.rawDurationTicks), [6, 6]);
  assert.equal(fields.field_bm11_01.totalFrameCount, 2);
});

test("original-created cutouts and all runtime object layers are RGBA production assets", () => {
  assert.equal(receipt.sourcePolicy, "ORIGINAL_CREATED_PIXELS_WITH_METADATA_ONLY_REFERENCE_PLACEMENT");
  assert.equal(receipt.researchPixelsInRuntime, false);
  assert.equal(receipt.sourceInputs.length, 4);
  for (const source of receipt.sourceInputs) {
    const file = path.join(root, source.file);
    assert.equal(sha256(file), source.sha256);
    assert.equal(pngHeader(file).colorType, 6);
  }
  const runtimePngs = fs.readdirSync(runtimeRoot).filter((name) => name.endsWith(".png"));
  assert.deepEqual(runtimePngs.sort(), [
    "field-bm04-01-objects.png",
    "field-bm08-01-objects.png",
    "field-bm11-01-objects-frame-00.png",
    "field-bm11-01-objects-frame-01.png"
  ]);
  for (const name of runtimePngs) {
    assert.deepEqual(pngHeader(path.join(runtimeRoot, name)), { width: 1536, height: 1024, colorType: 6 });
  }
});

test("R2 manifests enforce the three approved field-object architectures", () => {
  const expected = {
    bm04: ["ANIMATED_TERRAIN_BED", "ARENA_TERRAIN", "FIELD_OBJECTS", "CANONICAL_SHARED_LAYER"],
    bm08: ["ARENA_BACKGROUND", "FIELD_OBJECTS", "CANONICAL_SHARED_LAYER"],
    bm11: ["ARENA_BACKGROUND", "FIELD_OBJECTS", "CANONICAL_SHARED_LAYER"]
  };
  for (const arena of receipt.arenas) {
    const manifest = readJson(arena.runtimeManifest);
    const checked = validateRuntimeBattleArenaArtReview(manifest);
    assert.deepEqual(checked.arena.layers.map((layer) => layer.role), expected[arena.key]);
    assert.deepEqual(checked.arena.dependencies, ["production:battle:shared:field-bm00-00"]);
    assert.equal(checked.arena.layers.at(-1).sha256, "0906D94C70BAE26F5A1A65B0C7F304222B3CFA78007259389B18A34B51C5EB17");
    assert.equal(checked.runtimeEligible, false);
    assert.equal(checked.shippingReady, false);
    assert.equal(checked.humanApproved, false);
  }
});

test("BM11 animates its field-object sprite from caller time without a second ticker", async () => {
  const manifest = readJson("assets/production/internal-battle-review/hardening-r2/runtime.bm11.review.json");
  const review = await loadRuntimeBattleArenaArtReview({ PIXI: pixiDouble(), manifest });
  assert.equal(review.getDiagnostics().animations.length, 1);
  assert.equal(review.getDiagnostics().animations[0].role, "FIELD_OBJECTS");
  assert.equal(review.getDiagnostics().animations[0].layerIndex, 1);
  const duration = manifest.arena.layers[1].frames[0].durationMs;
  review.advance(duration + 0.01);
  assert.equal(review.getDiagnostics().animation.frameIndex, 1);
  assert.equal(review.displayObject.children[1].texture.src, manifest.arena.layers[1].frames[1].src);
  await review.dispose();
});

test("receipts pin placement envelopes and keep promotion closed", () => {
  assert.match(receipt.status, /^INTERNAL_(?:PIXI_REVIEW_PASSED|REVIEW_CANDIDATE)_NOT_OWNER_APPROVED_NOT_PROMOTED$/);
  assert.equal(receipt.arenas.length, 3);
  assert.deepEqual(receipt.arenas.map((arena) => arena.placements.length), [7, 1, 2]);
  for (const arena of receipt.arenas) {
    for (const placement of arena.placements) {
      assert.equal(placement.productionEnvelope.length, 4);
      assert.ok(placement.productionEnvelope[2] > 0 && placement.productionEnvelope[3] > 0);
    }
    for (const review of arena.reviewFrames) {
      const file = path.join(root, "docs/art/production/battle/hardening-r2", review.file);
      assert.equal(sha256(file), review.sha256);
    }
  }
});

test("R2 runtime bundle contains no ROM or Nitro payload", () => {
  const forbidden = /\.(?:nds|narc|ncgr|nclr|ncer|ncbr|nanr|opm|nscr|bsa|bin)$/i;
  const files = fs.readdirSync(runtimeRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile()).map((entry) => entry.name);
  assert.deepEqual(files.filter((file) => forbidden.test(file)), []);
});
