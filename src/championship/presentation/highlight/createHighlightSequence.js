// The important-highlight template: one sequence, five phases, any real event.
//
// The caller supplies the settled figure to count to, the plate the reveal
// lands on (focus) and, optionally, where the hero of the moment stands
// (anchor); the template supplies the choreography. It is driven only by the
// injected ticker -- the one Championship Pixi ticker -- so it pauses with the
// page and never starts a second animation loop. Presentation only: it reads
// numbers it is given and writes nothing back.
//
// Composition (settings round, 2026-09-29): two layers around the plate.
//   back  (z 1, under the plate): scrim, light column, stair marks, ring and
//         the bounded Three.js shards. Everything that moves stays behind the
//         words, so no particle can cover the verdict or the amount.
//   front (z 3, over the plate):  the burst flash (it fades before the plate
//         lands) and the skip hint; it also takes the tap that skips.
// The light column, the ring, the burst and the scrim's clear centre all sit
// on the anchor -- the characters -- rather than on the plate, so the light
// falls where the winners stand and the plate lands above them.

import { HIGHLIGHT_PHASES, countUpValue, phaseAt, phaseStartMs, resolveHighlightTiming } from "./highlightTimeline.js";

const FRAME_SAMPLE_CAP = 900;

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

export function createHighlightSequence({
  host,
  focus = null,
  anchor = null,
  ticker,
  target = 0,
  timing: overrides = {},
  reducedMotion = false,
  decor = "full",
  shardLife = 1,
  burstPixelRatio = null,
  burstAntialias = false,
  audio = null,
  mountBurst = null,
  onPhase = null,
  onValue = null,
  skipLabel = "輕觸畫面略過"
}) {
  if (!host?.ownerDocument) throw new TypeError("HIGHLIGHT_HOST_REQUIRED");
  if (typeof ticker?.add !== "function" || typeof ticker?.remove !== "function") throw new TypeError("HIGHLIGHT_TICKER_REQUIRED");
  if (!Number.isSafeInteger(target) || target < 0) throw new RangeError("HIGHLIGHT_TARGET");
  const timing = resolveHighlightTiming(overrides, { reducedMotion });
  const doc = host.ownerDocument;
  const node = (tag, className) => { const element = doc.createElement(tag); if (className) element.className = className; return element; };

  const layer = node("div", "cm-highlight");
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.motion = timing.reducedMotion ? "reduced" : "full";
  layer.dataset.decor = decor === "minimal" ? "minimal" : "full";
  layer.dataset.lit = "0";
  const front = node("div", "cm-highlight-front");
  front.setAttribute("aria-hidden", "true");
  front.dataset.motion = layer.dataset.motion;
  for (const [name, value] of [["prepare", timing.prepareMs], ["build", timing.buildMs], ["charge", timing.chargeMs], ["burst", timing.burstMs], ["reveal", timing.revealMs]]) {
    layer.style.setProperty(`--hl-${name}`, `${value}ms`);
    front.style.setProperty(`--hl-${name}`, `${value}ms`);
  }
  const stairs = node("div", "cm-highlight__stairs");
  for (let index = 0; index < timing.stairSteps; index += 1) {
    const mark = node("i", "cm-highlight__stair");
    mark.style.setProperty("--i", String(index));
    stairs.append(mark);
  }
  const hint = node("p", "cm-highlight__hint");
  hint.textContent = skipLabel;
  layer.append(node("div", "cm-highlight__scrim"), node("div", "cm-highlight__beam"), stairs, node("div", "cm-highlight__ring"));
  front.append(node("div", "cm-highlight__flash"), hint);
  host.append(layer, front);

  // Two points, as fractions of the host: the plate's centre (where the
  // figure is read) and the anchor (where the light and the burst go).
  let focusPoint = { x: 0.5, y: 0.4 };
  let anchorPoint = { x: 0.5, y: 0.4 };
  function measureFocus() {
    const box = host.getBoundingClientRect();
    const plate = focus?.getBoundingClientRect?.();
    if (plate && box.width > 0 && box.height > 0 && plate.height > 0) {
      focusPoint = { x: (plate.left + plate.width / 2 - box.left) / box.width, y: (plate.top + Math.min(plate.height, 120) / 2 - box.top) / box.height };
    }
    let given = null;
    try { given = typeof anchor === "function" ? anchor() : null; } catch { given = null; }
    anchorPoint = given && Number.isFinite(given.x) && Number.isFinite(given.y)
      ? { x: Math.min(1, Math.max(0, given.x)), y: Math.min(1, Math.max(0, given.y)) }
      : focusPoint;
    for (const target of [layer, front]) {
      target.style.setProperty("--hl-fx", `${(focusPoint.x * 100).toFixed(2)}%`);
      target.style.setProperty("--hl-fy", `${(focusPoint.y * 100).toFixed(2)}%`);
      target.style.setProperty("--hl-ax", `${(anchorPoint.x * 100).toFixed(2)}%`);
      target.style.setProperty("--hl-ay", `${(anchorPoint.y * 100).toFixed(2)}%`);
    }
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measureFocus) : null;
  observer?.observe(host);
  measureFocus();

  let burst = null, burstFailed = false, disposed = false, burstStats = null;
  if (typeof mountBurst === "function" && !timing.reducedMotion && timing.particleCount > 0) {
    Promise.resolve()
      .then(() => mountBurst({ host: layer, count: timing.particleCount, focus: () => anchorPoint, lifeScale: shardLife,
        ...(burstPixelRatio ? { pixelRatio: burstPixelRatio } : {}), antialias: burstAntialias === true }))
      .then((mounted) => {
        if (disposed) { mounted?.dispose?.(); return; }
        burst = mounted ?? null;
        // A late mount joins the phase already running.
        if (burst && phase === "CHARGE") burst.converge(Math.max(0, timing.chargeMs - (elapsed - phaseStartMs("CHARGE", timing))));
        else if (burst && (phase === "BURST" || phase === "REVEAL")) burst.burst();
      })
      .catch(() => { burstFailed = true; });
  }

  const spans = [timing.prepareMs, timing.buildMs, timing.chargeMs, timing.burstMs, timing.revealMs];
  let elapsed = 0, phase = null, running = false, finished = false, skipped = false;
  let lit = 0, shownValue = -1, ticks = 0, revealStart = phaseStartMs("REVEAL", timing);
  const frameTimes = [];
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });

  function setPhase(next) {
    layer.dataset.phase = next;
    front.dataset.phase = next;
  }

  function enter(next) {
    phase = next;
    // The characters may have finished loading since the last phase.
    measureFocus();
    setPhase(next);
    onPhase?.(next);
    if (next === "PREPARE") audio?.cue("prepare", timing.prepareMs);
    if (next === "CHARGE") { audio?.cue("charge", timing.chargeMs); burst?.converge(timing.chargeMs); }
    if (next === "BURST") { audio?.cue("burst"); burst?.burst(); }
  }

  function showValue(value) {
    if (value === shownValue) return;
    const previous = shownValue;
    shownValue = value;
    onValue?.(value);
    // One tick per visible step, but never more than tickLimit in a count.
    if (!skipped && previous >= 0 && value < target && ticks < timing.tickLimit && target > 0) {
      const due = Math.floor((value / target) * timing.tickLimit);
      if (due > ticks) { ticks = due; audio?.cue("tick"); }
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    showValue(target);
    setPhase("DONE");
    onPhase?.("DONE");
    // A skipped run lands quietly: the player asked for the result, not for
    // the rest of the show.
    if (!skipped) audio?.cue("settle");
    resolveDone(inspect());
  }

  function step() {
    const at = phaseAt(elapsed, timing);
    if (!at.done && at.phase !== phase) {
      // A long frame can cross a short phase; every phase that has a length
      // still starts, in order, and a zero-length one (reduced motion) never does.
      const from = phase === null ? 0 : HIGHLIGHT_PHASES.indexOf(phase) + 1;
      for (let index = from; index <= at.index; index += 1) {
        if (spans[index] > 0) enter(HIGHLIGHT_PHASES[index]);
      }
    }
    if (at.phase === "BUILD") {
      const next = Math.min(timing.stairSteps, Math.floor(at.progress * timing.stairSteps) + 1);
      while (lit < next) { audio?.cue("step", lit); lit += 1; layer.dataset.lit = String(lit); }
    } else if (!at.done && at.index > 1 && lit < timing.stairSteps) {
      lit = timing.stairSteps; layer.dataset.lit = String(lit);
    }
    layer.style.setProperty("--hl-progress", at.progress.toFixed(3));
    if (at.phase === "REVEAL" || at.done) {
      const progress = timing.countUpMs > 0 ? Math.min(1, (elapsed - revealStart) / timing.countUpMs) : 1;
      showValue(countUpValue(target, progress));
    }
    if (at.done) finish();
  }

  function update(tick) {
    const delta = Math.min(100, Math.max(0, tick?.deltaMS ?? 16.667));
    if (frameTimes.length < FRAME_SAMPLE_CAP) frameTimes.push(delta);
    if (!finished) { elapsed += delta; step(); }
    burst?.update(delta);
    // Keep drawing only while shards are still falling after the reveal; then
    // give the bounded Three.js context back instead of keeping an empty canvas.
    if (finished && (!burst || burst.finished())) {
      stopTicking();
      if (burst) { burstStats = burst.stats?.() ?? null; burst.dispose(); burst = null; }
    }
  }

  function stopTicking() {
    if (!running) return;
    running = false;
    ticker.remove(update);
  }

  function skip() {
    if (!phase || finished) return false;
    skipped = true;
    // Nothing keeps sounding after a skip: the charge sweep and any chord stop now.
    audio?.silence?.();
    elapsed = timing.totalMs;
    lit = timing.stairSteps;
    layer.dataset.lit = String(lit);
    layer.dataset.skipped = "true";
    front.dataset.skipped = "true";
    burst?.dispose();
    burst = null;
    step();
    return true;
  }

  function inspect() {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    return Object.freeze({
      phase: finished ? "DONE" : phase,
      elapsedMs: Math.round(elapsed),
      skipped,
      timing,
      target,
      shownValue,
      anchor: Object.freeze({ ...anchorPoint }),
      focus: Object.freeze({ ...focusPoint }),
      decor: layer.dataset.decor,
      frames: Object.freeze({ count: frameTimes.length, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted.at(-1) ?? 0,
        over20ms: frameTimes.filter((value) => value > 20).length, over33ms: frameTimes.filter((value) => value > 33.4).length }),
      audio: audio?.stats?.() ?? null,
      burst: burst?.stats?.() ?? burstStats ?? (burstFailed ? "UNAVAILABLE" : null)
    });
  }

  const onPointer = (event) => { if (!finished) { event.preventDefault(); skip(); } };

  return Object.freeze({
    timing,
    done,
    start() {
      if (running || finished || disposed) return;
      running = true;
      front.addEventListener("pointerdown", onPointer);
      ticker.add(update);
      step();
    },
    skip,
    isRunning: () => Boolean(phase) && !finished,
    inspect,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopTicking();
      front.removeEventListener("pointerdown", onPointer);
      observer?.disconnect();
      burst?.dispose();
      audio?.silence?.();
      audio?.dispose?.();
      layer.remove();
      front.remove();
      if (!finished) resolveDone(inspect());
    }
  });
}
