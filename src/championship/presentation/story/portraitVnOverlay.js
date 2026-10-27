// Portrait dialogue overlay for the story theater (OWNER_APPROVED_ADAPTATION
// 2026-10-28): the visual-novel layer. A bottom dialogue box with a speaker
// nameplate, a typewriter line, a portrait on each side with procedural micro
// motion (CSS: idle-breathe, talk-bounce, shock-shake, nod, silhouette,
// noise-glitch), choices, Skip and Auto. The box keeps clear of the field's
// centre and of the home indicator (env(safe-area-inset-bottom)).
//
// DOM only, transform/opacity motion, one typewriter timer; the director owns
// the abort signal. It writes nothing and reads only what it is handed.

import { uiText, setText } from "../../text/uiText.js";

export const VN_TYPEWRITER_MS = 28;
export const VN_AUTO_BASE_MS = 900;
export const VN_AUTO_PER_CHAR_MS = 42;

const NAVI_SVG = `<svg viewBox="0 0 96 96" aria-hidden="true" class="cm-story-vn__navi"><defs><linearGradient id="cmNaviG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9df6e8"/><stop offset="1" stop-color="#56e3c2"/></linearGradient></defs><g fill="none" stroke="url(#cmNaviG)" stroke-width="3" stroke-linecap="round"><path d="M48 10 L80 28 L80 64 L48 84 L16 64 L16 28 Z"/><path d="M48 24 L66 34 L66 56 L48 68 L30 56 L30 34 Z" opacity=".7"/></g><circle cx="48" cy="46" r="8" fill="url(#cmNaviG)"/><path d="M36 60 Q48 70 60 60" stroke="#eaf5f2" stroke-width="3" fill="none" stroke-linecap="round"/><g fill="#56e3c2" opacity=".8"><rect x="22" y="14" width="4" height="4"/><rect x="70" y="76" width="4" height="4"/><rect x="12" y="46" width="3" height="3"/></g></svg>`;

export function createPortraitVnOverlay({ doc = globalThis.document, host = doc.body, reducedMotion = false, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  const root = doc.createElement("section");
  root.className = "cm-story-vn"; root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.dataset.storyTheater = "vn"; if (reducedMotion) root.dataset.motion = "reduced";
  const scrim = doc.createElement("div"); scrim.className = "cm-story-vn__scrim";
  const stageArea = doc.createElement("div"); stageArea.className = "cm-story-vn__stage";
  const portraits = { left: doc.createElement("figure"), right: doc.createElement("figure") };
  for (const [side, figure] of Object.entries(portraits)) { figure.className = "cm-story-vn__portrait"; figure.dataset.side = side; figure.hidden = true; stageArea.append(figure); }
  const panel = doc.createElement("div"); panel.className = "cm-story-vn__panel";
  const head = doc.createElement("div"); head.className = "cm-story-vn__head";
  const title = doc.createElement("p"); title.className = "cm-story-vn__chapter";
  const controls = doc.createElement("div"); controls.className = "cm-story-vn__controls";
  const autoButton = doc.createElement("button"); autoButton.type = "button"; autoButton.className = "cm-story-vn__control"; autoButton.dataset.storyAction = "auto"; autoButton.setAttribute("aria-pressed", "false");
  const skipButton = doc.createElement("button"); skipButton.type = "button"; skipButton.className = "cm-story-vn__control cm-story-vn__control--skip"; skipButton.dataset.storyAction = "skip";
  setText(autoButton, "STORY_AUTO"); setText(skipButton, "STORY_SKIP");
  controls.append(autoButton, skipButton); head.append(title, controls);
  const box = doc.createElement("div"); box.className = "cm-story-vn__box"; box.dataset.storyAction = "advance";
  const nameplate = doc.createElement("p"); nameplate.className = "cm-story-vn__name";
  const line = doc.createElement("p"); line.className = "cm-story-vn__line";
  const srLine = doc.createElement("p"); srLine.className = "cm-sr-only"; srLine.setAttribute("aria-live", "polite");
  const cue = doc.createElement("span"); cue.className = "cm-story-vn__cue"; cue.setAttribute("aria-hidden", "true"); cue.textContent = "▼";
  box.append(nameplate, line, cue);
  const choices = doc.createElement("div"); choices.className = "cm-story-vn__choices"; choices.hidden = true;
  const prompt = doc.createElement("p"); prompt.className = "cm-story-vn__prompt"; choices.append(prompt);
  panel.append(head, box, choices, srLine);
  root.append(scrim, stageArea, panel);
  host.append(root);

  let auto = false, typer = null, autoTimer = null, pending = null, onSkip = null, onAuto = null, previousFocus = null, disposed = false, lastSpeaker = null;
  const sideFor = speaker => speaker === "partner" ? "right" : "left";

  function stopTimers() { clearTimer(typer); clearTimer(autoTimer); typer = null; autoTimer = null; }
  function settle() { if (pending?.phase === "typing") { pending.phase = "done"; line.textContent = pending.text; box.dataset.phase = "done"; if (auto) armAuto(pending.text); } }
  function armAuto(text) { clearTimer(autoTimer); autoTimer = setTimer(() => { if (pending?.phase === "done") advance(); }, VN_AUTO_BASE_MS + VN_AUTO_PER_CHAR_MS * Math.min(80, text.length)); }
  function advance() { if (!pending) return; if (pending.phase === "typing") { settle(); return; } const done = pending; pending = null; stopTimers(); done.resolve(); }
  function onKey(event) {
    if (root.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); onSkip?.(); return; }
    if (event.key === "Enter" || event.key === " ") { if (!choices.hidden) return; event.preventDefault(); advance(); }
  }
  box.addEventListener("click", advance);
  scrim.addEventListener("click", advance);
  skipButton.addEventListener("click", () => onSkip?.());
  autoButton.addEventListener("click", () => { setAuto(!auto); onAuto?.(auto); if (auto && pending?.phase === "done") armAuto(pending.text); });
  doc.addEventListener("keydown", onKey);
  function setAuto(value) { auto = Boolean(value); autoButton.setAttribute("aria-pressed", String(auto)); root.dataset.auto = String(auto); }

  function paintPortrait(side, portrait, motion, name, active) {
    const figure = portraits[side];
    if (!portrait) { figure.hidden = true; return; }
    figure.hidden = false; figure.dataset.kind = portrait.kind; figure.dataset.active = String(active);
    if (figure.dataset.key !== `${portrait.kind}:${portrait.src ?? ""}`) {
      figure.dataset.key = `${portrait.kind}:${portrait.src ?? ""}`; figure.replaceChildren();
      if (portrait.kind === "navi") figure.innerHTML = NAVI_SVG;
      else if (portrait.src) { const img = doc.createElement("img"); img.src = portrait.src; img.alt = portrait.alt ?? ""; img.decoding = "async"; img.draggable = false; figure.append(img); }
      else { const blank = doc.createElement("div"); blank.className = "cm-story-vn__portrait-blank"; blank.textContent = (name ?? "?").slice(0, 1); figure.append(blank); }
    }
    figure.dataset.motion = active ? motion : "idle-breathe";
    if (portrait.kind === "silhouette") figure.dataset.motion = active && motion === "noise-glitch" ? "noise-glitch" : "silhouette";
    if (active) { figure.classList.remove("is-speaking"); void figure.offsetWidth; figure.classList.add("is-speaking"); } else figure.classList.remove("is-speaking");
  }

  return Object.freeze({
    element: root,
    get isOpen() { return !root.hidden; },
    open({ title: chapterTitle = "", onSkip: skip = null, onAuto: autoChange = null, auto: startAuto = false } = {}) {
      onSkip = skip; onAuto = autoChange; setAuto(startAuto); title.textContent = chapterTitle; lastSpeaker = null;
      for (const figure of Object.values(portraits)) { figure.hidden = true; delete figure.dataset.key; figure.replaceChildren(); }
      previousFocus = doc.activeElement; root.hidden = false; root.dataset.phase = "open";
      try { skipButton.focus({ preventScroll: true }); } catch { /* not focusable yet */ }
    },
    close() {
      stopTimers(); if (pending) { const done = pending; pending = null; done.resolve(); }
      root.hidden = true; choices.hidden = true; box.hidden = false; root.dataset.phase = "closed";
      try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* gone */ }
    },
    setAuto,
    /** Shows one line with a typewriter; resolves when the player advances (or auto does). */
    say({ speaker, name, text, motion = "idle-breathe", portrait = null, signal = null }) {
      return new Promise(resolve => {
        if (disposed || signal?.aborted) { resolve(); return; }
        stopTimers(); choices.hidden = true; box.hidden = false;
        const side = sideFor(speaker);
        root.dataset.speaker = speaker; box.dataset.speaker = speaker; box.dataset.motion = motion;
        nameplate.textContent = speaker === "narrator" ? "" : name ?? ""; nameplate.hidden = speaker === "narrator";
        if (speaker === "narrator") { for (const figure of Object.values(portraits)) figure.dataset.active = "false"; }
        else {
          paintPortrait(side, portrait, motion, name, true);
          const other = portraits[side === "left" ? "right" : "left"];
          if (!other.hidden) other.dataset.active = "false";
        }
        if (lastSpeaker !== speaker) { box.classList.remove("is-new"); void box.offsetWidth; box.classList.add("is-new"); }
        lastSpeaker = speaker;
        srLine.textContent = `${speaker === "narrator" ? "" : name + "："}${text}`;
        pending = { phase: "typing", text, resolve };
        box.dataset.phase = "typing"; line.textContent = "";
        signal?.addEventListener?.("abort", () => { if (pending?.resolve === resolve) { pending = null; stopTimers(); resolve(); } }, { once: true });
        if (reducedMotion) { settle(); return; }
        let shown = 0;
        const step = () => {
          if (pending?.resolve !== resolve || pending.phase !== "typing") return;
          shown += 1; line.textContent = text.slice(0, shown);
          if (shown >= text.length) { settle(); return; }
          const ch = text[shown - 1];
          typer = setTimer(step, /[，。！？…—,.!?]/.test(ch) ? VN_TYPEWRITER_MS * 5 : VN_TYPEWRITER_MS);
        };
        typer = setTimer(step, VN_TYPEWRITER_MS);
      });
    },
    /** Shows a prompt and 2-4 options; resolves with the picked index. */
    choose({ prompt: promptText, options, signal = null }) {
      return new Promise(resolve => {
        if (disposed || signal?.aborted) { resolve(0); return; }
        stopTimers(); pending = null;
        prompt.textContent = promptText ?? ""; choices.replaceChildren(prompt); choices.hidden = false; box.hidden = true; root.dataset.phase = "choice";
        let settled = false;
        const finish = index => { if (settled) return; settled = true; choices.hidden = true; box.hidden = false; root.dataset.phase = "open"; resolve(index); };
        options.forEach((label, index) => {
          const button = doc.createElement("button"); button.type = "button"; button.className = "cm-story-vn__choice"; button.dataset.storyChoice = String(index);
          button.textContent = label; button.style.setProperty("--i", String(index));
          button.addEventListener("click", () => finish(index));
          choices.append(button);
        });
        signal?.addEventListener?.("abort", () => finish(0), { once: true });
        try { choices.querySelector("button")?.focus({ preventScroll: true }); } catch { /* fine */ }
      });
    },
    dispose() { disposed = true; stopTimers(); doc.removeEventListener("keydown", onKey); if (pending) { const done = pending; pending = null; done.resolve(); } root.remove(); }
  });
}

export const STORY_VN_TEXT_KEYS = Object.freeze(["STORY_AUTO", "STORY_SKIP"]);
export function storyVnLabel(key) { return uiText(key); }
