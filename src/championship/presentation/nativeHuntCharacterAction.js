/** OVL0 0210C048 -> ARM9 02047984. These numbers are requests, not names.
 * This selector consumes existing state. It never chooses an AI state.
 */
export function resolveNativeHuntCharacterSequence({ request, bound, overrideFlags }) {
  if (!Number.isInteger(request) || request < 0 || request > 39
    || ![0, 1, false, true].includes(bound)
    || !Array.isArray(overrideFlags) || overrideFlags.length !== 3
    || overrideFlags.some((flag) => !Number.isSafeInteger(flag) || flag < 0 || flag > 0xffffffff)) {
    throw new TypeError("NATIVE_HUNT_CHARACTER_STATE_REQUIRED");
  }
  if (overrideFlags.some(Boolean)) {
    if (request === 0) request = 1;
    else if (request === 2) request = 12;
  }
  const boundSlots = { 0: 16, 1: 17, 2: 18, 3: 19, 4: 20, 6: 20,
    11: 21, 12: 22, 13: 23, 14: 24, 15: 25 };
  return bound ? boundSlots[request] ?? request : request;
}

export const NATIVE_HUNT_CHARACTER_FRAME_CONTRACT = "HUNT_CHARACTER_PRESENTATION.v1";

/** Read-only texture projection from the existing owner. No ticker or AI alias.
 * Each actor supplies its own compiled native sequences and cells. Live capture
 * replay is verified separately from the 224-character frame correspondence.
 */
export function createNativeHuntCharacterFramePresenter({ sprite, animations, textureResolver, entityId, reducedMotion = false }) {
  if (!sprite || typeof textureResolver !== "function" || !Array.isArray(animations)) {
    throw new TypeError("NATIVE_CHARACTER_PRESENTATION_DEPENDENCIES_REQUIRED");
  }
  const sequences = new Map(animations.map((animation) => [animation.id, animation]));
  const initialTexture = sprite.texture;
  let current = null;
  return Object.freeze({
    apply(frame) {
      if (frame == null) {
        sprite.texture = initialTexture; current = null; return null;
      }
      const sequence = sequences.get(frame.sequenceId);
      if (frame.contract !== NATIVE_HUNT_CHARACTER_FRAME_CONTRACT
        || !Number.isInteger(frame.frameIndex) || frame.frameIndex < 0
        || !sequence?.frames[frame.frameIndex]
        || ![1, 2].includes(sequence.playbackMode)
        || !Number.isInteger(frame.flipBits) || frame.flipBits < 0 || frame.flipBits > 3) {
        throw new TypeError("UNVERIFIED_NATIVE_CHARACTER_FRAME");
      }
      const sourceFrame = sequence.frames[reducedMotion ? 0 : frame.frameIndex];
      const texture = textureResolver(sourceFrame.texture);
      if (!texture) throw new RangeError("NATIVE_CHARACTER_TEXTURE_MISSING");
      sprite.texture = texture;
      current = Object.freeze({ sequenceId: frame.sequenceId, frameIndex: reducedMotion ? 0 : frame.frameIndex,
        cell: sourceFrame.cell, flipX: Boolean(frame.flipBits & 1), flipY: Boolean(frame.flipBits & 2),
        authority: frame.contract, reducedMotion: Boolean(reducedMotion) });
      return current;
    },
    getSnapshot: () => current
  });
}
