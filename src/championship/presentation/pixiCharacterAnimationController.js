import { createCharacterAnimationTimeline } from "./characterAnimationTimeline.js";

function selectAnimation(animations, selector) {
  const animation = animations.find((candidate) => (
    candidate.id === selector
    || candidate.name === selector
    || candidate.semanticAlias === selector
  ));
  if (!animation) throw new RangeError(`Unknown character animation: ${selector}`);
  return animation;
}

/**
 * Bind ROM-derived variable-duration timelines to one PixiJS Sprite.
 *
 * This controller deliberately does not create or register a ticker. The
 * owning Championship Pixi Application calls update(appTicker), preserving
 * the repository's single-Application/single-ticker rule.
 */
export function createPixiCharacterAnimationController({
  sprite,
  animations,
  textureResolver,
  initialAnimation = animations?.[0]?.id,
  tickRateHz = 60,
  reducedMotion = false
}) {
  if (!sprite || !("texture" in sprite)) {
    throw new TypeError("Pixi character animation requires a Sprite-like target");
  }
  if (!Array.isArray(animations) || animations.length === 0) {
    throw new TypeError("Pixi character animation requires a non-empty animation list");
  }
  if (typeof textureResolver !== "function") {
    throw new TypeError("textureResolver must be a function");
  }

  let animation = selectAnimation(animations, initialAnimation);
  let timeline = createCharacterAnimationTimeline(animation, { tickRateHz, reducedMotion });
  let paused = Boolean(reducedMotion);
  let appliedTextureKey = null;

  function applySnapshot(snapshot) {
    if (snapshot.texture !== appliedTextureKey) {
      const texture = textureResolver(snapshot.texture);
      if (!texture) throw new RangeError(`Missing character texture: ${snapshot.texture}`);
      sprite.texture = texture;
      appliedTextureKey = snapshot.texture;
    }
    return Object.freeze({
      ...snapshot,
      animationId: animation.id ?? null,
      animationName: animation.name ?? null
    });
  }

  applySnapshot(timeline.getSnapshot());

  return Object.freeze({
    update(appTicker) {
      if (!appTicker || !Number.isFinite(appTicker.deltaMS)) {
        throw new TypeError("update requires the owning PixiJS ticker with deltaMS");
      }
      return applySnapshot(timeline.advance(appTicker.deltaMS));
    },

    setAnimation(selector, { restart = true } = {}) {
      const next = selectAnimation(animations, selector);
      if (next === animation && !restart) return applySnapshot(timeline.getSnapshot());
      animation = next;
      timeline = createCharacterAnimationTimeline(animation, {
        tickRateHz,
        reducedMotion,
        paused
      });
      appliedTextureKey = null;
      return applySnapshot(timeline.getSnapshot());
    },

    setPaused(value) {
      paused = Boolean(value || reducedMotion);
      return applySnapshot(timeline.setPaused(paused));
    },

    reset() {
      return applySnapshot(timeline.reset());
    },

    getSnapshot() {
      return applySnapshot(timeline.getSnapshot());
    }
  });
}
