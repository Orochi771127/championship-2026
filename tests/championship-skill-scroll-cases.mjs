import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {normalizeCyberGacha, pullCyberGacha, imprintGachaScroll, engraveGachaScroll, GACHA_BITS_MACHINE_RATES}
  from '../src/championship/gacha/cyberGacha.js';
import {SKILL_SCROLLS, SKILL_SCROLL_BASIC_SKILLS, SKILL_SCROLL_GRADES, scrollCanHold, skillScrollCategory, getSkillScroll}
  from '../src/championship/gacha/skillScrolls.js';
import {listMoveRecordsForCombatant} from '../src/championship/battle/battleCatalogs.js';
import {buildCandidateBuckets} from '../src/championship/battle/battleCandidateBuckets.js';

// Skill imprint scrolls, SKILL_IMPRINT_SCROLL 2026-11-17 (docs/planning/SKILL_IMPRINT_SCROLL_PLAN_2026-11-17_ZH_TW.md).

const profile = (skillI, skillII, extra = {}) => ({fields: {'000': 40, '018': 2, '060': 33, '12c': skillI, '130': skillII, ...extra},
  narrowFields: {'03c': 0}, name: 'テスト'});
const owning = (scrolls) => normalizeCyberGacha({version: 1, scrolls});
// A small deterministic generator for rate checks.
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

test('the catalogue: two blanks, 13 standard imprints, 30 holo imprints; the standard grade holds basic skills only', () => {
  assert.equal(SKILL_SCROLLS.length, 2 + 13 + 30);
  assert.equal(SKILL_SCROLL_BASIC_SKILLS.length, 13);
  assert.ok(scrollCanHold('SR', 3) && !scrollCanHold('SR', 4), '治癒 β is basic, 治癒 γ is not');
  assert.ok(scrollCanHold('SSR', 29) && !scrollCanHold('SR', 29), 'only the holo scroll holds 復活 β');
  assert.ok(!scrollCanHold('SSR', 0) && !scrollCanHold('SSR', 31) && !scrollCanHold('UR', 3), 'never a species move or a third grade');
  assert.deepEqual([1, 2, 8, 10, 18, 28, 30].map(skillScrollCategory), ['OTHER', 'HEAL', 'CLEANSE', 'BUFF', 'RESIST', 'REVIVE', 'OTHER']);
  for (const grade of Object.values(SKILL_SCROLL_GRADES)) {
    for (const art of [grade.blankArt, grade.imprintedArt]) assert.ok(existsSync(new URL(`../${art}`, import.meta.url)), art);
  }
});

test('imprinting copies a skill off partner A without touching A', () => {
  const a = profile(3, 12);
  const before = JSON.stringify(a);
  const done = imprintGachaScroll(owning({'scroll:blank:SR': 2}), {grade: 'SR', profile: a, slot: '130'});
  assert.equal(done.ok, true);
  assert.deepEqual([done.scrollId, done.skill, done.slot], ['scroll:SR:12', 12, '130']);
  assert.deepEqual(done.state.scrolls, {'scroll:blank:SR': 1, 'scroll:SR:12': 1});
  assert.equal(JSON.stringify(a), before, 'A keeps both skills, byte for byte');
  assert.equal(imprintGachaScroll(owning({'scroll:blank:SR': 1}), {grade: 'SR', profile: a}).reason, 'CHOOSE_SLOT');
  assert.equal(imprintGachaScroll(owning({'scroll:blank:SR': 1}), {grade: 'SR', profile: profile(0, 0)}).reason, 'NO_SPECIAL_SKILL');
  assert.equal(imprintGachaScroll(owning({'scroll:blank:SR': 1}), {grade: 'SR', profile: profile(29, 0)}).reason, 'NEEDS_HOLO');
  assert.equal(imprintGachaScroll(owning({'scroll:blank:SSR': 1}), {grade: 'SSR', profile: profile(29, 0)}).scrollId, 'scroll:SSR:29');
  assert.equal(imprintGachaScroll(owning({}), {grade: 'SR', profile: a, slot: '12c'}).reason, 'NOT_OWNED');
  assert.equal(imprintGachaScroll(owning({'scroll:blank:SR': 1}), {grade: 'SR', profile: profile(3, 0), slot: '130'}).reason, 'SLOT_EMPTY');
});

test('engraving writes one special-skill word and nothing else', () => {
  const b = profile(14, 0);
  const done = engraveGachaScroll(owning({'scroll:SR:3': 1}), {scrollId: 'scroll:SR:3', profile: b});
  assert.equal(done.ok, true);
  assert.deepEqual([done.slot, done.skill, done.replaced], ['130', 3, null], 'the empty slot comes first');
  assert.deepEqual(done.profile, {...b, fields: {...b.fields, '130': 3}});
  assert.equal(done.state.scrolls, undefined, 'the last scroll is spent and the key drops out');
  const full = profile(14, 16);
  assert.equal(engraveGachaScroll(owning({'scroll:SR:3': 1}), {scrollId: 'scroll:SR:3', profile: full}).reason, 'CHOOSE_SLOT');
  const over = engraveGachaScroll(owning({'scroll:SR:3': 1}), {scrollId: 'scroll:SR:3', profile: full, slot: '12c'});
  assert.deepEqual([over.slot, over.replaced, over.profile.fields['12c'], over.profile.fields['130']], ['12c', 14, 3, 16]);
  assert.equal(engraveGachaScroll(owning({'scroll:SR:14': 1}), {scrollId: 'scroll:SR:14', profile: full}).reason, 'SKILL_DUPLICATE');
  assert.equal(engraveGachaScroll(owning({'scroll:blank:SR': 1}), {scrollId: 'scroll:blank:SR', profile: b}).reason, 'UNKNOWN_SCROLL');
  assert.equal(engraveGachaScroll(owning({}), {scrollId: 'scroll:SR:3', profile: b}).reason, 'NOT_OWNED');
});

test('an engraved skill reaches the battle move list and the AI candidate buckets', () => {
  const engraved = engraveGachaScroll(owning({'scroll:SSR:28': 1}), {scrollId: 'scroll:SSR:28', profile: profile(14, 0)}).profile;
  const combatant = {speciesId: 40, source12C: engraved.fields['12c'], source130: engraved.fields['130']};
  assert.ok(listMoveRecordsForCombatant(combatant).some(move => move.recordIndex === 28), '復活 α is appended to the moves');
  const buckets = buildCandidateBuckets([combatant.source12C, combatant.source130]);
  assert.ok(JSON.stringify(buckets).includes('28'), 'and filed for the AI like a captured skill');
});

test('the save keeps its old shape until a scroll is owned and refuses unknown scroll ids', () => {
  const plain = normalizeCyberGacha({version: 1, tickets: 3});
  assert.equal(Object.hasOwn(plain, 'scrolls'), false);
  assert.throws(() => normalizeCyberGacha({version: 1, scrolls: {'scroll:SR:4': 1}}), /UNKNOWN_GACHA_ITEM/, '治癒 γ never sits on a standard scroll');
  assert.throws(() => normalizeCyberGacha({version: 1, scrolls: {'scroll:SSR:31': 1}}), /UNKNOWN_GACHA_ITEM/);
  assert.deepEqual(normalizeCyberGacha({version: 1, scrolls: {'scroll:SSR:7': 5000, 'scroll:SR:3': 0}}).scrolls, {'scroll:SSR:7': 999});
});

test('rates: premium SR about 2.57%, SSR about 0.92%; the Bits machine 1%', () => {
  const bitsRate = GACHA_BITS_MACHINE_RATES.find(([slot]) => slot === 'scroll:blank:SR')[1];
  assert.ok(Math.abs(bitsRate - 0.01) < 1e-12);
  assert.ok(Math.abs(GACHA_BITS_MACHINE_RATES.reduce((sum, [, weight]) => sum + weight, 0) - 1) < 1e-12, 'the Bits table still sums to 1');
  const random = lcg(20261117), counts = {SR: 0, SSR: 0}, pulls = 400_000;
  let state = normalizeCyberGacha({version: 1, tickets: 9999});
  for (let i = 0; i < pulls; i += 1) {
    const prize = pullCyberGacha(state, {machine: 'PREMIUM', count: 1, random}).prizes[0];
    if (prize.kind === 'SCROLL') counts[getSkillScroll(prize.id).grade] += 1;
  }
  assert.ok(Math.abs(counts.SR / pulls - 0.28 * 0.85 * 0.9 * 0.12) < 0.001, `SR ${counts.SR / pulls}`);
  assert.ok(Math.abs(counts.SSR / pulls - 0.10 * 0.85 * 0.9 * 0.12) < 0.0006, `SSR ${counts.SSR / pulls}`);
});

test('the four scroll icons are registered original art', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/production/items/skill-scrolls-r1/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.rightsStatus, 'ORIGINAL_GENERATED');
  assert.equal(manifest.files.length, 4);
  const index = JSON.parse(readFileSync(new URL('../assets/production/ART_PRODUCTION_INDEX.json', import.meta.url), 'utf8'));
  assert.ok(index.entries.some(entry => entry.assetId === 'art:gacha:skill-scrolls:r1' && entry.runtimeEligible === true));
});
