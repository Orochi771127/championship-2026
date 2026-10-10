// Title-owned decoration lifetime. The background's original bytes are fetched
// once per unfinished attempt, never independently by CSS. A complete decoded
// Blob may be reused on return; no other art is prefetched.
export function createTitleImageLifecycle(title, {
  fetchImpl = (...args) => globalThis.fetch(...args),
  urls = globalThis.URL,
  createImage = () => new globalThis.Image()
} = {}) {
  const images = [...title.querySelectorAll('img')].map(image => ({
    image, src: image.getAttribute('src'), released: false
  }));
  const panel = title.querySelector?.('.cm-title__panel');
  const source = panel?.dataset.backgroundSrc;
  const backgroundUrl = source ? new URL(source, title.ownerDocument.baseURI).href : null;
  let paused = null, titleWasHidden = null, disposed = false, generation = 0, active = null, cachedBlob = null;

  function state(value) { if (panel) panel.dataset.titleBackgroundState = value; }
  function release(entry) {
    if (!entry || entry.released) return;
    entry.released = true;
    entry.controller.abort();
    entry.image?.removeAttribute('src');
    if (entry.url) urls.revokeObjectURL(entry.url);
  }
  function current(entry) {
    return !disposed && !title.hidden && (!paused || entry.fromCache)
      && active === entry && entry.generation === generation;
  }
  function startBackground() {
    if (!backgroundUrl || active) return;
    const entry = { generation: ++generation, controller: new AbortController(), released: false, fromCache: cachedBlob !== null };
    active = entry; state('loading');
    void (async () => {
      try {
        let blob = cachedBlob;
        if (!blob) {
          const response = await fetchImpl(backgroundUrl, { signal: entry.controller.signal, priority: 'low' });
          if (!current(entry)) return;
          if (!response.ok) throw new Error('TITLE_BACKGROUND_RESPONSE');
          blob = await response.blob();
        }
        if (!current(entry)) return;
        entry.url = urls.createObjectURL(blob);
        entry.image = createImage();
        entry.image.src = entry.url;
        await entry.image.decode();
        if (!current(entry)) return;
        cachedBlob = blob; entry.ready = true;
        panel.style.backgroundImage = `url("${entry.url}")`;
        state('ready');
      } catch {
        if (current(entry)) {
          release(entry); state('error');
          // Keep the failed entry until the next pause/return. Music status
          // notifications must not turn an error into an unbounded retry loop.
        }
      }
    })();
  }
  function syncTitleImages(nextPaused = title.hidden) {
    if (disposed) return;
    for (const entry of images) {
      if (nextPaused && !entry.image.complete && entry.src && !entry.released) {
        entry.image.removeAttribute('src'); entry.released = true;
      } else if (!nextPaused && entry.released) {
        entry.image.setAttribute('src', entry.src); entry.released = false;
      }
    }
    const hidden = Boolean(title.hidden), wantPause = Boolean(nextPaused) || hidden;
    if (paused === wantPause && titleWasHidden === hidden) return;
    paused = wantPause; titleWasHidden = hidden;
    if (paused) {
      // Login music only pauses unfinished downloads. A decoded background
      // must stay visible until the title itself is actually left.
      if (!hidden && (active?.ready || active?.fromCache)) return;
      if (!hidden && cachedBlob) { startBackground(); return; }
      generation++; release(active); active = null;
      if (panel) panel.style.backgroundImage = 'none';
      state('paused');
    } else startBackground();
  }
  syncTitleImages.dispose = () => {
    if (disposed) return;
    syncTitleImages(true);
    disposed = true; generation++; release(active); active = null; cachedBlob = null;
    if (panel) panel.style.backgroundImage = 'none';
    state('disposed');
  };
  syncTitleImages.inspect = () => Object.freeze({
    paused, disposed, generation, state: panel?.dataset.titleBackgroundState ?? null,
    hasCachedBlob: cachedBlob !== null
  });
  return syncTitleImages;
}
