// Championship 2026 -- isolated layered Battle arena art review.
//
// This module has no battle simulation, UI, collision, input, routing, ticker,
// or Application authority. It loads a validated static or animated arena
// stack into the caller-owned Championship Pixi stage; animation time is
// supplied explicitly by that stage's sole Application ticker.

const SCHEMA_VERSION = 1;
const EXPECTED_FAMILY = "BATTLE";
const BACKGROUND_ROLE = "ARENA_BACKGROUND";
const ANIMATED_ROLE = "ANIMATED_TERRAIN_BED";
const TERRAIN_ROLE = "ARENA_TERRAIN";
const OBJECT_ROLE = "FIELD_OBJECTS";
const SHARED_ROLE = "CANONICAL_SHARED_LAYER";

const LAYER_ARCHITECTURES = Object.freeze([
  Object.freeze([BACKGROUND_ROLE]),
  Object.freeze([BACKGROUND_ROLE, SHARED_ROLE]),
  Object.freeze([ANIMATED_ROLE, TERRAIN_ROLE, SHARED_ROLE]),
  Object.freeze([BACKGROUND_ROLE, OBJECT_ROLE, SHARED_ROLE]),
  Object.freeze([ANIMATED_ROLE, TERRAIN_ROLE, OBJECT_ROLE, SHARED_ROLE])
]);

function fail(reason) {
  const error = new Error(`CHAMPIONSHIP_BATTLE_ART_REVIEW_INVALID: ${reason}`);
  error.name = "ChampionshipBattleArtReviewError";
  throw error;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(label);
  return value;
}

function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) fail(label);
  return value;
}

function freezeRecord(record) {
  if (Array.isArray(record)) {
    record.forEach(freezeRecord);
    return Object.freeze(record);
  }
  if (record && typeof record === "object") {
    Object.values(record).forEach(freezeRecord);
    return Object.freeze(record);
  }
  return record;
}

function assertPixi(PIXI) {
  if (!PIXI?.Assets || typeof PIXI.Assets.load !== "function" || typeof PIXI.Assets.unload !== "function"
    || typeof PIXI.Container !== "function" || typeof PIXI.Sprite !== "function") {
    throw new TypeError("Battle art review requires PixiJS Assets, Container and Sprite APIs");
  }
}

export function validateRuntimeBattleArenaArtReview(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("MANIFEST_OBJECT_REQUIRED");
  if (manifest.schemaVersion !== SCHEMA_VERSION) fail("UNSUPPORTED_SCHEMA_VERSION");
  nonEmptyString(manifest.assetId, "ASSET_ID_REQUIRED");
  if (manifest.family !== EXPECTED_FAMILY) fail("BATTLE_FAMILY_REQUIRED");
  if (manifest.internalReviewEligible !== true) fail("INTERNAL_REVIEW_ELIGIBLE_REQUIRED");
  if (manifest.runtimeEligible !== false || manifest.shippingReady !== false) fail("REVIEW_MUST_NOT_BE_PROMOTED");
  if (!manifest.rights || typeof manifest.rights !== "object") fail("RIGHTS_RECORD_REQUIRED");
  nonEmptyString(manifest.rights.status, "RIGHTS_STATUS_REQUIRED");
  if (!Array.isArray(manifest.sourceDimensions) || manifest.sourceDimensions.length !== 2) fail("SOURCE_DIMENSIONS_REQUIRED");
  finitePositive(manifest.sourceDimensions[0], "SOURCE_WIDTH_REQUIRED");
  finitePositive(manifest.sourceDimensions[1], "SOURCE_HEIGHT_REQUIRED");
  if (!manifest.viewportPolicy || manifest.viewportPolicy.fit !== "CONTAIN") fail("CONTAIN_VIEWPORT_POLICY_REQUIRED");
  const verticalAnchor = manifest.viewportPolicy.verticalAnchor;
  if (!Number.isFinite(verticalAnchor) || verticalAnchor < 0 || verticalAnchor > 1) fail("VERTICAL_ANCHOR_INVALID");

  const arena = manifest.arena;
  if (!arena || typeof arena !== "object") fail("ARENA_REQUIRED");
  nonEmptyString(arena.fieldId, "FIELD_ID_REQUIRED");
  nonEmptyString(arena.assetId, "ARENA_ASSET_ID_REQUIRED");
  if (arena.gameplayBinding !== "EXTERNAL_NOT_MOUNTED") fail("GAMEPLAY_MUST_STAY_EXTERNAL");
  if (arena.collisionBinding !== "NONE_ART_REVIEW_ONLY") fail("COLLISION_MUST_STAY_ABSENT");
  if (arena.uiBinding !== "NONE_ART_REVIEW_ONLY") fail("UI_MUST_STAY_ABSENT");
  if (!Array.isArray(arena.dependencies) || arena.dependencies.length > 1) fail("ZERO_OR_ONE_SHARED_DEPENDENCY_REQUIRED");
  if (!Array.isArray(arena.layers) || arena.layers.length < 1 || arena.layers.length > 4) fail("ONE_TO_FOUR_LAYERS_REQUIRED");
  const independent = arena.dependencies.length === 0;
  const layerRoles = arena.layers.map((layer) => layer?.role);
  const architecture = LAYER_ARCHITECTURES.find((candidate) =>
    candidate.length === layerRoles.length && candidate.every((role, index) => role === layerRoles[index])
  );
  if (!architecture) fail("LAYER_ORDER_INVALID:ARCHITECTURE");
  if (independent && arena.layers.length !== 1) fail("INDEPENDENT_ARENA_MUST_HAVE_ONE_LAYER");
  if (!independent && architecture.at(-1) !== SHARED_ROLE) fail("SHARED_ARENA_MUST_HAVE_TWO_OR_THREE_LAYERS");
  const framedLayers = arena.layers.filter((layer) => Array.isArray(layer.frames));
  const animated = framedLayers.length > 0;
  if (animated && independent) fail("ANIMATED_ARENA_REQUIRES_SHARED_DEPENDENCY");

  if (animated) {
    const animation = arena.animation;
    if (!animation || typeof animation !== "object") fail("ANIMATION_METADATA_REQUIRED");
    if (!Number.isInteger(animation.frameCount) || animation.frameCount < 2) fail("ANIMATION_FRAME_COUNT_INVALID");
    if (animation.updateDriver !== "CALLER_OWNED_APPLICATION_TICKER") fail("ANIMATION_CALLER_TICKER_REQUIRED");
    nonEmptyString(animation.timingEvidence, "ANIMATION_TIMING_EVIDENCE_REQUIRED");
    nonEmptyString(animation.placementEvidence, "ANIMATION_PLACEMENT_EVIDENCE_REQUIRED");
    nonEmptyString(animation.compositionOrder, "ANIMATION_COMPOSITION_ORDER_REQUIRED");
    nonEmptyString(animation.compositionEvidence, "ANIMATION_COMPOSITION_EVIDENCE_REQUIRED");
  } else if (arena.animation != null) {
    fail("STATIC_ARENA_MUST_NOT_DECLARE_ANIMATION");
  }

  const ids = new Set();
  arena.layers.forEach((layer, index) => {
    nonEmptyString(layer.assetId, `LAYER_ASSET_ID_REQUIRED:${index}`);
    if (ids.has(layer.assetId)) fail(`DUPLICATE_LAYER_ASSET_ID:${layer.assetId}`);
    ids.add(layer.assetId);
    const expectedRole = architecture[index];
    if (layer.role !== expectedRole) fail(`LAYER_ORDER_INVALID:${index}`);
    if (layer.zIndex !== index * 10) fail(`LAYER_Z_INDEX_INVALID:${index}`);
    if (Array.isArray(layer.frames)) {
      if (![ANIMATED_ROLE, OBJECT_ROLE].includes(layer.role)) fail(`FRAMES_NOT_ALLOWED_FOR_ROLE:${index}`);
      if (layer.src != null || layer.sha256 != null) fail("ANIMATED_LAYER_USES_FRAMES_NOT_SINGLE_SOURCE");
      if (!Array.isArray(layer.frames) || layer.frames.length !== arena.animation.frameCount) {
        fail("ANIMATED_LAYER_FRAME_COUNT_MISMATCH");
      }
      layer.frames.forEach((frame, frameIndex) => {
        const src = nonEmptyString(frame.src, `FRAME_SRC_REQUIRED:${frameIndex}`).replaceAll("\\", "/");
        if (!src.startsWith("assets/production/internal-battle-review/")) {
          fail(`FRAME_OUTSIDE_INTERNAL_PRODUCTION_REVIEW:${frameIndex}`);
        }
        if (!/^[A-F0-9]{64}$/.test(frame.sha256)) fail(`FRAME_HASH_INVALID:${frameIndex}`);
        if (!Number.isInteger(frame.durationRawTicks) || frame.durationRawTicks <= 0) {
          fail(`FRAME_RAW_TICKS_INVALID:${frameIndex}`);
        }
        finitePositive(frame.durationMs, `FRAME_DURATION_MS_INVALID:${frameIndex}`);
      });
    } else {
      const src = nonEmptyString(layer.src, `LAYER_SRC_REQUIRED:${index}`).replaceAll("\\", "/");
      if (!src.startsWith("assets/production/internal-battle-review/")) fail(`LAYER_OUTSIDE_INTERNAL_PRODUCTION_REVIEW:${index}`);
      if (!/^[A-F0-9]{64}$/.test(layer.sha256)) fail(`LAYER_HASH_INVALID:${index}`);
      if (layer.frames != null) fail(`STATIC_LAYER_MUST_NOT_DECLARE_FRAMES:${index}`);
    }
    if (typeof layer.alpha !== "boolean") fail(`LAYER_ALPHA_BOOLEAN_REQUIRED:${index}`);
  });
  const terrainIndex = architecture.includes(TERRAIN_ROLE) ? architecture.indexOf(TERRAIN_ROLE) : 0;
  if (arena.layers[terrainIndex].assetId !== arena.assetId) fail("ARENA_LAYER_ID_MISMATCH");
  if (arena.layers[0].alpha !== false) fail("LAYER_ALPHA_ROLES_INVALID");
  arena.layers.slice(1).forEach((layer) => {
    if (layer.alpha !== true) fail("LAYER_ALPHA_ROLES_INVALID");
  });
  if (!independent) {
    const shared = arena.layers[arena.layers.length - 1];
    if (shared.assetId !== arena.dependencies[0]) fail("SHARED_DEPENDENCY_MISMATCH");
    if (shared.alpha !== true) fail("LAYER_ALPHA_ROLES_INVALID");
  }

  return freezeRecord(structuredClone(manifest));
}

export async function loadRuntimeBattleArenaArtReview({ PIXI, manifest }) {
  assertPixi(PIXI);
  const checked = validateRuntimeBattleArenaArtReview(manifest);
  const animatedLayers = checked.arena.layers.flatMap((layer, layerIndex) =>
    layer.frames ? [{ layer, layerIndex, frameIndex: 0, elapsedMs: 0 }] : []
  );
  const sources = [...new Set(checked.arena.layers.flatMap((layer) =>
    layer.frames ? layer.frames.map((frame) => frame.src) : [layer.src]
  ))];
  let loadedTextures;
  try {
    loadedTextures = await Promise.all(sources.map((src) => PIXI.Assets.load(src)));
  } catch (error) {
    await Promise.allSettled(sources.map((src) => PIXI.Assets.unload(src)));
    throw error;
  }
  const textures = new Map(sources.map((src, index) => [src, loadedTextures[index]]));

  const displayObject = new PIXI.Container({ label: `battle art review ${checked.arena.fieldId}` });
  const [sourceWidth, sourceHeight] = checked.sourceDimensions;
  const sprites = checked.arena.layers.map((layer) => {
    const initialSource = layer.frames ? layer.frames[0].src : layer.src;
    const sprite = new PIXI.Sprite(textures.get(initialSource));
    sprite.label = `${layer.role.toLowerCase()} ${layer.assetId}`;
    sprite.position.set(0, 0);
    sprite.width = sourceWidth;
    sprite.height = sourceHeight;
    sprite.zIndex = layer.zIndex;
    return sprite;
  });
  displayObject.addChild(...sprites);

  let disposed = false;
  let viewport = null;
  function layout(width, height) {
    if (disposed) return null;
    finitePositive(width, "VIEWPORT_WIDTH_REQUIRED");
    finitePositive(height, "VIEWPORT_HEIGHT_REQUIRED");
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const x = (width - renderedWidth) / 2;
    const y = (height - renderedHeight) * checked.viewportPolicy.verticalAnchor;
    displayObject.scale.set(scale);
    displayObject.position.set(x, y);
    viewport = Object.freeze({ width, height, scale, x, y, renderedWidth, renderedHeight });
    return viewport;
  }

  function advance(deltaMs) {
    if (disposed || animatedLayers.length === 0) return 0;
    finitePositive(deltaMs, "ANIMATION_DELTA_MS_REQUIRED");
    animatedLayers.forEach((state) => {
      state.elapsedMs += deltaMs;
      let current = state.layer.frames[state.frameIndex];
      while (state.elapsedMs >= current.durationMs) {
        state.elapsedMs -= current.durationMs;
        state.frameIndex = (state.frameIndex + 1) % state.layer.frames.length;
        current = state.layer.frames[state.frameIndex];
      }
      sprites[state.layerIndex].texture = textures.get(current.src);
    });
    return animatedLayers[0].frameIndex;
  }

  return Object.freeze({
    manifest: checked,
    displayObject,
    layout,
    advance,
    getDiagnostics() {
      return Object.freeze({
        renderer: "CHAMPIONSHIP_SINGLE_PIXI_STAGE_CHILD",
        fieldId: checked.arena.fieldId,
        layerCount: sprites.length,
        layerOrder: sprites.map((sprite) => sprite.label),
        animation: animatedLayers.length ? Object.freeze({
          frameIndex: animatedLayers[0].frameIndex,
          elapsedMs: animatedLayers[0].elapsedMs,
          frameCount: animatedLayers[0].layer.frames.length
        }) : null,
        animations: Object.freeze(animatedLayers.map((state) => Object.freeze({
          role: state.layer.role,
          layerIndex: state.layerIndex,
          frameIndex: state.frameIndex,
          elapsedMs: state.elapsedMs,
          frameCount: state.layer.frames.length
        }))),
        viewport,
        gameplayMounted: false,
        uiMounted: false,
        collisionMounted: false,
        disposed
      });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      displayObject.destroy({ children: true, texture: false, textureSource: false });
      await Promise.allSettled(sources.map((src) => PIXI.Assets.unload(src)));
    }
  });
}
