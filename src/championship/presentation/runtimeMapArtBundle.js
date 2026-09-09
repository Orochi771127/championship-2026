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
const ALLOWED_FAMILIES = new Set(["BATTLE", "CAGE", "HUNT"]);

/**
 * Two residency policies, and only two.
 *
 * ONE_ACTIVE is right for Hunt and Battle: a field is a whole 1024x1024 map, the
 * player is in exactly one at a time, and holding thirty would waste hundreds of
 * MiB. N_ACTIVE_TILES is right for the ranch, whose cages are small shaped tiles
 * that have to composite simultaneously to read as one continuous habitat --
 * routing those through the one-at-a-time loader is why they could never join.
 *
 * Still deny-by-default: anything that is not one of these two is refused.
 */
export const MAP_ART_MEMORY_POLICIES = Object.freeze({
  ONE_ACTIVE: "ONE_ACTIVE_FIELD_LOAD_ON_ENTRY_UNLOAD_ON_EXIT",
  N_ACTIVE_TILES: "N_ACTIVE_TILES_LOAD_ON_ENTRY_UNLOAD_ON_EXIT"
});
const KNOWN_MEMORY_POLICIES = new Set(Object.values(MAP_ART_MEMORY_POLICIES));

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

function applyNearestScale(texture) {
  // DS tiles must stay crisp when stretched to the 2048 Hunt world.
  const source = texture?.source;
  if (source && typeof source === "object") source.scaleMode = "nearest";
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
  if (!KNOWN_MEMORY_POLICIES.has(manifest.memoryPolicy)) fail("KNOWN_MEMORY_POLICY_REQUIRED");

  const ids = new Set();
  for (const field of manifest.fields) {
    nonEmptyString(field.fieldId, "FIELD_ID_REQUIRED");
    if (ids.has(field.fieldId)) fail(`DUPLICATE_FIELD_ID:${field.fieldId}`);
    ids.add(field.fieldId);
    finitePositive(field.worldWidthPx, `WORLD_WIDTH_REQUIRED:${field.fieldId}`);
    finitePositive(field.worldHeightPx, `WORLD_HEIGHT_REQUIRED:${field.fieldId}`);
    if (manifest.family === "CAGE") {
      finitePositive(field.nativeWidthPx, `NATIVE_WIDTH_REQUIRED:${field.fieldId}`);
      finitePositive(field.nativeHeightPx, `NATIVE_HEIGHT_REQUIRED:${field.fieldId}`);
      if (Math.abs(field.worldWidthPx / field.nativeWidthPx - field.worldHeightPx / field.nativeHeightPx) > 1e-9) {
        fail(`ANISOTROPIC_NATIVE_PIXEL_SCALE:${field.fieldId}`);
      }
    }
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

  const normalized = structuredClone(manifest);
  if (normalized.family === "CAGE") {
    for (const field of normalized.fields) field.nativePixelWorldScale = field.worldWidthPx / field.nativeWidthPx;
  }
  return freezeRecord(normalized);
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
export async function loadRuntimeMapArtField({ PIXI, manifest, fieldId, sourceRect = null }) {
  assertPixi(PIXI);
  let field = getRuntimeMapArtField(manifest, fieldId);
  const originalWidth = field.worldWidthPx;
  const originalHeight = field.worldHeightPx;
  if (sourceRect) {
    const {x,y,width,height} = sourceRect;
    if (![x,y,width,height].every(Number.isFinite) || x<0 || y<0 || width<=0 || height<=0
      || x+width>originalWidth || y+height>originalHeight) fail('SOURCE_RECT_INVALID');
    if (typeof PIXI.Texture !== 'function' || typeof PIXI.Rectangle !== 'function') fail('CROPPED_TEXTURE_API_REQUIRED');
    field = Object.freeze({...field, worldWidthPx:width, worldHeightPx:height,
      nativeWidthPx:width/field.nativePixelWorldScale, nativeHeightPx:height/field.nativePixelWorldScale});
  }
  const sources = field.frames.map((frame) => frame.src.replaceAll("\\", "/"));
  let textures;
  try {
    textures = await Promise.all(sources.map((src) => PIXI.Assets.load(src)));
  } catch (error) {
    await Promise.allSettled(sources.map((src) => PIXI.Assets.unload(src)));
    throw error;
  }
  textures.forEach(applyNearestScale);
  const croppedTextures = [];
  if (sourceRect) {
    try {
      textures = textures.map(texture => {
        const sx = texture.frame.width/originalWidth;
        const sy = texture.frame.height/originalHeight;
        const crop = new PIXI.Texture({source:texture.source, frame:new PIXI.Rectangle(
          texture.frame.x+sourceRect.x*sx, texture.frame.y+sourceRect.y*sy,
          sourceRect.width*sx, sourceRect.height*sy)});
        croppedTextures.push(crop);
        return crop;
      });
    } catch (error) {
      croppedTextures.forEach(texture=>texture.destroy(false));
      await Promise.allSettled(sources.map(src=>PIXI.Assets.unload(src)));
      throw error;
    }
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
      croppedTextures.forEach(texture=>texture.destroy(false));
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

/**
 * Load several tiles at once and composite them into one container.
 *
 * This is the ranch path. It exists because cages are small shaped tiles that
 * must be on screen together to read as one habitat, which the single-field
 * loader above can never do: that one disposes the previous field on every load,
 * correctly, because a Hunt map is a whole world.
 *
 * Refuses any manifest that does not declare the tiled policy, so the Hunt and
 * Battle bundles cannot be composited by accident.
 *
 * @param {object} options
 * @param {object} options.PIXI
 * @param {object} options.manifest validated tiled-family manifest
 * @param {Array<{fieldId:string, x:number, y:number}>} options.placements
 */
export async function loadRuntimeMapArtTileSet({ PIXI, manifest, placements,
  placementEvidence = "UNKNOWN_REQUIRES_TRACE", presentationMode = "EXPLICIT_TILE_SET", residentViewport = null }) {
  assertPixi(PIXI);
  if (typeof PIXI.Container !== "function") throw new TypeError("Runtime map art tile sets require PIXI.Container");
  const checked = validateRuntimeMapArtBundle(manifest);
  if (checked.memoryPolicy !== MAP_ART_MEMORY_POLICIES.N_ACTIVE_TILES) {
    fail("TILE_SET_REQUIRES_N_ACTIVE_TILES_POLICY");
  }
  if (!Array.isArray(placements) || placements.length === 0) fail("TILE_SET_PLACEMENTS_REQUIRED");
  nonEmptyString(placementEvidence, "TILE_SET_PLACEMENT_EVIDENCE_REQUIRED");
  nonEmptyString(presentationMode, "TILE_SET_PRESENTATION_MODE_REQUIRED");
  const residentBounds = residentViewport ? freezeRecord({...residentViewport}) : null;
  if (residentBounds && (!['x','y','width','height'].every(key=>Number.isFinite(residentBounds[key]))
    || residentBounds.x<0 || residentBounds.y<0 || residentBounds.width<=0 || residentBounds.height<=0)) fail('RESIDENT_VIEWPORT_INVALID');

  // Snapshot before the first await: caller edits while textures decode must
  // not change which tiles load, where they render or the composite bounds.
  const seenSlots = new Set();
  const snapshot = freezeRecord(placements.map((placement) => {
    if (!placement || !Number.isSafeInteger(placement.x) || !Number.isSafeInteger(placement.y)
      || placement.x < 0 || placement.y < 0) fail("TILE_SET_INTEGER_POSITION_REQUIRED");
    if (placement.slotIndex !== undefined) {
      if (!Number.isSafeInteger(placement.slotIndex) || placement.slotIndex < 0) fail("TILE_SET_SLOT_INVALID");
      if (seenSlots.has(placement.slotIndex)) fail("TILE_SET_DUPLICATE_SLOT");
      seenSlots.add(placement.slotIndex);
    }
    return { fieldId: placement.fieldId, x: placement.x, y: placement.y,
      slotIndex: placement.slotIndex ?? null, moduleId: placement.moduleId ?? null,
      ...(placement.sourceRect ? {sourceRect:{...placement.sourceRect}} : {}),
      ...(placement.fragmentOfSlot !== undefined ? {fragmentOfSlot:placement.fragmentOfSlot} : {}),
      cageDefinitionIndex: placement.cageDefinitionIndex ?? null };
  }));

  // Verify the shared unit before allocating textures. A composite's extent is
  // not the native width of any individual cage.
  const selectedFields = snapshot.map(({ fieldId }) => {
    const field = checked.fields.find((entry) => entry.fieldId === fieldId);
    if (!field) fail(`TILE_SET_FIELD_UNKNOWN:${fieldId}`);
    return field;
  });
  const nativePixelWorldScale = selectedFields[0].nativePixelWorldScale ?? null;
  if (selectedFields.some((field) => (field.nativePixelWorldScale ?? null) !== nativePixelWorldScale)) {
    fail("TILE_SET_MIXED_NATIVE_PIXEL_SCALE");
  }

  const loaded = [];
  const container = new PIXI.Container();
  container.label = `runtime map art tile set ${checked.assetId}`;

  // Assets remains the sole texture authority. Within this composite, shared
  // frame URLs acquire and release once even when several tiles reference them.
  const textureLoads = new Map();
  const tilePixi = { ...PIXI, Assets: {
    load(src) {
      if (!textureLoads.has(src)) textureLoads.set(src, Promise.resolve().then(() => PIXI.Assets.load(src)));
      return textureLoads.get(src);
    },
    async unload() { /* the composite owns the shared URLs */ }
  } };
  async function releaseTextures() {
    await Promise.allSettled([...textureLoads.values()]);
    await Promise.allSettled([...textureLoads.keys()].map((src) => PIXI.Assets.unload(src)));
    textureLoads.clear();
  }

  try {
    for (const placement of snapshot) {
      const tile = await loadRuntimeMapArtField({ PIXI: tilePixi, manifest: checked, fieldId: placement.fieldId, sourceRect:placement.sourceRect });
      loaded.push(tile);
      // Hard-edged art: a fractional position resamples the silhouette and the
      // seam between two cages becomes visible.
      tile.displayObject.position.set(placement.x, placement.y);
      container.addChild(tile.displayObject);
    }
  } catch (error) {
    await Promise.allSettled(loaded.map((tile) => tile.dispose()));
    container.destroy({ children: false });
    await releaseTextures();
    throw error;
  }

  // The composite's own bounds, shaped like a single field's so that a tile set
  // is a drop-in wherever one field art was expected. The presenter fit-scales
  // against this; it never needs to know it is looking at many tiles.
  const worldWidthPx = snapshot.reduce(
    (widest, placement, index) => Math.max(widest, Math.round(placement.x) + loaded[index].field.worldWidthPx), 0
  );
  const worldHeightPx = snapshot.reduce(
    (tallest, placement, index) => Math.max(tallest, Math.round(placement.y) + loaded[index].field.worldHeightPx), 0
  );

  let disposed = false;
  return Object.freeze({
    assetId: checked.assetId,
    displayObject: container,
    tileCount: loaded.length,
    field: Object.freeze({
      fieldId: `${checked.assetId}:composite`,
      worldWidthPx,
      worldHeightPx,
      nativePixelWorldScale,
      placements: snapshot,
      placementEvidence,
      presentationMode,
      residentViewport: residentBounds,
      composite: true,
      tileFieldIds: Object.freeze(loaded.map((tile) => tile.field.fieldId))
    }),

    update(deltaMs) {
      if (disposed) return;
      for (const tile of loaded) tile.update(deltaMs);
    },

    getDiagnostics() {
      return Object.freeze({
        assetId: checked.assetId,
        memoryPolicy: checked.memoryPolicy,
        tileCount: loaded.length,
        placements: snapshot,
        placementEvidence,
        presentationMode,
        nativePixelWorldScale,
        fieldIds: Object.freeze(loaded.map((tile) => tile.field.fieldId)),
        disposed
      });
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const tile of loaded) {
        if (tile.displayObject.parent === container) container.removeChild(tile.displayObject);
      }
      await Promise.allSettled(loaded.map((tile) => tile.dispose()));
      container.destroy({ children: false });
      await releaseTextures();
    }
  });
}

/** Swap controller for tile sets: the whole set is resident, or none of it is. */
export function createRuntimeMapArtTileSetLoader({ PIXI }) {
  assertPixi(PIXI);
  let active = null;
  let generation = 0;
  return Object.freeze({
    async load(request) {
      const requestGeneration = ++generation;
      const next = await loadRuntimeMapArtTileSet({ PIXI, ...request });
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
