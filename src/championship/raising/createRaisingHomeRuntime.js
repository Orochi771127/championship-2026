import { clonePlainData, deepFreeze } from "../contracts/championshipContracts.js";
import { advanceRaisingHomeClock, createRaisingHomeInitialState, reduceRaisingHome } from "./raisingHomeDefinition.js";
import { captureRaisingHomeSnapshotR2, stageRaisingResidentRelease } from "./raisingHomePersistenceR2.js";

const ACCEPTED_COMMAND_ID_LIMIT = 256;
const OBSERVER_FAILURE_LIMIT = 256;
const BASE_COMMAND_KEYS = Object.freeze(["commandId", "expectedRevision", "type"]);
const COMMAND_KEYS = Object.freeze({
  RAISING_HOME_MOVE_CARETAKER: Object.freeze([...BASE_COMMAND_KEYS, "direction"]),
  RAISING_HOME_ADVANCE: Object.freeze([...BASE_COMMAND_KEYS, "minutes"]),
  RAISING_HOME_SELECT_RESIDENT: Object.freeze([...BASE_COMMAND_KEYS, "residentId"]),
  RAISING_HOME_INVITE: BASE_COMMAND_KEYS,
  RAISING_HOME_CARE: BASE_COMMAND_KEYS,
  RAISING_HOME_TRAIN: BASE_COMMAND_KEYS,
  RAISING_HOME_REST: BASE_COMMAND_KEYS,
  RAISING_HOME_TOGGLE_PAUSE: BASE_COMMAND_KEYS,
  // The original's Raising Home submenu carries an End Day entry, so a day can
  // be closed on demand. It takes no payload: the reducer rolls the whole
  // calendar cascade from the current reading.
  RAISING_HOME_END_DAY: BASE_COMMAND_KEYS
});

function rejection(snapshot, code, message = null) {
  return deepFreeze({ accepted: false, code, message, snapshot });
}

function validateEnvelope(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) throw new TypeError("Raising Home command must be an object");
  if (typeof command.commandId !== "string" || !/^[a-z0-9][a-z0-9:_-]{0,95}$/i.test(command.commandId)) {
    throw new TypeError("Raising Home commandId is invalid");
  }
  if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new TypeError("Raising Home expectedRevision must be a non-negative safe integer");
  }
  const expectedKeys = COMMAND_KEYS[command.type];
  if (!expectedKeys) throw new TypeError("Raising Home command type is invalid");
  const actualKeys = Object.keys(command).sort();
  const allowedKeys = [...expectedKeys].sort();
  if (actualKeys.length !== allowedKeys.length || actualKeys.some((key, index) => key !== allowedKeys[index])) {
    throw new TypeError("Raising Home command contains missing or unsupported fields");
  }
}

export function createRaisingHomeRuntime(options = {}) {
  const initialSnapshotDescriptor = options && typeof options === "object"
    ? Object.getOwnPropertyDescriptor(options, "initialSnapshot")
    : null;
  if (initialSnapshotDescriptor?.get || initialSnapshotDescriptor?.set) {
    throw new TypeError("Raising Home initialSnapshot must be an own data property");
  }
  let snapshot = initialSnapshotDescriptor && initialSnapshotDescriptor.value !== undefined
    ? captureRaisingHomeSnapshotR2(initialSnapshotDescriptor.value)
    : createRaisingHomeInitialState(options);
  let disposed = false;
  let notifying = false;
  let notificationSnapshot = null;
  let observerFailureCount = 0;
  let lastObserverFailureRevision = null;
  const listeners = new Set();
  const acceptedCommandIds = new Set();

  function publish(next, kind = null) {
    snapshot = next;
    const publication = deepFreeze({ accepted: true, code: kind === "clock" ? "RAISING_HOME_CLOCK_ADVANCED" : "RAISING_HOME_OK", ...(kind ? { kind } : {}), snapshot, persistenceAttempted: false, playerStatePatch: null });
    const notificationListeners = [...listeners];
    notifying = true;
    notificationSnapshot = publication.snapshot;
    try {
      for (const listener of notificationListeners) {
        try { listener(publication); }
        catch {
          observerFailureCount = Math.min(OBSERVER_FAILURE_LIMIT, observerFailureCount + 1);
          lastObserverFailureRevision = publication.snapshot.revision;
        }
      }
    } finally {
      notificationSnapshot = null;
      notifying = false;
    }
    return publication;
  }

  return Object.freeze({
    getSnapshot() {
      return snapshot;
    },
    commitResidentRelease(residentIds, expectedRevision) {
      if (disposed || notifying || snapshot.revision !== expectedRevision) return rejection(snapshot, "RAISING_HOME_RELEASE_STALE");
      return publish(stageRaisingResidentRelease(snapshot, residentIds), "membership");
    },
    getDiagnostics() {
      return deepFreeze({ disposed, observerFailureCount, lastObserverFailureRevision });
    },
    advanceClock(input) {
      if (notifying) return rejection(notificationSnapshot, "RAISING_HOME_NOTIFICATION_BUSY", "Raising Home observer notification is in progress");
      if (disposed) return deepFreeze({ accepted: false, code: "RAISING_HOME_DISPOSED", snapshot: null });
      try {
        const envelope = clonePlainData(input);
        const keys = Object.keys(envelope).sort();
        const expected = ["units", "expectedClockRevision", ...["subunits", "divisor", "clearElapsed"].filter((key) => Object.hasOwn(envelope, key))].sort();
        if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) throw new TypeError("Clock transition fields are not exact");
        if (!Number.isSafeInteger(envelope.expectedClockRevision) || envelope.expectedClockRevision < 0 || Object.is(envelope.expectedClockRevision, -0)) throw new TypeError("Clock expectedClockRevision is invalid");
        if (envelope.expectedClockRevision !== snapshot.clockRevision) return rejection(snapshot, "RAISING_HOME_STALE_CLOCK_REVISION");
        const next = advanceRaisingHomeClock(snapshot, envelope.units,
          Object.hasOwn(envelope, "subunits") ? envelope.subunits : 0,
          Object.hasOwn(envelope, "divisor") ? envelope.divisor : 400,
          Object.hasOwn(envelope, "clearElapsed") ? envelope.clearElapsed : false);
        if (next === snapshot) return rejection(snapshot, snapshot.paused ? "RAISING_HOME_PAUSED" : "RAISING_HOME_CLOCK_NO_CHANGE");
        return publish(next, "clock");
      } catch (error) {
        return rejection(snapshot, "RAISING_HOME_REJECTED", error instanceof Error ? error.message : String(error));
      }
    },
    dispatch(command) {
      if (notifying) {
        return rejection(
          notificationSnapshot,
          "RAISING_HOME_NOTIFICATION_BUSY",
          "Raising Home observer notification is in progress"
        );
      }
      if (disposed) return deepFreeze({ accepted: false, code: "RAISING_HOME_DISPOSED", snapshot: null });
      try {
        const envelope = clonePlainData(command);
        validateEnvelope(envelope);
        if (acceptedCommandIds.has(envelope.commandId)) {
          return rejection(snapshot, "RAISING_HOME_DUPLICATE_COMMAND", "Duplicate Raising Home commandId");
        }
        if (envelope.expectedRevision !== snapshot.revision) {
          return rejection(snapshot, "RAISING_HOME_STALE_REVISION", "Stale Raising Home revision");
        }
        if (acceptedCommandIds.size >= ACCEPTED_COMMAND_ID_LIMIT) {
          return rejection(snapshot, "RAISING_HOME_COMMAND_BUDGET_EXHAUSTED", "Raising Home session command budget is exhausted");
        }
        const { commandId, expectedRevision, ...domainCommand } = envelope;
        const next = reduceRaisingHome(snapshot, domainCommand);
        if (next === snapshot) return deepFreeze({ accepted: false, code: "RAISING_HOME_PAUSED", snapshot });
        acceptedCommandIds.add(commandId);
        return publish(next);
      } catch (error) {
        return rejection(snapshot, "RAISING_HOME_REJECTED", error instanceof Error ? error.message : String(error));
      }
    },
    subscribe(listener) {
      if (disposed) throw new Error("Raising Home runtime is disposed");
      if (typeof listener !== "function") throw new TypeError("Raising Home listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      snapshot = null;
      acceptedCommandIds.clear();
    }
  });
}
