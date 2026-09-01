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
 * Reproduce the NANR traversal without copying Nintendo DS rendering details.
 *
 * Mode 1 walks the recorded frame list and loops. Mode 2 walks forward and
 * back while avoiding duplicated end points at the turn and loop boundaries.
 * Raw frame ticks remain authoritative; the tick rate is injectable because
 * the current 60 Hz conversion is still marked provisional in the ROM report.
 */
export function buildCharacterAnimationTraversal(animation) {
  validateAnimation(animation);
  const forward = animation.frames.map((_frame, index) => index);
  if (animation.playback === "forward_loop" || forward.length <= 2) return forward;
  return forward.concat(forward.slice(1, -1).reverse());
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
