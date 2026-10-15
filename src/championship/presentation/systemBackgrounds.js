// Static, presentation-only system-page artwork. No player save, game RNG,
// WorldCanvas, ticker, timer, history or router access.
export const SYSTEM_BACKGROUNDS = Object.freeze([
  { id: 'resonance-network-v1', name: 'SYSTEM_BACKGROUND_RESONANCE' },
  { id: 'growth-record-v1', name: 'SYSTEM_BACKGROUND_GROWTH' },
  { id: 'glory-result-v1', name: 'SYSTEM_BACKGROUND_GLORY' }
].map(item => Object.freeze({ ...item,
  src: `assets/production/system-backgrounds-r1/${item.id}.webp`,
  thumbnail: `assets/production/system-backgrounds-r1/${item.id}.thumb.webp`
})));
export const SYSTEM_BACKGROUND_IDS = Object.freeze(SYSTEM_BACKGROUNDS.map(item => item.id));

// Existing mounted system containers only. In particular, never TITLE,
// RAISING_HOME, CAGE_EDIT, GATE_SELECT, HUNT_LOADOUT or either playable field.
export const SYSTEM_BACKGROUND_HOSTS = Object.freeze({
  SHOP: '.cm-vs2-shell', DATABASE: '.cm-vs2-shell', MEDALS: '.cm-vs2-shell',
  DIGIMON_LIST: '.cm-digimon-shell', SCHEDULE: '.cm-schedule-shell',
  HELP: '.cm-help-shell', TAMER_INFO: '.cm-tamer-shell',
  CHAMPIONSHIP: '.cm-championship-shell', HUNT_RESULT: '.cm-vs2-shell',
  BATTLE_RESULT: '.cm-vs5-shell'
});

export function systemBackgroundById(id) {
  return SYSTEM_BACKGROUNDS.find(item => item.id === id) ?? null;
}

// UI-only entropy. Failure leaves the original background, never falls back to
// a simulation random source. The injectable sampler is solely a test seam.
export function systemBackgroundRandom() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] / 0x100000000;
}

export function chooseSystemBackground(previous, sample = systemBackgroundRandom, ids = SYSTEM_BACKGROUND_IDS) {
  const approved = [...new Set(ids.filter(id => SYSTEM_BACKGROUND_IDS.includes(id)))];
  const pool = approved.length > 1 ? approved.filter(id => id !== previous) : approved;
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];
  try {
    const n = sample();
    return Number.isFinite(n) && n >= 0 && n < 1 ? pool[Math.floor(n * pool.length)] : null;
  } catch { return null; }
}

export function createSystemBackgroundController({ root, store, doc = root?.ownerDocument ?? globalThis.document,
  sample = systemBackgroundRandom } = {}) {
  if (!root || !store || !doc) throw new TypeError('System backgrounds need a root and preference store');
  let screen = null, host = null, randomId = null, previousRandom = null;
  let layer = null, pending = null, displayedId = null, requestedId = null, revision = 0;

  function clearImage() {
    revision += 1;
    if (pending) { pending.onload = null; pending.onerror = null; pending.removeAttribute('src'); }
    pending = null;
    layer?.remove();
    layer = null;
    displayedId = requestedId = null;
    host?.classList.remove('cm-system-background-host');
    if (host) delete host.dataset.systemBackground;
  }

  function apply() {
    const values = store.get();
    const id = values.systemBackgroundMode === 'custom' ? values.systemBackgroundId
      : values.systemBackgroundMode === 'random' ? randomId : null;
    const asset = systemBackgroundById(id);
    if (!host || !asset) { clearImage(); return; }
    if (requestedId === asset.id) return;
    const ticket = ++revision;
    if (pending) { pending.onload = null; pending.onerror = null; pending.removeAttribute('src'); }
    requestedId = asset.id;
    const image = doc.createElement('img');
    pending = image;
    image.className = 'cm-system-background__image';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    image.decoding = 'async';
    image.onload = () => {
      if (ticket !== revision || pending !== image || !host) return;
      image.onload = image.onerror = null;
      pending = null;
      const next = doc.createElement('div');
      next.className = 'cm-system-background';
      next.setAttribute('aria-hidden', 'true');
      next.append(image);
      layer?.remove();
      layer = next;
      host.classList.add('cm-system-background-host');
      host.dataset.systemBackground = asset.id;
      host.append(next);
      displayedId = asset.id;
    };
    image.onerror = () => {
      if (ticket !== revision || pending !== image) return;
      clearImage(); // Failed or removed files restore the original theme.
    };
    // Exactly one selected full-size asset. No catalogue or startup preload.
    image.src = asset.src;
  }

  function leave() {
    clearImage();
    screen = host = randomId = null;
  }

  const unsubscribe = store.subscribe((_values, changed) => {
    if (changed.some(id => id === 'systemBackgroundMode' || id === 'systemBackgroundId')) apply();
  });
  return Object.freeze({
    enter(nextScreen) {
      // A render, resize, result subpage or modal opening is not a page entry.
      if (screen === nextScreen) return;
      leave();
      const selector = SYSTEM_BACKGROUND_HOSTS[nextScreen];
      if (!selector) return;
      host = root.querySelector(selector);
      if (!host) return;
      screen = nextScreen;
      if (store.get().systemBackgroundMode === 'random') {
        randomId = chooseSystemBackground(previousRandom, sample);
        if (randomId) previousRandom = randomId;
      }
      apply();
    },
    leave,
    inspect: () => Object.freeze({ screen, displayedId, requestedId, randomId }),
    dispose() { unsubscribe(); leave(); }
  });
}
