// Presentation packs -- the "skin" layer.
//
// WHY THIS EXISTS
// ---------------
// Gameplay talks in stable IDs (species, cages, gates, screens). Pictures talk
// in files. A remake that wants to swap art later without rewriting rules needs
// a named pack that BINDS slots to production asset ids.
//
// The active pack is still the temporary prototype: that is what the Pixi
// scenes actually load today. The faithful-original pack is the default PUBLIC
// skin (Owner Option A) and stays unbound until those HD candidates are
// promoted through ART_PRODUCTION_INDEX. A later anatomy pack can be added as
// a third bind table. It must not fork the simulation.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const PRESENTATION_PACK_IDS = deepFreeze({
  TEMPORARY_PROTOTYPE: "championship:pack:temporary-prototype",
  FAITHFUL_ORIGINAL: "championship:pack:faithful-original",
  CAT_DOG_FUTURE_SKIN: "championship:pack:cat-dog-future-skin"
});

export const PRESENTATION_SLOT_IDS = deepFreeze([
  "raisingHome",
  "characterRoster",
  "uiHud",
  "cageFields",
  "huntField",
  "battleFields",
  "vfx",
  "gateSelect",
  "packaging"
]);

export const PRESENTATION_GAMEPLAY_INVARIANTS = deepFreeze([
  "simulation_entity_ids",
  "damage_or_battle_resolution",
  "ai_decisions",
  "capture_rules_or_probabilities",
  "collision_or_walkability_truth",
  "raising_rules",
  "progression_or_rewards",
  "economy",
  "save_schema_or_saved_truth"
]);

const emptyExtendedBinds = () => ({
  characterRoster: null,
  uiHud: null,
  cageFields: null,
  battleFields: null,
  vfx: null,
  packaging: null
});

const PACKS = {
  [PRESENTATION_PACK_IDS.TEMPORARY_PROTOTYPE]: {
    packId: PRESENTATION_PACK_IDS.TEMPORARY_PROTOTYPE,
    role: "CURRENT_RUNTIME",
    visualFamily: "PROTOTYPE_PLACEHOLDER",
    presentationOnly: true,
    changesSimulation: false,
    runtimeEligible: true,
    shippingReady: false,
    binds: {
      raisingHome: "art:raising_home:int-rh2:temporary-presentation-bundle",
      ...emptyExtendedBinds(),
      huntField: "art:hunt_field:vs2:temporary-signal-grove-kit",
      gateSelect: "art:gate_select:vs2-r1:original-created-world"
    }
  },
  [PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL]: {
    packId: PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL,
    role: "DEFAULT_PUBLIC_SKIN",
    visualFamily: "LICENSED_FAITHFUL_HD",
    presentationOnly: true,
    changesSimulation: false,
    runtimeEligible: false,
    internalRuntimeEligible: true,
    shippingReady: false,
    binds: {
      // Public Cage / Hunt bundles remain unbound. The exact VFX baseline is
      // available only to the owner-authorized non-public runtime path.
      raisingHome: null,
      ...emptyExtendedBinds(),
      vfx: "art:vfx:faithful-original:internal-v1",
      huntField: null,
      gateSelect: null
    }
  },
  [PRESENTATION_PACK_IDS.CAT_DOG_FUTURE_SKIN]: {
    packId: PRESENTATION_PACK_IDS.CAT_DOG_FUTURE_SKIN,
    role: "DEFERRED_ALTERNATE_SKIN",
    visualFamily: "CAT_DOG_AND_PRESERVED_OTHER_SPECIES",
    presentationOnly: true,
    changesSimulation: false,
    runtimeEligible: false,
    shippingReady: false,
    binds: {
      raisingHome: null,
      ...emptyExtendedBinds(),
      huntField: null,
      gateSelect: null
    }
  }
};

export const ACTIVE_PRESENTATION_PACK_ID = PRESENTATION_PACK_IDS.TEMPORARY_PROTOTYPE;
export const INTERNAL_DEFAULT_PRESENTATION_PACK_ID = PRESENTATION_PACK_IDS.FAITHFUL_ORIGINAL;

export function listPresentationPacks() {
  return deepFreeze(Object.values(PACKS));
}

export function getPresentationPack(packId = ACTIVE_PRESENTATION_PACK_ID) {
  const pack = PACKS[packId];
  if (!pack) {
    const error = new Error(`UNKNOWN_PRESENTATION_PACK: ${packId}`);
    error.name = "ChampionshipPresentationPackError";
    throw error;
  }
  return deepFreeze(pack);
}

/**
 * Resolve one visual slot.
 *
 * Returns the asset id and whether the ACTIVE pack may load it. A faithful
 * pack with a null bind is not a missing file error: it means "do not load
 * pixels yet". Gameplay must not branch on this result.
 */
export function resolvePresentationSlot(slotId, packId = ACTIVE_PRESENTATION_PACK_ID) {
  if (!PRESENTATION_SLOT_IDS.includes(slotId)) {
    const error = new Error(`UNKNOWN_PRESENTATION_SLOT: ${slotId}`);
    error.name = "ChampionshipPresentationPackError";
    throw error;
  }
  const pack = getPresentationPack(packId);
  const assetId = pack.binds[slotId];
  return deepFreeze({
    slotId,
    packId: pack.packId,
    assetId,
    bound: typeof assetId === "string",
    runtimeEligible: pack.runtimeEligible && typeof assetId === "string",
    internalRuntimeEligible: pack.internalRuntimeEligible === true && typeof assetId === "string"
  });
}
