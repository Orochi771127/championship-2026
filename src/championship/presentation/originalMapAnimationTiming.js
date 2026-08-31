// Original map animation clock.
//
// ARM9 0x0204ED5C increments the active animation counter by exactly one on
// each field-scene update and compares it with the current BSAR duration word.
// The Nintendo DS display update rate is derived from its video clock:
// 33,513,982 Hz / 6 dots / 355 dots per line / 263 lines per frame.

export const ORIGINAL_NDS_VIDEO_CLOCK_HZ = 33_513_982;
export const ORIGINAL_NDS_DOT_DIVISOR = 6;
export const ORIGINAL_NDS_DOTS_PER_LINE = 355;
export const ORIGINAL_NDS_LINES_PER_FRAME = 263;
export const ORIGINAL_MAP_ANIMATION_TICK_HZ =
  ORIGINAL_NDS_VIDEO_CLOCK_HZ
  / ORIGINAL_NDS_DOT_DIVISOR
  / ORIGINAL_NDS_DOTS_PER_LINE
  / ORIGINAL_NDS_LINES_PER_FRAME;
export const ORIGINAL_MAP_ANIMATION_TIMING_EVIDENCE = "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK";

export function originalMapAnimationTicksToMs(rawTicks) {
  if (!Number.isSafeInteger(rawTicks) || rawTicks <= 0) {
    throw new RangeError(`INVALID_ORIGINAL_MAP_ANIMATION_TICKS: ${rawTicks}`);
  }
  return rawTicks * 1000 / ORIGINAL_MAP_ANIMATION_TICK_HZ;
}

export function originalMapAnimationFramesToRuntime(frames) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new TypeError("ORIGINAL_MAP_ANIMATION_FRAMES_REQUIRED");
  }
  return Object.freeze(frames.map((frame) => Object.freeze({
    ...frame,
    durationMs: originalMapAnimationTicksToMs(frame.durationRawTicks)
  })));
}
