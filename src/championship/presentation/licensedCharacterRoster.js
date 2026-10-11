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
  sides = ['main'], signal = null,
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
  const pending = new Map(), queue = [], active = new Set();
  const maxConcurrent = 2;
  // Initial and later residents share the same bounded queue and entity dedupe.
  // The limit covers whole bundles, including their metadata and atlas decoding.
  async function retainBundle(entityId, bundle) {
    if (disposed) { await bundle.dispose(); return false; }
    bundles.set(entityId, bundle);
    return true;
  }
  function pump() {
    while (!disposed && active.size < maxConcurrent && queue.length) {
      const job = queue.shift();
      const running = Promise.resolve().then(async () => {
        if (disposed) return false;
        await loadEntity(job.entityId);
        return !disposed && bundles.has(job.entityId);
      });
      active.add(running);
      const finish = () => {
        active.delete(running);
        if (pending.get(job.entityId) === job.promise) pending.delete(job.entityId);
        pump();
      };
      void running.then(value => { finish(); job.resolve(value); }, error => { finish(); job.reject(error); });
    }
  }
  function enqueue(entityId) {
    if (disposed) return Promise.resolve(false);
    if (bundles.has(entityId)) return Promise.resolve(true);
    if (pending.has(entityId)) return pending.get(entityId);
    const job = { entityId };
    job.promise = new Promise((resolve, reject) => Object.assign(job, { resolve, reject }));
    pending.set(entityId, job.promise);
    queue.push(job);
    pump();
    return job.promise;
  }
  function dispose() {
    if (disposal) return disposal;
    disposed = true;
    signal?.removeEventListener('abort', onAbort);
    for (const job of queue.splice(0)) { pending.delete(job.entityId); job.resolve(false); }
    disposal = (async () => {
      // Every active decode may settle after cancellation. retainBundle destroys
      // those late bundles without exposing them to the abandoned scene.
      await Promise.allSettled([...active]);
      await Promise.allSettled([...bundles.values()].map(bundle => bundle.dispose()));
      bundles.clear();
    })();
    return disposal;
  }
  const onAbort = () => { void dispose(); };
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
          if (disposed) return;
          const bundle = await loadBundle({ PIXI, runtimeUrl: appearance.runtimeUrl, sides: ["main"],
            cachePrefix: appearance.cachePrefix, signal,
            replacementGuard: await createCharacterAppearanceGuard({ entityId, record, baselineRuntime,
              originGeometry: appearance.originGeometry, geometryContractSha256: appearance.geometryContractSha256,
              expectedGeometryContractSha256: appearance.expectedGeometryContractSha256,
              motionContractSha256: appearance.manifest.motionContractSha256 }) });
          if (await retainBundle(entityId, bundle)) appearances.set(entityId, appearance.manifest);
          return;
        } finally {
          if (baselineLoaded) await Promise.allSettled([PIXI.Assets.unload?.(baselineRuntimeUrl)]);
        }
      }
    } catch (error) {
      if (disposed) return;
      replacementFailures.push({ entityId, reason: error.message });
    }
    try {
      if (disposed) return;
      await retainBundle(entityId, await loadBundle({ PIXI,
        runtimeUrl: new URL(record.runtime, manifestUrl).href,
        sides, signal, cachePrefix: `licensed:${entityId}:` }));
    } catch (error) {
      if (!disposed) failures.push({ entityId, runtimeUrl:new URL(record.runtime,manifestUrl).href, reason: error.message });
    }
  }
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal?.aborted) { await dispose(); signal.throwIfAborted(); }
    await Promise.all([...wanted].map(enqueue));
    signal?.throwIfAborted();
  } catch (error) { await dispose(); throw error; }
  return Object.freeze({
    ensureSpecies(speciesId) {
      if (disposed) return Promise.reject(new Error("CHARACTER_ROSTER_DISPOSED"));
      const entityId = identities.get(canonicalSpeciesId(speciesId));
      if (!entityId) return Promise.resolve(false);
      return enqueue(entityId);
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
      const entities=[...bundles].map(([entityId,bundle])=>({entityId,memory:bundle.getDiagnostics?.().textureMemory??null}));
      const known=entities.every(({memory})=>memory?.estimatedBaseRgbaBytes!==null&&Number.isSafeInteger(memory?.estimatedBaseRgbaBytes));
      const textureMemory=Object.freeze({measurement:'BASE_RGBA8_ESTIMATE_NOT_GPU_USAGE',
        basis:'Actual loaded bundle pages; excludes mipmaps, decode copies and driver/cache overhead',
        estimatedBaseRgbaBytes:known?entities.reduce((n,{memory})=>n+memory.estimatedBaseRgbaBytes,0):null,
        pageCount:entities.every(({memory})=>memory)?entities.reduce((n,{memory})=>n+memory.pageCount,0):null,
        sourceCount:entities.every(({memory})=>memory)?entities.reduce((n,{memory})=>n+memory.sourceCount,0):null,
        unknownEntityIds:entities.filter(({memory})=>!memory||memory.estimatedBaseRgbaBytes===null).map(({entityId})=>entityId),
        atlasPages:entities.flatMap(({entityId,memory})=>(memory?.atlasPages??[]).map(page=>({entityId,...page}))) });
      return Object.freeze({ assetId: manifest.assetId, entityCount: manifest.records.length,
        loadedEntityIds: [...bundles.keys()], loadedSides: [...sides], failures: [...failures],
        replacementFailures: [...replacementFailures],
        appearances: [...appearances].map(([entityId, pack]) => ({ entityId, assetId: pack.assetId, designVersion: pack.designVersion })),
        rgbaBytes: textureMemory.estimatedBaseRgbaBytes,textureMemory,
        animationBinding: manifest.animationBinding, runtimeEligible: true, shippingReady: false });
    },
    dispose
  });
}
