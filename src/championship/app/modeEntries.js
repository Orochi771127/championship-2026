// Mode entries (2026-10-21): one place that says where an additional game mode
// is entered and whether it is open, teased or hidden. Screens read this; a new
// mode is enabled by data (MODE_ENTRY_RECORD below), so the
// menus never need another layout pass. Contract:
// docs/contracts/championship/MODE_ENTRY_INTERFACE_2026-10-21.md
//
//   OPEN    the entry works (it names a screen or an action the app handles)
//   PREVIEW the entry is shown as 「即將開放」, cannot be pressed, takes one row
//   HIDDEN  nothing is drawn -- no empty slot is left behind
// The shipped record. A new mode is added here, not by editing screens.
export const MODE_ENTRY_RECORD = Object.freeze({
  schemaVersion: 1,
  entries: Object.freeze([
    Object.freeze({ id: "dataArena", surface: "BATTLE_SELECT", state: "OPEN", label: "數據競技場", hint: "即時操作的原創挑戰賽" })
  ])
});

export const MODE_ENTRY_STATES = Object.freeze({ OPEN: "OPEN", PREVIEW: "PREVIEW", HIDDEN: "HIDDEN" });
export const MODE_ENTRY_SURFACES = Object.freeze(["MENU_GO", "BATTLE_SELECT"]);
const ID = /^[a-z][A-Za-z0-9]{1,39}$/;

/** Validate a mode-entry document; an invalid entry is dropped, never guessed. */
export function normalizeModeEntries(document) {
  const list = Array.isArray(document?.entries) ? document.entries : [];
  const seen = new Set();
  const entries = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || !ID.test(raw.id ?? "") || seen.has(raw.id)) continue;
    if (!MODE_ENTRY_SURFACES.includes(raw.surface) || !Object.values(MODE_ENTRY_STATES).includes(raw.state)) continue;
    if (typeof raw.label !== "string" || !raw.label.trim()) continue;
    const opens = typeof raw.screen === "string" || typeof raw.action === "string";
    // An OPEN menu entry must lead somewhere; otherwise it can only be a preview.
    const state = raw.surface === "MENU_GO" && raw.state === MODE_ENTRY_STATES.OPEN && !opens ? MODE_ENTRY_STATES.PREVIEW : raw.state;
    seen.add(raw.id);
    entries.push(Object.freeze({ id: raw.id, surface: raw.surface, state, label: raw.label.trim(),
      hint: typeof raw.hint === "string" ? raw.hint : "", ...(opens ? { screen: raw.screen ?? null, action: raw.action ?? null } : {}) }));
  }
  return Object.freeze(entries);
}

export const MODE_ENTRIES = normalizeModeEntries(MODE_ENTRY_RECORD);

/** A mode's state; a mode with no record keeps working (OPEN). */
export function modeEntryState(id, entries = MODE_ENTRIES) {
  return entries.find((entry) => entry.id === id)?.state ?? MODE_ENTRY_STATES.OPEN;
}

/** Toolbar entries for the 出發 group: open ones lead somewhere, previews are inert. */
export function modeMenuEntries(entries = MODE_ENTRIES) {
  return Object.freeze(entries.filter((entry) => entry.surface === "MENU_GO" && entry.state !== MODE_ENTRY_STATES.HIDDEN)
    .map((entry) => Object.freeze({ id: entry.id, label: entry.label, hint: entry.hint, mode: true,
      ...(entry.state === MODE_ENTRY_STATES.OPEN ? { screen: entry.screen ?? undefined, action: entry.action ?? undefined } : { preview: true }) })));
}
