// VS2 Gate/Hunt presentation boundary.
//
// The only runtime seam VS2 presentation consumes, published ahead of the
// implementation as
// docs/contracts/championship/VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.json.
//
// It projects the standalone application's expedition state into small immutable
// frames and routes the named intents back. It owns no gameplay state, save
// state, router, renderer or clock.
//
// TWO CADENCES, ONE AUTHORITY
// ---------------------------
// `getFrame()` publishes on DISCRETE change: a screen change, a selection, a
// save. Field motion is continuous, and republishing a frame sixty times a
// second would drag every DOM observer along with it, so the field renderer
// instead reads `field.getView()` each tick. Both read the same runtime; neither
// holds a second copy of it.

import { huntViewportTransform, huntViewportToWorld } from "../hunt/huntFieldCoordinates.js";
import presentation from "../../../docs/contracts/championship/raising-home-presentation.v1.json" with { type: "json" };
import toolbarContract from "../../../docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json" with { type: "json" };
import { CHAMPIONSHIP_SCREENS } from "./championshipScreenStack.js";
import { huntGateThumbnail, huntTargetReadout, huntPluginReadout } from "../presentation/huntMobileReadouts.js";
import { raisingDisplayName, speciesNameForId } from "../text/zhHant.js";
import { getHuntCatalogItem } from "../hunt/loadout/huntEquipmentCatalog.js";

export const GATE_HUNT_PRESENTATION_CONTRACT_VERSION = "VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT/v1";

const SAVE_PHASES = new Set(["DIRTY", "SAVED", "RESTORED", "RECOVERED", "CLEAN", "SAVE_FAILED"]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function speciesKey(resident) {
  if (typeof resident?.speciesId === "string" && resident.speciesId.length > 0) return resident.speciesId;
  return String(resident?.residentId ?? "").replace(/^resident:/, "");
}

function spriteProjection(key) {
  const idle = presentation.idle.species[key];
  const portrait = presentation.portrait.species[key];
  if (!idle || !portrait) throw new Error(`CHAMPIONSHIP_PRESENTATION_ASSET_CONTRACT_MISSING: ${key}`);
  return { idle: { ...idle }, portrait };
}

/**
 * The Hunt toolbar shell.
 *
 * Mode 2 and the ui/hunt_set asset family are ROM_VERIFIED (OVL0 @0x0211A138,
 * MOV R1,#2). Everything inside a slot is not, so every slot ships exactly as it
 * does in Raising: neutral, disabled, carrying its raw id and nothing else.
 */
function huntToolbarProjection() {
  const geometry = toolbarContract.slotFrameGeometry;
  if (toolbarContract.toolbar.slotCount.value !== 8 || geometry.slots.length !== 8) {
    throw new Error("CHAMPIONSHIP_TOOLBAR_CONTRACT_DRIFT");
  }
  return {
    slotCount: { value: 8, evidence: "ROM_VERIFIED" },
    mode: { value: 2, context: "HUNT", evidence: "ROM_VERIFIED" },
    assetFamily: { value: "ui/hunt_set", evidence: "ROM_VERIFIED" },
    slots: geometry.slots.map((entry) => ({
      slot: entry.slot,
      buttonNode: `button${entry.slot}`,
      frame: {
        x: entry.x,
        y: entry.y,
        cell: entry.cell,
        labelAnchorX: entry.labelAnchorX,
        labelAnchorY: entry.labelAnchorY
      },
      submenuCapacity: { value: 8, evidence: "ROM_VERIFIED" },
      submenuEntries: { value: [], evidence: "UNKNOWN_REQUIRES_TRACE" },
      commandId: { value: null, evidence: "UNKNOWN_REQUIRES_TRACE" },
      iconCell: { value: null, evidence: "UNKNOWN_REQUIRES_TRACE" },
      label: { value: null, evidence: "UNKNOWN_REQUIRES_TRACE" },
      state: "UNBOUND_PLACEHOLDER"
    })),
    presentationRule: "Render RAW_SLOT_0 through RAW_SLOT_7 in ROM order as neutral disabled placeholders."
  };
}

const HUNT_TOOLBAR_FRAME = deepFreeze(huntToolbarProjection());

function assertApplication(app) {
  const methods = [
    "getScreen", "getGates", "getSelectedGateId", "getConfirmedGate",
    "getHuntRuntime", "getHuntLoadout", "getHuntResult", "getShopFrame", "getDatabaseFrame", "getGateAdmission",
    "getCageEditFrame",
    "openGate", "openShop", "openDatabase", "openCageEdit", "selectGate", "confirmGate",
    "selectHuntEquipment", "fitHuntPlugin", "selectHuntMemoryCard",
    "beginHunt", "exitHunt", "leaveScreen", "buyShopItem", "subscribeShop",
    "selectDatabaseSpecies", "renameDatabaseInstance",
    "selectCageModule", "placeCageAt", "removeCagePlacement", "confirmCageEdit",
    "setTamerRank",
    "beginEnclosureStroke", "extendEnclosureStroke", "endEnclosureStroke", "confirmHuntResult",
    "setHuntResultName", "abortEnclosureStroke",
    "getSnapshot", "getRaisingState", "save"
  ];
  if (!app || methods.some((method) => typeof app[method] !== "function")) {
    throw new TypeError("VS2 requires an open Championship standalone application");
  }
  if (typeof app.savePort?.getStatus !== "function" || typeof app.savePort?.subscribe !== "function") {
    throw new TypeError("VS2 requires the standalone save authority");
  }
}

export function createGateHuntPresentationSource(app) {
  assertApplication(app);
  const listeners = new Set();
  let frameRevision = 0;
  let currentFrame = null;
  let screenUnsubscribe = null;
  let saveUnsubscribe = null;
  let shopUnsubscribe = null;

  function saveBlock() {
    const status = app.savePort.getStatus();
    return {
      phase: SAVE_PHASES.has(status.phase) ? status.phase : "CLEAN",
      savedAt: typeof status.savedAt === "string" ? status.savedAt : null,
      canRetry: Boolean(status.canRetry)
    };
  }

  function gateSelectBlock() {
    const selectedGateId = app.getSelectedGateId();
    const admission = app.getGateAdmission(selectedGateId);
    return {
      gates: app.getGates().map((gate) => ({
        gateId: gate.gateId,
        ordinal: gate.ordinal,
        // The recovered node identity is canonical; the display string is a
        // presentation default a localization layer may replace.
        biomeId: gate.biomeId,
        identityEvidence: gate.identityEvidence,
        displayName: gate.displayName,
        displayNameEvidence: gate.displayNameEvidence,
        codeString: gate.codeString,
        entranceFeeBits: gate.entranceFeeBits,
        biomeOrdinal: gate.biomeOrdinal,
        state: gate.state,
        stateEvidence: gate.stateEvidence,
        unlockKind: gate.unlockKind,
        unlockParameter: gate.unlockParameter,
        selected: gate.gateId === selectedGateId,
        art: { thumbnail: huntGateThumbnail(gate) }
      })),
      gateCount: { value: app.getGates().length, evidence: "ROM_VERIFIED" },
      selection: { gateId: selectedGateId },
      walletBits: app.getShopFrame()?.bits ?? null,
      admission,
      canConfirm: admission.canConfigure,
      affordances: {
        tapSelects: true,
        confirmRequiresSelection: true,
        note: "Pointer Events only; mouse and touch share one path."
      },
      presentationRule: "Gate availability follows the original initial/rank/battle unlock rule. Selection previews any Gate; a locked Gate cannot be confirmed. Fee is committed once when the configured expedition enters the field."
    };
  }

  /**
   * The Hunt Loadout surface.
   *
   * Read-only, and shaped by the recovered original: five equipment classes, four
   * plugin positions, quantities and durability carried from a Shop-owned
   * inventory, and the HUD capabilities the fitted plugins unlock.
   *
   * Companion selection is NOT here. It was the VS2 prototype, it is
   * DEVELOPER_PROTOTYPE_ONLY, and the Player Mode seam does not surface it.
   */
  function huntLoadoutBlock() {
    const gate = app.getConfirmedGate();
    const loadout = app.getHuntLoadout();
    if (!loadout) return null;
    const validation = loadout.validate();
    const admission = app.getGateAdmission(gate?.gateId);
    return {
      gate: gate === null ? null : { gateId: gate.gateId, biomeId: gate.biomeId, displayName: gate.displayName },
      structure: {
        equipmentClasses: { value: 5, evidence: "ROM_VERIFIED" },
        pluginPositions: { value: 4, evidence: "ROM_VERIFIED" },
        positionModel: { value: loadout.positionModel, evidence: "PARTIAL_HL6_OPEN" }
      },
      availableEquipment: loadout.listAvailableEquipment(),
      selectedEquipment: loadout.getSelectedEquipment(),
      availablePlugins: loadout.listAvailablePlugins(),
      selectedPlugins: loadout.getSelectedPlugins(),
      memoryCard: loadout.getMemoryCard(),
      hudCapabilities: loadout.getHudCapabilities(),
      validation,
      confirmationState: loadout.getConfirmationState(),
      admission,
      canBegin: loadout.getConfirmationState().canConfirm && admission.canEnter,
      entryError: app.getHuntEntryError?.() ?? null,
      presentationRule: "Render the five recovered equipment classes and four plugin positions. No original rule requires anything to be equipped. Show the recovered Gate fee and wallet from admission; disable start when admission fails. Do not invent an item effect, a carry limit, an item price, or a companion."
    };
  }

  function huntFieldBlock() {
    const runtime = app.getHuntRuntime();
    const gate = app.getConfirmedGate();
    if (!runtime) return null;
    const world = runtime.world;
    return {
      world: {
        widthTiles: { value: world.widthTiles, evidence: "VERIFIED_BINARY" },
        heightTiles: { value: world.heightTiles, evidence: "VERIFIED_BINARY" },
        tileSizePx: { value: world.tileSizePx, evidence: "PRODUCT_AUTHORED" },
        chunkSizeTiles: { value: world.chunkSizeTiles, evidence: "PRODUCT_AUTHORED" },
        worldWidthPx: world.worldWidthPx,
        worldHeightPx: world.worldHeightPx,
        preservationRule: "9:16 is the viewport, never the world. The logical grid stays hidden: no tile lines, no coordinate readout, no grid overlay."
      },
      hud: {
        target: huntTargetReadout(runtime, app.getHuntLoadout()?.getHudCapabilities()),
        plugins:huntPluginReadout(runtime,app.getHuntLoadout()?.getHudCapabilities()),
        time:app.getHuntTimeState?.() ?? null,
        gateName: gate?.displayName ?? null,
        actorName: runtime.getPlayer().displayName,
        // What the HUD may display is decided at loadout by the fitted plugins.
        // A readout with no plugin behind it stays dark - the recovered rule.
        capabilities: app.getHuntLoadout()?.getHudCapabilities() ?? null,
        exitAvailable: true,
        note: "Deliberately minimal. hunt_sub_scene carries map_marker0..23 and remain_icon0..3 as structural evidence only; their semantics are unknown, so none are rendered."
      },
      affordances: {
        dragPans: true,
        tapSelectsWild: true,
        touchNearWildStartsStroke: false,
        canCollect: runtime.getCaptureAvailability()?.canCollect ?? false,
        note: "HAND pans empty ground and collects eligible targets. The selected native tool owns other gestures."
      },
      wildBehaviourDeclaration: {
        state: runtime.getToolState?.() ? "PARTIAL_NATIVE_AI_INTEGRATION" : "UNKNOWN_REQUIRES_TRACE",
        movementAuthority: runtime.movementAuthority,
        note: "Native tool/actor ports share the normal encounter RNG. Full AI and every-tool live ROM parity remain separate acceptance requirements."
      },
      toolbar: HUNT_TOOLBAR_FRAME,
      toolState:runtime.getToolState?.() ?? null
    };
  }

  function huntResultBlock() {
    const result = app.getHuntResult();
    if (!result) return null;
    const cardEntries = app.getHuntRuntime()?.getOnCardEntries?.() ?? [];
    const homeEntries = app.getRaisingInstances?.() ?? [];
    const selected = cardEntries.find(entry => entry.wildId === result.wildId);
    const rows = (result.rows ?? []).map(row => {
      const original = row.kind === "CARD"
        ? cardEntries.find(entry => entry.wildId === row.id)
        : homeEntries.find(entry => entry.instanceId === row.id);
      return { ...row, displayName: original ? raisingDisplayName(original) : row.displayName };
    });
    return {
      title: result.title,
      outcomeLabel: result.outcomeLabel,
      speciesId: result.speciesId,
      speciesLabel: result.speciesLabel,
      displayName: selected ? selected.displayName ?? speciesNameForId(selected.speciesId) : result.displayName,
      instanceId: result.instanceId,
      tetherBand: result.tetherBand,
      successAuthority: result.successAuthority,
      collectionCount: result.collectionCount,
      commitError: result.commitError ?? null,
      rows,
      pendingRelease: rows.find(row => row.key === result.pendingRelease?.key) ?? result.pendingRelease ?? null,
      note: "On-card entries commit through the existing app save authority when returning Home."
    };
  }

  function buildFrame() {
    const screen = app.getScreen();
    return deepFreeze({
      contractVersion: GATE_HUNT_PRESENTATION_CONTRACT_VERSION,
      revision: frameRevision,
      screen,
      gateSelect: screen === CHAMPIONSHIP_SCREENS.GATE_SELECT ? gateSelectBlock() : null,
      huntLoadout: screen === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT ? huntLoadoutBlock() : null,
      huntField: screen === CHAMPIONSHIP_SCREENS.HUNT_FIELD ? huntFieldBlock() : null,
      huntResult: screen === CHAMPIONSHIP_SCREENS.HUNT_RESULT ? huntResultBlock() : null,
      shop: screen === CHAMPIONSHIP_SCREENS.SHOP ? (() => {
        const shop = app.getShopFrame();
        return { ...shop, listings: shop.listings.map(row => ({
          ...row, displayName: getHuntCatalogItem(row.productItemId)?.displayName ?? row.displayName
        })) };
      })() : null,
      database: screen === CHAMPIONSHIP_SCREENS.DATABASE ? app.getDatabaseFrame() : null,
      cageEdit: screen === CHAMPIONSHIP_SCREENS.CAGE_EDIT ? app.getCageEditFrame() : null,
      save: saveBlock(),
      navigation: {
        canLeave: screen !== CHAMPIONSHIP_SCREENS.RAISING_HOME,
        trail: app.getScreenTrail()
      },
      note: "RAISING_HOME content is published by the VS1 seam (createRaisingPresentationSource). SHOP, DATABASE, CAGE_EDIT and the expedition screens are published here."
    });
  }

  function publish() {
    frameRevision += 1;
    currentFrame = buildFrame();
    for (const listener of [...listeners]) {
      try { listener(currentFrame); } catch { /* presentation observers never break runtime truth */ }
    }
    return currentFrame;
  }

  function wire() {
    if (screenUnsubscribe || saveUnsubscribe) return;
    screenUnsubscribe = app.subscribeScreen(() => publish());
    saveUnsubscribe = app.savePort.subscribe(() => publish());
    shopUnsubscribe = app.subscribeShop(() => publish());
  }

  function unwire() {
    screenUnsubscribe?.();
    saveUnsubscribe?.();
    shopUnsubscribe?.();
    screenUnsubscribe = null;
    saveUnsubscribe = null;
    shopUnsubscribe = null;
  }

  currentFrame = buildFrame();

  /**
   * Settle a frame after a runtime call.
   *
   * While wired, the application has already pushed a screen change through the
   * subscription and currentFrame is fresh; publishing again would double every
   * revision for no new information. While unwired, nobody else will publish.
   */
  function commit() {
    return screenUnsubscribe ? currentFrame : publish();
  }

  const intents = Object.freeze({
    openGate() {
      app.openGate();
      return commit();
    },
    openShop() {
      app.openShop();
      return commit();
    },
    openDatabase() {
      app.openDatabase();
      return commit();
    },
    openCageEdit() {
      app.openCageEdit();
      return commit();
    },
    selectCageModule(moduleId) {
      app.selectCageModule(moduleId);
      return commit();
    },
    placeCageAt(slotIndex) {
      app.placeCageAt(slotIndex);
      return commit();
    },
    removeCagePlacement(moduleId) {
      app.removeCagePlacement(moduleId);
      return commit();
    },
    confirmCageEdit() {
      app.confirmCageEdit();
      return commit();
    },
    setTamerRank(nextRank) {
      app.setTamerRank(nextRank);
      return commit();
    },
    selectDatabaseSpecies(speciesIndex) {
      app.selectDatabaseSpecies(speciesIndex);
      return commit();
    },
    renameDatabaseInstance(instanceId, displayName) {
      app.renameDatabaseInstance(instanceId, displayName);
      return commit();
    },
    buyShopItem(shopRecordIndex, quantity = 1) {
      app.buyShopItem(shopRecordIndex, quantity);
      return commit();
    },
    selectGate(gateId) {
      if (app.getSelectedGateId() === gateId) return currentFrame;
      app.selectGate(gateId);
      return commit();
    },
    confirmGate() {
      app.confirmGate();
      return commit();
    },
    selectEquipment(equipmentClass, itemId) {
      app.selectHuntEquipment(equipmentClass, itemId);
      return commit();
    },
    fitPlugin(position, itemId) {
      app.fitHuntPlugin(position, itemId);
      return commit();
    },
    selectMemoryCard(itemId) {
      app.selectHuntMemoryCard(itemId);
      return commit();
    },
    beginHunt() {
      app.beginHunt();
      return commit();
    },
    /** Continuous input goes to the existing field runtime only. */
    panCamera(deltaX, deltaY, viewportWidth, viewportHeight) {
      return app.getHuntRuntime()?.panCamera(deltaX, deltaY, viewportWidth, viewportHeight) ?? false;
    },
    selectWildAt(worldX, worldY) {
      const runtime = app.getHuntRuntime();
      const previous = runtime?.getSelectedWildId();
      const selected = runtime?.selectWildAt(worldX, worldY) ?? false;
      // Field selection does not emit a screen event. Publish just its discrete
      // change here; continuous movement stays on the shared Pixi cadence.
      if (runtime?.getSelectedWildId() !== previous) publish();
      return selected;
    },
    abortEnclosureStroke() { return app.abortEnclosureStroke(); },
    selectHuntTool(kind) { const accepted=app.getHuntRuntime()?.selectTool(kind)??false; publish(); return accepted; },
    toolPointerDown(x,y) { const accepted=app.getHuntRuntime()?.toolPointerDown(x,y)??false; publish(); return accepted; },
    toolPointerMove(x,y) { return app.getHuntRuntime()?.toolPointerMove(x,y)??false; },
    toolPointerUp(x,y) { return app.getHuntRuntime()?.toolPointerUp(x,y)??false; },
    beginEnclosureStroke(worldX, worldY) {
      return app.beginEnclosureStroke(worldX, worldY);
    },
    extendEnclosureStroke(worldX, worldY) {
      return app.extendEnclosureStroke(worldX, worldY);
    },
    endEnclosureStroke() {
      const verdict = app.endEnclosureStroke();
      if (verdict == null) return currentFrame;
      return commit();
    },
    confirmHuntResult() {
      app.confirmHuntResult();
      return commit();
    },
    setHuntResultName(displayName) {
      app.setHuntResultName(displayName);
      return commit();
    },
    requestHuntResultRelease(key) { app.requestHuntResultRelease(key); return commit(); },
    cancelHuntResultRelease() { app.cancelHuntResultRelease(); return commit(); },
    confirmHuntResultRelease() { app.confirmHuntResultRelease(); return commit(); },
    exitHunt() {
      app.exitHunt();
      return commit();
    },
    leaveScreen() {
      app.leaveScreen();
      return commit();
    },
    requestSave() {
      const wired = Boolean(saveUnsubscribe);
      app.save();
      if (!wired) publish();
      return currentFrame.save;
    }
  });

  const field = Object.freeze({
    /** Relay from the one Application-owned ticker. Not a gameplay intent. */
    tick(deltaMs) {
      const runtime=app.getHuntRuntime();
      runtime?.tick(deltaMs);
      app.checkHuntDeadline?.();
      if (app.getScreen() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD) return;
      if(!runtime?.getToolState?.())return;
      const next=huntFieldBlock();
      // Do not notify DOM observers for particle positions, native frame count
      // or rope movement. The Pixi view reads those on the same shared ticker.
      const previous=currentFrame.huntField;
      const summary=b=>JSON.stringify([b?.hud,b?.toolState?.activeTool,b?.toolState?.notice,
        b?.toolState?.tools,b?.toolState?.usedG,b?.toolState?.maxG,b?.affordances?.canCollect]);
      if(summary(next)!==summary(previous))publish();
    },

    /** Continuous positional read for the field renderer. Never mutates. */
    getView({ viewportWidth, viewportHeight }) {
      const runtime = app.getHuntRuntime();
      if (!runtime) return null;
      const world = runtime.world;
      const camera = runtime.getCamera(viewportWidth, viewportHeight);
      const transform = huntViewportTransform(viewportWidth, viewportHeight);
      return {
        gateId: world.gateId,
        tileSizePx: world.tileSizePx,
        worldWidthPx: world.worldWidthPx,
        worldHeightPx: world.worldHeightPx,
        camera, transform,
        toWorldPoint: (point) => huntViewportToWorld(point, camera, transform),
        selectedWildId: runtime.getSelectedWildId(),
        captureAvailability: runtime.getCaptureAvailability(),
        visibleChunks: runtime.getVisibleChunks(viewportWidth, viewportHeight),
        player: runtime.getPlayer(),
        wildCreatures: runtime.getWildCreatures(),
        enclosure: runtime.getEnclosureStroke(),
        tools:runtime.getToolState?.() ?? null,
        objects: world.objects,
        isBlockedTile: (x, y) => world.isBlockedTile(x, y)
      };
    }
  });

  return Object.freeze({
    getFrame() {
      return currentFrame;
    },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A VS2 presentation listener must be a function");
      listeners.add(listener);
      if (listeners.size === 1) wire();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) unwire();
      };
    },

    intents,
    field
  });
}
