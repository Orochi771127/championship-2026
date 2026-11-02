import {listProductExtensions} from '../contracts/productSpeciesExtensions.js';
import {listProductOriginals,isPlayableProductOriginal} from '../contracts/productOriginalSpecies.js';
import { NATIVE_REGULAR_BOOK_SPECIES } from "../../data/championship/nativeBookSpecies.js";

// Playable original characters (Owner 2026-11-03) register like the product extensions.
const regular = new Set([...NATIVE_REGULAR_BOOK_SPECIES,...listProductExtensions().map(e=>e.speciesIndex),
  ...listProductOriginals().filter(e=>isPlayableProductOriginal(e.speciesIndex)).map(e=>e.speciesIndex)]);

export function normalizeRegisteredSpecies(value = []) {
  if (!Array.isArray(value) || value.length > regular.size || new Set(value).size !== value.length
    || Array.from(value).some(species => !Number.isInteger(species) || !regular.has(species))) {
    throw new Error("INVALID_REGISTERED_SPECIES");
  }
  return Object.freeze([...value].sort((a, b) => a - b));
}

// 02116A20 scans all 216 rows; a species absent from the table writes no flag.
export function registerNativeBookSpecies(previous, speciesIndex) {
  if (!regular.has(speciesIndex) || previous.includes(speciesIndex)) return previous;
  return normalizeRegisteredSpecies([...previous, speciesIndex]);
}

// Compatibility with old product saves, which retained only held individuals.
// No lost historical form or evolution-branch flag is reconstructed.
export function retainOwnedBookSpecies(previous, creature, collection = []) {
  let result = previous;
  for (const entry of [creature, ...collection]) {
    if (/^species-\d{3}$/.test(entry?.speciesId ?? "")) {
      result = registerNativeBookSpecies(result, Number(entry.speciesId.slice(8)));
    }
  }
  return result;
}

