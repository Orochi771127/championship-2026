// Element matchups and faction resonance for the auto battle -- OWNER_APPROVED_ADAPTATION 2026-10-29.
//
// This is NOT original behaviour. Under the ORIGINAL policy nothing here runs and the native
// damage, crit, TP and HP rules are untouched. Under TAXONOMY_V1, for both teams alike:
//   - an elemental move (ROM element selector != 0) deals x1.5 to the element its user's element
//     beats on the same ring and x0.75 to the element that beats it; physical moves are neutral;
//   - a team with two of one faction, or one of each, lights that faction's resonance:
//       Lumen: damage taken -10%, 1% max HP back every 5 seconds;
//       Black Iron: starts with 120% TP, defence +8% (damage taken / 1.08);
//       Rift: crit threshold +10, the signature move (its costliest) +15%;
//       Tri-core: damage dealt x1.08, damage taken / 1.08, win rewards +15%.
// Scaling happens after the native resolver, once per hit, truncated and never below 1.
import {speciesTaxonomy, factionResonance, elementMultiplierPercent, TAXONOMY_RESONANCE} from '../contracts/speciesTaxonomy.js';

export const BATTLE_TAXONOMY_ORIGINAL = 'ORIGINAL';
export const BATTLE_TAXONOMY_V1 = 'TAXONOMY_V1';
export const BATTLE_TAXONOMY_POLICIES = Object.freeze([BATTLE_TAXONOMY_ORIGINAL, BATTLE_TAXONOMY_V1]);
export const BATTLE_TAXONOMY_REGEN_FRAMES = 300; // 5 seconds of the 60 Hz battle clock

/**
 * @param {object} input
 * @param {string} input.policy
 * @param {Array<number|null>} input.speciesBySlot species index per battle slot (null for empty)
 * @param {(slot:number)=>number} input.teamOf
 * @param {Array<Array<number>>} [input.companions] extra species per team that count toward resonance
 */
export function createBattleTaxonomyAdaptation({policy = BATTLE_TAXONOMY_ORIGINAL, speciesBySlot = [], teamOf, companions = []} = {}) {
  if (!BATTLE_TAXONOMY_POLICIES.includes(policy)) throw new Error('BATTLE_TAXONOMY_POLICY_UNKNOWN');
  const on = policy === BATTLE_TAXONOMY_V1;
  const teams = new Map();
  speciesBySlot.forEach((species, slot) => { if (species !== null && species !== undefined) { const t = teamOf(slot); teams.set(t, [...(teams.get(t) ?? []), species]); } });
  const resonanceOf = new Map([...teams].map(([team, list]) => [team, on ? factionResonance([...list, ...(companions[team] ?? [])].map(s => speciesTaxonomy(s)?.faction)) : []]));
  const has = (slot, key) => resonanceOf.get(teamOf(slot))?.includes(key) ?? false;
  const elementOf = slot => speciesTaxonomy(speciesBySlot[slot])?.element ?? null;
  return Object.freeze({
    policy,
    resonance(team) { return resonanceOf.get(team) ?? []; },
    /** Black Iron teams open with 120% TP. */
    applyStart(slots) {
      if (!on) return;
      slots.forEach((c, slot) => { if (c && has(slot, 'IRON')) c.metricLimit = Math.trunc(c.metricBase * TAXONOMY_RESONANCE.IRON.startTpPercent / 100); });
    },
    critBonus(slot) { return on && has(slot, 'RIFT') ? TAXONOMY_RESONANCE.RIFT.critChancePercent : 0; },
    /** Scale one resolved hit; `signature` marks the attacker's costliest move. */
    scaleDamage({attackerSlot, defenderSlot, elementSelector = 0, damage, signature = false}) {
      if (!on || !(damage > 0)) return damage;
      let num = 1, den = 1;
      const mul = (n, d = 100) => { num *= n; den *= d; };
      if (elementSelector !== 0) mul(elementMultiplierPercent(elementOf(attackerSlot), elementOf(defenderSlot)));
      if (has(attackerSlot, 'TRI')) mul(TAXONOMY_RESONANCE.TRI.attackPercent);
      if (signature && has(attackerSlot, 'RIFT')) mul(TAXONOMY_RESONANCE.RIFT.signaturePercent);
      if (has(defenderSlot, 'LUMEN')) mul(TAXONOMY_RESONANCE.LUMEN.damageTakenPercent);
      if (has(defenderSlot, 'IRON')) mul(100, TAXONOMY_RESONANCE.IRON.defensePercent);
      if (has(defenderSlot, 'TRI')) mul(100, TAXONOMY_RESONANCE.TRI.defensePercent);
      return Math.max(1, Math.trunc(damage * num / den));
    },
    /** Lumen teams recover 1% max HP every 5 seconds while standing; returns the slots it healed. */
    regen(frame, slots) {
      if (!on || frame <= 0 || frame % BATTLE_TAXONOMY_REGEN_FRAMES !== 0) return [];
      const healed = [];
      slots.forEach((c, slot) => {
        if (!c || c.currentHp <= 0 || c.currentHp >= c.maxHp || !has(slot, 'LUMEN')) return;
        c.currentHp = Math.min(c.maxHp, c.currentHp + Math.max(1, Math.trunc(c.maxHp * TAXONOMY_RESONANCE.LUMEN.regenPercent / 100)));
        healed.push(slot);
      });
      return healed;
    },
    rewardPercent(team) { return on && resonanceOf.get(team)?.includes('TRI') ? TAXONOMY_RESONANCE.TRI.rewardPercent : 100; }
  });
}
