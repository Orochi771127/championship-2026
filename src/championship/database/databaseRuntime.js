// Database projection — original encyclopedia vs instance split.
//
// OVL16 is a 224-slot species book. Capture still writes a CreatureInstance
// (raising.collection). This projector never invents seen-but-uncaught or
// filter tabs: those writers are untraced. A slot is REGISTERED when it is
// the single product starter species, or when a Hunt instance of that species
// has been brought home. The extra VS1 home prototypes are not starters.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  DATABASE_EGG_COUNT,
  DATABASE_REGULAR_COUNT,
  DATABASE_SLOT_COUNT,
  DATABASE_UNLOCK_EVIDENCE,
  getDatabaseSlot,
  listDatabaseSlots
} from "./databaseCatalog.js";

export const DATABASE_ENTRY_STATES = deepFreeze({
  UNDISCOVERED: "UNDISCOVERED",
  REGISTERED: "REGISTERED"
});

export const DATABASE_REGISTER_SOURCES = deepFreeze({
  STARTER: "STARTER",
  COLLECTION: "COLLECTION",
  BOTH: "BOTH"
});

function registerSource({ isStarter, instanceCount }) {
  if (isStarter && instanceCount > 0) return DATABASE_REGISTER_SOURCES.BOTH;
  if (isStarter) return DATABASE_REGISTER_SOURCES.STARTER;
  return DATABASE_REGISTER_SOURCES.COLLECTION;
}

/**
 * Project the encyclopedia from current product truth.
 *
 * `starterSpeciesId` is the one New Game creature (original opening party is
 * one). `collection` is Hunt-enclosed instances only.
 */
export function projectDatabase({
  starterSpeciesId = null,
  collection = [],
  selectedSpeciesIndex = null
} = {}) {
  const instancesBySpecies = new Map();
  for (const entry of collection) {
    const speciesId = entry?.speciesId;
    if (typeof speciesId !== "string") continue;
    const list = instancesBySpecies.get(speciesId) ?? [];
    list.push({
      instanceId: entry.instanceId,
      displayName: entry.displayName,
      enclosedAt: entry.enclosedAt ?? null,
      originGateId: entry.originGateId ?? null
    });
    instancesBySpecies.set(speciesId, list);
  }

  const entries = [];
  let registeredCount = 0;
  for (const slot of listDatabaseSlots()) {
    const instances = instancesBySpecies.get(slot.speciesId) ?? [];
    const isStarter = starterSpeciesId !== null && slot.speciesId === starterSpeciesId;
    const registered = isStarter || instances.length > 0;
    if (registered) registeredCount += 1;
    entries.push({
      speciesIndex: slot.speciesIndex,
      speciesId: slot.speciesId,
      displayName: slot.displayName,
      kind: slot.kind,
      state: registered ? DATABASE_ENTRY_STATES.REGISTERED : DATABASE_ENTRY_STATES.UNDISCOVERED,
      source: registered ? registerSource({ isStarter, instanceCount: instances.length }) : null,
      instanceCount: instances.length,
      identityEvidence: slot.identityEvidence
    });
  }

  let selected = null;
  if (selectedSpeciesIndex !== null) {
    const slot = getDatabaseSlot(selectedSpeciesIndex);
    const row = entries[selectedSpeciesIndex];
    selected = {
      ...row,
      instances: instancesBySpecies.get(slot.speciesId) ?? []
    };
  }

  return deepFreeze({
    slotCount: DATABASE_SLOT_COUNT,
    eggCount: DATABASE_EGG_COUNT,
    regularCount: DATABASE_REGULAR_COUNT,
    registeredCount,
    unlockEvidence: DATABASE_UNLOCK_EVIDENCE,
    entries,
    selected
  });
}
