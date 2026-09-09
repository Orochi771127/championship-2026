const SUPPORTED_PLAYBACK = new Set([
  "forward_loop",
  "forward_then_backward_once"
]);
const TICK_EPSILON = 1e-9;

function requireFinitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a finite positive number`);
  }
  return value;
}

function validateAnimation(animation) {
  if (!animation || !Array.isArray(animation.frames) || animation.frames.length === 0) {
    throw new TypeError("Character animation requires at least one frame");
  }
  if (!SUPPORTED_PLAYBACK.has(animation.playback)) {
    throw new TypeError(`Unsupported character playback mode: ${animation.playback}`);
  }
  animation.frames.forEach((frame, index) => {
    requireFinitePositive(frame?.ticks, `animation.frames[${index}].ticks`);
    if (typeof frame.texture !== "string" || frame.texture.length === 0) {
      throw new TypeError(`animation.frames[${index}].texture must be a non-empty string`);
    }
  });
}

/**
 * Legacy review-label traversal. This is NOT the original NANR mode mapping.
 *
 * Existing review packs retain their historical labels. Original character
 * presentation uses createNativeCharacterAnimationTimeline below: native mode
 * 1 stops, mode 2 loops. See CHARACTER_ANIMATION_CPU_CHECK_2026-09-06.json.
 */
export function buildCharacterAnimationTraversal(animation) {
  validateAnimation(animation);
  const forward = animation.frames.map((_frame, index) => index);
  if (animation.playback === "forward_loop" || forward.length <= 2) return forward;
  return forward.concat(forward.slice(1, -1).reverse());
}

/** ARM9 0202E438 / 0202E188 / 0202E030, bounded to observed raw modes 1 and 2.
 * One advanceNative call is one native animator invocation, not a Pixi frame.
 * In particular the original loop reset discards overshoot; splitting a large
 * GPU delta into invented calls would change its result. No ownership callback.
 */
export function createNativeCharacterAnimationTimeline(animation, { initialSnapshot = null, allowZeroTicks = false } = {}) {
  if (![1, 2].includes(animation?.playbackMode) || !animation.frames?.length) {
    throw new TypeError("NATIVE_CHARACTER_MODE_REQUIRES_TRACE");
  }
  const frames = animation.frames;
  for (const frame of frames) {
    if (!Number.isInteger(frame.ticks) || frame.ticks < (allowZeroTicks?0:1) || frame.ticks > 65535
      || typeof frame.texture !== "string" || !frame.texture) throw new TypeError("INVALID_NATIVE_CHARACTER_FRAME");
  }
  if(!frames.some(f=>f.ticks>0))throw new TypeError('NATIVE_ANIMATION_ZERO_DURATION');
  const loopStart = animation.loopStartFrame ?? 0;
  if (!Number.isInteger(loopStart) || loopStart < 0 || loopStart >= frames.length) {
    throw new TypeError("INVALID_NATIVE_CHARACTER_LOOP_START");
  }
  let frameIndex = loopStart, elapsedQ12 = 0, active = true;
  if (initialSnapshot !== null) {
    const value = initialSnapshot;
    if (!Number.isInteger(value.frameIndex) || value.frameIndex < 0 || value.frameIndex >= frames.length
      || !Number.isSafeInteger(value.elapsedQ12) || value.elapsedQ12 < 0
      || ![0, 1, false, true].includes(value.active)) throw new TypeError("INVALID_NATIVE_CHARACTER_SNAPSHOT");
    frameIndex = value.frameIndex; elapsedQ12 = value.elapsedQ12; active = Boolean(value.active);
  }
  const snapshot = () => Object.freeze({ sequenceId: animation.id ?? null, frameIndex,
    cell: frames[frameIndex].cell, texture: frames[frameIndex].texture,
    elapsedQ12, active: Number(active), playMode: animation.playbackMode });
  return Object.freeze({
    getSnapshot: snapshot,
    advanceNative(deltaQ12, speedQ12 = 4096) {
      if (!Number.isSafeInteger(deltaQ12) || deltaQ12 < 0 || deltaQ12 > 0x100000
        || !Number.isSafeInteger(speedQ12) || speedQ12 <= 0 || speedQ12 > 0x10000) {
        throw new TypeError("INVALID_NATIVE_CHARACTER_DELTA");
      }
      if (!active) return snapshot();
      elapsedQ12 += Math.floor((speedQ12 * deltaQ12 + 2048) / 4096);
      while (active && elapsedQ12 >= frames[frameIndex].ticks * 4096) {
        elapsedQ12 -= frames[frameIndex].ticks * 4096;
        frameIndex++;
        if (frameIndex >= frames.length) {
          if (animation.playbackMode === 1) { frameIndex = frames.length - 1; active = false; }
          else { frameIndex = loopStart; elapsedQ12 = 0; }
        }
      }
      return snapshot();
    }
  });
}

export function createCharacterAnimationTimeline(animation, {
  tickRateHz = 60,
  reducedMotion = false,
  paused = false
} = {}) {
  validateAnimation(animation);
  requireFinitePositive(tickRateHz, "tickRateHz");

  const traversal = buildCharacterAnimationTraversal(animation);
  let traversalIndex = 0;
  let elapsedTicks = 0;
  let cycle = 0;
  let isPaused = Boolean(paused || reducedMotion);

  function sourceFrameIndex() {
    return traversal[traversalIndex];
  }

  function currentFrame() {
    return animation.frames[sourceFrameIndex()];
  }

  function snapshot() {
    const frame = currentFrame();
    return Object.freeze({
      animationId: animation.id ?? null,
      animationName: animation.name ?? null,
      playback: animation.playback,
      sourceFrameIndex: sourceFrameIndex(),
      traversalIndex,
      traversalLength: traversal.length,
      cell: frame.cell ?? null,
      texture: frame.texture,
      frameTicks: frame.ticks,
      elapsedTicks,
      remainingTicks: Math.max(0, frame.ticks - elapsedTicks),
      cycle,
      paused: isPaused,
      reducedMotion: Boolean(reducedMotion)
    });
  }

  function stepFrame() {
    traversalIndex += 1;
    if (traversalIndex >= traversal.length) {
      traversalIndex = 0;
      cycle += 1;
    }
  }

  return Object.freeze({
    advance(deltaMS) {
      if (!Number.isFinite(deltaMS) || deltaMS < 0) {
        throw new TypeError("deltaMS must be a finite non-negative number");
      }
      if (isPaused || deltaMS === 0) return snapshot();

      let ticks = deltaMS * tickRateHz / 1000;
      while (ticks > 0) {
        const remaining = currentFrame().ticks - elapsedTicks;
        if (ticks + TICK_EPSILON < remaining) {
          elapsedTicks += ticks;
          ticks = 0;
        } else {
          ticks -= remaining;
          if (Math.abs(ticks) < TICK_EPSILON) ticks = 0;
          elapsedTicks = 0;
          stepFrame();
        }
      }
      return snapshot();
    },

    getSnapshot: snapshot,

    reset() {
      traversalIndex = 0;
      elapsedTicks = 0;
      cycle = 0;
      return snapshot();
    },

    setPaused(value) {
      isPaused = Boolean(value || reducedMotion);
      return snapshot();
    },

    getTraversal() {
      return Object.freeze([...traversal]);
    }
  });
}
