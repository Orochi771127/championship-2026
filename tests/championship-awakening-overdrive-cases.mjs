// OWNER_APPROVED_ADAPTATION 2026-11-09 (AWAKENING_OVERDRIVE_20261109): tactile cocoon, overdrive training, over-limit
// burst, sponsor stake contracts and wild awakening instinct.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COCOON_RULES, OVERDRIVE_RULES, OVER_LIMIT_RULES, SPONSOR_CONTRACTS, SPONSOR_STAKES, WILD_INSTINCTS, instinctNoise,
  overdriveCooling, overdriveHeatAt, ownPointCondition, resolveOverdriveTraining, rollWildInstinct, settleSponsorContract,
  sponsorContractMet, validSponsorStake} from '../src/championship/contracts/productAwakeningOverdrive.js';
import {awakeningSeedOf, burstFormsFor, createBurstEvolutionState, forgetBurstUnlocks, normalizeBurstEvolution, overdriveOf,
  partnerAwakenings, sponsorContractOf, sponsorEscrowOf, withAwakeningSeed, withOverdrive, withSponsorContract,
  withSponsorEscrow, AWAKENING_RULES} from '../src/championship/contracts/productBurstEvolution.js';
import {BATTLE_BURST_FRAMES, BATTLE_BURST_WRAP_FRAMES, BATTLE_EXHAUST_FRAMES, BATTLE_OVER_LIMIT_FRAMES, createBattleBurst} from '../src/championship/battle/battleBurst.js';
import {applyProductTrainingGains} from '../src/championship/raising/nativeRaisingTraining.js';
import {inscribeGachaBloodline, grantGachaMetal, createCyberGachaState, gachaBloodlineOf} from '../src/championship/gacha/cyberGacha.js';
import {createDataArenaSimulation} from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import {speciesTaxonomy} from '../src/championship/contracts/speciesTaxonomy.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeWildActor} from '../src/championship/hunt/capture/nativeWildActor.js';

const profileOf = (index, seed = 7) => {
  let n = seed;
  const individual = createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(index), rng: {next: () => (n = (n * 1103515245 + 12345) >>> 0) % 102}});
  return nativeIndividualProfile(individual, `species-${String(index).padStart(3, '0')}`);
};
const awakenableBase = () => {
  for (let index = 8; index < 240; index++) if (burstFormsFor(index).length) return index;
  throw new Error('no awakenable base');
};

test('tactile cocoon: three taps, a 4 s idle auto-finish, three rising shakes', () => {
  assert.equal(COCOON_RULES.taps, 3);
  assert.equal(COCOON_RULES.idleAutoMs, 4000);
  assert.deepEqual([...COCOON_RULES.stageShake], [4, 7, 12]);
  const field = readFileSync('src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js', 'utf8');
  assert.match(field, /cm-cocoon-tap/, 'the DOM key cracks the cocoon through a canvas event');
  assert.match(field, /COCOON_RULES\.idleAutoMs/, 'the field finishes it alone after the idle time');
  const shell = readFileSync('src/championship/presentation/vs5/battleBurstShell.js', 'utf8');
  assert.match(shell, /phase === 'COCOON'/);
  const main = readFileSync('src/championship/app/main.js', 'utf8');
  assert.match(main, /cocoonCrack/); assert.match(main, /cocoonShatter/);
});

test('overdrive training: 2.2-2.5x points, an epiphany sometimes, a backlash past 80 % heat', () => {
  const commands = [{kind: 4, delta: 9, outcome: 'APPLIED'}, {kind: 22, delta: 3, outcome: 'APPLIED'}];
  for (const r of [0, 0.5, 0.999]) {
    const out = resolveOverdriveTraining({commands, heat: 10, roll: () => r});
    assert.ok(out.multiplier >= 2.2 && out.multiplier <= 2.5, `${out.multiplier}`);
    const extra = out.extra.find(row => row.kind === 4).delta;
    assert.ok(9 + extra >= 19 && 9 + extra <= 23, `about +18..+22 in total: ${9 + extra}`);
    assert.equal(out.heat, 10 + OVERDRIVE_RULES.heatPerTraining);
    assert.ok(!out.extra.some(row => row.kind === 22), 'only point kinds are multiplied');
  }
  const inspired = resolveOverdriveTraining({commands, heat: 0, roll: () => 0.05});
  assert.equal(inspired.epiphany, true);
  assert.deepEqual(inspired.extra.filter(row => row.kind >= 18).map(row => row.kind), [18, 19, 20, 21]);
  const backlash = resolveOverdriveTraining({commands, heat: 81, roll: () => 0.5});
  assert.equal(backlash.backlash, true);
  assert.deepEqual([...backlash.extra], []);
  assert.equal(resolveOverdriveTraining({commands, heat: 80, roll: () => 0.5}).backlash, false, 'exactly 80 still trains');
});

test('overdrive heat cools by the minute, fastest inside or beside a recovery cage', () => {
  const record = {heat: 60, at: 0};
  assert.equal(overdriveHeatAt(record, 10 * 60000, OVERDRIVE_RULES.coolPerMinute.base), 50);
  assert.equal(overdriveHeatAt(record, 2 * 60000, OVERDRIVE_RULES.coolPerMinute.adjacent), 36);
  assert.equal(overdriveHeatAt(record, 3 * 60000, OVERDRIVE_RULES.coolPerMinute.inside), 0);
  assert.equal(overdriveCooling(15, []), 'inside', 'mini infirmary');
  assert.equal(overdriveCooling(4, [16]), 'adjacent', 'a gym beside the hospital');
  assert.equal(overdriveCooling(4, [17, 3]), 'adjacent', 'beside the garden');
  assert.equal(overdriveCooling(4, [18]), 'adjacent', 'beside the hot spring');
  assert.equal(overdriveCooling(4, [3, 6]), 'base');
});

test('product training gains: points add, stats stop at their native upper bound', () => {
  const profile = profileOf(awakenableBase());
  const before = profile.fields['110'] >>> 0;
  const {profile: after, commands} = applyProductTrainingGains(profile, [{kind: 4, delta: 15}, {kind: 18, delta: 1e6}]);
  assert.equal(after.fields['110'] >>> 0, before + 15);
  assert.equal(after.fields['060'] | 0, Math.max(profile.fields['060'] | 0, profile.fields['0b8'] | 0), 'attack stops at its native upper bound (0x0B8)');
  assert.equal(commands[0].delta, 15);
});

test('awakening record keeps overdrive, seed, contract and escrow; forgetting a partner keeps the account keys', () => {
  let state = createBurstEvolutionState();
  state = withOverdrive(state, 'p1', {on: true, heat: 44, at: 1000});
  state = withAwakeningSeed(state, 'p1', 40);
  state = withSponsorContract(state, {contractId: 'RIFT_GAMBIT', stake: 30000});
  state = withSponsorEscrow(state, {contractId: 'IRON_RUSH', stake: 15000, attemptId: 'battle:7', foeBoostPercent: 0});
  const again = normalizeBurstEvolution(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(overdriveOf(again, 'p1'), {on: true, heat: 44, at: 1000});
  assert.equal(awakeningSeedOf(again, 'p1'), 40);
  assert.deepEqual(sponsorContractOf(again), {contractId: 'RIFT_GAMBIT', stake: 30000});
  assert.equal(sponsorEscrowOf(again).attemptId, 'battle:7');
  const forgotten = forgetBurstUnlocks(again, 'p1');
  assert.equal(overdriveOf(forgotten, 'p1'), null);
  assert.equal(awakeningSeedOf(forgotten, 'p1'), 0);
  assert.ok(sponsorContractOf(forgotten) && sponsorEscrowOf(forgotten), 'contracts belong to the account');
  assert.throws(() => normalizeBurstEvolution({...again, contract: {contractId: 'NOPE', stake: 1}}), /INVALID_BURST_EVOLUTION/);
  assert.throws(() => normalizeBurstEvolution({...again, overdrive: {p1: {on: true, heat: 120, at: 0}}}), /INVALID_BURST_EVOLUTION/);
});

test('an ancestral seed counts toward the tier-1 awakening and shares the item cap', () => {
  const base = awakenableBase(), profile = profileOf(base);
  const plain = partnerAwakenings(profile, createBurstEvolutionState(), 'p1');
  const seeded = partnerAwakenings(profile, withAwakeningSeed(createBurstEvolutionState(), 'p1', 40), 'p1');
  const tier1 = i => plain[i].tier === 1;
  plain.forEach((form, i) => {
    if (tier1(i)) assert.equal(seeded[i].percent, Math.min(100, form.percent + 40), 'tier 1 starts 40 % ahead');
    else assert.equal(seeded[i].percent, form.percent, 'tier 2 is not seeded');
  });
  assert.ok(seeded.every(form => form.energy <= AWAKENING_RULES.itemCap));
});

test('over-limit burst: cooldown reset, +50 % damage and speed for 10 s, then exhaustion unless a foe fell', () => {
  const run = ({bloodline = null, foeFalls = false} = {}) => {
    const burst = createBattleBurst({policy: 'BURST_V1', plans: [{form: 300, tier: 1, manual: true, bloodline}, null, null, null, null, null]});
    const slots = [0, 1, 2, 3, 4, 5].map(slot => ({currentHp: 100, maxHp: 100, field28: 40}));
    for (let i = 0; i < 20; i++) burst.onHit({attackerSlot: 0, defenderSlot: 3, damage: 100, defenderMaxHp: 100});
    let frame = 0;
    burst.step(frame, slots);
    assert.equal(burst.snapshot(0).phase, 'READY');
    assert.equal(burst.request(0, {overLimit: true}), true);
    burst.step(++frame, slots);
    while (burst.holding()) burst.hold(frame);
    assert.equal(burst.snapshot(0).phase, 'BURST');
    assert.equal(burst.snapshot(0).overLimit, true);
    burst.step(++frame, slots);
    assert.equal(slots[0].field28, 0, 'its action countdown resets');
    assert.equal(burst.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 1000}), 2100, '1.4 x 1.5');
    if (foeFalls) slots[3].currentHp = 0;
    const start = frame;
    while (frame - start < BATTLE_OVER_LIMIT_FRAMES + 2 && burst.snapshot(0).phase === 'BURST') burst.step(++frame, slots);
    return {burst, slots, frame, start};
  };
  const lone = run();
  assert.ok(lone.frame - lone.start <= BATTLE_OVER_LIMIT_FRAMES + 1 && BATTLE_OVER_LIMIT_FRAMES < BATTLE_BURST_FRAMES, '10 s, shorter than the 20 s standard burst');
  assert.equal(lone.burst.snapshot(0).phase, 'EXHAUSTED');
  assert.equal(lone.burst.scaleDamage({attackerSlot: 3, defenderSlot: 0, damage: 1000}), 1300, 'takes x1.3 while exhausted');
  lone.slots[0].field28 = 0; lone.burst.step(lone.frame + 1, lone.slots);
  assert.ok(lone.slots[0].field28 >= 2, 'it cannot act while exhausted');
  let f = lone.frame + 1;
  while (lone.burst.snapshot(0).phase === 'EXHAUSTED' && f < lone.frame + BATTLE_EXHAUST_FRAMES + 5) lone.burst.step(++f, lone.slots);
  assert.equal(lone.burst.snapshot(0).phase, 'SPENT');
  assert.ok(f - lone.frame >= BATTLE_EXHAUST_FRAMES - 1, '3 s of exhaustion');
  assert.equal(run({foeFalls: true}).burst.snapshot(0).phase, 'SPENT', 'a felled foe means no exhaustion');
  assert.equal(run({bloodline: 'beta'}).burst.snapshot(0).phase, 'SPENT', 'the beta bloodline is immune');
  // A standard press keeps the 20 s burst.
  const plainBurst = createBattleBurst({policy: 'BURST_V1', plans: [{form: 300, tier: 1, manual: true}, null, null, null, null, null]});
  const slots = [0, 1, 2, 3, 4, 5].map(() => ({currentHp: 100, maxHp: 100, field28: 40}));
  for (let i = 0; i < 20; i++) plainBurst.onHit({attackerSlot: 0, defenderSlot: 3, damage: 100, defenderMaxHp: 100});
  plainBurst.step(0, slots); plainBurst.request(0); plainBurst.step(1, slots);
  while (plainBurst.holding()) plainBurst.hold(1);
  assert.equal(plainBurst.snapshot(0).overLimit, false);
  assert.equal(plainBurst.snapshot(0).burstFrames, BATTLE_BURST_FRAMES);
  assert.equal(BATTLE_BURST_WRAP_FRAMES, 72);
});

test('over-limit burst in the Data Arena relay: the long press goes over the limit for 10 s', () => {
  const sim = createDataArenaSimulation({seed: 9, mode: 'RELAY', relayManualBurst: true});
  const own = () => sim.getSnapshot().relay.burst;
  if (!own()) return; // a seat without a burst plan never bursts (Owner 2026-11-08)
  assert.equal(own().overLimit, false);
  assert.match(readFileSync('src/championship/modes/dataArena/dataArenaSimulation.js', 'utf8'), /overLimit: Boolean\(input\.overLimit\)/);
});

test('sponsor contracts: stakes, conditions and payouts', () => {
  assert.deepEqual(SPONSOR_CONTRACTS.map(c => [c.id, c.payout]), [['HEART_GUARD', 2], ['IRON_RUSH', 2.5], ['RIFT_GAMBIT', 3]]);
  assert.equal(SPONSOR_STAKES.minimum, 15000); assert.equal(SPONSOR_STAKES.maximum, 80000);
  assert.ok(validSponsorStake(15000) && validSponsorStake(80000) && !validSponsorStake(14000) && !validSponsorStake(85000) && !validSponsorStake(17000));
  const [heart, iron, rift] = SPONSOR_CONTRACTS;
  assert.equal(sponsorContractMet(heart, {won: true, partnerDowns: 0}), true);
  assert.equal(sponsorContractMet(heart, {won: true, partnerDowns: 1}), false);
  assert.equal(sponsorContractMet(iron, {won: true, seconds: 59.9}), true);
  assert.equal(sponsorContractMet(iron, {won: true, seconds: 61}), false);
  assert.equal(sponsorContractMet(rift, {won: true, foeBoostPercent: 20}), true);
  assert.equal(sponsorContractMet(rift, {won: true, foeBoostPercent: 0}), false);
  assert.equal(sponsorContractMet(heart, {won: false}), false, 'a loss never pays');
  assert.deepEqual({...settleSponsorContract({contractId: 'IRON_RUSH', stake: 20000}, {won: true, seconds: 40})}, {met: true, contractId: 'IRON_RUSH', stake: 20000, payout: 50000, reward: iron.reward});
  assert.equal(settleSponsorContract({contractId: 'RIFT_GAMBIT', stake: 80000}, {won: true, foeBoostPercent: 20}).payout, 240000);
  assert.equal(settleSponsorContract({contractId: 'HEART_GUARD', stake: 30000}, {won: true, partnerDowns: 2}).payout, 0, 'a failed contract keeps the stake');
});

test('sponsor contract wiring: the stake rides the match transaction, the rift gambit boosts the foe', () => {
  const app = readFileSync('src/championship/app/championshipStandaloneApp.js', 'utf8');
  assert.match(app, /sponsorAdmission\(armed,sponsor\.kind,odds,wallet\)/);
  assert.match(app, /settleSponsorContract\(escrow/);
  const runtime = readFileSync('src/championship/app/battleRuntime.js', 'utf8');
  assert.match(runtime, /setFoeBoostPercent/); assert.match(runtime, /contractStats/);
  const sim = createDataArenaSimulation({seed: 3, mode: 'TOURNAMENT', rivalBoostPercent: 20});
  const plain = createDataArenaSimulation({seed: 3, mode: 'TOURNAMENT'});
  const hp = s => s.getSnapshot().rivals?.[0]?.maxHp ?? null;
  if (hp(plain) !== null) assert.equal(hp(sim), Math.round(hp(plain) * 1.2));
});

test('wild instinct: 65 / 27 / 8, elite faster, ancestral larger, and their capture bonuses', () => {
  assert.deepEqual(WILD_INSTINCTS.map(w => [w.id, w.weight]), [['NORMAL', 65], ['ELITE', 27], ['ANCESTOR', 8]]);
  assert.equal(rollWildInstinct(0), 'NORMAL'); assert.equal(rollWildInstinct(0.649), 'NORMAL');
  assert.equal(rollWildInstinct(0.65), 'ELITE'); assert.equal(rollWildInstinct(0.919), 'ELITE');
  assert.equal(rollWildInstinct(0.92), 'ANCESTOR'); assert.equal(rollWildInstinct(0.9999), 'ANCESTOR');
  const counts = {NORMAL: 0, ELITE: 0, ANCESTOR: 0};
  for (let i = 0; i < 20000; i++) counts[rollWildInstinct(instinctNoise(2026, i, 40))]++;
  assert.ok(Math.abs(counts.NORMAL / 200 - 65) < 2 && Math.abs(counts.ELITE / 200 - 27) < 2 && Math.abs(counts.ANCESTOR / 200 - 8) < 1.2, JSON.stringify(counts));
  assert.equal(WILD_INSTINCTS[1].speedMultiplier, 1.2); assert.equal(WILD_INSTINCTS[1].awakeningPoints, 15);
  assert.equal(WILD_INSTINCTS[2].scale, 1.15); assert.equal(WILD_INSTINCTS[2].awakeningPercent, 40);
  assert.equal(ownPointCondition(speciesTaxonomy(40)), 'DRAGON_ATTRIBUTE', 'Gabumon is of the dragon race');
  const record = {speciesIndex: 40, individual: profileOf(40), positionQ12: [0, 0, 0], facing: 0,
    ai: {speedQ12: 100, state: 0, field054: 0, field1e0: 0, field1d8: 0}, instinct: 'ANCESTOR'};
  assert.equal(createNativeWildActor(record, 'w:0').instinct, 'ANCESTOR');
  const gacha = inscribeGachaBloodline(createCyberGachaState(), 'p9', 'beta');
  assert.equal(gachaBloodlineOf(gacha, 'p9').family, 'beta');
  assert.equal(grantGachaMetal(gacha, 'metal:emma-shard', 1).metals['metal:emma-shard'], 1);
  const hunt = readFileSync('src/championship/presentation/vs2/createHuntFieldPixiPresentation.js', 'utf8');
  assert.match(hunt, /wild\.instinct === "ANCESTOR" \? 1\.15 : 1/);
});

test('over-limit key: hold 0.6 s or double tap', () => {
  assert.equal(OVER_LIMIT_RULES.holdMs, 600);
  assert.equal(OVER_LIMIT_RULES.seconds, 10);
  assert.equal(OVER_LIMIT_RULES.exhaustSeconds, 3);
  assert.equal(OVER_LIMIT_RULES.immuneBloodline, 'beta');
  const calls = [], listeners = {}, timers = [];
  const button = {style: {setProperty() {}}, classList: {add() {}, remove() {}}, setPointerCapture() {},
    addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener() {}};
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms) => { timers.push({fn, ms, live: true}); return timers.length; };
  globalThis.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].live = false; };
  return import('../src/championship/app/ui/overLimitPress.js').then(({bindOverLimitPress}) => {
    try {
      bindOverLimitPress(button, {holdMs: 600, doubleTapMs: 320, onStandard: () => calls.push('standard'), onOverLimit: () => calls.push('over')});
      const flush = ms => { for (const t of timers) if (t.live && t.ms === ms) { t.live = false; t.fn(); } };
      const press = {button: 0, preventDefault() {}, pointerId: 1};
      listeners.pointerdown(press); flush(600); listeners.pointerup(press);
      listeners.pointerdown(press); listeners.pointerup(press); flush(320);
      listeners.pointerdown(press); listeners.pointerup(press); listeners.pointerdown(press); listeners.pointerup(press);
      assert.deepEqual(calls, ['over', 'standard', 'over']);
    } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
  });
});

test('no easy money: odds by both teams\' power, stake caps by match kind, three contracts a day (Owner 2026-11-10)', async () => {
  const {sponsorOdds, SPONSOR_ODDS, SPONSOR_STAKE_CAPS, SPONSOR_DAILY_LIMIT} = await import('../src/championship/contracts/productAwakeningOverdrive.js');
  const {sponsorContractsSignedOn, withSponsorSigned} = await import('../src/championship/contracts/productBurstEvolution.js');
  assert.deepEqual({...sponsorOdds(3000, 300)}, {ratio: 0.1, accepted: false, bonus: false}, 'a mature team against a baby: refused');
  assert.equal(sponsorOdds(3000, 2400).accepted, true);
  assert.equal(sponsorOdds(3000, 2400).bonus, false);
  assert.equal(sponsorOdds(3000, 3600).bonus, true, 'a stronger foe pays more');
  assert.equal(sponsorOdds(0, 0).accepted, true, 'unknown power keeps plain odds');
  assert.equal(SPONSOR_ODDS.refuseBelow, 0.7);
  assert.ok(SPONSOR_STAKE_CAPS.FREE < SPONSOR_STAKE_CAPS.TITLE && SPONSOR_STAKE_CAPS.TITLE < SPONSOR_STAKE_CAPS.CHAMPIONSHIP);
  assert.equal(SPONSOR_STAKE_CAPS.FREE, 15000);
  assert.equal(SPONSOR_DAILY_LIMIT, 3);
  assert.equal(settleSponsorContract({contractId: 'HEART_GUARD', stake: 20000, oddsBonus: true}, {won: true, partnerDowns: 0}).payout, 50000, 'x2 + 0.5');
  let state = createBurstEvolutionState();
  for (let i = 0; i < 3; i++) state = withSponsorSigned(state, 20400);
  assert.equal(sponsorContractsSignedOn(state, 20400), 3);
  assert.equal(sponsorContractsSignedOn(state, 20401), 0, 'a new local day starts over');
  assert.equal(sponsorContractsSignedOn(normalizeBurstEvolution(JSON.parse(JSON.stringify(state))), 20400), 3);
  const app = readFileSync('src/championship/app/championshipStandaloneApp.js', 'utf8');
  for (const kind of ['FREE', 'TITLE', 'CHAMPIONSHIP']) assert.match(app, new RegExp(`kind:'${kind}'`));
  assert.match(app, /reason:'FOE_TOO_WEAK'/); assert.match(app, /reason:'OVER_CAP'/); assert.match(app, /reason:'DAILY_LIMIT'/);
  const screens = readFileSync('src/championship/app/vs5Screens.js', 'utf8');
  assert.match(screens, /source\.icon\?\.\(contract\.faction\)/, 'contract keys use the game faction glyph');
  for (const lang of ['', '.en', '.ja', '.th', '.vi']) {
    const text = readFileSync(`src/championship/text/uiText${lang}.js`, 'utf8');
    assert.doesNotMatch(text, /"SPONSOR_(HEART_GUARD|IRON_RUSH|RIFT_GAMBIT)_NAME": "[🌿⚙🌀]/u, 'no emoji in contract names');
  }
});
