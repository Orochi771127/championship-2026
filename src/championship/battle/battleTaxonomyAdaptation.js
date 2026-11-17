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
//
// TAMER_TALENTS_T3_20261118: `commander` carries the commander talent line of the local player for one team
// (never the other team, never password or link battles: the application passes none there):
//   lumenPercent / ironPercent / riftPercent  that resonance's own bonus is that much larger (the part past 100 %);
//   openingTpPercent     opens with that much more TP;
//   lowHpDefensePercent  below 30 % HP it takes damage / (1 + that share);
//   ultimatePercent      its signature move deals that much more.
// TAMER_TALENTS_T5_20261118, the commander's two keystones (a tamer takes one):
//   pureFaction  with three partners of one faction, that faction's resonance bonus is half as large again;
//   triColor     the Tri-core resonance gives its team 114 % attack and defence and 125 % rewards.
import {speciesTaxonomy, factionResonance, elementMultiplierPercent, TAXONOMY_RESONANCE} from '../contracts/speciesTaxonomy.js';
import {KEYSTONE_RULES} from '../contracts/productTamerTalents.js';

export const BATTLE_TAXONOMY_ORIGINAL = 'ORIGINAL';
export const BATTLE_TAXONOMY_V1 = 'TAXONOMY_V1';
export const BATTLE_TAXONOMY_POLICIES = Object.freeze([BATTLE_TAXONOMY_ORIGINAL, BATTLE_TAXONOMY_V1]);
export const BATTLE_TAXONOMY_REGEN_FRAMES = 300; // 5 seconds of the 60 Hz battle clock
/** HP share under which the commander talent 逆境 acts. */
export const COMMANDER_LOW_HP_PERCENT = 30;
const COMMANDER_KEYS = Object.freeze(['lumenPercent', 'ironPercent', 'riftPercent', 'openingTpPercent', 'lowHpDefensePercent', 'ultimatePercent']);
/** Accept only a team index and non-negative finite shares; anything else is no commander. */
export function normalizeBattleCommander(value) {
  if (!value || ![0, 1].includes(value.team)) return null;
  const out = {team: value.team};
  for (const key of COMMANDER_KEYS) out[key] = Number.isFinite(value[key]) && value[key] > 0 ? Math.min(100, value[key]) : 0;
  out.pureFaction = value.pureFaction === true; out.triColor = value.triColor === true;
  return COMMANDER_KEYS.some(key => out[key] > 0) || out.pureFaction || out.triColor ? Object.freeze(out) : null;
}
/** A resonance percent with its bonus part (the distance from 100) made `more` percent larger: 90 -> 88, 108 -> 109.6 at 20. */
export function resonanceBoosted(base, more = 0) { return 100 + (base - 100) * (100 + more) / 100; }

/**
 * @param {object} input
 * @param {string} input.policy
 * @param {Array<number|null>} input.speciesBySlot species index per battle slot (null for empty)
 * @param {(slot:number)=>number} input.teamOf
 * @param {Array<Array<number>>} [input.companions] extra species per team that count toward resonance
 * @param {object|null} [input.commander] the local player's commander talents: {team, lumenPercent, ...}
 */
export function createBattleTaxonomyAdaptation({policy = BATTLE_TAXONOMY_ORIGINAL, speciesBySlot = [], teamOf, companions = [], commander = null} = {}) {
  if (!BATTLE_TAXONOMY_POLICIES.includes(policy)) throw new Error('BATTLE_TAXONOMY_POLICY_UNKNOWN');
  const on = policy === BATTLE_TAXONOMY_V1;
  const teams = new Map();
  speciesBySlot.forEach((species, slot) => { if (species !== null && species !== undefined) { const t = teamOf(slot); teams.set(t, [...(teams.get(t) ?? []), species]); } });
  const resonanceOf = new Map([...teams].map(([team, list]) => [team, on ? factionResonance([...list, ...(companions[team] ?? [])].map(s => speciesTaxonomy(s)?.faction)) : []]));
  const has = (slot, key) => resonanceOf.get(teamOf(slot))?.includes(key) ?? false;
  // The commander line: only the slots of its own team read it.
  const lead = typeof teamOf === 'function' ? normalizeBattleCommander(commander) : null;
  // 純色陣營: the commander's team is three partners of one faction.
  const own = lead ? (teams.get(lead.team) ?? []).map(species => speciesTaxonomy(species)?.faction) : [];
  const pure = lead?.pureFaction && own.length === 3 && own[0] && own.every(faction => faction === own[0]) ? own[0] : null;
  const PURE_KEY = {LUMEN: 'lumenPercent', IRON: 'ironPercent', RIFT: 'riftPercent'};
  const more = (slot, key) => (lead && teamOf(slot) === lead.team ? lead[key] + (pure && PURE_KEY[pure] === key ? KEYSTONE_RULES.pureFactionPercent : 0) : 0);
  // 三色指揮: the commander's own Tri-core.
  const tri = (slot, key) => (lead?.triColor && teamOf(slot) === lead.team ? KEYSTONE_RULES.triColor[key] : TAXONOMY_RESONANCE.TRI[key]);
  // A burst form fights with its own element (Owner 2026-11-08); faction resonance stays the team that started.
  const current = [...speciesBySlot];
  const elementOf = slot => speciesTaxonomy(current[slot])?.element ?? null;
  return Object.freeze({
    policy,
    resonance(team) { return resonanceOf.get(team) ?? []; },
    /** The species a slot now fights as (its element for matchups). */
    setSpecies(slot, species) { current[slot] = species; },
    /** Black Iron teams open with 120% TP; the commander talent 先手 adds its share for its team. */
    applyStart(slots) {
      slots.forEach((c, slot) => {
        if (!c) return;
        const iron = on && has(slot, 'IRON') ? resonanceBoosted(TAXONOMY_RESONANCE.IRON.startTpPercent, more(slot, 'ironPercent')) : 100;
        const percent = iron + more(slot, 'openingTpPercent');
        if (percent !== 100) c.metricLimit = Math.trunc(c.metricBase * percent / 100);
      });
    },
    critBonus(slot) { return on && has(slot, 'RIFT') ? Math.round(TAXONOMY_RESONANCE.RIFT.critChancePercent * (100 + more(slot, 'riftPercent')) / 100) : 0; },
    /** Scale one resolved hit; `signature` marks the attacker's costliest move. */
    scaleDamage({attackerSlot, defenderSlot, elementSelector = 0, damage, signature = false, defenderHpPercent = 100}) {
      if (!(damage > 0)) return damage;
      if (!on) {
        // Without the taxonomy the two commander talents that are not resonances still act.
        const up = signature ? more(attackerSlot, 'ultimatePercent') : 0;
        const guard = defenderHpPercent < COMMANDER_LOW_HP_PERCENT ? more(defenderSlot, 'lowHpDefensePercent') : 0;
        return up || guard ? Math.max(1, Math.trunc(damage * (100 + up) / (100 + guard))) : damage;
      }
      let num = 1, den = 1;
      const mul = (n, d = 100) => { num *= n; den *= d; };
      if (elementSelector !== 0) mul(elementMultiplierPercent(elementOf(attackerSlot), elementOf(defenderSlot)));
      if (has(attackerSlot, 'TRI')) mul(tri(attackerSlot, 'attackPercent'));
      if (signature && has(attackerSlot, 'RIFT')) mul(resonanceBoosted(TAXONOMY_RESONANCE.RIFT.signaturePercent, more(attackerSlot, 'riftPercent')));
      if (signature && more(attackerSlot, 'ultimatePercent')) mul(100 + more(attackerSlot, 'ultimatePercent')); // 必殺
      if (has(defenderSlot, 'LUMEN')) mul(resonanceBoosted(TAXONOMY_RESONANCE.LUMEN.damageTakenPercent, more(defenderSlot, 'lumenPercent')));
      if (has(defenderSlot, 'IRON')) mul(100, resonanceBoosted(TAXONOMY_RESONANCE.IRON.defensePercent, more(defenderSlot, 'ironPercent')));
      if (defenderHpPercent < COMMANDER_LOW_HP_PERCENT && more(defenderSlot, 'lowHpDefensePercent')) mul(100, 100 + more(defenderSlot, 'lowHpDefensePercent')); // 逆境
      if (has(defenderSlot, 'TRI')) mul(100, tri(defenderSlot, 'defensePercent'));
      return Math.max(1, Math.trunc(damage * num / den));
    },
    /** Lumen teams recover 1% max HP every 5 seconds while standing; returns the slots it healed. */
    regen(frame, slots) {
      if (!on || frame <= 0 || frame % BATTLE_TAXONOMY_REGEN_FRAMES !== 0) return [];
      const healed = [];
      slots.forEach((c, slot) => {
        if (!c || c.currentHp <= 0 || c.currentHp >= c.maxHp || !has(slot, 'LUMEN')) return;
        c.currentHp = Math.min(c.maxHp, c.currentHp + Math.max(1, Math.trunc(c.maxHp * TAXONOMY_RESONANCE.LUMEN.regenPercent * (100 + more(slot, 'lumenPercent')) / 10000)));
        healed.push(slot);
      });
      return healed;
    },
    rewardPercent(team) {
      if (!on || !resonanceOf.get(team)?.includes('TRI')) return 100;
      return lead?.triColor && team === lead.team ? KEYSTONE_RULES.triColor.rewardPercent : TAXONOMY_RESONANCE.TRI.rewardPercent;
    }
  });
}
