// OVL0 0210D3DC..0210D5D0, after the AI dispatch and before actor animation.
// The caller owns this object, RNG and HP; no timer or save is created here.
export function stepNativeWildStatus(before, wildRandom) {
  const state = { ...before }, effects = [];
  if (state.poisonPending > 0 && --state.poisonPending === 0) {
    state.poisonElapsed = 0;
    state.poisonDuration = (wildRandom(50) + 10) * 60;
    state.poisoned = 1;
  }
  if (state.stunPending > 0 && --state.stunPending === 0) effects.push("ENTER_AI17");
  if (state.poisoned) {
    if (++state.poisonElapsed > state.poisonDuration) { state.poisoned = 0; state.poisonElapsed=0; state.poisonDuration=0; }
    else if (state.poisonElapsed % 180 === 0) {
      state.currentHp = Math.max(0, state.currentHp - Math.trunc(state.maxHp / 100) * 3);
      effects.push("POISON_DAMAGE");
    }
  }
  if (state.blinded && --state.blindTicks === 0) state.blinded = 0;
  state.awakeCounter = Math.max(0, Math.min(state.maxAwakeCounter, state.awakeCounter));
  if (++state.recoveryTicks > 360) {
    state.recoveryTicks = 0;
    if (!state.poisoned) state.currentHp = Math.min(state.maxHp, state.currentHp + Math.trunc(state.maxHp / 100) * 5);
    state.satiety = Math.max(0, state.satiety - 1);
  }
  return Object.freeze({ state:Object.freeze(state), effects:Object.freeze(effects) });
}

// 0210BF B8..0210C010: binding bounce halves its amplitude, it is not a
// guessed animation delay. AI6 checks amplitude before this update occurs.
export function stepNativeBindingBounce(before, zQ12) {
  let { amplitude, velocity } = before;
  if (amplitude > 0) {
    if (--velocity <= 0) {
      amplitude = Math.trunc(amplitude / 2);
      velocity = amplitude;
      if (amplitude === 0) zQ12 = 0;
    }
    zQ12 += velocity * 4096;
  }
  return Object.freeze({ bounce:Object.freeze({ amplitude, velocity }), zQ12 });
}
