// One existing Hunt DOM, one existing runtime, one immutable legacy viewport.
// Measurement is a prerequisite to widening, never a guessed HUD subtraction.
export function isHuntWideLayout({ width, height }) {
  return Number.isFinite(width) && Number.isFinite(height) && width >= 720 && height >= 320
    && width >= height + 160;
}

const editing = element => !!element && (element.isContentEditable || element.tagName === 'TEXTAREA'
  || element.tagName === 'INPUT' && !['button','checkbox','radio','range','submit','reset','file','color','hidden'].includes(element.type));
const positive = n => Number.isFinite(n) && n > 0;

export function createHuntLayoutResolver({
  window: win = globalThis.window, document: doc = globalThis.document,
  getRuntime, onLayoutChange = () => {}, enabled = false
}) {
  const references = new WeakMap();
  let active = null, serial = 0, scheduled = null, disposed = false, wide = false, inputBaseline = null;
  function setWide(value) {
    if (wide === value) return;
    wide = value;
    onLayoutChange();
  }
  function cancelFrame() {
    if (scheduled !== null) win.cancelAnimationFrame(scheduled);
    scheduled = null;
  }
  function invalidateSample() { if (active) active.sample = null; }
  function current(entry) {
    return !disposed && entry === active && entry.serial === serial && !entry.signal?.aborted
      && entry.runtime === getRuntime() && entry.host.isConnected !== false;
  }
  function getOuter() {
    const width = win.innerWidth, height = win.innerHeight;
    if (inputBaseline && Math.abs(inputBaseline.width - width) > 1) inputBaseline = null;
    const hasInput = editing(doc.activeElement);
    if (hasInput && !inputBaseline) inputBaseline = { width, height, wide };
    return { width, height, hasInput, keyboard: !!inputBaseline && height < inputBaseline.height };
  }
  function update() {
    scheduled = null;
    const entry = active;
    if (!entry || !current(entry)) { if (entry) detach(entry); return; }
    const outer = getOuter();
    const frozenMode = inputBaseline && (outer.hasInput || outer.keyboard);
    const wantsWide = frozenMode ? inputBaseline.wide : isHuntWideLayout(outer);
    if (!outer.hasInput && !outer.keyboard) inputBaseline = null;
    if (doc.hidden || entry.root?.hidden) { invalidateSample(); return; }
    let reference = references.get(entry.runtime);
    if (!reference) {
      // Source-owned bars must have already laid out the same actual legacy
      // field and the single Pixi renderer must agree on its logical dimensions.
      if (outer.hasInput || outer.keyboard || !entry.fontsReady
          || doc.fonts?.status === 'loading' || !entry.getViewport
          || doc.body.hasAttribute('data-hunt-wide')) { invalidateSample(); return; }
      const width = entry.host.clientWidth, height = entry.host.clientHeight;
      const stage = entry.getViewport();
      if (![width,height,stage?.width,stage?.height].every(positive)
          || Math.round(width) !== stage.width || Math.round(height) !== stage.height) {
        invalidateSample(); return;
      }
      // Direct landscape must still be the actual legacy portrait frame.
      if (outer.width > outer.height && !doc.body.hasAttribute('data-portrait-frame')) {
        invalidateSample(); return;
      }
      const sample = [width,height,outer.width,outer.height,
        doc.body.hasAttribute('data-portrait-frame'),
        doc.body.style.getPropertyValue('--cm-status-bar-height'),
        doc.body.style.getPropertyValue('--cm-toolbar-height')].join('|');
      if (entry.sample !== sample) { entry.sample = sample; schedule(); return; }
      reference = Object.freeze({ referenceWidth: stage.width, referenceHeight: stage.height });
      references.set(entry.runtime, reference);
      entry.sample = null;
    }
    setWide(wantsWide);
  }
  function schedule() {
    if (disposed || !active || scheduled !== null) return;
    scheduled = win.requestAnimationFrame(update);
  }
  function geometryChanged(event) {
    if (event?.type === 'focusin' && editing(doc.activeElement) && !inputBaseline) {
      inputBaseline = { width: win.innerWidth, height: win.innerHeight, wide };
    }
    // Includes orientation during measurement: never combine samples from two
    // outer viewports even if the legacy host happens to retain the same size.
    invalidateSample(); schedule();
  }
  function detach(entry) {
    if (!entry || entry !== active) return;
    entry.observer?.disconnect();
    entry.mutations?.disconnect();
    entry.signal?.removeEventListener('abort', entry.abort);
    active = null; serial++; inputBaseline = null; cancelFrame(); setWide(false);
  }
  win.addEventListener('resize', geometryChanged);
  win.visualViewport?.addEventListener('resize', geometryChanged);
  doc.addEventListener('focusin', geometryChanged);
  doc.addEventListener('focusout', geometryChanged);
  doc.addEventListener('visibilitychange', geometryChanged);
  doc.fonts?.addEventListener?.('loadingdone', geometryChanged);
  doc.fonts?.addEventListener?.('loadingerror', geometryChanged);
  return Object.freeze({
    attach({ host, runtime, signal }) {
      detach(active);
      if (!enabled || disposed || !host || !runtime || signal?.aborted) return Object.freeze({ setStage() {}, dispose() {} });
      const entry = { serial: ++serial, host, runtime, signal, root: host.closest?.('#cm-root'),
        sample: null, getViewport: null, fontsReady: !doc.fonts, observer: null, mutations: null, abort: null };
      active = entry;
      entry.abort = () => detach(entry);
      signal?.addEventListener('abort', entry.abort, { once: true });
      if (win.ResizeObserver) {
        entry.observer = new win.ResizeObserver(geometryChanged);
        entry.observer.observe(host);
      }
      if (win.MutationObserver) {
        entry.mutations = new win.MutationObserver(geometryChanged);
        entry.mutations.observe(doc.body, { attributes: true,
          attributeFilter: ['data-portrait-frame','data-status-bar','data-toolbar','style'] });
      }
      if (doc.fonts) {
        // A late resolution may qualify only this attached runtime. Legacy
        // remains playable while fonts load; no mount/ticker waits on this.
        Promise.resolve(doc.fonts.ready).then(() => {
          if (!current(entry)) return;
          entry.fontsReady = true; geometryChanged();
        }, () => { /* failed font qualification keeps the legacy path */ });
      }
      schedule();
      return Object.freeze({
        setStage(getViewport) { if (current(entry) && typeof getViewport === 'function') { entry.getViewport = getViewport; geometryChanged(); } },
        dispose() { detach(entry); }
      });
    },
    isWide() { return !!active && current(active) && !!references.get(active.runtime) && wide; },
    getLayout(runtime) {
      if (!active || !current(active) || runtime !== active.runtime) return null;
      const reference = references.get(runtime);
      return reference ? { mode: wide ? 'wide' : 'portrait', ...reference } : null;
    },
    getDiagnostics() {
      return Object.freeze({ attached: !!active, wide, reference: active ? references.get(active.runtime) ?? null : null,
        phase: !active ? 'DETACHED' : references.has(active.runtime) ? 'REFERENCE_LOCKED' : 'MEASURING_LEGACY' });
    },
    dispose() {
      if (disposed) return;
      detach(active); disposed = true;
      win.removeEventListener('resize', geometryChanged);
      win.visualViewport?.removeEventListener('resize', geometryChanged);
      doc.removeEventListener('focusin', geometryChanged);
      doc.removeEventListener('focusout', geometryChanged);
      doc.removeEventListener('visibilitychange', geometryChanged);
      doc.fonts?.removeEventListener?.('loadingdone', geometryChanged);
      doc.fonts?.removeEventListener?.('loadingerror', geometryChanged);
    }
  });
}
