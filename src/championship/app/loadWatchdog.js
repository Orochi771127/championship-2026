// Tells a slow load from a stalled one.
//
// A fixed deadline treats a two-megabyte download on a slow phone link the same
// as a request that will never answer. This gives up only when nothing has
// arrived for `stallMs`, or when the whole load has run for `maxMs`; every
// sign of progress restarts the stall clock.

export const LOAD_STALL_MS = 30000;
export const LOAD_MAX_MS = 240000;

/**
 * @param {object} options
 * @param {(reason: 'STALLED'|'TOO_LONG') => void} options.onExpire
 * @param {number} [options.stallMs]
 * @param {number} [options.maxMs]
 * @param {() => number} [options.now]
 * @param {(fn: () => void, ms: number) => unknown} [options.setTimer]
 * @param {(handle: unknown) => void} [options.clearTimer]
 */
export function createLoadWatchdog({ onExpire, stallMs = LOAD_STALL_MS, maxMs = LOAD_MAX_MS,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms), clearTimer = (handle) => globalThis.clearTimeout(handle) } = {}) {
  if (typeof onExpire !== 'function') throw new TypeError('createLoadWatchdog requires onExpire');
  const startedAt = now();
  let lastActivityAt = startedAt;
  let timer = null;
  let state = 'WAITING';

  function arm() {
    const due = Math.min(lastActivityAt + stallMs, startedAt + maxMs);
    timer = setTimer(check, Math.max(0, due - now()));
  }
  function check() {
    timer = null;
    if (state !== 'WAITING') return;
    const at = now();
    if (at - startedAt >= maxMs) { state = 'TOO_LONG'; onExpire(state); return; }
    if (at - lastActivityAt >= stallMs) { state = 'STALLED'; onExpire(state); return; }
    arm();
  }
  arm();

  return Object.freeze({
    /** Something arrived: the load is alive. */
    activity() {
      if (state === 'WAITING') lastActivityAt = now();
    },
    /** The load finished or was abandoned; no verdict will follow. */
    stop() {
      if (state === 'WAITING') state = 'STOPPED';
      clearTimer(timer);
      timer = null;
    },
    state: () => state,
    elapsedMs: () => now() - startedAt
  });
}
