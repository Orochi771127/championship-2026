// The ceremony layer: short, authored presentation moments laid over a screen
// (2026-10-15, OWNER_APPROVED_ADAPTATION of presentation).
//
// WHAT A CEREMONY IS
// ------------------
// A ceremony decorates a moment the game has ALREADY decided: a gate the app
// has entered, a catch already on the card, a result already settled, a title
// already recorded, a form the native lifecycle has already changed. It reads
// nothing but the data it is handed, writes no game state, and never delays a
// state change -- the screen underneath is live from the first frame.
//
// HOW IT RUNS
// -----------
// One DOM node per run. The choreography is CSS (ui/ceremony.css): every
// animated part's static style is its FINAL state and its keyframes only say
// where it comes from, so "settle" is simply `animation: none` -- skipping can
// never land in a half state. Timing is carried by animation-delay; the only
// timer is the one that ends the run. No requestAnimationFrame loop and no
// second ticker: the browser composites transforms and opacity on its own.
//
// TIERS (the design spec, docs/reports/ui-ceremony-2026-10-15/SPEC_ZH_TW.md)
//   toast    a confirmation over a live scene; never takes input.
//   reveal   a result on its own screen; a tap settles it.
//   moment   a milestone; takes the screen briefly, a tap settles, a second
//            tap (or the timer) dismisses.
//
// PLAYER SETTINGS
//   reduced motion  nothing travels, scales or spins: a 160 ms fade in and out.
//   saver quality   no particles, rays or blur; the same words, shorter.
//   hidden page     a run started or continuing in a background tab settles.

import { prefersReducedMotion, currentQualityTier } from "../presentationPreferences.js";
import { playCeremonyCue } from "./ceremonyAudio.js";

export const CEREMONY_TIERS = Object.freeze(["toast", "reveal", "moment"]);

/** Authored lengths in ms: full motion, then the saver tier. */
export const CEREMONY_TIMING = Object.freeze({
  "gate-entry": Object.freeze({ tier: "moment", full: 1500, saver: 900, minHold: 900 }),
  capture: Object.freeze({ tier: "toast", full: 1900, saver: 1400 }),
  "hunt-reward": Object.freeze({ tier: "reveal", full: 1400, saver: 700 }),
  medal: Object.freeze({ tier: "moment", full: 2600, saver: 1600 }),
  evolve: Object.freeze({ tier: "moment", full: 2800, saver: 2000 }),
  versus: Object.freeze({ tier: "toast", full: 1300, saver: 900 })
});
const REDUCED_MS = 160;
const EXIT_MS = 260;

let audioOutput = () => null;

/** main.js hands over the audio bus once; views never import the bus. */
export function configureCeremonyAudio(getOutput) {
  audioOutput = typeof getOutput === "function" ? getOutput : () => null;
}

/** One cue on the configured bus for pieces that run outside playCeremony. */
export function playCeremonySound(cue, doc = globalThis.document) {
  if (!cue || doc?.hidden || prefersReducedMotion(doc)) return null;
  try { return playCeremonyCue(cue, audioOutput()); } catch { return null; }
}

/** The resolved settings a run starts with (read once, at start). */
export function ceremonyEnvironment(doc = globalThis.document) {
  const reduced = prefersReducedMotion(doc);
  const quality = currentQualityTier(doc);
  return Object.freeze({ reduced, quality, motion: reduced ? "reduced" : quality === "saver" ? "saver" : "full" });
}

/**
 * Start a ceremony.
 *
 * @param {object} options
 * @param {HTMLElement} options.host      positioned element the overlay fills
 * @param {string} options.kind           a CEREMONY_TIMING key
 * @param {(stage: HTMLElement, env) => void} options.build  fills the stage
 * @param {string} [options.cue]          a CEREMONY_CUES name
 * @param {string} [options.label]        the words a screen reader hears
 * @param {boolean} [options.autoDismiss] end on the timer (toast/moment), default true
 * @param {() => void} [options.onDone]   called once, after the node is gone
 * @returns {{ settle(): boolean, dismiss(): void, dispose(): void, element: HTMLElement, done: Promise<object> }}
 */
export function playCeremony({ host, kind, build, cue = null, label = "", autoDismiss = true, onDone = null, doc = globalThis.document,
  setTimer = globalThis.setTimeout?.bind(globalThis), clearTimer = globalThis.clearTimeout?.bind(globalThis) }) {
  const timing = CEREMONY_TIMING[kind];
  if (!timing) throw new RangeError(`CEREMONY_KIND_${kind}`);
  if (!host || typeof build !== "function") throw new TypeError("A ceremony needs a host and a build function");
  const env = ceremonyEnvironment(doc);
  const lengthMs = env.reduced ? REDUCED_MS * 2 + 600 : env.quality === "saver" ? timing.saver : timing.full;
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();

  const element = doc.createElement("div");
  element.className = "cm-ceremony";
  element.dataset.kind = kind;
  element.dataset.tier = timing.tier;
  element.dataset.motion = env.motion;
  element.dataset.state = "playing";
  element.style.setProperty("--cer-length", `${lengthMs}ms`);
  if (timing.tier === "toast") element.setAttribute("aria-hidden", "true");
  const stage = doc.createElement("div");
  stage.className = "cm-ceremony__stage";
  element.append(stage);
  // A toast is announced by the screen's own live region; the others carry
  // their words for assistive technology here.
  if (label && timing.tier !== "toast") {
    const said = doc.createElement("p");
    said.className = "cm-visually-hidden";
    said.setAttribute("role", "status");
    said.textContent = label;
    element.append(said);
  }

  let phase = "playing", endTimer = null, exitTimer = null, sound = null, resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const summary = (skipped) => Object.freeze({ kind, motion: env.motion, lengthMs, skipped,
    elapsedMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started) });

  try { build(stage, env); } catch (error) {
    // A ceremony that cannot be built is simply not shown.
    console.warn("Ceremony unavailable", error);
    resolveDone(summary(true));
    onDone?.();
    return Object.freeze({ settle: () => false, dismiss() {}, dispose() {}, element, done });
  }
  host.append(element);
  if (cue && !env.reduced && !doc.hidden) { try { sound = playCeremonyCue(cue, audioOutput()); } catch { sound = null; } }

  function finish(skipped) {
    if (phase === "gone") return;
    phase = "gone";
    clearTimer?.(endTimer); clearTimer?.(exitTimer);
    endTimer = exitTimer = null;
    element.remove();
    doc.removeEventListener?.("visibilitychange", onVisibility);
    doc.removeEventListener?.("keydown", onKey, true);
    resolveDone(summary(skipped));
    onDone?.();
  }
  function dismiss(skipped = false) {
    if (phase === "gone" || phase === "leaving") return;
    phase = "leaving";
    element.dataset.state = "leaving";
    clearTimer?.(endTimer); endTimer = null;
    exitTimer = setTimer?.(() => finish(skipped), env.reduced ? REDUCED_MS : EXIT_MS);
  }
  /** Land on the final composition at once. Returns false if already settled. */
  function settle() {
    if (phase !== "playing") return false;
    phase = "settled";
    element.dataset.state = "settled";
    sound?.stop(); sound = null;
    return true;
  }
  function onVisibility() {
    if (!doc.hidden) return;
    settle();
    if (autoDismiss) dismiss(true);
    else { clearTimer?.(endTimer); endTimer = null; }
  }
  doc.addEventListener?.("visibilitychange", onVisibility);

  function onKey(event) {
    if (event.key !== "Escape" || phase === "gone") return;
    event.stopPropagation();
    if (!settle()) dismiss(true);
  }
  if (timing.tier !== "toast") {
    // First tap settles; on a moment a second tap dismisses. Escape does the
    // same for a keyboard, without stealing Enter from a focused button.
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!settle() && timing.tier === "moment") dismiss(true);
    });
    doc.addEventListener?.("keydown", onKey, true);
  }
  if (autoDismiss) endTimer = setTimer?.(() => { settle(); dismiss(false); }, lengthMs);
  else endTimer = setTimer?.(() => { if (phase === "playing") { phase = "settled"; element.dataset.state = "settled"; } }, lengthMs);
  // A field may finish loading while the tab is already hidden. No new
  // visibility event is guaranteed; apply the same idempotent policy now.
  if (doc.hidden) onVisibility();

  return Object.freeze({
    element, done, settle,
    dismiss: () => dismiss(true),
    /** Remove immediately (the screen is going away). */
    dispose() { sound?.stop(); sound = null; finish(true); }
  });
}

/** Small DOM helper for builders: an element with a class and optional text. */
export function ceremonyNode(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** Decorative particles: N spans with a per-index angle the CSS reads. */
export function appendCeremonySparks(doc, parent, count, className = "cm-ceremony__spark") {
  for (let index = 0; index < count; index += 1) {
    const spark = doc.createElement("i");
    spark.className = className;
    spark.style.setProperty("--i", String(index));
    spark.style.setProperty("--n", String(count));
    parent.append(spark);
  }
}

/**
 * A reveal on a screen's own elements (the screen IS the result, so nothing is
 * laid over it). Sets data-reveal="playing" on `root` -- ceremony.css staggers
 * the marked parts in from there -- then "settled" on the timer or at the first
 * tap. The tap that settles is not passed on, so it cannot press a button that
 * was still flying in; once settled the screen takes input as usual.
 * Returns { settle(), dispose(), done }.
 */
export function playReveal({ root, kind, cue = null, doc = globalThis.document,
  setTimer = globalThis.setTimeout?.bind(globalThis), clearTimer = globalThis.clearTimeout?.bind(globalThis) }) {
  const timing = CEREMONY_TIMING[kind];
  if (!timing) throw new RangeError(`CEREMONY_KIND_${kind}`);
  const env = ceremonyEnvironment(doc);
  const lengthMs = env.reduced ? REDUCED_MS : env.quality === "saver" ? timing.saver : timing.full;
  root.dataset.reveal = "playing";
  root.dataset.revealKind = kind;
  root.dataset.revealMotion = env.motion;
  root.style.setProperty("--cer-length", `${lengthMs}ms`);
  let sound = null, timer = null, settled = false, resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  if (cue && !env.reduced && !doc.hidden) { try { sound = playCeremonyCue(cue, audioOutput()); } catch { sound = null; } }
  function settle(skipped = true) {
    if (settled) return false;
    settled = true;
    clearTimer?.(timer); timer = null;
    root.dataset.reveal = "settled";
    root.removeEventListener("pointerdown", onTap, true);
    doc.removeEventListener?.("visibilitychange", onVisibility);
    resolveDone(Object.freeze({ kind, motion: env.motion, lengthMs, skipped }));
    return true;
  }
  // The click that follows the settling tap is swallowed as well.
  let swallowUntil = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  function onTap(event) {
    if (settled) return;
    event.preventDefault();
    event.stopPropagation();
    swallowUntil = now() + 450;
    settle(true);
  }
  function onClick(event) {
    if (now() > swallowUntil) { root.removeEventListener("click", onClick, true); return; }
    event.preventDefault();
    event.stopPropagation();
  }
  function onVisibility() { if (doc.hidden) settle(true); }
  root.addEventListener("pointerdown", onTap, true);
  root.addEventListener("click", onClick, true);
  doc.addEventListener?.("visibilitychange", onVisibility);
  // Reduced motion: nothing travels, so the screen is simply already there.
  if (doc.hidden) settle(true);
  else if (env.reduced) settle(false);
  else timer = setTimer?.(() => settle(false), lengthMs);
  return Object.freeze({ settle: () => settle(true), done,
    dispose() { sound?.stop(); sound = null; settle(true); root.removeEventListener("click", onClick, true); } });
}
