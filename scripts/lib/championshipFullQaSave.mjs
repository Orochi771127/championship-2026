// Local QA-save builder. It changes no gameplay rule and creates no second
// persistence authority: the result is a normal schema-v5 player save for the
// existing championshipModernSave:v1 slot.

import { NATIVE_REGULAR_BOOK_SPECIES } from "../../src/data/championship/nativeBookSpecies.js";
import { createChampionshipModernSave, serializeChampionshipModernSave }
  from "../../src/championship/app/championshipStandaloneSave.js";
import { qaUnlockPlan } from "../../src/championship/app/qaUnlock.js";
import { listChampionshipGates } from "../../src/championship/gate/gateCatalog.js";
import { createNativeHuntIndividual } from "../../src/championship/hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../../src/championship/hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile } from "../../src/championship/raising/nativeIndividualProfile.js";
import { allocateRaisingInstanceIdentity } from "../../src/championship/raising/raisingInstanceIdentity.js";
import { recordEnclosedCreature } from "../../src/championship/app/championshipRaisingProduction.js";
import {
  BITS_WALLET_CAP,
  SHOP_PURCHASE_DOMAIN,
  SHOP_VISIBILITY,
  listShopRecords
} from "../../src/championship/shop/shopCatalog.js";

export const FULL_QA_STACKABLE_QUANTITY = 90;
export const FULL_QA_ULTIMATES = Object.freeze([
  Object.freeze({ speciesIndex: 189, displayName: "戰鬥暴龍獸", nativeName: "戰暴QA" }),
  Object.freeze({ speciesIndex: 195, displayName: "閃光暴龍獸", nativeName: "閃暴QA" }),
  Object.freeze({ speciesIndex: 204, displayName: "黑暗戰鬥暴龍獸", nativeName: "黑戰QA" }),
  Object.freeze({ speciesIndex: 212, displayName: "鋼鐵加魯魯獸", nativeName: "鋼狼QA" }),
  Object.freeze({ speciesIndex: 223, displayName: "公爵獸", nativeName: "公爵QA" })
]);

function fixtureRng(seed) {
  let state = seed >>> 0;
  return Object.freeze({
    next(channel = 0) {
      state = (Math.imul(state ^ (channel >>> 0), 1664525) + 1013904223) >>> 0;
      return state % 102;
    }
  });
}

function identitySources(baseSave, raising) {
  const nested = JSON.parse(baseSave.raisingHome);
  return {
    creature: baseSave.creature,
    residents: nested.payload?.residents ?? [],
    collection: raising.collection,
    assignments: raising.assignments,
    interactions: raising.interactions
  };
}

function attachUltimateProfile(raising, instanceId, profile) {
  return Object.freeze({
    ...raising,
    collection: Object.freeze(raising.collection.map((entry) => entry.instanceId === instanceId
      ? Object.freeze({ ...entry, successAuthority: "QA_FULL_SAVE_FIXTURE", nativeProfile: profile })
      : entry))
  });
}

function fullShopSave() {
  const records = listShopRecords();
  return Object.freeze({
    bits: BITS_WALLET_CAP,
    visibility: records.map(() => SHOP_VISIBILITY.SEEN),
    // Keep stackable inventory below its cap so purchase/quantity UI can still
    // be exercised. One-copy equipment/plugins are owned so every tool is usable.
    quantities: records.map((record) => record.purchaseDomain === SHOP_PURCHASE_DOMAIN.INVENTORY
      ? (record.maxOwned === 1 ? 1 : Math.min(record.maxOwned, FULL_QA_STACKABLE_QUANTITY))
      : 0),
    cageOwned: records.filter((record) => record.purchaseDomain === SHOP_PURCHASE_DOMAIN.CAGE_OWNERSHIP)
      .map((record) => record.shopRecordIndex)
  });
}

function fullTitleProgress() {
  return Object.freeze({
    version: 1,
    registered: Object.freeze(Array.from({ length: 61 }, (_, index) => index)),
    championship: Object.freeze({ stage: 3, entry: 1, worldEntry: 1 }),
    feeWaiver: true,
    // Non-max counters leave room to verify that real battle settlement still
    // increments them while presenting a clearly advanced test profile.
    record: Object.freeze({ battles: 500, wins: 400 })
  });
}

/**
 * Build the advanced QA save from a normal New Game checkpoint. The nested R2
 * snapshot and all current optional slices therefore come from the canonical
 * application writer rather than being reproduced here.
 */
export function createFullQaSave(baseSave, { cageIds } = {}) {
  if (!baseSave || typeof baseSave !== "object") throw new TypeError("FULL_QA_BASE_SAVE_REQUIRED");
  if (!Array.isArray(cageIds) || cageIds.length === 0) throw new TypeError("FULL_QA_CAGE_IDS_REQUIRED");

  const plan = qaUnlockPlan(listChampionshipGates());
  let raising = baseSave.raising;
  let identity = baseSave.instanceIdentity;

  for (const [index, requested] of FULL_QA_ULTIMATES.entries()) {
    const species = nativeHuntSpeciesByIndex(requested.speciesIndex);
    if (species.generation !== 6) throw new Error(`FULL_QA_SPECIES_NOT_ULTIMATE: ${requested.speciesIndex}`);
    const sources = identitySources(baseSave, raising);
    const allocated = allocateRaisingInstanceIdentity(identity, sources);
    const speciesId = `species-${String(requested.speciesIndex).padStart(3, "0")}`;
    const profile = nativeIndividualProfile(createNativeHuntIndividual({
      species,
      rng: fixtureRng(0x20260913 + requested.speciesIndex),
      nameOverride: requested.nativeName
    }), speciesId);
    raising = recordEnclosedCreature(raising, {
      instanceId: allocated.instanceId,
      speciesId,
      displayName: requested.displayName,
      enclosedAt: "2026-09-13T00:00:00.000Z",
      originGateId: null,
      cageId: cageIds[index % cageIds.length]
    });
    raising = attachUltimateProfile(raising, allocated.instanceId, profile);
    identity = allocated.state;
  }

  return createChampionshipModernSave({
    sessionId: baseSave.sessionId,
    creature: baseSave.creature,
    raisingHomeSerialized: baseSave.raisingHome,
    raising,
    shop: fullShopSave(),
    cageEdit: baseSave.cageEdit,
    battleEconomy: baseSave.battleEconomy,
    instanceIdentity: identity,
    gameplayRng: baseSave.gameplayRng,
    huntHistory: baseSave.huntHistory,
    progression: {
      ...baseSave.progression,
      tamerRank: plan.tamerRank,
      // 0..60 are the ordinary title-event records. Slot 61 is the existing
      // tutorial/test flag: the ordinary qa=unlock grant rightly does not mint
      // it, while this explicitly synthetic full-save fixture includes it.
      battleBadges: [...new Set([...plan.battleBadges, 61])].sort((a, b) => a - b),
      registeredSpecies: [...NATIVE_REGULAR_BOOK_SPECIES],
      nativeTitles: fullTitleProgress(),
      championshipRun: null,
      revision: (baseSave.progression?.revision ?? 0) + 1
    },
    flags: { newGameCompleted: true },
    updatedAt: "2026-09-13T00:00:00.000Z"
  });
}

export function createFullQaSaveText(baseSave, options) {
  return serializeChampionshipModernSave(createFullQaSave(baseSave, options));
}
