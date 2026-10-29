// Cloud save envelope (OWNER_APPROVED_ADAPTATION 2026-10-28), after the
// 2026-09-29 account plan: the server stores the save text untouched inside
// an envelope with a content hash and a display summary. The game's own
// serialize / deserialize stay the only authorities on the text; this module
// never writes storage.

import { WORLD_CLOCK_CASCADE, DAYS_PER_YEAR } from "../time/championshipWorldClock.js";

export const CLOUD_SAVE_MAX_BYTES = 262144;

/** Calendar days lived in this save (day 1 = the first morning), or null when the year is not recorded. */
function playedDays(save) {
  let clock = null;
  try { clock = typeof save.raisingHome === "string" ? JSON.parse(save.raisingHome)?.payload ?? null : null; } catch { return null; }
  if (!clock || !Number.isInteger(clock.year) || !Number.isInteger(clock.season) || !Number.isInteger(clock.dayOfSeason)) return null;
  return clock.year * DAYS_PER_YEAR + clock.season * WORLD_CLOCK_CASCADE.daysPerSeason + clock.dayOfSeason + 1;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  // Web Crypto is present in every supported browser and in Node 20+ (the test runner); no fallback import, so the browser bundle stays closed.
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** A small, display-only reading of the save text for the sync and conflict screens. */
export function summarizeSaveText(text) {
  let save = null;
  try { save = JSON.parse(text); } catch { return Object.freeze({ valid: false }); }
  if (!save || typeof save !== "object") return Object.freeze({ valid: false });
  // Partners: the starter plus the Raising collection (the production save); older test shapes keep their instance lists.
  const collection = Array.isArray(save.raising?.collection) ? save.raising.collection.length : null;
  const instances = Array.isArray(save.creature?.instances) ? save.creature.instances.length : Array.isArray(save.raising?.instances) ? save.raising.instances.length
    : collection === null ? null : collection + (save.creature?.creatureId ? 1 : 0);
  return Object.freeze({
    valid: true,
    schemaVersion: Number.isInteger(save.schemaVersion) ? save.schemaVersion : null,
    gameRevision: Number.isInteger(save.progression?.revision) ? save.progression.revision : 0,
    trainerName: typeof save.progression?.nativeOpening?.trainerName === "string" ? save.progression.nativeOpening.trainerName : null,
    bits: Number.isInteger(save.shop?.bits) ? save.shop.bits : null,
    roster: instances,
    rank: Number.isInteger(save.progression?.tamerRank) ? save.progression.tamerRank : null,
    days: playedDays(save),
    titles: Array.isArray(save.progression?.battleBadges) ? save.progression.battleBadges.length : Array.isArray(save.progression?.badges) ? save.progression.badges.length : null,
    updatedAt: typeof save.updatedAt === "string" ? save.updatedAt : null
  });
}

export function describeDevice(nav = globalThis.navigator, win = globalThis.window) {
  const ua = String(nav?.userAgent ?? "");
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Device";
  const browser = /CriOS|Chrome/.test(ua) ? "Chrome" : /FxiOS|Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
  const standalone = win?.matchMedia?.("(display-mode: standalone)")?.matches || nav?.standalone === true;
  return `${device} · ${browser}${standalone ? " · App" : ""}`.slice(0, 64);
}

/** Builds what upload_cloud_save needs from the serialized save text. */
export async function buildCloudSaveEnvelope(text, { deviceLabel = describeDevice() } = {}) {
  if (typeof text !== "string" || !text) throw new TypeError("SAVE_TEXT_REQUIRED");
  if (new TextEncoder().encode(text).length > CLOUD_SAVE_MAX_BYTES) throw new RangeError("SAVE_TEXT_TOO_LARGE");
  const summary = summarizeSaveText(text);
  if (!summary.valid) throw new TypeError("SAVE_TEXT_INVALID");
  return Object.freeze({ payload: text, contentSha256: await sha256Hex(text), gameRevision: summary.gameRevision, summary, deviceLabel });
}

/** True when the server echoed the same revision and hash: the only time "已同步" may show. */
export function confirmsSync(result, envelope) {
  return Boolean(result?.ok) && Number.isInteger(result.serverRevision) && result.contentSha256 === envelope?.contentSha256;
}
