// Championship 2026 -- product-local forbidden storage key policy.
//
// WHY THIS FILE NAMES WHAT IT BLOCKS
// ----------------------------------
// Every other file under src/ is forbidden from containing a Nexus Link
// namespace at all, and the migration firewall test enforces that by text scan.
// This file is the single, explicitly allow-listed exception, because a
// deny-list cannot block a name it is not allowed to write down. Naming a
// namespace in order to refuse it is the opposite of depending on it: nothing
// here imports, reads, or reaches into another application.
//
// This module is a pure policy leaf. It has no imports, touches no Storage, and
// performs no I/O. The one durable writer in the product
// (ChampionshipPersistentSavePort) applies it at the storage boundary.

export const CHAMPIONSHIP_FORBIDDEN_STORAGE_KEY_ERROR = "ChampionshipForbiddenStorageKeyError";

// Recovered from this repository's own coordination record: the historical save
// namespace of the application Championship used to be a feature of. Championship
// 2026 is standalone and must never read or write it, so that a Championship
// build installed beside historical data can neither consume nor corrupt it.
export const FORBIDDEN_HISTORICAL_STORAGE_KEYS = Object.freeze([
  "nexusLinkR2State:v1"
]);

// Product-authored defence in depth, not recovered evidence. The exact key above
// is the only one on record; these patterns refuse the whole historical
// namespace so that a variant, a later revision, or a typo cannot slip through.
export const FORBIDDEN_STORAGE_KEY_PATTERNS = Object.freeze([
  /^nexus[-._:]?link/i,
  /^nexus[-._:]/i
]);

// The one namespace this product owns. Declared here so the guard can state a
// positive rule as well as a negative one.
export const CHAMPIONSHIP_STORAGE_KEY_PREFIX = "championshipModernSave";

export function forbiddenStorageKeyError(key, reason) {
  const error = new Error(`FORBIDDEN_STORAGE_KEY: ${key} (${reason})`);
  error.name = CHAMPIONSHIP_FORBIDDEN_STORAGE_KEY_ERROR;
  error.storageKey = key;
  return error;
}

/**
 * Why a key is refused, or null when it is allowed.
 *
 * A non-string key is refused too: a browser Storage write with an undefined key
 * stringifies to a real `"undefined"` entry, and a save authority that accepts
 * that is not an authority.
 */
export function forbiddenStorageKeyReason(key) {
  if (typeof key !== "string" || key.length === 0) return "STORAGE_KEY_MUST_BE_A_NON_EMPTY_STRING";
  if (FORBIDDEN_HISTORICAL_STORAGE_KEYS.includes(key)) return "HISTORICAL_SAVE_NAMESPACE_OUT_OF_PRODUCT_SCOPE";
  if (FORBIDDEN_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
    return "HISTORICAL_SAVE_NAMESPACE_PREFIX_OUT_OF_PRODUCT_SCOPE";
  }
  return null;
}

export function isForbiddenChampionshipStorageKey(key) {
  return forbiddenStorageKeyReason(key) !== null;
}

/** Throws unless `key` may be used by Championship 2026 storage. */
export function assertAllowedChampionshipStorageKey(key) {
  const reason = forbiddenStorageKeyReason(key);
  if (reason) throw forbiddenStorageKeyError(String(key), reason);
  return key;
}
