import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PARTNER_TENDENCY_COPY,
  partnerTendencyText,
  normalizePartnerTendencies,
  resolveEffectiveBattleTactic,
  tendencyForCageEcology,
  tendencyToTactic
} from '../src/championship/contracts/productPartnerTendency.js';
import { dataArenaEntries, DATA_ARENA_ENTRY } from '../src/championship/modes/dataArena/dataArenaEligibility.js';
import { tacticRecordLines, TACTIC_RECORD_COPY } from '../src/championship/text/tacticRecordText.js';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { createBattleRuntime } from '../src/championship/app/battleRuntime.js';
import { createNativeHuntIndividual } from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import { nativeHuntSpeciesByIndex } from '../src/championship/hunt/capture/nativeHuntSources.js';
import { nativeIndividualProfile } from '../src/championship/raising/nativeIndividualProfile.js';
import { inspectScopedLocaleCopy } from '../scripts/check-locale-coverage.mjs';

const readJson = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const CATALOG = readJson('src/data/championship/catalogs/creature-species.r1.json');
const CAGES = readJson('docs/contracts/championship/raising-home-presentation.v1.json').cages;

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

test('P0: Data Arena eligibility keeps twin individuals distinct by instanceId and never lets rentals impersonate owned partners', () => {
  const roster = [
    { id: 'agumon', speciesId: 'species-034' },
    { id: 'gabumon', speciesId: 'species-061' },
    { id: 'gaomon', speciesId: 'species-064' }
  ];
  const progress = {
    registeredSpecies: [34, 61],
    ownedSpecies: ['species-034'],
    ownedInstances: [
      { speciesId: 'species-034', instanceId: 'inst-A', displayName: '烈焰丸', trainingTendency: 'SKILL', tactic: 0 },
      { speciesId: 'species-034', instanceId: 'inst-B', displayName: '鐵壁丸', trainingTendency: 'ENDURANCE', tactic: 1 }
    ]
  };

  // Default picks first held when no explicit selection is passed, while exposing both owned twins.
  const initial = dataArenaEntries(roster, progress);
  const aguDefault = initial.find((r) => r.speciesId === 'species-034');
  assert.equal(aguDefault.entry, DATA_ARENA_ENTRY.BRED);
  assert.equal(aguDefault.instanceId, 'inst-A');
  assert.deepEqual(aguDefault.ownedInstances.map((x) => x.instanceId), ['inst-A', 'inst-B']);

  // Explicit instanceId selection binds to twin B — never silently reverts to twin A.
  const pickedB = dataArenaEntries(roster, progress, { 'species-034': 'inst-B' });
  const aguB = pickedB.find((r) => r.speciesId === 'species-034');
  assert.equal(aguB.instanceId, 'inst-B');
  assert.equal(aguB.selectedInstance.displayName, '鐵壁丸');
  assert.equal(aguB.selectedInstance.trainingTendency, 'ENDURANCE');

  // Registered-only and Rental partners keep instanceId = null and cannot impersonate owned instances.
  const gabu = pickedB.find((r) => r.speciesId === 'species-061');
  const gao = pickedB.find((r) => r.speciesId === 'species-064');
  assert.equal(gabu.entry, DATA_ARENA_ENTRY.REGISTERED);
  assert.equal(gabu.instanceId, null);
  assert.deepEqual(gabu.ownedInstances, []);
  assert.equal(gao.entry, DATA_ARENA_ENTRY.RENTAL);
  assert.equal(gao.instanceId, null);
  assert.deepEqual(gao.ownedInstances, []);
});

test('P1: explicit tactic precedence (manual > trainingTendency > legacy > default) and cage ecology mapping', () => {
  assert.equal(tendencyToTactic('ENDURANCE'), 1);
  assert.equal(tendencyToTactic('SKILL'), 0);
  assert.equal(tendencyToTactic(null), null);

  assert.equal(resolveEffectiveBattleTactic({ manualTactic: 2, trainingTendency: { kind: 'SKILL' }, legacyTactic: 1 }), 2);
  assert.equal(resolveEffectiveBattleTactic({ manualTactic: 1, trainingTendency: { kind: 'SKILL' }, legacyTactic: 0 }), 1);
  assert.equal(resolveEffectiveBattleTactic({ manualTactic: null, trainingTendency: { kind: 'SKILL' }, legacyTactic: 2 }), 0);
  assert.equal(resolveEffectiveBattleTactic({ manualTactic: null, trainingTendency: { kind: 'ENDURANCE' }, legacyTactic: 0 }), 1);
  assert.equal(resolveEffectiveBattleTactic({ manualTactic: null, trainingTendency: null, legacyTactic: 2 }), 2);
  assert.equal(resolveEffectiveBattleTactic({ manualTactic: null, trainingTendency: null, legacyTactic: null }), 1);

  assert.equal(tendencyForCageEcology('gym'), 'SKILL');
  assert.equal(tendencyForCageEcology('sports'), 'SKILL');
  assert.equal(tendencyForCageEcology('volcano'), 'SKILL');
  assert.equal(tendencyForCageEcology('garden'), 'ENDURANCE');
  assert.equal(tendencyForCageEcology('forest'), 'ENDURANCE');
  assert.equal(tendencyForCageEcology(null), null);

  assert.deepEqual(normalizePartnerTendencies(undefined), {});
  assert.deepEqual(normalizePartnerTendencies({ bad: { kind: 'INVALID' }, ok: { kind: 'SKILL', source: 'RANCH_DRILL' } }), {
    ok: { kind: 'SKILL', source: 'RANCH_DRILL' }
  });
});

test('P0+P1: app persists per-individual trainingTendency safely, isolates twin same-species individuals, and stays backward compatible on reload', async () => {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  const makeApp = () => createChampionshipStandaloneApp({
    storage,
    catalog: CATALOG,
    cages: CAGES,
    rngClock: () => ({ hour: 13, minute: 20, second: 50 })
  });
  const app = makeApp();
  try {
    await app.newGame();
    app.save();
    // Inject a second twin of the exact same species (species-053) into the save so we verify true twin isolation.
    const [saveKey, saveText] = [...map.entries()][0];
    const save = JSON.parse(saveText);
    const twinProfileA = nativeIndividualProfile(createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(53), rng: { next: () => 11 } }));
    const twinProfileB = nativeIndividualProfile(createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(53), rng: { next: () => 29 } }));
    save.creature.speciesId = 'species-053';
    save.creature.nativeProfile = twinProfileA;
    save.raising = save.raising || { collection: [], assignments: {}, interactions: {} };
    save.raising.collection = Array.isArray(save.raising.collection) ? save.raising.collection : [];
    save.raising.collection.push({
      instanceId: 'twin-b-53',
      speciesId: 'species-053',
      displayName: '鐵壁二號',
      nativeProfile: twinProfileB
    });
    map.set(saveKey, JSON.stringify(save));
    await app.continueGame();

    const instances = app.getRaisingInstances();
    assert.ok(instances.length >= 2, `Expected >=2 instances, got ${instances.length}`);
    const idA = instances[0].instanceId;
    const idB = instances[1].instanceId;
    assert.notEqual(idA, idB);
    assert.equal(instances[0].speciesId, instances[1].speciesId);

    // Default state for both twins
    assert.equal(app.getPartnerTrainingTendency(idA), null);
    assert.equal(app.getPartnerTrainingTendency(idB), null);
    assert.equal(app.getBattleTactic(idA), 1);
    assert.equal(app.getBattleTactic(idB), 1);

    // Setting SKILL drill on twin A does NOT modify twin B or stats/moves
    const beforeProfile = JSON.stringify(app.getCreature().nativeProfile);
    const setRes = app.setPartnerTrainingTendency(idA, 'SKILL');
    assert.equal(setRes.ok, true);
    assert.equal(app.getPartnerTrainingTendency(idA).kind, 'SKILL');
    assert.equal(app.getBattleTactic(idA), 0);
    assert.equal(app.getPartnerTrainingTendency(idB), null);
    assert.equal(app.getBattleTactic(idB), 1);
    assert.equal(JSON.stringify(app.getCreature().nativeProfile), beforeProfile);

    // Data Arena progress exposes both twins distinctly with their individual tendencies
    const daProgress = app.getDataArenaProgress();
    const twins = daProgress.ownedInstances.filter((x) => x.speciesId === 'species-053');
    assert.equal(twins.length, 2);
    assert.equal(twins.find((x) => x.instanceId === idA)?.trainingTendency, 'SKILL');
    assert.equal(twins.find((x) => x.instanceId === idB)?.trainingTendency, null);

    // Explicit match override takes precedence over ranch tendency on A only
    const overrideRes = app.setBattleTactic(idA, 1);
    assert.equal(overrideRes.ok, true);
    assert.equal(app.getBattleTactic(idA), 1);
    assert.equal(app.getPartnerTrainingTendency(idA).kind, 'SKILL');

    // Unknown individual is refused cleanly
    assert.equal(app.setPartnerTrainingTendency('nonexistent-id', 'ENDURANCE').ok, false);

    // Save & reload preserves trainingTendency for A while keeping B untouched
    app.save();
    await app.dispose();

    const reloaded = makeApp();
    try {
      await reloaded.continueGame();
      assert.equal(reloaded.getPartnerTrainingTendency(idA)?.kind, 'SKILL');
      assert.equal(reloaded.getPartnerTrainingTendency(idB), null);
      // On fresh load, session match override is cleared, so ranch SKILL tendency -> tactic 0 cleanly!
      assert.equal(reloaded.getBattleTactic(idA), 0);
      assert.equal(reloaded.getBattleTactic(idB), 1);

      // Clearing tendency restores default cleanly
      const cleared = reloaded.clearPartnerTrainingTendency(idA);
      assert.equal(cleared.ok, true);
      assert.equal(reloaded.getPartnerTrainingTendency(idA), null);
      assert.equal(reloaded.getBattleTactic(idA), 1);
    } finally {
      await reloaded.dispose();
    }
  } finally {
    await app.dispose();
  }
});

test('P1: controlled multi-seed real battle run compares ENDURANCE (tactic 1) vs SKILL (tactic 0) honestly', () => {
  // Controlled species-053 vs species-038 across 3 fixed deterministic seeds (identical stats/moves/personality).
  const runControlled = (tactic, seed) => {
    const pProfile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(53), rng: { next: () => 1007 } })));
    pProfile.fields['018'] = 2;
    const fProfile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(38), rng: { next: () => 2007 } })));
    fProfile.fields['018'] = 3;
    const runtime = createBattleRuntime({
      mode: 5,
      battleType: 0,
      seed,
      aiPolicy: 'IMPROVED_V1',
      personalityPolicy: 'ORIGINAL',
      burstPolicy: 'OFF',
      playerIndividuals: [{ instanceId: 'controlled-p1', nativeProfile: pProfile, tactic }],
      opponentIndividuals: [{ instanceId: 'controlled-foe', nativeProfile: fProfile, tactic: 1 }]
    });
    try {
      runtime.choosePracticeBattle({ arenaIndex: 2 });
      const view = runtime.startMatch();
      for (let t = 0; t < 60000 && !view.getView().outcome.ended; t++) view.tick();
      return runtime.getTacticRecord().local[0];
    } finally {
      runtime.dispose();
    }
  };

  let skillTotalOnSkillPlan = 0;
  let skillTotalOnEndurancePlan = 0;
  for (const seed of [3, 17, 42]) {
    const skillRun = runControlled(0, seed);
    const enduranceRun = runControlled(1, seed);
    assert.equal(skillRun.tactic, 0);
    assert.equal(enduranceRun.tactic, 1);
    skillTotalOnSkillPlan += skillRun.counts.skill;
    skillTotalOnEndurancePlan += enduranceRun.counts.skill;
  }
  assert.ok(
    skillTotalOnSkillPlan > skillTotalOnEndurancePlan,
    `Expected SKILL plan (${skillTotalOnSkillPlan}) to cast more skills than ENDURANCE plan (${skillTotalOnEndurancePlan}) under identical stats/moves/seeds`
  );
});

test('P1: battle record lines report actual counts, firstSkillAt, and honest same-individual comparison without fabricated praise', () => {
  const record = {
    local: [{
      slot: 0,
      instanceId: 'inst-A',
      speciesId: 'species-041',
      displayName: '電弧測試體',
      tactic: 0,
      total: 7,
      counts: { normal: 3, skill: 4, support: 0 },
      decisions: { total: 10, attack: 7, support: 0, reposition: 3 },
      moves: [{ moveId: 79, count: 4 }],
      firstSkillAt: 2.5,
      spEmptyAt: 14.2,
      downAt: null,
      tpLeft: 0,
      tpMax: 120
    }]
  };

  const diffLines = tacticRecordLines(record, {
    nameOf: () => '電弧測試體',
    moveName: () => '電光砲',
    previous: () => ({ tactic: 1, total: 9, counts: { normal: 8, skill: 1, support: 0 } }),
    locale: 'zh-Hant'
  });
  assert.ok(diffLines.some((l) => l === '出手 7　招式 4　走位 30%'), diffLines.join('\n'));
  assert.ok(diffLines.some((l) => l === '首次開招：2.5 秒'), diffLines.join('\n'));
  assert.ok(diffLines.some((l) => l === '上次「普通攻擊」：出手 9　招式 1'), diffLines.join('\n'));
  assert.ok(diffLines.every((l) => l.length <= 24), diffLines.join('\n'));

  // Identical plan does not fabricate a comparison line.
  const sameLines = tacticRecordLines(record, {
    nameOf: () => '電弧測試體',
    moveName: () => '電光砲',
    previous: () => ({ tactic: 0, total: 7, counts: { normal: 3, skill: 4, support: 0 } }),
    locale: 'zh-Hant'
  });
  assert.equal(sameLines.some((l) => l.startsWith('上次')), false);
});

test('P1: 5-locale coverage for PARTNER_TENDENCY_COPY and updated TACTIC_RECORD_COPY has zero gaps', () => {
  const c1 = inspectScopedLocaleCopy('src/championship/contracts/productPartnerTendency.js', PARTNER_TENDENCY_COPY);
  assert.deepEqual(c1.gaps, []);
  const c2 = inspectScopedLocaleCopy('src/championship/text/tacticRecordText.js', TACTIC_RECORD_COPY);
  assert.deepEqual(c2.gaps, []);
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    assert.ok(partnerTendencyText('kind.ENDURANCE', {}, locale).length > 0);
    assert.ok(partnerTendencyText('kind.SKILL', {}, locale).length > 0);
  }
});
