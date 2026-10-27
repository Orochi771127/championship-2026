// Gate globe focus turn (Owner 2026-10-27): a bounded 350 ms spring-damped
// tween, started by a choice and finished on its own. Frames run only while it
// turns; the globe itself keeps no loop (it stays event-driven).

/** Ease-out with a small overshoot (a damped spring feel). */
export function gateFocusEase(t, overshoot = 1.25) {
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/**
 * Call onFrame(eased 0..1, done) for `ms`; returns a cancel function.
 * Without frames available it lands at once.
 */
export function startGateFocusTween(onFrame, { ms = 350, view = globalThis } = {}) {
  if (typeof view.requestAnimationFrame !== 'function') { onFrame(1, true); return () => {}; }
  const start = view.performance?.now?.() ?? Date.now();
  let frame = 0;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    onFrame(gateFocusEase(t), t >= 1);
    frame = t < 1 ? view.requestAnimationFrame(tick) : 0;
  };
  frame = view.requestAnimationFrame(tick);
  return () => { if (frame) view.cancelAnimationFrame?.(frame); frame = 0; };
}
