// Tells a slow load from a stalled one.
//
// A fixed deadline treats a two-megabyte download on a slow phone link the same
// as a request that will never answer. This gives up only when nothing has
// arrived for `stallMs`, or when the whole load has run for `maxMs`; every
// sign of progress restarts the stall clock.

export const LOAD_STALL_MS = 30000;
export const LOAD_MAX_MS = 240000;

// One screen-load attempt. Racing bounds the UI even for a loader that does
// not support AbortSignal; owned late successes are disposed, never attached.
export function createLoadAttempt({ timeoutMs = 60000,
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = handle => globalThis.clearTimeout(handle) } = {}) {
  const controller = new AbortController(), owned = new Set();
  let timer = setTimer(() => cancel(new Error('LOAD_TIMEOUT')), timeoutMs);
  const dispose = value => { try { void Promise.resolve(value?.dispose?.()).catch(() => {}); } catch {} };
  function stopTimer() { if (timer !== null) clearTimer(timer); timer = null; }
  function cancel(reason = new DOMException('Loading cancelled', 'AbortError')) {
    stopTimer();
    if (!controller.signal.aborted) controller.abort(reason);
    for (const value of owned) dispose(value);
    owned.clear();
  }
  function wait(pending) {
    // Attach both handlers even when already cancelled: a late rejection must
    // not become an unhandled rejection after the screen has gone away.
    return new Promise((resolve, reject) => {
      const abort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(pending).then(value => {
        controller.signal.removeEventListener('abort', abort);
        controller.signal.aborted ? reject(controller.signal.reason) : resolve(value);
      }, error => { controller.signal.removeEventListener('abort', abort); reject(error); });
      if (controller.signal.aborted) abort();
    });
  }
  return Object.freeze({ signal: controller.signal, wait, cancel, stopTimer,
    own(pending) {
      return wait(Promise.resolve(pending).then(value => {
        if (controller.signal.aborted) dispose(value);
        else if (value) owned.add(value);
        return value;
      }));
    },
    transfer(value) { owned.delete(value); },
    fetch(url, options = {}) { return globalThis.fetch(url, { ...options, signal: controller.signal }); }
  });
}

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
