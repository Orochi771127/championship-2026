// Cage Edit runtime — original ownership plus a hex-slot ranch.
//
// Original (YDIJ OVL15): each owned cage fills at most one ranch hex. Slot
// count is 14/16/18/20 from the tamer-rank table. Rotation, adjacency, stacking
// and training ticks are still closed. Confirm is in-memory; leaving the
// screen discards an unconfirmed draft. Home SAVE writes the committed layout.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  CAGE_DEFINITION_COUNT,
  CAPACITY_OVERFILL_CONSEQUENCE,
  CAPACITY_RULE,
  CAPACITY_RULE_EVIDENCE,
  EFFECT_CHANNEL_EVIDENCE,
  EFFECT_PARITY,
  MAX_SLOT_COUNT,
  PLACEMENT_EVIDENCE,
  PLACEMENT_MODEL,
  SLOT_COUNT_EVIDENCE,
  TAMER_RANK_TABLE_LAST_INDEX,
  getCageDefinitionByModuleId,
  listCageDefinitions,
  ownedModuleIds,
  slotCountForTamerRank
} from "./cageCatalog.js";
import { trainingViewFromDefinition } from "./cageEffects.js";

export const CAGE_EDIT_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

function cageError(message) {
  const error = new Error(message);
  error.name = "ChampionshipCageEditError";
  return error;
}

function clonePlacements(placements) {
  return placements.map((entry) => ({ moduleId: entry.moduleId, slotIndex: entry.slotIndex }));
}

function placementView(entry) {
  const definition = getCageDefinitionByModuleId(entry.moduleId);
  const training = trainingViewFromDefinition(definition);
  return {
    moduleId: entry.moduleId,
    slotIndex: entry.slotIndex,
    displayName: definition?.displayName ?? null,
    trainingSummary: training.summary,
    capacity: training.capacity,
    channels: training.channels
  };
}

function normalizePlacements(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw cageError("INVALID_CAGE_EDIT_PLACEMENTS");
  const placements = [];
  const seenModules = new Set();
  const seenSlots = new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") throw cageError("INVALID_CAGE_EDIT_PLACEMENT");
    const slotIndex = entry.slotIndex ?? entry.anchorCell;
    const definition = getCageDefinitionByModuleId(entry.moduleId);
    if (!definition) continue;
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOT_COUNT) continue;
    if (seenModules.has(definition.moduleId) || seenSlots.has(slotIndex)) {
      throw cageError("DUPLICATE_CAGE_PLACEMENT");
    }
    seenModules.add(definition.moduleId);
    seenSlots.add(slotIndex);
    placements.push({ moduleId: definition.moduleId, slotIndex });
  }
  return placements;
}

export function createCageEditRuntime({ snapshot = null } = {}) {
  let committed = normalizePlacements(snapshot?.placements);
  let draft = clonePlacements(committed);
  let selectedModuleId = null;
  let lastVerdict = null;

  function dropInvalid(placements, owned, unlockedCount) {
    return placements.filter(
      (entry) => owned.has(entry.moduleId) && entry.slotIndex < unlockedCount
    );
  }

  function getFrame(shopCageOwned = [], tamerRank = 0) {
    const owned = ownedModuleIds(shopCageOwned);
    const unlockedCount = slotCountForTamerRank(tamerRank);
    draft = dropInvalid(draft, owned, unlockedCount);
    committed = dropInvalid(committed, owned, unlockedCount);
    const occupied = new Map(draft.map((entry) => [entry.slotIndex, entry.moduleId]));
    const slots = [];
    for (let slotIndex = 0; slotIndex < MAX_SLOT_COUNT; slotIndex += 1) {
      const moduleId = occupied.get(slotIndex) ?? null;
      const definition = moduleId ? getCageDefinitionByModuleId(moduleId) : null;
      const unlocked = slotIndex < unlockedCount;
      const training = trainingViewFromDefinition(definition);
      slots.push({
        slotIndex,
        column: Math.floor(slotIndex / 2),
        row: slotIndex % 2,
        unlocked,
        moduleId: unlocked ? moduleId : null,
        displayName: unlocked ? (definition?.displayName ?? null) : null,
        trainingSummary: unlocked ? (moduleId ? training.summary : null) : null
      });
    }
    const placed = new Set(draft.map((entry) => entry.moduleId));
    const tray = listCageDefinitions()
      .filter((record) => owned.has(record.moduleId) && !placed.has(record.moduleId))
      .map((record) => {
        const training = trainingViewFromDefinition(record);
        return {
          moduleId: record.moduleId,
          displayName: record.displayName,
          alwaysOwned: record.alwaysOwned,
          selected: record.moduleId === selectedModuleId,
          trainingSummary: training.summary,
          capacity: training.capacity,
          channels: training.channels
        };
      });
    const dirty = JSON.stringify(draft) !== JSON.stringify(committed);
    return deepFreeze({
      authority: CAGE_EDIT_AUTHORITY,
      definitionCount: CAGE_DEFINITION_COUNT,
      ownedCount: owned.size,
      tamerRank,
      tamerRankTableLastIndex: TAMER_RANK_TABLE_LAST_INDEX,
      maxSlotCount: MAX_SLOT_COUNT,
      unlockedCount,
      slotCountEvidence: SLOT_COUNT_EVIDENCE,
      placementModel: PLACEMENT_MODEL,
      placementEvidence: PLACEMENT_EVIDENCE,
      effectParity: EFFECT_PARITY,
      effectChannelEvidence: EFFECT_CHANNEL_EVIDENCE,
      capacityRule: CAPACITY_RULE,
      capacityRuleEvidence: CAPACITY_RULE_EVIDENCE,
      capacityOverfillConsequence: CAPACITY_OVERFILL_CONSEQUENCE,
      rotationEnabled: false,
      dirty,
      selectedModuleId,
      lastVerdict,
      slots,
      tray,
      placements: draft.map(placementView)
    });
  }

  return Object.freeze({
    getFrame,

    selectModule(moduleId, shopCageOwned = [], tamerRank = 0) {
      if (moduleId === null) {
        selectedModuleId = null;
        lastVerdict = { ok: true, reason: "CLEARED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      const owned = ownedModuleIds(shopCageOwned);
      if (!owned.has(moduleId)) {
        lastVerdict = { ok: false, reason: "UNOWNED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      selectedModuleId = moduleId;
      lastVerdict = { ok: true, reason: "SELECTED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    placeAt(slotIndex, shopCageOwned = [], tamerRank = 0) {
      const owned = ownedModuleIds(shopCageOwned);
      const unlockedCount = slotCountForTamerRank(tamerRank);
      if (!selectedModuleId) {
        lastVerdict = { ok: false, reason: "NOTHING_SELECTED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (!owned.has(selectedModuleId)) {
        lastVerdict = { ok: false, reason: "UNOWNED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (draft.some((entry) => entry.moduleId === selectedModuleId)) {
        lastVerdict = { ok: false, reason: "ALREADY_PLACED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOT_COUNT) {
        lastVerdict = { ok: false, reason: "OUT_OF_BOUNDS" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (slotIndex >= unlockedCount) {
        lastVerdict = { ok: false, reason: "SLOT_LOCKED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (draft.some((entry) => entry.slotIndex === slotIndex)) {
        lastVerdict = { ok: false, reason: "OCCUPIED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      draft = [...draft, { moduleId: selectedModuleId, slotIndex }];
      selectedModuleId = null;
      lastVerdict = { ok: true, reason: "PLACED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    removePlacement(moduleId, shopCageOwned = [], tamerRank = 0) {
      if (!draft.some((entry) => entry.moduleId === moduleId)) {
        lastVerdict = { ok: false, reason: "NOT_PLACED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      draft = draft.filter((entry) => entry.moduleId !== moduleId);
      lastVerdict = { ok: true, reason: "REMOVED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    confirm(shopCageOwned = [], tamerRank = 0) {
      const owned = ownedModuleIds(shopCageOwned);
      const unlockedCount = slotCountForTamerRank(tamerRank);
      draft = dropInvalid(draft, owned, unlockedCount);
      committed = clonePlacements(draft);
      selectedModuleId = null;
      lastVerdict = { ok: true, reason: "CONFIRMED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    revert(shopCageOwned = [], tamerRank = 0) {
      draft = clonePlacements(committed);
      selectedModuleId = null;
      lastVerdict = { ok: true, reason: "REVERTED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    toSave() {
      return deepFreeze({
        placements: clonePlacements(committed)
      });
    }
  });
}
