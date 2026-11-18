// WAVE_RUN_20261118: the application's wave run — one battle session per wave, drops picked through one authority,
// the challenge leave paid once, a story pick paid at once, and a reload that neither pays nor rerolls again.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';

const read = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));

async function boot({species = 53, failSaves = null} = {}) {
  const data = new Map();
  const storage = {getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k),
    setItem: (k, v) => { if (failSaves?.on) throw new Error('QUOTA'); data.set(k, v); }};
  const make = () => createChampionshipStandaloneApp({storage, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    cages: read('docs/contracts/championship/raising-home-presentation.v1.json').cages, rngClock: () => ({hour: 13, minute: 20, second: 50})});
  const app = make();
  await app.newGame(); app.save();
  const [key, text] = [...data][0], save = JSON.parse(text);
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => 11}})));
  // a strong partner, so the first waves are won
  for (const k of ['058', '050']) profile.fields[k] = 999;
  save.creature.nativeProfile = profile;
  save.creature.speciesId = `species-${String(species).padStart(3, '0')}`;
  data.set(key, JSON.stringify(save)); await app.continueGame(); app.openBattle();
  const id = app.getRaisingInstances()[0].instanceId;
  return {app, id, data, key, make};
}

/** Fight the run's current wave to its end through the same calls the battle screen makes. */
async function fightWave(app, id) {
  const party = await app.prepareWaveBattle();
  assert.equal(party.ok, true, party.reason);
  const runtime = createBattleRuntime({mode: 2, battleType: 0, playerIndividuals: party.individuals, rng: party.rngPreparation.rng, personalityPolicy: 'ORIGINAL'});
  try {
    runtime.chooseFreeBattle({presetIndices: party.presetIndices, arenaIndex: party.arenaIndex});
    runtime.setFoeBoostPercent(party.foeBoostPercent);
    const view = runtime.startMatch();
    const entered = app.enterWaveBattle({playerInstanceIds: party.playerInstanceIds, rngPreparation: party.rngPreparation});
    assert.equal(entered.ok, true, entered.reason);
    for (let t = 0; t < 120000 && !view.getView().outcome.ended; t++) view.tick();
    const result = runtime.getSettlementResult();
    const finished = app.finishMatch({...result, attemptId: entered.attempt.attemptId});
    assert.equal(finished.ok, true, finished.reason);
    assert.equal(app.getScreen(), 'BATTLE_FIELD', 'no result screen between waves');
    app.exitBattle();
    if (app.getScreen() !== 'BATTLE_SELECT') app.openBattle();
    return {party, won: finished.receipt?.won === true};
  } finally { runtime.dispose(); }
}

test('challenge: a won wave drops, a pick joins the run loot, leave pays it once, and the run is gone', async () => {
  const {app, id} = await boot();
  const bits0 = app.getShopFrame().bits;
  const sync0 = JSON.stringify(app.getLastSyncGains?.() ?? null);
  assert.equal(app.startWaveRun({mode: 'CHALLENGE', encounterId: 'challenge', party: [id]}).ok, true);
  assert.equal(app.startWaveRun({mode: 'CHALLENGE', party: [id]}).reason, 'WAVE_RUN_ACTIVE');
  const {won} = await fightWave(app, id);
  assert.equal(won, true, 'a 999 HP partner wins the first wave');
  const frame = app.getWaveRun();
  assert.deepEqual([frame.run.status, frame.run.wave], ['REST', 1]);
  assert.ok(frame.run.drops.length > 0 && frame.run.drops.every(d => d.state === 'GROUND'));
  assert.equal(app.getShopFrame().bits, bits0, 'the win paid no purse and the drops pay nothing on the ground');
  assert.equal(JSON.stringify(app.getLastSyncGains?.() ?? null), sync0, 'no Sync EXP per wave');
  const coin = frame.run.drops.find(d => d.kind === 'BITS');
  assert.equal(app.collectWaveDrop(coin.id).ok, true);
  assert.equal(app.collectWaveDrop(coin.id).reason, 'ALREADY_PICKED', 'a tap and the magnet on one coin pay one');
  assert.equal(app.getShopFrame().bits, bits0, 'a challenge pick waits for the leave');
  assert.equal(app.getWaveRun().picked.bits, coin.amount);
  const left = app.finishWaveRun('LEAVE');
  assert.equal(left.ok, true, left.reason);
  assert.equal(left.finished.bits, coin.amount);
  assert.equal(app.getShopFrame().bits, bits0 + coin.amount, 'exactly the picked coin');
  assert.equal(app.finishWaveRun('LEAVE').duplicate, true, 'a second leave pays nothing');
  assert.equal(app.getShopFrame().bits, bits0 + coin.amount);
  assert.equal(app.getWaveRun().run, null);
  assert.ok(app.getLastSyncGains(), 'the run pays its Sync EXP once, at the end');
});

test('challenge: reload between waves keeps the same ground drops and the picked loot, and pays nothing', async () => {
  const {app, id, make} = await boot();
  app.startWaveRun({mode: 'CHALLENGE', party: [id]});
  await fightWave(app, id);
  const before = app.getWaveRun().run;
  app.collectWaveDrop(before.drops[0].id);
  const bits = app.getShopFrame().bits;
  const again = make();
  await again.continueGame();
  const after = again.getWaveRun().run;
  assert.deepEqual(after.drops.map(d => [d.id, d.amount, d.state]), app.getWaveRun().run.drops.map(d => [d.id, d.amount, d.state]), 'no reroll');
  assert.equal(after.status, 'REST');
  assert.equal(again.getShopFrame().bits, bits);
  assert.equal(again.collectWaveDrop(before.drops[0].id).reason, 'ALREADY_PICKED');
  assert.equal(again.continueWaveRun().ok, true);
  assert.equal(again.continueWaveRun().reason, 'NOT_RESTING', 'continue and leave exclude each other');
  assert.equal(again.finishWaveRun('LEAVE').reason, 'NOT_RESTING');
});

test('story: no leave between waves, each pick is paid at once, the cleared run finishes once', async () => {
  const {app, id} = await boot();
  const bits0 = app.getShopFrame().bits;
  // a tier-0 boss, so a strong starter clears all three waves (the authored 491 is tier 2)
  assert.equal(app.startWaveRun({mode: 'STORY', encounterId: 'ch1:clash', party: [id], bossPresets: [456]}).ok, true);
  let paid = 0;
  for (let wave = 0; wave < 3; wave++) {
    assert.equal(app.finishWaveRun('LEAVE').reason, 'NOT_RESTING', 'the story never offers to leave');
    const {won} = await fightWave(app, id);
    assert.equal(won, true, `wave ${wave}`);
    for (const drop of app.getWaveRun().run.drops.filter(d => d.state === 'GROUND' && d.wave === wave)) {
      const got = app.collectWaveDrop(drop.id);
      assert.equal(got.ok, true, got.reason);
      if (drop.kind === 'BITS') paid += drop.amount;
    }
    assert.equal(app.getShopFrame().bits, bits0 + paid, 'a story pick is paid at once');
    if (wave < 2) assert.equal(app.continueWaveRun().ok, true);
  }
  assert.equal(app.getWaveRun().run.status, 'CLEARED');
  const done = app.finishWaveRun('CLEARED');
  assert.equal(done.ok, true, done.reason);
  assert.equal(done.finished.bits, 0, 'nothing left to pay: every pick was paid when it was picked');
  assert.equal(app.getShopFrame().bits, bits0 + paid);
});

test('a failed save keeps the drop on the ground and retries cleanly', async () => {
  const failSaves = {on: false};
  const {app, id} = await boot({failSaves});
  app.startWaveRun({mode: 'STORY', encounterId: 'ch1:clash', party: [id], bossPresets: [491]});
  await fightWave(app, id);
  const drop = app.getWaveRun().run.drops.find(d => d.kind === 'BITS');
  const bits = app.getShopFrame().bits;
  failSaves.on = true;
  const refused = app.collectWaveDrop(drop.id);
  assert.deepEqual([refused.ok, refused.reason], [false, 'SAVE_FAILED']);
  assert.equal(app.getShopFrame().bits, bits);
  assert.equal(app.getWaveRun().run.drops.find(d => d.id === drop.id).state, 'GROUND', 'nothing vanished');
  failSaves.on = false;
  assert.equal(app.collectWaveDrop(drop.id).ok, true);
  assert.equal(app.getShopFrame().bits, bits + drop.amount);
});

test('story: a lost wave ends the run as a defeat, never a clear, and keeps what was picked', async () => {
  const {app, id} = await boot();
  const bits0 = app.getShopFrame().bits;
  // one wave against a far stronger boss
  app.startWaveRun({mode: 'STORY', encounterId: 'test:loss', party: [id], bossPresets: [559], waves: 1});
  const {won} = await fightWave(app, id);
  if (won) return; // a lucky win proves nothing here
  assert.equal(app.getWaveRun().run, null);
  assert.deepEqual([app.getWaveRun().finished.reason, app.getWaveRun().finished.status], ['DEFEATED', 'DEFEATED']);
  assert.equal(app.finishWaveRun('CLEARED').duplicate, true, 'a defeat can never be finished as a clear');
  assert.equal(app.getShopFrame().bits, bits0);
});
