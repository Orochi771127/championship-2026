// Streamed asset downloads with byte progress.
//
// Texture loaders report nothing until a file is complete, so on a slow link a
// one-megabyte map frame looks exactly like a hung request. Downloading the
// same files here first lets a screen show real progress and tell "slow" from
// "stalled", and the finished bytes are handed to the texture loader as a blob
// so nothing is fetched twice, whatever the server's cache headers say. What a
// screen loads, and whether it may continue, stays with the caller.

function createDownload(url, fetchImpl, notify) {
  const controller = new AbortController();
  const entry = { url, loaded: 0, total: null, done: false, failed: null, blob: null, controller, users: 0, promise: null };
  entry.promise = (async () => {
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`ASSET_HTTP_${response.status}`);
      const length = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(length) && length > 0) entry.total = length;
      const type = response.headers?.get?.('content-type') ?? '';
      const reader = response.body?.getReader?.();
      const chunks = [];
      if (!reader) {
        const bytes = await response.arrayBuffer();
        chunks.push(bytes);
        entry.loaded = bytes.byteLength;
        notify(entry);
      } else {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          entry.loaded += value.byteLength;
          notify(entry);
        }
      }
      // A compressed response reports its compressed length; trust the bytes.
      if (entry.total === null || entry.total !== entry.loaded) entry.total = entry.loaded;
      entry.blob = new Blob(chunks, type ? { type } : undefined);
      entry.done = true;
      notify(entry);
    } catch (error) {
      entry.failed = error;
      notify(entry);
    }
    return entry;
  })();
  return entry;
}

/**
 * @param {{ fetchImpl?: typeof fetch, now?: () => number }} [options]
 */
export function createAssetPrefetcher({ fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
  const downloads = new Map();
  const listeners = new Set();
  let lastActivityAt = null;

  function notify() {
    lastActivityAt = now();
    for (const listener of [...listeners]) {
      try { listener(); } catch (error) { console.warn('Asset progress listener failed', error); }
    }
  }

  /** Progress for a set of URLs; a URL not started yet has no known size. */
  function progress(urls) {
    let loaded = 0; let total = 0; let known = true; let done = 0; let failed = 0;
    for (const url of urls) {
      const entry = downloads.get(url);
      if (!entry) { known = false; continue; }
      loaded += entry.loaded;
      if (entry.total === null) known = false; else total += entry.total;
      if (entry.done) done += 1;
      if (entry.failed) failed += 1;
    }
    return Object.freeze({ loaded, total: known ? total : null, files: urls.length, done, failed,
      complete: urls.length > 0 && done === urls.length, lastActivityAt });
  }

  return Object.freeze({
    /**
     * Start (or join) streamed downloads. Resolves when every file has finished
     * or failed, or when `signal` aborts; failures are reported in the result,
     * never thrown, so the real loader can still try and fall back its own way.
     */
    fetchAll(urls, { signal } = {}) {
      const unique = [...new Set(urls)];
      const entries = unique.map((url) => {
        let entry = downloads.get(url);
        if (!entry || entry.failed) {
          entry = createDownload(url, fetchImpl, notify);
          downloads.set(url, entry);
        }
        entry.users += 1;
        return entry;
      });
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        signal?.removeEventListener('abort', release);
        for (const entry of entries) {
          entry.users -= 1;
          // Nobody is waiting any more: stop spending the link on it.
          if (entry.users <= 0 && !entry.done && !entry.failed) {
            entry.controller.abort();
            if (downloads.get(entry.url) === entry) downloads.delete(entry.url);
          }
        }
      };
      if (signal?.aborted) { release(); return Promise.resolve(progress(unique)); }
      signal?.addEventListener('abort', release, { once: true });
      const finished = Promise.all(entries.map((entry) => entry.promise));
      const cancelled = signal ? new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true })) : null;
      return (cancelled ? Promise.race([finished, cancelled]) : finished).then(() => {
        release();
        return progress(unique);
      });
    },
    progress,
    /** The finished bytes of one URL, or null. */
    blobOf(url) {
      const entry = downloads.get(url);
      return entry?.done ? entry.blob : null;
    },
    /** Drop finished or abandoned downloads so their bytes can be collected. */
    forget(urls) {
      for (const url of urls) {
        const entry = downloads.get(url);
        if (!entry || entry.users > 0) continue;
        if (!entry.done && !entry.failed) entry.controller.abort();
        downloads.delete(url);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    lastActivityAt: () => lastActivityAt
  });
}

/**
 * Wrap a PIXI-like object so the listed URLs load from bytes already on hand.
 * Everything else, and every URL without bytes, goes to the wrapped loader.
 */
export function withPrefetchedTextures(PIXI, blobOf, baseUrl = globalThis.location?.href) {
  const blobUrls = new Map();
  const keyOf = (src) => (baseUrl ? new URL(src, baseUrl).href : src);
  return {
    ...PIXI,
    Assets: {
      ...PIXI.Assets,
      load(value) {
        if (typeof value !== 'string') return PIXI.Assets.load(value);
        const blob = blobOf(keyOf(value));
        if (!blob) return PIXI.Assets.load(value);
        let blobUrl = blobUrls.get(value);
        if (!blobUrl) { blobUrl = URL.createObjectURL(blob); blobUrls.set(value, blobUrl); }
        return PIXI.Assets.load({ src: blobUrl, parser: 'texture' });
      },
      async unload(value) {
        const blobUrl = typeof value === 'string' ? blobUrls.get(value) : null;
        if (!blobUrl) return PIXI.Assets.unload(value);
        blobUrls.delete(value);
        try { await PIXI.Assets.unload({ src: blobUrl }); } finally { URL.revokeObjectURL(blobUrl); }
      }
    }
  };
}

/** One shared prefetcher for the page. */
export const assetPrefetcher = createAssetPrefetcher();
