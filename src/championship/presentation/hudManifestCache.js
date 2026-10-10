// Page-lifetime metadata only. No textures, gameplay state, storage or service worker.
// Fetch identity separates controlled readers; failed requests remain retryable.
const readers = new WeakMap();
export function readHudManifest(url, fetchImpl = globalThis.fetch) {
  let cache = readers.get(fetchImpl);
  if (!cache) { cache = new Map(); readers.set(fetchImpl, cache); }
  const key = String(url);
  if (!cache.has(key)) {
    const pending = Promise.resolve().then(() => fetchImpl(url)).then(response => {
      if (!response.ok) throw new Error(`HUD_MANIFEST_HTTP_${response.status}`);
      return response.json();
    }).catch(error => { if (cache.get(key) === pending) cache.delete(key); throw error; });
    cache.set(key, pending);
  }
  return cache.get(key);
}
