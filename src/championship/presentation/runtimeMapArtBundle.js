// Championship 2026 -- bounded runtime map-art bundles.
//
// A runtime art bundle is presentation-only. It may provide one complete map
// composite (or a verified animation sequence), but it never supplies collision,
// encounters, spawning, Gate mapping, save data, or simulation state. Those stay
// with the existing runtime authorities.
//
// The loader intentionally keeps exactly one field resident. A 2048x2048 RGBA
// Hunt frame costs roughly 16 MiB after decode, so loading all thirty maps would
// waste hundreds of MiB even though the player can only visit one at a time.

const SCHEMA_VERSION = 1;
const ALLOWED_FAMILIES = new Set(["CAGE", "HUNT"]);

function fail(reason) {
  const error = new Error(`CHAMPIONSHIP_RUNTIME_MAP_ART_BUNDLE_INVALID: ${reason}`);
  error.name = "ChampionshipRuntimeMapArtBundleError";
  throw error;
}

function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) fail(label);
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(label);
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

/**
 * Validate the small manifest that is allowed to cross into runtime.
 *
 * Raw ROM payloads, decoded ATR/ESC/OPM files and research paths are forbidden
 * here. Runtime art URLs must live below assets/production/ and manifests must
 * declare the unresolved gameplay bindings honestly.
 */
export function validateRuntimeMapArtBundle(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("MANIFEST_OBJECT_REQUIRED");
  if (manifest.schemaVersion !== SCHEMA_VERSION) fail("UNSUPPORTED_SCHEMA_VERSION");
  nonEmptyString(manifest.assetId, "ASSET_ID_REQUIRED");
  if (!ALLOWED_FAMILIES.has(manifest.family)) fail("UNKNOWN_FAMILY");
  if (manifest.runtimeEligible !== true) fail("RUNTIME_ELIGIBLE_REQUIRED");
  if (manifest.shippingReady !== false && manifest.shippingReady !== true) fail("SHIPPING_READY_BOOLEAN_REQUIRED");
  if (!manifest.rights || typeof manifest.rights !== "object") fail("RIGHTS_RECORD_REQUIRED");
  nonEmptyString(manifest.rights.status, "RIGHTS_STATUS_REQUIRED");
  if (!Array.isArray(manifest.fields) || manifest.fields.length === 0) fail("FIELDS_REQUIRED");
  if (manifest.memoryPolicy !== "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT") fail("ONE_ACTIVE_FIELD_POLICY_REQUIRED");

  const ids = new Set();
  for (const field of manifest.fields) {
    nonEmptyString(field.fieldId, "FIELD_ID_REQUIRED");
    if (ids.has(field.fieldId)) fail(`DUPLICATE_FIELD_ID:${field.fieldId}`);
    ids.add(field.fieldId);
    finitePositive(field.worldWidthPx, `WORLD_WIDTH_REQUIRED:${field.fieldId}`);
    finitePositive(field.worldHeightPx, `WORLD_HEIGHT_REQUIRED:${field.fieldId}`);
    if (!Array.isArray(field.frames) || field.frames.length === 0) fail(`FRAMES_REQUIRED:${field.fieldId}`);
    if (field.gameplayBinding !== "EXTERNAL_EXISTING_RUNTIME") fail(`GAMEPLAY_BINDING_MUST_STAY_EXTERNAL:${field.fieldId}`);
    if (field.gateMapping !== "UNBOUND_EXPLICIT_FIELD_ID_REQUIRED") fail(`GATE_MAPPING_MUST_NOT_BE_GUESSED:${field.fieldId}`);
    if (field.collisionBinding !== "EXTERNAL_NOT_IN_ART_BUNDLE") fail(`COLLISION_MUST_NOT_BE_EMBEDDED:${field.fieldId}`);

    for (const [index, frame] of field.frames.entries()) {
      const src = nonEmptyString(frame.src, `FRAME_SRC_REQUIRED:${field.fieldId}:${index}`);
      if (!src.replaceAll("\\", "/").startsWith("assets/production/")) {
        fail(`FRAME_OUTSIDE_PRODUCTION_ASSETS:${field.fieldId}:${index}`);
      }
      nonEmptyString(frame.sha256, `FRAME_HASH_REQUIRED:${field.fieldId}:${index}`);
      if (field.frames.length > 1) {
        finitePositive(frame.durationMs, `VERIFIED_DURATION_MS_REQUIRED:${field.fieldId}:${index}`);
      } else if (frame.durationMs !== null && frame.durationMs !== undefined) {
        finitePositive(frame.durationMs, `INVALID_STATIC_DURATION:${field.fieldId}:${index}`);
      }
    }
  }

  return freezeRecord(structuredClone(manifest));
}

export function getRuntimeMapArtField(manifest, fieldId) {
  const checked = validateRuntimeMapArtBundle(manifest);
  const field = checked.fields.find((entry) => entry.fieldId === fieldId);
  if (!field) {
    const error = new Error(`CHAMPIONSHIP_RUNTIME_MAP_ART_FIELD_UNKNOWN: ${fieldId}`);
    error.name = "ChampionshipRuntimeMapArtBundleError";
    throw error;
  }
  return field;
}

function assertPixi(PIXI) {
  if (!PIXI?.Assets || typeof PIXI.Assets.load !== "function" || typeof PIXI.Assets.unload !== "function"
    || typeof PIXI.Sprite !== "function" || typeof PIXI.AnimatedSprite !== "function") {
    throw new TypeError("Runtime map art requires PixiJS Assets, Sprite and AnimatedSprite APIs");
  }
}

/**
 * Load one field and return a display object that is already in world pixels.
 * AnimatedSprite is kept off Pixi's shared update path; the owning scene calls
 * update(deltaMs) from the sole Application ticker.
 */
export async function loadRuntimeMapArtField({ PIXI, manifest, fieldId }) {
  assertPixi(PIXI);
  const field = getRuntimeMapArtField(manifest, fieldId);
  const sources = field.frames.map((frame) => frame.src.replaceAll("\\", "/"));
  let textures;
  try {
    textures = await Promise.all(sources.map((src) => PIXI.Assets.load(src)));
  } catch (error) {
    await Promise.allSettled(sources.map((src) => PIXI.Assets.unload(src)));
    throw error;
  }

  let displayObject;
  let elapsedMs = 0;
  let frameIndex = 0;
  if (textures.length === 1) {
    displayObject = new PIXI.Sprite(textures[0]);
  } else {
    displayObject = new PIXI.AnimatedSprite({ textures, autoUpdate: false });
    displayObject.gotoAndStop(0);
  }
  displayObject.label = `runtime map art ${field.fieldId}`;
  displayObject.position.set(0, 0);
  displayObject.width = field.worldWidthPx;
  displayObject.height = field.worldHeightPx;

  let disposed = false;
  return Object.freeze({
    assetId: manifest.assetId,
    field,
    displayObject,
    update(deltaMs) {
      if (disposed || textures.length === 1 || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      elapsedMs += deltaMs;
      let duration = field.frames[frameIndex].durationMs;
      while (elapsedMs >= duration) {
        elapsedMs -= duration;
        frameIndex = (frameIndex + 1) % field.frames.length;
        duration = field.frames[frameIndex].durationMs;
        displayObject.gotoAndStop(frameIndex);
      }
    },
    getDiagnostics() {
      return Object.freeze({
        assetId: manifest.assetId,
        fieldId: field.fieldId,
        frameCount: textures.length,
        frameIndex,
        worldWidthPx: field.worldWidthPx,
        worldHeightPx: field.worldHeightPx,
        memoryPolicy: manifest.memoryPolicy,
        disposed
      });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      displayObject.destroy({ texture: false, textureSource: false });
      await Promise.allSettled(sources.map((src) => PIXI.Assets.unload(src)));
    }
  });
}

/** A small swap controller that guarantees there is never more than one field. */
export function createRuntimeMapArtFieldLoader({ PIXI }) {
  assertPixi(PIXI);
  let active = null;
  let generation = 0;
  return Object.freeze({
    async load(request) {
      const requestGeneration = ++generation;
      const next = await loadRuntimeMapArtField({ PIXI, ...request });
      if (requestGeneration !== generation) {
        await next.dispose();
        return null;
      }
      const previous = active;
      active = next;
      await previous?.dispose();
      return next;
    },
    getActive() {
      return active;
    },
    async unload() {
      generation += 1;
      const previous = active;
      active = null;
      await previous?.dispose();
    }
  });
}
