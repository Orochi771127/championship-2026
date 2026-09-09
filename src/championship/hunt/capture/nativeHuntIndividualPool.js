// OVL0 0211A568..0211AA44, ending BEFORE actor registration. The caller must
// resolve actual Gate/season inputs; this module never selects a fallback Gate,
// seed, species set, recorded creature, or terrain. Normal binding remains A.
import { createNativeHuntIndividual, updateNativeHuntIndividual, validateNativeSpeciesInput } from "./nativeHuntIndividual.js";

// 0211B8E4 uses the first matching biome catalog entry's byte, shifted right by
// one, to reduce the seasonal table's weight. The byte's writer/lifecycle must
// be provided by the entry owner; treating every byte as zero is not parity.
export function expandNativeHuntCandidates({ entries, speciesOrder, reductionBytes }) {
  if (!Array.isArray(entries) || !Array.isArray(speciesOrder) || !Array.isArray(reductionBytes)
      || speciesOrder.length !== reductionBytes.length) throw new Error("HUNT_POOL_CANDIDATE_INPUT_REQUIRED");
  const firstModifiers = new Map();
  speciesOrder.forEach((id, i) => {
    const byte = reductionBytes[i];
    if (!Number.isInteger(id) || id < 0 || id > 227 || !Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error("HUNT_POOL_CANDIDATE_INPUT_INVALID");
    }
    if (!firstModifiers.has(id)) firstModifiers.set(id, byte);
  });
  const candidates = [];
  for (const { speciesIndex, weight } of entries) {
    if (!Number.isInteger(weight) || weight < 0 || weight > 7 || !firstModifiers.has(speciesIndex)) {
      // Original would not advance the input index on a missing catalog id.
      throw new Error("HUNT_POOL_CANDIDATE_CATALOG_MISMATCH");
    }
    const count = Math.max(0, weight - (firstModifiers.get(speciesIndex) >>> 1));
    for (let i = 0; i < count; i++) candidates.push(speciesIndex);
  }
  return candidates;
}

export function generateNativeHuntIndividualPool({ baseCount, candidates, speciesByIndex, rng, released = null, carried = null }) {
  if (!Number.isInteger(baseCount) || baseCount < 1 || baseCount > 24 || !Array.isArray(candidates)
      || (candidates.length === 0 && released === null)) {
    throw new Error("HUNT_POOL_ENCOUNTER_INPUT_REQUIRED");
  }
  if (!rng || typeof rng.next !== "function" || typeof speciesByIndex !== "function") throw new Error("HUNT_POOL_INPUT_PROVIDERS_REQUIRED");
  if (carried !== null) {
    const r = carried.individual;
    if (!Number.isInteger(carried.biomeIndex) || carried.biomeIndex < 0 || carried.biomeIndex > 15
      || !r?.fields || !r.narrowFields || typeof r.name !== "string" || r.name.length > 5
      || !Number.isInteger(r.fields["000"]) || r.fields["000"] < 0 || r.fields["000"] > 227
      || !Number.isInteger(r.fields["018"]) || r.fields["018"] < 0 || r.fields["018"] > 8
      || [r.fields,r.narrowFields].some(fields => Object.entries(fields).some(([k,v]) =>
        !/^[0-9a-f]{3}$/.test(k) || !Number.isInteger(v) || v < 0 || v > 0xffffffff))) {
      throw new Error("HUNT_POOL_CARRIED_RECORD_INPUT_REQUIRED");
    }
  }
  if (released !== null && (!Number.isInteger(released.speciesIndex) || released.speciesIndex < 0 || released.speciesIndex > 227
      || !Number.isInteger(released.trait) || released.trait < 0 || released.trait > 8 || typeof released.name !== "string")) {
    throw new Error("HUNT_POOL_RELEASED_RECORD_INPUT_REQUIRED");
  }
  // The entry owner selects the first matching record from the three history
  // slots. This input is that record, not a second mutable history authority.
  const effectiveCandidates = [...candidates];
  let specialIndex = -1;
  if (released !== null) { specialIndex = effectiveCandidates.length; effectiveCandidates.push(released.speciesIndex); }
  const inputs = new Map();
  for (const index of effectiveCandidates) {
    const s = validateNativeSpeciesInput(speciesByIndex(index));
    if (s.speciesIndex !== index) throw new Error("HUNT_POOL_SPECIES_IDENTITY_MISMATCH");
    inputs.set(index, s);
  }
  // OVL0 02128280 is {-1, 0, ...0}, not 24 copies of -1. Bonus slots
  // retain their zero, which participates in later duplicate-index rejection.
  const records = [], selected = new Array(24).fill(0);
  selected[0] = -1;
  let historyWrite = null;
  if (carried !== null) {
    // 0205799C / 0211B3EC copy the existing record. No constructor or
    // post-constructor RNG is consumed for this slot. It occupies slot zero.
    const record = structuredClone(carried.individual);
    record.fields["048"] = 1;
    record.fields["004"] = 0;
    records.push(record);
    // 02067134 -> 0211B7C8 replaces slot 3, without rotating the first three
    // history slots. Return the write for the existing app transaction owner.
    historyWrite = { slot:3, entry:{ speciesIndex:record.fields["000"], biomeIndex:carried.biomeIndex,
      trait:record.fields["018"], name:record.name } };
  }
  let targetCount = baseCount, attempts = 0, releasedCandidateConsumed = false;
  const append = (index, special = false) => {
    const individual = createNativeHuntIndividual({ species: inputs.get(index), rng,
      traitOverride:special ? released.trait : -1, nameOverride:special ? released.name : null });
    if (special) individual.fields["048"] = 2;
    updateNativeHuntIndividual(individual, { speciesByIndex, rng });
    records.push(individual);
  };
  while (records.length < targetCount) {
    // Defensive budget only; never returns a fabricated/partial encounter.
    if (attempts > 10000) throw new Error("HUNT_POOL_GENERATION_DID_NOT_TERMINATE");
    const chosen = rng.next(0xb4) % effectiveCandidates.length;
    if (attempts < 100 && selected.slice(0, records.length).includes(chosen)) { attempts++; continue; }
    const index = effectiveCandidates[chosen];
    if (chosen === specialIndex) {
      selected[records.length] = chosen;
      append(index, true);
      specialIndex = -1; releasedCandidateConsumed = true;
    } else if (index !== 19 || rng.next(0xb2) % 10 === 7) {
      selected[records.length] = chosen;
      append(index);
    }
    if (rng.next(0xb2) % 3 === 0 && records.length < targetCount && index !== 19) {
      append(index);
      targetCount++;
    }
    attempts++;
  }
  return { records, attempts, targetCount, releasedCandidateConsumed, historyWrite };
}
