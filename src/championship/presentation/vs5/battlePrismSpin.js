// Battle menu prism -- input and turning arithmetic (Owner 2026-11-09).
//
// The menu is an N-sided prism, one face per battle mode, turning about its
// upright axis. A horizontal drag turns it under the finger; on release it
// settles on the nearest face, and a flick carries it one face further. A tap
// (travel under TAP_SLOP) is a face press. Arrow keys step one face; Enter or
// Space presses the face in front.
//
// Nothing here owns a clock. The settle animation is driven by whoever mounts
// the prism (the application's one Pixi ticker); without one the prism lands
// on its face at once. No gameplay authority: every press leaves through the
// callbacks.

const TAP_SLOP = 7; // CSS pixels of total travel, including the final pointerup.
const FLICK_SPEED = 2.4; // rad/s at release that advances one more face.
const VELOCITY_WINDOW_MS = 90;

/** Turning step and face proportions for an n-sided prism of circumradius 1. */
export function prismShape(sides) {
  if (!Number.isInteger(sides) || sides < 3) throw new RangeError("BATTLE_PRISM_NEEDS_THREE_FACES");
  const step = (Math.PI * 2) / sides;
  return Object.freeze({ sides, step, faceWidth: 2 * Math.sin(step / 2), apothem: Math.cos(step / 2) });
}

/** Face i faces the camera when the prism's turn is -i * step. */
export function prismFrontIndex(turn, sides) {
  const { step } = prismShape(sides);
  const index = Math.round(-turn / step);
  return ((index % sides) + sides) % sides;
}

/** The turn that brings face `index` to the front, taking the short way round from `turn`. */
export function prismTurnFor(index, turn, sides) {
  const { step } = prismShape(sides);
  const base = -index * step;
  const laps = Math.round((turn - base) / (Math.PI * 2));
  return base + laps * Math.PI * 2;
}

/** Where a released prism settles: the nearest face, one further on a flick. */
export function prismSettleTurn(turn, velocity, sides) {
  const { step } = prismShape(sides);
  let target = Math.round(turn / step) * step;
  if (Math.abs(velocity) >= FLICK_SPEED) {
    const ahead = Math.sign(velocity);
    // A flick always lands on the next face in its direction, never back.
    if (Math.sign(target - turn) !== ahead) target += ahead * step;
  }
  return target;
}

/** Radians per CSS pixel: dragging one face width across the canvas turns one face. */
export function prismDragRatio(sides, canvasWidth) {
  const { step } = prismShape(sides);
  return step / Math.max(1, canvasWidth * 0.42);
}

/**
 * Bind pointer and keyboard input on the prism canvas.
 *
 * onTurn(delta)      the drag moved the prism by `delta` radians
 * onRelease(velocity) the drag ended; settle it
 * onTap(event)       a press without travel
 * onStep(direction)  arrow key, -1 or +1 face
 * onActivate()       Enter / Space on the front face
 */
export function bindBattlePrismSpin({ canvas, sides, onTurn, onRelease, onTap, onStep, onActivate, now = () => performance.now() }) {
  let active = null;
  let disposed = false;
  const view = canvas.ownerDocument?.defaultView;
  const listeners = [];
  const listen = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    listeners.push([target, type, handler, options]);
  };
  const release = () => {
    const pointer = active;
    active = null; // lostpointercapture may fire synchronously during release.
    if (!pointer) return null;
    try { canvas.releasePointerCapture?.(pointer.id); } catch { /* already lost */ }
    return pointer;
  };
  const advance = (event) => {
    const dx = event.clientX - active.x;
    active.travel += Math.hypot(dx, event.clientY - active.y);
    active.x = event.clientX;
    active.y = event.clientY;
    if (!dx) return;
    const delta = dx * active.ratio;
    const time = now();
    active.samples.push([time, delta]);
    while (active.samples.length && time - active.samples[0][0] > VELOCITY_WINDOW_MS) active.samples.shift();
    onTurn(delta);
  };
  const velocityOf = (pointer) => {
    const samples = pointer.samples.filter(([time]) => now() - time <= VELOCITY_WINDOW_MS);
    if (samples.length < 2) return 0;
    const span = Math.max(16, samples[samples.length - 1][0] - samples[0][0]);
    return samples.reduce((sum, [, delta]) => sum + delta, 0) / span * 1000;
  };
  listen(canvas, "pointerdown", event => {
    if (disposed || active || event.isPrimary === false || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0, samples: [],
      ratio: prismDragRatio(sides(), rect.width) };
    try { canvas.setPointerCapture?.(event.pointerId); } catch { release(); return; }
    // No focus on a press: keyboard focus (and its ring) arrives by Tab only.
    event.preventDefault();
  });
  listen(canvas, "pointermove", event => {
    if (!active || event.pointerId !== active.id) return;
    // Recover if a mouse button was released outside a window/capture failed.
    if (event.pointerType === "mouse" && event.buttons === 0) { const lost = release(); if (lost) onRelease(0); return; }
    advance(event);
    event.preventDefault();
  });
  listen(canvas, "pointerup", event => {
    if (!active || event.pointerId !== active.id) return;
    advance(event);
    const pointer = release();
    event.preventDefault();
    if (disposed) return;
    if (pointer.travel < TAP_SLOP) onTap(event);
    else onRelease(velocityOf(pointer));
  });
  const cancel = event => {
    if (event.pointerId !== undefined && active?.id !== event.pointerId) return;
    if (release()) onRelease(0);
  };
  listen(canvas, "pointercancel", cancel);
  listen(canvas, "lostpointercapture", cancel);
  listen(canvas, "touchcancel", cancel);
  listen(view, "blur", cancel);
  // A face press comes only from an un-cancelled tap, never from the
  // compatibility click a browser sends after a drag.
  listen(canvas, "click", event => { event.preventDefault(); event.stopPropagation(); });
  listen(canvas, "keydown", event => {
    if (active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      onStep(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  });
  return Object.freeze({
    isDragging: () => active !== null,
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options);
    }
  });
}
