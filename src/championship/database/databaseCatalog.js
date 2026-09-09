// OVL16 allocates 216 list rows at 0210BDAC and reads 020EF09C in order.
// Egg records 0..7 and duplicate form records 224..227 are not book entries.
import { deepFreeze } from "../contracts/championshipContracts.js";
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };
import { NATIVE_REGULAR_BOOK_SPECIES } from "../../data/championship/nativeBookSpecies.js";

export const DATABASE_SLOT_COUNT = 216;
export const DATABASE_EGG_COUNT = 0;
export const DATABASE_REGULAR_COUNT = 216;
export const DATABASE_CATALOG_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";
export const DATABASE_SLOT_ORDINAL_EVIDENCE = "ROM_VERIFIED_020EF09C_OVL16";
export const DATABASE_UNLOCK_EVIDENCE = "ROM_VERIFIED_02116A20_REGISTRATION";
export const DATABASE_SLOT_KINDS = deepFreeze({ REGULAR: "REGULAR" });

const slots = deepFreeze(NATIVE_REGULAR_BOOK_SPECIES.map((speciesIndex, bookOrdinal) => ({
  bookOrdinal,
  speciesIndex,
  speciesId: `species-${String(speciesIndex).padStart(3, "0")}`,
  displayName: speciesCatalog.records[speciesIndex].identifier,
  kind: DATABASE_SLOT_KINDS.REGULAR,
  identityEvidence: "VERIFIED_BINARY"
})));
const bySpecies = new Map(slots.map(slot => [slot.speciesIndex, slot]));

export function listDatabaseSlots() { return slots; }

// The public selector accepts a species record, never a book ordinal.
export function getDatabaseSlot(speciesIndex) {
  const slot = bySpecies.get(speciesIndex);
  if (!slot) throw new Error(`UNKNOWN_DATABASE_SLOT: ${speciesIndex}`);
  return slot;
}

export function getDatabaseSlotBySpeciesId(speciesId) {
  return slots.find(slot => slot.speciesId === speciesId) ?? null;
}
