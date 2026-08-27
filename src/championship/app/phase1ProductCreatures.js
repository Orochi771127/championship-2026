// Championship Modern -- Phase 1 first-creature source.
//
// The playable creature must come from product-authored Championship data. It
// must NOT be auto-promoted out of the generated forensic catalogs: those carry
// a different authority (ORIGINAL_CHAMPIONSHIP_DERIVED) and remain inert.
//
// catalogKind does NOT discriminate the two -- the hand-authored and the
// generated entities catalogs both declare
// "championship:2026:catalog:entities". `authority` is the real signal, and an
// artifactKind field marks a promotion artifact. Both are checked.

export const PRODUCT_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";
export const PHASE_1_FIRST_RESIDENT_ID = "resident:greyshade-cat";

function sourceError(message) {
  const error = new Error(message);
  error.name = "ChampionshipProductSourceError";
  return error;
}

/**
 * Accept only a product-authored entities catalog.
 *
 * A promotion artifact is refused by authority and by artifactKind, so a
 * forensic catalog swapped in here cannot become a runtime product entity.
 */
export function assertProductAuthoredCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") throw sourceError("PRODUCT_CATALOG_REQUIRED");
  if (catalog.authority !== PRODUCT_AUTHORITY) {
    throw sourceError(`NON_PRODUCT_CATALOG_AUTHORITY: ${catalog.authority}`);
  }
  if (catalog.artifactKind !== undefined) {
    throw sourceError(`FORENSIC_ARTIFACT_REFUSED_AS_PRODUCT_SOURCE: ${catalog.artifactKind}`);
  }
  if (!Array.isArray(catalog.records) || catalog.records.length === 0) {
    throw sourceError("PRODUCT_CATALOG_HAS_NO_RECORDS");
  }
  return catalog;
}

/**
 * Resolve the Phase 1 starting creature.
 *
 * Returns stable IDs and a display name only -- never the catalog record. The
 * record carries sourceAuthority and other evidence-shaped fields that the
 * standalone save refuses by design.
 */
export function selectPhase1FirstCreature(catalog, { residentId = PHASE_1_FIRST_RESIDENT_ID } = {}) {
  assertProductAuthoredCatalog(catalog);
  const speciesKey = residentId.startsWith("resident:") ? residentId.slice("resident:".length) : residentId;
  const record = catalog.records.find((entry) => {
    if (entry?.sourceAuthority !== PRODUCT_AUTHORITY) return false;
    const id = typeof entry.speciesId === "string" ? entry.speciesId : "";
    return id === speciesKey || id.endsWith(`:${speciesKey}`);
  });
  if (!record) throw sourceError(`NO_PRODUCT_CREATURE_FOR_RESIDENT: ${residentId}`);
  return Object.freeze({
    creatureId: residentId,
    speciesId: record.speciesId,
    displayName: record.displayName
  });
}
