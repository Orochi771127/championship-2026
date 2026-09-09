import { uiText } from "../text/uiText.js";
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
export function createChampionshipStatusBar({ root, onEndDay } = {}) {
  if (!root) throw new TypeError("The status bar requires a root element");

  const bar = element("div", "cm-status-bar");
  bar.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  bar.dataset.originalScene = "ui/info_bar.nxr";
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");

  const season = element("span", "cm-status-bar__season", "—");
  season.dataset.node = "season_icon";
  const day = element("span", "cm-status-bar__day");
  day.dataset.node = "day+day_number";
  day.append(element("span", "cm-status-bar__day-word", "Day"), element("span", "cm-status-bar__day-number", "—"));
  const mode = element("span", "cm-status-bar__mode", "—");
  mode.dataset.node = "mode_name";
  const time = element("time", "cm-status-bar__time", "--:--");
  time.dataset.node = "time0..time3+colon";

  bar.append(season, day, mode, time);

  let endDayButton = null;
  if (typeof onEndDay === "function") {
    // The Raising Home submenu's End Day entry. It is not part of info_bar in
    // the original; it sits here because the submenu itself is not built yet,
    // and it is marked so nobody mistakes the placement for original layout.
    endDayButton = element("button", "cm-status-bar__end-day", "END DAY");
    endDayButton.type = "button";
    endDayButton.dataset.provisionalPlacement = "SUBMENU_NOT_BUILT";
    endDayButton.setAttribute("aria-label", uiText("End the day"));
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
    const height = Math.ceil(bar.getBoundingClientRect().height);
    if (height > 0) host.style.setProperty("--cm-status-bar-height", `${height}px`);
  }
  syncHeight();
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(syncHeight) : null;
  resizeObserver?.observe(bar);

  const dayNumber = day.querySelector(".cm-status-bar__day-number");

  return Object.freeze({
    element: bar,

    /**
     * @param {object} reading
     * @param {string} [reading.seasonName]
     * @param {number} [reading.dayNumber] already 1-based; the raw slot is never shown
     * @param {string} [reading.time] HH:MM
     * @param {string} [reading.screen] screen id, mapped to the original's mode name
     */
    render(reading = {}) {
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
    },

    setEndDayEnabled(enabled) {
      if (endDayButton) endDayButton.disabled = !enabled;
    },

    dispose() {
      resizeObserver?.disconnect();
      delete host.dataset.statusBar;
      host.style.removeProperty("--cm-status-bar-height");
      bar.remove();
    }
  });
}
