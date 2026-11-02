// Ai-chan (愛醬 / アイちゃん / Ai-chan): the one onboarding guide, Owner-approved
// 2026-11-02 (layered v3 package, archived 2026-11-03). She is one character in
// two interchangeable forms; the story and every tutorial lesson are identical
// in both. This module owns only her pictures and the player's form choice as a
// presentation value; the choice itself is stored by the existing preference
// store (preferenceSchema `guideAppearance`), never by the game save.
//
// The portraits are the approved closed-mouth idle stills, used unchanged: no
// mouth or blink cycles, no pose carousel, no floating. Each sits on its own
// fixed canvas and is shown through a fixed CSS window, so the anchor is data:
//   half   the half-body window (width : height = 1 : 0.815, timeline.json),
//          top-aligned; catgirl is raised 14% of the window height (timeline
//          `catgirlImageTop`). The window ends above the cat's paws.
//   avatar a square face window (cx, cy, size in source pixels) for the
//          tutorial strip and dialogs.

export const AI_CHAN_APPEARANCES = Object.freeze(["cat", "catgirl"]);
export const AI_CHAN_DEFAULT_APPEARANCE = "cat";

const BASE = "assets/production/opening/ai-chan-layered-v3-20261103/";
export const AI_CHAN_PORTRAITS = Object.freeze({
  cat: Object.freeze({ src: BASE + "cat_idle.webp", width: 716, height: 768, halfTopPercent: 0, face: Object.freeze({ cx: 380, cy: 215, size: 300 }) }),
  catgirl: Object.freeze({ src: BASE + "catgirl_idle.webp", width: 631, height: 768, halfTopPercent: -14, face: Object.freeze({ cx: 318, cy: 212, size: 230 }) })
});
/** Width : height of the half-body window. */
export const AI_CHAN_HALF_WINDOW = Object.freeze({ width: 1, height: 0.815 });

/** A stored or requested form, made safe: anything unknown is the default cat. */
export function resolveGuideAppearance(value) {
  return AI_CHAN_APPEARANCES.includes(value) ? value : AI_CHAN_DEFAULT_APPEARANCE;
}

/**
 * The lowest source row a half-body window shows, for a portrait drawn at the
 * window's width. Used by tests to prove the cat's paws stay outside it.
 */
export function halfWindowBottomRow(appearance) {
  const art = AI_CHAN_PORTRAITS[resolveGuideAppearance(appearance)];
  const windowHeight = AI_CHAN_HALF_WINDOW.height / AI_CHAN_HALF_WINDOW.width * art.width;
  const offset = -art.halfTopPercent / 100 * windowHeight;
  return Math.round(offset + windowHeight);
}

// The current form, published like the locale: main.js feeds it from the
// preference store; the tutorial guide and the story read and follow it.
let current = AI_CHAN_DEFAULT_APPEARANCE;
const listeners = new Set();
export function getGuideAppearance() { return current; }
export function setGuideAppearance(value) {
  const next = resolveGuideAppearance(value);
  if (next === current) return false;
  current = next;
  for (const listener of [...listeners]) listener(current);
  return true;
}
export function onGuideAppearanceChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Ai-chan's picture. Both forms are mounted at once and the visible one is a
 * data attribute, so a form change is an instant (or, with motion, a short
 * opacity) swap with no reload and no flash. A picture that cannot load hides
 * itself and leaves the name chip, so the guide is never an empty frame.
 *
 * mode   "half" | "avatar"
 * label  (form) => accessible name, or null for a decorative copy
 * name   text of the plate shown if the picture cannot load
 */
export function createAiChanPortrait({ doc = globalThis.document, mode = "half", appearance = current, label = null, name = "AI" } = {}) {
  const root = doc.createElement("span");
  root.className = `cm-ai-chan cm-ai-chan--${mode === "avatar" ? "avatar" : "half"}`;
  root.dataset.aiChan = mode === "avatar" ? "avatar" : "half";
  const fallback = doc.createElement("span");
  fallback.className = "cm-ai-chan__fallback";
  fallback.setAttribute("aria-hidden", "true");
  fallback.textContent = name;
  root.append(fallback);
  const images = {};
  for (const form of AI_CHAN_APPEARANCES) {
    const art = AI_CHAN_PORTRAITS[form], img = doc.createElement("img");
    img.className = "cm-ai-chan__img";
    img.dataset.form = form;
    img.src = art.src; img.width = art.width; img.height = art.height;
    img.alt = ""; img.decoding = "async"; img.draggable = false;
    if (mode === "avatar") {
      // Square window on the face: scale so `size` source px fill the window.
      const scale = 100 / art.face.size;
      img.style.width = `${art.width * scale}%`;
      img.style.left = `${-(art.face.cx - art.face.size / 2) * scale}%`;
      img.style.top = `${-(art.face.cy - art.face.size / 2) * scale}%`;
    } else img.style.top = `${art.halfTopPercent}%`;
    img.addEventListener("error", () => { img.dataset.failed = "true"; sync(); });
    img.addEventListener("load", () => { delete img.dataset.failed; sync(); });
    images[form] = img;
    root.append(img);
  }
  let form = resolveGuideAppearance(appearance);
  function sync() {
    root.dataset.appearance = form;
    root.dataset.failed = String(images[form].dataset.failed === "true");
    if (label) { root.setAttribute("role", "img"); root.setAttribute("aria-label", label(form)); }
    else root.setAttribute("aria-hidden", "true");
  }
  sync();
  return Object.freeze({
    root,
    get appearance() { return form; },
    setAppearance(next) { form = resolveGuideAppearance(next); sync(); }
  });
}
