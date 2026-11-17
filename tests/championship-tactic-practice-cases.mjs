// TACTIC_PRACTICE_LOOP_20261116: the battle-plan record, its result-screen lines
// and the Journey practice series (fixed rewards, same partner, plan between bouts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {classifyLaunch} from '../src/championship/app/battleTacticRecord.js';
import {tacticRecordLines, tacticRecordText, TACTIC_RECORD_COPY} from '../src/championship/text/tacticRecordText.js';
import {LOCALES} from '../src/championship/text/locale.js';
import {TACTIC_PRACTICE_CRYSTALS, TACTIC_PRACTICE_CLEAR_CRYSTALS, tacticPracticeBoutCrystals, tacticPracticeCleared, createTacticPracticeSeries, tacticPracticeBouts, tacticPracticeNextBout, tacticPracticeTier,
  recordTacticPracticeBout, presetSkillCount} from '../src/championship/contracts/productTacticPractice.js';

const read = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function individual(id, species, personality, rngSeed, tactic) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile, tactic};
}
function fight(tactic, seed = 3) {
  const runtime = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy: 'IMPROVED_V1', personalityPolicy: 'ORIGINAL', burstPolicy: 'OFF',
    playerIndividuals: [individual('A0', 53, 2, 1007, tactic)], opponentIndividuals: [individual('B0', 38, 3, 2007, 1)]});
  runtime.choosePracticeBattle({arenaIndex: 2});
  const view = runtime.startMatch();
  for (let t = 0; t < 60000 && !view.getView().outcome.ended; t++) view.tick();
  const record = runtime.getTacticRecord(), diagnostics = runtime.getPersonalityDiagnostics();
  runtime.dispose();
  return {record, diagnostics};
}

test('the record counts exactly the moves the runtime launched, and says which plan fought', () => {
  const {record, diagnostics} = fight(0);
  assert.notEqual(record.outcome, 'UNFINISHED');
  const mine = record.local[0], tally = diagnostics.slots[0];
  assert.equal(mine.tactic, 0);
  assert.equal(mine.profile, 0, 'policy 0 is read as AI profile 0 under the original wiring');
  assert.equal(mine.instanceId, 'A0');
  assert.equal(mine.total, tally.launched, 'every launched move is counted once');
  assert.equal(mine.decisions.total, tally.decisions);
  assert.equal(mine.decisions.reposition, tally.move);
  assert.ok(mine.counts.skill >= 1 && mine.moves.length >= 1);
  assert.equal(mine.moves.reduce((a, m) => a + m.count, 0), mine.counts.skill + mine.counts.support);
});

test('the same partner and seed under another plan does something measurably different', () => {
  const special = fight(0).record.local[0], support = fight(2).record.local[0];
  assert.equal(support.tactic, 2);
  const share = e => e.decisions.reposition / e.decisions.total;
  assert.ok(share(support) > share(special) + 0.2, `reposition ${share(special)} -> ${share(support)}`);
});

test('a special skill (sp1/sp2, e.g. 治癒 α) counts as support and fires more under 支援優先', () => {
  const run = (plan) => {
    const team = [[37, 6], [41, 4], [50, 4]].map(([species, trait], k) => ({instanceId: 'A' + k, tactic: plan,
      nativeProfile: nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => 11 + k}, traitOverride: trait}))}));
    assert.ok(team.every(p => p.nativeProfile.fields['12c'] === 2), 'each carries 治癒 α');
    const runtime = createBattleRuntime({mode: 5, battleType: 0, seed: 1, aiPolicy: 'IMPROVED_V1', personalityPolicy: 'ORIGINAL', burstPolicy: 'OFF',
      playerIndividuals: team, opponentIndividuals: [34, 38, 61].map((s, k) => individual('B' + k, s, k, 7 + k, 1))});
    runtime.choosePracticeBattle({arenaIndex: 2});
    const view = runtime.startMatch();
    for (let t = 0; t < 90000 && !view.getView().outcome.ended; t++) view.tick();
    const record = runtime.getTacticRecord();
    runtime.dispose();
    return record.local.reduce((sum, e) => ({support: sum.support + e.counts.support, decided: sum.decided + e.decisions.support}), {support: 0, decided: 0});
  };
  const normal = run(1), support = run(2);
  assert.equal(normal.decided, 0, 'the normal plan never takes the targeted path here');
  assert.ok(support.support > 0 && support.support <= support.decided, JSON.stringify(support));
});

test('a launched move is classified from its own record, not from the plan', () => {
  assert.equal(classifyLaunch({slot: 0, targetSlot: 1, moveId: 2, speciesId: 'species-037'}), 'support', 'special skill 治癒 α');
  assert.equal(classifyLaunch({slot: 0, targetSlot: 3, moveId: 108, speciesId: 'species-053'}), 'normal');
  assert.equal(classifyLaunch({slot: 0, targetSlot: 3, moveId: 109, speciesId: 'species-053'}), 'skill');
  assert.equal(classifyLaunch({slot: 0, targetSlot: 1, moveId: 109, speciesId: 'species-053'}), 'support');
});

test('result lines state counted facts, only where a plan was read, with one comparison line', () => {
  const {record} = fight(0);
  const lines = tacticRecordLines(record, {nameOf: () => '測試', moveName: id => `M${id}`});
  assert.equal(lines[0], '測試・必殺優先');
  assert.match(lines[1], /^出手 \d+　招式 \d+　走位 \d+%$/, 'one numbers line; a support count of 0 is left out');
  assert.ok(lines.some(l => /^M\d+ ×\d+/.test(l)), 'skills by name');
  assert.ok(lines.every(l => l.length <= 24), 'every line is short enough to read at a glance');
  assert.equal(lines.some(l => l.startsWith('上次')), false, 'no comparison without a previous record');
  assert.ok(lines.some(l => /^TP 剩 \d+\/\d+$/.test(l)), 'what the plan left for the next battle');
  const compared = tacticRecordLines(record, {nameOf: () => '測試', moveName: String,
    previous: () => ({tactic: 2, total: 4, counts: {skill: 1}, seconds: 30.5})});
  assert.ok(compared.includes('上次「支援優先」：出手 4　招式 1'));
  const same = tacticRecordLines(record, {nameOf: () => '', moveName: String, previous: () => ({tactic: 0, total: 1, counts: {skill: 0}, seconds: 1})});
  assert.equal(same.some(l => l.startsWith('上次')), false, 'the same plan is not a comparison');
  const unread = {...record, local: record.local.map(e => ({...e, tactic: null}))};
  assert.deepEqual(tacticRecordLines(unread, {}), [], 'a title match (plan not read) shows nothing');
});

test('every locale carries every key', () => {
  const keys = Object.keys(TACTIC_RECORD_COPY['zh-Hant']);
  for (const locale of LOCALES) for (const key of keys) assert.ok(TACTIC_RECORD_COPY[locale]?.[key], `${locale}:${key}`);
  assert.equal(tacticRecordText('plan.0', {}, 'en'), 'Special first');
});

test('practice bouts: a normal rival, a skill rival and a trio, fixed by tier and round', () => {
  for (const towerNext of [1, 15, 50, 99]) for (const partnerSpecies of [null, 0, 41, 61]) for (const round of [0, 1, 2]) {
    const bouts = tacticPracticeBouts({towerNext, partnerSpecies, round});
    assert.equal(bouts[0].kind, 'NORMAL_RIVAL');
    assert.ok(['SKILL_RIVAL', 'SECOND_RIVAL'].includes(bouts[1].kind));
    assert.equal(bouts[2].kind, 'TEAM');
    assert.equal(bouts[0].presetIndices.length, 1);
    assert.equal(bouts[2].presetIndices.length, 3);
    const a = presetSkillCount(bouts[0].presetIndices[0]), b = presetSkillCount(bouts[1].presetIndices[0]);
    // The label is a fact: "skill rival" only when it really carries more SP moves.
    assert.equal(bouts[1].kind === 'SKILL_RIVAL', b > a, `${a} vs ${b}`);
    assert.notEqual(bouts[0].presetIndices[0], bouts[1].presetIndices[0]);
    assert.deepEqual(tacticPracticeBouts({towerNext, partnerSpecies, round}), bouts, 'no RNG');
  }
});

test('the rivals match the partner: its generation picks the preset tier band', () => {
  assert.equal(tacticPracticeTier({partnerSpecies: 61}), 2);
  assert.equal(tacticPracticeTier({partnerSpecies: 61, upper: true}), 3);
  assert.equal(tacticPracticeTier({partnerSpecies: null, towerNext: 50}), 5, 'unknown partner: the tower band');
  const generations = read('src/data/championship/catalogs/creature-species.r1.json').records;
  const presets = read('src/data/championship/catalogs/free-battle.r1.json');
  for (const species of [61, 41]) {
    const g = generations[species].generationIndex;
    for (const bout of tacticPracticeBouts({partnerSpecies: species})) for (const p of bout.presetIndices)
      assert.ok(Math.abs(generations[presets.presets[p - presets.presetStart].field00].generationIndex - g) <= 1, `preset ${p}`);
  }
});

test('a bout pays the same crystals win or lose, and a memory needs an event that happened', () => {
  let series = createTacticPracticeSeries({instanceId: 'p1', towerNext: 1});
  assert.equal(tacticPracticeNextBout(series), 1);
  const entry = {counts: {normal: 5, skill: 3, support: 0}, total: 8, hpLeftRatio: 0.6};
  const lost = recordTacticPracticeBout(series, {bout: 1, tactic: 0, won: false, seconds: 12, entry});
  assert.equal(lost.result.crystals, TACTIC_PRACTICE_CRYSTALS);
  assert.equal(lost.result.memory, null, 'no memory from a loss');
  series = lost.series;
  assert.equal(recordTacticPracticeBout(series, {bout: 3, tactic: 0, won: true, seconds: 1, entry}).result, null, 'bouts go in order');
  const won = recordTacticPracticeBout(series, {bout: 2, tactic: 2, won: true, seconds: 40, entry});
  assert.equal(won.result.crystals, TACTIC_PRACTICE_CRYSTALS);
  assert.deepEqual(won.result.memory, {kind: 'skillWin', skill: 3});
  assert.equal(won.result.clear, false, 'only the last bout clears');
  const plain = recordTacticPracticeBout(won.series, {bout: 3, tactic: 2, won: true, seconds: 40, entry: {...entry, counts: {normal: 9, skill: 0, support: 0}}});
  assert.equal(plain.result.memory, null, 'a long win with nothing notable leaves no line');
  assert.equal(tacticPracticeNextBout(plain.series), null);
  // P2b: winning the trio clears the series for a bonus; losing it pays the fixed amount only.
  assert.equal(plain.result.clear, true);
  assert.equal(plain.result.crystals, TACTIC_PRACTICE_CRYSTALS + TACTIC_PRACTICE_CLEAR_CRYSTALS);
  assert.equal(tacticPracticeCleared(plain.series), true);
  const fell = recordTacticPracticeBout(won.series, {bout: 3, tactic: 0, won: false, seconds: 30, entry});
  assert.equal(fell.result.clear, false);
  assert.equal(fell.result.crystals, TACTIC_PRACTICE_CRYSTALS);
  assert.equal(tacticPracticeCleared(fell.series), false);
  assert.equal(tacticPracticeCleared(won.series), false, 'not cleared before the trio');
});

test('P2b: one helper prices every bout — fixed, plus the clear bonus for winning bout 3', () => {
  assert.ok(TACTIC_PRACTICE_CLEAR_CRYSTALS > 0);
  for (const bout of [1, 2]) for (const won of [true, false]) assert.equal(tacticPracticeBoutCrystals({bout, won}), TACTIC_PRACTICE_CRYSTALS);
  assert.equal(tacticPracticeBoutCrystals({bout: 3, won: false}), TACTIC_PRACTICE_CRYSTALS);
  assert.equal(tacticPracticeBoutCrystals({bout: 3, won: true}), TACTIC_PRACTICE_CRYSTALS + TACTIC_PRACTICE_CLEAR_CRYSTALS);
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /addSyncCrystals\(tacticPracticeBoutCrystals\(\{bout:spar\.bout,won\}\)\)/, 'the app pays through the same helper');
  assert.match(source('src/championship/app/journeyScreen.js'), /pt\(current\?\.cleared \? "practice\.cleared" : "practice\.done"\)/);
});

test('app: a practice series fights the same partner, reads its plan, pays only fixed crystals', async () => {
  const data = new Map(), storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
  const app = createChampionshipStandaloneApp({storage, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    cages: read('docs/contracts/championship/raising-home-presentation.v1.json').cages, rngClock: () => ({hour: 13, minute: 20, second: 50})});
  await app.newGame(); app.save();
  const [key, text] = [...data][0], save = JSON.parse(text);
  save.creature.nativeProfile = nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(53), rng: {next: () => 11}}));
  save.creature.speciesId = 'species-053';
  data.set(key, JSON.stringify(save)); await app.continueGame(); app.openBattle();
  const id = app.getRaisingInstances()[0].instanceId;
  assert.equal(app.startTacticPractice('nobody').ok, false);
  assert.equal(app.startTacticPractice(id).ok, true);
  const plans = [0, 2];
  let carriedTp = null;
  for (const [index, plan] of plans.entries()) {
    const bout = index + 1;
    assert.equal(app.getTacticPractice().nextBout, bout);
    assert.equal(app.setBattleTactic(id, plan).ok, true);
    const crystals = app.getJourneyFrame().crystals, bits = app.getShopFrame().bits;
    const party = await app.prepareSparBattle();
    assert.equal(party.ok, true, party.reason);
    assert.equal(party.individuals[0].tactic, plan, 'the bout carries the partner\'s current plan');
    // P2: every bout starts at full HP; TP is whatever the last bout left (the original's own write-back).
    const fields = party.individuals[0].nativeProfile.fields;
    assert.equal(fields['050'], fields['058'], 'full HP for the bout');
    const savedTp = app.getTacticPracticeTp(id);
    if (index > 0) assert.equal(savedTp.current, carriedTp, 'TP carried from the previous bout');
    const runtime = createBattleRuntime({mode: 2, battleType: 0, playerIndividuals: party.individuals, rng: party.rngPreparation.rng, personalityPolicy: 'ORIGINAL'});
    try {
      runtime.chooseFreeBattle({presetIndices: party.presetIndices, arenaIndex: party.arenaIndex});
      const view = runtime.startMatch();
      const entered = app.enterSparBattle({playerInstanceIds: [id], rngPreparation: party.rngPreparation});
      assert.equal(entered.ok, true, entered.reason);
      for (let t = 0; t < 90000 && !view.getView().outcome.ended; t++) view.tick();
      const result = runtime.getSettlementResult();
      const attemptId = entered.attempt.attemptId;
      assert.equal(app.finishMatch({...result, attemptId}).ok, true);
      assert.equal(app.getJourneyFrame().crystals, crystals + TACTIC_PRACTICE_CRYSTALS, 'fixed crystals, win or lose');
      assert.equal(app.getShopFrame().bits, bits, 'no purse');
      assert.notEqual(app.getLastSyncGains?.()?.attemptId, attemptId, 'no outcome-based Sync EXP');
      assert.notEqual(app.getLastBattleGachaDrop?.()?.attemptId, attemptId, 'no gacha drop');
      const record = runtime.getTacticRecord();
      assert.equal(record.local[0].tactic, plan);
      const recorded = app.recordTacticPracticeBout({attemptId, entry: record.local[0], seconds: record.seconds});
      assert.equal(recorded.result.bout, bout);
      assert.equal(recorded.result.tactic, plan);
      carriedTp = app.getTacticPracticeTp(id).current;
      assert.ok(carriedTp <= savedTp.current, 'a bout never adds TP');
      assert.equal(app.recordTacticPracticeBout({attemptId, entry: record.local[0], seconds: record.seconds}), null, 'recorded once');
      app.exitBattle();
      if (app.getScreen() !== 'BATTLE_SELECT') app.openBattle();
    } finally { runtime.dispose(); }
  }
  assert.deepEqual(app.getTacticPractice().series.results.map(r => r.tactic), plans);
  assert.equal(app.getTacticPractice().series.instanceId, id);
});

test('wiring: the result screen reads the record, a spar bout skips the sponsor, Journey shows the tab', () => {
  const main = source('src/championship/app/main.js'), app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(main, /tacticRecord: tactic\?\.panel \?\? null/);
  assert.match(main, /get\('tacticRecord'\) === 'off' \? 'A' : 'B'/);
  assert.match(app, /mode===2&&prepared\.freeMatch\.kind!=='SPAR'\?\{begin:attemptId,kind:'FREE'\}:null/);
  assert.match(source('src/championship/app/journeyScreen.js'), /result\.counts && p\.variant !== "A"/, 'the A side sees no counts on the practice tab');
  assert.match(source('src/championship/app/journeyScreen.js'), /\["PRACTICE", host\.practice\.text\("practice\.tab"\)\]/);
});
