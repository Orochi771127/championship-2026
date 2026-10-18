// Database projection — original encyclopedia vs instance split.
//
// The 216-row species book keeps registration after an individual changes
// form or leaves Home. Held instances remain a separate projection.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {databaseIllustrationRow} from './databaseIllustrations.js';
import {projectDatabaseEvolutionRoutes} from './databaseEvolutionRoutes.js';
import {projectDatabaseEvolutionConditions} from './databaseEvolutionConditions.js';
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
  BOTH: "BOTH",
  HISTORY: "HISTORY"
});

function registerSource({ isStarter, instanceCount }) {
  if (isStarter && instanceCount > 0) return DATABASE_REGISTER_SOURCES.BOTH;
  if (isStarter) return DATABASE_REGISTER_SOURCES.STARTER;
  return instanceCount > 0 ? DATABASE_REGISTER_SOURCES.COLLECTION : DATABASE_REGISTER_SOURCES.HISTORY;
}

/**
 * Project the encyclopedia from current product truth.
 *
 * `starterSpeciesId` is the one New Game creature (original opening party is
 * one). `collection` is Hunt-enclosed instances only.
 */
export function projectDatabase({
  fullView = false,
  starterSpeciesId = null,
  collection = [],
  registeredSpecies = [],
  evolutionBranches = [],
  productEvolutionBranches = [],
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
    const registered = registeredSpecies.includes(slot.speciesIndex) || isStarter || instances.length > 0;
    if (registered) registeredCount += 1;
    entries.push({
      bookOrdinal: slot.bookOrdinal,
      speciesIndex: slot.speciesIndex,
      speciesId: slot.speciesId,
      displayName: slot.displayName,
      kind: slot.kind,
      state: registered ? DATABASE_ENTRY_STATES.REGISTERED : DATABASE_ENTRY_STATES.UNDISCOVERED,
      ...(fullView ? { viewable: true } : {}),
      source: registered ? registerSource({ isStarter, instanceCount: instances.length }) : null,
      instanceCount: instances.length,
      identityEvidence: slot.identityEvidence
    });
  }

  let selected = null;
  if (databaseIllustrationRow(selectedSpeciesIndex)) {
    selected = databaseIllustrationRow(selectedSpeciesIndex);
  } else if (selectedSpeciesIndex !== null) {
    const slot = getDatabaseSlot(selectedSpeciesIndex);
    const row = entries[slot.bookOrdinal];
    const routeContext = {
      fullView,
      sourceRegistered:row.state === DATABASE_ENTRY_STATES.REGISTERED,
      registeredSpecies:entries.filter(entry=>entry.state === DATABASE_ENTRY_STATES.REGISTERED).map(entry=>entry.speciesIndex),
      evolutionBranches,productEvolutionBranches
    };
    selected = {
      ...row,
      instances: instancesBySpecies.get(slot.speciesId) ?? [],
      evolutionRoutes:projectDatabaseEvolutionRoutes(slot.speciesIndex, routeContext).map(route=>({
        ...route,
        conditions:projectDatabaseEvolutionConditions(slot.speciesIndex, route.branchIndex, {...routeContext,productRouteId:route.productRouteId??null})
      }))
    };
  }

  return deepFreeze({
    slotCount: DATABASE_SLOT_COUNT,
    eggCount: DATABASE_EGG_COUNT,
    regularCount: DATABASE_REGULAR_COUNT,
    registeredCount,
    ...(fullView ? { fullView: true } : {}),
    unlockEvidence: DATABASE_UNLOCK_EVIDENCE,
    entries,
    selected
  });
}

