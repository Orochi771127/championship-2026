// Title-owned decoration lifetime. The background's original bytes are fetched
// once per unfinished attempt, never independently by CSS. A complete decoded
// Blob may be reused on return. Film warmup selects only these TITLE images,
// one low-priority request at a time, after the player grants buffer headroom.
export function createTitleImageLifecycle(title, {
  fetchImpl = (...args) => globalThis.fetch(...args),
  urls = globalThis.URL,
  createImage = () => new globalThis.Image(),
  timeoutMs = 60000,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  onStateChange = () => {},
  onSettled = () => {}
} = {}) {
  const images = [...title.querySelectorAll('img')].map(image => ({
    image, src: image.getAttribute('src') ?? image.dataset?.titleSrc,
    released: !image.getAttribute('src')
  }));
  const panel = title.querySelector?.('.cm-title__panel');
  const source = panel?.dataset.backgroundSrc;
  const backgroundUrl = source ? new URL(source, title.ownerDocument.baseURI).href : null;
  if (backgroundUrl) for (const entry of images) entry.managed = true;
  let paused = null, titleWasHidden = null, visibleKey = null, disposed = false, generation = 0, active = null, cachedBlob = null;
  const visible = entry => !entry.image.dataset?.titleLocale || entry.image.dataset.titleLocale === (title.ownerDocument?.documentElement?.lang || 'zh-Hant');
  const imageState = (entry, value) => { if (entry.image.dataset) entry.image.dataset.titleImageState = value; };

  function state(value) {
    const shown = images.filter(visible);
    const progress = {ready: Number(Boolean(active?.ready)) + shown.filter(e => e.managed ? e.request?.ready : (!e.released && e.image.complete && e.image.naturalWidth > 0)).length,
      total: shown.length + Number(Boolean(backgroundUrl))};
    if (value === 'ready' && progress.ready < progress.total) value = 'loading';
    if (!['disposed','paused'].includes(value) && (active?.failed || shown.some(e => e.failed))) value = 'error';
    if (panel) panel.dataset.titleBackgroundState = value;
    onStateChange(value,progress);
  }
  function clearDeadline(entry) {
    if (entry?.timer != null) { clearTimer(entry.timer); entry.timer = null; }
  }
  function release(entry) {
    if (!entry || entry.released) return;
    entry.released = true;
    clearDeadline(entry);
    entry.controller.abort();
    entry.image?.removeAttribute('src');
    if (entry.url) urls.revokeObjectURL(entry.url);
  }
  function current(entry) {
    return !disposed && !entry.released && !title.hidden && (!paused || entry.fromCache || entry.warm)
      && active === entry && entry.generation === generation;
  }
  function fail(entry) {
    if (!current(entry)) return;
    entry.failed = true;
    release(entry); state('error'); onSettled();
    // Retain this attempt until a deliberate retry or leaving/returning.
  }
  function startBackground(warm = false) {
    if (!backgroundUrl || active) return;
    const entry = { generation: ++generation, controller: new AbortController(), released: false, fromCache: cachedBlob !== null, warm };
    active = entry; state('loading');
    // Bound the entire fetch/body/decode lifetime, including HTTP 200 stalls.
    entry.timer = setTimer(() => fail(entry), timeoutMs);
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
        clearDeadline(entry);
        cachedBlob = blob; entry.ready = true;
        panel.style.backgroundImage = `url("${entry.url}")`;
        state('ready'); onSettled();
      } catch {
        fail(entry);
      }
    })();
  }
  function releaseImage(entry) {
    const hadRequest = Boolean(entry.request);
    unbindImage(entry);
    release(entry.request);
    entry.request = null;
    if (entry.warmed || hadRequest) { entry.image.removeAttribute('src'); entry.released = true; imageState(entry,'idle'); }
  }
  function startImage(entry, warm = false) {
    if (entry.request || entry.failed || !entry.src || !visible(entry)) return;
    entry.managed = true;
    const request = {controller:new AbortController(),released:false,warm,fromCache:Boolean(entry.blob)};
    entry.request = request;
    bindImage(entry);
    const currentImage = () => !disposed && !title.hidden && visible(entry) && !request.released && entry.request === request
      && (!paused || warm || request.fromCache);
    const failImage = () => {
      if (!currentImage()) return;
      releaseImage(entry); entry.failed = true; imageState(entry,'error'); state('error'); onSettled();
    };
    state('loading');
    imageState(entry,'loading');
    request.timer = setTimer(failImage,timeoutMs);
    void (async () => {
      try {
        let blob = entry.blob;
        if (!blob) {
          const response = await fetchImpl(new URL(entry.src,title.ownerDocument.baseURI).href,{signal:request.controller.signal,priority:'low'});
          if (!currentImage()) return;
          if (!response.ok) throw new Error('TITLE_IMAGE_RESPONSE');
          blob = await response.blob();
        }
        if (!currentImage()) return;
        request.url = urls.createObjectURL(blob); request.image = createImage(); request.image.src = request.url;
        await request.image.decode();
        if (!currentImage()) return;
        // Decode the attached DOM image too before replacing the readable
        // heading. Same Blob URL and original pixels; no second download.
        entry.released = false;
        entry.image.setAttribute('src',request.url);
        await entry.image.decode?.();
        if (!currentImage()) return;
        clearDeadline(request); request.ready = true; entry.blob = blob; entry.warmed = true;
        imageState(entry,'ready');
        state(active?.ready ? 'ready' : 'loading'); onSettled();
      } catch { failImage(); }
    })();
  }
  function unbindImage(entry) {
    entry.listenerEpoch = (entry.listenerEpoch || 0) + 1;
    entry.image.removeEventListener?.('load',entry.loaded);
    entry.image.removeEventListener?.('error',entry.error);
    entry.loaded = entry.error = null;
  }
  function bindImage(entry) {
    if (entry.loaded || !visible(entry)) return;
    const request = entry.request, epoch = entry.listenerEpoch || 0;
    const currentEvent = () => !disposed && !title.hidden && !entry.released && visible(entry)
      && (entry.listenerEpoch || 0) === epoch && entry.request === request && !request?.released;
    entry.loaded = () => { if (currentEvent() && active?.ready && !images.some(e => visible(e) && e.failed)) state('ready'); };
    entry.error = () => {
      if (!currentEvent()) return;
      releaseImage(entry);
      entry.managed = true; entry.failed = true; entry.blob = null; imageState(entry,'error'); state('error'); onSettled();
    };
    entry.image.addEventListener?.('load',entry.loaded);
    entry.image.addEventListener?.('error',entry.error);
  }
  function syncTitleImages(nextPaused = title.hidden) {
    if (disposed) return;
    const hidden = Boolean(title.hidden), wantPause = Boolean(nextPaused) || hidden;
    const nextVisibleKey = images.map(entry=>Number(visible(entry))).join('');
    const visibilityChanged = visibleKey !== nextVisibleKey;
    visibleKey = nextVisibleKey;
    for (const entry of images) {
      if (entry.image.dataset) entry.image.dataset.titleImageVisible = String(!hidden && visible(entry));
      if (hidden) { releaseImage(entry); entry.failed = false; }
      else if (!visible(entry)) {
        unbindImage(entry);
        // Keep completed pixels cached; only cancel an unfinished hidden logo.
        if (entry.request && !entry.request.ready) releaseImage(entry);
        continue;
      }
      else if (wantPause && entry.request && !entry.request.ready && !entry.request.warm && !entry.request.fromCache) { releaseImage(entry); }
      else if (entry.managed && !entry.request && (entry.blob || !wantPause)) { startImage(entry); }
      // A warm request becomes the normal TITLE request on skip; no duplicate
      // image.src download is issued while its body/decode is still pending.
      if (entry.request) { bindImage(entry); continue; }
      if (wantPause && !entry.image.complete && entry.src && !entry.released) {
        entry.image.removeAttribute('src'); entry.released = true;
      } else if (!wantPause && entry.released && !entry.failed) {
        entry.image.setAttribute('src', entry.src); entry.released = false;
      }
    }
    if (paused === wantPause && titleWasHidden === hidden) {
      if (visibilityChanged) state(active?.ready ? 'ready' : paused ? 'paused' : 'loading');
      return;
    }
    paused = wantPause; titleWasHidden = hidden;
    if (paused) {
      // Login music only pauses unfinished downloads. A decoded background
      // must stay visible until the title itself is actually left.
      if (!hidden && (active?.ready || active?.fromCache || active?.released || active?.warm)) return;
      if (!hidden && cachedBlob) { startBackground(); return; }
      generation++; release(active); active = null;
      if (panel) panel.style.backgroundImage = 'none';
      state('paused');
    } else startBackground();
  }
  syncTitleImages.warmNext = () => {
    if (disposed || title.hidden || !paused || panel?.dataset.titleBackgroundState === 'error') return false;
    if (!active) { startBackground(true); return Boolean(backgroundUrl); }
    if (!active.ready || images.some(e => visible(e) && e.request && !e.request.ready)) return false;
    const entry = images.find(e => visible(e) && !e.blob && !(e.image.complete && !e.released && e.image.naturalWidth > 0));
    if (!entry || entry.failed) return false;
    startImage(entry,true); return true;
  };
  syncTitleImages.suspend = () => {
    if (disposed) return;
    if (active && !active.ready && !active.released) { release(active); active = null; state('paused'); }
    for (const entry of images) if (entry.request && !entry.request.ready) releaseImage(entry);
    paused = true;
  };
  syncTitleImages.retry = () => {
    if (disposed || title.hidden || panel?.dataset.titleBackgroundState !== 'error') return false;
    const failedImage = images.find(e => visible(e) && e.failed);
    if (failedImage) {
      releaseImage(failedImage); failedImage.failed = false; state('loading');
      if (!paused) startImage(failedImage); else onSettled();
      return true;
    }
    release(active); active = null;
    // A first tap may also start music. Queue this one deliberate retry until
    // its initial buffer is ready, preserving the existing network priority.
    if (paused) state('loading'); else startBackground();
    return true;
  };
  syncTitleImages.dispose = () => {
    if (disposed) return;
    syncTitleImages(true);
    disposed = true; generation++; release(active); active = null; cachedBlob = null;
    for (const entry of images) {
      releaseImage(entry); entry.blob = null;
      unbindImage(entry);
    }
    if (panel) panel.style.backgroundImage = 'none';
    state('disposed');
  };
  syncTitleImages.inspect = () => Object.freeze({
    paused, disposed, generation, state: panel?.dataset.titleBackgroundState ?? null,
    hasCachedBlob: cachedBlob !== null
  });
  return syncTitleImages;
}
