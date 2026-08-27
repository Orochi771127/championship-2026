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
  recordCareInteraction
} from "./championshipRaisingProduction.js";
import { createChampionshipPersistentSavePort } from "./ChampionshipPersistentSavePort.js";
import { selectPhase1FirstCreature } from "./phase1ProductCreatures.js";

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
      await openSession(createChampionshipSavePortR2());
      const creatureIds = session.getRaisingHomeSnapshot().residents.map((r) => r.residentId);
      raising = createRaisingProductionState({ cageIds, creatureIds });
      selectedCreatureId = null;
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
      await openSession(seededRealmPort(restored));
      const creatureIds = session.getRaisingHomeSnapshot().residents.map((r) => r.residentId);
      raising = normalizeRaisingProductionState(read.save.raising, { cageIds, creatureIds });
      selectedCreatureId = null;
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
        raising
      });
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
      if (!session) return;
      const closing = session;
      session = null;
      await closing.dispose();
    }
  });
}
