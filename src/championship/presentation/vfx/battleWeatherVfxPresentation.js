import { CHAMPIONSHIP_PRESENTATION_EVENTS } from "../events/championshipPresentationEvents.js";

export const FAITHFUL_VFX_EVENT_BINDINGS = Object.freeze({
  [CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_BIG_HIT_CONFIRMED]: Object.freeze({
    systemId: "hitspark_big",
    channel: "battle",
    loop: false,
    evidence: "ROM_VERIFIED_ASSET_USE_TRIGGER_PARAMETERS_OPEN"
  }),
  [CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_HYPER_STARTED]: Object.freeze({
    systemId: "hypereffect",
    channel: "battle",
    loop: false,
    evidence: "ROM_VERIFIED_ASSET_USE_TRIGGER_PARAMETERS_OPEN"
  }),
  [CHAMPIONSHIP_PRESENTATION_EVENTS.COMMON_SPARK_REQUESTED]: Object.freeze({
    systemId: "spark",
    channel: "common",
    loop: false,
    evidence: "EXPLICIT_PRESENTATION_REQUEST_ONLY_CALLER_OPEN"
  }),
  [CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED]: Object.freeze({
    systemId: "rain",
    channel: "weather",
    loop: true,
    evidence: "EXPLICIT_WEATHER_TRANSITION_ONLY_CALLER_OPEN"
  })
});

function noOperation() {}

export function createBattleWeatherVfxPresentation({
  events,
  runtime,
  onMount = noOperation,
  onUnmount = noOperation,
  onError = noOperation
} = {}) {
  if (!events?.subscribe || !runtime?.load || !runtime?.unload) {
    throw new TypeError("CHAMPIONSHIP_BATTLE_WEATHER_VFX_DEPENDENCIES_REQUIRED");
  }
  const active = new Map();
  const finalizing = new Set();
  let disposed = false;
  let lastError = null;
  let queue = Promise.resolve();

  async function clearChannel(channel, reason, event = null) {
    const record = active.get(channel);
    active.delete(channel);
    if (record) await onUnmount(Object.freeze({ channel, reason, event, ...record }));
    await runtime.unload(channel);
  }

  async function handle(event) {
    if (disposed) return;
    const binding = FAITHFUL_VFX_EVENT_BINDINGS[event.type];
    if (!binding) return;
    if (event.type === CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED && event.payload.active === false) {
      await clearChannel(binding.channel, "WEATHER_STOPPED", event);
      return;
    }
    await clearChannel(binding.channel, "REPLACED", event);
    const instance = await runtime.load(binding.systemId, { loop: binding.loop, channel: binding.channel });
    if (!instance || disposed) return;
    if (event.payload.position) {
      const { x, y, z } = event.payload.position;
      instance.object3d.position?.set?.(x, y, z);
    }
    if (event.payload.anchorId) instance.object3d.userData.presentationAnchorId = event.payload.anchorId;
    const record = Object.freeze({ instance, binding, sourceEvent: event });
    active.set(binding.channel, record);
    await onMount(Object.freeze({ channel: binding.channel, ...record }));
  }

  function schedule(event) {
    queue = queue.then(() => handle(event)).catch((error) => {
      lastError = error;
      onError(error, event);
    });
  }

  const unsubscribe = events.subscribe(schedule);

  return Object.freeze({
    update(deltaMs) {
      if (disposed || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      for (const [channel, record] of active) {
        record.instance.update(deltaMs);
        const diagnostics = record.instance.getDiagnostics();
        if (!record.binding.loop && diagnostics.finished && !finalizing.has(channel)) {
          finalizing.add(channel);
          queue = queue
            .then(() => clearChannel(channel, "PLAYBACK_FINISHED"))
            .catch((error) => {
              lastError = error;
              onError(error, record.sourceEvent);
            })
            .finally(() => finalizing.delete(channel));
        }
      }
    },
    async settle() {
      await queue;
      if (lastError) {
        const error = lastError;
        lastError = null;
        throw error;
      }
    },
    getDiagnostics() {
      return Object.freeze({
        ticker: "CALLER_OWNED",
        saveAuthority: "NONE",
        simulationAuthority: "NONE",
        active: Object.freeze([...active.entries()].map(([channel, record]) => Object.freeze({
          channel,
          systemId: record.binding.systemId,
          sourceSequence: record.sourceEvent.sequence
        })))
      });
    },
    async dispose() {
      if (disposed) return;
      unsubscribe();
      await queue;
      for (const channel of [...active.keys()]) await clearChannel(channel, "CONTROLLER_DISPOSED");
      await runtime.unloadAll?.();
      disposed = true;
    }
  });
}
