import { loadPixiCharacterRuntimeBundle } from "./pixiCharacterRuntimeBundle.js";
import { CHARACTER_NATIVE_SIZING } from "../../data/championship/characterNativeSizing.js";
import { BATTLE_CHARACTER_GEOMETRY } from "../../data/championship/battleCharacterGeometry.js";

import { selectCharacterAppearance, createCharacterAppearanceGuard } from "./characterAppearanceReplacement.js";

export const LICENSED_CHARACTER_ASSET_ID = "art:characters:licensed-internal:v1";
export const LICENSED_CHARACTER_MANIFEST = "assets/production/internal-faithful-baseline/characters-v1/manifest.json";

function canonicalSpeciesId(speciesId) {
  return typeof speciesId === "string" ? speciesId.replace(/^championship:creature:/, "") : null;
}

export function getCharacterStaticNativeSizing(record, runtime, side = "main", acceptedOriginGeometry = null) {
  const sizing = CHARACTER_NATIVE_SIZING[record?.entityId];
  if (side !== "main" || !sizing
    || runtime?.sides?.main?.animations?.find((item) => item.id === 0)?.frames[0]?.texture !== sizing.texture
    || sizing.files.some(([name, hash]) => record.files?.find((file) => file.path === name)?.sha256?.toLowerCase() !== hash)) return null;
  return Object.freeze({ texture: sizing.texture,
    packedPixelsPerNativePixel: acceptedOriginGeometry?.sourcePixelScaleBySide?.main ?? sizing.packedPixelsPerNativePixel,
    evidence: "VERIFIED_STATIC_MAIN_FIRST_SOURCE_FRAME" });
}

/** One scene's texture resources, indexed by existing species identities. No gameplay state. */
export async function loadLicensedCharacterRoster({
  PIXI, speciesIds, manifest, productionIndex, manifestUrl,
  sides = ['main'],
  loadBundle = loadPixiCharacterRuntimeBundle,
  appearanceReplacements = manifest?.appearanceReplacements ?? [],
  baselineMotionContracts = manifest?.motionContractHashes ?? {},
  baselineOriginGeometryContracts = manifest?.originGeometryContractHashes ?? {}
}) {
  if(!Array.isArray(sides)||!sides.length||sides.some(side=>!['main','sub'].includes(side)))throw new Error('CHARACTER_ROSTER_SIDES_INVALID');
  const entry = productionIndex?.entries?.find((candidate) => candidate.assetId === LICENSED_CHARACTER_ASSET_ID);
  if (entry?.runtimeEligible !== true || entry.manifestPath !== LICENSED_CHARACTER_MANIFEST
    || entry.publicReleasePermitted !== false || manifest?.assetId !== entry.assetId
    || manifest.runtimeEligible !== true || manifest.publicReleasePermitted !== false) {
    throw new Error("CHARACTER_ROSTER_NOT_REGISTERED_FOR_INTERNAL_RUNTIME");
  }
  const records = new Map(manifest.records.map((record) => [record.entityId, record]));
  const identities = new Map(manifest.speciesBindings.map((binding) => [binding.speciesId, binding.entityId]));
  const wanted = new Set(speciesIds.map(canonicalSpeciesId).map((id) => identities.get(id)).filter(Boolean));
  for (const entityId of wanted) {
    if (records.get(entityId)?.runtime !== `${entityId}/runtime.json`
      || !/^[em]\d{3}_[a-z0-9_]+$/.test(entityId)) {
      throw new Error(`INVALID_CHARACTER_RUNTIME_PATH:${entityId}`);
    }
  }
  const bundles = new Map();
  const failures = [];
  const appearances = new Map();
  const replacementFailures = [];
  let disposed = false;
  let disposal = null;
  let loadQueue = Promise.resolve();
  const pending = new Map();
  // Bound peak decode allocations. Duplicate species reuse one loaded Main atlas set.
  async function loadEntity(entityId) {
    const record = records.get(entityId);
    if (record?.runtime !== `${entityId}/runtime.json` || !/^[em]\d{3}_[a-z0-9_]+$/.test(entityId)) {
      throw new Error(`INVALID_CHARACTER_RUNTIME_PATH:${entityId}`);
    }
    try {
      const appearance = selectCharacterAppearance({ entityId, descriptors: appearanceReplacements,
        record, productionIndex, baselineMotionContracts, baselineOriginGeometryContracts, manifestUrl, baselineManifestPath: LICENSED_CHARACTER_MANIFEST });
      if (appearance && sides.length===1 && sides[0]==='main') {
        const baselineRuntimeUrl = new URL(record.runtime, manifestUrl).href;
        let baselineLoaded = false;
        try {
          const baselineRuntime = await PIXI.Assets.load({ src: baselineRuntimeUrl, parser: "json" });
          baselineLoaded = true;
          const bundle = await loadBundle({ PIXI, runtimeUrl: appearance.runtimeUrl, sides: ["main"],
            cachePrefix: appearance.cachePrefix,
            replacementGuard: await createCharacterAppearanceGuard({ entityId, record, baselineRuntime,
              originGeometry: appearance.originGeometry, geometryContractSha256: appearance.geometryContractSha256,
              expectedGeometryContractSha256: appearance.expectedGeometryContractSha256,
              motionContractSha256: appearance.manifest.motionContractSha256 }) });
          bundles.set(entityId, bundle);
          appearances.set(entityId, appearance.manifest);
          return;
        } finally {
          if (baselineLoaded) await Promise.allSettled([PIXI.Assets.unload?.(baselineRuntimeUrl)]);
        }
      }
    } catch (error) {
      replacementFailures.push({ entityId, reason: error.message });
    }
    try {
      bundles.set(entityId, await loadBundle({ PIXI,
        runtimeUrl: new URL(record.runtime, manifestUrl).href,
        sides, cachePrefix: `licensed:${entityId}:` }));
    } catch (error) {
      failures.push({ entityId, reason: error.message });
    }
  }
  for (const entityId of wanted) await loadEntity(entityId);
  return Object.freeze({
    ensureSpecies(speciesId) {
      if (disposed) return Promise.reject(new Error("CHARACTER_ROSTER_DISPOSED"));
      const entityId = identities.get(canonicalSpeciesId(speciesId));
      if (!entityId) return Promise.resolve(false);
      if (bundles.has(entityId)) return Promise.resolve(true);
      if (pending.has(entityId)) return pending.get(entityId);
      const task = loadQueue.then(async () => {
        if (disposed) return false;
        await loadEntity(entityId);
        return bundles.has(entityId);
      });
      pending.set(entityId, task);
      loadQueue = task.catch(() => {}).finally(() => pending.delete(entityId));
      return task;
    },
    createActor({ speciesId, side = "main", reducedMotion = false, presentation = null } = {}) {
      if (disposed) throw new Error("CHARACTER_ROSTER_DISPOSED");
      const entityId = identities.get(canonicalSpeciesId(speciesId));
      const bundle = bundles.get(entityId);
      if (!bundle) return null;
      if(side==='sub'&&['result-win','result-loss'].includes(presentation)){
        const animation=presentation==='result-win'?9:5;
        if(!bundle.runtime.sides.sub.animations.some(a=>a.id===animation))return null;
        const actor=bundle.createActor({side,animation,nativeSequence:true,reducedMotion:true});
        return Object.freeze({sprite:actor.sprite,sequencePlayer:actor.sequencePlayer,entityId,
          packedPixelsPerNativePixel:bundle.runtime.artProfile.scale,presentationState:'OVL8_NATIVE_RESULT_SUB_SEQUENCE'});
      }
      // Each normal owner publishes this species' raw frame. The old M003-only
      // Hunt pilot gate left every other loaded atlas frozen on its first cell.
      const nativeFramePresentation = side === "main" && ["raising", "hunt"].includes(presentation);
      const candidate = BATTLE_CHARACTER_GEOMETRY[entityId];
      const record = records.get(entityId);
      const verifiedGeometry = side === 'main' && !appearances.has(entityId)
        && candidate?.files.every(([name,hash])=>record.files.find(f=>f.path===name)?.sha256.toLowerCase()===hash)
        ? candidate : null;
      const battleGeometry = presentation === 'battle' ? verifiedGeometry : null;
      const actor = bundle.createActor({ side, animation: 0,
        reducedMotion: nativeFramePresentation || battleGeometry ? reducedMotion : true, nativeFramePresentation, battleGeometry,
        nativeGeometry: nativeFramePresentation ? verifiedGeometry : null });
      // The first source frame is identity art. No unverified idle/happy/walk
      // alias controls gameplay, and the source's provisional 60 Hz is unused.
      return Object.freeze({ sprite: actor.sprite, controller: null, entityId,
        nativeSizing: getCharacterStaticNativeSizing(records.get(entityId), bundle.runtime, side, appearances.get(entityId)?.originGeometry),
        nativeFramePresenter: actor.nativeFramePresenter ?? null,
        battleAnimator: actor.battleAnimator ?? null,
        presentationState: battleGeometry ? 'BATTLE_RAW_REQUESTS_EXISTING_DISPATCH_TIMING_PARTIAL'
          : nativeFramePresentation ? 'NATIVE_OWNER_FRAME_ALL_REGISTERED_MAIN_SEQUENCES'
          : "STATIC_SOURCE_IDENTITY_ACTION_BINDING_REQUIRES_TRACE" });
    },
    getDiagnostics() {
      return Object.freeze({ assetId: manifest.assetId, entityCount: manifest.records.length,
        loadedEntityIds: [...bundles.keys()], loadedSides: [...sides], failures: [...failures],
        replacementFailures: [...replacementFailures],
        appearances: [...appearances].map(([entityId, pack]) => ({ entityId, assetId: pack.assetId, designVersion: pack.designVersion })),
        rgbaBytes: [...bundles.keys()].reduce((sum, id) => sum + sides.reduce((n,side)=>n+(appearances.get(id) ?? records.get(id)).sides[side].rgbaBytes,0), 0),
        animationBinding: manifest.animationBinding, runtimeEligible: true, shippingReady: false });
    },
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      disposal = (async () => {
        await loadQueue;
        await Promise.allSettled([...bundles.values()].map((bundle) => bundle.dispose()));
        bundles.clear();
      })();
      return disposal;
    }
  });
}
