// Functional source columns, independent of art and research receipts.
import source from "../../../data/championship/catalogs/hunt-entry.r1.json" with { type: "json" };
import { deepFreeze } from "../../contracts/championshipContracts.js";
import { validateNativeSpeciesInput } from "./nativeHuntIndividual.js";
import { nativeHuntInitialSpeed } from "./nativeHuntActorInitialization.js";

const index = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
if (source.schemaVersion !== 1 || source.contract !== "HUNT_ENTRY_SOURCES.v1"
  || source.species.length !== 228 || source.catalogs.length !== 16 || source.encounters.length !== 32) {
  throw new Error("HUNT_SOURCE_SCHEMA_INVALID");
}
for (const [i, species] of source.species.entries()) {
  validateNativeSpeciesInput(species);
  if (species.speciesIndex !== i) throw new Error("HUNT_SOURCE_SPECIES_ORDER_INVALID");
  nativeHuntInitialSpeed(species, 0);
}
for (const catalog of source.catalogs) {
  if (!Array.isArray(catalog) || !catalog.length || catalog.length > 256 || !catalog.every(e =>
    index(e.speciesIndex, 227) && index(e.releaseMatchValue, 0x700) && !(e.releaseMatchValue & 0xff))) {
    throw new Error("HUNT_SOURCE_CATALOG_INVALID");
  }
}
for (const [i, seasons] of source.encounters.entries()) {
  if (!Array.isArray(seasons) || seasons.length !== 4 || !seasons.every(s => index(s.baseCount, 24)
    && s.baseCount > 0 && Array.isArray(s.entries) && s.entries.length > 0 && s.entries.every(e =>
      index(e.weight, 7) && source.catalogs[i >> 1].some(c => c.speciesIndex === e.speciesIndex)))) {
    throw new Error("HUNT_SOURCE_SEASON_TABLE_INVALID");
  }
}
deepFreeze(source);

export const NATIVE_HUNT_HISTORY_DEFAULT_NAME = source.defaultHistoryName;
export const NATIVE_HUNT_MODIFIER_COUNTS = Object.freeze(source.catalogs.map(c => c.length));

export function nativeHuntSpeciesByIndex(speciesIndex) {
  if (!index(speciesIndex, 227)) throw new Error("HUNT_SOURCE_SPECIES_REQUIRED");
  return source.species[speciesIndex];
}

export function nativeHuntCatalogForBiome(biomeIndex) {
  if (!index(biomeIndex, 15)) throw new Error("HUNT_SOURCE_BIOME_REQUIRED");
  return source.catalogs[biomeIndex];
}

export function validateNativeHuntModifiers(modifiers, maxValue = 255) {
  if (!Array.isArray(modifiers) || modifiers.length !== NATIVE_HUNT_MODIFIER_COUNTS.length
    || !modifiers.every((row, i) => Array.isArray(row) && row.length === NATIVE_HUNT_MODIFIER_COUNTS[i]
      && row.every(v => index(v, maxValue)))) throw new Error("HUNT_SOURCE_MODIFIERS_REQUIRED");
  return modifiers;
}

// Native Hunt index is a verified caller input, not the alphabetic browser
// Gate ordinal. No guessed day/night, season, history or terrain defaults.
export function resolveNativeHuntPoolSources({ nativeHuntIndex, season, modifiers } = {}) {
  if (!index(nativeHuntIndex, 31)) throw new Error("HUNT_SOURCE_NATIVE_INDEX_REQUIRED");
  if (!index(season, 3)) throw new Error("HUNT_SOURCE_SEASON_REQUIRED");
  validateNativeHuntModifiers(modifiers);
  const biomeIndex = nativeHuntIndex >> 1;
  const selected = source.encounters[nativeHuntIndex][season];
  return {
    baseCount: selected.baseCount,
    candidateInput: {
      entries: selected.entries,
      speciesOrder: source.catalogs[biomeIndex].map(e => e.speciesIndex),
      reductionBytes: [...modifiers[biomeIndex]]
    },
    speciesByIndex: nativeHuntSpeciesByIndex
  };
}
