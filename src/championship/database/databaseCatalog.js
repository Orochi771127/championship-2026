// Database catalog — original OVL16 encyclopedia structure.
//
// 224 slots = 8 eggs + 216 regular is the recovered entity count. Unlock and
// filter logic are UNKNOWN_REQUIRES_TRACE, so this module does not invent them.
// Live product species occupy three regular slots with PRODUCT_AUTHORED
// ordinals; remaining slots are labelled placeholders, not ROM names.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const DATABASE_SLOT_COUNT = 224;
export const DATABASE_EGG_COUNT = 8;
export const DATABASE_REGULAR_COUNT = 216;
export const DATABASE_CATALOG_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";
export const DATABASE_SLOT_ORDINAL_EVIDENCE = "PRODUCT_AUTHORED";
export const DATABASE_UNLOCK_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";

export const DATABASE_SLOT_KINDS = deepFreeze({
  EGG: "EGG",
  REGULAR: "REGULAR"
});

/**
 * The three species the current product can actually spawn or start with.
 * Their slot numbers are not original encyclopedia ordinals.
 */
const LIVE_SPECIES = deepFreeze([
  {
    speciesIndex: 8,
    speciesId: "championship:creature:greyshade-cat",
    displayName: "Greyshade Cat"
  },
  {
    speciesIndex: 9,
    speciesId: "championship:creature:blazetail-kit",
    displayName: "Blazetail Kit"
  },
  {
    speciesIndex: 10,
    speciesId: "championship:creature:crystalfin-seahorse",
    displayName: "Crystalfin Seahorse"
  }
]);

const LIVE_BY_INDEX = new Map(LIVE_SPECIES.map((entry) => [entry.speciesIndex, entry]));

function slotRecord(speciesIndex) {
  const live = LIVE_BY_INDEX.get(speciesIndex);
  if (live) {
    return {
      speciesIndex,
      kind: DATABASE_SLOT_KINDS.REGULAR,
      speciesId: live.speciesId,
      displayName: live.displayName,
      identityEvidence: "CHAMPIONSHIP_2026_PRODUCT"
    };
  }
  if (speciesIndex < DATABASE_EGG_COUNT) {
    return {
      speciesIndex,
      kind: DATABASE_SLOT_KINDS.EGG,
      speciesId: `championship:creature:egg-${speciesIndex}`,
      displayName: `Egg ${speciesIndex}`,
      identityEvidence: DATABASE_SLOT_ORDINAL_EVIDENCE
    };
  }
  return {
    speciesIndex,
    kind: DATABASE_SLOT_KINDS.REGULAR,
    speciesId: `championship:creature:slot-${String(speciesIndex).padStart(3, "0")}`,
    displayName: `Species ${speciesIndex - DATABASE_EGG_COUNT}`,
    identityEvidence: DATABASE_SLOT_ORDINAL_EVIDENCE
  };
}

let cached = null;

export function listDatabaseSlots() {
  if (cached) return cached;
  const records = [];
  for (let speciesIndex = 0; speciesIndex < DATABASE_SLOT_COUNT; speciesIndex += 1) {
    records.push(slotRecord(speciesIndex));
  }
  cached = deepFreeze(records);
  return cached;
}

export function getDatabaseSlot(speciesIndex) {
  const record = listDatabaseSlots()[speciesIndex];
  if (!record) throw new Error(`UNKNOWN_DATABASE_SLOT: ${speciesIndex}`);
  return record;
}

export function getDatabaseSlotBySpeciesId(speciesId) {
  return listDatabaseSlots().find((record) => record.speciesId === speciesId) ?? null;
}
