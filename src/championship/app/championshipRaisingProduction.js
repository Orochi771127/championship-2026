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
//
// Deliberately NOT here, because it is unverified:
//   - training formulas, stat gains or losses
//   - cage capacity rules, elemental or healing effects
//   - any consequence of relocating a creature
// ROM proves CageDefinition structures exist. It does not prove their semantics.

export const RAISING_PRODUCTION_SCHEMA_VERSION = 1;
export const RAISING_PRODUCTION_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

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
    interactions
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

export function cageOf(state, creatureId) {
  return state.assignments[creatureId] ?? null;
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
  return deepFreeze({
    schemaVersion: RAISING_PRODUCTION_SCHEMA_VERSION,
    authority: RAISING_PRODUCTION_AUTHORITY,
    assignments,
    interactions
  });
}
