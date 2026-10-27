// StoryCutsceneStage (Owner 2026-10-28): a one-screen cinematic stage that plays
// a validated story chapter (futureSystemsPort.js) beat by beat. The opening
// prologue uses it today; story-mode chapters reuse it unchanged.
//
// DOM only: no save, RNG, router or ticker. Motion is CSS (panel entry, Ken
// Burns, typewriter); the stage only flips states and keeps two timers, one
// for "typing finished" and one optional auto-advance hold per beat.

const TYPE_MS = 34;

function graphemes(text) {
  if (typeof Intl?.Segmenter === "function") return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(s => s.segment);
  return Array.from(text);
}

/**
 * host       element the stage replaces its children with
 * chapter    validated chapter ({ chapterId, beats:[{ speaker, text, illustration, cameraEffect, choices, autoAdvanceMs }] })
 * labels     { chapter, skip, tapToContinue, narrator, ariaLabel }
 * resolveText / resolveSpeaker   locale hooks applied when a beat is shown
 * onComplete(result)  after the last beat (result.choices holds picked choice ids)
 * onSkip()    the skip capsule; defaults to onComplete
 * rootClass   extra classes on the root (the opening keeps .cm-opening-story)
 */
export function createStoryCutsceneStage({ host, chapter, labels = {}, onComplete = () => {}, onSkip = null,
  resolveText = text => text, resolveSpeaker = speaker => speaker, rootClass = "", doc = globalThis.document } = {}) {
  if (!host || !chapter?.beats?.length) throw new TypeError("STORY_STAGE_REQUIRES_HOST_AND_CHAPTER");
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const root = el("section", `cm-cutscene ${rootClass}`.trim());
  root.tabIndex = 0;
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", labels.ariaLabel ?? labels.chapter ?? chapter.chapterId);
  root.dataset.chapterId = chapter.chapterId;
  root.dataset.storyStage = "playing";

  const sky = el("div", "cm-cutscene__sky");
  sky.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 10; i++) { const spark = el("i", "cm-cutscene__spark"); spark.style.setProperty("--s", String(i)); sky.append(spark); }

  const top = el("header", "cm-cutscene__top");
  const kicker = el("p", "cm-cutscene__chapter", labels.chapter ?? "");
  const pips = el("ol", "cm-cutscene__pips");
  pips.setAttribute("aria-hidden", "true");
  for (let i = 0; i < chapter.beats.length; i++) pips.append(el("li", "cm-cutscene__pip"));
  const skip = el("button", "cm-cutscene__skip");
  skip.type = "button";
  skip.dataset.storyAction = "skip";
  skip.append(el("span", "cm-cutscene__skip-icon", "⏭"), el("span", "", labels.skip ?? "Skip"));
  top.append(kicker, pips, skip);

  const panels = el("div", "cm-cutscene__panels");
  const dialogue = el("div", "cm-cutscene__dialogue");
  const speaker = el("p", "cm-cutscene__speaker");
  const line = el("p", "cm-cutscene__line");
  line.setAttribute("aria-live", "polite");
  const choiceRow = el("div", "cm-cutscene__choices");
  const cue = el("span", "cm-cutscene__continue");
  cue.setAttribute("aria-hidden", "true");
  cue.append(el("span", "cm-cutscene__continue-arrow", "▼"), el("span", "", labels.tapToContinue ?? ""));
  dialogue.append(speaker, line, choiceRow, cue);
  root.append(sky, top, panels, dialogue);
  host.replaceChildren(root);
  host.hidden = false;

  let index = -1, disposed = false, finishing = false, typingTimer = null, holdTimer = null;
  const picked = [];
  const clearTimers = () => { clearTimeout(typingTimer); clearTimeout(holdTimer); typingTimer = holdTimer = null; };
  const beat = () => chapter.beats[index];

  function renderPanels(art, effect) {
    // A text-only beat keeps the stage alive with a signal rather than a void.
    const figures = art.length ? art.map((picture, i) => {
      const figure = el("figure", "cm-cutscene__panel");
      figure.style.setProperty("--i", String(i));
      if (picture.slot) figure.dataset.slot = picture.slot;
      const frame = el("div", "cm-cutscene__frame"), img = el("img", "");
      img.src = picture.src; img.alt = ""; img.draggable = false; img.decoding = "async";
      if (picture.width) img.width = picture.width;
      if (picture.height) img.height = picture.height;
      if (picture.slot) img.dataset.comicSlot = picture.slot;
      frame.append(img); figure.append(frame);
      return figure;
    }) : [(() => { const signal = el("div", "cm-cutscene__signal"); signal.append(el("span", "cm-cutscene__signal-ring"), el("span", "cm-cutscene__signal-ring"), el("span", "cm-cutscene__signal-glyph", "✉")); return signal; })()];
    panels.dataset.count = String(art.length);
    panels.dataset.camera = effect;
    panels.setAttribute("aria-hidden", "true");
    panels.replaceChildren(...figures);
  }

  function renderLine(text) {
    line.replaceChildren();
    line.setAttribute("aria-label", text);
    const characters = graphemes(text);
    characters.forEach((character, i) => {
      if (character === "\n") { line.append(el("br")); return; }
      const glyph = el("span", "cm-cutscene__char", character);
      glyph.style.setProperty("--c", String(i));
      glyph.setAttribute("aria-hidden", "true");
      line.append(glyph);
    });
    return characters.length;
  }

  function show(next) {
    if (disposed) return;
    clearTimers();
    index = next;
    const current = beat();
    root.dataset.beat = String(index);
    root.dataset.typing = "true";
    root.dataset.lastBeat = String(index === chapter.beats.length - 1);
    [...pips.children].forEach((pip, i) => { pip.dataset.state = i < index ? "done" : i === index ? "current" : "next"; });
    const holdMs = current.autoAdvanceMs ?? 0;
    root.style.setProperty("--beat-ms", `${Math.max(4000, holdMs + 1500)}ms`);
    renderPanels(current.illustration, current.cameraEffect);
    const who = current.speaker ? resolveSpeaker(current.speaker) : labels.narrator ?? "";
    speaker.textContent = who;
    speaker.hidden = !who;
    const count = renderLine(resolveText(current.text));
    choiceRow.replaceChildren(...current.choices.map(choice => {
      const button = el("button", "cm-cutscene__choice cm-arcade-key", resolveText(choice.label));
      button.type = "button";
      button.dataset.storyChoice = choice.id;
      button.addEventListener("click", event => { event.stopPropagation(); if (root.dataset.typing === "true") return; picked.push(choice.id); advance(choice.next); });
      return button;
    }));
    choiceRow.hidden = current.choices.length === 0;
    typingTimer = setTimeout(finishTyping, count * TYPE_MS + 240);
  }

  function finishTyping() {
    if (disposed || index < 0) return;
    clearTimeout(typingTimer); typingTimer = null;
    root.dataset.typing = "false";
    const current = beat();
    if (current.autoAdvanceMs && !current.choices.length && !doc.hidden) holdTimer = setTimeout(() => advance(), current.autoAdvanceMs);
  }

  function advance(target = null) {
    if (disposed || finishing) return;
    const next = target ?? index + 1;
    if (next >= chapter.beats.length) { finish(onComplete); return; }
    show(next);
  }

  function tap() {
    if (disposed || finishing || index < 0) return;
    if (root.dataset.typing === "true") { finishTyping(); return; }
    if (beat().choices.length) return;
    advance();
  }

  function finish(callback) {
    if (finishing) return;
    finishing = true;
    clearTimers();
    root.dataset.storyStage = "leaving";
    // The fade is CSS; the callback runs once it has had time to play.
    setTimeout(() => { if (disposed) return; dispose(); callback({ chapterId: chapter.chapterId, choices: Object.freeze([...picked]) }); }, 360);
  }

  function visibility() {
    if (doc.hidden) { clearTimeout(holdTimer); holdTimer = null; }
    else if (root.dataset.typing === "false" && !holdTimer && !finishing && index >= 0) finishTyping();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimers();
    doc.removeEventListener("visibilitychange", visibility);
    root.remove();
  }

  root.addEventListener("click", event => { if (!event.target.closest?.("button")) tap(); });
  root.addEventListener("keydown", event => {
    if (event.target.closest?.("button")) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tap(); }
  });
  skip.addEventListener("click", () => finish(onSkip ?? onComplete));
  doc.addEventListener("visibilitychange", visibility);

  return Object.freeze({
    root,
    /** Start at the first beat (callers may hold the stage while art loads). */
    start() { if (!disposed && index < 0) { root.focus({ preventScroll: true }); show(0); } },
    tap,
    getBeatIndex: () => index,
    dispose
  });
}
