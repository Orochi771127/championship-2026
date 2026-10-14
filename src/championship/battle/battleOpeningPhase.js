// Product timing adaptation. Reconstructed mode-1 evidence establishes order,
// not a native-cycle to web-tick equivalence or timings for all six modes.
export const BATTLE_OPENING_TIMING = Object.freeze({readyTicks:86, fightTicks:61});
export const BATTLE_OPENING_EVIDENCE = 'PRODUCT_TIMING_ADAPTATION_FROM_RECONSTRUCTED_MODE1_ORDER';

/** Called only by the runtime's existing stepMatch. No scheduler or save data. */
export function createBattleOpeningPhase(timing = BATTLE_OPENING_TIMING) {
  const durations = {...BATTLE_OPENING_TIMING, ...timing};
  for (const value of Object.values(durations))
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('BATTLE_OPENING_POSITIVE_TICKS_REQUIRED');
  let phase = 'ACTIVE', ticks = 0, armed = false, disposed = false;
  const snapshot = () => Object.freeze({phase, ticks, armed,
    remaining:phase === 'READY' ? durations.readyTicks-ticks : phase === 'FIGHT' ? durations.fightTicks-ticks : 0,
    cue:phase === 'READY' ? 'READY' : phase === 'FIGHT' ? 'FIGHT' : null,
    evidence:BATTLE_OPENING_EVIDENCE});
  return Object.freeze({
    snapshot,
    prepare() {
      if (disposed || armed) return snapshot();
      armed = true; phase = 'WAITING_ASSETS'; ticks = 0;
      return snapshot();
    },
    ready() {
      if (!disposed && phase === 'WAITING_ASSETS') { phase = 'READY'; ticks = 0; }
      return snapshot();
    },
    advance() {
      if (disposed || phase === 'WAITING_ASSETS') return false;
      if (phase === 'ACTIVE') return true;
      ticks += 1;
      const duration = phase === 'READY' ? durations.readyTicks : durations.fightTicks;
      if (ticks >= duration) {
        phase = phase === 'READY' ? 'FIGHT' : 'ACTIVE';
        ticks = 0;
      }
      // Consume the final cue tick without a combat step. The next existing
      // tick is the first active step; no native phase-300 clock is emulated.
      return false;
    },
    dispose() { disposed = true; }
  });
}
