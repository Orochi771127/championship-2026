// One identity projection over the existing starter, R2 residents and product
// collection. This module owns no roster, storage, simulation or clock.
//
// Exact instance IDs are durable product identities. Species aliases are only
// normalized for lookup; equal species never imply equal individuals. The
// allocator high-water mark is the only new durable field. Original persistent
// creature records and their growth/battle writers remain untraced, so this
// boundary intentionally returns no player profile or species-base-stat proxy.

import { clonePlainData, deepFreeze } from "../contracts/championshipContracts.js";
import { normalizeNativeIndividualProfile, projectNativeIndividualStats } from "./nativeIndividualProfile.js";

export const RAISING_INSTANCE_ID_PREFIX = "championship:2026:instance:";
export const RAISING_INSTANCE_IDENTITY_EVIDENCE = "PARTIAL";
export const RAISING_INSTANCE_PROFILE_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";

const STABLE_ID = /^[a-z0-9:_-]{3,96}$/i;
const ALLOCATED_ID = /^championship:2026:instance:([0-9]+)$/;

function identityError(message) {
  const error = new TypeError(message);
  error.name = "ChampionshipRaisingInstanceIdentityError";
  return error;
}

function stableId(value, label) {
  if (typeof value !== "string" || !STABLE_ID.test(value)) {
    throw identityError(`INVALID_INSTANCE_IDENTITY: ${label}`);
  }
  return value;
}

/** Only the existing presentation prefix is an alias. No catalog is consulted. */
export function canonicalRaisingSpeciesId(value) {
  stableId(value, "speciesId");
  return stableId(value.replace(/^championship:creature:/, ""), "speciesId");
}

function nullableText(value, label, maximum = 96) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw identityError(`INVALID_INSTANCE_IDENTITY: ${label}`);
  }
  return value;
}

function array(value, label) {
  if (!Array.isArray(value)) throw identityError(`INVALID_INSTANCE_IDENTITY: ${label}`);
  return value;
}

function baseEntry(instanceId, speciesId, displayName, source) {
  return {
    instanceId: stableId(instanceId, "instanceId"),
    speciesId: canonicalRaisingSpeciesId(speciesId),
    displayName: nullableText(displayName, "displayName", 64),
    cageId: null,
    source,
    interaction: null,
    profile: null,
    identityEvidence: RAISING_INSTANCE_IDENTITY_EVIDENCE,
    profileEvidence: RAISING_INSTANCE_PROFILE_EVIDENCE
  };
}

function sourceRecord(kind, residentId = null, entry = {}) {
  return {
    kind,
    residentId,
    successAuthority: nullableText(entry.successAuthority, "successAuthority"),
    enclosedAt: nullableText(entry.enclosedAt, "enclosedAt"),
    originGateId: entry.originGateId == null ? null : stableId(entry.originGateId, "originGateId")
  };
}

/**
 * Sources are the app's existing data, never a second persistent roster.
 * Starter and resident references may describe the same exact ID. All other
 * duplicates or conflicting species are rejected instead of silently repaired.
 * Returned entries are independent immutable projections, including care flags.
 */
export function listRaisingInstances(sources = {}) {
  const {
    creature = null, residents = [], collection = [], assignments = {}, interactions = {}
  } = clonePlainData(sources);
  array(residents, "residents");
  array(collection, "collection");
  const entries = new Map();
  if (creature !== null) {
    const entry = baseEntry(creature.creatureId, creature.speciesId, creature.displayName, sourceRecord("STARTER"));
    if (Object.hasOwn(creature,"nativeProfile")) {
      entry.profile = projectNativeIndividualStats(normalizeNativeIndividualProfile(creature.nativeProfile,creature.speciesId));
      entry.profileEvidence = "ROM_VERIFIED_INDIVIDUAL_FIELDS";
    }
    entries.set(entry.instanceId, entry);
  }
  const residentIds = new Set();
  for (const resident of residents) {
    const instanceId = stableId(resident.residentId, "residentId");
    if (residentIds.has(instanceId)) throw identityError(`DUPLICATE_RESIDENT_ID: ${instanceId}`);
    residentIds.add(instanceId);
    const speciesId = canonicalRaisingSpeciesId(resident.speciesId);
    const existing = entries.get(instanceId);
    if (existing) {
      // The frozen initial R2 resident retains its original catalog identity.
      // A verified persistent form writer changes the same starter's species,
      // never its instance ID. Legacy mismatches still fail without a profile.
      if (existing.speciesId !== speciesId && !creature?.nativeProfile) throw identityError(`INSTANCE_SPECIES_CONFLICT: ${instanceId}`);
      existing.source.residentId = instanceId;
    } else {
      entries.set(instanceId, baseEntry(instanceId, speciesId, resident.name, sourceRecord("RESIDENT", instanceId)));
    }
  }
  for (const captured of collection) {
    const instanceId = stableId(captured.instanceId, "collection.instanceId");
    if (entries.has(instanceId)) throw identityError(`DUPLICATE_INSTANCE_ID: ${instanceId}`);
    const entry = baseEntry(instanceId, captured.speciesId, captured.displayName, sourceRecord("COLLECTION", null, captured));
    if (Object.hasOwn(captured,"nativeProfile")) {
      const native = normalizeNativeIndividualProfile(captured.nativeProfile, captured.speciesId);
      entry.profile = projectNativeIndividualStats(native);
      entry.profileEvidence = "ROM_VERIFIED_INDIVIDUAL_FIELDS";
    }
    entries.set(instanceId, entry);
  }
  for (const entry of entries.values()) {
    const cageId = assignments?.[entry.instanceId];
    entry.cageId = cageId == null ? null : stableId(cageId, "cageId");
    const interaction = interactions?.[entry.instanceId];
    if (interaction != null) {
      if (!Number.isSafeInteger(interaction.careCount) || interaction.careCount < 0) {
        throw identityError(`INVALID_INSTANCE_INTERACTION: ${entry.instanceId}`);
      }
      entry.interaction = {
        careCount: interaction.careCount,
        lastCaredAt: nullableText(interaction.lastCaredAt, "lastCaredAt")
      };
    }
  }
  return deepFreeze([...entries.values()]);
}

/** Unknown IDs stay unresolved. A species ID is never an instance lookup key. */
export function resolveRaisingInstance(sources, instanceId) {
  stableId(instanceId, "instanceId");
  return listRaisingInstances(sources).find((entry) => entry.instanceId === instanceId) ?? null;
}

function minimumNextSequence(sources) {
  // The outer envelope sees durable R2 residents, which deliberately omit
  // species/name. Allocation only needs IDs and must work before restoration.
  const { creature = null, residents = [], collection = [], assignments = {} } = clonePlainData(sources);
  array(residents, "residents");
  array(collection, "collection");
  const ids = [];
  if (creature !== null) ids.push(stableId(creature.creatureId, "creatureId"));
  for (const resident of residents) ids.push(stableId(resident.residentId, "residentId"));
  for (const captured of collection) ids.push(stableId(captured.instanceId, "collection.instanceId"));
  // An assignment can retain an ID after a legacy partial roster import. Never
  // allocate that ID merely because a visible collection entry is absent.
  for (const instanceId of Object.keys(assignments)) ids.push(stableId(instanceId, "assignment.instanceId"));
  let highest = 0;
  for (const instanceId of ids) {
    const match = ALLOCATED_ID.exec(instanceId);
    if (!match) continue;
    const sequence = Number(match[1]);
    if (!Number.isSafeInteger(sequence) || sequence >= Number.MAX_SAFE_INTEGER) {
      throw identityError("INSTANCE_SEQUENCE_EXHAUSTED");
    }
    highest = Math.max(highest, sequence);
  }
  return highest + 1;
}

/**
 * New Game / legacy-save migration. Existing IDs are preserved. A legacy save
 * has no deleted-ID history; only its surviving maximum can be reconstructed.
 * After migration the high-water mark must be preserved even if members leave.
 */
export function createRaisingInstanceIdentityState(sources = {}) {
  return deepFreeze({ nextSequence: minimumNextSequence(sources) });
}

/** A current-schema mark behind any surviving allocated ID is corruption. */
export function normalizeRaisingInstanceIdentityState(value, sources = {}) {
  const state = clonePlainData(value);
  if (!state || Array.isArray(state) || Object.keys(state).length !== 1 || !Object.hasOwn(state, "nextSequence")) {
    throw identityError("INVALID_INSTANCE_IDENTITY_STATE");
  }
  if (!Number.isSafeInteger(state.nextSequence) || state.nextSequence < 1) {
    throw identityError("INVALID_INSTANCE_NEXT_SEQUENCE");
  }
  if (state.nextSequence < minimumNextSequence(sources)) {
    throw identityError("INSTANCE_SEQUENCE_BEHIND_ROSTER");
  }
  return deepFreeze({ nextSequence: state.nextSequence });
}

/**
 * Pure reservation. The app commits the returned state together with its
 * existing collection mutation; calling this function never records capture.
 */
export function allocateRaisingInstanceIdentity(value, sources = {}) {
  const state = normalizeRaisingInstanceIdentityState(value, sources);
  if (state.nextSequence >= Number.MAX_SAFE_INTEGER) throw identityError("INSTANCE_SEQUENCE_EXHAUSTED");
  return deepFreeze({
    state: { nextSequence: state.nextSequence + 1 },
    instanceId: `${RAISING_INSTANCE_ID_PREFIX}${String(state.nextSequence).padStart(4, "0")}`
  });
}
