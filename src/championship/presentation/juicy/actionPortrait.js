// A partner shown by its own action animation (Owner 2026-11-12: 「圖鑑插畫就請讓他
// 出現在圖鑑就好 ... 其他都可以用成角色的動作動畫」).
//
// The Database illustration belongs to the Database. Every other screen that
// shows a partner -- ranch card, battle rosters and HUD, cut-ins, partner list,
// Data Arena, story cast, hunt and evolution moments -- stands the character's
// own animated body in a box instead: the same reviewed / public runtime frames
// the ranch, the battle and the Dex showcase play (spriteMotionPlayer.js), so
// a partner looks the same everywhere it moves.
//
// DOM + Web Animations only: no canvas, no WebGL, no extra Pixi texture, so it
// costs nothing from the shared stage's GPU budget. A box that is not on screen
// does not load until it is (IntersectionObserver); a list of thirty partners
// fetches only what is seen. `still` holds the first idle cell (long lists);
// otherwise the idle loops. A species without in-game motion here leaves the
// box empty (data-state="none"), never an illustration.
import { createSpriteMotion, loadShowcaseMotionShared, showcaseMotionAvailable, showcaseSpeciesId } from "./spriteMotionPlayer.js";

/** Native idle; the ids are the Data Arena's audited showcase sequences. */
export const ACTION_PORTRAIT_SEQUENCES = Object.freeze({ idle: 0, walk: 2, attack: 7, cheer: 33 });

/**
 * The box a body is fitted into: the full width, the height above the feet,
 * with a small floor under the feet. `crop` > 1 enlarges past the box (a
 * close-up whose feet fall below it, such as a cut-in's upper body).
 */
export function actionPortraitFit(motion, { width, height, floor = 0.06, crop = 1, fill = 0.9 }) {
  const b = motion.bounds, usable = Math.max(1, height * (1 - floor));
  // A portrait fills its box: the drawn body's own width and height (not the turn-around room
  // the showcase keeps), so a small partner is as big in its frame as a large one.
  const across = Math.max(1, b.right - b.left), up = Math.max(1, -b.top);
  let scale = Math.min(width * fill / across, usable * fill / up) * crop;
  // Pixel art scales by whole screen pixels per native pixel (art production rule); a box smaller
  // than the native body draws it reduced instead.
  const density = Math.max(1, motion.density || 1), native = scale * density;
  if (native >= 1) scale = Math.floor(native) / density;
  const body = up * scale;
  // A close-up keeps the head just under the top edge and lets the feet fall below the box.
  return { scale, footY: crop > 1 ? height * 0.96 - body : height * floor, centerX: -(b.left + b.right) / 2 * scale };
}

/**
 * @param {object} options
 * @param {Document} [options.doc]
 * @param {string|number} options.species  `species-054`, a creature id ending in it, or 54
 * @param {number} [options.width]   CSS px; measured from the element when left out
 * @param {number} [options.height]
 * @param {number} [options.sequence]  native sequence to loop (idle by default)
 * @param {boolean} [options.still]   hold the first cell (lists)
 * @param {number} [options.crop]     > 1 for an upper-body close-up
 * @param {string} [options.className] extra class for the host's own layout
 */
export function createActionPortrait({ doc = globalThis.document, species, width = null, height = null, sequence = ACTION_PORTRAIT_SEQUENCES.idle,
  still = false, crop = 1, floor = 0.06, facing = -1, reducedMotion = false, baseUrl = globalThis.location?.href, className = "", lazy = true } = {}) {
  const element = doc.createElement("div");
  element.className = `cm-action-portrait${className ? ` ${className}` : ""}`;
  element.setAttribute("aria-hidden", "true");
  const speciesId = showcaseSpeciesId(typeof species === "string" ? (/species-\d+$/.exec(species)?.[0] ?? species) : species);
  element.dataset.species = speciesId ?? "";
  if (Number.isFinite(width)) element.style.width = `${width}px`;
  if (Number.isFinite(height)) element.style.height = `${height}px`;
  let sprite = null, disposed = false, observer = null, started = false, current = sequence;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const available = Boolean(speciesId) && showcaseMotionAvailable(speciesId, baseUrl);
  element.dataset.state = available ? "waiting" : "none";
  if (!available) resolveReady(false);

  function measure() {
    // Layout size: a box inside a sliding, rotated strip still measures as laid out.
    const rect = element.getBoundingClientRect?.(), w = element.offsetWidth || rect?.width, h = element.offsetHeight || rect?.height;
    return { width: Number.isFinite(width) ? width : Math.max(16, w || 64), height: Number.isFinite(height) ? height : Math.max(16, h || 64) };
  }
  async function start() {
    if (started || disposed || !available) return;
    started = true;
    element.dataset.state = "loading";
    try {
      const motion = await loadShowcaseMotionShared(speciesId, { baseUrl });
      if (disposed) return;
      const box = measure(), fit = actionPortraitFit(motion, { ...box, floor, crop });
      sprite = createSpriteMotion({ doc, motion, scale: fit.scale, reducedMotion: reducedMotion || still, grounded: true });
      sprite.element.style.setProperty("--foot-y", `${Math.round(fit.footY * 100) / 100}px`);
      // Centre the drawn body, not the foot: a long tail or a raised arm no longer pushes it off the frame.
      sprite.element.style.setProperty("--foot-x", `calc(50% + ${Math.round(fit.centerX * (facing > 0 ? -1 : 1) * 100) / 100}px)`);
      sprite.setFacing(facing);
      sprite.play(current);
      element.replaceChildren(sprite.element);
      element.dataset.state = "ready";
      resolveReady(true);
    } catch {
      if (disposed) return;
      element.dataset.state = "none";
      resolveReady(false);
    }
  }
  if (available) {
    const IO = globalThis.IntersectionObserver;
    if (lazy && typeof IO === "function") {
      observer = new IO(entries => { if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); observer = null; void start(); } }, { rootMargin: "120px" });
      observer.observe(element);
    } else queueMicrotask(() => { void start(); });
  }
  return Object.freeze({
    element, ready, speciesId,
    /** Start now (a box shown before it is laid out, e.g. inside an animation). */
    load: () => start(),
    /** Loop another native sequence (falls back to idle when the set has none). */
    play(next, options) { current = next; return sprite ? sprite.play(next, options) : false; },
    setFacing: value => sprite?.setFacing(value),
    pause: () => sprite?.pause(),
    resume: () => sprite?.resume(),
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect(); observer = null;
      sprite?.dispose(); sprite = null;
      element.remove();
      resolveReady(false);
    }
  });
}

/**
 * Put a partner's action portrait into `slot`, replacing what is there, and
 * keep one per slot: calling again with the same species keeps the running one.
 * Returns the portrait (or null when `species` is empty).
 */
const slotPortraits = new WeakMap();
export function setActionPortrait(slot, species, options = {}) {
  if (!slot) return null;
  const previous = slotPortraits.get(slot);
  const speciesId = species === null || species === undefined || species === "" ? null
    : showcaseSpeciesId(typeof species === "string" ? (/species-\d+$/.exec(species)?.[0] ?? species) : species);
  if (previous && previous.speciesId === speciesId && previous.element.parentNode === slot) return previous;
  previous?.dispose();
  slotPortraits.delete(slot);
  if (!speciesId) { slot.dataset.portrait = "none"; return null; }
  const portrait = createActionPortrait({ doc: slot.ownerDocument ?? globalThis.document, species: speciesId, ...options });
  slot.replaceChildren(portrait.element);
  slot.dataset.portrait = "action";
  slotPortraits.set(slot, portrait);
  return portrait;
}
/**
 * Load the motion records of these species ahead (a battle's six fighters), so
 * a cut-in or a card that appears later draws its body in the same frame.
 */
export function warmActionPortraits(species, { baseUrl = globalThis.location?.href } = {}) {
  for (const ref of species ?? []) {
    const speciesId = showcaseSpeciesId(typeof ref === "string" ? (/species-\d+$/.exec(ref)?.[0] ?? ref) : ref);
    if (speciesId && showcaseMotionAvailable(speciesId, baseUrl)) void loadShowcaseMotionShared(speciesId, { baseUrl }).catch(() => {});
  }
}

/** Release the portrait setActionPortrait put in `slot`. */
export function clearActionPortrait(slot) {
  const previous = slot ? slotPortraits.get(slot) : null;
  previous?.dispose();
  if (slot) slotPortraits.delete(slot);
}
