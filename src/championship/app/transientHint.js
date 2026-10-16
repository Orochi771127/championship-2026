import { prefersReducedMotion } from '../presentation/presentationPreferences.js';

// OWNER_APPROVED_ADAPTATION 2026-10-16: presentation-only, never a tool or
// simulation deadline. A new show invalidates both timers from the old hint.
export const HINT_FADE_MS = 300;
export const TOOL_HINT_MS = 2000;
export const RAISING_HINT_SEEN_KEY = 'championship-2026.ui.raising-hint-seen.v1';
let seenThisSession = false;

/** A browser UI preference, separate from the canonical gameplay save.
 * Storage failure degrades to session memory; it never blocks entering play. */
export function consumeRaisingHintDuration() {
  let storage;
  let seen = seenThisSession;
  try { storage = globalThis.localStorage; seen ||= storage?.getItem(RAISING_HINT_SEEN_KEY) === '1'; } catch { /* denied storage */ }
  seenThisSession = true;
  try { storage?.setItem(RAISING_HINT_SEEN_KEY, '1'); } catch { /* session fallback */ }
  return seen ? 3000 : 5000;
}

export function createTransientHint(element, {
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout,
  reducedMotion = () => prefersReducedMotion(element.ownerDocument), beforeHide = () => {}, onPhaseChange = () => {}
} = {}) {
  let holdTimer = null, fadeTimer = null, generation = 0, disposed = false;
  const phase = value => { element.dataset.hintPhase = value; onPhaseChange(value); };
  function cancel() {
    generation += 1;
    clearTimer(holdTimer); clearTimer(fadeTimer);
    holdTimer = fadeTimer = null;
  }
  function hide() {
    cancel();
    if (!element.hidden) beforeHide();
    element.hidden = true; element.inert = true; phase('hidden');
  }
  hide();
  return Object.freeze({
    show(holdMs) {
      if (disposed) return;
      cancel();
      const owner = generation;
      element.hidden = false; element.inert = false; phase('visible');
      holdTimer = setTimer(() => {
        if (disposed || owner !== generation) return;
        holdTimer = null;
        beforeHide();
        element.inert = true;
        if (reducedMotion()) { hide(); return; }
        phase('fading');
        fadeTimer = setTimer(() => { if (!disposed && owner === generation) hide(); }, HINT_FADE_MS);
      }, holdMs);
    },
    hide,
    dispose() { if (disposed) return; hide(); disposed = true; }
  });
}
