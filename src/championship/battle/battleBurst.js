// Burst evolution in the auto battle -- OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102).
//
// NOT original behaviour. Under OFF nothing here runs. Under BURST_V1, for both teams alike:
//   - every hit fills the attacker's and the defender's gauge (dealt and taken damage, relative to max HP);
//   - a full gauge starts the burst once per battle: the battle holds for WRAP_FRAMES while a shell of hex
//     plates wraps the 成熟期, cracks and blows apart (presentation reads `wrapFrame`), then the combatant is
//     its burst form for BURST_FRAMES;
//   - while burst its damage dealt is x1.4 (tier 1) / x1.7 (tier 2) and damage taken divided by the same;
//     afterwards it is weakened (x0.85) for WEAK_FRAMES, then spent;
//   - an opponent whose preset was a former 覺醒體/究極體 (`base` set) is shown as the 成熟期 that bursts into it
//     and built at the form's strength (baseline): before its burst it deals and takes damage as if divided by
//     that multiplier, so after it it fights exactly as its preset.
// Scaling happens after the native resolver and taxonomy, once per hit, truncated and never below 1, so the
// native damage, crit, TP and HP rules are untouched. A down combatant reverts. While the battle holds no
// native frame, AI, clock or RNG advances.
import {BURST_RULES, burstMultiplier} from '../contracts/productBurstEvolution.js';

export const BATTLE_BURST_OFF = 'OFF';
export const BATTLE_BURST_V1 = 'BURST_V1';
export const BATTLE_BURST_POLICIES = Object.freeze([BATTLE_BURST_OFF, BATTLE_BURST_V1]);
export const BATTLE_BURST_FRAMES = BURST_RULES.durationSeconds * 60;
export const BATTLE_BURST_WEAK_FRAMES = BURST_RULES.weaknessSeconds * 60;
export const BATTLE_BURST_GAUGE_MAX = BURST_RULES.gaugeMaximum;
// Held battle frames for the wrap (0..41), crack (42..62) and burst flash (63..71).
export const BATTLE_BURST_WRAP_FRAMES = 72;
// Gauge per hit: dealing a foe's whole max HP fills 150, losing one's own whole max HP fills 200.
const DEALT_RATE = 150, TAKEN_RATE = 200;

/**
 * @param {object} input
 * @param {string} input.policy
 * @param {Array<{form:number,tier:number,baseline?:number,base?:number}|null>} input.plans per battle slot
 */
export function createBattleBurst({policy = BATTLE_BURST_OFF, plans = []} = {}) {
  if (!BATTLE_BURST_POLICIES.includes(policy)) throw new Error('BATTLE_BURST_POLICY_UNKNOWN');
  const on = policy === BATTLE_BURST_V1;
  const states = plans.map(plan => on && plan && Number.isInteger(plan.form) && [1, 2].includes(plan.tier)
    ? {plan: Object.freeze({form: plan.form, tier: plan.tier, baseline: plan.baseline ?? 1, base: Number.isInteger(plan.base) ? plan.base : null}),
      gauge: 0, phase: 'CHARGING', start: 0, wrapFrame: 0}
    : null);
  const queue = [], used = [];
  const factor = slot => {
    const s = states[slot];
    if (!s) return 1;
    const own = s.phase === 'BURST' ? burstMultiplier(s.plan.tier) : s.phase === 'WEAK' ? BURST_RULES.weaknessMultiplier : 1;
    return own / s.plan.baseline;
  };
  function displayOf(slot) {
    const s = states[slot];
    if (!s) return null;
    if (s.plan.base !== null) return s.phase === 'BURST' ? null : s.plan.base;
    return s.phase === 'BURST' ? s.plan.form : null;
  }
  const charge = (slot, amount) => {
    const s = states[slot];
    if (s && s.phase === 'CHARGING' && amount > 0) s.gauge = Math.min(BATTLE_BURST_GAUGE_MAX, s.gauge + amount);
  };
  return Object.freeze({
    policy,
    planned(slot) { return states[slot]?.plan ?? null; },
    /** True while a burst is wrapping: the runtime holds the whole battle for that frame. */
    holding() { return queue.length > 0; },
    /** One held frame of the wrap at the head of the queue; at its end the combatant is its burst form. */
    hold(frame) {
      const slot = queue[0], s = states[slot];
      s.wrapFrame += 1;
      if (s.wrapFrame < BATTLE_BURST_WRAP_FRAMES) return [];
      queue.shift();
      s.phase = 'BURST'; s.start = frame;
      used.push(Object.freeze({slot, form: s.plan.form, tier: s.plan.tier}));
      return [{slot, kind: 'BURST', form: s.plan.form, tier: s.plan.tier}];
    },
    scaleDamage({attackerSlot, defenderSlot, damage}) {
      if (!on || !Number.isFinite(damage) || damage <= 0) return damage;
      const scaled = Math.trunc(damage * factor(attackerSlot) / factor(defenderSlot));
      return Math.max(1, scaled);
    },
    onHit({attackerSlot, defenderSlot, damage, attackerMaxHp = 0, defenderMaxHp = 0}) {
      if (!on || !(damage > 0)) return;
      if (defenderMaxHp > 0) {
        charge(attackerSlot, Math.round(DEALT_RATE * damage / defenderMaxHp));
        charge(defenderSlot, Math.round(TAKEN_RATE * damage / defenderMaxHp));
      }
      void attackerMaxHp;
    },
    /** Advance phases after a battle frame. Returns events. */
    step(frame, slots) {
      if (!on) return [];
      const events = [];
      states.forEach((s, slot) => {
        if (!s) return;
        const combatant = slots[slot];
        const down = !combatant || combatant.currentHp <= 0;
        if (s.phase === 'CHARGING' && !down && s.gauge >= BATTLE_BURST_GAUGE_MAX) {
          s.phase = 'WRAP'; s.wrapFrame = 0; queue.push(slot);
          events.push({slot, kind: 'WRAP', form: s.plan.form, tier: s.plan.tier});
        } else if (s.phase === 'BURST' && (down || frame - s.start >= BATTLE_BURST_FRAMES)) {
          s.phase = down ? 'SPENT' : 'WEAK'; s.start = frame;
          events.push({slot, kind: down ? 'REVERT_DOWN' : 'REVERT', form: s.plan.form});
        } else if (s.phase === 'WEAK' && (down || frame - s.start >= BATTLE_BURST_WEAK_FRAMES)) {
          s.phase = 'SPENT';
          events.push({slot, kind: 'RECOVERED'});
        }
      });
      return events;
    },
    /** Species shown for this slot (null: its own native species). */
    display: displayOf,
    /** Forms that burst this battle, in order: [{slot, form, tier}]. */
    bursts() { return Object.freeze([...used]); },
    snapshot(slot, frame = 0) {
      const s = states[slot];
      return s ? Object.freeze({gauge: s.gauge, gaugeMax: BATTLE_BURST_GAUGE_MAX, phase: s.phase, tier: s.plan.tier, form: s.plan.form,
        base: s.plan.base, wrapFrame: s.phase === 'WRAP' ? s.wrapFrame : null, wrapFrames: BATTLE_BURST_WRAP_FRAMES,
        phaseFrame: s.phase === 'BURST' || s.phase === 'WEAK' ? Math.max(0, frame - s.start) : null,
        burstFrames: BATTLE_BURST_FRAMES, weakFrames: BATTLE_BURST_WEAK_FRAMES, display: displayOf(slot)}) : null;
    }
  });
}
