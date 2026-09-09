import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  loadRuntimeBattleArenaArtReview,
  validateRuntimeBattleArenaArtReview
} from "../src/championship/presentation/runtimeBattleArenaArtReview.js";

const manifest = JSON.parse(fs.readFileSync(
  "assets/production/internal-battle-review/bm00-bm01-r1/runtime.review.json",
  "utf8"
));
const independentManifestPath = "assets/production/internal-battle-review/bm07-cyberspace-r1/runtime.review.json";
const animatedManifest = JSON.parse(fs.readFileSync(
  "assets/production/internal-battle-review/bm03-bm04-animated-r1/runtime.bm03.review.json",
  "utf8"
));

function pixiDouble() {
  const loaded = [];
  const unloaded = [];
  class Container {
    constructor(options = {}) {
      this.label = options.label;
      this.children = [];
      this.scale = { set: (value) => { this.scaleValue = value; } };
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
    }
    addChild(...children) { this.children.push(...children); }
    destroy(options) { this.destroyOptions = options; }
  }
  class Sprite {
    constructor(texture) {
      this.texture = texture;
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
    }
  }
  return {
    PIXI: {
      Assets: {
        async load(src) { loaded.push(src); return { src }; },
        async unload(src) { unloaded.push(src); }
      },
      Container,
      Sprite
    },
    loaded,
    unloaded
  };
}

test("Battle art review manifest preserves the canonical shared-layer dependency", () => {
  const checked = validateRuntimeBattleArenaArtReview(manifest);
  assert.equal(checked.arena.layers.length, 2);
  assert.equal(checked.arena.layers[0].role, "ARENA_BACKGROUND");
  assert.equal(checked.arena.layers[1].role, "CANONICAL_SHARED_LAYER");
  assert.deepEqual(checked.arena.dependencies, [checked.arena.layers[1].assetId]);
  assert.equal(checked.runtimeEligible, false);
  assert.equal(checked.shippingReady, false);
});

test("Battle art review rejects gameplay, UI, collision, and non-production paths", () => {
  const badGameplay = structuredClone(manifest);
  badGameplay.arena.gameplayBinding = "BATTLE_RUNTIME";
  assert.throws(() => validateRuntimeBattleArenaArtReview(badGameplay), /GAMEPLAY_MUST_STAY_EXTERNAL/);

  const badUi = structuredClone(manifest);
  badUi.arena.uiBinding = "INVENTED_BATTLE_HUD";
  assert.throws(() => validateRuntimeBattleArenaArtReview(badUi), /UI_MUST_STAY_ABSENT/);

  const badPath = structuredClone(manifest);
  badPath.arena.layers[0].src = "docs/art/production/battle/source.png";
  assert.throws(() => validateRuntimeBattleArenaArtReview(badPath), /LAYER_OUTSIDE_INTERNAL_PRODUCTION_REVIEW/);
});

test("Battle art review accepts a catalog-proven independent single layer and rejects mixed contracts", () => {
  const independent = JSON.parse(fs.readFileSync(independentManifestPath, "utf8"));
  const checked = validateRuntimeBattleArenaArtReview(independent);
  assert.deepEqual(checked.arena.dependencies, []);
  assert.equal(checked.arena.layers.length, 1);
  assert.equal(checked.arena.layers[0].role, "ARENA_BACKGROUND");
  assert.equal(checked.arena.layers[0].alpha, false);

  const missingSharedLayer = structuredClone(manifest);
  missingSharedLayer.arena.layers.pop();
  assert.throws(() => validateRuntimeBattleArenaArtReview(missingSharedLayer), /SHARED_ARENA_MUST_HAVE_TWO_OR_THREE_LAYERS/);

  const inventedSharedLayer = structuredClone(independent);
  inventedSharedLayer.arena.layers.push(structuredClone(manifest.arena.layers[1]));
  assert.throws(() => validateRuntimeBattleArenaArtReview(inventedSharedLayer), /INDEPENDENT_ARENA_MUST_HAVE_ONE_LAYER/);
});

test("Battle art review validates the evidence-bound animated three-layer contract", () => {
  const checked = validateRuntimeBattleArenaArtReview(animatedManifest);
  assert.deepEqual(checked.arena.layers.map((layer) => layer.role), [
    "ANIMATED_TERRAIN_BED", "ARENA_TERRAIN", "CANONICAL_SHARED_LAYER"
  ]);
  assert.equal(checked.arena.animation.frameCount, 2);
  assert.equal(checked.arena.layers[0].frames.length, 2);
  assert.equal(checked.arena.layers[1].assetId, checked.arena.assetId);
  assert.equal(checked.arena.layers[2].assetId, checked.arena.dependencies[0]);

  const wrongDriver = structuredClone(animatedManifest);
  wrongDriver.arena.animation.updateDriver = "SECOND_TICKER";
  assert.throws(() => validateRuntimeBattleArenaArtReview(wrongDriver), /ANIMATION_CALLER_TICKER_REQUIRED/);

  const wrongOrder = structuredClone(animatedManifest);
  [wrongOrder.arena.layers[0], wrongOrder.arena.layers[1]] = [wrongOrder.arena.layers[1], wrongOrder.arena.layers[0]];
  assert.throws(() => validateRuntimeBattleArenaArtReview(wrongOrder), /LAYER_ORDER_INVALID/);
});

test("Pixi review loads background then shared layer and fits every contract viewport", async () => {
  const { PIXI, loaded, unloaded } = pixiDouble();
  const review = await loadRuntimeBattleArenaArtReview({ PIXI, manifest });
  assert.deepEqual(loaded, manifest.arena.layers.map((layer) => layer.src));
  assert.equal(review.displayObject.children.length, 2);
  assert.match(review.displayObject.children[0].label, /^arena_background/);
  assert.match(review.displayObject.children[1].label, /^canonical_shared_layer/);

  for (const [width, height] of manifest.viewportPolicy.contractViewports) {
    const viewport = review.layout(width, height);
    assert.ok(viewport.renderedWidth <= width + Number.EPSILON);
    assert.ok(viewport.renderedHeight <= height + Number.EPSILON);
    assert.equal(viewport.x, 0);
    assert.ok(viewport.y >= 0);
  }
  assert.deepEqual(review.getDiagnostics().gameplayMounted, false);
  await review.dispose();
  assert.deepEqual(unloaded, loaded);
  assert.equal(review.getDiagnostics().disposed, true);
});

test("animated Pixi review advances frames from caller time and unloads every exact source", async () => {
  const { PIXI, loaded, unloaded } = pixiDouble();
  const review = await loadRuntimeBattleArenaArtReview({ PIXI, manifest: animatedManifest });
  const expectedSources = [
    ...animatedManifest.arena.layers[0].frames.map((frame) => frame.src),
    animatedManifest.arena.layers[1].src,
    animatedManifest.arena.layers[2].src
  ];
  assert.deepEqual(loaded, expectedSources);
  assert.equal(review.displayObject.children.length, 3);
  assert.match(review.displayObject.children[0].label, /^animated_terrain_bed/);
  assert.equal(review.getDiagnostics().animation.frameIndex, 0);
  const duration = animatedManifest.arena.layers[0].frames[0].durationMs;
  assert.equal(review.advance(duration - 1), 0);
  assert.equal(review.advance(2), 1);
  assert.equal(review.getDiagnostics().animation.frameIndex, 1);
  assert.equal(review.displayObject.children[0].texture.src, expectedSources[1]);
  await review.dispose();
  assert.deepEqual(unloaded, expectedSources);
});
