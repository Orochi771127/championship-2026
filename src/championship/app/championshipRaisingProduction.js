// Championship Modern -- production Raising state.
//
// This layer exists because the R2 Raising reducer is an adaptation, not
// original gameplay. ORIGINAL_RAISING_GAMEPLAY_CONTRACT records the provenance:
// caretakerPosition, the authored 24x14 grid, the `distance <= 2` gate and the
// care +14 / ease +5 numbers are bounded R2 prototype work with no original
// parity claim. The frozen R2 domain keeps them for the research build; product
// gameplay does not inherit them.
//
// What lives here is only what the product can honestly own:
//   - which cage a creature belongs to        (product-authored placement)
//   - that the player used a care tool on it  (product-authored interaction flag)
//   - Hunt instances brought home by enclosure (collection + cage assignment)
//
// Deliberately NOT here, because it is unverified:
//   - training formulas, stat gains or losses
//   - how much extra stress overfill adds, or which resident field is written
//   - any numeric consequence of relocating a creature
// Channel identity and the recommended Digimon count are VERIFIED_TEXT
// (cageEffects.js). Overfill is allowed (soft cap); extra-stress magnitude
// stays UNKNOWN_REQUIRES_TRACE. VS1 still assigns to two product cages, not
// hex modules — occupancy is not applied here until that membership exists.

import { normalizeNativeIndividualProfile } from "../raising/nativeIndividualProfile.js";
import { normalizeNativeRaisingHome } from "../raising/nativeRaisingHomeState.js";

export const RAISING_PRODUCTION_SCHEMA_VERSION = 1;
export const RAISING_PRODUCTION_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

// Hunt Result has a name-edit plate in the original (OVL4 / ui/hunt/result/name_edit).
// The exact original charset and length are untraced, so this bound is product-authored:
// a short given name, not a paragraph.
export const PRODUCT_GIVEN_NAME_MAX_LENGTH = 24;

function stateError(message) {
  const error = new Error(message);
  error.name = "ChampionshipRaisingProductionError";
  return error;
}

function assertKnown(value, allowed, label) {
  if (!allowed.includes(value)) throw stateError(`${label}: ${value}`);
  return value;
}

/**
 * Every creature starts in the first cage. That is a product-authored default,
 * not an original starting layout -- the original assignment grammar is unknown.
 */
export function createRaisingProductionState({ cageIds = [], creatureIds = [] } = {}) {
  if (cageIds.length < 2) throw stateError("RAISING_REQUIRES_TWO_CAGES");
  const assignments = {};
  const interactions = {};
  for (const creatureId of creatureIds) {
    assignments[creatureId] = cageIds[0];
    interactions[creatureId] = { careCount: 0, lastCaredAt: null };
  }
  return deepFreeze({
    schemaVersion: RAISING_PRODUCTION_SCHEMA_VERSION,
    authority: RAISING_PRODUCTION_AUTHORITY,
    assignments,
    interactions,
    // Enclosed Hunt instances join the product home roster (cage + care),
    // never the frozen R2 resident snapshot.
    collection: []
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/** Move a creature to another cage. No effect is applied: none is known. */
export function assignCreatureToCage(state, creatureId, cageId, { cageIds = [] } = {}) {
  if (!state.assignments[creatureId]) throw stateError(`UNKNOWN_CREATURE: ${creatureId}`);
  assertKnown(cageId, cageIds, "UNKNOWN_CAGE");
  if (state.assignments[creatureId] === cageId) return state;
  return deepFreeze({
    ...state,
    assignments: { ...state.assignments, [creatureId]: cageId }
  });
}

/**
 * Record that a care tool was used.
 *
 * This is a product-authored interaction flag and nothing more. It exists so the
 * reload contract has something real to restore; it is explicitly NOT a stand-in
 * for an original care effect, and no gameplay stat moves because of it.
 */
export function recordCareInteraction(state, creatureId, at = new Date().toISOString()) {
  const current = state.interactions[creatureId];
  if (!current) throw stateError(`UNKNOWN_CREATURE: ${creatureId}`);
  return deepFreeze({
    ...state,
    interactions: {
      ...state.interactions,
      [creatureId]: { careCount: current.careCount + 1, lastCaredAt: at }
    }
  });
}

export function creaturesInCage(state, cageId) {
  return Object.keys(state.assignments).filter((id) => state.assignments[id] === cageId).sort();
}

// Original result release targets one record identity (02062024 / 02061FCC).
// This projection can remove collection-owned records. Frozen R2 residents
// use the canonical v5 resident-membership transaction, never a hidden tombstone.
export function releaseCollectedCreature(state, instanceId) {
  if (!state.collection.some((entry) => entry.instanceId === instanceId)) {
    throw stateError(`UNKNOWN_COLLECTION_INSTANCE: ${instanceId}`);
  }
  return releaseRaisingMembership(state, instanceId);
}

export function releaseRaisingMembership(state, instanceId) {
  if (!Object.hasOwn(state.assignments, instanceId) && !state.collection.some((entry) => entry.instanceId === instanceId)) {
    throw stateError(`UNKNOWN_RAISING_INSTANCE: ${instanceId}`);
  }
  const assignments = { ...state.assignments }, interactions = { ...state.interactions };
  delete assignments[instanceId]; delete interactions[instanceId];
  return deepFreeze({ ...state, assignments, interactions,
    collection: state.collection.filter((entry) => entry.instanceId !== instanceId) });
}

export function cageOf(state, creatureId) {
  return state.assignments[creatureId] ?? null;
}

/**
 * Product-authored given-name rule used by Hunt Result.
 *
 * Original Championship shows a name-edit plate after capture. The ROM length
 * and allowed characters are UNKNOWN_REQUIRES_TRACE, so this only trims, blocks
 * empty/control text, and caps length. It is not a claimed original charset.
 */
export function normalizeProductGivenName(value) {
  if (typeof value !== "string") throw stateError("INVALID_GIVEN_NAME");
  const givenName = value.trim();
  if (givenName.length === 0 || givenName.length > PRODUCT_GIVEN_NAME_MAX_LENGTH) {
    throw stateError("INVALID_GIVEN_NAME");
  }
  if (/[\p{Cc}\p{Cf}]/u.test(givenName)) throw stateError("INVALID_GIVEN_NAME");
  return givenName;
}

function homeCageId(state, requestedCageId) {
  if (typeof requestedCageId === "string" && requestedCageId.length > 0) return requestedCageId;
  const assigned = Object.values(state.assignments ?? {});
  if (assigned.length === 0) throw stateError("RAISING_REQUIRES_CAGE_ASSIGNMENT");
  return assigned[0];
}

function collectionEntry(entry) {
  return {
    instanceId: entry.instanceId,
    speciesId: entry.speciesId,
    displayName: typeof entry.displayName === "string" && entry.displayName.length > 0
      ? entry.displayName
      : null,
    enclosedAt: typeof entry.enclosedAt === "string" ? entry.enclosedAt : null,
    originGateId: typeof entry.originGateId === "string" ? entry.originGateId : null,
    // Preserve the recorded source when restoring or renaming. A legacy entry
    // without this field cannot acquire a success claim from normalization.
    successAuthority: typeof entry.successAuthority === "string" && entry.successAuthority.length > 0
      ? entry.successAuthority
      : null,
    ...(entry.capturedVitals ? { capturedVitals: captureVitals(entry.capturedVitals) } : {}),
    ...(entry.nativeProfile ? { nativeProfile: normalizeNativeIndividualProfile(entry.nativeProfile, entry.speciesId) } : {})
  };
}

function captureVitals(value) {
  if (!Number.isSafeInteger(value?.maxHp) || value.maxHp < 1 || value.maxHp > 32767
    || !Number.isSafeInteger(value.currentHp) || value.currentHp < 0 || value.currentHp > value.maxHp
    || typeof value.traceId !== "string" || !value.traceId || value.traceId.length > 200) {
    throw stateError("INVALID_CAPTURED_VITALS");
  }
  return { currentHp: value.currentHp, maxHp: value.maxHp, traceId: value.traceId };
}

// Only the existing app's result-to-Home transaction calls this after an actual
// on-card transition. Legacy enclosure entries retain their previous provenance.
export function recordNativeGiftCreature(state,entry){
  const next=recordEnclosedCreature(state,{...entry,originGateId:null});
  return deepFreeze({...next,collection:next.collection.map(item=>item.instanceId===entry.instanceId
    ?{...item,successAuthority:'NATIVE_MAIL_GIFT',nativeProfile:normalizeNativeIndividualProfile(entry.nativeProfile,entry.speciesId)}:item)});
}

export function recordCapturedCardCreature(state, entry) {
  const vitals = captureVitals(entry.capturedVitals);
  const next = recordEnclosedCreature(state, entry);
  return deepFreeze({ ...next, collection: next.collection.map((item) => item.instanceId === entry.instanceId
    ? { ...item, successAuthority: entry.nativeProfile ? "NATIVE_NORMAL_HUNT_CONTROLLER" : "ROM_DATAFLOW_REPLAY_NOT_FIELD_PARITY", capturedVitals: vitals,
      ...(entry.nativeProfile ? {nativeProfile:normalizeNativeIndividualProfile(entry.nativeProfile, entry.speciesId)} : {}) } : item) });
}

/**
 * Record one enclosed Hunt instance as a raisable home member.
 *
 * Original capture creates a CreatureInstance that joins the player's collection
 * and Home. This must not mutate the frozen R2 resident snapshot: the instance
 * lives on the product `raising` slice (assignment + collection), which Home
 * presentation then projects as a visible actor.
 */
export function recordEnclosedCreature(state, {
  instanceId,
  speciesId,
  displayName = null,
  enclosedAt = new Date().toISOString(),
  originGateId = null,
  cageId = null
} = {}) {
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    throw stateError("MISSING_INSTANCE_ID");
  }
  if (typeof speciesId !== "string" || speciesId.length === 0) {
    throw stateError("MISSING_SPECIES_ID");
  }
  const existing = Array.isArray(state.collection) ? state.collection : [];
  if (existing.some((entry) => entry.instanceId === instanceId)) {
    throw stateError(`DUPLICATE_INSTANCE: ${instanceId}`);
  }
  const assignedCage = homeCageId(state, cageId);
  const givenName = displayName == null ? null : normalizeProductGivenName(displayName);
  return deepFreeze({
    ...state,
    assignments: { ...state.assignments, [instanceId]: assignedCage },
    interactions: {
      ...state.interactions,
      [instanceId]: { careCount: 0, lastCaredAt: null }
    },
    collection: [
      ...existing,
      collectionEntry({
        instanceId,
        speciesId,
        displayName: givenName,
        enclosedAt,
        originGateId,
        successAuthority: "PRODUCT_AUTHORED_ENCLOSURE"
      })
    ]
  });
}

/** Rename an enclosed instance from Hunt Result. */
export function renameEnclosedCreature(state, instanceId, displayName) {
  const existing = Array.isArray(state.collection) ? state.collection : [];
  const index = existing.findIndex((entry) => entry.instanceId === instanceId);
  if (index < 0) throw stateError(`UNKNOWN_CREATURE: ${instanceId}`);
  const givenName = normalizeProductGivenName(displayName);
  if (existing[index].displayName === givenName) return state;
  const collection = existing.map((entry, entryIndex) => (
    entryIndex === index ? collectionEntry({ ...entry, displayName: givenName }) : entry
  ));
  return deepFreeze({ ...state, collection });
}

/**
 * Rebuild a stored slice, discarding anything unrecognised.
 *
 * A save that names a cage or creature this build does not have is repaired to
 * the default rather than trusted, so a stale or edited save cannot strand a
 * creature in a cage that no longer exists.
 */
export function normalizeRaisingProductionState(input, { cageIds = [], creatureIds = [] } = {}) {
  const base = createRaisingProductionState({ cageIds, creatureIds });
  if (!input || typeof input !== "object") return base;

  const assignments = { ...base.assignments };
  const interactions = { ...base.interactions };
  for (const creatureId of creatureIds) {
    const storedCage = input.assignments?.[creatureId];
    if (typeof storedCage === "string" && cageIds.includes(storedCage)) {
      assignments[creatureId] = storedCage;
    }
    const storedInteraction = input.interactions?.[creatureId];
    if (storedInteraction && typeof storedInteraction === "object") {
      const count = storedInteraction.careCount;
      interactions[creatureId] = {
        careCount: Number.isSafeInteger(count) && count >= 0 ? count : 0,
        lastCaredAt: typeof storedInteraction.lastCaredAt === "string" ? storedInteraction.lastCaredAt : null
      };
    }
  }

  const collection = [];
  if (Array.isArray(input.collection)) {
    for (const entry of input.collection) {
      if (!entry || typeof entry !== "object") continue;
      if (typeof entry.instanceId !== "string" || typeof entry.speciesId !== "string") continue;
      if (collection.some((kept) => kept.instanceId === entry.instanceId)) continue;
      let displayName = null;
      if (typeof entry.displayName === "string") {
        try { displayName = normalizeProductGivenName(entry.displayName); } catch { displayName = null; }
      }
      collection.push(collectionEntry({
        instanceId: entry.instanceId,
        speciesId: entry.speciesId,
        displayName,
        enclosedAt: entry.enclosedAt,
        originGateId: entry.originGateId,
        successAuthority: entry.successAuthority,
        capturedVitals: entry.capturedVitals,
        nativeProfile: entry.nativeProfile
      }));
      const storedCage = input.assignments?.[entry.instanceId];
      assignments[entry.instanceId] = typeof storedCage === "string" && cageIds.includes(storedCage)
        ? storedCage
        : cageIds[0];
      const storedInteraction = input.interactions?.[entry.instanceId];
      if (storedInteraction && typeof storedInteraction === "object") {
        const count = storedInteraction.careCount;
        interactions[entry.instanceId] = {
          careCount: Number.isSafeInteger(count) && count >= 0 ? count : 0,
          lastCaredAt: typeof storedInteraction.lastCaredAt === "string" ? storedInteraction.lastCaredAt : null
        };
      } else {
        interactions[entry.instanceId] = { careCount: 0, lastCaredAt: null };
      }
    }
  }

  return deepFreeze({
    schemaVersion: RAISING_PRODUCTION_SCHEMA_VERSION,
    authority: RAISING_PRODUCTION_AUTHORITY,
    assignments,
    interactions,
    collection,
    ...(input.nativeHome ? {nativeHome:normalizeNativeRaisingHome(input.nativeHome)} : {})
  });
}
