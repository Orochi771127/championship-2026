import { setLabel, setText, templateParts, uiText } from "../text/uiText.js";
import { formatNumber } from "../text/locale.js";
// The persistent status bar -- the original's ui/info_bar.nxr.
//
// WHY IT LIVES AT THE ROOT AND NOT INSIDE A SCREEN
// ------------------------------------------------
// info_bar.nxr is a Shared scene: it is loaded by nearly every mode overlay
// (OVL0, 4, 5, 6, 7, 8, 12, 14, 15, 16, 17, 18) rather than owned by any one of
// them, and the bar stays on screen across Training, Hunt, Battle and Shop. So
// this mounts once, above whichever view is current, and no screen owns it.
//
// THE FOUR FIELDS ARE THE SCENE'S OWN NODES
// -----------------------------------------
// info_bar.nxr carries exactly nine nodes, and they group into four fields:
//
//     season_icon                         x=1    y=4
//     day  +  day_number                  x=86 / x=76
//     mode_name                           x=147
//     time0 time1 colon time2 time3       x=215..248, digit pitch 9
//
// All on one row at y=10 of a 256x192 screen. That is SEASON | DAY N | MODE |
// HH:MM, which is what the original draws and what this renders. Anchor
// semantics for each node (left, centre or right) are NOT established, so this
// lays the fields out for a modern single screen rather than reproducing the
// pixel positions.
//
// This component owns no clock and no state. It renders what it is handed.

const MODE_LABELS = Object.freeze({
  RAISING_HOME: "Training",
  CAGE_EDIT: "Training",
  SHOP: "Shop",
  DATABASE: "Database",
  GATE_SELECT: "Hunt",
  HUNT_LOADOUT: "Hunt",
  HUNT_FIELD: "Hunt",
  HUNT_RESULT: "Hunt",
  BATTLE_SELECT: "Battle",
  // The tournaments board is a row in the battle menu, not a mode of its own,
  // so it reads Battle for the same reason Cage Edit reads Training.
  CHAMPIONSHIP: "Battle",
  BATTLE_FIELD: "Battle",
  BATTLE_RESULT: "Battle"
});

// Observed, not guessed: the original's bar reads Training while the Cage Edit
// board is open, and reads Hunt while Gate Select is open. Neither screen gets
// its own mode name.
export const STATUS_BAR_MODE_LABELS = MODE_LABELS;
export const STATUS_BAR_MODE_EVIDENCE = "LIVE_FOOTAGE_OBSERVATION";

export function statusBarModeLabel(screenId) {
  return MODE_LABELS[screenId] ?? "Training";
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

/**
 * Mount the bar into `root`.
 *
 * @param {object} options
 * @param {HTMLElement} options.root host element, prepended to
 * @param {() => void} [options.onEndDay] when omitted, no End Day control is drawn
 */
/** What the save indicator says. Only real states: an autosave is queued and
 * will write as soon as the screen allows (保存中), the port wrote or loaded
 * this device's copy (已存到本機), or the port failed (保存失敗). A session that
 * has merely moved on since its last write shows nothing: the Owner removed
 * the standing 「有尚未儲存的變更」 line on 2026-09-16. Nothing here claims an
 * account or a cloud copy; this build has neither. `text` is shown on the
 * bar, `label` is spoken. */
export const STATUS_BAR_SAVE_STATES = Object.freeze({
  SAVING: Object.freeze({ tone: "saving", label: "保存中", text: "保存中" }),
  SAVED: Object.freeze({ tone: "ok", label: "已存到本機", text: "已存到本機" }),
  RESTORED: Object.freeze({ tone: "ok", label: "已存到本機", text: null }),
  SAVE_FAILED: Object.freeze({ tone: "failed", label: "保存失敗，點一下查看", text: "保存失敗" })
});

/** The indicator key for a reading: the port's phase, or SAVING while an autosave waits. */
export function statusBarSaveKey(save) {
  if (!save) return null;
  if (save.phase === "SAVE_FAILED") return "SAVE_FAILED";
  if (save.autosavePending === true) return "SAVING";
  return Object.hasOwn(STATUS_BAR_SAVE_STATES, save.phase) ? save.phase : null;
}

// A fresh write is announced in words for this long, then settles to its mark.
const SAVED_FLASH_MS = 2400;

export function createChampionshipStatusBar({ root, onEndDay, onOpenMatches = null, onOpenSave = null } = {}) {
  if (!root) throw new TypeError("The status bar requires a root element");

  const bar = element("div", "cm-status-bar");
  bar.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  bar.dataset.originalScene = "ui/info_bar.nxr";
  // A group, not a live region: the clock changes every game minute and must
  // not be read aloud each time. Save news has its own quiet announcer below.
  bar.setAttribute("role", "group");
  setLabel(bar, "aria-label", "遊戲狀態");

  const season = element("span", "cm-status-bar__season", "—");
  season.dataset.node = "season_icon";
  const day = element("span", "cm-status-bar__day");
  day.dataset.node = "day+day_number";
  // Read as 「第 1 日」 / "Day 1": the words around the number come from one
  // template, so each language keeps its own order.
  const dayBefore = element("span", "cm-status-bar__day-word");
  const dayAfter = element("span", "cm-status-bar__day-word");
  day.append(dayBefore, element("span", "cm-status-bar__day-number", "—"), dayAfter);
  function paintDayWords() {
    const [before, after] = templateParts("第 {n} 日");
    dayBefore.textContent = before;
    dayAfter.textContent = after;
    dayAfter.hidden = !after;
  }
  paintDayWords();
  const mode = element("span", "cm-status-bar__mode", "—");
  mode.dataset.node = "mode_name";
  const time = element("time", "cm-status-bar__time", "--:--");
  time.dataset.node = "time0..time3+colon";

  // 2026-09-29: the product readouts ride on the same bar instead of a card
  // on Home. Bits and the save state are plain readouts; today's title
  // matches are a shortcut, shown only when there are some.
  const extras = element("span", "cm-status-bar__extras");
  const matches = element("button", "cm-status-bar__matches");
  matches.type = "button";
  matches.hidden = true;
  matches.addEventListener("click", () => onOpenMatches?.());
  const bits = element("span", "cm-status-bar__bits");
  bits.hidden = true;
  // The save state is a button: it opens what "saved" means here (this
  // device only) and, after a failure, the way to try again.
  const save = element("button", "cm-status-bar__save");
  save.type = "button";
  save.hidden = true;
  const saveText = element("span", "cm-status-bar__save-text");
  save.append(saveText);
  save.addEventListener("click", () => onOpenSave?.());
  const announcer = element("span", "cm-status-bar__announce");
  announcer.setAttribute("role", "status");
  announcer.setAttribute("aria-live", "polite");
  extras.append(matches, bits, save, announcer);
  let lastWrites = null, flashDue = false, flashTimer = null, lastAnnounced = null;

  bar.append(season, day, mode, time, extras);

  let endDayButton = null;
  if (typeof onEndDay === "function") {
    // The Raising Home submenu's End Day entry. It is not part of info_bar in
    // the original; it sits here because the submenu itself is not built yet,
    // and it is marked so nobody mistakes the placement for original layout.
    endDayButton = element("button", "cm-status-bar__end-day");
    setText(endDayButton, "END DAY");
    endDayButton.type = "button";
    endDayButton.dataset.provisionalPlacement = "SUBMENU_NOT_BUILT";
    setLabel(endDayButton, "aria-label", "End the day");
    endDayButton.addEventListener("click", () => { onEndDay(); });
    bar.append(endDayButton);
  }

  root.prepend(bar);

  // The mounted screen shells are fixed full-viewport layers; tell the stylesheet
  // to offset them by however tall this bar actually renders, rather than
  // hard-coding a height that a font or zoom change would break.
  const host = root.ownerDocument?.body ?? document.body;
  host.dataset.statusBar = "on";
  function syncHeight() {
    // Transformed screen pixels would shrink this reservation twice in landscape.
    const height = Math.ceil(bar.offsetHeight ?? bar.getBoundingClientRect().height);
    if (height > 0) host.style.setProperty("--cm-status-bar-height", `${height}px`);
  }
  syncHeight();
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(syncHeight) : null;
  resizeObserver?.observe(bar);

  const dayNumber = day.querySelector(".cm-status-bar__day-number");
  // The latest value of every field, so a language switch can repaint them.
  const lastReading = {};

  return Object.freeze({
    element: bar,

    /** Repaint every label in the current language (after a language switch). */
    relabel() {
      setLabel(bar, "aria-label", "遊戲狀態");
      paintDayWords();
      if (endDayButton) { setText(endDayButton, "END DAY"); setLabel(endDayButton, "aria-label", "End the day"); }
      lastAnnounced = null;
      this.render({ ...lastReading });
    },

    /**
     * @param {object} reading
     * @param {string} [reading.seasonName]
     * @param {number} [reading.dayNumber] already 1-based; the raw slot is never shown
     * @param {string} [reading.time] HH:MM
     * @param {string} [reading.screen] screen id, mapped to the original's mode name
     */
    render(reading = {}) {
      Object.assign(lastReading, reading);
      if (Object.hasOwn(reading, "seasonName")) {
        season.textContent = uiText(reading.seasonName || "—");
        if (reading.seasonName) season.dataset.season = reading.seasonName.toLowerCase();
        else delete season.dataset.season;
      }
      if (Object.hasOwn(reading, "dayNumber")) dayNumber.textContent = uiText(Number.isInteger(reading.dayNumber) ? String(reading.dayNumber) : "—");
      if (reading.time) time.textContent = uiText(reading.time);
      if (reading.screen) {
        mode.textContent = uiText(statusBarModeLabel(reading.screen));
        bar.dataset.screen = reading.screen;
      }
      if (Object.hasOwn(reading, "bits")) {
        const known = Number.isSafeInteger(reading.bits);
        bits.hidden = !known;
        bits.textContent = known ? String(formatNumber(reading.bits)) : "";
        bits.setAttribute("aria-label", known ? uiText("持有 {bits} 位元幣", { bits: reading.bits }) : "");
      }
      if (Object.hasOwn(reading, "todayMatches")) {
        const count = Number.isInteger(reading.todayMatches) ? reading.todayMatches : 0;
        matches.hidden = count <= 0 || typeof onOpenMatches !== "function";
        matches.replaceChildren();
        if (count > 0) {
          // "chip" context: the short word for a narrow bar ("Titles" in English).
          const word = element("span", "cm-status-bar__matches-word");
          word.textContent = uiText("頭銜賽", { context: "chip" });
          matches.append(word, " ", element("span", "cm-status-bar__matches-count", String(count)));
        }
        matches.setAttribute("aria-label", count > 0 ? uiText("今日有 {count} 場頭銜賽，開啟對戰選單", { count }) : "");
      }
      if (Object.hasOwn(reading, "save")) {
        const key = statusBarSaveKey(reading.save);
        const state = key ? STATUS_BAR_SAVE_STATES[key] : null;
        save.hidden = !state;
        if (state) {
          // Words appear only when there is news: queued, failed, or a write
          // that just landed. Otherwise the mark alone keeps the bar quiet.
          // A write can be reported while its autosave is still marked queued,
          // so a new write is remembered until the indicator reads SAVED.
          const writes = Number.isInteger(reading.save.committedWrites) ? reading.save.committedWrites : null;
          if (lastWrites !== null && writes !== null && writes > lastWrites) flashDue = true;
          if (writes !== null) lastWrites = writes;
          if (key === "SAVE_FAILED") flashDue = false;
          const fresh = key === "SAVED" && flashDue;
          if (fresh) flashDue = false;
          if (fresh) {
            save.dataset.flash = "true";
            if (flashTimer !== null) clearTimeout(flashTimer);
            flashTimer = setTimeout(() => { flashTimer = null; delete save.dataset.flash; }, SAVED_FLASH_MS);
          } else if (key !== "SAVED" && flashTimer !== null) {
            clearTimeout(flashTimer); flashTimer = null; delete save.dataset.flash;
          }
          // Spoken once per change of news: a write that landed, or a failure.
          const news = fresh ? "SAVED" : key === "SAVE_FAILED" ? "SAVE_FAILED" : null;
          if (news && news !== lastAnnounced) announcer.textContent = uiText(news === "SAVED" ? "已存到本機" : "保存失敗");
          lastAnnounced = news ?? (key === "SAVED" ? lastAnnounced : null);
          save.dataset.tone = state.tone;
          save.dataset.state = key;
          save.setAttribute("aria-label", uiText(state.label));
          save.title = uiText(state.label);
          saveText.textContent = uiText(state.text ?? state.label);
        }
      }
    },

    setEndDayEnabled(enabled) {
      if (endDayButton) endDayButton.disabled = !enabled;
    },

    dispose() {
      if (flashTimer !== null) clearTimeout(flashTimer);
      resizeObserver?.disconnect();
      delete host.dataset.statusBar;
      host.style.removeProperty("--cm-status-bar-height");
      bar.remove();
    }
  });
}
