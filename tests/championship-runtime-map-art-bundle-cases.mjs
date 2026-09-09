import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuntimeMapArtFieldLoader,
  getRuntimeMapArtField,
  loadRuntimeMapArtField,
  validateRuntimeMapArtBundle
} from "../src/championship/presentation/runtimeMapArtBundle.js";

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    assetId: "art:hunt:faithful-hd:runtime-test",
    family: "HUNT",
    runtimeEligible: true,
    shippingReady: false,
    rights: { status: "LICENSE_EVIDENCE_LINKED" },
    memoryPolicy: "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT",
    fields: [{
      fieldId: "field_hm03_01",
      worldWidthPx: 2048,
      worldHeightPx: 2048,
      gameplayBinding: "EXTERNAL_EXISTING_RUNTIME",
      gateMapping: "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED",
      collisionBinding: "EXTERNAL_NOT_IN_ART_BUNDLE",
      frames: [{
        src: "assets/production/hunt/faithful-hd-v1/field_hm03_01/frame-00.png",
        sha256: "A".repeat(64),
        durationMs: null
      }]
    }],
    ...overrides
  };
}

function pixiDouble() {
  const loaded = [];
  const unloaded = [];
  class Sprite {
    constructor(texture) {
      this.texture = texture;
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
    }
    destroy(options) { this.destroyOptions = options; }
  }
  class AnimatedSprite extends Sprite {
    constructor({ textures, autoUpdate }) {
      super(textures[0]);
      this.textures = textures;
      this.autoUpdate = autoUpdate;
      this.currentFrame = 0;
    }
    gotoAndStop(index) { this.currentFrame = index; }
  }
  return {
    PIXI: {
      Assets: {
        async load(src) { loaded.push(src); return { src }; },
        async unload(src) { unloaded.push(src); }
      },
      Sprite,
      AnimatedSprite
    },
    loaded,
    unloaded
  };
}

test("runtime map art accepts only production paths and explicit external gameplay bindings", () => {
  const checked = validateRuntimeMapArtBundle(manifest());
  assert.equal(checked.fields.length, 1);
  assert.equal(Object.isFrozen(checked), true);
  assert.equal(getRuntimeMapArtField(checked, "field_hm03_01").worldWidthPx, 2048);

  const battle = manifest({ family: "BATTLE" });
  battle.fields[0].fieldId = "field_bm01_01";
  battle.fields[0].frames[0].src = "assets/production/battle/licensed-runtime-v1/fields/field_bm01_01/frame-00.png";
  assert.equal(validateRuntimeMapArtBundle(battle).family, "BATTLE");

  const researchPath = manifest();
  researchPath.fields[0].frames[0].src = "docs/art/production/hunt/hd-remaster-v1/frame.png";
  assert.throws(() => validateRuntimeMapArtBundle(researchPath), /FRAME_OUTSIDE_PRODUCTION_ASSETS/);

  const embeddedCollision = manifest();
  embeddedCollision.fields[0].collisionBinding = "RAW_ATR_CELLS";
  assert.throws(() => validateRuntimeMapArtBundle(embeddedCollision), /COLLISION_MUST_NOT_BE_EMBEDDED/);
});

test("animated bundles require resolved milliseconds and do not guess raw tick timing", () => {
  const unresolved = manifest();
  unresolved.fields[0].frames.push({
    src: "assets/production/hunt/faithful-hd-v1/field_hm03_01/frame-01.png",
    sha256: "B".repeat(64),
    durationMs: null
  });
  assert.throws(() => validateRuntimeMapArtBundle(unresolved), /VERIFIED_DURATION_MS_REQUIRED/);

  unresolved.fields[0].frames[0].durationMs = 100;
  unresolved.fields[0].frames[1].durationMs = 150;
  assert.equal(validateRuntimeMapArtBundle(unresolved).fields[0].frames.length, 2);
});

test("one static field loads at world size and unloads its exact Pixi asset", async () => {
  const { PIXI, loaded, unloaded } = pixiDouble();
  const art = await loadRuntimeMapArtField({ PIXI, manifest: manifest(), fieldId: "field_hm03_01" });
  assert.equal(art.displayObject.width, 2048);
  assert.equal(art.displayObject.height, 2048);
  assert.equal(art.getDiagnostics().frameCount, 1);
  assert.deepEqual(loaded, ["assets/production/hunt/faithful-hd-v1/field_hm03_01/frame-00.png"]);
  await art.dispose();
  assert.deepEqual(unloaded, loaded);
  assert.equal(art.getDiagnostics().disposed, true);
});

test("animated art advances on the owning ticker input and the loader keeps one field resident", async () => {
  const { PIXI, unloaded } = pixiDouble();
  const animated = manifest();
  animated.fields[0].frames[0].durationMs = 100;
  animated.fields[0].frames.push({
    src: "assets/production/hunt/faithful-hd-v1/field_hm03_01/frame-01.png",
    sha256: "B".repeat(64),
    durationMs: 150
  });
  const loader = createRuntimeMapArtFieldLoader({ PIXI });
  const first = await loader.load({ manifest: animated, fieldId: "field_hm03_01" });
  assert.equal(first.displayObject.autoUpdate, false);
  first.update(99);
  assert.equal(first.getDiagnostics().frameIndex, 0);
  first.update(1);
  assert.equal(first.getDiagnostics().frameIndex, 1);

  const secondManifest = manifest();
  secondManifest.fields[0].fieldId = "field_hm08_01";
  secondManifest.fields[0].frames[0].src = "assets/production/hunt/faithful-hd-v1/field_hm08_01/frame-00.png";
  const second = await loader.load({ manifest: secondManifest, fieldId: "field_hm08_01" });
  assert.equal(loader.getActive(), second);
  assert.equal(first.getDiagnostics().disposed, true);
  assert.ok(unloaded.includes("assets/production/hunt/faithful-hd-v1/field_hm03_01/frame-00.png"));
  await loader.unload();
  assert.equal(loader.getActive(), null);
});
