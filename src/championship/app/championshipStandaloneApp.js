// Championship Modern -- standalone application core.
//
// Owns the standalone game lifecycle: New Game, Continue, interaction, save,
// and restore-after-reload. Deliberately DOM-free so the whole loop is testable
// without a browser; main.js is the thin browser shell on top of it.
//
// The only durable write is the standalone Championship 2026 save key.

import { createChampionshipR2Session } from "../r2/createChampionshipR2Session.js";
import { createChampionshipSavePortR2 } from "../kernel/ChampionshipSavePortR2.js";
import {
  deserializeRaisingHomeSaveR2,
  restoreRaisingHomeSnapshotR2
} from "../raising/raisingHomePersistenceR2.js";
import {
  assignCreatureToCage,
  createRaisingProductionState,
  normalizeRaisingProductionState,
  recordCareInteraction,
  recordEnclosedCreature,
  renameEnclosedCreature
} from "./championshipRaisingProduction.js";
import { createChampionshipPersistentSavePort } from "./ChampionshipPersistentSavePort.js";
import { selectPhase1FirstCreature } from "./phase1ProductCreatures.js";
import { CHAMPIONSHIP_SCREENS, createChampionshipScreenStack } from "./championshipScreenStack.js";
import { getChampionshipGate, listChampionshipGates } from "../gate/gateCatalog.js";
import { createHuntWorld } from "../hunt/huntWorld.js";
import { createHuntRuntime } from "../hunt/huntRuntime.js";
import { createHuntInventory } from "../hunt/loadout/huntInventory.js";
import { createHuntLoadout } from "../hunt/loadout/huntLoadoutRuntime.js";
import { HUNT_STARTING_INVENTORY } from "../hunt/loadout/huntEquipmentCatalog.js";
import { evaluateBringHomeCapacity } from "../hunt/capture/memoryCardCapacity.js";
import {
  applyMappedHuntInventoryFromShop,
  createShopRuntime
} from "../shop/shopRuntime.js";
import { projectDatabase } from "../database/databaseRuntime.js";
import { DATABASE_SLOT_COUNT } from "../database/databaseCatalog.js";
import { createCageEditRuntime } from "../cage/cageEditRuntime.js";
import { normalizeTamerRank } from "../cage/cageCatalog.js";

export const STANDALONE_SESSION_ID = "championship-modern-home";
export const STANDALONE_SLOT_ID = "raising-home";

// Copy for the standalone build. The R2 defaults say "in memory ... this page
// session", which is true of the research port and false here: this save
// survives a reload.
export const STANDALONE_SAVE_PHASE_COPY = Object.freeze({
  DIRTY: "Unsaved changes. Save to keep them after you close the game.",
  CLEAN: "Your saved game matches what is on screen.",
  SAVED: "Saved. This game will still be here after you close and reopen it.",
  RESTORED: "Restored from your saved game.",
  RECOVERED: "Recovered your last good saved game.",
  DISPOSED: "This session is closed."
});
export const STANDALONE_SAVE_UNAVAILABLE_COPY = "Save status is unavailable.";

export function createChampionshipStandaloneApp({
  storage,
  catalog,
  cages = [],
  sessionId = STANDALONE_SESSION_ID,
  slotId = STANDALONE_SLOT_ID,
  huntStartingInventory = HUNT_STARTING_INVENTORY,
  now = () => new Date().toISOString()
} = {}) {
  if (!catalog) throw new TypeError("Championship standalone app requires a product entities catalog");
  const savePort = createChampionshipPersistentSavePort({ storage, now });

  const cageIds = cages.map((cage) => cage.cageId);
  let session = null;
  let creature = null;
  let revision = 0;
  let interactionCount = 0;
  // Production Raising state. Owned here, never by the frozen R2 reducer.
  let raising = null;
  let selectedCreatureId = null;

  // VS2 expedition state. Session-scoped on purpose: no original Hunt
  // persistence is traced, and the save envelope is deny-by-default on unknown
  // keys, so gate choice, companion choice and field position deliberately do
  // not survive a reload.
  const screens = createChampionshipScreenStack({ initial: CHAMPIONSHIP_SCREENS.RAISING_HOME });
  let selectedGateId = null;
  let confirmedGateId = null;
  let huntRuntime = null;
  // The Shop owns the inventory; the loadout only reads it.
  let huntInventory = null;
  let huntLoadout = null;
  let shop = null;
  let lastShopReceipt = null;
  let selectedDatabaseSpeciesIndex = null;
  let cageEdit = null;
  // Original PlayerData +0xAE8. Title matches write it; until battle exists this
  // is a PRODUCT_AUTHORED seam (setTamerRank), same shape as creditBits.
  let tamerRankValue = 0;
  // Snapshot of the last enclosed wild, for Hunt Result. Session-scoped: the
  // durable write is the raising.collection entry, not this screen payload.
  let huntResult = null;
  // DEVELOPER_PROTOTYPE_ONLY. Companion selection was the VS2 placeholder for a
  // loadout. It is not part of the Player Mode path and no seam surfaces it.
  let developerCompanionCreatureId = null;
  const screenListeners = new Set();
  const shopListeners = new Set();
  let shopRuntimeUnsubscribe = null;

  function speciesDisplayName(speciesId) {
    const slug = String(speciesId ?? "").split(":").pop() || "creature";
    return slug.replace(/-/g, " ").toUpperCase();
  }

  function publishScreens() {
    for (const listener of [...screenListeners]) {
      try { listener(screens.current()); } catch { /* observers never break navigation */ }
    }
  }

  /** Drop every expedition choice and leave the player at Raising Home. */
  function resetExpedition() {
    huntRuntime = null;
    huntLoadout = null;
    huntResult = null;
    selectedGateId = null;
    confirmedGateId = null;
    developerCompanionCreatureId = null;
    if (screens.canExit()) screens.exit();
    else while (screens.canGoBack()) screens.back();
  }

  function requireShop() {
    if (!shop) throw new Error("CHAMPIONSHIP_SHOP_NOT_OPEN");
    return shop;
  }

  function bindShopRuntime() {
    shopRuntimeUnsubscribe?.();
    shopRuntimeUnsubscribe = shop.subscribe(() => {
      for (const listener of [...shopListeners]) {
        try { listener(shop.getFrame()); } catch { /* observers never break the shop */ }
      }
    });
  }

  function shopCageOwned() {
    return shop?.toSave()?.cageOwned ?? [];
  }

  function tamerRank() {
    return tamerRankValue;
  }

  function progressionContext() {
    return { tamerRank: tamerRankValue, battleBadges: [] };
  }

  function applyProgression() {
    const progression = progressionContext();
    shop?.setProgression(progression);
    huntInventory?.setProgression(progression);
  }

  function cageEditArgs() {
    return [shopCageOwned(), tamerRank()];
  }

  function requireCageEdit() {
    if (!cageEdit) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_OPEN");
    return cageEdit;
  }

  function openShopAndHunt({ shopSnapshot = null } = {}) {
    lastShopReceipt = null;
    const progression = progressionContext();
    if (shopSnapshot) {
      // Continue: Shop snapshot is the inventory authority. Hunt starts empty
      // and receives only the mapped SKUs the Shop currently owns.
      huntInventory = createHuntInventory({ entries: [], ...progression });
      shop = createShopRuntime({ huntInventory, snapshot: shopSnapshot, progression });
      applyMappedHuntInventoryFromShop(shop, huntInventory);
    } else {
      huntInventory = createHuntInventory({ entries: huntStartingInventory, ...progression });
      shop = createShopRuntime({ huntInventory, progression });
    }
    bindShopRuntime();
  }

  function requireLoadout() {
    if (!huntLoadout) throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
    return huntLoadout;
  }

  function requireSession() {
    if (!session) throw new Error("CHAMPIONSHIP_SESSION_NOT_OPEN");
    return session;
  }

  /** Seed a fresh in-memory R2 port with a restored snapshot, so the existing
   *  coordinator restore path -- savePort.readSnapshot() -> initialSnapshot --
   *  does the rehydration instead of a second, parallel one. */
  function seededRealmPort(restoredSnapshot) {
    const port = createChampionshipSavePortR2();
    port.issueWriterToken();
    const seeded = port.requestWrite({
      requestId: `${sessionId}:restore`,
      expectedRevision: 0,
      slotId,
      snapshot: restoredSnapshot
    });
    if (!seeded.accepted) throw new Error(`CHAMPIONSHIP_RESTORE_SEED_FAILED: ${seeded.code}`);
    return port;
  }

  async function openSession(realmPort) {
    const opened = createChampionshipR2Session({
      sessionId,
      raisingSavePort: realmPort,
      raisingSaveSlotId: slotId
    });
    await opened.open();
    session = opened;
    return opened;
  }

  return Object.freeze({
    savePort,

    hasSave() {
      return savePort.read().present;
    },

    inspectSave() {
      return savePort.read();
    },

    getCreature() {
      return creature;
    },

    getSession() {
      return session;
    },

    getSnapshot() {
      return session ? session.getRaisingHomeSnapshot() : null;
    },

    getInteractionCount() {
      return interactionCount;
    },

    async newGame() {
      if (session) await this.dispose();
      savePort.clear();
      creature = selectPhase1FirstCreature(catalog);
      revision = 0;
      interactionCount = 0;
      tamerRankValue = 0;
      await openSession(createChampionshipSavePortR2());
      const creatureIds = session.getRaisingHomeSnapshot().residents.map((r) => r.residentId);
      raising = createRaisingProductionState({ cageIds, creatureIds });
      selectedCreatureId = null;
      openShopAndHunt();
      cageEdit = createCageEditRuntime();
      selectedDatabaseSpeciesIndex = null;
      resetExpedition();
      return { creature, snapshot: session.getRaisingHomeSnapshot(), raising };
    },

    /** Restore a previously saved standalone game. Returns null when there is
     *  nothing loadable, so the shell can fall back to New Game rather than
     *  stranding the player on an error. */
    async continueGame() {
      const read = savePort.read();
      if (!read.present) return null;
      const { document } = deserializeRaisingHomeSaveR2(read.save.raisingHome);
      const restored = restoreRaisingHomeSnapshotR2(document, { sessionId });
      if (session) await this.dispose();
      creature = Object.freeze({ ...read.save.creature });
      revision = read.save.progression.revision ?? 0;
      interactionCount = read.save.progression.interactionCount ?? 0;
      tamerRankValue = normalizeTamerRank(read.save.progression.tamerRank);
      await openSession(seededRealmPort(restored));
      const creatureIds = session.getRaisingHomeSnapshot().residents.map((r) => r.residentId);
      raising = normalizeRaisingProductionState(read.save.raising, { cageIds, creatureIds });
      selectedCreatureId = null;
      openShopAndHunt({ shopSnapshot: read.save.shop });
      cageEdit = createCageEditRuntime({ snapshot: read.save.cageEdit });
      selectedDatabaseSpeciesIndex = null;
      resetExpedition();
      return { creature, snapshot: session.getRaisingHomeSnapshot(), save: read.save, raising };
    },

    dispatch(command) {
      const active = requireSession();
      const snapshot = active.getRaisingHomeSnapshot();
      const publication = active.dispatchRaisingHome({
        ...command,
        commandId: command.commandId ?? `${sessionId}:${command.type}:${interactionCount + 1}`,
        expectedRevision: command.expectedRevision ?? snapshot.revision
      });
      if (publication?.accepted) interactionCount += 1;
      return publication;
    },

    getRaisingState() {
      return raising;
    },

    getSelectedCreatureId() {
      return selectedCreatureId;
    },

    getCages() {
      return cages;
    },

    /** Direct touch selection. Product-owned: it never reaches the R2 reducer. */
    select(creatureId) {
      if (creatureId !== null && !raising?.assignments[creatureId]) {
        throw new Error(`CHAMPIONSHIP_UNKNOWN_CREATURE: ${creatureId}`);
      }
      selectedCreatureId = creatureId;
      return selectedCreatureId;
    },

    /** Drag-and-drop relocation. No effect is applied, because none is verified. */
    moveToCage(creatureId, cageId) {
      raising = assignCreatureToCage(raising, creatureId, cageId, { cageIds });
      interactionCount += 1;
      return raising;
    },

    /**
     * Use a care tool.
     *
     * Records a product-authored interaction flag and nothing else. The R2
     * `+14 satiety / +5 ease` numbers are adaptation-only (see
     * ORIGINAL_RAISING_GAMEPLAY_CONTRACT), so production mutates no stat and
     * invents no replacement number. The player gets a reaction, not arithmetic.
     */
    care(creatureId) {
      raising = recordCareInteraction(raising, creatureId, now());
      interactionCount += 1;
      return raising;
    },

    save() {
      const active = requireSession();
      if (!creature) throw new Error("CHAMPIONSHIP_NO_CREATURE");
      revision += 1;
      return savePort.save({
        snapshot: active.getRaisingHomeSnapshot(),
        creature,
        sessionId,
        revision,
        interactionCount,
        tamerRank: tamerRankValue,
        raising,
        shop: shop ? shop.toSave() : null,
        cageEdit: cageEdit ? cageEdit.toSave() : null
      });
    },

    // ---------------------------------------------------------------------
    // VS2 -- Gate Select, Hunt Loadout, Hunt Field
    // ---------------------------------------------------------------------

    getScreen() {
      return screens.current();
    },

    getScreenTrail() {
      return screens.trail();
    },

    subscribeScreen(listener) {
      if (typeof listener !== "function") throw new TypeError("A screen observer must be a function");
      screenListeners.add(listener);
      return () => screenListeners.delete(listener);
    },

    getGates() {
      return listChampionshipGates();
    },

    getSelectedGateId() {
      return selectedGateId;
    },

    getConfirmedGate() {
      return confirmedGateId === null ? null : getChampionshipGate(confirmedGateId);
    },

    getHuntInventory() {
      return huntInventory;
    },

    getHuntLoadout() {
      return huntLoadout;
    },

    /** DEVELOPER_PROTOTYPE_ONLY. Never surfaced by the Player Mode seam. */
    getDeveloperCompanionCreatureId() {
      return developerCompanionCreatureId;
    },

    getHuntRuntime() {
      return huntRuntime;
    },

    getHuntResult() {
      return huntResult;
    },

    getShopFrame() {
      if (!shop) return null;
      return Object.freeze({ ...shop.getFrame(), lastReceipt: lastShopReceipt });
    },

    subscribeShop(listener) {
      if (typeof listener !== "function") throw new TypeError("A shop observer must be a function");
      shopListeners.add(listener);
      return () => shopListeners.delete(listener);
    },

    /**
     * Inject Bits. Original income (battle rewards) is untraced, so tests and
     * later reward writers share this one PRODUCT_AUTHORED seam.
     */
    creditBits(amount) {
      return requireShop().creditBits(amount);
    },

    getTamerRank() {
      return tamerRankValue;
    },

    /**
     * Write tamer rank. Original store is PlayerData +0xAE8 after battle result.
     * Until title matches exist this is the same PRODUCT_AUTHORED seam as creditBits.
     */
    setTamerRank(nextRank) {
      requireSession();
      if (!Number.isSafeInteger(nextRank) || nextRank < 0) {
        throw new Error("INVALID_TAMER_RANK");
      }
      tamerRankValue = normalizeTamerRank(nextRank);
      applyProgression();
      publishScreens();
      return tamerRankValue;
    },

    openShop() {
      requireSession();
      requireShop();
      if (screens.current() === CHAMPIONSHIP_SCREENS.SHOP) return screens.current();
      lastShopReceipt = null;
      screens.enter(CHAMPIONSHIP_SCREENS.SHOP);
      publishScreens();
      return screens.current();
    },

    buyShopItem(shopRecordIndex, quantity = 1) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.SHOP) {
        throw new Error("CHAMPIONSHIP_SHOP_NOT_ACTIVE");
      }
      lastShopReceipt = requireShop().buy(shopRecordIndex, quantity);
      publishScreens();
      return lastShopReceipt;
    },

    getDatabaseFrame() {
      const frame = projectDatabase({
        starterSpeciesId: creature?.speciesId ?? null,
        collection: raising?.collection ?? [],
        selectedSpeciesIndex: selectedDatabaseSpeciesIndex
      });
      if (!frame.selected) return frame;
      const instances = frame.selected.instances.map((entry) => {
        const gate = entry.originGateId ? getChampionshipGate(entry.originGateId) : null;
        return { ...entry, originGateName: gate?.displayName ?? null };
      });
      return Object.freeze({
        ...frame,
        selected: Object.freeze({ ...frame.selected, instances })
      });
    },

    openDatabase() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.DATABASE) return screens.current();
      selectedDatabaseSpeciesIndex = null;
      screens.enter(CHAMPIONSHIP_SCREENS.DATABASE);
      publishScreens();
      return screens.current();
    },

    selectDatabaseSpecies(speciesIndex) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.DATABASE) {
        throw new Error("CHAMPIONSHIP_DATABASE_NOT_ACTIVE");
      }
      if (speciesIndex === null) {
        selectedDatabaseSpeciesIndex = null;
        publishScreens();
        return this.getDatabaseFrame();
      }
      if (!Number.isSafeInteger(speciesIndex) || speciesIndex < 0 || speciesIndex >= DATABASE_SLOT_COUNT) {
        throw new Error(`UNKNOWN_DATABASE_SLOT: ${speciesIndex}`);
      }
      selectedDatabaseSpeciesIndex = speciesIndex;
      publishScreens();
      return this.getDatabaseFrame();
    },

    renameDatabaseInstance(instanceId, displayName) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.DATABASE) {
        throw new Error("CHAMPIONSHIP_DATABASE_NOT_ACTIVE");
      }
      raising = renameEnclosedCreature(raising, instanceId, displayName);
      publishScreens();
      return raising.collection.find((entry) => entry.instanceId === instanceId)?.displayName ?? null;
    },

    getCageEditFrame() {
      if (!cageEdit) return null;
      return requireCageEdit().getFrame(...cageEditArgs());
    },

    openCageEdit() {
      requireSession();
      requireCageEdit();
      if (screens.current() === CHAMPIONSHIP_SCREENS.CAGE_EDIT) return screens.current();
      cageEdit.selectModule(null, ...cageEditArgs());
      screens.enter(CHAMPIONSHIP_SCREENS.CAGE_EDIT);
      publishScreens();
      return screens.current();
    },

    selectCageModule(moduleId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().selectModule(moduleId, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    placeCageAt(slotIndex) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().placeAt(slotIndex, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    removeCagePlacement(moduleId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().removePlacement(moduleId, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    confirmCageEdit() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().confirm(...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    openGate() {
      requireSession();
      screens.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
      publishScreens();
      return screens.current();
    },

    selectGate(gateId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.GATE_SELECT) {
        throw new Error("CHAMPIONSHIP_GATE_SELECT_NOT_ACTIVE");
      }
      if (gateId !== null && !getChampionshipGate(gateId)) {
        throw new Error(`CHAMPIONSHIP_UNKNOWN_GATE: ${gateId}`);
      }
      selectedGateId = gateId;
      publishScreens();
      return selectedGateId;
    },

    /** Commit the gate choice and move to loadout. A no-op with no selection. */
    confirmGate() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.GATE_SELECT) return screens.current();
      if (selectedGateId === null) return screens.current();
      confirmedGateId = selectedGateId;
      // Entering the loadout builds it over the Shop-owned inventory.
      huntLoadout = createHuntLoadout({ inventory: huntInventory });
      screens.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
      publishScreens();
      return screens.current();
    },

    selectHuntEquipment(equipmentClass, itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
      }
      const result = requireLoadout().selectEquipment(equipmentClass, itemId);
      publishScreens();
      return result;
    },

    fitHuntPlugin(position, itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
      }
      const result = requireLoadout().fitPlugin(position, itemId);
      publishScreens();
      return result;
    },

    selectHuntMemoryCard(itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
      }
      const result = requireLoadout().selectMemoryCard(itemId);
      publishScreens();
      return result;
    },

    /**
     * DEVELOPER_PROTOTYPE_ONLY.
     *
     * The VS2 companion placeholder, kept for developer inspection and never
     * surfaced by the Player Mode seam. It gates nothing and enters nothing.
     */
    selectDeveloperCompanion(creatureId) {
      if (creatureId !== null && !raising?.assignments[creatureId]) {
        throw new Error(`CHAMPIONSHIP_UNKNOWN_CREATURE: ${creatureId}`);
      }
      developerCompanionCreatureId = creatureId;
      return developerCompanionCreatureId;
    },

    /**
     * Enter the field.
     *
     * The world is built from the gate's deterministic seed, so the same gate is
     * the same field every time without persisting anything.
     */
    beginHunt() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) return screens.current();
      if (confirmedGateId === null) return screens.current();
      requireSession();
      // Entry is gated on the loadout being internally consistent, not on
      // anything being equipped: no original rule requires a full loadout.
      if (!requireLoadout().getConfirmationState().canConfirm) return screens.current();
      const world = createHuntWorld(getChampionshipGate(confirmedGateId));
      huntRuntime = createHuntRuntime({
        world,
        // The tamer walks the field. The Hunt HUD's creature panel describes the
        // WILD target, so the player actor is not a creature the player brought.
        fieldActor: { actorId: "championship:2026:actor:tamer", displayName: "Tamer" }
      });
      screens.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
      publishScreens();
      return screens.current();
    },

    /**
     * Leave the field without an enclosure.
     *
     * Returning home this way writes no collection entry. Collection only grows
     * when a closed original-geometry loop still contains the tethered wild.
     */
    exitHunt() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD) return screens.current();
      huntRuntime = null;
      huntLoadout = null;
      huntResult = null;
      confirmedGateId = null;
      selectedGateId = null;
      screens.exit();
      publishScreens();
      return screens.current();
    },

    beginEnclosureStroke(worldX, worldY) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return false;
      return huntRuntime.beginEnclosureStroke(worldX, worldY);
    },

    extendEnclosureStroke(worldX, worldY) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return false;
      return huntRuntime.extendEnclosureStroke(worldX, worldY);
    },

    /**
     * Finish the current stroke.
     *
     * Geometry success is the close-stroke rule (no original percent roll).
     * Bring-home then hits the original memory-card compare: summed G-cost
     * against max 32/64/96. Over capacity restores the wild and stays on the
     * field. Per-species G-cost is still product unit 1.
     */
    endEnclosureStroke() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return null;
      const verdict = huntRuntime.endEnclosureStroke();
      if (verdict?.outcome !== "ENCLOSED") return verdict;
      const capacity = evaluateBringHomeCapacity(huntInventory, raising.collection?.length ?? 0);
      if (!capacity.allowed) {
        huntRuntime.restoreLastEnclosedWild();
        return Object.freeze({
          ...verdict,
          outcome: "OVER_CAPACITY",
          capacity
        });
      }
      const instanceId = `championship:2026:instance:${String((raising.collection?.length ?? 0) + 1).padStart(4, "0")}`;
      raising = recordEnclosedCreature(raising, {
        instanceId,
        speciesId: verdict.speciesId,
        displayName: speciesDisplayName(verdict.speciesId),
        enclosedAt: now(),
        originGateId: confirmedGateId,
        cageId: cageIds[0]
      });
      huntResult = Object.freeze({
        title: "HUNT RESULT",
        outcomeLabel: "BROUGHT HOME",
        speciesId: verdict.speciesId,
        speciesLabel: speciesDisplayName(verdict.speciesId),
        displayName: speciesDisplayName(verdict.speciesId),
        instanceId,
        tetherBand: verdict.tetherBand,
        successAuthority: verdict.successAuthority,
        collectionCount: raising.collection.length
      });
      screens.enter(CHAMPIONSHIP_SCREENS.HUNT_RESULT);
      publishScreens();
      return verdict;
    },

    /** Close Hunt Result and return to Raising Home. */
    confirmHuntResult() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT) return screens.current();
      huntRuntime = null;
      huntLoadout = null;
      huntResult = null;
      confirmedGateId = null;
      selectedGateId = null;
      screens.exit();
      publishScreens();
      return screens.current();
    },

    /**
     * Hunt Result name edit (original OVL4 plate).
     *
     * The original charset is untraced; this uses the product given-name rule.
     */
    setHuntResultName(displayName) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT || !huntResult) {
        throw new Error("CHAMPIONSHIP_HUNT_RESULT_NOT_ACTIVE");
      }
      raising = renameEnclosedCreature(raising, huntResult.instanceId, displayName);
      const givenName = raising.collection.find((entry) => entry.instanceId === huntResult.instanceId)?.displayName;
      huntResult = Object.freeze({ ...huntResult, displayName: givenName });
      publishScreens();
      return huntResult.displayName;
    },

    /** Step one screen back. Clears the choice the popped screen owned. */
    leaveScreen() {
      const from = screens.current();
      if (from === CHAMPIONSHIP_SCREENS.HUNT_FIELD) return this.exitHunt();
      if (from === CHAMPIONSHIP_SCREENS.HUNT_RESULT) return this.confirmHuntResult();
      if (from === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        huntLoadout = null;
        confirmedGateId = null;
      }
      if (from === CHAMPIONSHIP_SCREENS.GATE_SELECT) selectedGateId = null;
      if (from === CHAMPIONSHIP_SCREENS.SHOP) {
        shop?.markNewSeen();
        lastShopReceipt = null;
      }
      if (from === CHAMPIONSHIP_SCREENS.DATABASE) selectedDatabaseSpeciesIndex = null;
      if (from === CHAMPIONSHIP_SCREENS.CAGE_EDIT) cageEdit?.revert(...cageEditArgs());
      screens.back();
      publishScreens();
      return screens.current();
    },

    /** The controller dispatches through here, so interactions driven from the
     *  UI are counted the same as ones driven from a test. */
    runtimeFacade() {
      const active = requireSession();
      const app = this;
      return Object.freeze({
        getSnapshot: active.getRaisingHomeSnapshot,
        dispatch: (command) => app.dispatch(command),
        subscribe: active.subscribeRaisingHome
      });
    },

    persistenceFacade() {
      const app = this;
      return Object.freeze({
        getStatus: () => savePort.getStatus(),
        subscribe: (listener) => savePort.subscribe(listener),
        save: () => app.save(),
        retry: () => savePort.retry(),
        exportRecovery: () => savePort.exportRecovery()
      });
    },

    async dispose() {
      resetExpedition();
      if (!session) return;
      const closing = session;
      session = null;
      await closing.dispose();
    }
  });
}
