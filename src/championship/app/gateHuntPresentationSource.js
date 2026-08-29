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

import presentation from "../../../docs/contracts/championship/raising-home-presentation.v1.json" with { type: "json" };
import toolbarContract from "../../../docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json" with { type: "json" };
import { CHAMPIONSHIP_SCREENS } from "./championshipScreenStack.js";

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
    "getHuntRuntime", "getHuntLoadout", "getHuntResult", "openGate", "selectGate", "confirmGate",
    "selectHuntEquipment", "fitHuntPlugin", "selectHuntMemoryCard",
    "beginHunt", "exitHunt", "leaveScreen",
    "beginEnclosureStroke", "extendEnclosureStroke", "endEnclosureStroke", "confirmHuntResult",
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
        biomeOrdinal: gate.biomeOrdinal,
        state: gate.state,
        stateEvidence: gate.stateEvidence,
        selected: gate.gateId === selectedGateId,
        art: { thumbnail: null }
      })),
      gateCount: { value: app.getGates().length, evidence: "REFERENCE_BASELINE" },
      selection: { gateId: selectedGateId },
      canConfirm: selectedGateId !== null,
      affordances: {
        tapSelects: true,
        confirmRequiresSelection: true,
        note: "Pointer Events only; mouse and touch share one path."
      },
      presentationRule: "Every gate is AVAILABLE and no gate carries progress, rank, stars or completion. No unlock rule is traced, and inventing a lock is as much an invention as inventing an unlock."
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
      canBegin: loadout.getConfirmationState().canConfirm,
      presentationRule: "Render the five recovered equipment classes and four plugin positions. An empty class or position is empty, not disabled: no original rule requires anything to be equipped. Do not render an item effect, a carry limit, a price, or a companion."
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
        gateName: gate?.displayName ?? null,
        actorName: runtime.getPlayer().displayName,
        // What the HUD may display is decided at loadout by the fitted plugins.
        // A readout with no plugin behind it stays dark - the recovered rule.
        capabilities: app.getHuntLoadout()?.getHudCapabilities() ?? null,
        exitAvailable: true,
        note: "Deliberately minimal. hunt_sub_scene carries map_marker0..23 and remain_icon0..3 as structural evidence only; their semantics are unknown, so none are rendered."
      },
      affordances: {
        dragMoves: true,
        tapMoves: true,
        touchNearWildStartsStroke: true,
        note: "Pointer Events only. Empty ground moves the tamer. Touching a wild starts an enclosure stroke. No Capture button."
      },
      wildBehaviourDeclaration: {
        state: "UNKNOWN_REQUIRES_TRACE",
        movementAuthority: runtime.movementAuthority,
        note: "Wild creatures wander inside a bounded radius and do nothing else. They do not see, approach, flee from, chase or react to the player. Enclosure is the VS3 success rule; original odds stay untraced."
      },
      toolbar: HUNT_TOOLBAR_FRAME
    };
  }

  function huntResultBlock() {
    const result = app.getHuntResult();
    if (!result) return null;
    return {
      title: result.title,
      outcomeLabel: result.outcomeLabel,
      speciesId: result.speciesId,
      displayName: result.displayName,
      instanceId: result.instanceId,
      tetherBand: result.tetherBand,
      successAuthority: result.successAuthority,
      collectionCount: result.collectionCount,
      note: "Enclosure is the functional success rule. Original odds are untraced."
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
      save: saveBlock(),
      navigation: {
        canLeave: screen !== CHAMPIONSHIP_SCREENS.RAISING_HOME,
        trail: app.getScreenTrail()
      },
      note: "RAISING_HOME content is published by the VS1 seam (createRaisingPresentationSource). This source reports the active screen and owns the expedition screens only."
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
  }

  function unwire() {
    screenUnsubscribe?.();
    saveUnsubscribe?.();
    screenUnsubscribe = null;
    saveUnsubscribe = null;
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
    /** Field movement. Deliberately not a discrete publish: motion is continuous. */
    moveTo(worldX, worldY) {
      const runtime = app.getHuntRuntime();
      if (!runtime) return false;
      return runtime.moveTo(worldX, worldY);
    },
    beginEnclosureStroke(worldX, worldY) {
      return app.beginEnclosureStroke(worldX, worldY);
    },
    extendEnclosureStroke(worldX, worldY) {
      return app.extendEnclosureStroke(worldX, worldY);
    },
    endEnclosureStroke() {
      const verdict = app.endEnclosureStroke();
      if (verdict?.outcome === "ENCLOSED") return commit();
      return currentFrame;
    },
    confirmHuntResult() {
      app.confirmHuntResult();
      return commit();
    },
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
      app.getHuntRuntime()?.tick(deltaMs);
    },

    /** Continuous positional read for the field renderer. Never mutates. */
    getView({ viewportWidth, viewportHeight }) {
      const runtime = app.getHuntRuntime();
      if (!runtime) return null;
      const world = runtime.world;
      return {
        gateId: world.gateId,
        tileSizePx: world.tileSizePx,
        worldWidthPx: world.worldWidthPx,
        worldHeightPx: world.worldHeightPx,
        camera: runtime.getCamera(viewportWidth, viewportHeight),
        visibleChunks: runtime.getVisibleChunks(viewportWidth, viewportHeight),
        player: runtime.getPlayer(),
        wildCreatures: runtime.getWildCreatures(),
        enclosure: runtime.getEnclosureStroke(),
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
