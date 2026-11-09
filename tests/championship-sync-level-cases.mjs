import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SYNC_LEVEL_MAX, syncExpRequired, normalizeSyncLevels, syncOf, grantSyncExp, feedSyncCrystals, reconcileSyncRebirth,
  syncCapForRank, syncBattleExp, syncVitalPercent, syncArenaPower, syncCurveSteps, boostSyncNativeProfile, restoreSyncNativeProfile
} from '../src/championship/contracts/productSyncLevel.js';

function profile() {
  const fields = {};
  for (let i = 0; i < 0x1c8; i += 4) fields[i.toString(16).padStart(3, '0')] = 0;
  Object.assign(fields, { '000': 87, '050': 900, '058': 1000, '054': 60, '05c': 80, '084': 12, '088': 9, '08c': 25, '090': 4, '024': 3, '028': 2 });
  return { version: 1, fields, narrowFields: { '03c': 0, '03d': 0, '044': 0, '046': 0, '194': 0 }, name: 'TEST' };
}

test('the level curve is the brief\'s 80 x lv^1.35', () => {
  assert.equal(syncExpRequired(1), 80);
  assert.equal(syncExpRequired(10), Math.round(80 * 10 ** 1.35));
  assert.equal(syncExpRequired(49), Math.round(80 * 49 ** 1.35));
  let total = 0;
  for (let lv = 1; lv < SYNC_LEVEL_MAX; lv++) total += syncExpRequired(lv);
  assert.equal(total, 326826);
});

test('a missing or broken record reads as Lv.1 with no EXP', () => {
  assert.deepEqual(normalizeSyncLevels(null), { version: 1, partners: {}, crystals: 0 });
  const odd = normalizeSyncLevels({ version: 1, partners: { a: { level: 99, exp: 5 }, b: { level: 3, exp: 1e12 }, '': { level: 4 } }, crystals: -4 });
  assert.deepEqual(odd.partners.a, { level: 50, exp: 0, rebirths: 0 });
  assert.equal(odd.partners.b.exp, syncExpRequired(3) - 1);
  assert.equal(odd.partners[''], undefined);
  assert.equal(odd.crystals, 0);
  assert.deepEqual(syncOf(null, 'x'), { level: 1, exp: 0, next: 80 });
});

test('EXP levels a partner up through several levels and names the breakthroughs it crossed', () => {
  let need = 0;
  for (let lv = 1; lv < 11; lv++) need += syncExpRequired(lv);
  const { state, gain } = grantSyncExp(null, 'p1', need + 7);
  assert.deepEqual(state.partners.p1, { level: 11, exp: 7, rebirths: 0 });
  assert.equal(gain.before.level, 1);
  assert.equal(gain.after.level, 11);
  assert.deepEqual(gain.breakthroughs, ['STRIKE']);
  assert.equal(gain.overflow, 0);
  assert.deepEqual(gain.vitalPercent, { before: 0, after: 6 });
});

test('past Lv.50 EXP becomes crystal points, and crystals feed another partner', () => {
  const top = normalizeSyncLevels({ version: 1, partners: { star: { level: 50, exp: 0 } }, crystals: 0 });
  const { state, gain } = grantSyncExp(top, 'star', 5000);
  assert.equal(gain.overflow, 5000);
  assert.equal(state.crystals, 5000);
  const fed = feedSyncCrystals(state, 'rookie', 9999);
  assert.equal(fed.state.crystals, 0);
  assert.ok(fed.gain.after.level > 1);
  assert.equal(fed.gain.amount, 5000);
  assert.equal(feedSyncCrystals(fed.state, 'rookie', 10), null);
});

test('a rebirth keeps 30 % of the level once; evolution (no rebirth) keeps all of it', () => {
  const base = normalizeSyncLevels({ version: 1, partners: { p: { level: 40, exp: 900 } } });
  assert.equal(reconcileSyncRebirth(base, 'p', 0).partners.p.level, 40);
  const reborn = reconcileSyncRebirth(base, 'p', 1);
  assert.deepEqual(reborn.partners.p, { level: 12, exp: 0, rebirths: 1 });
  assert.deepEqual(reconcileSyncRebirth(reborn, 'p', 1).partners.p, { level: 12, exp: 0, rebirths: 1 });
  assert.deepEqual(reconcileSyncRebirth(normalizeSyncLevels(null), 'new', 2).partners.new, { level: 1, exp: 0, rebirths: 2 });
});

test('title matches cap the level by tamer rank', () => {
  assert.deepEqual([0, 1, 4, 8, 9, 20].map(syncCapForRank), [10, 15, 30, 50, 50, 50]);
});

test('a win pays half a level in title matches, a loss 40 % of that, and link battles pay nothing', () => {
  assert.equal(syncBattleExp(10, { kind: 'TITLE', won: true }), Math.round(syncExpRequired(10) * 0.5));
  assert.equal(syncBattleExp(10, { kind: 'TITLE', won: false }), Math.round(syncExpRequired(10) * 0.2));
  assert.ok(syncBattleExp(10, { kind: 'PRACTICE', won: true }) < syncBattleExp(10, { kind: 'FREE', won: true }));
  assert.equal(syncBattleExp(10, { kind: 'LINK', won: true }), 0);
  // Two to three won title matches per level, all the way up.
  for (const lv of [1, 10, 25, 49]) {
    const wins = Math.ceil(syncExpRequired(lv) / syncBattleExp(lv, { kind: 'TITLE', won: true }));
    assert.ok(wins >= 1 && wins <= 3, `Lv.${lv}: ${wins} wins`);
  }
});

test('bonuses grow every level and step up at each breakthrough', () => {
  assert.equal(syncVitalPercent(1), 0);
  assert.equal(syncVitalPercent(50), 29.4);
  assert.equal(syncArenaPower(1), 1);
  assert.ok(Math.abs(syncArenaPower(50) - (1 + 49 * 0.004 + 0.1)) < 1e-9);
  assert.deepEqual(syncCurveSteps(9), {});
  assert.deepEqual(syncCurveSteps(10), { '084': 1 });
  assert.deepEqual(syncCurveSteps(50), { '084': 3, '088': 2, '08c': 2, '090': 2 });
});

test('a battle copy is boosted and the result takes the boost back off', () => {
  const original = profile();
  const boosted = boostSyncNativeProfile(original, 50);
  assert.equal(original.fields['058'], 1000);
  assert.equal(boosted.fields['058'], 1294);
  assert.equal(boosted.fields['050'], Math.round(900 * 1.294));
  assert.equal(boosted.fields['05c'], Math.round(80 * 1.294));
  assert.equal(boosted.fields['084'], 15);
  assert.equal(boosted.fields['08c'], 26); // capped at the curve's last step
  // The battle ends: HP lost, one more battle and win written.
  const result = structuredClone(boosted);
  result.fields['050'] = 647; result.fields['024'] = 4; result.fields['028'] = 3;
  const saved = restoreSyncNativeProfile(result, original);
  assert.equal(saved.fields['058'], 1000);
  assert.equal(saved.fields['050'], 500);
  assert.equal(saved.fields['05c'], 80);
  assert.deepEqual(['084', '088', '08c', '090'].map(k => saved.fields[k]), [12, 9, 25, 4]);
  assert.equal(saved.fields['024'], 4);
  assert.equal(saved.fields['028'], 3);
  // Knocked down still keeps 1 HP; an unboosted battle comes back unchanged.
  result.fields['050'] = 1;
  assert.equal(restoreSyncNativeProfile(result, original).fields['050'], 1);
  const plain = boostSyncNativeProfile(original, 1);
  assert.deepEqual(restoreSyncNativeProfile(plain, original), original);
});
