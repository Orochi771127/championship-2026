// Story mode theater chrome (OWNER_APPROVED_ADAPTATION 2026-11-11): the
// half-body visual novel's interface. A full-screen dialog over the game: the
// scene (storyVnStage.js) fills it; a framed dialogue box along the bottom
// carries a name-plate tab, the speaker's partner caption, a typewriter line
// and the ▼ cue; Log / Auto / Skip ride the top-right corner (Skip and Esc
// fast-forward to the next decision). Choices, document cards, the entry form
// the partner signs itself, tap prompts, the objective tracker, the WARNING
// band, the battle banner and the chapter-clear card are all layers here.
//
// DOM only; motion is CSS (ui/storyVn.css) plus one typewriter timer. It reads
// only what it is handed and writes nothing.

export const VN_TYPE_MS = 26;
export const VN_AUTO_BASE_MS = 1100;
export const VN_AUTO_PER_CHAR_MS = 45;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}
function button(doc, className, text, action) {
  const node = el(doc, "button", className, text); node.type = "button";
  if (action) node.dataset.vnAction = action;
  return node;
}

export function createStoryVnTheater({ doc = globalThis.document, host = doc.body, text = key => key, reducedMotion = false,
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  const root = el(doc, "section", "cm-vn");
  root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.dataset.storyTheater = "vn"; if (reducedMotion) root.dataset.motion = "reduced";
  const stageHost = el(doc, "div", "cm-vn__stage");
  const top = el(doc, "header", "cm-vn__top");
  const chapter = el(doc, "p", "cm-vn__chapter");
  const controls = el(doc, "div", "cm-vn__controls");
  const logKey = button(doc, "cm-vn__key", text("VN_LOG"), "log");
  const autoKey = button(doc, "cm-vn__key", text("VN_AUTO"), "auto"); autoKey.setAttribute("aria-pressed", "false");
  const skipKey = button(doc, "cm-vn__key cm-vn__key--skip", "", "skip");
  skipKey.append(el(doc, "span", "", text("VN_SKIP")), el(doc, "kbd", "cm-vn__kbd", "Esc"));
  const quitKey = button(doc, "cm-vn__key cm-vn__key--quit", text("VN_QUIT"), "quit");
  controls.append(logKey, autoKey, skipKey, quitKey);
  top.append(chapter, controls);
  const location = el(doc, "p", "cm-vn__location"); location.hidden = true;
  const objectives = el(doc, "aside", "cm-vn__objectives"); objectives.hidden = true;
  const promptBar = el(doc, "p", "cm-vn__prompt"); promptBar.hidden = true; promptBar.setAttribute("role", "status");

  const box = el(doc, "div", "cm-vn__box"); box.dataset.vnAction = "advance"; box.hidden = true;
  const plate = el(doc, "div", "cm-vn__plate");
  const name = el(doc, "span", "cm-vn__name");
  const sub = el(doc, "span", "cm-vn__sub");
  plate.append(name, sub);
  const line = el(doc, "p", "cm-vn__line");
  const cue = el(doc, "span", "cm-vn__cue"); cue.setAttribute("aria-hidden", "true");
  const live = el(doc, "p", "cm-sr-only"); live.setAttribute("aria-live", "polite");
  box.append(plate, line, cue);

  const choices = el(doc, "div", "cm-vn__choices"); choices.hidden = true; choices.setAttribute("role", "group");
  const layer = el(doc, "div", "cm-vn__layer"); layer.hidden = true;
  const log = el(doc, "div", "cm-vn__log"); log.hidden = true; log.setAttribute("role", "log");
  const logTitle = el(doc, "p", "cm-vn__log-title", text("VN_LOG_TITLE"));
  const logList = el(doc, "ol", "cm-vn__log-list");
  log.append(logTitle, logList);
  const toast = el(doc, "p", "cm-vn__toast"); toast.hidden = true; toast.setAttribute("role", "status");
  root.append(stageHost, top, location, objectives, promptBar, box, choices, layer, log, toast, live);
  host.append(root);

  const timers = new Set();
  const later = (fn, ms) => { const t = setTimer(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const cancel = t => { if (t) { clearTimer(t); timers.delete(t); } };
  let auto = false, fastForward = false, pending = null, typer = null, autoTimer = null, previousFocus = null;
  let onSkip = null, onQuit = null, disposed = false;
  const history = [];

  function setAuto(value) { auto = Boolean(value); autoKey.setAttribute("aria-pressed", String(auto)); root.dataset.auto = String(auto); if (auto && pending?.phase === "done") armAuto(); }
  function armAuto() { cancel(autoTimer); autoTimer = null; if (!auto || !log.hidden || !pending) return; const length = pending.text.length; autoTimer = later(() => { if (pending?.phase === "done" && log.hidden) advance(); }, VN_AUTO_BASE_MS + VN_AUTO_PER_CHAR_MS * Math.min(90, length)); }
  function settle() { if (pending?.phase !== "typing") return; cancel(typer); typer = null; pending.phase = "done"; line.textContent = pending.text; box.dataset.phase = "done"; armAuto(); }
  function advance() {
    if (!log.hidden) { showLog(false); return; }
    if (!pending) return;
    if (pending.phase === "typing") { settle(); return; }
    const done = pending; pending = null; cancel(autoTimer); autoTimer = null; done.resolve();
  }
  function showLog(open) {
    log.hidden = !open; logKey.setAttribute("aria-pressed", String(open)); root.dataset.log = String(open);
    if (open) {
      cancel(autoTimer); autoTimer = null;
      logList.replaceChildren(...history.map(entry => {
        const row = el(doc, "li", "cm-vn__log-row");
        if (entry.name) row.append(el(doc, "span", "cm-vn__log-name", entry.name));
        row.append(el(doc, "span", "cm-vn__log-text", entry.text));
        return row;
      }));
      logList.lastElementChild?.scrollIntoView?.({ block: "end" });
    } else if (pending?.phase === "done") armAuto();
  }
  function onKey(event) {
    if (root.hidden || disposed) return;
    if (event.key === "Escape") { event.preventDefault(); if (!log.hidden) showLog(false); else onSkip?.(); return; }
    if ((event.key === "Enter" || event.key === " ") && choices.hidden && layer.hidden && !event.target?.closest?.("button")) { event.preventDefault(); advance(); }
  }
  box.addEventListener("click", advance);
  stageHost.addEventListener("click", event => { if (!event.target.closest(".cm-vn-tap")) advance(); });
  log.addEventListener("click", () => showLog(false));
  logKey.addEventListener("click", () => showLog(log.hidden));
  autoKey.addEventListener("click", () => setAuto(!auto));
  skipKey.addEventListener("click", () => onSkip?.());
  quitKey.addEventListener("click", () => onQuit?.());
  doc.addEventListener("keydown", onKey);

  function remember(entry) { history.push(entry); if (history.length > 120) history.shift(); }
  const wait = ms => new Promise(resolve => later(resolve, ms));

  return Object.freeze({
    element: root,
    stageHost,
    get isOpen() { return !root.hidden; },
    get auto() { return auto; },
    open({ label = "", onSkip: skip = null, onQuit: quit = null } = {}) {
      previousFocus = doc.activeElement;
      onSkip = skip; onQuit = quit; chapter.textContent = label;
      history.length = 0; showLog(false); setAuto(false);
      root.hidden = false; root.dataset.phase = "open";
      try { box.focus?.({ preventScroll: true }); } catch { /* not focusable */ }
    },
    /** Fast-forward mode: lines settle at once and do not wait for a tap. */
    setFastForward(value) { fastForward = Boolean(value); root.dataset.fast = String(fastForward); if (fastForward && pending) { settle(); advance(); } },
    setHidden(value) { root.dataset.away = value ? "true" : "false"; root.hidden = Boolean(value); },
    /** A centred title card: kicker / title / sub. Resolves after a beat or a tap. */
    async titleCard({ kicker = "", title = "", sub = "", ms = 2200 } = {}) {
      const card = el(doc, "div", "cm-vn-title");
      card.append(el(doc, "p", "cm-vn-title__kicker", kicker), el(doc, "h2", "cm-vn-title__title", title), el(doc, "p", "cm-vn-title__sub", sub));
      layer.replaceChildren(card); layer.hidden = false; layer.dataset.kind = "title";
      await new Promise(resolve => { const t = later(resolve, fastForward ? 300 : ms); layer.addEventListener("click", () => { cancel(t); resolve(); }, { once: true }); });
      layer.hidden = true; layer.replaceChildren();
    },
    location(value) {
      location.hidden = !value; location.textContent = value ?? "";
      location.classList.remove("is-in"); void location.offsetWidth; if (value) location.classList.add("is-in");
    },
    /** One line. `overwrite` types the first text, then glitches it into the second. Resolves on advance. */
    say({ name: speaker = "", sub: caption = "", side = "left", faction = "", narrator = false, text: said = "", overwrite = null } = {}) {
      box.hidden = false; choices.hidden = true;
      box.dataset.side = side; box.dataset.narrator = String(narrator); box.dataset.faction = faction || "";
      name.textContent = speaker; sub.textContent = caption; plate.hidden = narrator || !speaker; sub.hidden = !caption;
      cancel(typer); cancel(autoTimer);
      live.textContent = speaker ? `${speaker}: ${overwrite ?? said}` : overwrite ?? said;
      return new Promise(resolve => {
        const entry = { text: said, phase: "typing", resolve };
        pending = entry;
        box.dataset.phase = "typing"; line.textContent = "";
        const finishOverwrite = () => {
          if (!overwrite || pending !== entry) return;
          box.dataset.glitch = "on";
          later(() => { if (pending !== entry) return; delete box.dataset.glitch; entry.text = overwrite; line.textContent = overwrite; remember({ name: speaker, text: overwrite }); armAuto(); }, fastForward ? 0 : 520);
        };
        remember({ name: speaker, text: said });
        if (fastForward || reducedMotion) {
          line.textContent = said; entry.phase = "done"; box.dataset.phase = "done";
          if (overwrite) { finishOverwrite(); }
          if (fastForward) later(() => { if (pending === entry) advance(); }, overwrite ? 40 : 0);
          else armAuto();
          return;
        }
        const chars = Array.from(said); let i = 0;
        const step = () => {
          if (pending !== entry) return;
          i += 1; line.textContent = chars.slice(0, i).join("");
          if (i >= chars.length) { entry.phase = "done"; box.dataset.phase = "done"; typer = null; if (overwrite) { later(finishOverwrite, 650); return; } armAuto(); return; }
          typer = later(step, VN_TYPE_MS);
        };
        typer = later(step, VN_TYPE_MS);
      });
    },
    hideBox() { box.hidden = true; },
    /** Choices; resolves with the chosen index. */
    choose({ prompt = "", options = [] } = {}) {
      box.hidden = !prompt; if (prompt) { name.textContent = ""; plate.hidden = true; line.textContent = prompt; box.dataset.phase = "done"; box.dataset.narrator = "true"; }
      cancel(autoTimer);
      return new Promise(resolve => {
        choices.replaceChildren(...options.map((label, index) => {
          const option = button(doc, "cm-vn__choice", label, "choice"); option.dataset.index = String(index);
          option.addEventListener("click", () => { choices.hidden = true; remember({ name: "", text: `▶ ${label}` }); resolve(index); }, { once: true });
          return option;
        }));
        choices.hidden = false;
        try { choices.firstElementChild?.focus({ preventScroll: true }); } catch { /* not focusable */ }
      });
    },
    /** A document card; resolves when closed. */
    card({ title = "", body = "", close = "" } = {}) {
      box.hidden = true;
      const card = el(doc, "article", "cm-vn-card");
      card.append(el(doc, "h3", "cm-vn-card__title", title), el(doc, "p", "cm-vn-card__body", body));
      const shut = button(doc, "cm-vn-card__close cm-arcade-key", close, "card-close"); card.append(shut);
      layer.replaceChildren(card); layer.hidden = false; layer.dataset.kind = "card";
      remember({ name: title, text: body });
      return new Promise(resolve => {
        const done = () => { layer.hidden = true; layer.replaceChildren(); resolve(); };
        shut.addEventListener("click", done, { once: true });
        if (fastForward) later(done, 200);
        try { shut.focus({ preventScroll: true }); } catch { /* not focusable */ }
      });
    },
    /**
     * The request board (part three's reception counter): one row per chapter or request,
     * {id, kind: "main"|"request", title, sub, state: "open"|"cleared"|"locked", note}.
     * Resolves with the picked id, or null when closed.
     */
    board({ title = "", close = "", items = [] } = {}) {
      box.hidden = true;
      const card = el(doc, "article", "cm-vn-board");
      card.append(el(doc, "h3", "cm-vn-board__title", title));
      const list = el(doc, "div", "cm-vn-board__list");
      const shut = button(doc, "cm-vn-card__close cm-arcade-key", close, "board-close");
      return new Promise(resolve => {
        const done = id => { layer.hidden = true; layer.replaceChildren(); delete layer.dataset.kind; resolve(id); };
        for (const item of items) {
          const row = button(doc, "cm-vn-board__item", "", "board-pick");
          row.dataset.kind = item.kind ?? "request"; row.dataset.state = item.state ?? "open"; row.dataset.id = item.id;
          row.disabled = item.state === "locked";
          row.append(el(doc, "span", "cm-vn-board__tag", item.tag ?? ""), el(doc, "span", "cm-vn-board__name", item.title ?? item.id),
            el(doc, "span", "cm-vn-board__sub", item.state === "locked" ? item.note ?? "" : item.sub ?? ""));
          row.addEventListener("click", () => { if (!row.disabled) done(item.id); });
          list.append(row);
        }
        shut.addEventListener("click", () => done(null), { once: true });
        card.append(list, shut);
        layer.replaceChildren(card); layer.hidden = false; layer.dataset.kind = "board";
        try { (list.querySelector("button:not([disabled])") ?? shut).focus({ preventScroll: true }); } catch { /* not focusable */ }
      });
    },
    /** The entry form: the tamer row is filled, the partner writes its own name, the stamp lands. */
    async form({ title = "", tamerLabel = "", tamer = "", partnerLabel = "", partner = "", hint = "", done = "" } = {}) {
      box.hidden = true;
      const card = el(doc, "article", "cm-vn-form");
      const rowA = el(doc, "p", "cm-vn-form__row"); rowA.append(el(doc, "span", "cm-vn-form__label", tamerLabel), el(doc, "span", "cm-vn-form__value", tamer));
      const value = el(doc, "span", "cm-vn-form__value cm-vn-form__value--pen");
      const rowB = el(doc, "p", "cm-vn-form__row"); rowB.append(el(doc, "span", "cm-vn-form__label", partnerLabel), value);
      const tip = el(doc, "p", "cm-vn-form__hint", hint);
      const stamp = el(doc, "span", "cm-vn-form__stamp", done); stamp.hidden = true;
      card.append(el(doc, "h3", "cm-vn-form__title", title), rowA, rowB, tip, stamp);
      layer.replaceChildren(card); layer.hidden = false; layer.dataset.kind = "form";
      if (!fastForward) await wait(900);
      const chars = Array.from(partner);
      for (let i = 1; i <= chars.length; i++) { value.textContent = chars.slice(0, i).join(""); if (!fastForward) await wait(reducedMotion ? 0 : 220); }
      tip.hidden = true; stamp.hidden = false;
      remember({ name: title, text: `${tamerLabel} ${tamer} / ${partnerLabel} ${partner}` });
      await wait(fastForward ? 120 : 1300);
      layer.hidden = true; layer.replaceChildren();
    },
    prompt(value) { promptBar.hidden = !value; promptBar.textContent = value ?? ""; },
    objectives({ title = "", items = [], done = 0 } = {}) {
      if (!items.length) { objectives.hidden = true; return; }
      objectives.hidden = false;
      objectives.replaceChildren(el(doc, "p", "cm-vn__objectives-title", title), ...items.map((item, index) => {
        const row = el(doc, "p", "cm-vn__objective", item); row.dataset.done = String(index < done); return row;
      }));
    },
    async warning({ title = "", sub = "" } = {}) {
      const band = el(doc, "div", "cm-vn-warning");
      band.append(el(doc, "strong", "cm-vn-warning__title", title), el(doc, "span", "cm-vn-warning__sub", sub));
      root.append(band);
      remember({ name: title, text: sub });
      await wait(fastForward ? 200 : 1500);
      band.remove();
    },
    /** BATTLE! banner with the start key; resolves when the player starts it. */
    battleBanner({ kicker = "BATTLE!", title = "", go = "" } = {}) {
      box.hidden = true;
      const card = el(doc, "div", "cm-vn-battle");
      const start = button(doc, "cm-vn-battle__go cm-arcade-key", go, "battle-go");
      card.append(el(doc, "strong", "cm-vn-battle__kicker", kicker), el(doc, "p", "cm-vn-battle__title", title), start);
      layer.replaceChildren(card); layer.hidden = false; layer.dataset.kind = "battle";
      return new Promise(resolve => {
        start.addEventListener("click", () => { layer.hidden = true; layer.replaceChildren(); resolve(); }, { once: true });
        try { start.focus({ preventScroll: true }); } catch { /* not focusable */ }
      });
    },
    async toast(value, ms = 1800) {
      toast.textContent = value; toast.hidden = false; toast.classList.remove("is-in"); void toast.offsetWidth; toast.classList.add("is-in");
      await wait(fastForward ? 300 : ms); toast.hidden = true;
    },
    /** The chapter-clear card; resolves when the player goes back. */
    clearCard({ kicker = "", title = "", echo = "", lines = [], back = "" } = {}) {
      box.hidden = true; choices.hidden = true; promptBar.hidden = true;
      const card = el(doc, "article", "cm-vn-clear");
      const list = el(doc, "ul", "cm-vn-clear__rewards");
      for (const value of lines) list.append(el(doc, "li", "", value));
      const shut = button(doc, "cm-vn-clear__back cm-arcade-key", back, "back");
      card.append(el(doc, "p", "cm-vn-clear__kicker", kicker), el(doc, "h2", "cm-vn-clear__title", title), el(doc, "p", "cm-vn-clear__echo", echo), list, shut);
      layer.replaceChildren(card); layer.hidden = false; layer.dataset.kind = "clear";
      return new Promise(resolve => {
        shut.addEventListener("click", () => resolve(), { once: true });
        try { shut.focus({ preventScroll: true }); } catch { /* not focusable */ }
      });
    },
    log: () => history.map(entry => ({ ...entry })),
    close() {
      root.hidden = true; root.dataset.phase = "closed";
      cancel(typer); cancel(autoTimer); pending?.resolve(); pending = null;
      try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* gone */ }
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const t of timers) clearTimer(t); timers.clear();
      pending?.resolve(); pending = null;
      doc.removeEventListener("keydown", onKey);
      root.remove();
    }
  });
}
