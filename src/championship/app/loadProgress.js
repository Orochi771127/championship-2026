// Honest progress for a screen that loads several things at once (2026-10-12).
//
// A ranch on a slow link used to say "正在載入牧場與夥伴…" and nothing else
// for a minute, which reads the same as a hang. This shows what is actually
// known and nothing more:
//   - steps complete only when their load resolves (no timers, no easing),
//     so the bar can sit still on a big step, and 100 % appears only when
//     every step is done;
//   - downloaded bytes are the network bytes the browser reports for each
//     finished request (Resource Timing); a cached file adds nothing;
//   - there is no total byte figure, because the loaders discover their files
//     as they go, so the bar measures steps and carries a moving sheen while
//     a step is running.
// It reuses the screen's own loads; it starts and owns no loading itself.

import { setLabel, setText } from '../text/uiText.js';

/** "1.2 MB" / "640 KB"; kilobytes never show as zero once something arrived. */
export function formatLoadBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value >= 1048576) return `${(value / 1048576).toFixed(1)} MB`;
  return `${value > 0 ? Math.max(1, Math.round(value / 1024)) : 0} KB`;
}

/**
 * Network bytes of requests that finish while this runs. Every finished
 * request (cached or not) also counts as activity for a stall watchdog.
 * @returns {{ stop(): void, readonly total: number, readonly supported: boolean }}
 */
export function observeDownloadedBytes(onChange, { PerformanceObserverImpl = globalThis.PerformanceObserver } = {}) {
  let total = 0, observer = null;
  try {
    observer = new PerformanceObserverImpl((list) => {
      for (const entry of list.getEntries()) {
        // transferSize 0 is a cache hit (or no timing access): nothing crossed the network.
        if (entry.transferSize > 0) total += entry.encodedBodySize > 0 ? entry.encodedBodySize : entry.transferSize;
        onChange?.(total, entry);
      }
    });
    observer.observe({ type: 'resource', buffered: false });
  } catch { observer = null; }
  return Object.freeze({
    stop() { observer?.disconnect(); observer = null; },
    get total() { return total; },
    get supported() { return observer !== null; }
  });
}

/**
 * @param {object} options
 * @param {Array<{id: string, key: string}>} options.steps in display order
 * @param {Document} [options.doc]
 */
export function createLoadProgressView({ steps, doc = globalThis.document }) {
  if (!Array.isArray(steps) || steps.length === 0) throw new TypeError('createLoadProgressView needs steps');
  const root = doc.createElement('div');
  root.className = 'cm-load-progress';
  const bar = doc.createElement('div');
  bar.className = 'cm-load-progress__bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  setLabel(bar, 'aria-label', 'LOAD_PROGRESS_LABEL');
  const fill = doc.createElement('span');
  fill.className = 'cm-load-progress__fill';
  bar.append(fill);
  const list = doc.createElement('ol');
  list.className = 'cm-load-progress__steps';
  const items = new Map();
  for (const step of steps) {
    const item = doc.createElement('li');
    item.className = 'cm-load-progress__step';
    item.dataset.step = step.id;
    item.dataset.state = 'pending';
    setText(item, step.key);
    items.set(step.id, item);
    list.append(item);
  }
  const meta = doc.createElement('p');
  meta.className = 'cm-load-progress__meta';
  const count = doc.createElement('span');
  const bytes = doc.createElement('span');
  bytes.className = 'cm-load-progress__bytes';
  bytes.hidden = true;
  meta.append(count, bytes);
  const slow = doc.createElement('p');
  slow.className = 'cm-load-progress__slow';
  slow.hidden = true;
  setText(slow, 'LOAD_SLOW');
  root.append(bar, list, meta, slow);

  let byteTotal = 0;
  function paint() {
    const states = [...items.values()].map((item) => item.dataset.state);
    const done = states.filter((state) => state === 'done').length;
    const percent = Math.round(done / items.size * 100);
    fill.style.width = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
    bar.dataset.running = String(states.includes('active'));
    bar.dataset.failed = String(states.includes('error'));
    root.dataset.state = states.includes('error') ? 'error' : done === items.size ? 'done' : 'loading';
    setText(count, 'LOAD_PROGRESS_STEPS', { done, total: items.size });
    bytes.hidden = !(byteTotal > 0);
    if (byteTotal > 0) setText(bytes, 'LOAD_BYTES', { size: formatLoadBytes(byteTotal) });
  }
  function set(id, state) {
    const item = items.get(id);
    if (!item || item.dataset.state === state) return;
    item.dataset.state = state;
    if (state === 'active') item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    paint();
  }
  paint();
  return Object.freeze({
    element: root,
    start(id) { set(id, 'active'); },
    done(id) { set(id, 'done'); },
    /** Mark every unfinished step failed (the load as a whole stopped). */
    fail() { slow.hidden = true; for (const [id, item] of items) if (item.dataset.state !== 'done') set(id, item.dataset.state === 'active' ? 'error' : 'pending'); },
    reset() { byteTotal = 0; slow.hidden = true; for (const item of items.values()) { item.dataset.state = 'pending'; item.removeAttribute('aria-current'); } paint(); },
    setBytes(total) { const next = Math.max(0, Number(total) || 0); if (next !== byteTotal) { byteTotal = next; paint(); } },
    showSlow(show = true) { slow.hidden = !show; },
    state() { return root.dataset.state; }
  });
}
