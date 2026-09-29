// Local autosave after important operations (2026-09-29).
//
// A purchase, a rename, a confirmed cage layout or a settled result asks for a
// save; the requests coalesce and the write goes through the one existing save
// entry (the app's own save, the same one Save & Quit and the page-hide path
// use). Nothing is written while the screen is not in a safe state -- a day
// change, an evolution, a letter, a running battle or a hunt -- the request
// simply waits for the next safe moment. It owns no key, no second save and no
// clock of its own beyond one timer.
//
// Status is whatever the save port reports (保存中 / 已存到本機 / 保存失敗);
// this module never claims a result it did not get back from the port.

export const AUTOSAVE_DEFAULTS = Object.freeze({
  // Wait this long after the last request, so a burst writes once.
  quietMs: 700,
  // But never hold a request longer than this after the first one.
  maxWaitMs: 4000,
  // When the screen is busy, look again after this long.
  retryMs: 1500
});

export function createAutosaveScheduler({
  save,
  route = null,
  timing = {},
  now = () => Date.now(),
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (id) => globalThis.clearTimeout(id),
  onChange = null
} = {}) {
  if (typeof save !== "function" && typeof route !== "function") throw new TypeError("AUTOSAVE_SAVE_REQUIRED");
  const delays = { ...AUTOSAVE_DEFAULTS, ...timing };
  // `route()` returns the save call for the current screen, or null when the
  // screen is not in a safe state. A plain `save` is always considered safe.
  const resolveRoute = typeof route === "function" ? route : () => save;

  let timer = null, firstRequestAt = null, disposed = false, attempting = false;
  const reasons = new Set();
  const record = { requests: 0, writes: 0, deferred: 0, refused: 0, failed: 0, lastPhase: null, lastReason: null, lastError: null, lastAt: null };

  function notify() {
    try { onChange?.(inspect()); } catch { /* an observer must not break saving */ }
  }

  function arm(ms) {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => { timer = null; attempt(); }, Math.max(0, ms));
  }

  function attempt() {
    if (disposed || attempting || reasons.size === 0) return null;
    const call = resolveRoute();
    if (typeof call !== "function") {
      record.deferred += 1;
      arm(delays.retryMs);
      notify();
      return "DEFERRED";
    }
    attempting = true;
    const why = [...reasons].join("+");
    let phase = null;
    try {
      const status = call();
      phase = status?.phase ?? null;
    } catch (error) {
      // The app refuses a write during an open transaction (battle, hunt
      // commit, capture on the card). That is a "not yet", not a failure.
      record.refused += 1;
      record.lastError = error?.message ?? String(error);
      attempting = false;
      arm(delays.retryMs);
      notify();
      return "REFUSED";
    }
    attempting = false;
    record.lastReason = why;
    record.lastPhase = phase;
    record.lastAt = now();
    if (phase === "SAVED") {
      record.writes += 1;
      reasons.clear();
      firstRequestAt = null;
      record.lastError = null;
    } else {
      // A storage failure stays visible through the port's own status and its
      // retry; it is not retried here in a loop. The next operation asks again.
      record.failed += 1;
      reasons.clear();
      firstRequestAt = null;
    }
    notify();
    return phase;
  }

  function request(reason) {
    if (disposed) return;
    record.requests += 1;
    reasons.add(String(reason || "change"));
    const at = now();
    if (firstRequestAt === null) firstRequestAt = at;
    const untilMax = firstRequestAt + delays.maxWaitMs - at;
    arm(Math.min(delays.quietMs, Math.max(0, untilMax)));
    notify();
  }

  function inspect() {
    return Object.freeze({ pending: [...reasons], waiting: timer !== null, ...record });
  }

  return Object.freeze({
    request,
    /** Write now if something is waiting and the screen allows it (page hide). */
    flush() { if (timer !== null) { clearTimer(timer); timer = null; } return attempt(); },
    /**
     * Another path already wrote the whole session (the page-hide save, Save &
     * Quit, the day change, the hunt's home commit): nothing is left waiting.
     */
    settled() {
      if (disposed || attempting || reasons.size === 0) return;
      if (timer !== null) clearTimer(timer);
      timer = null;
      reasons.clear();
      firstRequestAt = null;
      notify();
    },
    inspect,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      reasons.clear();
    }
  });
}
