// Honest progress for a screen that loads several things at once (2026-10-12).
//
// A ranch on a slow link used to say "正在載入牧場與夥伴…" and nothing else
// for a minute, which reads the same as a hang. This shows what is actually
// known and nothing more:
//   - steps complete only when their load resolves (no timers, no easing),
//     so the bar can sit still on a big step, and 100 % appears only when
//     every step is done;
//   - finished files are counted from two sources: the page's own requests
//     (Resource Timing) and every texture the shared Pixi asset scope loads,
//     because Pixi decodes images in a worker the page's timing cannot see.
//     Bytes are not shown: the worker's are invisible, so a byte figure would
//     undercount (2026-10-12, found on the live site);
//   - there is no total, because the loaders discover their files as they
//     go, so the bar measures steps and carries a moving sheen while a step
//     is running.
// It reuses the screen's own loads; it starts and owns no loading itself.

import { setLabel, setText } from '../text/uiText.js';

/**
 * Files that finish loading while this runs: the page's own requests and,
 * through `subscribeSettled`, the textures a worker fetched. A URL counts
 * once. Every finished file is also activity for a stall watchdog.
 * @returns {{ stop(): void, readonly files: number, readonly supported: boolean }}
 */
export function observeLoadActivity(onChange, { PerformanceObserverImpl = globalThis.PerformanceObserver, subscribeSettled = null } = {}) {
  const seen = new Set();
  let observer = null, unsubscribe = null;
  const finished = (url) => {
    if (url) { if (seen.has(url)) return; seen.add(url); }
    onChange?.(seen.size);
  };
  try {
    observer = new PerformanceObserverImpl((list) => { for (const entry of list.getEntries()) finished(entry.name); });
    observer.observe({ type: 'resource', buffered: false });
  } catch { observer = null; }
  try { unsubscribe = subscribeSettled?.(({ url }) => finished(url)) ?? null; } catch { unsubscribe = null; }
  return Object.freeze({
    stop() { observer?.disconnect(); observer = null; unsubscribe?.(); unsubscribe = null; },
    get files() { return seen.size; },
    get supported() { return observer !== null || unsubscribe !== null; }
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
  const files = doc.createElement('span');
  files.className = 'cm-load-progress__files';
  files.hidden = true;
  meta.append(count, files);
  const slow = doc.createElement('p');
  slow.className = 'cm-load-progress__slow';
  slow.hidden = true;
  setText(slow, 'LOAD_SLOW');
  root.append(bar, list, meta, slow);

  let fileCount = 0;
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
    files.hidden = !(fileCount > 0);
    if (fileCount > 0) setText(files, 'LOAD_FILES', { count: fileCount });
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
    reset() { fileCount = 0; slow.hidden = true; for (const item of items.values()) { item.dataset.state = 'pending'; item.removeAttribute('aria-current'); } paint(); },
    setFiles(total) { const next = Math.max(0, Math.floor(Number(total) || 0)); if (next !== fileCount) { fileCount = next; paint(); } },
    showSlow(show = true) { slow.hidden = !show; },
    state() { return root.dataset.state; }
  });
}
