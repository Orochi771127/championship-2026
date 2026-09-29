// Player preferences: what can be set, its default, and where it belongs.
//
// WHAT THIS IS
// ------------
// PRODUCT_AUTHORED (2026-09-29, settings round). The original has no settings
// screen; everything here is a modern presentation preference. None of it may
// change gameplay, a rule, a timing the simulation reads, or saved progress.
// The game save stays the one authority for progress; preferences are a
// separate, much smaller document written through the same storage boundary
// (ChampionshipPersistentSavePort.js) so the two can never overwrite each other.
//
// SCOPE
// -----
// Every preference is either DEVICE (this phone or this browser: quality,
// volume, text size) or ACCOUNT (a taste that would follow the player to
// another device: theme, language, how highlights play). There is no account
// service yet, so both are stored locally today; the split is kept in the
// stored document so a future sync can carry `account` and leave `device`.
//
// VERSIONING
// ----------
// schemaVersion 1 is the first stored shape. A document without a version is
// read as a flat map of the same ids (the only earlier shape a hand-edited or
// test document could have). A document from a NEWER version is not
// understood, so it is left untouched and the session runs on defaults.

export const PREFERENCES_VERSION = 1;
export const PREFERENCES_KIND = "CHAMPIONSHIP_PREFERENCES";

export const PREFERENCE_SCOPES = Object.freeze({ DEVICE: "device", ACCOUNT: "account" });

/** The settings screen's categories, in display order. */
export const PREFERENCE_CATEGORIES = Object.freeze(["appearance", "quality", "sound", "language", "access", "data"]);

/**
 * When a change is visible. IMMEDIATE means the next frame; NEXT_SCREEN means
 * the next time a scene that reads it is entered; NEXT_LAUNCH means after the
 * game is reopened (the one Pixi Application reads it once, at creation).
 */
export const PREFERENCE_TIMING = Object.freeze({ IMMEDIATE: "IMMEDIATE", NEXT_SCREEN: "NEXT_SCREEN", NEXT_LAUNCH: "NEXT_LAUNCH" });

const DEFINITIONS = {
  // Appearance and display
  theme: { category: "appearance", scope: "account", type: "enum", values: ["night", "clear", "warm", "system"], default: "night" },
  textScale: { category: "appearance", scope: "device", type: "enum", values: [100, 115, 130], default: 100 },
  hudDensity: { category: "appearance", scope: "device", type: "enum", values: ["standard", "compact"], default: "standard" },
  // Quality
  quality: { category: "quality", scope: "device", type: "enum", values: ["auto", "saver", "balanced", "high"], default: "auto" },
  // Sound. Only categories with a real source exist (see audioBus.js).
  muted: { category: "sound", scope: "device", type: "boolean", default: false },
  masterVolume: { category: "sound", scope: "device", type: "integer", min: 0, max: 100, step: 5, default: 100 },
  sfxVolume: { category: "sound", scope: "device", type: "integer", min: 0, max: 100, step: 5, default: 100 },
  // Language
  locale: { category: "language", scope: "account", type: "enum", values: ["zh-Hant", "en"], default: "zh-Hant" },
  // Controls and accessibility
  reducedMotion: { category: "access", scope: "device", type: "enum", values: ["system", "on", "off"], default: "system" },
  flashIntensity: { category: "access", scope: "account", type: "enum", values: ["standard", "soft"], default: "standard" },
  highlightMode: { category: "access", scope: "account", type: "enum", values: ["full", "compact"], default: "full" }
};

export const PREFERENCE_DEFINITIONS = Object.freeze(Object.fromEntries(
  Object.entries(DEFINITIONS).map(([id, definition]) => [id, Object.freeze({
    id,
    ...definition,
    ...(definition.values ? { values: Object.freeze([...definition.values]) } : {})
  })])
));

export const PREFERENCE_IDS = Object.freeze(Object.keys(PREFERENCE_DEFINITIONS));

export const DEFAULT_PREFERENCES = Object.freeze(Object.fromEntries(
  PREFERENCE_IDS.map((id) => [id, PREFERENCE_DEFINITIONS[id].default])
));

/** The ids a category owns, in definition order. */
export function preferenceIdsIn(category) {
  return PREFERENCE_IDS.filter((id) => PREFERENCE_DEFINITIONS[id].category === category);
}

/** A valid value for `id`, or undefined when `value` is not one. Never throws. */
export function coercePreference(id, value) {
  const definition = PREFERENCE_DEFINITIONS[id];
  if (!definition) return undefined;
  if (definition.type === "boolean") return typeof value === "boolean" ? value : undefined;
  if (definition.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const clamped = Math.min(definition.max, Math.max(definition.min, value));
    return Math.round(clamped / definition.step) * definition.step;
  }
  return definition.values.includes(value) ? value : undefined;
}

/**
 * A complete, valid preference set from anything. Unknown ids are dropped,
 * invalid values fall back to their default. Pure.
 */
export function normalizePreferences(values = {}) {
  const source = values && typeof values === "object" ? values : {};
  return Object.freeze(Object.fromEntries(PREFERENCE_IDS.map((id) => {
    const coerced = coercePreference(id, source[id]);
    return [id, coerced === undefined ? PREFERENCE_DEFINITIONS[id].default : coerced];
  })));
}

/** Only the preferences that differ from their defaults, split by scope. */
function splitByScope(preferences) {
  const device = {};
  const account = {};
  for (const id of PREFERENCE_IDS) {
    if (preferences[id] === PREFERENCE_DEFINITIONS[id].default) continue;
    (PREFERENCE_DEFINITIONS[id].scope === "device" ? device : account)[id] = preferences[id];
  }
  return { device, account };
}

/** The stored document for a preference set. Defaults are not written out. */
export function createPreferencesDocument(preferences, { updatedAt = null } = {}) {
  const normalized = normalizePreferences(preferences);
  return { schemaVersion: PREFERENCES_VERSION, kind: PREFERENCES_KIND, updatedAt, ...splitByScope(normalized) };
}

export function serializePreferences(preferences, options) {
  return JSON.stringify(createPreferencesDocument(preferences, options));
}

/**
 * Read a stored document.
 *
 * Returns `{ preferences, status, migratedFrom }` where status is
 *   ABSENT      nothing stored: defaults
 *   OK          a current document
 *   MIGRATED    an older shape, converted; the next write stores it as current
 *   UNREADABLE  not JSON or not an object: defaults, and the text is left alone
 *               until the player changes a setting
 *   NEWER       written by a later version: defaults for this session, and the
 *               document must not be overwritten by this version
 */
export function parsePreferences(text) {
  if (typeof text !== "string" || text.length === 0) {
    return Object.freeze({ preferences: DEFAULT_PREFERENCES, status: "ABSENT", migratedFrom: null });
  }
  let document;
  try { document = JSON.parse(text); } catch {
    return Object.freeze({ preferences: DEFAULT_PREFERENCES, status: "UNREADABLE", migratedFrom: null });
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return Object.freeze({ preferences: DEFAULT_PREFERENCES, status: "UNREADABLE", migratedFrom: null });
  }
  if (document.schemaVersion === undefined) {
    // Version 0: a flat map of ids.
    return Object.freeze({ preferences: normalizePreferences(document), status: "MIGRATED", migratedFrom: 0 });
  }
  if (!Number.isInteger(document.schemaVersion) || document.schemaVersion < 1) {
    return Object.freeze({ preferences: DEFAULT_PREFERENCES, status: "UNREADABLE", migratedFrom: null });
  }
  if (document.schemaVersion > PREFERENCES_VERSION) {
    return Object.freeze({ preferences: DEFAULT_PREFERENCES, status: "NEWER", migratedFrom: null });
  }
  const merged = { ...(document.account ?? {}), ...(document.device ?? {}) };
  return Object.freeze({ preferences: normalizePreferences(merged), status: "OK", migratedFrom: null });
}

// ---- Resolution: a preference plus the environment gives what is applied ----

/** night | clear | warm. "system" follows the OS: dark reads as night, light as clear. */
export function resolveTheme(theme, { prefersDark = true } = {}) {
  if (theme === "system") return prefersDark ? "night" : "clear";
  return ["night", "clear", "warm"].includes(theme) ? theme : "night";
}

/** Whether motion is reduced: the explicit choice wins, else the OS setting. */
export function resolveReducedMotion(choice, { systemReduced = false } = {}) {
  if (choice === "on") return true;
  if (choice === "off") return false;
  return systemReduced === true;
}
