import { createPixiCharacterAnimationController } from "./pixiCharacterAnimationController.js";

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
  cachePrefix = "championship-character:"
}) {
  if (!PIXI?.Assets || typeof PIXI.Assets.load !== "function"
    || typeof PIXI.Spritesheet !== "function" || typeof PIXI.Sprite !== "function") {
    throw new TypeError("Character runtime requires PixiJS Assets, Spritesheet and Sprite");
  }
  if (typeof runtimeUrl !== "string" || runtimeUrl.length === 0) {
    throw new TypeError("runtimeUrl must be a non-empty string");
  }

  const runtime = requireRecord(await PIXI.Assets.load(runtimeUrl), "character runtime");
  requireRecord(runtime.sides, "character runtime.sides");
  const sheets = [];
  const loadedUrls = new Set([runtimeUrl]);
  const textures = new Map();

  try {
    for (const sideName of ["main", "sub"]) {
      const side = requireRecord(runtime.sides[sideName], `character runtime.sides.${sideName}`);
      if (!Array.isArray(side.atlases) || !Array.isArray(side.animations)) {
        throw new TypeError(`Character side ${sideName} requires atlases and animations`);
      }
      for (let page = 0; page < side.atlases.length; page += 1) {
        const atlas = requireRecord(side.atlases[page], `${sideName}.atlases[${page}]`);
        const dataUrl = assetUrl(atlas.data, runtimeUrl);
        const imageUrl = assetUrl(atlas.image, runtimeUrl);
        const atlasAsset = await PIXI.Assets.load(dataUrl);
        loadedUrls.add(dataUrl);
        let sheet;
        let owned = false;
        if (atlasAsset?.textures && atlasAsset?.data?.frames) {
          // Pixi's spritesheet loader recognizes TexturePacker JSON and returns
          // an already parsed Spritesheet, including its image dependency.
          sheet = atlasAsset;
        } else {
          const texture = await PIXI.Assets.load(imageUrl);
          loadedUrls.add(imageUrl);
          sheet = new PIXI.Spritesheet({
            texture,
            data: atlasAsset,
            cachePrefix: `${cachePrefix}${runtime.entityId}:${sideName}:${page}:`
          });
          await sheet.parse();
          owned = true;
        }
        sheets.push({ sheet, owned });
        for (const [key, value] of Object.entries(sheet.textures)) {
          if (textures.has(key)) throw new Error(`Duplicate character texture key: ${key}`);
          textures.set(key, value);
        }
      }
    }
  } catch (error) {
    for (const { sheet, owned } of sheets) {
      if (owned) sheet.destroy(false);
    }
    await Promise.allSettled([...loadedUrls].map((url) => PIXI.Assets.unload?.(url)));
    throw error;
  }

  const referenced = new Set(
    ["main", "sub"].flatMap((sideName) =>
      runtime.sides[sideName].animations.flatMap((animation) =>
        animation.frames.map((frame) => frame.texture)
      )
    )
  );
  for (const key of referenced) {
    if (!textures.has(key)) throw new RangeError(`Character runtime texture is missing: ${key}`);
  }

  let disposed = false;
  return Object.freeze({
    runtime,

    createActor({
      side = "main",
      animation = "idle",
      tickRateHz = runtime.timing?.tickRateHz ?? 60,
      reducedMotion = false
    } = {}) {
      if (disposed) throw new Error("CHARACTER_RUNTIME_BUNDLE_DISPOSED");
      const sideRuntime = runtime.sides[side];
      if (!sideRuntime) throw new RangeError(`Unknown character side: ${side}`);
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
      return Object.freeze({ sprite, controller, side });
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

    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const { sheet, owned } of sheets) {
        if (owned) sheet.destroy(false);
      }
      textures.clear();
      await Promise.allSettled([...loadedUrls].map((url) => PIXI.Assets.unload?.(url)));
    }
  });
}
