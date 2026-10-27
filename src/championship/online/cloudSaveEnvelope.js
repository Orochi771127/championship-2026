// Cloud save envelope (OWNER_APPROVED_ADAPTATION 2026-10-28), after the
// 2026-09-29 account plan: the server stores the save text untouched inside
// an envelope with a content hash and a display summary. The game's own
// serialize / deserialize stay the only authorities on the text; this module
// never writes storage.

export const CLOUD_SAVE_MAX_BYTES = 262144;

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.digest) {
    const digest = await subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(bytes).digest("hex");
}

/** A small, display-only reading of the save text for the sync and conflict screens. */
export function summarizeSaveText(text) {
  let save = null;
  try { save = JSON.parse(text); } catch { return Object.freeze({ valid: false }); }
  if (!save || typeof save !== "object") return Object.freeze({ valid: false });
  const instances = Array.isArray(save.creature?.instances) ? save.creature.instances.length : Array.isArray(save.raising?.instances) ? save.raising.instances.length : null;
  return Object.freeze({
    valid: true,
    schemaVersion: Number.isInteger(save.schemaVersion) ? save.schemaVersion : null,
    gameRevision: Number.isInteger(save.progression?.revision) ? save.progression.revision : 0,
    trainerName: typeof save.progression?.nativeOpening?.trainerName === "string" ? save.progression.nativeOpening.trainerName : null,
    bits: Number.isInteger(save.shop?.bits) ? save.shop.bits : null,
    roster: instances,
    titles: Array.isArray(save.progression?.badges) ? save.progression.badges.length : null,
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
