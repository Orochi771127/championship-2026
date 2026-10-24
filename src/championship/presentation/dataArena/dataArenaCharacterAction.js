// Data Arena presentation policy, not an original Battle timing claim.
// Hold the selected attack clip's preparation cell until the simulation
// releases the skill, then play its remaining cells with their supplied ticks.
// No gameplay delay, damage, new art or extra clock is introduced.
export function createDataArenaCharacterAction({ animation, tickRateHz = 60, reducedMotion = false }) {
  const frames = animation?.frames ?? [];
  const releaseMs = (frames[0]?.ticks ?? 0) * 1000 / tickRateHz;
  const totalMs = frames.reduce((sum, frame) => sum + frame.ticks * 1000 / tickRateHz, 0);
  const recoveryMs = totalMs - releaseMs;
  let action = null;
  return Object.freeze({
    clear() { action = null; },
    observe(event) {
      if (!['CAST', 'ULT_CAST', 'CAST_RELEASE'].includes(event.type) || !Number.isSafeInteger(event.actionId)) return;
      if (action && event.actionId < action.id) return;
      if (event.actionId !== action?.id) action = { id: event.actionId, moveId: event.moveId, releasedAt: null };
      if (event.type === 'CAST_RELEASE') action.releasedAt = event.t;
    },
    sample(time) {
      if (!action || frames.length < 2 || !Number.isFinite(time)) return null;
      const elapsed = action.releasedAt === null ? 0 : Math.max(0, time - action.releasedAt) * 1000;
      if (action.releasedAt !== null && elapsed >= recoveryMs) return null;
      return {
        id: action.id, moveId: action.moveId, sequenceId: animation.id,
        phase: action.releasedAt === null ? 'WINDUP' : 'RELEASE',
        elapsedMs: reducedMotion ? 0 : action.releasedAt === null ? 0 : Math.min(totalMs - 0.001, releaseMs + elapsed)
      };
    }
  });
}

// Sample the rule-owned action clock. Keep every slot and its relative ticks;
// the existing controller still resolves that slot's texture, anchor and offset.
export function sampleDataArenaRelayAction({ animation, action, time, tickRateHz = 60, releaseSlot = 1, reducedMotion = false }) {
  const frames = animation?.frames ?? [];
  if (!action || frames.length < 2) return null;
  const slot = Math.max(1, Math.min(frames.length - 1, animation.hitFrame ?? releaseSlot));
  const before = frames.slice(0, slot).reduce((sum, frame) => sum + frame.ticks, 0) * 1000 / tickRateHz;
  const total = frames.reduce((sum, frame) => sum + frame.ticks, 0) * 1000 / tickRateHz;
  const released = action.releasedAt !== null;
  const fraction = released ? (time - action.releasedAt) / Math.max(0.001, action.recovery)
    : (time - action.startedAt) / Math.max(0.001, action.windup);
  const elapsedMs = released ? before + (total - before) * Math.min(1, Math.max(0, fraction))
    : Math.min(before - 0.001, before * Math.max(0, fraction));
  return { id: action.id, moveId: action.moveId, sequenceId: animation.id,
    phase: released ? 'RECOVERY' : 'WINDUP', elapsedMs: reducedMotion ? (released ? before : 0) : Math.min(total - 0.001, elapsedMs) };
}

// Slot-local placement takes priority over shared texture placement. Equal
// texture keys must not collapse animation slots with different origins.
export function dataArenaRelaySlotPlacement(frame, geometry, artProfile) {
  const placement=frame?.placement ?? geometry?.frames?.[frame?.texture];
  const size=placement?.sourceSize;
  const anchor=frame?.anchor ?? placement?.origin;
  return {
    anchor: Array.isArray(anchor) && size ? {x:anchor[0]/size[0],y:anchor[1]/size[1]} : anchor ?? artProfile?.anchor ?? {x:.5,y:1},
    offset: frame?.offset ?? [0,0],
    packingScale: placement?.scale ?? artProfile?.scale ?? 1
  };
}
