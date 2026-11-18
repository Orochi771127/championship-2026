// ROADMAP_R2_20261118 (Owner 2026-11-18: 「進化的條件也再多一個就是幾等的時候可以進化」): a partner whose own
// conditions already choose a next form evolves only at its stage's Sync Level. The level never picks the branch;
// the existing conditions still do. Plan: docs/planning/TAMER_PROGRESSION_ROADMAP_2026-11-18_ZH_TW.md, batch R2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRODUCT_GROWTH_RULES, productGeneration} from '../src/championship/contracts/productGrowthRules.js';
import {evaluateProductEvolution} from '../src/championship/raising/productGrowthPolicy.js';
import {nativeEvolutionRequirements} from '../src/championship/raising/nativeRaisingLifecycle.js';
import {normalizeNativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeRaisingStarter} from '../src/championship/raising/nativeRaisingStarter.js';
import {restoreChannelRng} from '../src/championship/battle/battleRngChannel.js';
import {EVOLUTION_LEVEL_GATES, EVOLUTION_LEVEL_RECHECK_MINUTES, evolutionLevelGate, evolutionLevelShort, SYNC_LEVEL_MAX,
  syncExpRequired, syncBattleExp} from '../src/championship/contracts/productSyncLevel.js';
import {uiText} from '../src/championship/text/uiText.js';
import {setLocale} from '../src/championship/text/locale.js';

const care = JSON.parse(fs.readFileSync('docs/research/RAISING_CARE_CPU_CHECK_2026-09-08.json', 'utf8'));
const starter = () => createNativeRaisingStarter(restoreChannelRng(care.starterRng));
const source = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const noDraw = {next: () => 0};
const context = (index, extra = {}) => ({rank: 9, roster: [index], lifetime: false, lifeThreshold: PRODUCT_GROWTH_RULES.species[index].life, ...extra});

/** A partner of `index` that meets every condition of its rule `ruleIndex` (no ancestry, so no draw decides). */
function ready(index, ruleIndex) {
  const rule = PRODUCT_GROWTH_RULES.rules[index - 8][ruleIndex], t = rule.thresholds, req = nativeEvolutionRequirements(rule);
  const p = structuredClone(starter()); p.fields['000'] = index;
  for (let g = 1; g <= 5; g++) { p.fields[(0x140 + g * 4).toString(16)] = 228; p.fields[(0x158 + g * 4).toString(16)] = 228; }
  for (const {field, minimum} of req.counts) p.fields[field] = Math.max(p.fields[field] | 0, minimum);
  for (const {field, minimum} of req.stats) p.fields[field] = Math.max(p.fields[field] | 0, minimum);
  p.fields['024'] = Math.max(t[22], 1); p.fields['028'] = p.fields['024'];
  p.narrowFields['03c'] = t[24];
  p.narrowFields['03d'] = rule.kind === 1 ? t[25] : 0;
  p.fields['04c'] = 0;
  return normalizeNativeIndividualProfile(p);
}
/** Every (species, rule) of a stage whose prepared partner the native rules really evolve. */
function evolving(generation, {lifetime = false} = {}) {
  const found = [];
  PRODUCT_GROWTH_RULES.rules.forEach((list, offset) => {
    const index = offset + 8;
    if (!list?.length || productGeneration(index) !== generation) return;
    list.forEach((rule, ruleIndex) => {
      if ((rule.kind === 1) !== lifetime) return;
      const profile = ready(index, ruleIndex);
      const native = evaluateProductEvolution(profile, context(index, {lifetime}), noDraw);
      if (native.code === 1) found.push({index, ruleIndex, profile, native});
    });
  });
  return found;
}

test('the gates: 幼年期 II evolves at Lv.3, 成長期 at Lv.10, 幼年期 I and the egg have none', () => {
  assert.deepEqual({...EVOLUTION_LEVEL_GATES}, {2: 3, 3: 10});
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(evolutionLevelGate), [1, 1, 3, 10, 1, 1, 1]);
  assert.equal(EVOLUTION_LEVEL_RECHECK_MINUTES, 60);
  assert.equal(evolutionLevelShort(3, 10), null);
  assert.equal(evolutionLevelShort(3, SYNC_LEVEL_MAX), null);
  assert.deepEqual(evolutionLevelShort(3, 9), {need: 10, level: 9});
  assert.deepEqual(evolutionLevelShort(2, 1), {need: 3, level: 1});
  assert.deepEqual(evolutionLevelShort(3, undefined), {need: 10, level: 1}, 'a partner with no record is Lv.1');
  assert.equal(evolutionLevelShort(1, 1), null);
  // The first gate is a short road: six won free battles from Lv.1 (two levels at 40 % a win).
  let wins = 0;
  for (let lv = 1; lv < EVOLUTION_LEVEL_GATES[2]; lv++) wins += Math.ceil(syncExpRequired(lv) / syncBattleExp(lv, {kind: 'FREE', won: true}));
  assert.equal(wins, 6);
});

test('成長期: ready partners wait under Lv.10 with nothing changed, and evolve at Lv.10 into the same form', () => {
  const cases = evolving(3);
  assert.ok(cases.length >= 40, `prepared ${cases.length} routes`);
  for (const {index, ruleIndex, profile, native} of cases) {
    const waiting = evaluateProductEvolution(profile, context(index, {syncLevel: 9}), noDraw);
    assert.deepEqual([waiting.code, waiting.target], [0, null], `${index}/${ruleIndex}`);
    assert.deepEqual(waiting.levelBlocked, {need: 10, level: 9});
    assert.deepEqual(waiting.profile, normalizeNativeIndividualProfile(profile), 'the profile does not move');
    assert.equal(waiting.actor['428'], PRODUCT_GROWTH_RULES.species[index].life, 'its life is not shortened or stretched');
    const evolved = evaluateProductEvolution(profile, context(index, {syncLevel: 10}), noDraw);
    assert.deepEqual([evolved.code, evolved.target, evolved.actor['1f4']], [1, native.target, native.actor['1f4']], 'the level never picks the branch');
    assert.equal(evolved.levelBlocked, undefined);
  }
});

test('the end of a life: a ready partner under its level lives on and is asked again in an hour', () => {
  const young = evolving(2, {lifetime: true});
  assert.ok(young.length >= 5, `prepared ${young.length} 幼年期 II routes`);
  for (const {index, profile, native} of young) {
    const aged = structuredClone(profile); aged.fields['18c'] = PRODUCT_GROWTH_RULES.species[index].life + 5;
    const waiting = evaluateProductEvolution(aged, context(index, {lifetime: true, syncLevel: 2}), noDraw);
    assert.deepEqual([waiting.code, waiting.target], [2, null], `${index}: life goes on`);
    assert.deepEqual(waiting.levelBlocked, {need: 3, level: 2});
    assert.equal(waiting.actor['428'], aged.fields['18c'] + EVOLUTION_LEVEL_RECHECK_MINUTES);
    assert.equal(waiting.profile.fields['04c'], 0, 'the one native life extension is not used up');
    const evolved = evaluateProductEvolution(aged, context(index, {lifetime: true, syncLevel: 3}), noDraw);
    assert.deepEqual([evolved.code, evolved.target], [1, native.target]);
  }
  // 幼年期 I has no gate: at Lv.1 it evolves at the end of its life as before.
  const babies = evolving(1, {lifetime: true});
  assert.ok(babies.length >= 5);
  for (const {index, profile, native} of babies) {
    const result = evaluateProductEvolution(profile, context(index, {lifetime: true, syncLevel: 1}), noDraw);
    assert.deepEqual([result.code, result.target], [1, native.target], `${index}`);
  }
});

test('everything else the native rules decide passes through untouched', () => {
  // not ready: the same answer with and without a level (the first species whose emptied partner the rules refuse)
  const blank = index => { const p = structuredClone(starter()); p.fields['000'] = index;
    for (let g = 1; g <= 5; g++) { p.fields[(0x140 + g * 4).toString(16)] = 228; p.fields[(0x158 + g * 4).toString(16)] = 228; }
    p.fields['024'] = 0; p.fields['028'] = 0; return normalizeNativeIndividualProfile(p); };
  const {index, profile} = evolving(3).find(row => evaluateProductEvolution(blank(row.index), context(row.index), noDraw).code !== 1);
  const unready = blank(index);
  const refused = evaluateProductEvolution(unready, context(index), noDraw);
  assert.notEqual(refused.code, 1);
  assert.deepEqual(evaluateProductEvolution(unready, context(index, {syncLevel: 1}), noDraw), refused);
  // the end of a life under a licence too low (rank 0): every such answer is the native one
  let ends = 0;
  for (const row of evolving(3)) {
    const native = evaluateProductEvolution(blank(row.index), context(row.index, {lifetime: true, rank: 0}), noDraw);
    if (native.code === 1) continue;
    ends++;
    assert.deepEqual(evaluateProductEvolution(blank(row.index), context(row.index, {lifetime: true, rank: 0, syncLevel: 1}), noDraw), native, `${row.index}`);
  }
  assert.ok(ends > 0, 'some 成長期 partners end their life without a form at rank 0');
  // a full cage stays a full cage
  const crowded = context(index, {roster: [index, ...Array(40).fill(72)]});
  const native = evaluateProductEvolution(profile, crowded, noDraw);
  assert.equal(native.capacityBlocked, true);
  assert.deepEqual(evaluateProductEvolution(profile, {...crowded, syncLevel: 1}, noDraw), native);
  // a licence too low stays the native life extension
  const licence = evaluateProductEvolution(profile, context(index, {rank: 0}), noDraw);
  assert.equal(licence.code, 2);
  assert.deepEqual(evaluateProductEvolution(profile, context(index, {rank: 0, syncLevel: 1}), noDraw), licence);
  // 成熟期 never evolves, at any level
  const mature = structuredClone(profile); mature.fields['000'] = 72;
  assert.equal(evaluateProductEvolution(mature, context(72, {syncLevel: 1}), noDraw).code, 0);
});

test('the ranch, the catalyst and the screens read the gate; the playtest lifts it', () => {
  const app = source('src/championship/app/championshipStandaloneApp.js'), actor = source('src/championship/raising/nativeRaisingActor.js');
  assert.match(app, /syncLevel:playtestPolicy\?\.enabled===true\?null:\(\)=>syncLevelOf\(id\)\.level,/);
  assert.match(app, /if\(!route\)return gachaRefusal\('NO_EVOLUTION_ROUTE'\);\s+\/\/ R2:.*\s+if\(evolutionLevelNeed\(instanceId,index\)\)return gachaRefusal\('EVOLUTION_LEVEL_TOO_LOW'\);/);
  assert.match(app, /evolveLevel:actor\.levelBlocked\?evolutionLevelNeed\(id,fields\['000'\]\):null\}\);/);
  assert.match(app, /levelGate:evolutionLevelNeed\(entry\.instanceId,index\),/);
  assert.equal(actor.match(/syncLevel:context\.syncLevel\?context\.syncLevel\(\):null\},rng\);/g)?.length, 2, 'both evolution checks read the level, and only then');
  assert.equal(actor.match(/actor\.levelBlocked=selection\.levelBlocked\?\?null;/g)?.length, 2);
  assert.equal(app.match(/waiting\.evolutionChecked ?= ?false/g)?.length, 3, 'a battle, a fusion and a hunt ask again');
  assert.match(source('src/championship/raising/nativeTutorialRaisingActor.js'), /evaluateNativeEvolution\(profile,\{rank:0,roster:\[\],lifetime:false,lifeThreshold:0xffffffff\},rng\)/, 'the tutorial keeps the native rule');
  assert.match(source('src/championship/app/raisingHomeP1RView.js'), /int-rh2-companion__evolve-level/);
  assert.match(source('src/championship/app/cyberGachaView.js'), /EVOLUTION_LEVEL_TOO_LOW: "同步等級不足，金屬不能代替等級。"/);
  try {
    for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
      setLocale(locale);
      assert.match(uiText('進化需 Lv.{need}', {need: 10}), /Lv\.10/, locale);
      assert.match(uiText('進化需 Lv.{need}（現在 Lv.{level}）', {need: 10, level: 4}), /Lv\.10.*Lv\.4/, locale);
      assert.match(uiText('條件已達成。同步 Lv.{level}，Lv.{need} 進化；出戰或融合同種可升級。', {need: 3, level: 1}), /Lv\.1.*Lv\.3/, locale);
      assert.ok(uiText('同步等級不足，金屬不能代替等級。').length > 0);
    }
    setLocale('zh-Hant');
    assert.ok([...uiText('進化需 Lv.{need}', {need: 10})].length <= 24);
    assert.ok([...uiText('同步等級不足，金屬不能代替等級。')].length <= 24);
  } finally { setLocale('zh-Hant'); }
});
