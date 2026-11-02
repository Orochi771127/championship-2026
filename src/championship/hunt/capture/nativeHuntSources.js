import {productHuntSpecies} from '../../contracts/productSpeciesData.js';
// Functional source columns, independent of art and research receipts.
import source from "../../../data/championship/catalogs/hunt-entry.r1.json" with { type: "json" };
import overlay from "../../../data/championship/product-hunt-overlay.r1.json" with { type: "json" };
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
  return productHuntSpecies(speciesIndex);
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
  return resolvePool(source, { nativeHuntIndex, season, modifiers });
}

function resolvePool(tables, { nativeHuntIndex, season, modifiers } = {}) {
  if (!index(nativeHuntIndex, 31)) throw new Error("HUNT_SOURCE_NATIVE_INDEX_REQUIRED");
  if (!index(season, 3)) throw new Error("HUNT_SOURCE_SEASON_REQUIRED");
  validateNativeHuntModifiers(modifiers);
  const biomeIndex = nativeHuntIndex >> 1;
  const selected = tables.encounters[nativeHuntIndex][season];
  return {
    baseCount: selected.baseCount,
    candidateInput: {
      entries: selected.entries,
      speciesOrder: tables.catalogs[biomeIndex].map(e => e.speciesIndex),
      reductionBytes: [...modifiers[biomeIndex]]
    },
    speciesByIndex: nativeHuntSpeciesByIndex
  };
}

// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): the hunts the app runs. Former
// 覺醒體/究極體 are battle burst forms and cannot be caught, so each of their catalog slots -- same position,
// same encounter weights -- goes to a 成熟期 that bursts into it or to a species no hunt offered
// (product-hunt-overlay.r1.json, scripts/build-product-hunt-overlay.mjs). Catalog lengths, and so saved
// modifiers, are unchanged. The native tables above stay the ROM's and keep serving parity.
const productTables = (() => {
  const catalogs = source.catalogs.map(catalog => catalog.map(entry => ({ ...entry })));
  const swap = new Map();
  for (const r of overlay.replacements) {
    if (catalogs[r.biome]?.[r.position]?.speciesIndex !== r.from || !index(r.to, 227)) throw new Error("PRODUCT_HUNT_OVERLAY_INVALID");
    catalogs[r.biome][r.position].speciesIndex = r.to;
    swap.set(`${r.biome}:${r.from}`, r.to);
  }
  const dropped = new Set(overlay.dropped.map(d => `${d.biome}:${d.species}`));
  const encounters = source.encounters.map((seasons, field) => seasons.map(season => ({ baseCount: season.baseCount,
    entries: season.entries.filter(e => !dropped.has(`${field >> 1}:${e.speciesIndex}`))
      .map(e => ({ speciesIndex: swap.get(`${field >> 1}:${e.speciesIndex}`) ?? e.speciesIndex, weight: e.weight })) })));
  catalogs.forEach(catalog => {
    if (new Set(catalog.map(e => e.speciesIndex)).size !== catalog.length) throw new Error("PRODUCT_HUNT_OVERLAY_INVALID");
  });
  encounters.forEach((seasons, field) => seasons.forEach(season => {
    if (!season.entries.length || !season.entries.every(e => catalogs[field >> 1].some(c => c.speciesIndex === e.speciesIndex))) {
      throw new Error("PRODUCT_HUNT_OVERLAY_INVALID");
    }
  }));
  return deepFreeze({ catalogs, encounters });
})();

export function productHuntCatalogForBiome(biomeIndex) {
  if (!index(biomeIndex, 15)) throw new Error("HUNT_SOURCE_BIOME_REQUIRED");
  return productTables.catalogs[biomeIndex];
}

export function resolveProductHuntPoolSources({ nativeHuntIndex, season, modifiers } = {}) {
  return resolvePool(productTables, { nativeHuntIndex, season, modifiers });
}

