// Original-game capture feedback observed in video3.MOV (2026-09-12):
// the hidden wild becomes a compact cyan-white light, lifts, arcs into the
// Hunt tool rail, then flashes on arrival. The native hand controller remains
// the sole timing authority; this module only turns its phase/counter into a
// draw frame. No ROM pixels or decoded cell geometry enter the runtime.

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const freeze = Object.freeze;

export const CAPTURE_STORAGE_VFX_EVIDENCE = "VIDEO_OBSERVED_PLUS_NATIVE_PHASE_CLOCK";
export const CAPTURE_STORAGE_VFX_ART = "ORIGINAL_CREATED_VECTOR";

function quadratic(start, control, end, progress) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y
  };
}

export function captureStorageTarget(viewportWidth, viewportHeight) {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    return freeze({ x: 0, y: 0 });
  }
  // The recording lands in the lower tool/card rail, near its right edge.
  // Keep the target inside the touch-safe viewport on narrow phones.
  return freeze({
    x: Math.max(28, viewportWidth - 44),
    y: Math.max(28, viewportHeight - 70)
  });
}

/**
 * Convert one native phase snapshot to a screen-space vector-effect frame.
 *
 * phase 0 counter 10..40: the wild is hidden and light condenses in place
 * phase 1 counter 0..10:   the light lifts
 * phase 2 counter 0..60:   it follows the observed curved flight
 * phase 3 counter 0..10:   arrival flash before the native card write
 */
export function captureStorageVfxFrame(effect, start, target) {
  const phase = effect?.phase;
  const counter = effect?.counter;
  if (!Number.isInteger(phase) || !Number.isInteger(counter)
      || !Number.isFinite(start?.x) || !Number.isFinite(start?.y)
      || !Number.isFinite(target?.x) || !Number.isFinite(target?.y)
      || phase < 0 || phase > 3 || counter < 0) {
    return freeze({ visible: false, stage: "HIDDEN" });
  }

  if (phase === 0 && counter < 10) {
    return freeze({ visible: false, stage: "WAITING" });
  }

  if (phase === 0) {
    const progress = clamp01((counter - 10) / 30);
    return freeze({
      visible: true,
      stage: "CONDENSE",
      progress,
      x: start.x,
      y: start.y,
      scale: 0.42 + progress * 0.58,
      alpha: 0.68 + progress * 0.32,
      trail: 0,
      arrival: 0
    });
  }

  const lifted = { x: start.x - 8, y: start.y - 26 };
  if (phase === 1) {
    const progress = clamp01(counter / 10);
    return freeze({
      visible: true,
      stage: "LIFT",
      progress,
      x: start.x + (lifted.x - start.x) * progress,
      y: start.y + (lifted.y - start.y) * progress,
      scale: 1 + Math.sin(progress * Math.PI) * 0.18,
      alpha: 1,
      trail: progress * 0.22,
      arrival: 0
    });
  }

  if (phase === 2) {
    const progress = clamp01(counter / 60);
    const distance = Math.hypot(target.x - lifted.x, target.y - lifted.y);
    const control = {
      x: lifted.x + (target.x - lifted.x) * 0.42,
      y: Math.min(lifted.y, target.y) - Math.min(92, Math.max(34, distance * 0.24))
    };
    const point = quadratic(lifted, control, target, progress);
    return freeze({
      visible: true,
      stage: "FLIGHT",
      progress,
      x: point.x,
      y: point.y,
      scale: 1 - progress * 0.22,
      alpha: 1,
      trail: Math.min(1, 0.2 + progress),
      arrival: 0,
      path: freeze({ start: freeze(lifted), control: freeze(control), end: freeze({ ...target }) })
    });
  }

  const progress = clamp01(counter / 10);
  return freeze({
    visible: true,
    stage: "ARRIVAL",
    progress,
    x: target.x,
    y: target.y,
    scale: 0.86 + progress * 0.62,
    alpha: 1 - progress * 0.74,
    trail: 0,
    arrival: 1 - progress
  });
}
