// INT-RH2 Raising Home presentation boundary.
//
// This module is the only runtime seam the presentation layer consumes. It
// projects the standalone application's existing truth into a small immutable
// frame and routes the four approved intents back through the application. It
// owns no gameplay state, save state, router, renderer, or clock.

import presentation from "../../../docs/contracts/championship/raising-home-presentation.v1.json" with { type: "json" };
import toolbarContract from "../../../docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json" with { type: "json" };

export const RAISING_PRESENTATION_CONTRACT_VERSION = "INT_RH2_RUNTIME_PRESENTATION_CONTRACT/v1";

const SAVE_PHASES = new Set(["DIRTY", "SAVED", "RESTORED", "RECOVERED", "CLEAN", "SAVE_FAILED"]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function formatClock(minutes) {
  const normalized = ((Math.trunc(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const remainder = String(normalized % 60).padStart(2, "0");
  return `${hours}:${remainder}`;
}

function speciesKey(resident) {
  const raw = typeof resident?.speciesId === "string" && resident.speciesId.length > 0
    ? resident.speciesId
    : String(resident?.residentId ?? "").replace(/^resident:/, "");
  return raw.replace(/^championship:creature:/, "");
}

function productSpeciesId(key) {
  return `championship:creature:${key}`;
}

function fallbackSprite() {
  return {
    idle: { sheet: null, columns: 1, rows: 1, frames: 1, fps: 1 },
    reaction: { sheet: null, columns: 1, rows: 1, frames: 1, fps: 1 },
    portrait: null
  };
}

function spriteProjection(resident) {
  const key = speciesKey(resident);
  const idle = presentation.idle.species[key];
  const reaction = presentation.reaction.species[key];
  const portrait = presentation.portrait.species[key];
  if (!idle || !reaction || !portrait) return fallbackSprite();
  return {
    idle: { ...idle },
    reaction: { ...reaction },
    portrait
  };
}

function toolbarProjection() {
  const geometry = toolbarContract.slotFrameGeometry;
  if (toolbarContract.toolbar.slotCount.value !== 8 || geometry.slots.length !== 8) {
    throw new Error("CHAMPIONSHIP_TOOLBAR_CONTRACT_DRIFT");
  }
  return {
    slotCount: { value: 8, evidence: "ROM_VERIFIED" },
    mode: { value: 1, context: "TRAINING_RAISING", evidence: "ROM_VERIFIED" },
    assetFamily: { value: "ui/training_set", evidence: "ROM_VERIFIED" },
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

const TOOLBAR_FRAME = deepFreeze(toolbarProjection());

function assertApplication(app) {
  const methods = [
    "getSnapshot", "getRaisingState", "getSelectedCreatureId", "getCages",
    "getSession", "select", "moveToCage", "care", "save"
  ];
  if (!app || methods.some((method) => typeof app[method] !== "function")) {
    throw new TypeError("INT-RH2 requires an open Championship standalone application");
  }
  if (typeof app.savePort?.getStatus !== "function" || typeof app.savePort?.subscribe !== "function") {
    throw new TypeError("INT-RH2 requires the standalone save authority");
  }
  if (!app.getSession() || !app.getSnapshot() || !app.getRaisingState()) {
    throw new Error("CHAMPIONSHIP_RAISING_SESSION_NOT_OPEN");
  }
}

function cageLanes(cages, members, assignments) {
  const lanes = new Map();
  for (const cage of cages) {
    const occupants = members
      .filter((member) => assignments[member.creatureId] === cage.cageId)
      .map((member) => member.creatureId)
      .sort();
    occupants.forEach((creatureId, index) => {
      const count = Math.max(1, occupants.length);
      lanes.set(creatureId, {
        x: 0.18 + ((index + 0.5) / count) * 0.64,
        y: count === 1 ? 0.72 : (index % 2 === 0 ? 0.62 : 0.84)
      });
    });
  }
  return lanes;
}

function speciesLabel(speciesId) {
  return speciesKey({ speciesId }).replace(/-/g, " ");
}

/**
 * Home actors are the frozen R2 starters plus enclosed collection instances.
 * Collection IDs never enter the R2 snapshot; they only appear here.
 */
function homeMembers(snapshot, raising) {
  const starters = snapshot.residents.map((resident) => ({
    creatureId: resident.residentId,
    displayName: resident.name,
    speciesId: productSpeciesId(speciesKey(resident)),
    facing: resident.facing,
    intent: resident.intent,
    spriteResident: resident
  }));
  const arrivals = (raising.collection ?? []).map((entry) => ({
    creatureId: entry.instanceId,
    displayName: entry.displayName || speciesLabel(entry.speciesId),
    speciesId: entry.speciesId.includes(":") ? entry.speciesId : productSpeciesId(entry.speciesId),
    facing: "right",
    intent: "idle",
    spriteResident: { speciesId: entry.speciesId, residentId: entry.instanceId }
  }));
  return [...starters, ...arrivals];
}

/**
 * Create the sole INT-RH2 presentation source over an already-open standalone
 * application. `getFrame()` is a pure read. The named intents are the only
 * mutation routes exposed to presentation consumers.
 */
export function createRaisingPresentationSource(app) {
  assertApplication(app);
  const listeners = new Set();
  let frameRevision = 0;
  let currentFrame = null;
  let runtimeUnsubscribe = null;
  let saveUnsubscribe = null;
  let reactionCreatureId = null;
  let publishing = false;
  let pendingPublication = null;

  function buildFrame() {
    const snapshot = app.getSnapshot();
    const raising = app.getRaisingState();
    const cages = app.getCages();
    if (!snapshot || !raising) throw new Error("CHAMPIONSHIP_RAISING_SESSION_NOT_OPEN");
    const assignments = raising.assignments;
    const selectedCreatureId = app.getSelectedCreatureId();
    const members = homeMembers(snapshot, raising);
    const lanes = cageLanes(cages, members, assignments);
    const saveStatus = app.savePort.getStatus();
    const phase = SAVE_PHASES.has(saveStatus.phase) ? saveStatus.phase : "CLEAN";

    return deepFreeze({
      contractVersion: RAISING_PRESENTATION_CONTRACT_VERSION,
      revision: frameRevision,
      clock: {
        minutes: snapshot.clockMinutes,
        display: formatClock(snapshot.clockMinutes)
      },
      cages: cages.map((cage) => {
        const occupantIds = members
          .filter((member) => assignments[member.creatureId] === cage.cageId)
          .map((member) => member.creatureId)
          .sort();
        return {
          cageId: cage.cageId,
          name: cage.name,
          region: { ...cage.region },
          occupantIds,
          occupantCount: occupantIds.length,
          authority: "CHAMPIONSHIP_2026_PRODUCT",
          note: "Product-authored habitat prototype; not an Original Championship CageDefinition."
        };
      }),
      residents: members.map((member) => ({
        creatureId: member.creatureId,
        displayName: member.displayName,
        speciesId: member.speciesId,
        cageId: assignments[member.creatureId],
        lane: lanes.get(member.creatureId) ?? { x: 0.5, y: 0.72 },
        facing: member.facing,
        intent: member.creatureId === reactionCreatureId ? "care-reaction" : member.intent,
        selected: member.creatureId === selectedCreatureId,
        sprite: spriteProjection(member.spriteResident)
      })),
      selection: { creatureId: selectedCreatureId },
      save: {
        phase,
        savedAt: typeof saveStatus.savedAt === "string" ? saveStatus.savedAt : null,
        canRetry: Boolean(saveStatus.canRetry)
      },
      affordances: {
        tapSelects: true,
        dragRelocates: true,
        dropTargetCageIds: cages.map((cage) => cage.cageId),
        note: "Pointer Events only; mouse and touch share one path."
      },
      toolbar: TOOLBAR_FRAME,
      implementedActions: {
        note: "Implemented actions are intentionally not mapped to toolbar slots.",
        actions: [
          { id: "SELECT", trigger: "tap a creature", effect: "selection changes", evidence: "product behaviour" },
          { id: "RELOCATE", trigger: "drag a creature onto another cage", effect: "cage assignment changes; no other effect", evidence: "ROM_VERIFIED interaction grammar; consequences UNKNOWN" },
          { id: "CARE", trigger: "invoke care on a selected creature", effect: "one-shot reaction and product interaction flag; no stat mutation", evidence: "ROM_VERIFIED tool existence; exact values UNKNOWN" }
        ]
      }
    });
  }

  function publish({ clearReaction = true } = {}) {
    if (clearReaction) reactionCreatureId = null;
    frameRevision += 1;
    currentFrame = buildFrame();
    pendingPublication = currentFrame;
    if (publishing) return currentFrame;
    publishing = true;
    try {
      while (pendingPublication) {
        const publication = pendingPublication;
        pendingPublication = null;
        for (const listener of [...listeners]) {
          try { listener(publication); } catch { /* Presentation observers never break runtime truth. */ }
        }
      }
    } finally {
      publishing = false;
    }
    return currentFrame;
  }

  function wireRuntime() {
    if (runtimeUnsubscribe || saveUnsubscribe) return;
    const session = app.getSession();
    runtimeUnsubscribe = session.subscribeRaisingHome(() => publish());
    saveUnsubscribe = app.savePort.subscribe(() => publish());
  }

  function unwireRuntime() {
    runtimeUnsubscribe?.();
    saveUnsubscribe?.();
    runtimeUnsubscribe = null;
    saveUnsubscribe = null;
  }

  currentFrame = buildFrame();

  const intents = Object.freeze({
    selectCreature(creatureId) {
      if (app.getSelectedCreatureId() === creatureId) return currentFrame;
      reactionCreatureId = null;
      app.select(creatureId);
      return publish();
    },

    relocateCreature(creatureId, cageId) {
      reactionCreatureId = null;
      const before = app.getRaisingState();
      const after = app.moveToCage(creatureId, cageId);
      return after === before ? currentFrame : publish();
    },

    careForCreature(creatureId) {
      reactionCreatureId = creatureId;
      app.care(creatureId);
      return publish({ clearReaction: false });
    },

    requestSave() {
      const wired = Boolean(saveUnsubscribe);
      app.save();
      if (!wired) publish();
      return currentFrame.save;
    }
  });

  return Object.freeze({
    getFrame() {
      return currentFrame;
    },

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("A Raising presentation listener must be a function");
      listeners.add(listener);
      if (listeners.size === 1) wireRuntime();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) unwireRuntime();
      };
    },

    intents
  });
}
