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
