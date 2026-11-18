// WAVE_RUN_20261118 (Owner 2026-11-18): story and challenge share one wave auto-battle with ground drops, one
// authoritative pickup and, in the challenge only, the choice to leave with the loot after every won wave.
// The rules and the saved record; the application and the screens have their own cases.
import assert from 'node:assert/strict';
import test from 'node:test';
import {WAVE_RUN_RULES, WAVE_TIER_MAX, presetTier, presetPurse, storyEncounter, challengeWave, waveFoes, waveDrops, createWaveRun, normalizeWaveRun,
  recordWaveResult, continueWaveRun, collectWaveDrop, waveLoot, markWaveDropsSettled, finishWaveRun, WAVE_ITEM_RECORDS} from '../src/championship/contracts/productWaveRun.js';

const challenge = () => createWaveRun({mode: 'CHALLENGE', encounterId: 'challenge', party: ['p1', 'p2'], seed: 11, runId: 'run:c'});
const story = () => createWaveRun({mode: 'STORY', encounterId: 'ch1:clash', party: ['p1'], seed: 5, runId: 'run:s', bossPresets: [491]});

test('a story encounter builds up to its authored foes; a challenge grows in number, tier and strength', () => {
  const encounter = storyEncounter([491], {seed: 7});
  assert.equal(encounter.length, WAVE_RUN_RULES.storyWaves);
  assert.deepEqual(encounter.at(-1), {presets: [491], foeBoostPercent: 0, boss: true, tier: presetTier(491)});
  assert.ok(encounter.slice(0, -1).every((wave, i) => wave.tier <= presetTier(491) && wave.presets.length === 1 && !wave.boss), 'lower tiers before the boss');
  assert.deepEqual(storyEncounter([491], {seed: 7}), encounter, 'the same seed draws the same encounter');
  assert.equal(storyEncounter([491], {seed: 7, waves: 1}).length, 1);
  assert.equal(storyEncounter([491], {waves: 99}).length, WAVE_RUN_RULES.storyWavesMax);
  assert.equal(storyEncounter([123456]), null);
  const waves = Array.from({length: 12}, (_, n) => challengeWave(n, {seed: 3}));
  assert.deepEqual(waves.map(wave => wave.presets.length), [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  assert.deepEqual(waves.map(wave => wave.tier), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.deepEqual(waves.map(wave => wave.foeBoostPercent), [0, 0, 0, 8, 16, 24, 32, 40, 48, 56, 64, 72], 'stronger foes, not only more HP');
  assert.ok(waves.every(wave => new Set(wave.presets).size === wave.presets.length), 'three different foes');
  assert.equal(challengeWave(40).foeBoostPercent, WAVE_RUN_RULES.challengeBoostMax);
  assert.equal(challengeWave(40).tier, WAVE_TIER_MAX);
});

test('a won wave leaves its drops on the ground with stable ids; nothing is paid by the win', () => {
  const run = challenge();
  const presets = waveFoes(run).presets;
  const {run: rested, changed} = recordWaveResult(run, {attemptId: 'battle:1', won: true, presets});
  assert.equal(changed, true);
  assert.deepEqual([rested.status, rested.wave], ['REST', 1]);
  assert.ok(rested.drops.length >= 1 && rested.drops.every(drop => drop.state === 'GROUND' && drop.wave === 0));
  assert.ok(rested.drops.every(drop => /^run:c:0:\d:\d$/.test(drop.id)));
  assert.deepEqual(waveDrops(run, 0, presets), waveDrops(run, 0, presets), 'the same drops every time: a reload never rerolls them');
  const bits = rested.drops.filter(drop => drop.kind === 'BITS').reduce((sum, drop) => sum + drop.amount, 0);
  assert.equal(bits, presets.reduce((sum, preset) => sum + Math.max(1, Math.round(presetPurse(preset) * WAVE_RUN_RULES.dropBitsPercent / 100)), 0), 'piles add up to the share exactly');
  assert.ok(rested.drops.filter(drop => drop.kind === 'ITEM').every(drop => WAVE_ITEM_RECORDS.includes(drop.record)));
  assert.deepEqual(waveLoot(rested), {bits: 0, items: {}, ids: []}, 'dropping pays nothing');
  // the same battle reported twice changes nothing
  assert.deepEqual(recordWaveResult(rested, {attemptId: 'battle:1', won: true, presets}), {run: rested, changed: false});
});

test('one authority picks a drop up, once: a tap and the magnet on the same coin pay one', () => {
  const rested = recordWaveResult(challenge(), {attemptId: 'battle:1', won: true}).run;
  const coin = rested.drops[0];
  const first = collectWaveDrop(rested, coin.id);
  assert.deepEqual([first.ok, first.drop.id], [true, coin.id]);
  const second = collectWaveDrop(first.run, coin.id);
  assert.deepEqual([second.ok, second.reason], [false, 'ALREADY_PICKED']);
  assert.deepEqual(collectWaveDrop(first.run, 'run:c:9:9:9').reason, 'NO_SUCH_DROP');
  assert.equal(waveLoot(first.run).bits, coin.kind === 'BITS' ? coin.amount : 0);
  const settled = markWaveDropsSettled(first.run, [coin.id]);
  assert.deepEqual(waveLoot(settled), {bits: 0, items: {}, ids: []}, 'settled loot is never counted again');
  assert.equal(collectWaveDrop(settled, coin.id).reason, 'ALREADY_PICKED');
});

test('challenge: leave only from a rest, paying the picked loot once; continue only from a rest; defeat keeps the picked', () => {
  let run = challenge();
  assert.equal(finishWaveRun(run, 'LEAVE').refused, 'NOT_RESTING', 'no leaving mid-wave');
  run = recordWaveResult(run, {attemptId: 'b1', won: true}).run;
  run = collectWaveDrop(run, run.drops[0].id).run;
  const left = finishWaveRun(run, 'LEAVE');
  assert.equal(left.run.status, 'LEFT');
  assert.deepEqual(left.pay.ids, [run.drops[0].id], 'only what was picked; the ground stays');
  assert.equal(finishWaveRun(left.run, 'LEAVE').refused, 'NOT_RESTING', 'a second leave pays nothing');
  // continue
  let going = recordWaveResult(challenge(), {attemptId: 'b1', won: true}).run;
  const next = continueWaveRun(going);
  assert.deepEqual([next.ok, next.run.status, next.run.wave], [true, 'FIGHTING', 1]);
  assert.equal(continueWaveRun(next.run).reason, 'NOT_RESTING', 'continue and leave exclude each other');
  // defeat: picked kept (the default), the ground lost
  going = collectWaveDrop(going, going.drops[0].id).run;
  const fighting = continueWaveRun(going).run;
  const lost = recordWaveResult(fighting, {attemptId: 'b2', won: false}).run;
  assert.equal(lost.status, 'DEFEATED');
  assert.deepEqual(finishWaveRun(lost, 'DEFEATED').pay.ids, [going.drops[0].id]);
  assert.deepEqual(finishWaveRun(lost, 'DEFEATED', {defeatPolicy: 'LOSE_ALL'}).pay.ids, [], 'the other policy, as a setting');
  assert.equal(WAVE_RUN_RULES.defeatPolicy, 'KEEP_PICKED');
});

test('story: no leave, waves until the last, then cleared; a failure is never a win', () => {
  let run = story();
  assert.equal(run.waves, 3);
  for (let wave = 0; wave < 3; wave++) {
    assert.equal(run.status, 'FIGHTING');
    assert.equal(finishWaveRun(run, 'LEAVE').refused, 'NOT_RESTING', 'the story never offers to leave');
    run = recordWaveResult(run, {attemptId: `s${wave}`, won: true}).run;
    if (wave < 2) run = continueWaveRun(run).run;
  }
  assert.deepEqual([run.status, run.wave], ['CLEARED', 3]);
  assert.equal(waveFoes(run, 2).boss, true);
  const failed = finishWaveRun(story(), 'FAILED');
  assert.equal(failed.run.status, 'FAILED');
});

test('the saved record: only the known shape, drops de-duplicated, an old save has none', () => {
  assert.equal(normalizeWaveRun(undefined), null);
  assert.equal(normalizeWaveRun({version: 2}), null);
  const run = recordWaveResult(challenge(), {attemptId: 'b1', won: true}).run;
  const copy = JSON.parse(JSON.stringify(run));
  copy.drops.push(copy.drops[0], {id: 'x', kind: 'GEM', amount: 9, state: 'GROUND'}, {id: 'y', kind: 'BITS', amount: -3, state: 'GROUND'});
  assert.deepEqual(normalizeWaveRun(copy), run, 'a repeated drop is kept once and an unknown or negative one is dropped');
  assert.deepEqual(normalizeWaveRun(JSON.parse(JSON.stringify(run))), run);
  assert.throws(() => createWaveRun({mode: 'ARENA', party: ['a'], runId: 'r'}), /WAVE_RUN_MODE_REQUIRED/);
  assert.throws(() => createWaveRun({mode: 'CHALLENGE', party: [], runId: 'r'}), /WAVE_RUN_PARTY_REQUIRED/);
  assert.throws(() => createWaveRun({mode: 'STORY', party: ['a'], runId: 'r', bossPresets: [1]}), /WAVE_RUN_STORY_PRESETS_REQUIRED/);
});
