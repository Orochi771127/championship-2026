// Championship Modern -- standalone presentation/message adapter.
//
// The Raising Home runtime and its R2 presentation are shared with the frozen
// research build, and they speak research language: "this JavaScript realm's
// Championship R2 save", "CHAMPIONSHIP R2". Both are accurate there and wrong
// in a shipped product, where the save really does survive a reload and the
// player is not looking at an R2 candidate.
//
// This adapter changes ONLY what the player reads. No runtime state, no status
// phase, no save code, and no shared module is modified: research and R2
// behaviour stay byte- and semantically identical.

export const STANDALONE_BRAND_EYEBROW = "DIGIMON CHAMPIONSHIP · 2026";

/** Research copy -> product copy. Keyed on the exact shared string, so if the
 *  shared string ever changes the override stops applying rather than silently
 *  rewriting some other message. */
export const STANDALONE_FEEDBACK_COPY = Object.freeze({
  "Raising Home state restored from this JavaScript realm's Championship R2 save.":
    "Saved game restored.",
  // The player has no avatar and no grid, so nothing may invite them to walk one.
  "The Raising Home is awake. Move through the grid and listen before acting.":
    "Raising Home is ready. Tap a creature to look after them.",
  "You move one tile through the Raising Home.": "",
  "A habitat boundary blocks that step.": ""
});

// Messages built around a creature's name cannot be matched exactly. These
// rewrite the navigation wording while keeping who the message is about.
const PATTERNED_COPY = Object.freeze([
  [/^Move within two tiles before offering care to (.+)\.$/, "$1 is not ready for that just now."]
]);

export function adaptFeedback(text) {
  if (typeof text !== "string") return text;
  const exact = STANDALONE_FEEDBACK_COPY[text];
  if (exact !== undefined) return exact;
  for (const [pattern, replacement] of PATTERNED_COPY) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

// Snapshots are frozen and are re-read on every render. Caching keeps the
// adapted object identity stable per source snapshot, so a consumer that
// compares snapshots by reference still sees one object per state.
const ADAPTED = new WeakMap();

export function adaptSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const adapted = adaptFeedback(snapshot.feedback);
  if (adapted === snapshot.feedback) return snapshot;
  const cached = ADAPTED.get(snapshot);
  if (cached) return cached;
  const next = Object.freeze({ ...snapshot, feedback: adapted });
  ADAPTED.set(snapshot, next);
  return next;
}

/** Wrap a runtime facade so every snapshot the view receives -- whether pulled
 *  via getSnapshot() or pushed through subscribe() -- carries product copy. */
export function adaptRuntimeFacade(facade) {
  return Object.freeze({
    getSnapshot: () => adaptSnapshot(facade.getSnapshot()),
    dispatch: (command) => facade.dispatch(command),
    subscribe: (listener) => facade.subscribe((snapshot) => listener(adaptSnapshot(snapshot)))
  });
}

/** Replace the shared R2 identity label after mount. The shared view builds it
 *  once and never re-renders it, so this holds for the life of the mount. */
export function applyStandaloneBranding(root) {
  const eyebrow = root?.querySelector?.(".r2-eyebrow");
  if (eyebrow) eyebrow.textContent = STANDALONE_BRAND_EYEBROW;
  return eyebrow !== null && eyebrow !== undefined;
}
