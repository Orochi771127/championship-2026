// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102, awakening raising): a 成熟期 raises its burst
// forms on the ranch and learns each in a ceremony; items push a target; the real-time ranch trains on a clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import {AWAKENING_RULES,BURST_CONDITION_IDS,awakeningProgress,awakeningFocus,awakeningDisplayFor,burstFormsFor,createBurstEvolutionState,
  feedAwakeningEnergy,learnAwakening,normalizeBurstEvolution,addTranscendStar,setAwakeningAppearance,clearAwakeningShown,partnerAwakenings,
  forgetBurstUnlocks} from '../src/championship/contracts/productBurstEvolution.js';
import {TRAINING_POINT_SCALE,TRAINING_KIND_OF_CONDITION,REALTIME_TRAINING_POLICY,recommendedCages,realtimeTrainingDue,beginRealtimeTraining,
  cageEntryTrains} from '../src/championship/raising/productTrainingPolicy.js';
import {applyNativeTrainingCommand} from '../src/championship/raising/nativeRaisingTraining.js';
import {NATIVE_RAISING_LIFECYCLE_RULES} from '../src/championship/raising/nativeRaisingLifecycle.js';
import {normalizeCyberGacha} from '../src/championship/gacha/cyberGacha.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {createNativeRaisingStarter} from '../src/championship/raising/nativeRaisingStarter.js';
import {restoreChannelRng} from '../src/championship/battle/battleRngChannel.js';
import {relayKit} from '../src/championship/modes/dataArena/dataArenaRelay.js';
import {createDataArenaSimulation} from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import {createBattleBurst,BATTLE_BURST_V1,BATTLE_BURST_FRAMES,BATTLE_BURST_WRAP_FRAMES,BATTLE_BURST_CHAIN_FRAMES,
  BATTLE_BURST_WEAK_FRAMES} from '../src/championship/battle/battleBurst.js';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const care = read('docs/research/RAISING_CARE_CPU_CHECK_2026-09-08.json');
const profileOf = (index, change = {}, narrow = {}) => {
  const p = structuredClone(createNativeRaisingStarter(restoreChannelRng(care.starterRng)));
  p.fields['000'] = index; Object.assign(p.fields, change); Object.assign(p.narrowFields, narrow); return p;
};
// A 成熟期 whose tier-2 form needs a rebirth (the rebirth gate) and one tier-1 form.
const rebirthBase = (() => {
  for (let base = 0; base < species.records.length; base++)
    if (burstFormsFor(base).some(f => f.tier === 2 && f.thresholds[24] >= 1)) return base;
  return null;
})();

test('progress: raised share plus item energy (shards and SSR at most 60, a UR fills); gates hold on their own', () => {
  const base = 72, t1 = burstFormsFor(base).find(f => f.tier === 1), t2 = burstFormsFor(base).find(f => f.tier === 2);
  const empty = profileOf(base, {'024': 0, '028': 0, '104': 0, '108': 0, '100': 0, '10c': 0, '110': 0, '114': 0, '118': 0, '11c': 0, '120': 0, '124': 0, '128': 0});
  const none = awakeningProgress(empty, t1);
  assert.equal(none.percent, 0);
  assert.equal(none.ready, false);
  assert.equal(awakeningProgress(empty, t1, {energy: 50}).percent, 50);
  assert.equal(awakeningProgress(empty, t1, {energy: 90}).percent, AWAKENING_RULES.itemCap, 'items stop at the cap');
  const filled = awakeningProgress(empty, t1, {energy: 100});
  assert.equal(filled.percent, 100);
  assert.equal(filled.ready, true, 'a UR metal fills a tier-1 form');
  assert.equal(filled.glow, true);
  const raised = awakeningProgress(profileOf(base, {'024': 40, '028': 30, '114': 99, '110': 99, '10c': 99}), t1);
  assert.equal(raised.percent, 100);
  assert.equal(raised.ready, true, 'raised by its own conditions');
  assert.equal(awakeningProgress(profileOf(base, {'024': 40, '028': 30, '114': 99, '110': 99, '10c': 99}), t1, {learned: [t1.form]}).ready, false, 'a learned form is not ready again');
  if (t2) {
    const tier2 = awakeningProgress(empty, t2, {energy: 100});
    assert.equal(tier2.viaMet, false);
    assert.equal(tier2.ready, false, 'tier 2 waits for its tier-1 form');
    assert.equal(awakeningProgress(empty, t2, {energy: 100, learned: [t2.via]}).ready, true);
  }
});

test('the rebirth gate: transcendence stars count as rebirths, a UR waives it, shards cannot buy it', () => {
  assert.ok(rebirthBase !== null, 'some 成熟期 has a tier-2 form that needs a rebirth');
  const t2 = burstFormsFor(rebirthBase).find(f => f.tier === 2 && f.thresholds[24] >= 1), need = t2.thresholds[24];
  const maxed = profileOf(rebirthBase, Object.fromEntries([['024', 999], ['028', 999], ...BURST_CONDITION_IDS.map((id, i) =>
    [['104', '108', '100', '10c', '110', '114', '118', '124', '120', '128', '11c'][i], 999])]), {'03c': 0});
  const raisedOnly = awakeningProgress(maxed, t2, {learned: [t2.via], energy: 60});
  assert.equal(raisedOnly.percent, 100);
  assert.equal(raisedOnly.ready, false, 'every other row met, still no rebirth');
  const gate = raisedOnly.gates.find(row => row.id === 'REBIRTH_COUNT');
  assert.equal(gate.met, false);
  assert.equal(awakeningProgress(maxed, t2, {learned: [t2.via], stars: need}).ready, true, `${need} stars stand in for ${need} rebirths`);
  assert.equal(awakeningProgress(maxed, t2, {learned: [t2.via], stars: need - 1}).ready, false);
  assert.equal(awakeningProgress(maxed, t2, {learned: [t2.via], waived: true}).ready, true, 'a UR waiver lifts it');
  let state = createBurstEvolutionState();
  for (let i = 0; i < AWAKENING_RULES.transcendence.maxStars; i++) state = addTranscendStar(state, 'p');
  assert.equal(state.stars.p, AWAKENING_RULES.transcendence.maxStars);
  assert.equal(addTranscendStar(state, 'p'), null, 'at most five stars');
});

test('memory halves point and battle thresholds; win rate and rebirths stay', () => {
  const base = 72, t1 = burstFormsFor(base).find(f => f.tier === 1 && f.thresholds.slice(0, 11).some(Boolean));
  const point = t1.thresholds.slice(0, 11).findIndex(Boolean);
  const field = ['104', '108', '100', '10c', '110', '114', '118', '124', '120', '128', '11c'][point];
  const half = Math.ceil(t1.thresholds[point] / 2);
  const profile = profileOf(base, {[field]: half, '024': 99, '028': 99});
  assert.ok(awakeningProgress(profile, t1).percent < 100);
  const remembered = awakeningProgress(profile, t1, {remembered: true});
  assert.equal(remembered.rows.find(r => r.id === BURST_CONDITION_IDS[point]).value, half);
  assert.equal(remembered.remembered, true);
});

test('energy, learning, display, appearance and the record round trip', () => {
  const base = 72, [t1] = burstFormsFor(base).filter(f => f.tier === 1);
  let state = feedAwakeningEnergy(createBurstEvolutionState(), 'p', t1.form, {amount: 50});
  state = feedAwakeningEnergy(state, 'p', t1.form, {amount: 25});
  assert.equal(state.energy.p[t1.form], AWAKENING_RULES.itemCap);
  assert.equal(feedAwakeningEnergy(state, 'p', t1.form, {amount: 8}), null, 'full');
  state = feedAwakeningEnergy(state, 'p', t1.form, {fill: true});
  assert.equal(state.energy.p[t1.form], 100);
  assert.deepEqual([...state.waived.p], [t1.form]);
  state = learnAwakening(state, 'p', t1.form, {shownUntil: 1000});
  assert.ok(state.unlocks.p.includes(t1.form));
  assert.ok(state.memory.includes(t1.form));
  assert.equal(state.energy, undefined, 'its energy is spent');
  assert.equal(awakeningDisplayFor(state, 'p', base, 999), t1.form, 'shown during its ten minutes');
  assert.equal(awakeningDisplayFor(state, 'p', base, 1000), null, 'then the 成熟期 again');
  assert.equal(awakeningDisplayFor(state, 'p', 8, 999), null, 'a reborn partner is not shown as it');
  state = setAwakeningAppearance(state, 'p', t1.form);
  state = clearAwakeningShown(state, 'p');
  assert.equal(awakeningDisplayFor(state, 'p', base, 5000), t1.form, 'its chosen look stays');
  assert.equal(setAwakeningAppearance(state, 'p', 999), null, 'only a learned form');
  assert.deepEqual(normalizeBurstEvolution(JSON.parse(JSON.stringify(state))), state, 'saves and loads');
  assert.deepEqual(normalizeBurstEvolution({version: 1, unlocks: {q: [t1.form]}, migrated: true}).version, 2, 'version 1 records load');
  assert.throws(() => normalizeBurstEvolution({...state, stars: {p: 9}}), /INVALID_BURST_EVOLUTION/);
  assert.throws(() => normalizeBurstEvolution({...state, appearance: {p: burstFormsFor(base).find(f => f.tier === 2).form}}), /INVALID_BURST_EVOLUTION/);
  assert.equal(forgetBurstUnlocks(state, 'p').unlocks.p, undefined);
});

test('focus: the chosen target, else the first form it can work toward', () => {
  const base = 72, profile = profileOf(base), state = createBurstEvolutionState();
  const awakenings = partnerAwakenings(profile, state, 'p');
  assert.equal(awakeningFocus(awakenings).tier, 1);
  const other = awakenings.filter(a => a.tier === 1)[1];
  if (other) assert.equal(awakeningFocus(awakenings, other.form).form, other.form);
});

test('training: every point family trains up to the same best gain; cages are recommended best first', () => {
  for (const [id, kind] of Object.entries(TRAINING_KIND_OF_CONDITION)) {
    const cages = recommendedCages(id);
    assert.ok(cages.length, id);
    assert.equal(cages[0].gain, 10, `${id}: its best cage gives +10`);
    for (let i = 1; i < cages.length; i++) assert.ok(cages[i].gain <= cages[i - 1].gain);
    assert.ok(cages.every(c => c.definition !== 35), 'never the waiting room');
    assert.ok(TRAINING_POINT_SCALE[kind] >= 1);
  }
  // The scale applies to the writer only when the real-time ranch passes it.
  const profile = profileOf(72, {'128': 0});
  const rng = {next: () => 0};
  const nativeGain = applyNativeTrainingCommand(profile, {kind: 10, delta: 5, season: 0}, rng);
  const levelled = applyNativeTrainingCommand(profile, {kind: 10, delta: 5, season: 0, pointScale: TRAINING_POINT_SCALE}, rng);
  assert.equal(levelled.profile.fields['128'] - profile.fields['128'], Math.round(nativeGain.delta * TRAINING_POINT_SCALE[10]));
  assert.ok(levelled.profile.fields['128'] > nativeGain.profile.fields['128'], 'the dark family trains faster than its native +5');
  assert.equal(NATIVE_RAISING_LIFECYCLE_RULES.cages.length >= 35, true);
});

test('training clock: entering cages trains once per cooldown, staying trains every dwell period, a match adds one', () => {
  const policy = REALTIME_TRAINING_POLICY, actor = {};
  const frames = (n, flags = {healthy: true, trainingCage: true}) => { let due = false; for (let i = 0; i < n && !due; i++) due = realtimeTrainingDue(actor, policy, flags); return due; };
  assert.equal(cageEntryTrains(actor), true, 'a partner that never trained trains on entry');
  beginRealtimeTraining(actor, policy);
  assert.equal(cageEntryTrains(actor), false, 'moving it back and forth earns nothing during the cooldown');
  assert.equal(frames(policy.dwellFrames - 1), false);
  assert.equal(frames(1), true, 'five minutes in the cage: it trains again');
  beginRealtimeTraining(actor, policy);
  assert.equal(cageEntryTrains(actor), false);
  assert.equal(frames(policy.dwellFrames, {healthy: false, trainingCage: true}), false, 'a sick partner does not train');
  beginRealtimeTraining(actor, policy);
  actor.trainingDue = true;
  assert.equal(frames(policy.dueMinimumFrames - 1, {healthy: true, trainingCage: false}), false, 'not within a minute of its last training');
  assert.equal(frames(1, {healthy: true, trainingCage: false}), true, 'after a match it trains once');
  assert.equal(policy.cooldownFrames, AWAKENING_RULES && 300 * 60);
});

function harness(clock) {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: species, clockPolicy: 'REALTIME_V1', gachaRandom: () => 0.5,
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => new Date(clock.ms).toISOString()});
  return {data, cages, make};
}

test('the app: feed shards and metals, the ceremony teaches the form, the look switches, rebirth keeps it', async () => {
  const clock = {ms: new Date(2026, 10, 2, 13, 0).getTime()};
  const {data, cages, make} = harness(clock);
  const first = make();
  await first.newGame();
  first.save();
  const saved = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  // Five 成熟期 partners with nothing learned yet, a pile of metals, and one partner with a high bond.
  saved.progression.burstEvolution = {version: 2, unlocks: {}, migrated: true};
  saved.progression.cyberGacha = {...normalizeCyberGacha(saved.progression.cyberGacha ?? null), welcome: true,
    metals: {'metal:beta-shard': 3, 'metal:emma': 4, 'metal:chrono-ore': 1, 'metal:supernova': 1}};
  const [p, q] = saved.raising.collection;
  p.nativeProfile.fields['020'] = 95; q.nativeProfile.fields['020'] = 10;
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(saved));
  const app = make();
  await app.continueGame();
  try {
    const id = p.instanceId, view = app.getPartnerAwakening(id);
    assert.ok(view?.forms.length, 'a 成熟期 has an awakening path');
    assert.equal(view.forms.find(f => f.form === view.focus).tier, 1, 'tier 1 first');
    assert.ok(view.forms.find(f => f.form === view.focus).rows.every(row => Array.isArray(row.cages)));
    assert.ok(view.feeds.some(f => f.itemId === 'metal:beta-shard' && f.amount === AWAKENING_RULES.shardEnergy.R));
    const focus = view.focus;
    let fed = app.feedAwakening(id, 'metal:beta-shard');
    assert.equal(fed.ok, true, fed.reason);
    assert.equal(fed.amount, 8);
    fed = app.feedAwakening(id, 'metal:emma');
    assert.equal(fed.amount, 50);
    assert.equal(app.getPartnerAwakening(id).feeds.find(f => f.itemId === 'metal:emma').amount, 2, 'near the cap the button says what it really adds');
    fed = app.feedAwakening(id, 'metal:emma');
    assert.equal(fed.amount, 2, 'and so does the receipt');
    assert.deepEqual({...app.getCyberGachaFrame().metals.find(m => m.id === 'metal:emma').awaken}, {fill: false, tier1: 50, tier2: 30, cap: 60});
    assert.deepEqual({...app.getCyberGachaFrame().metals.find(m => m.id === 'metal:supernova').awaken}, {fill: true, tier1: 100, tier2: 100, cap: 60});
    assert.equal(app.getPartnerAwakening(id).forms.find(f => f.form === focus).energy, AWAKENING_RULES.itemCap, 'shards and SSR stop at 60');
    assert.equal(app.feedAwakening(id, 'metal:beta-shard').reason, 'AWAKENING_ENERGY_FULL');
    assert.equal(app.getPartnerBloodline(id)?.family, 'emma', 'an SSR metal inscribes its bloodline');
    // A UR metal fills the form; the partner waits for the player to tap its sign.
    fed = app.feedAwakening(id, 'metal:chrono-ore');
    assert.equal(fed.ok, true, fed.reason);
    assert.equal(fed.fill, true);
    assert.equal(fed.ready, true);
    assert.equal(app.getAwakeningSigns()[id]?.ready, true);
    assert.ok(!app.getPartnerBurst(id).some(f => f.form === focus && f.unlocked), 'not learned before its ceremony');
    const ceremony = app.awakenPartner(id);
    assert.equal(ceremony.ok, true, ceremony.reason);
    assert.equal(ceremony.form, focus);
    assert.equal(ceremony.bloodline.family, 'chronoOre');
    assert.ok(app.getPartnerBurst(id).some(f => f.form === focus && f.unlocked), 'learned');
    assert.ok(app.getDataArenaProgress().registeredSpecies.some(s => s === focus || s === `species-${String(focus).padStart(3, '0')}`), 'in the encyclopedia');
    assert.equal(app.getRaisingDisplaySpecies(id), focus, 'shown on the ranch after its ceremony');
    clock.ms += AWAKENING_RULES.ceremonyDisplaySeconds * 1000 + 1;
    assert.equal(app.getRaisingDisplaySpecies(id), null, 'then the 成熟期 again');
    assert.equal(app.setPartnerAppearance(id, focus).ok, true);
    assert.equal(app.getRaisingDisplaySpecies(id), focus, 'its chosen look stays');
    assert.equal(app.setPartnerAppearance(id, null).ok, true);
    assert.equal(app.getRaisingDisplaySpecies(id), null);
    const plan = app.getBattleBurstPlan(id);
    assert.equal(plan.form, focus);
    assert.equal(plan.bloodline, 'chronoOre');
    assert.equal(plan.bond, 100, 'the metals also raised its bond (95 + 9 + 9, capped)');
    // Core transcendence needs the bond and a full metal.
    assert.equal(app.transcendPartner(q.instanceId, 'metal:emma').reason, 'BOND_TOO_LOW');
    const star = app.transcendPartner(id, 'metal:emma');
    assert.equal(star.ok, true, star.reason);
    assert.equal(star.stars, 1);
    // Tier 2 comes through the tier-1 form; a UR fills it and its ceremony plays through the tier-1 form.
    const tier2 = app.getPartnerAwakening(id).forms.find(f => f.tier === 2 && f.via === focus);
    if (tier2) {
      assert.equal(app.setAwakeningTarget(id, tier2.form).ok, true);
      assert.equal(app.feedAwakening(id, 'metal:supernova').fill, true);
      const second = app.awakenPartner(id);
      assert.equal(second.form, tier2.form);
      assert.equal(second.via, focus, 'the tier-2 ceremony passes through its tier-1 form');
      assert.equal(app.getBattleBurstPlan(id).via, focus);
    }
    app.save();
    const stored = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).progression.burstEvolution;
    assert.equal(stored.version, 2);
    assert.ok(stored.memory.includes(focus));
    assert.equal(stored.stars[id], 1);
    // Rebirth keeps what it learned.
    const reborn = app.rebirthRaisingPartner(id);
    if (reborn.ok) {
      app.save();
      assert.ok(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).progression.burstEvolution.unlocks[id].includes(focus), 'rebirth keeps learned forms');
    }
  } finally { await app.dispose(); }
});

// ---- battle: manual call, pinch and bond, bloodline perks, the tier-2 chain ----

const slot = (hp = 100, maxHp = 100) => ({currentHp: hp, maxHp, field28: 50});
function fill(burst, slots, frame = 1) { burst.onHit({attackerSlot: 0, defenderSlot: 1, damage: 100, defenderMaxHp: 100, defenderHp: 50}); return burst.step(frame, slots); }
function run(burst, slots, from, frames) { const events = []; for (let f = from; f < from + frames; f++) { if (burst.holding()) events.push(...burst.hold(f)); else events.push(...burst.step(f, slots)); } return events; }

// Owner 2026-11-08 (BURST_TRUE_FORM_20261108): the player's burst goes only on the player's press.
test('battle: a manual plan waits READY for the call, never bursting by itself on a timer or in a pinch', () => {
  const slots = [slot(), slot()];
  let burst = createBattleBurst({policy: BATTLE_BURST_V1, plans: [{form: 137, tier: 1, manual: true}, null]});
  assert.deepEqual(fill(burst, slots).map(e => e.kind), ['READY']);
  assert.equal(burst.snapshot(0, 1).phase, 'READY');
  assert.equal(burst.request(1), false, 'only a waiting slot');
  assert.equal(burst.request(0), true);
  assert.equal(burst.step(2, slots)[0].kind, 'WRAP', 'the call starts the wrap');
  burst = createBattleBurst({policy: BATTLE_BURST_V1, plans: [{form: 137, tier: 1, manual: true}, null]});
  fill(burst, slots);
  assert.equal(run(burst, slots, 2, 60 * 60).some(e => e.kind === 'WRAP'), false, 'a minute later it still waits');
  assert.equal(burst.snapshot(0, 3600).phase, 'READY');
  burst = createBattleBurst({policy: BATTLE_BURST_V1, plans: [{form: 137, tier: 1, manual: true}, null]});
  fill(burst, slots);
  slots[0].currentHp = 20;
  assert.deepEqual(burst.step(3, slots), [], 'below 30 % HP it still waits for the call');
  slots[0].currentHp = 0;
  assert.equal(burst.step(4, slots)[0].kind, 'REVERT_DOWN', 'a partner that goes down never bursts');
  const auto = createBattleBurst({policy: BATTLE_BURST_V1, plans: [{form: 137, tier: 1}, null]});
  assert.equal(fill(auto, [slot(), slot()])[0].kind, 'WRAP', 'opponents and headless runs burst at once');
});

test('battle: damage taken in a pinch and a high bond fill the gauge faster', () => {
  const plain = createBattleBurst({policy: BATTLE_BURST_V1, plans: [null, {form: 137, tier: 1}]});
  plain.onHit({attackerSlot: 0, defenderSlot: 1, damage: 10, defenderMaxHp: 100, defenderHp: 60});
  const pinch = createBattleBurst({policy: BATTLE_BURST_V1, plans: [null, {form: 137, tier: 1}]});
  pinch.onHit({attackerSlot: 0, defenderSlot: 1, damage: 10, defenderMaxHp: 100, defenderHp: 20});
  assert.equal(plain.snapshot(1).gauge, 20);
  assert.equal(pinch.snapshot(1).gauge, 30, 'x1.5 below 30 % HP');
  const bonded = createBattleBurst({policy: BATTLE_BURST_V1, plans: [null, {form: 137, tier: 1, bond: 100}]});
  bonded.onHit({attackerSlot: 0, defenderSlot: 1, damage: 10, defenderMaxHp: 100, defenderHp: 60});
  assert.equal(bonded.snapshot(1).gauge, 24, 'full bond: +20 %');
  const emma = createBattleBurst({policy: BATTLE_BURST_V1, plans: [null, {form: 137, tier: 1, bloodline: 'emma'}]});
  emma.onHit({attackerSlot: 0, defenderSlot: 1, damage: 10, defenderMaxHp: 100, defenderHp: 60});
  assert.equal(emma.snapshot(1).gauge, 24, '艾瑪: +20 %');
  assert.equal(plain.snapshot(1).warn, false);
  plain.onHit({attackerSlot: 0, defenderSlot: 1, damage: 30, defenderMaxHp: 100, defenderHp: 60});
  assert.equal(plain.snapshot(1).warn, true, 'a gauge from 80 warns the other side');
});

test('battle: bloodline perks -- no weakness, a longer burst, a heal, a quicker cooldown, a higher multiplier', () => {
  const burstOf = bloodline => { const b = createBattleBurst({policy: BATTLE_BURST_V1, plans: [{form: 137, tier: 1, bloodline}, null]}), slots = [slot(), slot()];
    fill(b, slots); const events = run(b, slots, 2, BATTLE_BURST_WRAP_FRAMES + 1); return {b, slots, events}; };
  const beta = burstOf('beta'), plain = burstOf(null);
  assert.equal(beta.b.snapshot(0).phase, 'BURST');
  run(beta.b, beta.slots, 100, BATTLE_BURST_FRAMES + 2);
  run(plain.b, plain.slots, 100, BATTLE_BURST_FRAMES + 2);
  assert.equal(beta.b.snapshot(0).phase, 'SPENT', '貝塔: no weakness');
  assert.equal(plain.b.snapshot(0).phase, 'WEAK');
  assert.equal(burstOf('chronoOre').b.snapshot(0).burstFrames, BATTLE_BURST_FRAMES + 240, '時晶: +4 s');
  assert.equal(burstOf('chronoMetal').events.find(e => e.kind === 'BURST').healPercent, 15, '時鋼: heals 15 %');
  const alloy = burstOf('chronoAlloy');
  run(alloy.b, alloy.slots, 200, 20);
  assert.equal(alloy.slots[0].field28, 47, '時輪: three extra cooldown frames in twenty');
  const nova = burstOf('supernova');
  assert.equal(nova.b.scaleDamage({attackerSlot: 0, defenderSlot: 1, damage: 100}), 150, '星核: x1.5 instead of x1.4');
  assert.equal(plain.b.scaleDamage({attackerSlot: 0, defenderSlot: 1, damage: 100}) <= 140, true);
  void BATTLE_BURST_WEAK_FRAMES;
});

test('battle: a tier-2 burst plays through its tier-1 form', () => {
  const b = createBattleBurst({policy: BATTLE_BURST_V1, plans: [{form: 203, tier: 2, via: 137}, null]}), slots = [slot(), slot()];
  fill(b, slots);
  assert.equal(b.snapshot(0).wrapFrames, BATTLE_BURST_WRAP_FRAMES + BATTLE_BURST_CHAIN_FRAMES);
  const shown = [];
  for (let f = 0; f < BATTLE_BURST_WRAP_FRAMES + BATTLE_BURST_CHAIN_FRAMES; f++) { shown.push(b.display(0)); b.hold(10 + f); }
  assert.equal(shown[0], null, 'the 成熟期 while wrapped');
  assert.ok(shown.includes(137), 'its tier-1 form between the two flashes');
  assert.equal(b.display(0), 203);
});

test('arena relay: a ranch partner bursts into its own form, waits for the call, and carries its bloodline', () => {
  const t1 = burstFormsFor(87).find(f => f.tier === 1), t2 = burstFormsFor(87).find(f => f.tier === 2);
  const plan = t2 ? {form: t2.form, tier: 2, via: t2.via, bloodline: 'chronoMetal', bond: 50} : {form: t1.form, tier: 1, bloodline: 'chronoMetal'};
  const relay = (plans, manual = true) => createDataArenaSimulation({mode: 'RELAY', partnerId: 'relay-species-087', relayReserveId: 'relay-species-096',
    relayArenaId: 'field_bm02_01', seed: 5, relayBurstPlans: plans, relayManualBurst: manual});
  const sim = relay({'relay-species-087': plan});
  assert.equal(sim.getSnapshot().relay.burst.form, plan.form, 'its own learned form');
  let ready = false;
  for (let i = 0; i < 60 * 150 && !ready; i++) { sim.step({}); ready = sim.drainEvents().some(e => e.type === 'BURST_READY' && e.side === 'player'); }
  assert.ok(ready, 'the gauge fills and waits for the call');
  assert.equal(sim.getSnapshot().relay.burst.phase, 'READY');
  // Owner 2026-11-08: no countdown -- it still waits ten seconds later, even in a pinch.
  const before = sim.getState().player;
  const ownKit = [...before.kit.moves], ownMax = before.maxHp, ownSpecies = before.speciesId;
  for (let i = 0; i < 600; i++) sim.step({});
  assert.equal(sim.getSnapshot().relay.burst.phase, 'READY');
  assert.equal(sim.getState().player.formPartnerId, null);
  sim.step({burst: true});
  const burst = sim.drainEvents().find(e => e.type === 'BURST' && e.side === 'player');
  assert.ok(burst, 'the call bursts at once');
  assert.equal(burst.bloodline, 'chronoMetal');
  assert.equal(burst.via, plan.via ?? null, 'a tier-2 form plays through its tier-1 form');
  assert.equal(sim.getSnapshot().relay.burst.phase, 'BURST');
  // Burst true form (BURST_TRUE_FORM_20261108): it fights as the form, not in its costume.
  const formId = `relay-species-${String(plan.form).padStart(3, '0')}`, fighter = sim.getState().player;
  assert.equal(fighter.formPartnerId, formId);
  assert.equal(fighter.speciesId, `species-${String(plan.form).padStart(3, '0')}`);
  assert.deepEqual(fighter.kit.moves, relayKit(formId, undefined).moves, 'the form brings its own moves');
  assert.notDeepEqual(fighter.kit.moves, ownKit);
  assert.ok(fighter.maxHp > ownMax, 'and its own HP');
  assert.equal(fighter.partnerId, 'relay-species-087', 'the seat is still the ranch partner');
  for (let i = 0; i < 60 * 40 && sim.getSnapshot().relay.burst.phase === 'BURST'; i++) sim.step({});
  const back = sim.getState().player;
  assert.notEqual(sim.getSnapshot().relay.burst.phase, 'BURST');
  assert.deepEqual([back.formPartnerId, back.speciesId, back.maxHp, [...back.kit.moves]], [null, ownSpecies, ownMax, ownKit], 'itself again afterwards');
  assert.equal(relay({'relay-species-087': null}).getSnapshot().relay.burst, null, 'a partner that learned no form does not burst');
  assert.equal(relay({}).getSnapshot().relay.burst.form, t1.form, 'a Dex-only entry keeps its first tier-1 form');
});


test('the bag explains each metal by the current rules: awakening energy on a 成熟期 and its bloodline perk by name', async () => {
  const {gachaMetalNote, awakeningEnergySummary} = await import('../src/championship/app/cyberGachaView.js');
  const {GACHA_METALS} = await import('../src/championship/gacha/cyberGacha.js');
  const {awakeningItemEnergy} = await import('../src/championship/contracts/productBurstEvolution.js');
  const item = id => {
    const metal = GACHA_METALS.find(m => m.id === id), t1 = awakeningItemEnergy(metal, 1), t2 = awakeningItemEnergy(metal, 2);
    return {...metal, kind: 'METAL', awaken: {fill: t1.fill, tier1: t1.amount, tier2: t2.amount, cap: AWAKENING_RULES.itemCap}};
  };
  const ur = gachaMetalNote(item('metal:supernova'));
  assert.match(ur, /星核：爆裂威力更強/, 'the bloodline is named with its perk');
  assert.match(ur, /一次充滿，並免除轉生條件/);
  for (const id of GACHA_METALS.map(m => m.id)) assert.doesNotMatch(gachaMetalNote(item(id)), /解鎖/, `${id}: no stale unlock wording`);
  assert.match(gachaMetalNote(item('metal:emma')), /\+50%（二段 \+30%），道具最多補到 60%/);
  assert.match(gachaMetalNote(item('metal:supernova-shard')), /星核.*\+25%，道具最多補到 60%/);
  const shard = gachaMetalNote(item('metal:emma-shard'));
  assert.match(shard, /幼年期.*\+8%/);
  assert.doesNotMatch(shard, /銘刻/, 'an R shard inscribes no bloodline');
  assert.equal(awakeningEnergySummary({kind: 'AWAKEN_ENERGY', amount: 2, percent: 60}), '覺醒能量 +2%（目前 60%）');
  assert.match(awakeningEnergySummary({kind: 'AWAKEN_ENERGY', amount: 100, fill: true, ready: true}), /到牧場點拍檔/);
});
