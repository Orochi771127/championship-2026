// TAMER_TALENTS_T6_20261118: the breeder keystone 傳承 (fusion plan P4).
// A fusion also hands the base one unit of each stat the fodder's quality is above the base's, never past the
// individual's own upper bound, and only for a tamer who took the keystone.
// Plans: docs/planning/LINE_FUSION_AND_HUNT_HERDS_PLAN_2026-11-17_ZH_TW.md (P4),
//        docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md section 4.2.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {fusionInheritance, FUSION_INHERIT_DEFAULT_Q, GRADE_STATS} from '../src/championship/contracts/productLineFusion.js';
import {TALENT_NODES, TALENT_WIRED_KEYSTONES, talentOpen} from '../src/championship/contracts/productTamerTalents.js';
import {TAMER_TALENT_COPY, talentKeystoneText} from '../src/championship/text/tamerTalentText.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const grade = (id, q) => ({grade: id, q: Array(6).fill(q)});
// Six stats and their upper bounds (0a8, 0b0, 0b8, 0c0, 0c8, 0d0); defence is already at its bound.
const profile = () => ({fields: {'058': 100, '050': 80, '05c': 20, '054': 20, '060': 10, '064': 10, '068': 10, '06c': 10,
  '0a8': 115, '0b0': 21, '0b8': 12, '0c0': 10, '0c8': 99, '0d0': 99}});

test('傳承 is an open keystone with a line of copy in five languages', () => {
  assert.ok(TALENT_WIRED_KEYSTONES.has('breeder.inherit') && talentOpen('breeder.inherit'));
  for (const locale of Object.keys(TAMER_TALENT_COPY)) assert.ok(talentKeystoneText('breeder.inherit', locale).length > 0, locale);
  assert.equal(talentOpen('breeder.extract'), false);
});

test('each stat the fodder is better at gives the base one unit, inside the upper bound; HP and TP raise their current value too', () => {
  assert.deepEqual(GRADE_STATS.map(stat => [stat.key, stat.unit]), [['058', 10], ['05c', 1], ['060', 1], ['064', 1], ['068', 1], ['06c', 1]]);
  const source = profile(), frozen = structuredClone(source);
  const one = fusionInheritance(source, grade('B', 40), [grade('A', 70)]);
  assert.deepEqual(source, frozen, 'the profile handed in is not changed');
  assert.deepEqual(one.gains, [{key: '058', before: 100, after: 110}, {key: '05c', before: 20, after: 21}, {key: '060', before: 10, after: 11},
    {key: '068', before: 10, after: 11}, {key: '06c', before: 10, after: 11}], 'defence is at its upper bound: no gain');
  assert.deepEqual([one.profile.fields['050'], one.profile.fields['054'], one.profile.fields['064']], [90, 21, 10]);
  // Two fodders: two units, stopped by the bound (HP 115, TP 21, attack 12).
  const two = fusionInheritance(source, grade('B', 40), [grade('A', 70), grade('S', 90)]);
  assert.deepEqual([two.profile.fields['058'], two.profile.fields['050'], two.profile.fields['05c'], two.profile.fields['060'], two.profile.fields['068']], [115, 95, 21, 12, 12]);
});

test('a fodder that is not better, or has no grade, hands over nothing; a base without a grade counts as quality 50', () => {
  assert.equal(FUSION_INHERIT_DEFAULT_Q, 50);
  assert.deepEqual(fusionInheritance(profile(), grade('B', 40), [grade('C', 30)]).gains, []);
  assert.deepEqual(fusionInheritance(profile(), grade('B', 40), [grade('B', 40)]).gains, [], 'equal is not better');
  assert.deepEqual(fusionInheritance(profile(), grade('B', 40), [null, {grade: 'A', q: [70]}, 'A']).gains, []);
  assert.deepEqual(fusionInheritance(profile(), grade('B', 40), []).gains, []);
  assert.equal(fusionInheritance(profile(), null, [grade('B', 55)]).gains.length, 5);
  assert.deepEqual(fusionInheritance(profile(), null, [grade('B', 45)]).gains, []);
  // Quality is per stat: only the stats where the fodder is ahead.
  const mixed = fusionInheritance(profile(), {grade: 'B', q: [40, 60, 40, 40, 60, 40]}, [{grade: 'B', q: [50, 50, 50, 50, 50, 50]}]);
  assert.deepEqual(mixed.gains.map(gain => gain.key), ['058', '060', '06c']);
  assert.deepEqual(fusionInheritance(null, null, [grade('A', 70)]).gains, []);
});

// ---- the app ----

const idOf = n => `championship:2026:instance:000${n}`;
const BREEDER = TALENT_NODES.filter(node => node.line === 'breeder' && talentOpen(node.id)).map(node => node.id);
const talents = keystone => ({version: 1, level: 50, exp: 0, nodes: Object.fromEntries(BREEDER.map(id => [id, 3])), keystones: keystone ? {breeder: 'breeder.inherit'} : {}, respecs: 0});
async function fusionApp(keystone, {failing = false} = {}) {
  const data = new Map(), storage = {failing: false, getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key),
    setItem(key, value) { if (this.failing) throw new Error('QUOTA'); data.set(key, value); }};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = () => createChampionshipStandaloneApp({storage, locks: null, cages, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-11-18T00:00:00.000Z'});
  const first = make(); await first.newGame(); first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  save.progression.tamerTalents = talents(keystone);
  const row = n => save.raising.collection.find(entry => entry.instanceId === idOf(n));
  row(2).nativeProfile.fields['000'] = 87; row(2).speciesId = 'species-087';
  // The fodder is an A in every stat; the base has no grade, so it counts as 50.
  save.progression.syncLevels = {version: 1, crystals: 0, partners: {[idOf(2)]: {level: 1, exp: 0, grade: grade('A', 70)}}};
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make(); await app.continueGame();
  const saved = () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const baseProfile = doc => (doc.creature.creatureId === idOf(1) ? doc.creature : doc.raising.collection.find(entry => entry.instanceId === idOf(1))).nativeProfile;
  return {app, storage, saved, baseProfile};
}

test('app: with 傳承 a ranch fusion writes the base in the fusion save, shows it in the preview, and a failed save changes nothing', async () => {
  const {app, storage, saved, baseProfile} = await fusionApp(true);
  try {
    assert.equal(app.getPartnerGrade(idOf(2)).grade, 'A');
    const before = baseProfile(saved()), expected = fusionInheritance(before, null, [grade('A', 70)]);
    assert.ok(expected.gains.length > 0, 'the QA base has room under its bounds');
    const preview = app.previewPartnerFusion(idOf(1), [idOf(2)]);
    assert.deepEqual(preview.inherit, expected.gains);
    storage.failing = true;
    assert.equal(app.fusePartners(idOf(1), [idOf(2)]).reason, 'SAVE_FAILED');
    storage.failing = false;
    assert.deepEqual(app.previewPartnerFusion(idOf(1), [idOf(2)]).inherit, expected.gains, 'the failed save left the base as it was');
    const done = app.fusePartners(idOf(1), [idOf(2)]);
    assert.equal(done.ok, true, done.reason); assert.deepEqual(done.inherit, expected.gains);
    const after = baseProfile(saved());
    for (const gain of expected.gains) assert.equal(after.fields[gain.key], gain.after, gain.key);
    for (const stat of GRADE_STATS) assert.ok(after.fields[stat.key] <= after.fields[(0xa8 + stat.bound * 8).toString(16).padStart(3, '0')], `${stat.key} inside its bound`);
    assert.equal(saved().raising.collection.some(entry => entry.instanceId === idOf(2)), false, 'the fodder left in the same save');
  } finally { await app.dispose(); }
});

test('app: without the keystone a fusion pays Sync EXP only and the base keeps its stats', async () => {
  const {app, saved, baseProfile} = await fusionApp(false);
  try {
    const before = structuredClone(baseProfile(saved()));
    assert.deepEqual(app.previewPartnerFusion(idOf(1), [idOf(2)]).inherit, []);
    const done = app.fusePartners(idOf(1), [idOf(2)]);
    assert.equal(done.ok, true); assert.deepEqual(done.inherit, []);
    for (const stat of GRADE_STATS) assert.equal(baseProfile(saved()).fields[stat.key], before.fields[stat.key], stat.key);
  } finally { await app.dispose(); }
});

test('the Hunt Result fusions hand over on the candidates only, and both previews say how many stats rise', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /let candidateCreature = creature;\s*for \(const fusion of stagedFusions\) \{/);
  assert.match(app, /const inherited = fusionInheritOf\(fusion\.baseId, profile, \[fusion\.grade\]\);/);
  assert.match(app, /status = savePort\.save\(\{ snapshot: candidateSnapshot, creature: candidateCreature, sessionId,/);
  assert.match(app, /raising = candidateRaising; creature = candidateCreature; instanceIdentity = candidateIdentity; revision \+= 1;/);
  assert.match(app, /if\(!profile\|\|!hasKeystone\(talentState\(\),'breeder\.inherit'\)\)return null;/);
  assert.match(source('src/championship/app/digimonListScreen.js'), /preview\.inherit\?\.length \? uiText\("FUSION_INHERIT", \{ n: number\(preview\.inherit\.length\) \}\) : null/);
  assert.match(source('src/championship/app/vs3Screens.js'), /uiText\("FUSION_INHERIT", \{ n: preview\.inherit\.length \}\)/);
  assert.match(source('src/championship/app/digimonListScreen.js'), /result\.inherit\?\.length \? ` · \$\{uiText\("FUSION_INHERIT", \{ n: number\(result\.inherit\.length\) \}\)\}` : ""/, 'the receipt names it too');
  for (const file of ['uiText.js', 'uiText.en.js', 'uiText.ja.js', 'uiText.th.js', 'uiText.vi.js'])
    assert.ok(source(`src/championship/text/${file}`).includes('"FUSION_INHERIT":'), file);
});
