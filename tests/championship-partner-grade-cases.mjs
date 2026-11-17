import assert from 'node:assert/strict';
import test from 'node:test';
import {PARTNER_GRADES, GRADE_STATS, gradeFromNoise, rollPartnerGrade, normalizePartnerGrade, gradeHeadStartValue, applyGradeHeadStart}
  from '../src/championship/contracts/productLineFusion.js';
import {normalizeSyncLevels, grantSyncExp, reconcileSyncRebirth, recordPartnerGrade, partnerGradeOf, syncOf}
  from '../src/championship/contracts/productSyncLevel.js';
import {instinctNoise} from '../src/championship/contracts/productAwakeningOverdrive.js';

// LINE_FUSION_20261117 P1 (docs/planning/LINE_FUSION_AND_HUNT_HERDS_PLAN_2026-11-17_ZH_TW.md §3).

const hex = n => n.toString(16).padStart(3, '0');
const profileWith = (values) => {
  const fields = {'050': 0, '054': 0};
  GRADE_STATS.forEach((stat, i) => {
    const [value, lower, upper] = values[i];
    fields[stat.key] = value; fields[hex(0xa8 + stat.bound * 8)] = upper; fields[hex(0xac + stat.bound * 8)] = lower;
  });
  fields['050'] = fields['058']; fields['054'] = fields['05c'];
  return {fields};
};

test('grades land on S 5 %, A 20 %, B 35 %, C 40 % within 1 %', () => {
  const counts = {S: 0, A: 0, B: 0, C: 0}, n = 100000;
  for (let i = 0; i < n; i++) counts[gradeFromNoise(instinctNoise(0x50, i, 7, 280, 18, 18, 18, 18, 3))]++;
  for (const {id, weight} of PARTNER_GRADES) assert.ok(Math.abs(counts[id] / n * 100 - weight) < 1, `${id} ${counts[id]}`);
});

test('the same individual always rolls the same grade, an elite or ancestral one never below A', () => {
  const noise = salt => instinctNoise(salt, 3, 72, 460, 46, 40, 41, 44, 5);
  assert.deepEqual(rollPartnerGrade(noise), rollPartnerGrade(noise));
  for (let i = 0; i < 400; i++) {
    const keyed = salt => instinctNoise(salt, i, 20);
    const plain = rollPartnerGrade(keyed), elite = rollPartnerGrade(keyed, {instinct: 'ELITE'}), ancestor = rollPartnerGrade(keyed, {instinct: 'ANCESTOR'});
    assert.ok(['S', 'A'].includes(elite.grade) && ['S', 'A'].includes(ancestor.grade));
    if (plain.grade === 'S' || plain.grade === 'A') assert.deepEqual(elite, plain);
    for (const graded of [plain, elite]) {
      const [lo, hi] = PARTNER_GRADES.find(g => g.id === graded.grade).q;
      assert.equal(graded.q.length, 6);
      assert.ok(graded.q.every(q => Number.isSafeInteger(q) && q >= lo && q <= hi));
    }
  }
});

test('the head start stays between the native value and the upper bound', () => {
  // Species 20 attack: lower 18, upper 29 -> C 18-19, B 20-21, A 21-22, S 22.
  const at = q => gradeHeadStartValue({value: 18, lower: 18, upper: 29, unit: 1}, q);
  assert.deepEqual([at(0), at(34), at(35), at(64), at(65), at(84), at(85), at(100)], [18, 19, 19, 20, 20, 21, 21, 22]);
  assert.equal(gradeHeadStartValue({value: 27, lower: 18, upper: 29, unit: 1}, 100), 27, 'never lowers a native roll');
  assert.equal(gradeHeadStartValue({value: 280, lower: 280, upper: 510, unit: 10}, 100), 370, 'HP moves in units of ten');
  for (let q = 0; q <= 100; q++) {
    const value = gradeHeadStartValue({value: 46, lower: 46, upper: 77, unit: 1}, q);
    assert.ok(value >= 46 && value <= 77);
  }
});

test('applyGradeHeadStart writes the six stats, fills HP/TP and leaves the source profile alone', () => {
  const source = profileWith([[280, 280, 510], [40, 40, 70], [18, 18, 29], [18, 18, 29], [20, 18, 29], [29, 18, 29]]);
  const frozen = structuredClone(source);
  const {profile, gains} = applyGradeHeadStart(source, {grade: 'S', q: [100, 100, 100, 100, 85, 100]});
  assert.deepEqual(source, frozen);
  const f = profile.fields;
  assert.equal(f['058'], 370); assert.equal(f['050'], 370);
  assert.equal(f['05c'], 52); assert.equal(f['054'], 52);
  assert.equal(f['060'], 22); assert.equal(f['068'], 21);
  assert.equal(f['06c'], 29, 'already at its upper bound');
  assert.ok(gains.every(g => g.after > g.before));
  assert.equal(applyGradeHeadStart(source, {grade: 'S', q: [1, 2, 3]}).gains.length, 0, 'a malformed grade does nothing');
});

test('grades are saved with the Sync record and survive EXP, rebirth and a reload', () => {
  assert.equal(normalizePartnerGrade({grade: 'S', q: [84, 90, 90, 90, 90, 90]}), null, 'q outside its grade');
  assert.equal(normalizePartnerGrade({grade: 'X', q: [0, 0, 0, 0, 0, 0]}), null);
  let state = recordPartnerGrade(normalizeSyncLevels(null), 'p1', {grade: 'A', q: [65, 70, 75, 80, 84, 66]});
  assert.equal(partnerGradeOf(state, 'p1').grade, 'A');
  state = recordPartnerGrade(state, 'p1', {grade: 'C', q: [0, 0, 0, 0, 0, 0]});
  assert.equal(partnerGradeOf(state, 'p1').grade, 'A', 'a grade is recorded once');
  state = grantSyncExp(state, 'p1', 5000).state;
  assert.ok(syncOf(state, 'p1').level > 1);
  state = reconcileSyncRebirth(state, 'p1', 1);
  assert.deepEqual(partnerGradeOf(JSON.parse(JSON.stringify(state)), 'p1'), {grade: 'A', q: [65, 70, 75, 80, 84, 66]});
  assert.equal(partnerGradeOf(state, 'old'), null, 'a partner from before grades has none');
  const broken = normalizeSyncLevels({version: 1, partners: {p2: {level: 3, exp: 0, rebirths: 0, grade: {grade: 'S', q: 'high'}}}, crystals: 0});
  assert.deepEqual(broken.partners.p2, {level: 3, exp: 0, rebirths: 0}, 'an unknown grade shape is dropped, the level kept');
});
