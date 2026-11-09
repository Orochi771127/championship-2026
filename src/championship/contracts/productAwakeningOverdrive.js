// Awakening overdrive -- OWNER_APPROVED_ADAPTATION 2026-11-09 (AWAKENING_OVERDRIVE_20261109).
//
// NOT original behaviour. Four product rules that ride on awakening raising (productBurstEvolution.js):
//   1. the first awakening is a tactile cocoon the player cracks with three taps (4 s idle finishes it);
//   2. overdrive cage training: about 2.2-2.5x awakening points for a few bits, a core heat that backfires
//      past 80 %, cooled fast beside a recovery cage (or inside one);
//   3. in battle a long press (0.6 s) or a double tap calls an over-limit burst: cooldowns reset, damage and
//      action speed +50 % for 10 s, then a 3 s exhaustion unless the current foe fell (beta bloodline: immune);
//      and sponsor stake contracts on a match (stake 15,000-80,000 bits, paid back x2 / x2.5 / x3 on success);
//   4. wild partners in the hunt roll a hidden instinct: normal 65 %, veteran elite 27 %, ancestral 8 %.
// This module is pure: tables plus functions over plain values. The app owns wallets, saves and timing.
import {deepFreeze} from './championshipContracts.js';

// ---- 1. tactile cocoon ----
export const COCOON_RULES = deepFreeze({taps: 3, idleAutoMs: 4000, autoStepMs: 420, stageShake: [4, 7, 12]});

// ---- 2. overdrive training ----
// Recovery cages that cool a hot core: mini infirmary, hospital, garden, hot spring, infirmary, mini garden.
export const OVERDRIVE_COOLING_CAGES = Object.freeze([15, 16, 17, 18, 28, 29]);
export const OVERDRIVE_RULES = deepFreeze({
  costBits: 300,
  multiplier: {minimum: 2.2, maximum: 2.5},
  epiphanyPercent: 15, epiphanyGain: 3, epiphanyKinds: [18, 19, 20, 21],
  heatPerTraining: 22, backlashAbove: 80, backlashFatigue: 20, backlashSeconds: 60,
  // Heat lost per real minute: anywhere, beside a recovery cage, inside one.
  coolPerMinute: {base: 1, adjacent: 12, inside: 25}
});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
/** The core heat at `nowMs` of a record {heat, at} cooling at `perMinute` since it was written. */
export function overdriveHeatAt(record, nowMs, perMinute = OVERDRIVE_RULES.coolPerMinute.base) {
  if (!record || !Number.isFinite(record.heat)) return 0;
  const minutes = Number.isFinite(record.at) && Number.isFinite(nowMs) ? Math.max(0, (nowMs - record.at) / 60000) : 0;
  return clamp(record.heat - minutes * perMinute, 0, 100);
}
/** How fast a partner cools here: 'inside' a recovery cage, 'adjacent' to one, or 'base'. */
export function overdriveCooling(cageDefinition, neighbourDefinitions = []) {
  if (OVERDRIVE_COOLING_CAGES.includes(cageDefinition)) return 'inside';
  return neighbourDefinitions.some(definition => OVERDRIVE_COOLING_CAGES.includes(definition)) ? 'adjacent' : 'base';
}
/**
 * One overdrive training. `commands` are the native training's [{kind, delta, outcome}]; `roll()` gives [0, 1).
 * Returns {backlash, multiplier, epiphany, extra: [{kind, delta}], heat} where heat is the core heat after it.
 * Past backlashAbove the training backfires: no points (the caller drops them) and a short fatigue.
 */
export function resolveOverdriveTraining({commands = [], heat = 0, roll}) {
  const before = clamp(Number(heat) || 0, 0, 100);
  if (before > OVERDRIVE_RULES.backlashAbove) return deepFreeze({backlash: true, multiplier: 0, epiphany: false, extra: [], heat: before});
  const {minimum, maximum} = OVERDRIVE_RULES.multiplier;
  const multiplier = Math.round((minimum + (maximum - minimum) * roll()) * 100) / 100;
  const extra = [];
  for (const command of commands) if (command.kind < 11 && command.delta > 0 && command.outcome === 'APPLIED')
    extra.push({kind: command.kind, delta: Math.max(1, Math.round(command.delta * (multiplier - 1)))});
  const epiphany = extra.length > 0 && roll() * 100 < OVERDRIVE_RULES.epiphanyPercent;
  if (epiphany) for (const kind of OVERDRIVE_RULES.epiphanyKinds) extra.push({kind, delta: OVERDRIVE_RULES.epiphanyGain});
  return deepFreeze({backlash: false, multiplier, epiphany, extra, heat: clamp(before + OVERDRIVE_RULES.heatPerTraining, 0, 100)});
}

// ---- 3a. over-limit burst ----
export const OVER_LIMIT_RULES = deepFreeze({holdMs: 600, doubleTapMs: 320, seconds: 10, damageBonus: 0.5, speedBonus: 0.5,
  exhaustSeconds: 3, exhaustTakenMultiplier: 1.3, immuneBloodline: 'beta'});

// ---- 3b. sponsor stake contracts ----
// Payout is the stake times `payout` (the stake included); a failed contract keeps the stake.
export const SPONSOR_CONTRACTS = deepFreeze([
  {id: 'HEART_GUARD', faction: 'LUMEN', payout: 2, condition: {noPartnerDown: true}, reward: {awakeningPoints: 15}},
  {id: 'IRON_RUSH', faction: 'IRON', payout: 2.5, condition: {maxSeconds: 60}, reward: {shard: true}},
  {id: 'RIFT_GAMBIT', faction: 'RIFT', payout: 3, condition: {foeBoostPercent: 20}, reward: {awakeningPercent: 25}}
]);
export const SPONSOR_STAKES = deepFreeze({minimum: 15000, maximum: 80000, step: 5000, defaultStake: 15000});
export function sponsorContract(id) { return SPONSOR_CONTRACTS.find(contract => contract.id === id) ?? null; }
export function validSponsorStake(stake) {
  return Number.isSafeInteger(stake) && stake >= SPONSOR_STAKES.minimum && stake <= SPONSOR_STAKES.maximum
    && (stake - SPONSOR_STAKES.minimum) % SPONSOR_STAKES.step === 0;
}
/** Whether a won match met the contract: {won, partnerDowns, seconds, foeBoostPercent}. */
export function sponsorContractMet(contract, {won = false, partnerDowns = 0, seconds = Infinity, foeBoostPercent = 0} = {}) {
  if (!contract || won !== true) return false;
  const c = contract.condition;
  if (c.noPartnerDown && partnerDowns > 0) return false;
  if (Number.isFinite(c.maxSeconds) && !(seconds <= c.maxSeconds)) return false;
  if (Number.isFinite(c.foeBoostPercent) && foeBoostPercent < c.foeBoostPercent) return false;
  return true;
}
/** {met, payout} bits for a settled contract (payout 0 when it failed). */
export function settleSponsorContract({contractId, stake}, result) {
  const contract = sponsorContract(contractId);
  const met = Boolean(contract) && validSponsorStake(stake) && sponsorContractMet(contract, result);
  return deepFreeze({met, contractId, stake, payout: met ? Math.floor(stake * contract.payout) : 0, reward: met ? contract.reward : null});
}

// ---- 4. wild awakening instinct ----
export const WILD_INSTINCTS = deepFreeze([
  {id: 'NORMAL', weight: 65},
  {id: 'ELITE', weight: 27, speedMultiplier: 1.2, awakeningPoints: 15, statGain: 6},
  {id: 'ANCESTOR', weight: 8, scale: 1.15, awakeningPercent: 40}
]);
export const WILD_INSTINCT_BLOODLINES = Object.freeze(['emma', 'beta', 'chronoOre', 'chronoMetal', 'chronoAlloy', 'supernova']);
export function wildInstinct(id) { return WILD_INSTINCTS.find(entry => entry.id === id) ?? WILD_INSTINCTS[0]; }
// Deterministic noise in [0, 1) from integer keys (product-side; the native hunt RNG is never read).
export function instinctNoise(...keys) {
  let h = 0x811c9dc5;
  for (const key of keys) { h = Math.imul(h ^ (key >>> 0), 0x01000193); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; }
  return (h >>> 0) / 4294967296;
}
/** The instinct a wild partner rolls from `noise` in [0, 1). */
export function rollWildInstinct(noise) {
  let at = noise * 100;
  for (const entry of WILD_INSTINCTS) { if (at < entry.weight) return entry.id; at -= entry.weight; }
  return WILD_INSTINCTS[0].id;
}
/** The point condition (BURST_CONDITION_IDS) a partner's own race raises (its faction for one with no race). */
export const RACE_POINT_CONDITION = Object.freeze({DRAGON: 'DRAGON_ATTRIBUTE', BEAST: 'BEAST_ATTRIBUTE', AQUATIC: 'AQUATIC_ATTRIBUTE',
  AVIAN: 'BIRD_ATTRIBUTE', SYLVAN: 'INSECT_PLANT_ATTRIBUTE', ASTRAL: 'HOLY_ATTRIBUTE', NETHER: 'DARK_ATTRIBUTE', MECHANOID: 'MACHINE_ATTRIBUTE'});
export const FACTION_POINT_CONDITION = Object.freeze({LUMEN: 'VACCINE_ATTRIBUTE', IRON: 'DATA_ATTRIBUTE', RIFT: 'VIRUS_ATTRIBUTE'});
export function ownPointCondition(taxonomy) {
  return RACE_POINT_CONDITION[taxonomy?.race] ?? FACTION_POINT_CONDITION[taxonomy?.faction] ?? null;
}
