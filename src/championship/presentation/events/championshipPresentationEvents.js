// Ephemeral presentation events for Championship 2026.
//
// This channel deliberately owns no simulation, progression, navigation, or
// save data. Domain code reports an already-authoritative transition; render
// adapters decide how to display it. Subscribers are isolated so a failed VFX
// load can never break battle resolution or weather state.

export const CHAMPIONSHIP_PRESENTATION_EVENTS = Object.freeze({
  BATTLE_BIG_HIT_CONFIRMED: "championship:presentation:battle-big-hit-confirmed",
  BATTLE_HYPER_STARTED: "championship:presentation:battle-hyper-started",
  COMMON_SPARK_REQUESTED: "championship:presentation:common-spark-requested",
  WEATHER_RAIN_CHANGED: "championship:presentation:weather-rain-changed"
});

const EVENT_TYPES = new Set(Object.values(CHAMPIONSHIP_PRESENTATION_EVENTS));

function freeze(value) {
  if (Array.isArray(value)) value.forEach(freeze);
  else if (value && typeof value === "object") Object.values(value).forEach(freeze);
  return value && typeof value === "object" ? Object.freeze(value) : value;
}

function normalizePosition(position) {
  if (position === undefined || position === null) return null;
  if (!position || typeof position !== "object" || [position.x, position.y, position.z].some((value) => !Number.isFinite(value))) {
    throw new TypeError("CHAMPIONSHIP_PRESENTATION_EVENT_INVALID_POSITION");
  }
  return Object.freeze({ x: position.x, y: position.y, z: position.z });
}

function normalizePayload(type, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("CHAMPIONSHIP_PRESENTATION_EVENT_PAYLOAD_REQUIRED");
  }
  if (type === CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED) {
    if (typeof payload.active !== "boolean") throw new TypeError("CHAMPIONSHIP_PRESENTATION_EVENT_RAIN_ACTIVE_REQUIRED");
    return freeze({ active: payload.active, position: normalizePosition(payload.position) });
  }
  if (typeof payload.anchorId !== "string" || payload.anchorId.trim().length === 0) {
    throw new TypeError("CHAMPIONSHIP_PRESENTATION_EVENT_ANCHOR_REQUIRED");
  }
  return freeze({ anchorId: payload.anchorId.trim(), position: normalizePosition(payload.position) });
}

export function createChampionshipPresentationEvent(type, payload) {
  if (!EVENT_TYPES.has(type)) throw new TypeError(`CHAMPIONSHIP_PRESENTATION_EVENT_UNKNOWN:${type}`);
  return Object.freeze({ type, payload: normalizePayload(type, payload) });
}

export function createChampionshipPresentationEventBus({ onSubscriberError = () => {} } = {}) {
  if (typeof onSubscriberError !== "function") throw new TypeError("CHAMPIONSHIP_PRESENTATION_EVENT_ERROR_HANDLER_REQUIRED");
  const listeners = new Set();
  let sequence = 0;

  return Object.freeze({
    publish(type, payload) {
      const candidate = createChampionshipPresentationEvent(type, payload);
      const event = Object.freeze({ sequence: ++sequence, ...candidate });
      for (const listener of [...listeners]) {
        try { listener(event); } catch (error) { onSubscriberError(error, event); }
      }
      return event;
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("CHAMPIONSHIP_PRESENTATION_EVENT_LISTENER_REQUIRED");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getDiagnostics() {
      return Object.freeze({ sequence, subscriberCount: listeners.size, ticker: "NONE", saveAuthority: "NONE" });
    }
  });
}
