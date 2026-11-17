// EXTERNAL_ASSET_RETRY_20261118: one bounded retry rule for assets the game streams.
//
// The asset host answers 503 now and then (seen on the live site 2026-11-17), and a phone drops a request now and
// then. A load that fails that way is tried again after each of these waits before the scene is told, so a passing
// fault is not shown to the player as lost partner art. An aborted load is never tried again, and an answer the
// host means (a 4xx) is final. Three attempts in all; the scene's own retry key still works after that.
export const ASSET_RETRY_WAITS_MS = Object.freeze([400, 1200]);
const retryPause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `load` (a function returning a promise), trying again after each wait while it keeps failing. */
export async function loadWithRetry(load, { signal = null, waits = ASSET_RETRY_WAITS_MS, pause = retryPause } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await load(); }
    catch (error) {
      if (attempt >= waits.length || signal?.aborted || error?.name === "AbortError") throw error;
      await pause(waits[attempt]);
      if (signal?.aborted) throw signal.reason ?? error;
    }
  }
}

/**
 * `fetch` that tries again when the host answers 5xx or the request is dropped. The last answer is returned as it
 * is (so the caller's own `response.ok` check and message stay), and a thrown network error is rethrown at the end.
 */
export async function retryingFetch(input, init = undefined, { fetchImpl = (...args) => globalThis.fetch(...args), waits = ASSET_RETRY_WAITS_MS, pause = retryPause } = {}) {
  const signal = init?.signal ?? null;
  let last = null;
  try {
    return await loadWithRetry(async () => {
      const response = await fetchImpl(input, init);
      if (response.status >= 500) { last = response; throw new Error("ASSET_HTTP_" + response.status); }
      return response;
    }, { signal, waits, pause });
  } catch (error) {
    if (last && !signal?.aborted && /^ASSET_HTTP_5\d\d$/.test(error?.message ?? "")) return last;
    throw error;
  }
}
