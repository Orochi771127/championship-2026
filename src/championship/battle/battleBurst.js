// Burst evolution in the auto battle -- OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102).
//
// NOT original behaviour. Under OFF nothing here runs. Under BURST_V1, for both teams alike:
//   - every hit fills the attacker's and the defender's gauge (dealt and taken damage, relative to max HP); a
//     partner's bond speeds its gauge (up to bondChargeBonus), and damage taken below pinchHpPercent fills it
//     pinchTakenMultiplier times faster;
//   - a full gauge starts the burst once per battle. A manual plan (the player's partners in an interactive
//     battle) waits READY for the player's call, at most manualSeconds, and goes at once when its HP falls below
//     pinchHpPercent; other plans go immediately. The battle holds for the wrap while a shell of hex plates wraps
//     the 成熟期, cracks and blows apart (presentation reads `wrapFrame`); a tier-2 form that comes through a
//     tier-1 form (`via`) shows that form for chainFrames before the second burst. Then the combatant is its
//     burst form for BURST_FRAMES;
//   - while burst its damage dealt is x1.4 (tier 1) / x1.7 (tier 2) and damage taken divided by the same;
//     afterwards it is weakened (x0.85) for WEAK_FRAMES, then spent;
//   - a bloodline (gacha metals) adds one perk: faster gauge, no weakness, a longer burst, a heal at the burst,
//     a quicker action cooldown, or a higher multiplier;
//   - an opponent whose preset was a former 覺醒體/究極體 (`base` set) is shown as the 成熟期 that bursts into it
//     and built at the form's strength (baseline): before its burst it deals and takes damage as if divided by
//     that multiplier, so after it it fights exactly as its preset.
// Scaling happens after the native resolver and taxonomy, once per hit, truncated and never below 1, so the
// native damage, crit, TP and HP rules are untouched. A down combatant reverts. While the battle holds no
// native frame, AI, clock or RNG advances.
import {BURST_RULES, BURST_BATTLE_RULES, BLOODLINE_BURST_PERKS, burstMultiplier} from '../contracts/productBurstEvolution.js';

export const BATTLE_BURST_OFF = 'OFF';
export const BATTLE_BURST_V1 = 'BURST_V1';
export const BATTLE_BURST_POLICIES = Object.freeze([BATTLE_BURST_OFF, BATTLE_BURST_V1]);
export const BATTLE_BURST_FRAMES = BURST_RULES.durationSeconds * 60;
export const BATTLE_BURST_WEAK_FRAMES = BURST_RULES.weaknessSeconds * 60;
export const BATTLE_BURST_GAUGE_MAX = BURST_RULES.gaugeMaximum;
// Held battle frames for the wrap (0..41), crack (42..62) and burst flash (63..71).
export const BATTLE_BURST_WRAP_FRAMES = 72;
// A tier-2 chain shows its tier-1 form for these frames after the first flash, then bursts again.
export const BATTLE_BURST_CHAIN_FRAMES = BURST_BATTLE_RULES.chainFrames;
export const BATTLE_BURST_MANUAL_FRAMES = BURST_BATTLE_RULES.manualSeconds * 60;
// Gauge per hit: dealing a foe's whole max HP fills 150, losing one's own whole max HP fills 200.
const DEALT_RATE = 150, TAKEN_RATE = 200;
const pinched = (hp, maxHp) => maxHp > 0 && hp > 0 && hp * 100 < maxHp * BURST_BATTLE_RULES.pinchHpPercent;

/**
 * @param {object} input
 * @param {string} input.policy
 * @param {Array<{form:number,tier:number,baseline?:number,base?:number,via?:number,bloodline?:string,bond?:number,
 *   manual?:boolean}|null>} input.plans per battle slot
 */
export function createBattleBurst({policy = BATTLE_BURST_OFF, plans = []} = {}) {
  if (!BATTLE_BURST_POLICIES.includes(policy)) throw new Error('BATTLE_BURST_POLICY_UNKNOWN');
  const on = policy === BATTLE_BURST_V1;
  const states = plans.map(plan => {
    if (!on || !plan || !Number.isInteger(plan.form) || ![1, 2].includes(plan.tier)) return null;
    const perk = BLOODLINE_BURST_PERKS[plan.bloodline] ?? {};
    const via = plan.tier === 2 && Number.isInteger(plan.via) ? plan.via : null;
    const bond = Math.max(0, Math.min(100, Number.isFinite(plan.bond) ? plan.bond : 0));
    return {plan: Object.freeze({form: plan.form, tier: plan.tier, baseline: plan.baseline ?? 1, base: Number.isInteger(plan.base) ? plan.base : null,
      via, bloodline: BLOODLINE_BURST_PERKS[plan.bloodline] ? plan.bloodline : null, manual: plan.manual === true}),
      charge: (1 + BURST_BATTLE_RULES.bondChargeBonus * bond / 100) * (perk.chargeMultiplier ?? 1),
      multiplier: burstMultiplier(plan.tier) + (perk.multiplierBonus ?? 0),
      burstFrames: BATTLE_BURST_FRAMES + (perk.extraSeconds ?? 0) * 60, weak: perk.noWeakness !== true,
      heal: perk.healPercent ?? 0, speed: (perk.speedPercent ?? 0) / 100, speedCarry: 0,
      wrapFrames: BATTLE_BURST_WRAP_FRAMES + (via !== null ? BATTLE_BURST_CHAIN_FRAMES : 0),
      gauge: 0, phase: 'CHARGING', start: 0, wrapFrame: 0, readyAt: 0, requested: false};
  });
  const queue = [], used = [];
  const factor = slot => {
    const s = states[slot];
    if (!s) return 1;
    const own = s.phase === 'BURST' ? s.multiplier : s.phase === 'WEAK' ? BURST_RULES.weaknessMultiplier : 1;
    return own / s.plan.baseline;
  };
  function displayOf(slot) {
    const s = states[slot];
    if (!s) return null;
    if (s.plan.base !== null) return s.phase === 'BURST' ? null : s.plan.base;
    // A chain shows its tier-1 form between the two flashes.
    if (s.phase === 'WRAP' && s.plan.via !== null && s.wrapFrame >= BATTLE_BURST_WRAP_FRAMES - 9) return s.plan.via;
    return s.phase === 'BURST' ? s.plan.form : null;
  }
  const charge = (slot, amount) => {
    const s = states[slot];
    if (s && s.phase === 'CHARGING' && amount > 0) s.gauge = Math.min(BATTLE_BURST_GAUGE_MAX, s.gauge + Math.round(amount * s.charge));
  };
  const wrap = (slot, events) => {
    const s = states[slot];
    s.phase = 'WRAP'; s.wrapFrame = 0; queue.push(slot);
    events.push({slot, kind: 'WRAP', form: s.plan.form, tier: s.plan.tier, via: s.plan.via});
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
      if (s.wrapFrame < s.wrapFrames) return [];
      queue.shift();
      s.phase = 'BURST'; s.start = frame;
      used.push(Object.freeze({slot, form: s.plan.form, tier: s.plan.tier}));
      return [{slot, kind: 'BURST', form: s.plan.form, tier: s.plan.tier, healPercent: s.heal}];
    },
    /** The player calls a READY burst (false when this slot is not waiting). */
    request(slot) {
      const s = states[slot];
      if (!s || s.phase !== 'READY') return false;
      s.requested = true;
      return true;
    },
    scaleDamage({attackerSlot, defenderSlot, damage}) {
      if (!on || !Number.isFinite(damage) || damage <= 0) return damage;
      const scaled = Math.trunc(damage * factor(attackerSlot) / factor(defenderSlot));
      return Math.max(1, scaled);
    },
    onHit({attackerSlot, defenderSlot, damage, attackerMaxHp = 0, defenderMaxHp = 0, defenderHp = null}) {
      if (!on || !(damage > 0)) return;
      if (defenderMaxHp > 0) {
        charge(attackerSlot, DEALT_RATE * damage / defenderMaxHp);
        const pinch = Number.isFinite(defenderHp) && pinched(defenderHp, defenderMaxHp) ? BURST_BATTLE_RULES.pinchTakenMultiplier : 1;
        charge(defenderSlot, TAKEN_RATE * damage / defenderMaxHp * pinch);
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
          if (s.plan.manual) { s.phase = 'READY'; s.readyAt = frame; events.push({slot, kind: 'READY', form: s.plan.form}); }
          else wrap(slot, events);
        } else if (s.phase === 'READY') {
          if (down) { s.phase = 'SPENT'; events.push({slot, kind: 'REVERT_DOWN', form: s.plan.form}); }
          else if (s.requested || frame - s.readyAt >= BATTLE_BURST_MANUAL_FRAMES || pinched(combatant.currentHp, combatant.maxHp)) wrap(slot, events);
        } else if (s.phase === 'BURST' && (down || frame - s.start >= s.burstFrames)) {
          s.phase = down || !s.weak ? 'SPENT' : 'WEAK'; s.start = frame;
          events.push({slot, kind: down ? 'REVERT_DOWN' : 'REVERT', form: s.plan.form});
        } else if (s.phase === 'BURST' && s.speed > 0) {
          // A quicker action cooldown (時輪 bloodline): the native countdown loses an extra frame now and then.
          s.speedCarry += s.speed;
          while (s.speedCarry >= 1) { s.speedCarry -= 1; if (combatant.field28 > 0) combatant.field28 -= 1; }
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
        base: s.plan.base, via: s.plan.via, bloodline: s.plan.bloodline, manual: s.plan.manual,
        wrapFrame: s.phase === 'WRAP' ? s.wrapFrame : null, wrapFrames: s.wrapFrames,
        readyFrame: s.phase === 'READY' ? Math.max(0, frame - s.readyAt) : null, readyFrames: BATTLE_BURST_MANUAL_FRAMES,
        warn: s.phase === 'CHARGING' && s.gauge >= BURST_BATTLE_RULES.warnGauge,
        phaseFrame: s.phase === 'BURST' || s.phase === 'WEAK' ? Math.max(0, frame - s.start) : null,
        burstFrames: s.burstFrames, weakFrames: BATTLE_BURST_WEAK_FRAMES, display: displayOf(slot)}) : null;
    }
  });
}
