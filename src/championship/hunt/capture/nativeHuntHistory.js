// Functional translation of original history writers and persistence fields.
// The application owns this state. These pure functions create candidates;
// they never write storage, seed RNG, load research data or select a Gate.
const integer = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
const validName = (v) => typeof v === "string" && v.length <= 5 && !v.includes("\0");
const validEntry = (e) => e && integer(e.speciesIndex, 228) && integer(e.biomeIndex, 33)
  && integer(e.trait, 8) && validName(e.name);

export function validateNativeHuntHistory(history) {
  if (!history || !integer(history.cursor, 2) || !Array.isArray(history.entries)
    || history.entries.length !== 4 || !history.entries.every(validEntry)) throw new Error("HUNT_HISTORY_INPUT_REQUIRED");
  return history;
}

export function createNativeHuntHistory(defaultName) {
  if (!validName(defaultName)) throw new Error("HUNT_HISTORY_DEFAULT_NAME_REQUIRED");
  // ARM9 02068824: all four slots use the ordinary constructor's default name.
  return { cursor: 0, entries: Array.from({ length: 4 }, () => ({ speciesIndex: 228, biomeIndex: 33, trait: 8, name: defaultName })) };
}

export function selectNativeReleasedHistory(history, biomeIndex) {
  validateNativeHuntHistory(history);
  if (!integer(biomeIndex, 15)) throw new Error("HUNT_HISTORY_BIOME_REQUIRED");
  // OVL0 0211A600: first match, no rotation and no RNG. Slot3 is not a candidate.
  const slot = history.entries.findIndex((e, i) => i < 3 && e.biomeIndex === biomeIndex && e.speciesIndex !== 228);
  return slot < 0 ? null : { slot, entry: { ...history.entries[slot] } };
}

export function applyNativeCarriedHistoryWrite(history, write) {
  validateNativeHuntHistory(history);
  if (!write || write.slot !== 3 || !validEntry(write.entry)
    || write.entry.speciesIndex === 228 || write.entry.biomeIndex > 15) throw new Error("HUNT_HISTORY_CARRIED_WRITE_INVALID");
  const candidate = structuredClone(history);
  candidate.entries[3] = { ...write.entry };
  return candidate;
}

export function projectNativeHuntHistorySave(history) {
  validateNativeHuntHistory(history);
  // ARM9 02069F2C: three slots, five UTF16 units, cursor; trait is not encoded.
  return { cursor: history.cursor, entries: history.entries.slice(0, 3).map(({ speciesIndex, biomeIndex, name }) => ({ speciesIndex, biomeIndex, name })) };
}

export function restoreNativeHuntHistorySave(saved, baseline) {
  validateNativeHuntHistory(baseline);
  if (!saved || !integer(saved.cursor, 2) || !Array.isArray(saved.entries) || saved.entries.length !== 3
    || Object.keys(saved).some(k => !["cursor", "entries"].includes(k))
    || !saved.entries.every(e => e && Object.keys(e).every(k => ["speciesIndex", "biomeIndex", "name"].includes(k))
      && integer(e.speciesIndex, 228) && integer(e.biomeIndex, 33) && validName(e.name))) throw new Error("HUNT_HISTORY_SAVE_INVALID");
  // ARM9 0206AF34: restores trait8 explicitly. Slot3 is left as initialized by
  // the application boot, not serialized or inferred from an old expedition.
  const candidate = structuredClone(baseline);
  candidate.cursor = saved.cursor;
  saved.entries.forEach((e, i) => { candidate.entries[i] = { ...e, trait: 8 }; });
  return candidate;
}

export function projectNativeHuntModifierSave(modifiers) {
  if (!Array.isArray(modifiers) || modifiers.length !== 16 || !modifiers.every(row => Array.isArray(row)
    && row.length > 0 && row.length <= 256 && row.every(v => integer(v, 255)))) throw new Error("HUNT_MODIFIER_INPUT_REQUIRED");
  // ARM9 02072958 / 0207AD30 keep four bits. Runtime data does not need native
  // packed bytes or padding; row lengths must be checked against the provider.
  return modifiers.map(row => row.map(value => value & 15));
}

export function applyNativeHuntReturn({ history, modifiers, biomeIndex, catalog, records,
  carriedAtEntry, releasedSlot, speciesByIndex, rng }) {
  validateNativeHuntHistory(history);
  projectNativeHuntModifierSave(modifiers);
  if (!integer(biomeIndex, 15) || !Array.isArray(catalog) || catalog.length !== modifiers[biomeIndex].length
    || !catalog.every(e => e && integer(e.speciesIndex, 227) && integer(e.releaseMatchValue, 0x700) && (e.releaseMatchValue & 0xff) === 0)
    || typeof carriedAtEntry !== "boolean" || (releasedSlot !== null && !integer(releasedSlot, 2))
    || !Array.isArray(records) || typeof speciesByIndex !== "function" || typeof rng?.next !== "function") {
    throw new Error("HUNT_RETURN_INPUT_REQUIRED");
  }
  // Resolve everything before consuming RNG or proposing writes. No default
  // species stats, release slot, history, catalog or encounter rates are legal.
  const species = records.map(r => {
    if (!r?.fields || !integer(r.fields["000"], 227) || !integer(r.fields["048"], 2)
      || (r.fields["048"] === 2 && releasedSlot === null)) throw new Error("HUNT_RETURN_RECORD_INVALID");
    const s = speciesByIndex(r.fields["000"]);
    if (!s || s.speciesIndex !== r.fields["000"] || !integer(s.field1c, 255) || !integer(s.field20, 65535)
      || !integer(s.field22, 65535) || s.field22 < s.field20) throw new Error("HUNT_RETURN_SPECIES_REQUIRED");
    return s;
  });
  const nextHistory = structuredClone(history), nextModifiers = structuredClone(modifiers), nextRecords = structuredClone(records);
  const row = nextModifiers[biomeIndex];
  let carriedReturned = false;
  for (const r of records) {
    const tag = r.fields["048"];
    if (tag === 1) carriedReturned = true;
    else if (tag === 2) {
      // 02119450: empty species/biome/name, preserving this slot's trait.
      nextHistory.entries[releasedSlot] = { ...nextHistory.entries[releasedSlot], speciesIndex: 228, biomeIndex: 33, name: "" };
    } else {
      const index = catalog.findIndex(e => e.speciesIndex === r.fields["000"]);
      if (index >= 0) row[index] = Math.min(8, (row[index] + 1) & 255);
    }
  }
  if (carriedAtEntry && !carriedReturned) {
    const pending = nextHistory.entries[3];
    nextHistory.entries[nextHistory.cursor] = { ...pending };
    nextHistory.cursor = (nextHistory.cursor + 1) % 3;
    // 02119724 compares (packed entry & 0x700), NOT the species mask0xFFF.
    // Keep the verified native condition. A provider supplies this functional
    // comparison value separately; do not silently repair the original mask.
    const index = catalog.findIndex(e => e.releaseMatchValue === pending.speciesIndex);
    if (index >= 0) row[index] = Math.max(0, row[index] - 2);
  }
  // 0211977C: every returned card, including carried/recaptured cards, performs
  // one actual channel1 draw. Zero divisor still consumes that draw.
  nextRecords.forEach((r, i) => {
    const s = species[i], value = rng.next(1), range = s.field22 - s.field20;
    r.fields["008"] = s.field1c >>> 1;
    r.fields["00c"] = 0;
    r.fields["178"] = s.field20 + (range === 0 ? 0 : value % range);
  });
  return { history: nextHistory, modifiers: nextModifiers, records: nextRecords };
}
