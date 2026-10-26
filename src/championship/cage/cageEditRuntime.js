// Cage Edit runtime — original ownership plus a hex-slot ranch.
//
// Legacy product model: each owned cage has one anchor. Original OVL15 uses
// multi-cell shape masks; migration of old drafts/saves remains pending. Slot
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
  slotCountForTamerRank
} from "./cageCatalog.js";
import {ownedModuleIds,ownedModuleCount} from "./cageInventory.js";
import { trainingViewFromDefinition } from "./cageEffects.js";
import { NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, originalStartingRanch, nativePlacementMask, validateNativeRanch } from './nativeRanchLayout.js';
import { RANCH_DECKS_LAYOUT, RANCH_EXPANSION_DECK_SLOTS, RANCH_EXPANSION_EVIDENCE, RANCH_EXPANSION_FIRST_SLOT, annexPlacementCells,
  annexSlotCount, isAnnexSlot, normalizeRanchExpansion, prototypeRanchExpansion, validateRanchLayout } from './ranchExpansion.js';

import { PRODUCT_RANCH_GRID, PRODUCT_RANCH_LAYOUTS, PRODUCT_RANCH_SLOT_COUNT, PRODUCT_RANCH_COLUMNS, PRODUCT_RANCH_ROWS, PRODUCT_RANCH_CELL_CAP,
  PUBLIC_TEST_RANCH_ACCESS, productGridCell, productPlacementCells, productLandCapacity, productLockedLandRows, productRanchProblem,
  productOccupiedCellCount, normalizeProductRanchAccess, migrateProductRanch, validateProductRanch } from './productRanchGrid.js';

// Hex cage world verdicts the free lattice can produce (2026-10-26).
const HEX_WORLD_REASONS = Object.freeze({ OCCUPIED:'OCCUPIED', OUT_OF_BOUNDS:'OUT_OF_BOUNDS', CELL_CAP:'CELL_CAP',
  LAND_CAPACITY:'LAND_CAPACITY', DUPLICATE_INSTANCE:'FOOTPRINT_BLOCKED', DUPLICATE_WAITING_ROOM:'FOOTPRINT_BLOCKED',
  WAITING_ROOM_REQUIRED:'FIXED_WAITING_ROOM', INVALID:'FOOTPRINT_BLOCKED' });

export const CAGE_EDIT_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT";

function cageError(message) {
  const error = new Error(message);
  error.name = "ChampionshipCageEditError";
  return error;
}

function clonePlacements(placements) {
  return placements.map((entry) => ({ moduleId: entry.moduleId, slotIndex: entry.slotIndex, ...(entry.instanceId?{instanceId:entry.instanceId}:{}) }));
}

function placementView(entry) {
  const definition = getCageDefinitionByModuleId(entry.moduleId);
  const training = trainingViewFromDefinition(definition);
  return {
    moduleId: entry.moduleId,
    ...(entry.instanceId?{instanceId:entry.instanceId}:{}),
    slotIndex: entry.slotIndex,
    displayName: definition?.displayName ?? null,
    trainingSummary: training.summary,
    capacity: training.capacity,
    channels: training.channels
  };
}

function normalizePlacements(raw, slotLimit = MAX_SLOT_COUNT, instances=false) {
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
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotLimit) continue;
    const identity=instances?entry.instanceId:definition.moduleId;
    if (seenModules.has(identity) || seenSlots.has(slotIndex)) {
      throw cageError("DUPLICATE_CAGE_PLACEMENT");
    }
    seenModules.add(identity);
    seenSlots.add(slotIndex);
    placements.push({ moduleId: definition.moduleId, slotIndex, ...(instances?{instanceId:entry.instanceId}:{}) });
  }
  return placements;
}

export function createCageEditRuntime({ snapshot = null, initializeOriginal = false, publicTestGrid = false, initialTamerRank = 0 } = {}) {
  if (initializeOriginal) snapshot = originalStartingRanch();
  if (publicTestGrid && snapshot?.layoutVersion && !PRODUCT_RANCH_LAYOUTS.includes(snapshot.layoutVersion)) {
    if (!validateRanchLayout(snapshot.placements, { layoutVersion: snapshot.layoutVersion,
      mainUnlocked: slotCountForTamerRank(initialTamerRank), expansion: snapshot.expansion ?? null })) throw cageError('INVALID_NATIVE_RANCH_MIGRATION');
    snapshot = migrateProductRanch(snapshot, MAX_SLOT_COUNT);
  }
  if(PRODUCT_RANCH_LAYOUTS.includes(snapshot?.layoutVersion))snapshot=migrateProductRanch(snapshot,MAX_SLOT_COUNT);
  // NATIVE_DECKS_V1 is the original layout plus the expansion prototype's
  // annex (ranchExpansion.js). Only the prototype grant writes it.
  let layoutVersion = snapshot?.layoutVersion ?? null;
  if (layoutVersion !== null && layoutVersion !== NATIVE_RANCH_LAYOUT && layoutVersion !== RANCH_DECKS_LAYOUT && layoutVersion !== PRODUCT_RANCH_GRID) throw cageError('UNKNOWN_RANCH_LAYOUT');
  let expansion = layoutVersion === RANCH_DECKS_LAYOUT ? normalizeRanchExpansion(snapshot?.expansion) : null;
  if (layoutVersion === RANCH_DECKS_LAYOUT && !expansion) throw cageError('RANCH_EXPANSION_REQUIRED');
  if (layoutVersion !== RANCH_DECKS_LAYOUT && snapshot?.expansion != null) throw cageError('RANCH_EXPANSION_WITHOUT_DECKS_LAYOUT');
  const grid = layoutVersion === PRODUCT_RANCH_GRID;
  if (grid && !validateProductRanch(snapshot?.placements)) throw cageError('INVALID_PRODUCT_RANCH');
  let gridAccess = grid ? normalizeProductRanchAccess(snapshot.gridAccess) : null;
  // Land is a capacity in the hex world. An existing layout is never refused
  // for exceeding it (old saves only ever used opened land); new cells are.
  const landCapacity = (unlockedCount) => productLandCapacity(gridAccess, unlockedCount, publicTestGrid ? PUBLIC_TEST_RANCH_ACCESS : null);
  const testAccessOverride = publicTestGrid ? PUBLIC_TEST_RANCH_ACCESS : null;
  let committed = normalizePlacements(snapshot?.placements, grid ? PRODUCT_RANCH_SLOT_COUNT : MAX_SLOT_COUNT + annexSlotCount(expansion),grid);
  let nextInstanceSequence=snapshot?.nextInstanceSequence??1;
  if(!Number.isSafeInteger(nextInstanceSequence)||nextInstanceSequence<1)throw cageError("INVALID_CAGE_INSTANCE_SEQUENCE");
  const allocateInstance=()=>{let id;do{if(nextInstanceSequence>=Number.MAX_SAFE_INTEGER)throw cageError("CAGE_INSTANCE_SEQUENCE_EXHAUSTED");id=`cage:instance:${nextInstanceSequence++}`;}while([...committed,...draft].some(p=>p.instanceId===id));return id;};
  if (layoutVersion && !validateRanchLayout(committed, { layoutVersion, mainUnlocked: MAX_SLOT_COUNT, expansion })) throw cageError('INVALID_NATIVE_RANCH');
  let draft = clonePlacements(committed);
  let selectedModuleId = null;
  const withdrawnCopies=new Map();
  let lastVerdict = null;

  function dropInvalid(placements, owned, unlockedCount) {
    // A rank change must not silently discard a native multi-cell placement.
    if (layoutVersion) {
      if (!validateRanchLayout(placements, { layoutVersion, mainUnlocked: unlockedCount, expansion }) || placements.some(entry=>!owned.has(entry.moduleId))) {
        throw cageError('NATIVE_RANCH_OWNERSHIP_OR_RANK_MISMATCH');
      }
      return placements;
    }
    return placements.filter(
      (entry) => owned.has(entry.moduleId) && entry.slotIndex < unlockedCount
    );
  }

  function getFrame(shopCageOwned = [], tamerRank = 0) {
    const owned = ownedModuleIds(shopCageOwned);
    const unlockedCount = slotCountForTamerRank(tamerRank);
    draft = dropInvalid(draft, owned, unlockedCount);
    if(grid)for(const moduleId of new Set(draft.map(p=>p.moduleId)))if(draft.filter(p=>p.moduleId===moduleId).length>ownedModuleCount(moduleId,shopCageOwned))throw cageError("CAGE_INSTANCE_STOCK_MISMATCH");
    committed = dropInvalid(committed, owned, unlockedCount);
    // A native entry stores an anchor, but several original masks do not
    // occupy that anchor bit. Build those cells only from the traced mask;
    // adding the anchor first would paint a phantom extra hex in Cage Edit.
    const occupied = new Map(layoutVersion ? [] : draft.map((entry) => [entry.slotIndex, entry.moduleId]));
    if (grid) for (const entry of draft) for (const slot of productPlacementCells(entry)) occupied.set(slot, entry.moduleId);
    if (layoutVersion && !grid) for (const entry of draft) {
      if (isAnnexSlot(entry.slotIndex)) {
        for (const slot of annexPlacementCells(entry, expansion)) occupied.set(slot, entry.moduleId);
        continue;
      }
      const mask = nativePlacementMask(entry);
      for (let slot = 0; slot < MAX_SLOT_COUNT; slot++) if (mask & (1 << slot)) occupied.set(slot, entry.moduleId);
    }
    const instanceAt=new Map();
    if(grid)for(const entry of draft)for(const slot of productPlacementCells(entry))instanceAt.set(slot,entry.instanceId);
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
        fixed: Boolean(layoutVersion && moduleId === WAITING_ROOM_MODULE),
        moduleId: unlocked ? moduleId : null,
        displayName: unlocked ? (definition?.displayName ?? null) : null,
        trainingSummary: unlocked ? (moduleId ? training.summary : null) : null
      });
    }
    // The annex deck: always open once granted, never rank-gated.
    for (let local = 0; local < annexSlotCount(expansion); local += 1) {
      const slotIndex = RANCH_EXPANSION_FIRST_SLOT + local;
      const moduleId = occupied.get(slotIndex) ?? null;
      const definition = moduleId ? getCageDefinitionByModuleId(moduleId) : null;
      const training = trainingViewFromDefinition(definition);
      slots.push({ slotIndex, deck: 1, column: Math.floor(local / 2), row: local % 2, unlocked: true, fixed: false,
        moduleId, displayName: definition?.displayName ?? null, trainingSummary: moduleId ? training.summary : null });
    }
    if (grid) {
      // Once a native-rank cell has opened, preserve it in the migration grant.
      // Rank changes must never re-lock existing placements in the unified grid.
      gridAccess = normalizeProductRanchAccess({ ...gridAccess, legacyUnlockedSlots:[...new Set([
        ...gridAccess.legacyUnlockedSlots, ...Array.from({length:publicTestGrid ? MAX_SLOT_COUNT : unlockedCount},(_,slot)=>slot)
      ])] });
      slots.length = 0;
      // Every lattice position is open; land limits how many cells are used.
      for (let slotIndex = 0; slotIndex < PRODUCT_RANCH_SLOT_COUNT; slotIndex++) {
        const moduleId = occupied.get(slotIndex) ?? null;
        const definition = moduleId ? getCageDefinitionByModuleId(moduleId) : null;
        const training = trainingViewFromDefinition(definition);
        slots.push({ ...productGridCell(slotIndex), instanceId:instanceAt.get(slotIndex)??null, unlocked: true,
          fixed: moduleId === WAITING_ROOM_MODULE, moduleId, displayName: definition?.displayName ?? null,
          trainingSummary: moduleId ? training.summary : null });
      }
    }
    const placed = new Set(draft.map((entry) => entry.moduleId));
    const tray = listCageDefinitions()
      .filter((record) => owned.has(record.moduleId) && (grid?draft.filter(p=>p.moduleId===record.moduleId).length<ownedModuleCount(record.moduleId,shopCageOwned):!placed.has(record.moduleId)))
      .map((record) => {
        const training = trainingViewFromDefinition(record);
        return {
          moduleId: record.moduleId,
          availableCount:ownedModuleCount(record.moduleId,shopCageOwned)-draft.filter(p=>p.moduleId===record.moduleId).length,
          ownedCount:ownedModuleCount(record.moduleId,shopCageOwned),
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
      layoutVersion,
      occupiedCount: occupied.size,
      definitionCount: CAGE_DEFINITION_COUNT,
      ownedCount: owned.size,
      tamerRank,
      tamerRankTableLastIndex: TAMER_RANK_TABLE_LAST_INDEX,
      maxSlotCount: grid ? PRODUCT_RANCH_SLOT_COUNT : MAX_SLOT_COUNT,
      unlockedCount: grid ? landCapacity(unlockedCount) : unlockedCount,
      ...(grid ? { gridAccess: normalizeProductRanchAccess(gridAccess), testAccessOverride,
        mainUnlockedCount: unlockedCount, unlockedSlots:null, landCapacity: landCapacity(unlockedCount),
        productGrid: { columns:PRODUCT_RANCH_COLUMNS, rows:PRODUCT_RANCH_ROWS, cellCap:PRODUCT_RANCH_CELL_CAP,
          usedCells:productOccupiedCellCount(draft), landCapacity:landCapacity(unlockedCount), lockedSlots:[],
          landRows:productLockedLandRows(gridAccess, unlockedCount) } } : {}),
      slotCountEvidence: SLOT_COUNT_EVIDENCE,
      placementModel: layoutVersion ? 'ORIGINAL_MULTI_CELL_FOOTPRINT' : PLACEMENT_MODEL,
      placementEvidence: grid ? 'OWNER_APPROVED_ADAPTATION' : layoutVersion ? 'VERIFIED_BINARY_NATIVE_REPLAY' : PLACEMENT_EVIDENCE,
      effectParity: EFFECT_PARITY,
      effectChannelEvidence: EFFECT_CHANNEL_EVIDENCE,
      capacityRule: CAPACITY_RULE,
      capacityRuleEvidence: CAPACITY_RULE_EVIDENCE,
      capacityOverfillConsequence: CAPACITY_OVERFILL_CONSEQUENCE,
      rotationEnabled: false,
      ...(expansion ? { expansion: { ...expansion, annexSlotCount: annexSlotCount(expansion), firstSlot: RANCH_EXPANSION_FIRST_SLOT,
        deckSlots: RANCH_EXPANSION_DECK_SLOTS, evidence: RANCH_EXPANSION_EVIDENCE } } : {}),
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

    quoteTestRow(row, shopCageOwned = [], tamerRank = 0) {
      const frame = getFrame(shopCageOwned,tamerRank);
      if (!grid || testAccessOverride !== PUBLIC_TEST_RANCH_ACCESS || !Number.isInteger(row) || row < 2 || row >= 10) {
        return { ok:false, reason:'TEST_ROW_PURCHASE_UNAVAILABLE' };
      }
      if (!frame.productGrid.landRows.some(entry=>entry.row===row)) return { ok:false, reason:'TEST_ROW_ALREADY_OPEN' };
      return { ok:true, reason:'TEST_ROW_QUOTED', row, price:1000, currency:'TEST_DIAMONDS' };
    },

    // Internal grant half of the app's atomic wallet + access transaction.
    // The public UI may only call app.buyRanchTestRow, which performs the debit.
    applyTestRowPurchase(row, shopCageOwned = [], tamerRank = 0) {
      const quote = this.quoteTestRow(row,shopCageOwned,tamerRank);
      if (!quote.ok) { lastVerdict=quote; return getFrame(shopCageOwned,tamerRank); }
      gridAccess = normalizeProductRanchAccess({ ...gridAccess, testUnlockedRows:[...gridAccess.testUnlockedRows,row] });
      lastVerdict = { ok:true, reason:'TEST_ROW_PURCHASED' }; return getFrame(shopCageOwned,tamerRank);
    },

    rejectTestRowPurchase(reason, shopCageOwned = [], tamerRank = 0) {
      lastVerdict = { ok:false, reason }; return getFrame(shopCageOwned,tamerRank);
    },

    // Restore only access, not placements or the user's unconfirmed draft,
    // when the encompassing wallet/save transaction fails.
    restoreGridAccess(previousAccess, shopCageOwned = [], tamerRank = 0) {
      if (!grid) throw cageError('PRODUCT_RANCH_REQUIRED');
      gridAccess=normalizeProductRanchAccess(previousAccess);
      return getFrame(shopCageOwned,tamerRank);
    },

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
      if (grid ? draft.filter(entry=>entry.moduleId===selectedModuleId).length>=ownedModuleCount(selectedModuleId,shopCageOwned) : draft.some((entry) => entry.moduleId === selectedModuleId)) {
        lastVerdict = { ok: false, reason: "ALREADY_PLACED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (grid) {
        if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= PRODUCT_RANCH_SLOT_COUNT) {
          lastVerdict = { ok:false, reason:'OUT_OF_BOUNDS' }; return getFrame(shopCageOwned, tamerRank);
        }
        const withdrawn=withdrawnCopies.get(selectedModuleId),reusedId=withdrawn?.at(-1);
        const candidate = { moduleId:selectedModuleId, slotIndex, instanceId:reusedId??allocateInstance() };
        const problem = productRanchProblem([...draft,candidate], landCapacity(unlockedCount));
        if (problem) {
          if(!reusedId)nextInstanceSequence--;
          lastVerdict = { ok:false, reason:HEX_WORLD_REASONS[problem] ?? 'FOOTPRINT_BLOCKED' }; return getFrame(shopCageOwned, tamerRank);
        }
        if(reusedId)withdrawn.pop();
        draft = [...draft,candidate]; selectedModuleId = null;
        lastVerdict = { ok:true, reason:'PLACED' }; return getFrame(shopCageOwned, tamerRank);
      }
      const annex = isAnnexSlot(slotIndex) && slotIndex < RANCH_EXPANSION_FIRST_SLOT + annexSlotCount(expansion);
      if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || (slotIndex >= MAX_SLOT_COUNT && !annex)) {
        lastVerdict = { ok: false, reason: "OUT_OF_BOUNDS" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (!annex && slotIndex >= unlockedCount) {
        lastVerdict = { ok: false, reason: "SLOT_LOCKED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (layoutVersion) {
        const candidate = { moduleId: selectedModuleId, slotIndex };
        if (!validateRanchLayout([...draft, candidate], { layoutVersion, mainUnlocked: unlockedCount, expansion })) {
          lastVerdict = { ok: false, reason: 'FOOTPRINT_BLOCKED' };
          return getFrame(shopCageOwned, tamerRank);
        }
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

    /**
     * Move one placed cage to another anchor. Its instance (and so its
     * residents, whose positions are cage-local) moves with it. A refused move
     * keeps the layout exactly as it was and reports why.
     */
    movePlacement(reference, slotIndex, shopCageOwned = [], tamerRank = 0) {
      if (!grid) { lastVerdict = { ok:false, reason:'PRODUCT_RANCH_REQUIRED' }; return getFrame(shopCageOwned, tamerRank); }
      const target=draft.find(p=>p.instanceId===reference);
      if (!target) { lastVerdict = { ok:false, reason:'NOT_PLACED' }; return getFrame(shopCageOwned, tamerRank); }
      if (target.moduleId === WAITING_ROOM_MODULE) { lastVerdict = { ok:false, reason:'FIXED_WAITING_ROOM' }; return getFrame(shopCageOwned, tamerRank); }
      if (target.slotIndex === slotIndex) { lastVerdict = { ok:true, reason:'MOVED' }; return getFrame(shopCageOwned, tamerRank); }
      if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= PRODUCT_RANCH_SLOT_COUNT) {
        lastVerdict = { ok:false, reason:'OUT_OF_BOUNDS' }; return getFrame(shopCageOwned, tamerRank);
      }
      const moved = draft.map(p => p === target ? { ...p, slotIndex } : p);
      const problem = productRanchProblem(moved, Math.max(landCapacity(slotCountForTamerRank(tamerRank)), productOccupiedCellCount(draft)));
      if (problem) { lastVerdict = { ok:false, reason:HEX_WORLD_REASONS[problem] ?? 'FOOTPRINT_BLOCKED' }; return getFrame(shopCageOwned, tamerRank); }
      draft = moved;
      lastVerdict = { ok:true, reason:'MOVED' };
      return getFrame(shopCageOwned, tamerRank);
    },

    removePlacement(reference, shopCageOwned = [], tamerRank = 0, { residentInstances = null } = {}) {
      const target=draft.find(p=>(p.instanceId??p.moduleId)===reference)??draft.find(p=>p.moduleId===reference);
      const moduleId=target?.moduleId??reference;
      if (layoutVersion && moduleId === WAITING_ROOM_MODULE) {
        lastVerdict = { ok: false, reason: 'FIXED_WAITING_ROOM' };
        return getFrame(shopCageOwned, tamerRank);
      }
      // v1: never take land out from under a partner; the player moves it first.
      if (grid && target?.instanceId && residentInstances?.has?.(target.instanceId)) {
        lastVerdict = { ok:false, reason:'RESIDENTS_PRESENT', instanceId:target.instanceId };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (!draft.some((entry) => entry.moduleId === moduleId)) {
        lastVerdict = { ok: false, reason: "NOT_PLACED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      draft = draft.filter((entry) => entry !== target);
      if(grid&&target?.instanceId){const free=withdrawnCopies.get(moduleId)??[];free.push(target.instanceId);withdrawnCopies.set(moduleId,free);selectedModuleId=moduleId;}
      lastVerdict = { ok: true, reason: "REMOVED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    confirm(shopCageOwned = [], tamerRank = 0) {
      const owned = ownedModuleIds(shopCageOwned);
      const unlockedCount = slotCountForTamerRank(tamerRank);
      draft = dropInvalid(draft, owned, unlockedCount);
    if(grid)for(const moduleId of new Set(draft.map(p=>p.moduleId)))if(draft.filter(p=>p.moduleId===moduleId).length>ownedModuleCount(moduleId,shopCageOwned))throw cageError("CAGE_INSTANCE_STOCK_MISMATCH");
      committed = clonePlacements(draft);
      withdrawnCopies.clear();
      selectedModuleId = null;
      lastVerdict = { ok: true, reason: "CONFIRMED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    revert(shopCageOwned = [], tamerRank = 0) {
      draft = clonePlacements(committed);
      withdrawnCopies.clear();
      selectedModuleId = null;
      lastVerdict = { ok: true, reason: "REVERTED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    /**
     * Prototype grant (non-paid): adds one annex deck. It changes the saved
     * layout version, so it commits at once instead of riding the draft; the
     * placements themselves are untouched.
     */
    grantExpansion(shopCageOwned = [], tamerRank = 0) {
      if (layoutVersion === RANCH_DECKS_LAYOUT) {
        lastVerdict = { ok: true, reason: "EXPANSION_ALREADY_GRANTED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if (layoutVersion !== NATIVE_RANCH_LAYOUT) {
        lastVerdict = { ok: false, reason: "EXPANSION_REQUIRES_NATIVE_RANCH" };
        return getFrame(shopCageOwned, tamerRank);
      }
      layoutVersion = RANCH_DECKS_LAYOUT;
      expansion = prototypeRanchExpansion();
      lastVerdict = { ok: true, reason: "EXPANSION_GRANTED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    /** Undo the grant while the annex is empty, back to the original version. */
    revokeExpansion(shopCageOwned = [], tamerRank = 0) {
      if (layoutVersion !== RANCH_DECKS_LAYOUT) {
        lastVerdict = { ok: false, reason: "EXPANSION_NOT_GRANTED" };
        return getFrame(shopCageOwned, tamerRank);
      }
      if ([...committed, ...draft].some((entry) => isAnnexSlot(entry.slotIndex))) {
        lastVerdict = { ok: false, reason: "EXPANSION_NOT_EMPTY" };
        return getFrame(shopCageOwned, tamerRank);
      }
      layoutVersion = NATIVE_RANCH_LAYOUT;
      expansion = null;
      lastVerdict = { ok: true, reason: "EXPANSION_REVOKED" };
      return getFrame(shopCageOwned, tamerRank);
    },

    toSave() {
      return deepFreeze({
        ...(layoutVersion ? { layoutVersion } : {}),
        ...(grid ? { gridAccess: normalizeProductRanchAccess(gridAccess), nextInstanceSequence } : {}),
        ...(expansion ? { expansion: { ...expansion } } : {}),
        placements: clonePlacements(committed)
      });
    }
  });
}
