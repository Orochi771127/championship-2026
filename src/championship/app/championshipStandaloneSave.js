// Championship Modern -- standalone player save envelope.
//
// This is the standalone Championship 2026 save envelope. It has one storage
// key, its own schema, and its own validation.
//
// The Raising Home slice is stored as the canonical string produced by
// serializeRaisingHomeSaveR2(), so that the existing R2 persistence contract
// -- byte budget, schema version, payload digest -- keeps validating it on the
// way back in. This envelope adds standalone identity around that, nothing more.

import { BITS_WALLET_CAP, SHOP_RECORD_COUNT } from "../shop/shopCatalog.js";
import { createBattleEconomyState, normalizeBattleEconomyState } from "../battle/battleEconomyTransaction.js";
import { createRaisingInstanceIdentityState, normalizeRaisingInstanceIdentityState } from "../raising/raisingInstanceIdentity.js";
import { normalizeGameplayRngState } from "../battle/battleRngChannel.js";
import { normalizeNativeHuntPersistentSave } from "../hunt/capture/nativeHuntPersistentState.js";
import { assertRaisingNativeProfiles, normalizeNativeIndividualProfile } from "../raising/nativeIndividualProfile.js";
import { normalizeRegisteredSpecies, retainOwnedBookSpecies } from "../database/nativeBookRegistration.js";
import { normalizeNativeRaisingHome } from "../raising/nativeRaisingHomeState.js";
import { normalizeNativeTitleProgress } from "../battle/nativeTitleProgression.js";
import { normalizeNativeChampionshipRun } from "../battle/nativeChampionshipRounds.js";
import { normalizeNativeRaisingMessages } from "../raising/nativeRaisingMessages.js";
import { normalizeNativeOpening } from './nativeOpeningState.js';

export const CHAMPIONSHIP_MODERN_SAVE_KEY = "championshipModernSave:v1";
export const CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION = 5;
export const CHAMPIONSHIP_MODERN_SAVE_KIND = "CHAMPIONSHIP_MODERN_STANDALONE_SAVE";

// A player save is small. The forensic catalog tree is ~35MB; a single promoted
// family is far past this. The ceiling is a blunt instrument on purpose: it
// fails long before anything catalog-shaped could be committed.
export const CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES = 64 * 1024;
export const CHAMPIONSHIP_MODERN_SAVE_MAX_DEPTH = 12;

// Deny-by-default. An unknown top-level key is refused rather than carried:
// silently passing unknown keys through is how a catalog ends up in a save.
const ALLOWED_TOP_LEVEL_KEYS_V1 = Object.freeze([
  "schemaVersion", "saveKind", "sessionId", "creature",
  // `raisingHome` is the frozen R2 slice; `raising` is the production slice
  // (cage assignment and product-authored interaction flags). They are kept
  // apart on purpose: R2 is research history, `raising` is product gameplay.
  "raisingHome", "raising", "shop", "cageEdit", "progression", "flags", "updatedAt"
]);
const ALLOWED_TOP_LEVEL_KEYS_V2 = Object.freeze([...ALLOWED_TOP_LEVEL_KEYS_V1, "battleEconomy"]);
const ALLOWED_TOP_LEVEL_KEYS_V3 = Object.freeze([...ALLOWED_TOP_LEVEL_KEYS_V2, "instanceIdentity"]);
const ALLOWED_TOP_LEVEL_KEYS_V4 = Object.freeze([...ALLOWED_TOP_LEVEL_KEYS_V3, "gameplayRng"]);
const ALLOWED_TOP_LEVEL_KEYS = Object.freeze([...ALLOWED_TOP_LEVEL_KEYS_V4, "huntHistory"]);

const ALLOWED_CREATURE_KEYS = Object.freeze(["creatureId", "speciesId", "displayName", "nativeProfile"]);
const ALLOWED_PROGRESSION_KEYS = Object.freeze(["interactionCount", "revision", "tamerRank", "battleBadges", "registeredSpecies", "nativeTitles", "nativeMessages", "nativeOpening", "championshipRun"]);
const ALLOWED_SHOP_KEYS = Object.freeze(["bits", "visibility", "quantities", "cageOwned"]);
const ALLOWED_CAGE_EDIT_KEYS = Object.freeze(["placements", "layoutVersion"]);
const ALLOWED_CAGE_PLACEMENT_KEYS = Object.freeze(["moduleId", "slotIndex"]);

// Every one of these names identifies forensic/evidence data, catalog structure,
// binary provenance, or promotion bookkeeping. None of them has any business in
// a player save: the save references product content by stable ID only.
const FORENSIC_MARKER_KEYS = Object.freeze([
  // catalog artifact + record structure
  "catalogKind", "records", "recordCount", "recordStrideBytes",
  "expectedForensicRecordCount", "recordsDigestSha256", "generatorVersion",
  // evidence claims
  "evidenceClaims", "claims", "claimCount", "claimTopic", "requiredTrace",
  // the six taxonomy dimensions
  "sourceAuthority", "evidenceLevel", "evidenceBasis", "traceState",
  "executionScope", "originalParityClaim",
  // source provenance + legacy dialects
  "provenance", "sourceFile", "sourceRow", "sourcePack", "evidenceDialect",
  "legacyEvidenceStatus", "evidenceFromColumn", "legacyToken",
  // binary metadata
  "romOffset", "binaryOffset", "strideBytes", "overlayId",
  // promotion bookkeeping
  "promotionId", "promotedBy", "artifactDigest", "stagingSha256", "ownerGate"
]);

const FORENSIC_MARKER_SET = new Set(FORENSIC_MARKER_KEYS);

export function saveError(message) {
  const error = new Error(message);
  error.name = "ChampionshipModernSaveError";
  return error;
}

/**
 * Refuse anything forensic-shaped, at any depth, before it can be committed.
 *
 * This is a machine guard, not a convention: the promoted 1,720 records and
 * 34,492 evidence claims are a different authority from Championship Modern
 * product data, and they must never round-trip through a player save.
 */
export function assertNoForensicPayload(value, path = "save", depth = 0) {
  if (depth > CHAMPIONSHIP_MODERN_SAVE_MAX_DEPTH) {
    throw saveError(`SAVE_TOO_DEEP: ${path}`);
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForensicPayload(entry, `${path}[${index}]`, depth + 1));
    return value;
  }
  for (const key of Object.keys(value)) {
    if (FORENSIC_MARKER_SET.has(key)) {
      throw saveError(`FORENSIC_CATALOG_IN_PLAYER_SAVE: ${path}.${key}`);
    }
    assertNoForensicPayload(value[key], `${path}.${key}`, depth + 1);
  }
  return value;
}

function assertAllowedKeys(object, allowed, label) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) throw saveError(`UNEXPECTED_SAVE_KEY: ${label}.${key}`);
  }
}

/**
 * Shop is the durable economy slice: Bits, visibility, quantities, cages.
 * Hunt expedition state still must not appear here.
 */
function normalizeShopSlice(shop) {
  if (shop == null) return null;
  if (typeof shop !== "object" || Array.isArray(shop)) throw saveError("INVALID_SHOP_SLICE");
  assertAllowedKeys(shop, ALLOWED_SHOP_KEYS, "shop");
  if (!Number.isSafeInteger(shop.bits) || shop.bits < 0 || shop.bits > BITS_WALLET_CAP) {
    throw saveError("INVALID_SHOP_BITS");
  }
  if (!Array.isArray(shop.visibility) || shop.visibility.length !== SHOP_RECORD_COUNT) {
    throw saveError("INVALID_SHOP_VISIBILITY");
  }
  if (!Array.isArray(shop.quantities) || shop.quantities.length !== SHOP_RECORD_COUNT) {
    throw saveError("INVALID_SHOP_QUANTITIES");
  }
  for (let index = 0; index < SHOP_RECORD_COUNT; index += 1) {
    const visibility = shop.visibility[index];
    const quantity = shop.quantities[index];
    if (!Number.isSafeInteger(visibility) || visibility < 0 || visibility > 2) {
      throw saveError("INVALID_SHOP_VISIBILITY");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw saveError("INVALID_SHOP_QUANTITIES");
    }
  }
  if (!Array.isArray(shop.cageOwned)) throw saveError("INVALID_SHOP_CAGE_OWNED");
  const cageOwned = [];
  for (const recordIndex of shop.cageOwned) {
    if (!Number.isSafeInteger(recordIndex) || recordIndex < 0 || recordIndex >= SHOP_RECORD_COUNT) {
      throw saveError("INVALID_SHOP_CAGE_OWNED");
    }
    cageOwned.push(recordIndex);
  }
  return {
    bits: shop.bits,
    visibility: [...shop.visibility],
    quantities: [...shop.quantities],
    cageOwned
  };
}

function normalizeCageEditSlice(cageEdit) {
  if (cageEdit == null) return null;
  if (typeof cageEdit !== "object" || Array.isArray(cageEdit)) throw saveError("INVALID_CAGE_EDIT_SLICE");
  assertAllowedKeys(cageEdit, ALLOWED_CAGE_EDIT_KEYS, "cageEdit");
  if (!Array.isArray(cageEdit.placements)) throw saveError("INVALID_CAGE_EDIT_PLACEMENTS");
  const placements = [];
  for (const entry of cageEdit.placements) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw saveError("INVALID_CAGE_EDIT_PLACEMENT");
    assertAllowedKeys(entry, ALLOWED_CAGE_PLACEMENT_KEYS, "cageEdit.placement");
    assertStableId(entry.moduleId, "cageEdit.placement.moduleId");
    if (!Number.isSafeInteger(entry.slotIndex) || entry.slotIndex < 0) {
      throw saveError("INVALID_CAGE_EDIT_SLOT");
    }
    placements.push({ moduleId: entry.moduleId, slotIndex: entry.slotIndex });
  }
  if (cageEdit.layoutVersion !== undefined && cageEdit.layoutVersion !== 'NATIVE_ANCHORS_V1') {
    throw saveError('INVALID_RANCH_LAYOUT_VERSION');
  }
  return { ...(cageEdit.layoutVersion ? { layoutVersion: cageEdit.layoutVersion } : {}), placements };
}

function normalizeBattleEconomySlice(battleEconomy) {
  const normalized = normalizeBattleEconomyState(battleEconomy);
  // No battle runtime snapshot or original mid-match resume contract exists.
  // Preserve manual save timing; refuse an unfinished attempt instead of losing
  // its fee, inventing a refund, or restoring a fabricated result.
  if (normalized.active !== null) throw saveError("SAVE_WHILE_BATTLE_ACTIVE");
  return normalized;
}

function assertStableId(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9:_-]{3,96}$/i.test(value)) {
    throw saveError(`INVALID_STABLE_ID: ${label}`);
  }
  return value;
}

/** Structural copy. Refuses functions, symbols and class instances outright: a
 *  player save is plain data, and anything else is a bug or an attack. */
function clonePlain(value, path = "save.raising", depth = 0) {
  if (depth > CHAMPIONSHIP_MODERN_SAVE_MAX_DEPTH) throw saveError(`SAVE_TOO_DEEP: ${path}`);
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") return value;
  if (Array.isArray(value)) return value.map((entry, i) => clonePlain(entry, `${path}[${i}]`, depth + 1));
  if (type === "object") {
    const out = {};
    for (const key of Object.keys(value)) out[key] = clonePlain(value[key], `${path}.${key}`, depth + 1);
    return out;
  }
  throw saveError(`UNSUPPORTED_SAVE_VALUE: ${path}`);
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

/**
 * Build a standalone save envelope.
 *
 * `raisingHomeSerialized` is the canonical string from serializeRaisingHomeSaveR2().
 * It is parsed and scanned here as well as validated on the way back in: a string
 * is opaque to a key scan, so a forensic payload smuggled inside one would sail
 * past the guard if the guard only looked at the envelope.
 */
export function createChampionshipModernSave({
  sessionId,
  creature,
  raisingHomeSerialized,
  raising = null,
  shop = null,
  cageEdit = null,
  battleEconomy = createBattleEconomyState(),
  instanceIdentity,
  gameplayRng = null,
  huntHistory = null,
  progression = {},
  flags = {},
  updatedAt = new Date().toISOString()
} = {}) {
  assertStableId(sessionId, "sessionId");
  if (!creature || typeof creature !== "object") throw saveError("MISSING_CREATURE");
  assertAllowedKeys(creature, ALLOWED_CREATURE_KEYS, "creature");
  assertStableId(creature.creatureId, "creature.creatureId");
  assertStableId(creature.speciesId, "creature.speciesId");
  if (typeof creature.displayName !== "string" || creature.displayName.length === 0 || creature.displayName.length > 64) {
    throw saveError("INVALID_CREATURE_DISPLAY_NAME");
  }
  if (typeof raisingHomeSerialized !== "string" || raisingHomeSerialized.length === 0) {
    throw saveError("MISSING_RAISING_HOME_SLICE");
  }

  assertAllowedKeys(progression, ALLOWED_PROGRESSION_KEYS, "progression");
  const battleBadges = Object.hasOwn(progression, "battleBadges") ? progression.battleBadges : [];
  if (!Array.isArray(battleBadges) || battleBadges.length > 62 || new Set(battleBadges).size !== battleBadges.length
    || [...battleBadges].some(n=>!Number.isInteger(n) || n<0 || n>61)) throw saveError("INVALID_BATTLE_BADGES");
  assertRaisingNativeProfiles(raising);
  if(raising?.nativeHome!==undefined)normalizeNativeRaisingHome(raising.nativeHome);
  const registeredSpecies = retainOwnedBookSpecies(
    normalizeRegisteredSpecies(progression.registeredSpecies), creature, raising?.collection ?? []);

  let nested;
  try {
    nested = JSON.parse(raisingHomeSerialized);
  } catch {
    throw saveError("RAISING_HOME_SLICE_IS_NOT_JSON");
  }
  assertNoForensicPayload(nested, "save.raisingHome");
  // Only allocation history is added. Identity/species/name remain in the
  // existing starter, R2 resident and Raising collection slices.
  const identitySources = {
    creature,
    residents: nested.payload?.residents ?? [],
    collection: raising?.collection ?? [],
    assignments: raising?.assignments ?? {},
    interactions: raising?.interactions ?? {}
  };

  const save = {
    schemaVersion: CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION,
    saveKind: CHAMPIONSHIP_MODERN_SAVE_KIND,
    sessionId,
    creature: {
      creatureId: creature.creatureId,
      speciesId: creature.speciesId,
      displayName: creature.displayName,
      ...(Object.hasOwn(creature,"nativeProfile") ? {nativeProfile:normalizeNativeIndividualProfile(creature.nativeProfile,creature.speciesId)} : {})
    },
    raisingHome: raisingHomeSerialized,
    raising: raising === null ? null : clonePlain(raising),
    shop: normalizeShopSlice(shop),
    cageEdit: normalizeCageEditSlice(cageEdit),
    battleEconomy: normalizeBattleEconomySlice(battleEconomy),
    gameplayRng: normalizeGameplayRngState(gameplayRng),
    huntHistory: normalizeNativeHuntPersistentSave(huntHistory),
    instanceIdentity: instanceIdentity === undefined
      ? createRaisingInstanceIdentityState(identitySources)
      : normalizeRaisingInstanceIdentityState(instanceIdentity, identitySources),
    progression: {
      ...(progression.nativeTitles!==undefined?{nativeTitles:normalizeNativeTitleProgress(progression.nativeTitles)}:{}),
      // A tournament runs over several rounds, and a browser tab can close
      // between them, so the run is carried. Whether the original's own save
      // carries its run is not traced -- see
      // docs/research/CHAMPIONSHIP_RUN_PERSISTENCE_2026-09-11.json.
      ...(progression.championshipRun===undefined?{}
        :{championshipRun:progression.championshipRun===null?null
          :normalizeNativeChampionshipRun(progression.championshipRun)}),
      ...(progression.nativeMessages!==undefined?{nativeMessages:normalizeNativeRaisingMessages(progression.nativeMessages)}:{}),
      ...(progression.nativeOpening!==undefined?{nativeOpening:normalizeNativeOpening(progression.nativeOpening)}:{}),
      registeredSpecies: [...registeredSpecies],
      // Only wins observed by this build are carried. Legacy saves did not
      // retain this history; missing badges are not reconstructed from guesses.
      battleBadges: [...battleBadges].sort((a,b)=>a-b),
      interactionCount: Number.isSafeInteger(progression.interactionCount) ? progression.interactionCount : 0,
      revision: Number.isSafeInteger(progression.revision) ? progression.revision : 0,
      tamerRank: Number.isSafeInteger(progression.tamerRank) && progression.tamerRank > 0
        ? Math.min(progression.tamerRank, 65535)
        : 0
    },
    flags: { newGameCompleted: flags.newGameCompleted === true },
    updatedAt
  };

  assertAllowedKeys(save, ALLOWED_TOP_LEVEL_KEYS, "save");
  if (save.battleEconomy.settledThrough > 0 && save.shop === null) throw saveError("MISSING_BATTLE_WALLET_SLICE");
  assertNoForensicPayload(save);
  return save;
}

export function serializeChampionshipModernSave(save) {
  assertAllowedKeys(save, ALLOWED_TOP_LEVEL_KEYS, "save");
  if (save.schemaVersion !== CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION) throw saveError("SAVE_SCHEMA_VERSION_UNSUPPORTED");
  assertNoForensicPayload(save);
  const text = JSON.stringify(save);
  const bytes = byteLength(text);
  if (bytes > CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES) {
    throw saveError(`SAVE_EXCEEDS_BYTE_BUDGET: ${bytes} > ${CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES}`);
  }
  // Validate the complete boundary even if a caller bypassed the constructor.
  deserializeChampionshipModernSave(text);
  return text;
}

/**
 * Parse a stored save. A malformed save must fail safely -- it never throws past
 * the caller in a way that would strand the player with an unopenable game; the
 * app treats a rejected save as "no save" and offers New Game.
 */
export function deserializeChampionshipModernSave(text) {
  if (typeof text !== "string" || text.length === 0) throw saveError("EMPTY_SAVE");
  if (byteLength(text) > CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES) throw saveError("SAVE_EXCEEDS_BYTE_BUDGET");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw saveError("SAVE_IS_NOT_JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw saveError("SAVE_IS_NOT_AN_OBJECT");
  if (parsed.saveKind !== CHAMPIONSHIP_MODERN_SAVE_KIND) throw saveError("SAVE_KIND_MISMATCH");
  const isV1 = parsed.schemaVersion === 1;
  const isV2 = parsed.schemaVersion === 2;
  const isV3 = parsed.schemaVersion === 3;
  const isV4 = parsed.schemaVersion === 4;
  const missingRngHistory = isV1 || isV2 || isV3;
  const legacy = missingRngHistory || isV4;
  if (!legacy && parsed.schemaVersion !== CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION) throw saveError("SAVE_SCHEMA_VERSION_UNSUPPORTED");
  assertAllowedKeys(parsed, isV1 ? ALLOWED_TOP_LEVEL_KEYS_V1 : isV2 ? ALLOWED_TOP_LEVEL_KEYS_V2 : isV3 ? ALLOWED_TOP_LEVEL_KEYS_V3 : isV4 ? ALLOWED_TOP_LEVEL_KEYS_V4 : ALLOWED_TOP_LEVEL_KEYS, "save");
  assertNoForensicPayload(parsed);
  if (!isV1 && !Object.hasOwn(parsed, "battleEconomy")) throw saveError("MISSING_BATTLE_ECONOMY_SLICE");
  if (!isV1 && !isV2 && !Object.hasOwn(parsed, "instanceIdentity")) throw saveError("MISSING_INSTANCE_IDENTITY_SLICE");
  if (!missingRngHistory && !Object.hasOwn(parsed, "gameplayRng")) throw saveError("MISSING_GAMEPLAY_RNG_SLICE");
  if (!legacy && !Object.hasOwn(parsed, "huntHistory")) throw saveError("MISSING_HUNT_HISTORY_SLICE");

  // Rebuilt rather than returned as parsed, so a stored save cannot introduce a
  // shape the constructor would have refused.
  return createChampionshipModernSave({
    sessionId: parsed.sessionId,
    creature: parsed.creature,
    raisingHomeSerialized: parsed.raisingHome,
    raising: parsed.raising ?? null,
    shop: parsed.shop ?? null,
    cageEdit: parsed.cageEdit ?? null,
    // Explicit v1..v4 -> v5 migration at the same key. The canonical R2 string
    // and old payload digest pass through unchanged until the normal restore.
    battleEconomy: isV1 ? createBattleEconomyState() : parsed.battleEconomy,
    instanceIdentity: isV1 || isV2 ? undefined : parsed.instanceIdentity,
    gameplayRng: missingRngHistory ? null : parsed.gameplayRng,
    // Older Web saves never recorded this slice. Do not invent a blank past.
    huntHistory: legacy ? null : parsed.huntHistory,
    progression: parsed.progression ?? {},
    flags: parsed.flags ?? {},
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
  });
}
