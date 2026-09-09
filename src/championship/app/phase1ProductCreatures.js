// Championship Modern -- the starting creature, sourced from the cartridge.
//
// WHAT CHANGED AND WHY
// --------------------
// This file used to select from three product-authored creatures that were
// invented for VS1 and never existed in the original. The Owner directed on
// 2026-09-03 that nothing outside the ROM stays in the product, so the source is
// now the transcribed species table.
//
// The identity fields come from ARM9 0x020C1374, 228 records of 0x84 bytes,
// traced from the OVL18 raising read sites:
//
//     +0x00  pointer to a NUL-terminated ASCII identifier
//     +0x0C  generation index   (7 values)
//     +0x10  attribute index    (5 values)
//     +0x18  species-family bitmask (zero, or one of eight single bits)
//
// This catalog adapter exposes species identity only. The app constructs the
// original initial individual through nativeRaisingStarter, including its
// native name and persistent stats, with the existing gameplay RNG.

export const PRODUCT_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

/**
 * The starting creature is an egg.
 *
 * The eight eggs are the records carrying generation 0 and family 0, and the
 * cartridge yields exactly eight of them, matching the documented 224 = 8 eggs
 * plus 216 regular entities.
 * ARM9 0206178C passes species index 0 to 02062100. The app now attaches that
 * constructor's actual individual profile; this catalog function owns identity.
 */
export const STARTING_GENERATION_INDEX = 0;
export const STARTING_FAMILY_BITS = 0;
export const STARTING_SELECTION_EVIDENCE = "ROM_VERIFIED_0206178C_SPECIES_ZERO";

function sourceError(message) {
  const error = new Error(message);
  error.name = "ChampionshipProductSourceError";
  return error;
}

/**
 * Accept only the transcribed species catalog.
 *
 * The old guard refused a forensic promotion artifact from becoming a runtime
 * entity. That guard is kept: `artifactKind` is still refused, and the catalog
 * must declare the species catalogKind so an unrelated table cannot be passed in.
 */
export function assertSpeciesCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") throw sourceError("SPECIES_CATALOG_REQUIRED");
  if (catalog.authority !== PRODUCT_AUTHORITY) {
    throw sourceError(`NON_PRODUCT_CATALOG_AUTHORITY: ${catalog.authority}`);
  }
  if (catalog.artifactKind !== undefined) {
    throw sourceError(`FORENSIC_ARTIFACT_REFUSED_AS_PRODUCT_SOURCE: ${catalog.artifactKind}`);
  }
  if (catalog.catalogKind !== "championship:2026:catalog:creature-species") {
    throw sourceError(`UNEXPECTED_CATALOG_KIND: ${catalog.catalogKind}`);
  }
  if (!Array.isArray(catalog.records) || catalog.records.length === 0) {
    throw sourceError("SPECIES_CATALOG_HAS_NO_RECORDS");
  }
  return catalog;
}

/**
 * Stable ids for a species record.
 *
 * The save validator requires residentId === `resident:${speciesId}`, so both
 * are derived here from one function rather than assembled at each call site.
 */
export function speciesIdForRecord(record) {
  return `species-${String(record.recordIndex).padStart(3, "0")}`;
}

export function residentIdForSpecies(record) {
  return `resident:${speciesIdForRecord(record)}`;
}

/** Every egg in the table, in table order. */
export function listStartingEggs(catalog) {
  return assertSpeciesCatalog(catalog).records.filter(
    (record) => record.generationIndex === STARTING_GENERATION_INDEX
      && record.familyBits === STARTING_FAMILY_BITS
  );
}

/**
 * Resolve the starting creature.
 *
 * Returns catalog identity only; individual construction belongs to the app.
 */
export function selectPhase1FirstCreature(catalog, { residentId = null } = {}) {
  assertSpeciesCatalog(catalog);
  const eggs = listStartingEggs(catalog);
  if (eggs.length === 0) throw sourceError("SPECIES_CATALOG_HAS_NO_EGG");

  const record = residentId
    ? catalog.records.find((entry) => residentIdForSpecies(entry) === residentId)
    : eggs.find(entry => entry.recordIndex === 0);
  if (!record) throw sourceError(`NO_SPECIES_FOR_RESIDENT: ${residentId}`);

  // Exactly the three fields the save envelope accepts. Generation, attribute
  // and family are catalog data derivable from the species id, so putting them
  // here would copy the cartridge table into every save -- which is the thing
  // the deny-by-default envelope exists to prevent. Use lookupSpeciesIdentity
  // when a caller needs them.
  return Object.freeze({
    creatureId: residentIdForSpecies(record),
    speciesId: speciesIdForRecord(record),
    displayName: record.identifier
  });
}

/**
 * The full transcribed identity for a species id.
 *
 * Read from the catalog on demand rather than carried in save state. Returns
 * null for an unknown id instead of throwing, because a save restored from an
 * older catalog is a real case and must not take the session down.
 */
export function lookupSpeciesIdentity(catalog, speciesId) {
  const record = assertSpeciesCatalog(catalog).records
    .find((entry) => speciesIdForRecord(entry) === speciesId);
  if (!record) return null;
  return Object.freeze({
    speciesId,
    recordIndex: record.recordIndex,
    displayName: record.identifier,
    generationIndex: record.generationIndex,
    attributeIndex: record.attributeIndex,
    familyBits: record.familyBits,
    identityEvidence: "VERIFIED_BINARY",
    statsEvidence: "UNKNOWN_REQUIRES_TRACE"
  });
}
