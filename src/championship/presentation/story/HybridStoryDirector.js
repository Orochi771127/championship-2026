// Hybrid story theater director (OWNER_APPROVED_ADAPTATION 2026-10-28).
//
// Plays one STORY_RIFT chapter as two layers over a live screen:
//   stage    the Octopath-style in-engine layer (storyStagePuppeteer): camera,
//            spotlight, the partner's own sprite acting, emote bubbles, the rift
//   overlay  the portrait dialogue box (portraitVnOverlay): typewriter lines,
//            portrait motion, choices, skip and auto-play
//
// It owns no game state: the caller pauses the clock, hands in the stage and
// overlay, and reads the result. One AbortController ends everything (skip,
// dispose, screen change); every wait is a setTimeout that honours it, and a
// hidden page holds the clock until it is visible again. No animation-frame
// loop and no second ticker.

import { STORY_RIFT_CHAPTERS, STORY_RIFT_SPEAKERS, storyRiftText, storyRiftSpeakerName, validateStoryRiftChapter } from "../../data/storyRiftChapters.js";

export const STORY_EMOTE_HOLD_MS = 300;
export const STORY_DIRECTOR_OUTCOMES = Object.freeze(["completed", "skipped", "aborted", "refused"]);

/** Resolves after `ms`, or rejects with the abort reason. Hidden pages wait. */
export function storySleep(ms, { signal = null, doc = globalThis.document, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new Error("STORY_ABORTED")); return; }
    let remaining = Math.max(0, ms), startedAt = Date.now(), timer = null, paused = false;
    const finish = () => { cleanup(); resolve(); };
    const abort = () => { cleanup(); reject(signal?.reason ?? new Error("STORY_ABORTED")); };
    const arm = () => { startedAt = Date.now(); timer = setTimer(finish, remaining); };
    const onVisibility = () => {
      if (doc?.hidden) { if (!paused) { paused = true; clearTimer(timer); remaining = Math.max(0, remaining - (Date.now() - startedAt)); } }
      else if (paused) { paused = false; arm(); }
    };
    const cleanup = () => { clearTimer(timer); signal?.removeEventListener?.("abort", abort); doc?.removeEventListener?.("visibilitychange", onVisibility); };
    signal?.addEventListener?.("abort", abort, { once: true });
    doc?.addEventListener?.("visibilitychange", onVisibility);
    if (doc?.hidden) { paused = true; } else arm();
  });
}

export function createHybridStoryDirector({
  stage = null, overlay, doc = globalThis.document, locale = "zh-Hant",
  chapters = STORY_RIFT_CHAPTERS, reducedMotion = false, autoPlay = false,
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout
} = {}) {
  if (!overlay || typeof overlay.say !== "function" || typeof overlay.choose !== "function") throw new TypeError("STORY_OVERLAY_REQUIRED");
  let controller = null, playing = null, auto = Boolean(autoPlay), disposed = false;
  const sleep = ms => storySleep(ms, { signal: controller?.signal, doc, setTimer, clearTimer });

  function portraitFor(speaker, params) {
    if (speaker === "partner") return { kind: "image", src: params.partnerPortrait?.src ?? null, alt: params.partner ?? "" };
    if (speaker === "echo") return { kind: "silhouette", src: params.partnerPortrait?.src ?? null, alt: "" };
    if (speaker === "navi") return { kind: "navi" };
    return null;
  }

  async function runBeats(chapter, params, log) {
    const beats = chapter.beats;
    const labels = new Map(beats.map((beat, index) => [beat.label, index]).filter(([label]) => label));
    let index = 0, guard = 0;
    while (index < beats.length) {
      controller.signal.throwIfAborted();
      if (++guard > 400) throw new Error("STORY_BEAT_LOOP");
      const beat = beats[index];
      switch (beat.type) {
        case "camera":
          await stage?.camera?.(beat.target, { zoom: beat.zoom ?? 1, ms: reducedMotion ? 0 : beat.ms ?? 600 });
          if (!reducedMotion && beat.ms) await sleep(Math.min(beat.ms, 900));
          break;
        case "spotlight": stage?.spotlight?.(Boolean(beat.on), beat.target ?? "partner"); break;
        case "rift": stage?.rift?.(beat.state, beat.anchor ?? "edge-left"); await sleep(reducedMotion ? 120 : beat.state === "close" ? 700 : 500); break;
        case "echoes": stage?.echoes?.((beat.keys ?? []).map(key => storyRiftText(key, locale, params)).filter(Boolean)); await sleep(reducedMotion ? 120 : 650); break;
        case "actor": await (stage?.actor?.(beat.action, { toward: beat.toward ?? null, reducedMotion }) ?? Promise.resolve()); break;
        case "emote": stage?.emote?.(beat.glyph); await sleep(STORY_EMOTE_HOLD_MS + (reducedMotion ? 0 : 160)); break;
        case "wait": await sleep(reducedMotion ? Math.min(beat.ms ?? 0, 150) : beat.ms ?? 0); break;
        case "jump": { const target = labels.get(beat.next); if (target === undefined) throw new Error(`STORY_LABEL_${beat.next}`); index = target; continue; }
        case "line": {
          const text = storyRiftText(beat.key, locale, params);
          if (text === null) throw new Error(`STORY_KEY_${beat.key}`);
          stage?.speaking?.(beat.speaker);
          await overlay.say({
            speaker: beat.speaker, name: storyRiftSpeakerName(beat.speaker, locale, params), text,
            motion: beat.motion, portrait: portraitFor(beat.speaker, params), auto, signal: controller.signal
          });
          log.lines += 1;
          break;
        }
        case "choice": {
          const picked = await overlay.choose({
            prompt: storyRiftText(beat.key, locale, params),
            options: beat.options.map(option => storyRiftText(option.key, locale, params)),
            signal: controller.signal
          });
          const option = beat.options[picked] ?? beat.options[0];
          log.choices.push({ key: beat.key, picked: option.key });
          const target = labels.get(option.next); if (target === undefined) throw new Error(`STORY_LABEL_${option.next}`);
          index = target; continue;
        }
        case "end": return;
        default: throw new Error(`STORY_BEAT_${beat.type}`);
      }
      index += 1;
    }
  }

  return Object.freeze({
    get isPlaying() { return playing !== null; },
    get autoPlay() { return auto; },
    setAutoPlay(value) { auto = Boolean(value); overlay.setAuto?.(auto); },
    /** Plays a chapter to its end. Resolves {outcome, chapterId, lines, choices}. */
    async play(chapterId, params = {}) {
      if (disposed) return Object.freeze({ outcome: "refused", reason: "DISPOSED", chapterId });
      if (playing) return Object.freeze({ outcome: "refused", reason: "ALREADY_PLAYING", chapterId });
      const chapter = chapters[chapterId];
      const problems = validateStoryRiftChapter(chapter);
      if (problems.length) return Object.freeze({ outcome: "refused", reason: problems[0], chapterId });
      controller = new AbortController();
      const log = { lines: 0, choices: [] };
      let outcome = "completed";
      const onSkip = () => controller?.abort(new Error("STORY_SKIPPED"));
      const onAuto = value => { auto = Boolean(value); };
      playing = (async () => {
        try {
          overlay.open?.({ title: storyRiftText(chapter.titleKey, locale) ?? chapterId, onSkip, onAuto, auto, signal: controller.signal });
          await stage?.begin?.(controller.signal);
          await runBeats(chapter, params, log);
        } catch (error) {
          outcome = error?.message === "STORY_SKIPPED" ? "skipped" : "aborted";
          if (outcome === "aborted" && error?.message !== "STORY_ABORTED") console.warn(`STORY_DIRECTOR: ${error?.message ?? error}`);
        } finally {
          try { await stage?.end?.(); } catch { /* the stage is gone */ }
          overlay.close?.();
          controller = null;
        }
        return Object.freeze({ outcome, chapterId, lines: log.lines, choices: Object.freeze(log.choices) });
      })();
      try { return await playing; } finally { playing = null; }
    },
    skip() { controller?.abort(new Error("STORY_SKIPPED")); },
    dispose() { disposed = true; controller?.abort(new Error("STORY_ABORTED")); }
  });
}

export { STORY_RIFT_SPEAKERS };
