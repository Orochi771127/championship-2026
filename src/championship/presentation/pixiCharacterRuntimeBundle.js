import { createPixiCharacterAnimationController } from "./pixiCharacterAnimationController.js";
import { createNativeHuntCharacterFramePresenter } from "./nativeHuntCharacterAction.js";
import { createBattleCharacterAnimator } from "./battleCharacterAction.js";
import {createNativeCharacterAnimationTimeline} from './characterAnimationTimeline.js';

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
  replacementGuard = null
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

  const runtime = await PIXI.Assets.load(replacementGuard ? { src: runtimeUrl, parser: "json" } : runtimeUrl);
  const sheets = [];
  const loadedUrls = new Set([runtimeUrl]);
  const textures = new Map();
  const decodedSources = new Set();
  async function releaseResources() {
    // Pixi's ImageSource.destroy releases GPU storage and drops .resource,
    // but does not close its decoded ImageBitmap. Explicitly close only after
    // Assets has destroyed that source, never while a live texture owns it.
    const decoded=new Map([...decodedSources].filter(s=>typeof s.resource?.close==='function').map(s=>[s.resource,s]));
    for(const {sheet,owned} of sheets)if(owned)sheet.destroy(false);
    textures.clear();
    await Promise.allSettled([...loadedUrls].map(url=>PIXI.Assets.unload?.(url)));
    for(const [bitmap,source] of decoded)if(source.destroyed)bitmap.close();
    decodedSources.clear();sheets.length=0;loadedUrls.clear();
  }

  try {
    requireRecord(runtime, "character runtime");
    requireRecord(runtime.sides, "character runtime.sides");
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
    for (const sideName of sides) {
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
        let owned = false;
        if (atlasAsset?.textures && atlasAsset?.data?.frames) {
          // Pixi's spritesheet loader recognizes TexturePacker JSON and returns
          // an already parsed Spritesheet, including its image dependency.
          sheet = atlasAsset;
        } else {
          const texture = await PIXI.Assets.load(imageUrl);
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
        if(sheet.textureSource)decodedSources.add(sheet.textureSource);
        for (const [key, value] of Object.entries(sheet.textures)) {
          if (textures.has(key)) throw new Error(`Duplicate character texture key: ${key}`);
          if (value.source && runtime.artProfile?.filter === "nearest") value.source.scaleMode = "nearest";
          textures.set(key, value);
        }
      }
    }
    for (const sideName of sides) {
      for (const animation of runtime.sides[sideName].animations) {
        for (const frame of animation.frames) {
          if (!textures.has(frame.texture)) throw new RangeError(`Character runtime texture is missing: ${frame.texture}`);
        }
      }
    }
  } catch (error) {
    await releaseResources();
    throw error;
  }

  let disposed = false;
  let disposal = null;
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
      const firstTexture = textures.get(firstAnimation.frames[0].texture);
      const sprite = new PIXI.Sprite({ texture: firstTexture });
      const anchor = runtime.artProfile?.anchor ?? { x: 0.5, y: 1 };
      sprite.anchor?.set?.(anchor.x, anchor.y);
      const controller = createPixiCharacterAnimationController({
        sprite,
        animations: sideRuntime.animations,
        textureResolver: (key) => textures.get(key),
        initialAnimation: animation,
        tickRateHz,
        reducedMotion
      });
      const nativeFramePresenter = nativeFramePresentation ? createNativeHuntCharacterFramePresenter({
        sprite, animations: sideRuntime.animations, textureResolver: (key) => textures.get(key),
        entityId: runtime.entityId, reducedMotion, geometry: nativeGeometry
      }) : null;
      const battleAnimator = battleGeometry ? createBattleCharacterAnimator({sprite,
        animations:sideRuntime.animations,textureResolver:key=>textures.get(key),geometry:battleGeometry,reducedMotion}) : null;
      const timeline=nativeSequence?createNativeCharacterAnimationTimeline(firstAnimation):null;
      const sequencePlayer=timeline?{getSnapshot:()=>timeline.getSnapshot(),advanceNative(delta){
        const frame=timeline.advanceNative(delta);sprite.texture=textures.get(frame.texture);return frame;
      }}:null;
      return Object.freeze({ sprite, controller, side, nativeFramePresenter, battleAnimator,sequencePlayer });
    },

    getDiagnostics() {
      return Object.freeze({
        entityId: runtime.entityId,
        textureCount: textures.size,
        sheetCount: sheets.length,
        reviewOnly: runtime.artProfile?.reviewOnly === true,
        runtimeEligible: runtime.artProfile?.runtimeEligible === true,
        ticker: "SCENE_OWNED_APPLICATION_TICKER_REQUIRED"
      });
    },

    dispose() {
      if (disposal) return disposal;
      disposed = true;
      disposal=releaseResources();
      return disposal;
    }
  });
}
