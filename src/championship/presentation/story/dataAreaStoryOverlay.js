// Data Area story overlay (OWNER_APPROVED_ADAPTATION 2026-10-29): the DOM
// layer over the grid theater. Dialogue box with a typewriter, name plates the
// overwrite glitch can rewrite in front of the player, a line that is struck
// through and forcibly replaced, choices, evidence files, the WARNING banner,
// the rescue objectives, the tournament entry form the partner signs, tap
// tasks and the timing-ring clash HUD.
//
// Every wait honours the run's AbortSignal; timers are setTimeout only. Motion
// is CSS (ui/dataAreaStory.css) plus small Web Animations, dropped under
// reduced motion. Sounds go through the existing `cm-fx` event.

const TYPE_MS = 26;
export const DATA_AREA_CLASH_RING = Object.freeze({ from: 2.3, ms: 1150, cycles: 2, perfect: 0.12, good: 0.36 });

const el = (doc, tag, className, text = null) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
};
const aborted = signal => signal?.reason ?? new Error("STORY_ABORTED");

/** Grade a tap on the shrinking ring: the ring's scale at the tap against the target ring. */
export function gradeClashTap(elapsedMs, ring = DATA_AREA_CLASH_RING) {
  const cycle = elapsedMs % ring.ms, scale = ring.from - (ring.from - 1) * (cycle / ring.ms);
  const off = Math.abs(scale - 1);
  return off <= ring.perfect ? "perfect" : off <= ring.good ? "good" : "miss";
}

export function createDataAreaStoryOverlay({
  host, doc = host?.ownerDocument ?? globalThis.document, reducedMotion = false, text = key => key,
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, now = () => globalThis.performance?.now?.() ?? Date.now()
} = {}) {
  if (!host) throw new TypeError("DATA_AREA_OVERLAY_HOST");
  const fxEvent = kind => { try { doc.dispatchEvent(new CustomEvent("cm-fx", { detail: { kind } })); } catch { /* sound is decoration */ } };
  const root = el(doc, "div", "cm-da-overlay");
  if (reducedMotion) root.dataset.motion = "reduced";
  const top = el(doc, "div", "cm-da-overlay__top");
  const chapterTitle = el(doc, "p", "cm-da-overlay__chapter");
  const controls = el(doc, "div", "cm-da-overlay__controls");
  const autoButton = el(doc, "button", "cm-da-chip", text("DIALOG_AUTO")); autoButton.type = "button"; autoButton.dataset.daAction = "auto"; autoButton.setAttribute("aria-pressed", "false");
  const skipButton = el(doc, "button", "cm-da-chip", text("DIALOG_SKIP")); skipButton.type = "button"; skipButton.dataset.daAction = "skip";
  controls.append(autoButton, skipButton);
  top.append(chapterTitle, controls);
  const objectives = el(doc, "aside", "cm-da-objectives"); objectives.hidden = true;
  const task = el(doc, "p", "cm-da-task"); task.hidden = true; task.setAttribute("role", "status");
  const hint = el(doc, "p", "cm-da-hint-line"); hint.hidden = true; hint.setAttribute("role", "status");
  const hintLabel = el(doc, "b", "cm-da-hint-line__label", text("OBJECTIVE_LABEL")), hintText = el(doc, "span", "cm-da-hint-line__text");
  hint.append(hintLabel, hintText);
  const dialog = el(doc, "section", "cm-da-dialog"); dialog.hidden = true; dialog.setAttribute("aria-live", "polite");
  const plate = el(doc, "p", "cm-da-dialog__plate");
  const plateName = el(doc, "span", "cm-da-dialog__name");
  plate.append(plateName);
  const line = el(doc, "p", "cm-da-dialog__text");
  const lineText = el(doc, "span", "cm-da-dialog__words");
  const strike = el(doc, "i", "cm-da-dialog__strike");
  const ghost = el(doc, "p", "cm-da-dialog__ghost"); ghost.hidden = true;
  line.append(lineText, strike);
  const cue = el(doc, "span", "cm-da-dialog__cue"); cue.setAttribute("aria-hidden", "true");
  dialog.append(plate, ghost, line, cue);
  const choices = el(doc, "div", "cm-da-choices"); choices.hidden = true; choices.setAttribute("role", "group");
  const layer = el(doc, "div", "cm-da-overlay__layer");
  root.append(top, hint, objectives, task, layer, choices, dialog);
  host.append(root);

  let auto = false, onSkip = null, onAuto = null, disposed = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimer(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const cancel = t => { clearTimer(t); timers.delete(t); };
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted(signal)); return; }
    const t = later(() => { signal?.removeEventListener?.("abort", stop); resolve(); }, Math.max(0, ms));
    const stop = () => { cancel(t); reject(aborted(signal)); };
    signal?.addEventListener?.("abort", stop, { once: true });
  });
  autoButton.addEventListener("click", () => { auto = !auto; autoButton.setAttribute("aria-pressed", String(auto)); onAuto?.(auto); fxEvent("toggle"); });
  skipButton.addEventListener("click", () => { fxEvent("close"); onSkip?.(); });

  /** Wait for a tap on the dialogue (or the auto timer). */
  function tapOrAuto(ms, signal, node = dialog) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(aborted(signal)); return; }
      let t = null;
      const done = () => { cleanup(); resolve(); };
      const onTap = event => { if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return; event.preventDefault?.(); done(); };
      const stop = () => { cleanup(); reject(aborted(signal)); };
      const cleanup = () => { if (t !== null) cancel(t); node.removeEventListener("pointerdown", onTap); doc.removeEventListener("keydown", onTap); signal?.removeEventListener?.("abort", stop); };
      node.addEventListener("pointerdown", onTap); doc.addEventListener("keydown", onTap);
      signal?.addEventListener?.("abort", stop, { once: true });
      if (auto) t = later(done, ms);
    });
  }
  /** Type `value` into the line; a tap fills it at once. */
  async function typeLine(value, signal) {
    lineText.textContent = "";
    dialog.dataset.typing = "true";
    if (reducedMotion) { lineText.textContent = value; delete dialog.dataset.typing; return; }
    const chars = Array.from(value);
    let skip = false;
    const onTap = () => { skip = true; };
    dialog.addEventListener("pointerdown", onTap, { once: true });
    try {
      for (let i = 0; i < chars.length && !skip; i++) { lineText.textContent += chars[i]; await sleep(TYPE_MS, signal); }
    } finally { dialog.removeEventListener("pointerdown", onTap); }
    lineText.textContent = value;
    delete dialog.dataset.typing;
    await sleep(60, signal);
  }
  function setPlate({ name, faction = null, speaker = null }) {
    plateName.textContent = name ?? "";
    plate.hidden = !name;
    dialog.dataset.speaker = speaker ?? "";
    if (faction) dialog.dataset.faction = faction; else delete dialog.dataset.faction;
  }

  return Object.freeze({
    element: root,
    get auto() { return auto; },
    setAuto(value) { auto = Boolean(value); autoButton.setAttribute("aria-pressed", String(auto)); },
    open({ title = "", onSkip: skip = null, onAuto: toggle = null, auto: start = false, canSkip = true } = {}) {
      chapterTitle.textContent = title; onSkip = skip; onAuto = toggle; auto = Boolean(start);
      autoButton.setAttribute("aria-pressed", String(auto)); skipButton.hidden = !canSkip;
      root.dataset.open = "true";
    },
    close() { dialog.hidden = true; choices.hidden = true; task.hidden = true; hint.hidden = true; objectives.hidden = true; layer.replaceChildren(); delete root.dataset.open; },
    /** One line of dialogue; resolves on tap once typed (or by itself in auto). */
    async say({ speaker, name, faction = null, text: value, signal = null }) {
      dialog.hidden = false; delete dialog.dataset.overwrite;
      strike.removeAttribute("data-on"); ghost.hidden = true;
      setPlate({ name, faction, speaker });
      await typeLine(value, signal);
      dialog.dataset.ready = "true";
      try { await tapOrAuto(900 + Array.from(value).length * 42, signal); } finally { delete dialog.dataset.ready; }
    },
    /** The name plate glitches and is rewritten in front of the player. */
    async glitchName(name, { signal = null, alarm = true } = {}) {
      if (dialog.hidden) return;
      plate.dataset.glitch = "on"; if (alarm) fxEvent("denied");
      await sleep(reducedMotion ? 80 : 520, signal);
      plateName.textContent = name;
      delete plate.dataset.glitch;
    },
    /** A true line typed, an alarm, a red strike, then the forced replacement in green. */
    async sayOverwritten({ speaker, name, faction = null, from, to, signal = null }) {
      dialog.hidden = false; setPlate({ name, faction, speaker }); ghost.hidden = true;
      dialog.dataset.overwrite = "true-line";
      await typeLine(from, signal);
      await sleep(reducedMotion ? 200 : 900, signal);
      dialog.dataset.overwrite = "alarm"; fxEvent("denied");
      strike.setAttribute("data-on", "true");
      await sleep(reducedMotion ? 150 : 820, signal);
      dialog.dataset.overwrite = "glitch";
      await sleep(reducedMotion ? 60 : 380, signal);
      strike.removeAttribute("data-on");
      // The true line stays visible, struck through, above the forced one.
      ghost.textContent = from; ghost.hidden = false;
      lineText.textContent = to;
      dialog.dataset.overwrite = "forced";
      dialog.dataset.ready = "true";
      try { await tapOrAuto(2200, signal); } finally { delete dialog.dataset.ready; }
    },
    /** Options as buttons; resolves the picked index. */
    choose({ prompt, options, signal = null }) {
      dialog.hidden = false; setPlate({ name: "", speaker: "choice" });
      lineText.textContent = prompt ?? "";
      choices.replaceChildren(); choices.hidden = false;
      return new Promise((resolve, reject) => {
        const stop = () => { choices.hidden = true; reject(aborted(signal)); };
        signal?.addEventListener?.("abort", stop, { once: true });
        options.forEach((label, index) => {
          const button = el(doc, "button", "cm-da-choice", label); button.type = "button"; button.dataset.choice = String(index);
          button.style.setProperty("--i", String(index));
          button.addEventListener("click", () => { signal?.removeEventListener?.("abort", stop); choices.hidden = true; fxEvent("snap"); resolve(index); });
          choices.append(button);
        });
        if (auto) later(() => { if (!choices.hidden) choices.querySelector("button")?.click(); }, 1400);
        choices.querySelector("button")?.focus?.({ preventScroll: true });
      });
    },
    /** An evidence / document card; tap to put it away. */
    async file({ title, body, kicker = "FILE", signal = null }) {
      const card = el(doc, "article", "cm-da-file");
      card.append(el(doc, "p", "cm-da-file__kicker", kicker), el(doc, "h3", "cm-da-file__title", title), el(doc, "p", "cm-da-file__body", body),
        el(doc, "p", "cm-da-file__close", text("FILE_CLOSE")));
      card.tabIndex = 0;
      layer.append(card); fxEvent("open");
      try { await sleep(reducedMotion ? 80 : 420, signal); await tapOrAuto(2600, signal, card); }
      finally { card.remove(); }
    },
    async warning({ sub = "", word = null, signal = null } = {}) {
      const banner = el(doc, "div", "cm-da-warning");
      if (word && word !== text("WARNING")) banner.dataset.kind = "battle";
      banner.append(el(doc, "i", "cm-da-warning__stripes"), el(doc, "strong", "cm-da-warning__word", word ?? text("WARNING")), el(doc, "span", "cm-da-warning__sub", sub), el(doc, "i", "cm-da-warning__stripes"));
      layer.append(banner); fxEvent("denied");
      try { await sleep(reducedMotion ? 700 : 1900, signal); } finally { banner.remove(); }
    },
    objectives({ title, items }) {
      objectives.hidden = false;
      objectives.replaceChildren(el(doc, "p", "cm-da-objectives__title", title));
      const list = el(doc, "ol", "cm-da-objectives__list");
      for (const item of items) { const li = el(doc, "li", "cm-da-objectives__item", item.text); li.dataset.done = String(Boolean(item.done)); list.append(li); }
      objectives.append(list);
    },
    taskPrompt(value) { task.hidden = !value; task.textContent = value ?? ""; },
    /** Control returns to the player (free exploration): the dialogue box steps away. */
    rest() { dialog.hidden = true; choices.hidden = true; },
    /** The current objective, one imperative line under the chapter title. */
    objectiveHint(value) {
      hint.hidden = !value; hintText.textContent = value ?? "";
      if (value) { hint.classList.remove("is-new"); void hint.offsetWidth; hint.classList.add("is-new"); }
    },
    toast(value, { kind = "info" } = {}) {
      const node = el(doc, "p", "cm-da-toast", value); node.dataset.kind = kind;
      layer.append(node);
      later(() => node.remove(), reducedMotion ? 1400 : 2200);
      return node;
    },
    /**
     * The tournament entry form. `armed` resolves when the player rests on the
     * empty partner-name field (pointer over, press or focus; auto after a beat).
     */
    signForm({ tamer, signal = null }) {
      const form = el(doc, "section", "cm-da-form");
      form.setAttribute("aria-label", text("FORM_TITLE"));
      const head = el(doc, "h3", "cm-da-form__title", text("FORM_TITLE"));
      const rowTamer = el(doc, "p", "cm-da-form__row");
      rowTamer.append(el(doc, "span", "cm-da-form__label", text("FORM_TAMER")), el(doc, "span", "cm-da-form__value", tamer || "—"));
      const rowPartner = el(doc, "p", "cm-da-form__row cm-da-form__row--partner");
      const field = el(doc, "button", "cm-da-form__field"); field.type = "button"; field.dataset.daField = "partner";
      field.setAttribute("aria-label", text("FORM_PARTNER"));
      const caret = el(doc, "i", "cm-da-form__caret"); field.append(caret);
      rowPartner.append(el(doc, "span", "cm-da-form__label", text("FORM_PARTNER")), field);
      const hint = el(doc, "p", "cm-da-form__hint", text("FORM_HINT"));
      const stampSlot = el(doc, "span", "cm-da-form__stamp");
      form.append(head, rowTamer, rowPartner, hint, stampSlot);
      layer.append(form); fxEvent("open");
      let resolveArmed;
      const armed = new Promise(resolve => { resolveArmed = resolve; });
      let fired = false;
      const arm = () => { if (fired) return; fired = true; form.dataset.state = "armed"; resolveArmed(); };
      for (const type of ["pointerenter", "pointerdown", "focus"]) field.addEventListener(type, arm);
      if (auto) later(arm, 1300);
      signal?.addEventListener?.("abort", () => form.remove(), { once: true });
      return Object.freeze({
        element: form, field, armed,
        /** The partner's heart-core stamp and its own name. */
        stamp(name) {
          form.dataset.state = "stamped";
          field.replaceChildren();
          const written = el(doc, "span", "cm-da-form__name", name); field.append(written);
          stampSlot.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 36s-10-6.2-10-13.4C14 18.6 16.8 16 19.6 16c2 0 3.4 1 4.4 2.4 1-1.4 2.4-2.4 4.4-2.4 2.8 0 5.6 2.6 5.6 6.6C34 29.8 24 36 24 36z" fill="currentColor"/><circle cx="24" cy="24" r="3.2" fill="#fff"/></svg>';
          hint.textContent = text("FORM_DONE");
          fxEvent("snap");
        },
        close() { form.remove(); }
      });
    },
    /** Two seal keys pressed in order (council, then Black Iron). */
    cosign({ signal = null } = {}) {
      const panel = el(doc, "div", "cm-da-cosign");
      const keys = [["lumen", text("SEAL_LUMEN")], ["iron", text("SEAL_IRON")]].map(([id, label]) => {
        const button = el(doc, "button", "cm-da-seal", label); button.type = "button"; button.dataset.seal = id; return button;
      });
      panel.append(...keys); layer.append(panel);
      return new Promise((resolve, reject) => {
        let step = 0;
        const stop = () => { panel.remove(); reject(aborted(signal)); };
        signal?.addEventListener?.("abort", stop, { once: true });
        const press = index => {
          if (index !== step) { fxEvent("denied"); keys[index].dataset.state = "wrong"; later(() => delete keys[index].dataset.state, 400); return; }
          keys[index].dataset.state = "on"; fxEvent("snap"); step += 1;
          if (step === keys.length) { signal?.removeEventListener?.("abort", stop); later(() => { panel.remove(); resolve(); }, reducedMotion ? 60 : 420); }
        };
        keys.forEach((button, index) => button.addEventListener("click", () => press(index)));
        if (auto) { later(() => press(0), 700); later(() => press(1), 1300); }
      });
    },
    /**
     * The clash HUD. round() shows the timing ring and resolves the grade;
     * setHp() moves a bar; finish() shows the result line.
     */
    clash({ title, allyName = null, foeName = "", partnerName = "" }) {
      dialog.hidden = true;
      const objectivesWereShown = !objectives.hidden; objectives.hidden = true;
      const hud = el(doc, "section", "cm-da-clash");
      const head = el(doc, "p", "cm-da-clash__title", title);
      const bars = el(doc, "div", "cm-da-clash__bars");
      const bar = (side, label) => {
        const wrap = el(doc, "div", `cm-da-clash__hp cm-da-clash__hp--${side}`);
        const fill = el(doc, "i", "cm-da-clash__fill");
        wrap.append(el(doc, "span", "cm-da-clash__who", label), el(doc, "span", "cm-da-clash__track"));
        wrap.lastChild.append(fill);
        return { wrap, fill };
      };
      const ours = bar("ours", allyName ? `${partnerName} + ${allyName}` : partnerName), theirs = bar("theirs", foeName);
      bars.append(ours.wrap, theirs.wrap);
      const round = el(doc, "p", "cm-da-clash__round");
      const ringBox = el(doc, "button", "cm-da-ring"); ringBox.type = "button"; ringBox.dataset.daAction = "clash-tap"; ringBox.hidden = true;
      const target = el(doc, "i", "cm-da-ring__target"), shrink = el(doc, "i", "cm-da-ring__shrink"), core = el(doc, "span", "cm-da-ring__label", text("CLASH_TAP"));
      ringBox.append(target, shrink, core);
      const grade = el(doc, "p", "cm-da-clash__grade"); grade.hidden = true;
      hud.append(head, bars, round, ringBox, grade);
      layer.append(hud);
      return Object.freeze({
        element: hud,
        setHp(side, value) { (side === "ours" ? ours : theirs).fill.style.transform = `scaleX(${Math.max(0, Math.min(1, value)).toFixed(3)})`; },
        round(n, total, { signal = null } = {}) {
          round.textContent = text("CLASH_ROUND").replace("{n}", String(n)).replace("{total}", String(total));
          ringBox.hidden = false; grade.hidden = true;
          const ring = DATA_AREA_CLASH_RING, started = now();
          const run = !reducedMotion && typeof shrink.animate === "function"
            ? shrink.animate([{ transform: `scale(${ring.from})`, opacity: 0.4 }, { transform: "scale(1)", opacity: 1 }], { duration: ring.ms, iterations: ring.cycles, easing: "linear" })
            : null;
          return new Promise((resolve, reject) => {
            let timer = null;
            const finish = result => {
              cleanup(); ringBox.hidden = true;
              grade.hidden = false; grade.dataset.grade = result;
              grade.textContent = text(result === "perfect" ? "CLASH_PERFECT" : result === "good" ? "CLASH_GOOD" : "CLASH_MISS");
              fxEvent(result === "miss" ? "denied" : "damage");
              resolve(result);
            };
            const onTap = event => { event.preventDefault(); event.stopPropagation(); finish(gradeClashTap(now() - started)); };
            const stop = () => { cleanup(); reject(aborted(signal)); };
            const cleanup = () => { run?.cancel(); if (timer !== null) cancel(timer); ringBox.removeEventListener("pointerdown", onTap); signal?.removeEventListener?.("abort", stop); };
            ringBox.addEventListener("pointerdown", onTap);
            signal?.addEventListener?.("abort", stop, { once: true });
            timer = later(() => finish(auto ? "good" : "miss"), auto ? 700 : ring.ms * ring.cycles);
            try { ringBox.focus({ preventScroll: true }); } catch { /* focus is a courtesy */ }
          });
        },
        finish(won, cheer = null) {
          ringBox.hidden = true; grade.hidden = false; grade.dataset.grade = won ? "win" : "lose";
          grade.textContent = won ? text("CLASH_WIN") : `${text("CLASH_LOSE")} — ${cheer ?? text("CLASH_LOSE_CHEER")}`;
          fxEvent(won ? "levelup" : "sparkle");
        },
        close() { hud.remove(); if (objectivesWereShown) objectives.hidden = false; }
      });
    },
    dispose() { if (disposed) return; disposed = true; for (const t of timers) clearTimer(t); timers.clear(); root.remove(); }
  });
}
