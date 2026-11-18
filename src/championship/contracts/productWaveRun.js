// Wave runs (WAVE_RUN_20261118, OWNER_APPROVED_ADAPTATION). Owner 2026-11-18: the story and a challenge mode share
// one wave auto-battle around the existing free battle: waves of foes, coins and items left on the ground, picked by
// a tap (or the magnet talent), and -- in the challenge only -- after every won wave the choice to leave with the loot
// or go on against a stronger wave.
//
// Pure rules and the saved run record. A wave is one ordinary free battle (one or three presets a side, the existing
// core); this module decides which presets, how much stronger, what each defeated foe drops, and how picked loot is
// settled. It owns no screen, no battle and no wallet: the application pays through the shop's own transaction.
import {deepFreeze} from './championshipContracts.js';
import catalog from '../../data/championship/catalogs/free-battle.r1.json' with {type: 'json'};
import {RAISING_TOOL_SHOP_RECORDS} from '../shop/shopCatalog.js';

export const WAVE_RUN_MODES = Object.freeze(['STORY', 'CHALLENGE']);
// Every number of the mode in one place (the screens read them; nothing is typed in a view).
export const WAVE_RUN_RULES = deepFreeze({
  storyWaves: 3,                 // an ordinary story encounter; a node may name its own count
  storyWavesMax: 5,
  challengeWavesMax: 40,
  challengeTripleFrom: 3,        // from this wave a challenge wave fields three foes
  challengeBoostFrom: 4,         // from this wave the foes grow stronger (dealt x, taken /)
  challengeBoostPerWave: 8,      // percent a wave
  challengeBoostMax: 100,
  dropBitsPercent: 40,           // of a foe's free-battle purse, split into piles
  dropPilesMax: 3,
  itemChancePercent: 30,         // a foe also drops one raising item
  defeatPolicy: 'KEEP_PICKED',   // Owner had not decided: keep what was picked, lose what lay on the ground
  magnetEveryMs: 160,            // the magnet pulls one drop this often (presentation pace only)
  dropsShownMax: 24              // more piles than this are merged on screen, never in value
});
export const WAVE_DEFEAT_POLICIES = Object.freeze(['KEEP_PICKED', 'LOSE_ALL']);
const ITEM_DROPS = deepFreeze([
  {record: RAISING_TOOL_SHOP_RECORDS.feed, weight: 4}, {record: RAISING_TOOL_SHOP_RECORDS.woundMedicine, weight: 3},
  {record: RAISING_TOOL_SHOP_RECORDS.protein, weight: 2}, {record: RAISING_TOOL_SHOP_RECORDS.medicine, weight: 1}
]);
export const WAVE_ITEM_RECORDS = Object.freeze(ITEM_DROPS.map(row => row.record));

// ---- deterministic draws: one stream per (seed, wave, purpose); never the battle's RNG ----
function stream(seed, ...keys) {
  let h = (Number(seed) >>> 0) ^ 0x9e3779b9;
  for (const key of keys) { h = Math.imul(h ^ (Number(key) >>> 0), 0x85ebca6b) >>> 0; h ^= h >>> 13; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (rows, random) => rows[Math.min(rows.length - 1, Math.floor(random() * rows.length))];

// ---- the presets by strength: the free battle's own ten tiers ----
const TIER_OF = new Map();
catalog.pools.forEach((seasons, tier) => seasons.flat().forEach(index => { if (!TIER_OF.has(index)) TIER_OF.set(index, tier); }));
export const WAVE_TIER_MAX = catalog.pools.length - 1;
/** The free-battle tier (0..9) a preset belongs to (its lowest), or null for a preset in no pool. */
export const presetTier = index => TIER_OF.get(index) ?? null;
const poolOf = tier => [...new Set(catalog.pools[Math.max(0, Math.min(WAVE_TIER_MAX, tier))].flat())];
const presetRow = index => catalog.presets[index - catalog.presetStart];
/** The free-battle purse of one preset (what a won free battle against it pays). */
export const presetPurse = index => presetRow(index)?.field0C ?? 0;

/**
 * A story encounter: `waves` waves, the last one the node's own authored foes (a boss), the ones before it drawn
 * from lower tiers so the fight builds toward it.
 */
export function storyEncounter(bossPresets, {seed = 0, waves = WAVE_RUN_RULES.storyWaves} = {}) {
  const boss = (Array.isArray(bossPresets) ? bossPresets : []).filter(index => presetRow(index));
  if (!boss.length) return null;
  const count = Math.max(1, Math.min(WAVE_RUN_RULES.storyWavesMax, Math.floor(waves) || 1));
  const top = Math.max(...boss.map(index => presetTier(index) ?? 0));
  const list = [];
  for (let wave = 0; wave < count - 1; wave++) {
    const random = stream(seed, 1, wave), tier = Math.max(0, top - (count - 1 - wave));
    list.push(Object.freeze({presets: Object.freeze([pick(poolOf(tier), random)]), foeBoostPercent: 0, boss: false, tier}));
  }
  list.push(Object.freeze({presets: Object.freeze([...boss]), foeBoostPercent: 0, boss: true, tier: top}));
  return Object.freeze(list);
}

/** Challenge wave `wave` (0-based): one foe at first, then three; a higher tier every two waves; then stronger foes. */
export function challengeWave(wave, {seed = 0} = {}) {
  const n = Math.max(0, Math.floor(wave) || 0), random = stream(seed, 2, n);
  const tier = Math.min(WAVE_TIER_MAX, Math.floor(n / 2));
  const count = n + 1 >= WAVE_RUN_RULES.challengeTripleFrom ? 3 : 1;
  // three different foes (the free battle builds one team member per preset)
  const pool = poolOf(tier), presets = [];
  for (let i = 0; i < count && pool.length; i++) presets.push(pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0]);
  const boost = n + 1 >= WAVE_RUN_RULES.challengeBoostFrom
    ? Math.min(WAVE_RUN_RULES.challengeBoostMax, (n + 2 - WAVE_RUN_RULES.challengeBoostFrom) * WAVE_RUN_RULES.challengeBoostPerWave) : 0;
  return Object.freeze({presets: Object.freeze(presets), foeBoostPercent: boost, boss: false, tier});
}

/** What wave `wave` of `run` fields. */
export function waveFoes(run, wave = run?.wave ?? 0) {
  if (!run) return null;
  if (run.mode === 'STORY') return storyEncounter(run.bossPresets, {seed: run.seed, waves: run.waves})?.[wave] ?? null;
  return wave < WAVE_RUN_RULES.challengeWavesMax ? challengeWave(wave, {seed: run.seed}) : null;
}

/**
 * The drops a won wave leaves: per defeated foe (slot), a few piles of Bits worth WAVE_RUN_RULES.dropBitsPercent of its
 * purse and, by chance, one raising item. Each drop's id is stable: run + wave + foe slot + index.
 */
export function waveDrops(run, wave, presets) {
  const drops = [];
  presets.forEach((preset, slot) => {
    const random = stream(run.seed, 3, wave, slot);
    const bits = Math.max(1, Math.round(presetPurse(preset) * WAVE_RUN_RULES.dropBitsPercent / 100));
    const piles = Math.max(1, Math.min(WAVE_RUN_RULES.dropPilesMax, Math.ceil(bits / 40)));
    let left = bits;
    for (let k = 0; k < piles; k++) {
      const amount = k === piles - 1 ? left : Math.max(1, Math.floor(bits / piles));
      left -= amount;
      drops.push({id: `${run.runId}:${wave}:${slot}:${k}`, wave, slot, kind: 'BITS', amount, state: 'GROUND', x: random(), y: random()});
    }
    if (random() * 100 < WAVE_RUN_RULES.itemChancePercent) {
      const total = ITEM_DROPS.reduce((sum, row) => sum + row.weight, 0);
      let roll = random() * total, row = ITEM_DROPS[0];
      for (const entry of ITEM_DROPS) { if (roll < entry.weight) { row = entry; break; } roll -= entry.weight; }
      drops.push({id: `${run.runId}:${wave}:${slot}:${piles}`, wave, slot, kind: 'ITEM', record: row.record, amount: 1, state: 'GROUND', x: random(), y: random()});
    }
  });
  return drops;
}

// ---- the run record ----
const STATES = new Set(['FIGHTING', 'REST', 'CLEARED', 'LEFT', 'DEFEATED', 'ABANDONED', 'FAILED']);
const DROP_STATES = new Set(['GROUND', 'PICKED', 'SETTLED']);
export const WAVE_RUN_FINAL = Object.freeze(['CLEARED', 'LEFT', 'DEFEATED', 'ABANDONED', 'FAILED']);

export function createWaveRun({mode, encounterId, party, seed, runId, bossPresets = [], waves = null} = {}) {
  if (!WAVE_RUN_MODES.includes(mode)) throw new TypeError('WAVE_RUN_MODE_REQUIRED');
  const ids = (Array.isArray(party) ? party : []).filter(id => typeof id === 'string' && id).slice(0, 3);
  if (!ids.length) throw new TypeError('WAVE_RUN_PARTY_REQUIRED');
  if (typeof runId !== 'string' || !runId || runId.length > 80) throw new TypeError('WAVE_RUN_ID_REQUIRED');
  const run = {version: 1, runId, mode, encounterId: String(encounterId ?? mode), seed: Number(seed) >>> 0, party: ids, wave: 0, status: 'FIGHTING',
    attempts: [], drops: [], bossPresets: mode === 'STORY' ? [...bossPresets] : [], waves: mode === 'STORY' ? Math.max(1, Math.min(WAVE_RUN_RULES.storyWavesMax, waves ?? WAVE_RUN_RULES.storyWaves)) : null};
  if (mode === 'STORY' && !storyEncounter(run.bossPresets, {seed: run.seed, waves: run.waves})) throw new TypeError('WAVE_RUN_STORY_PRESETS_REQUIRED');
  return normalizeWaveRun(run);
}

/** Accept only the known shape (a save from before wave runs has none: null). */
export function normalizeWaveRun(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || !WAVE_RUN_MODES.includes(value.mode) || typeof value.runId !== 'string') return null;
  const drops = (Array.isArray(value.drops) ? value.drops : []).filter(drop => drop && typeof drop.id === 'string' && DROP_STATES.has(drop.state)
    && (drop.kind === 'BITS' ? Number.isSafeInteger(drop.amount) && drop.amount > 0 : drop.kind === 'ITEM' && WAVE_ITEM_RECORDS.includes(drop.record)))
    .map(drop => Object.freeze({id: drop.id, wave: drop.wave | 0, slot: drop.slot | 0, kind: drop.kind, ...(drop.kind === 'ITEM' ? {record: drop.record} : {}),
      amount: drop.kind === 'ITEM' ? 1 : drop.amount, state: drop.state, x: Number.isFinite(drop.x) ? drop.x : 0.5, y: Number.isFinite(drop.y) ? drop.y : 0.5}));
  return deepFreeze({version: 1, runId: value.runId, mode: value.mode, encounterId: String(value.encounterId ?? value.mode), seed: Number(value.seed) >>> 0,
    party: (Array.isArray(value.party) ? value.party : []).filter(id => typeof id === 'string').slice(0, 3), wave: Math.max(0, value.wave | 0),
    status: STATES.has(value.status) ? value.status : 'ABANDONED', attempts: (Array.isArray(value.attempts) ? value.attempts : []).filter(id => typeof id === 'string').slice(-64),
    drops: [...new Map(drops.map(drop => [drop.id, drop])).values()], bossPresets: (Array.isArray(value.bossPresets) ? value.bossPresets : []).filter(Number.isSafeInteger),
    waves: value.mode === 'STORY' ? Math.max(1, value.waves | 0) : null});
}

/**
 * One wave's result, once per battle attempt (a second report of the same attempt changes nothing). A win leaves the
 * wave's drops on the ground and rests (or clears the story's last wave); a loss ends the run as defeated.
 */
export function recordWaveResult(run, {attemptId, won, presets}) {
  if (!run || WAVE_RUN_FINAL.includes(run.status) || run.status !== 'FIGHTING') return {run, changed: false};
  if (typeof attemptId !== 'string' || run.attempts.includes(attemptId)) return {run, changed: false};
  const attempts = [...run.attempts, attemptId];
  if (won !== true) return {run: normalizeWaveRun({...run, attempts, status: 'DEFEATED'}), changed: true};
  const drops = [...run.drops, ...waveDrops(run, run.wave, presets ?? waveFoes(run)?.presets ?? [])];
  const cleared = run.mode === 'STORY' && run.wave + 1 >= run.waves;
  return {run: normalizeWaveRun({...run, attempts, drops, wave: run.wave + 1, status: cleared ? 'CLEARED' : 'REST'}), changed: true};
}

/** The next wave starts (challenge: the player chose to go on; story: the encounter goes on). */
export function continueWaveRun(run) {
  if (!run || run.status !== 'REST' || !waveFoes(run)) return {run, ok: false, reason: run?.status === 'REST' ? 'NO_MORE_WAVES' : 'NOT_RESTING'};
  return {run: normalizeWaveRun({...run, status: 'FIGHTING'}), ok: true};
}

/** The one authority that picks a drop up (a tap and the magnet both come here). Only a drop on the ground. */
export function collectWaveDrop(run, dropId) {
  const drop = run?.drops.find(entry => entry.id === dropId);
  if (!drop) return {run, ok: false, reason: 'NO_SUCH_DROP'};
  if (drop.state !== 'GROUND') return {run, ok: false, reason: 'ALREADY_PICKED'};
  if (WAVE_RUN_FINAL.includes(run.status) && run.status !== 'CLEARED') return {run, ok: false, reason: 'RUN_OVER'};
  return {run: normalizeWaveRun({...run, drops: run.drops.map(entry => (entry.id === dropId ? {...entry, state: 'PICKED'} : entry))}), ok: true, drop};
}

/** What the picked-but-not-settled drops are worth: {bits, items: {record: n}, ids}. */
export function waveLoot(run, state = 'PICKED') {
  const loot = {bits: 0, items: {}, ids: []};
  for (const drop of run?.drops ?? []) {
    if (drop.state !== state) continue;
    loot.ids.push(drop.id);
    if (drop.kind === 'BITS') loot.bits += drop.amount; else loot.items[drop.record] = (loot.items[drop.record] ?? 0) + drop.amount;
  }
  return loot;
}

/** Mark drops as paid (the application calls it in the same save that credits them). */
export function markWaveDropsSettled(run, ids) {
  const set = new Set(ids);
  return normalizeWaveRun({...run, drops: run.drops.map(drop => (set.has(drop.id) && drop.state === 'PICKED' ? {...drop, state: 'SETTLED'} : drop))});
}

/**
 * End a run. `reason`: LEAVE (challenge, after a won wave), DEFEATED, CLEARED (story), ABANDONED (the player quit),
 * FAILED (the battle could not run). Returns the final record and what it may still pay: the picked drops, except
 * under LOSE_ALL after a defeat. Drops still on the ground are never paid.
 */
export function finishWaveRun(run, reason, {defeatPolicy = WAVE_RUN_RULES.defeatPolicy} = {}) {
  if (!run) return {run, pay: waveLoot(null)};
  const status = reason === 'LEAVE' ? 'LEFT' : reason === 'CLEARED' ? 'CLEARED' : reason === 'DEFEATED' ? 'DEFEATED' : reason === 'FAILED' ? 'FAILED' : 'ABANDONED';
  if (reason === 'LEAVE' && !(run.mode === 'CHALLENGE' && run.status === 'REST')) return {run, pay: waveLoot(null), refused: 'NOT_RESTING'};
  const lose = status === 'DEFEATED' && defeatPolicy === 'LOSE_ALL';
  const next = normalizeWaveRun({...run, status, drops: lose ? run.drops.map(drop => (drop.state === 'PICKED' ? {...drop, state: 'SETTLED', lost: true} : drop)) : run.drops});
  return {run: next, pay: lose ? waveLoot(null) : waveLoot(next)};
}
