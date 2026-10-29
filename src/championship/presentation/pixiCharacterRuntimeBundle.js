import { createPixiCharacterAnimationController } from "./pixiCharacterAnimationController.js";
import { createNativeHuntCharacterFramePresenter } from "./nativeHuntCharacterAction.js";
import { createBattleCharacterAnimator } from "./battleCharacterAction.js";
import {createNativeCharacterAnimationTimeline} from './characterAnimationTimeline.js';
import {prepareCharacterAtlasPage} from './characterAtlasQueue.js';
const closedBitmaps=new WeakSet();
function closeDestroyedBitmap(bitmap,source){
  if(source?.destroyed&&typeof bitmap?.close==='function'&&!closedBitmaps.has(bitmap)){
    closedBitmaps.add(bitmap);bitmap.close();
  }
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function assetUrl(relativePath, documentUrl) {
  const runtimeDocument = globalThis.location?.href
    ? new URL(documentUrl, globalThis.location.href)
    : new URL(documentUrl);
  const base = new URL(".", runtimeDocument);
  return new URL(relativePath, base).href;
}

/**
 * Load one PixiJS v8 character runtime without creating a ticker or gameplay store.
 *
 * The returned actors advance only when their scene passes the Championship
 * Application ticker to `controller.update`. Atlas keys, anchors, sequence
 * order, per-frame ticks and playback all remain the values in runtime JSON.
 */
export async function loadPixiCharacterRuntimeBundle({
  PIXI,
  runtimeUrl,
  cachePrefix = "championship-character:",
  sides = ["main", "sub"],
  replacementGuard = null,
  runtimeDocument = null,
  initialSequenceIds = null,
  signal = null,
  fetchImpl = (...args) => globalThis.fetch(...args),
  // false: timing/geometry only. A species whose reviewed artwork replaces the
  // original never downloads or decodes the original atlas pages.
  pixels = true
}) {
  if (!PIXI?.Assets || typeof PIXI.Assets.load !== "function"
    || typeof PIXI.Spritesheet !== "function" || typeof PIXI.Sprite !== "function") {
    throw new TypeError("Character runtime requires PixiJS Assets, Spritesheet and Sprite");
  }
  if (typeof runtimeUrl !== "string" || runtimeUrl.length === 0) {
    throw new TypeError("runtimeUrl must be a non-empty string");
  }
  if (!Array.isArray(sides) || sides.length === 0 || new Set(sides).size !== sides.length
    || sides.some((side) => side !== "main" && side !== "sub")) {
    throw new TypeError("Character sides must be a non-empty unique Main/Sub selection");
  }

  const runtime = runtimeDocument ?? await PIXI.Assets.load(replacementGuard ? { src: runtimeUrl, parser: "json" } : runtimeUrl);
  const sheets = [];
  const loadedUrls = new Set(runtimeDocument ? [] : [runtimeUrl]);
  const textures = new Map();
  const decodedSources = new Set();
  const atlasPages = [];
  let disposed = false;
  let disposal = null;
  const pagePending = new Map(), readyPages = new Set();
  const streamed = pixels && initialSequenceIds !== null && runtime.streaming?.schemaVersion === 1
    && sides.length === 1 && sides[0] === 'main' && replacementGuard === null;
  const blank = pixels ? null : (PIXI.Texture?.EMPTY ?? Object.freeze({ blank: true }));
  const resolveTexture = (key) => textures.get(key) ?? blank ?? undefined;
  function sequenceTextures(id){
    const sequence=runtime.sides.main.animations.find(a=>a.id===id);
    if(!sequence)throw new RangeError(`Unknown character animation: ${id}`);
    return sequence.frames.map(f=>f.texture);
  }
  function validateStreaming(){
    const meta=runtime.streaming,atlases=runtime.sides.main.atlases;
    if(meta.side!=='main'||!Array.isArray(meta.pages)||meta.pages.length!==atlases.length)
      throw Error('CHARACTER_STREAMING_SCHEMA');
    for(const key of runtime.sides.main.animations.flatMap(a=>a.frames.map(f=>f.texture))){
      const page=meta.texturePages?.[key];
      if(!Number.isInteger(page)||page<0||page>=atlases.length)throw Error('CHARACTER_STREAMING_FRAME_PAGE');
    }
    for(const [i,atlas] of atlases.entries()){
      if(!/^main-[a-f0-9]{16}\.json$/.test(atlas.data)||!/^main-[a-f0-9]{16}\.webp$/.test(atlas.image)
        ||meta.pages[i].data!==atlas.data||meta.pages[i].image!==atlas.image)
        throw Error('CHARACTER_STREAMING_PAGE_PATH');
    }
  }
  async function loadStreamPage(page){
    if(disposed)throw Error('CHARACTER_RUNTIME_BUNDLE_DISPOSED');
    signal?.throwIfAborted();
    if(readyPages.has(page))return;
    if(pagePending.has(page))return pagePending.get(page);
    const pending=prepareCharacterAtlasPage(async()=>{
      if(disposed)throw Error('CHARACTER_RUNTIME_BUNDLE_DISPOSED');
      signal?.throwIfAborted();
      const atlas=runtime.sides.main.atlases[page],dataUrl=assetUrl(atlas.data,runtimeUrl),imageUrl=assetUrl(atlas.image,runtimeUrl);
      // Pixi's JSON load parser still runs subsequent spritesheet parsers.
      // Read/verify metadata directly, before any image dependency is decoded.
      const response=await fetchImpl(dataUrl,{signal});
      if(!response.ok)throw Error('CHARACTER_STREAMING_METADATA_HTTP_'+response.status);
      const text=await response.text();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==runtime.streaming.pages[page].dataSha256)throw Error('CHARACTER_STREAMING_METADATA_HASH');
      const data=JSON.parse(text);
      if(disposed)throw Error('CHARACTER_RUNTIME_BUNDLE_DISPOSED');
      if(data.meta?.image!==atlas.image)throw Error('CHARACTER_STREAMING_IMAGE_PATH');
      const expected=Object.keys(runtime.streaming.texturePages).filter(k=>runtime.streaming.texturePages[k]===page);
      if(expected.length!==Object.keys(data.frames??{}).length||expected.some(k=>!data.frames[k]))
        throw Error('CHARACTER_STREAMING_FRAME_SET');
      for(const key of expected)if(textures.has(key))throw Error('CHARACTER_STREAMING_DUPLICATE_FRAME');
      const texture=await PIXI.Assets.load(imageUrl);loadedUrls.add(imageUrl);
      if(texture.source)decodedSources.add(texture.source);
      if(disposed)throw Error('CHARACTER_RUNTIME_BUNDLE_DISPOSED');
      signal?.throwIfAborted();
      const size=runtime.streaming.pages[page];
      if(texture.source?.pixelWidth!==size.width||texture.source?.pixelHeight!==size.height)throw Error('CHARACTER_STREAMING_TEXTURE_DIMENSIONS');
      const sheet=new PIXI.Spritesheet({texture,data,cachePrefix:`${cachePrefix}${runtime.entityId}:main:${page}:`});
      try{await sheet.parse();}catch(error){sheet.destroy(false);throw error;}
      sheets.push({sheet,owned:true});atlasPages.push({side:'main',page,dataUrl,imageUrl,source:texture.source});
      for(const [key,value]of Object.entries(sheet.textures)){
        if(value.source&&runtime.artProfile?.filter==='nearest')value.source.scaleMode='nearest';
        textures.set(key,value);
      }
      readyPages.add(page);
    },signal);
    pagePending.set(page,pending);
    try{await pending;}finally{if(pagePending.get(page)===pending)pagePending.delete(page);}
  }
  async function ensureSequence(id){
    if(disposed)throw Error('CHARACTER_RUNTIME_BUNDLE_DISPOSED');
    const keys=sequenceTextures(id);
    await Promise.all([...new Set(keys.filter(k=>!textures.has(k)).map(k=>runtime.streaming.texturePages[k]))].map(loadStreamPage));
    if(!keys.every(k=>textures.has(k)))throw Error('CHARACTER_STREAMING_SEQUENCE_INCOMPLETE');
    return true;
  }
  async function releaseResources() {
    // Pixi's ImageSource.destroy releases GPU storage and drops .resource,
    // but does not close its decoded ImageBitmap. Explicitly close only after
    // Assets has destroyed that source, never while a live texture owns it.
    const decoded=new Map([...decodedSources].filter(s=>typeof s.resource?.close==='function').map(s=>[s.resource,s]));
    for(const {sheet,owned} of sheets)if(owned)sheet.destroy(false);
    textures.clear();
    await Promise.allSettled([...loadedUrls].map(url=>PIXI.Assets.unload?.(url)));
    for(const [bitmap,source] of decoded)closeDestroyedBitmap(bitmap,source);
    decodedSources.clear();sheets.length=0;loadedUrls.clear();atlasPages.length=0;
  }

  try {
    requireRecord(runtime, "character runtime");
    requireRecord(runtime.sides, "character runtime.sides");
    if(streamed){
      validateStreaming();
      for(const id of new Set([0,...initialSequenceIds]))await ensureSequence(id);
    }
    const guardedAtlases = new Map();
    if (replacementGuard) {
      replacementGuard.validateRuntime(runtime);
      // Validate all Main/Sub metadata before decoding any replacement pixels.
      // Explicit JSON parsing prevents Pixi following unvalidated meta.image URLs.
      for (const sideName of ["main", "sub"]) {
        for (const atlas of runtime.sides[sideName].atlases) {
          const dataUrl = replacementGuard.safeUrl(atlas.data, runtimeUrl);
          replacementGuard.safeUrl(atlas.image, runtimeUrl);
          const data = await PIXI.Assets.load({ src: dataUrl, parser: "json" });
          loadedUrls.add(dataUrl);
          replacementGuard.validateAtlas(sideName, data, atlas, runtimeUrl);
          guardedAtlases.set(dataUrl, data);
        }
      }
      replacementGuard.validateComplete();
    }
    for (const sideName of streamed || !pixels ? [] : sides) {
      const side = requireRecord(runtime.sides[sideName], `character runtime.sides.${sideName}`);
      if (!Array.isArray(side.atlases) || !Array.isArray(side.animations)) {
        throw new TypeError(`Character side ${sideName} requires atlases and animations`);
      }
      for (let page = 0; page < side.atlases.length; page += 1) {
        const atlas = requireRecord(side.atlases[page], `${sideName}.atlases[${page}]`);
        const dataUrl = assetUrl(atlas.data, runtimeUrl);
        const imageUrl = assetUrl(atlas.image, runtimeUrl);
        const atlasAsset = replacementGuard ? guardedAtlases.get(dataUrl) : await PIXI.Assets.load(dataUrl);
        loadedUrls.add(dataUrl);
        let sheet;
        let pageSource;
        let owned = false;
        if (atlasAsset?.textures && atlasAsset?.data?.frames) {
          // Pixi's spritesheet loader recognizes TexturePacker JSON and returns
          // an already parsed Spritesheet, including its image dependency.
          sheet = atlasAsset;
          pageSource = sheet.textureSource ?? Object.values(sheet.textures)[0]?.source;
        } else {
          const texture = await PIXI.Assets.load(imageUrl);
          pageSource = texture.source;
          if(texture.source)decodedSources.add(texture.source);
          loadedUrls.add(imageUrl);
          sheet = new PIXI.Spritesheet({
            texture,
            data: atlasAsset,
            cachePrefix: `${cachePrefix}${runtime.entityId}:${sideName}:${page}:`
          });
          try { await sheet.parse(); } catch (error) { sheet.destroy(false); throw error; }
          owned = true;
        }
        sheets.push({ sheet, owned });
        atlasPages.push({side:sideName,page,dataUrl,imageUrl,source:pageSource});
        if(sheet.textureSource)decodedSources.add(sheet.textureSource);
        for (const [key, value] of Object.entries(sheet.textures)) {
          if (textures.has(key)) throw new Error(`Duplicate character texture key: ${key}`);
          if (value.source && runtime.artProfile?.filter === "nearest") value.source.scaleMode = "nearest";
          textures.set(key, value);
        }
      }
    }
    for (const sideName of streamed || !pixels ? [] : sides) {
      for (const animation of runtime.sides[sideName].animations) {
        for (const frame of animation.frames) {
          if (!textures.has(frame.texture)) throw new RangeError(`Character runtime texture is missing: ${frame.texture}`);
        }
      }
    }
  } catch (error) {
    disposed=true;
    await Promise.allSettled([...pagePending.values()]);
    await releaseResources();
    throw error;
  }

  return Object.freeze({
    runtime,

    createActor({
      side = "main",
      animation = "idle",
      tickRateHz = runtime.timing?.tickRateHz ?? 60,
      reducedMotion = false,
      nativeFramePresentation = false,
      battleGeometry = null,
      nativeGeometry = null,
      nativeSequence = false
    } = {}) {
      if (disposed) throw new Error("CHARACTER_RUNTIME_BUNDLE_DISPOSED");
      const sideRuntime = runtime.sides[side];
      if (!sideRuntime || !sides.includes(side)) throw new RangeError(`Unknown or unloaded character side: ${side}`);
      const firstAnimation = sideRuntime.animations.find((entry) => (
        entry.id === animation || entry.name === animation || entry.semanticAlias === animation
      ));
      if (!firstAnimation) throw new RangeError(`Unknown character animation: ${animation}`);
      const firstTexture = resolveTexture(firstAnimation.frames[0].texture);
      const sprite = new PIXI.Sprite({ texture: firstTexture });
      const anchor = runtime.artProfile?.anchor ?? { x: 0.5, y: 1 };
      sprite.anchor?.set?.(anchor.x, anchor.y);
      const controller = createPixiCharacterAnimationController({
        sprite,
        animations: sideRuntime.animations,
        textureResolver: resolveTexture,
        initialAnimation: animation,
        tickRateHz,
        reducedMotion
      });
      const presenter = nativeFramePresentation ? createNativeHuntCharacterFramePresenter({
        sprite, animations: sideRuntime.animations, textureResolver: resolveTexture,
        entityId: runtime.entityId, reducedMotion, geometry: nativeGeometry
      }) : null;
      const nativeFramePresenter = presenter && streamed ? Object.freeze({...presenter,
        isFrameReady(frame){return sequenceTextures(frame.sequenceId).every(k=>textures.has(k));},
        ensureFrame(frame){return ensureSequence(frame.sequenceId);}
      }) : presenter;
      const battleAnimator = battleGeometry ? createBattleCharacterAnimator({sprite,
        animations:sideRuntime.animations,textureResolver:resolveTexture,geometry:battleGeometry,reducedMotion}) : null;
      const timeline=nativeSequence?createNativeCharacterAnimationTimeline(firstAnimation):null;
      const sequencePlayer=timeline?{getSnapshot:()=>timeline.getSnapshot(),advanceNative(delta){
        const frame=timeline.advanceNative(delta);sprite.texture=resolveTexture(frame.texture);return frame;
      }}:null;
      return Object.freeze({ sprite, controller, side, nativeFramePresenter, battleAnimator,sequencePlayer });
    },

    getDiagnostics() {
      return Object.freeze({
        entityId: runtime.entityId,
        textureCount: textures.size,
        sheetCount: sheets.length,
        textureMemory: characterTextureMemory(atlasPages),
        streaming: streamed ? {readyPages:readyPages.size,totalPages:runtime.sides.main.atlases.length,pendingPages:pagePending.size} : null,
        nativePixels: pixels,
        reviewOnly: runtime.artProfile?.reviewOnly === true,
        runtimeEligible: runtime.artProfile?.runtimeEligible === true,
        ticker: "SCENE_OWNED_APPLICATION_TICKER_REQUIRED"
      });
    },

    dispose() {
      if (disposal) return disposal;
      disposed = true;
      disposal=(async()=>{await Promise.allSettled([...pagePending.values()]);await releaseResources();})();
      return disposal;
    }
  });
}

function characterTextureMemory(pages){
  const sources=new Map();let bytes=0,unknownSourceCount=0;
  const atlasPages=pages.map(({source,...page})=>{
    const key=source??page,first=!sources.has(key);
    if(first)sources.set(key,sources.size);
    // TextureSource.width is logical; physical pixel dimensions include resolution.
    const width=source?.pixelWidth,height=source?.pixelHeight;
    const known=Number.isSafeInteger(width)&&width>0&&Number.isSafeInteger(height)&&height>0;
    const baseRgbaBytes=known?width*height*4:null;
    if(first){if(known)bytes+=baseRgbaBytes;else unknownSourceCount++;}
    return Object.freeze({...page,sourceIndex:sources.get(key),width:known?width:null,height:known?height:null,
      textureFormat:source?.format??null,baseRgbaBytes,countedInEstimate:first});
  });
  return Object.freeze({measurement:'BASE_RGBA8_ESTIMATE_NOT_GPU_USAGE',
    basis:'Loaded TextureSource physical pixels × 4; excludes mipmaps, decode copies and driver/cache overhead',
    pageCount:pages.length,sourceCount:sources.size,unknownSourceCount,
    estimatedBaseRgbaBytes:unknownSourceCount?null:bytes,atlasPages:Object.freeze(atlasPages)});
}
// A cancelled scene and its replacement may briefly share cached downloads.
// Keep URL ownership around the existing Assets singleton: releasing the old
// scene must not destroy a texture that the new scene is using. This scope is
// for our explicit single-URL loaders (not aliases or arbitrary Pixi bundles).
const assetOwners = new WeakMap();

// Every scoped asset load that settles, for a loading screen that needs to
// know the load is alive. Pixi decodes textures in a worker, where the page's
// own resource timing cannot see the download (2026-10-12).
const assetSettledListeners = new Set();
export function onPixiAssetSettled(listener) {
  assetSettledListeners.add(listener);
  return () => assetSettledListeners.delete(listener);
}
function announceAssetSettled(url, ok) {
  for (const listener of [...assetSettledListeners]) {
    try { listener({ url, ok }); } catch { /* a loading screen never breaks a load */ }
  }
}
export function createPixiAssetScope(PIXI, baseUrl = globalThis.location?.href, { signal } = {}) {
  const assets = PIXI.Assets;
  let shared = assetOwners.get(assets);
  if (!shared) assetOwners.set(assets, shared = new Map());
  const held = new Map();
  const keyOf = value => {
    const src = typeof value === 'string' ? value : value.src;
    return baseUrl ? new URL(src, baseUrl).href : src;
  };
  const scoped = {
    load(value) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const key = keyOf(value);
      if (held.has(key)) return held.get(key).promise;
      let entry = shared.get(key);
      if (entry?.releasing) return entry.releasing.then(() => scoped.load(value));
      if (!entry) {
        entry = { refs: 0, source: typeof value === 'string' ? key : { ...value, src: key } };
        entry.promise = Promise.resolve().then(() => assets.load(entry.source)).then(value => {
          announceAssetSettled(key, true);
          return value;
        }, error => {
          announceAssetSettled(key, false);
          // Some callers fail before they can construct a disposable bundle.
          // A failed cache entry must never poison a later scene's retry.
          if (shared.get(key) === entry) shared.delete(key);
          throw error;
        });
        shared.set(key, entry);
      }
      entry.refs++;
      held.set(key, entry);
      return entry.promise.catch(error=>{
        // A failure before bundle creation has no disposer. Release this
        // scope's rejected promise as well, so explicit retry can fetch again.
        if(held.get(key)===entry){held.delete(key);entry.refs--;}
        throw error;
      });
    },
    async unload(value) {
      const key = keyOf(value), entry = held.get(key);
      if (!entry) return;
      held.delete(key);
      if (--entry.refs > 0) return;
      entry.releasing = (async () => {
        try {
          let value;
          try { value=await entry.promise; } catch { return; }
          const source=value?.source??value?.textureSource,bitmap=source?.resource;
          await assets.unload(key);
          closeDestroyedBitmap(bitmap,source);
        }
        finally { if (shared.get(key) === entry) shared.delete(key); }
      })();
      await entry.releasing;
    }
  };
  // Assets does not offer per-request cancellation. Release this scope's
  // references now; each underlying late success is unloaded when it settles.
  // Other live scopes keep their own reference to the same texture.
  signal?.addEventListener('abort', () => {
    for (const key of [...held.keys()]) void scoped.unload(key).catch(() => {});
  }, { once: true });
  return { ...PIXI, Assets: scoped };
}
