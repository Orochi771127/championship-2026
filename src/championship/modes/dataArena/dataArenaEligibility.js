// Data Arena entry rights (OWNER_APPROVED_ADAPTATION 2026-11-02).
//
// Only partners the player raised or registered may fight: a species held on
// the ranch right now counts as raised (+10 %), a species lit in the Dex counts
// as registered, everything else stays locked. A save with fewer than three
// usable partners for the chosen mode is lent practice partners at 85 %,
// so a new save and the automated gates can always start a 3v3 match.
// Read-only: this never writes the Dex, the ranch or the arena record.

export const DATA_ARENA_ENTRY = Object.freeze({ BRED: "BRED", REGISTERED: "REGISTERED", RENTAL: "RENTAL", LOCKED: "LOCKED" });
export const DATA_ARENA_ENTRY_POWER = Object.freeze({ BRED: 1.1, REGISTERED: 1, RENTAL: 0.85, LOCKED: 0 });
const ORDER = Object.freeze({ RENTAL: 0, BRED: 1, REGISTERED: 2, LOCKED: 3 });
// Practice partners: the three Tournament kits' 成長期 species, which carry reviewed motion.
export const DATA_ARENA_RENTAL_SPECIES = Object.freeze(["species-034", "species-061", "species-064"]);
const MIN_USABLE = 3;

const speciesIndex = (speciesId) => /^species-\d{3}$/.test(speciesId ?? "") ? Number(speciesId.slice(8)) : null;

/**
 * `progress` is `{ registeredSpecies: number[], ownedSpecies: string[],
 * ownedInstances?: { speciesId, instanceId }[] }` read from the canonical save,
 * or null in a controlled harness (every partner open). `roster` lists
 * `{ id, speciesId }` in display order. Each row keeps `instanceId`: the ranch
 * individual of that species (the first held one), or null.
 */
export function dataArenaEntries(roster, progress) {
  if (!progress) return Object.freeze(roster.map((member, order) => Object.freeze({ ...member, entry: DATA_ARENA_ENTRY.REGISTERED, instanceId: null, order })));
  const registered = new Set(progress.registeredSpecies ?? []);
  const owned = new Set(progress.ownedSpecies ?? []);
  const instances = new Map();
  for (const { speciesId, instanceId } of progress.ownedInstances ?? []) if (!instances.has(speciesId)) instances.set(speciesId, instanceId);
  const rows = roster.map((member, order) => {
    const entry = owned.has(member.speciesId) ? DATA_ARENA_ENTRY.BRED
      : registered.has(speciesIndex(member.speciesId)) ? DATA_ARENA_ENTRY.REGISTERED : DATA_ARENA_ENTRY.LOCKED;
    return { ...member, entry, instanceId: instances.get(member.speciesId) ?? null, order };
  });
  let usable = rows.filter((row) => row.entry !== DATA_ARENA_ENTRY.LOCKED).length;
  for (const speciesId of DATA_ARENA_RENTAL_SPECIES) {
    if (usable >= MIN_USABLE) break;
    const row = rows.find((candidate) => candidate.speciesId === speciesId && candidate.entry === DATA_ARENA_ENTRY.LOCKED);
    if (row) { row.entry = DATA_ARENA_ENTRY.RENTAL; usable++; }
  }
  return Object.freeze(rows.sort((a, b) => ORDER[a.entry] - ORDER[b.entry] || a.order - b.order).map((row) => Object.freeze(row)));
}

export const dataArenaEntryUsable = (row) => Boolean(row) && row.entry !== DATA_ARENA_ENTRY.LOCKED;

/** Partner id -> combat power for the simulation (HP and outgoing damage). */
export function dataArenaPartnerPower(rows) {
  return Object.freeze(Object.fromEntries(rows.filter(dataArenaEntryUsable).map((row) => [row.id, DATA_ARENA_ENTRY_POWER[row.entry]])));
}
