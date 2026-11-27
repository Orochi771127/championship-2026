import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMERCIAL_CURATED_CODES,
  DEFAULT_ROSTER_POLICY_MODE,
  ROSTER_POLICY_MODES,
  WEB_DEMO_CURATED_CODES,
  auditRosterIpHygiene,
  resolveRosterPolicy,
  resolveSpeciesDisplayNameZh
} from '../src/championship/contracts/rosterPolicy.js';
import {
  asyncPvpStatCeilings,
  createAsyncPvpSnapshot,
  validateAsyncPvpSnapshot
} from '../src/championship/contracts/asyncPvpSnapshot.js';

test('default roster policy stays unrestricted (all_205) so ongoing 205-character work is never blocked', () => {
  assert.equal(DEFAULT_ROSTER_POLICY_MODE, ROSTER_POLICY_MODES.ALL_205);
  const policy = resolveRosterPolicy();
  assert.equal(policy.unrestricted, true);
  assert.equal(policy.speciesIndices, null);
  assert.ok(policy.displayCodes.length >= 205);
  assert.deepEqual(policy.unknownCodes, []);
});

test('commercial_curated and web_demo policies resolve every listed display code and report evolution integrity', () => {
  const curated = resolveRosterPolicy(ROSTER_POLICY_MODES.COMMERCIAL_CURATED);
  assert.equal(curated.unrestricted, false);
  assert.deepEqual(curated.unknownCodes, [], 'all 50 curated green-light codes exist in database-display.r1.json');
  assert.equal(curated.speciesIndices.size, COMMERCIAL_CURATED_CODES.length);

  const demo = resolveRosterPolicy(ROSTER_POLICY_MODES.WEB_DEMO);
  assert.deepEqual(demo.unknownCodes, [], 'all 12 web demo codes exist in database-display.r1.json');
  assert.equal(demo.speciesIndices.size, WEB_DEMO_CURATED_CODES.length);

  // Expanding ancestors pulls in declared evolution/burst parents and strictly reduces orphans.
  const demoWithAncestors = resolveRosterPolicy(ROSTER_POLICY_MODES.WEB_DEMO, { includeEvolutionAncestors: true });
  assert.ok(demoWithAncestors.speciesIndices.size > demo.speciesIndices.size);
  assert.ok(demoWithAncestors.evolutionIntegrity.orphanStages.length < demo.evolutionIntegrity.orphanStages.length);
});

test('roster policy speciesIndices plugs directly into validateAsyncPvpSnapshot allowlist enforcement', () => {
  const demo = resolveRosterPolicy(ROSTER_POLICY_MODES.WEB_DEMO);
  const allowedSp = Array.from(demo.speciesIndices)[0];
  const disallowedSp = 140; // 天女獸 — not in web_demo

  const legalStats = (sp) => asyncPvpStatCeilings(sp, 10).map((max) => Math.max(1, Math.floor(max * 0.7)));
  const allowedSnap = createAsyncPvpSnapshot({
    trainerName: 'DemoSquad',
    rosterVersion: 'demo-v1',
    team: [{ speciesIndex: allowedSp, syncLevel: 10, personality: 1, stats: legalStats(allowedSp), moves: ['m1', 'm2'] }]
  });
  assert.equal(validateAsyncPvpSnapshot(allowedSnap.json, { allowedSpecies: demo.speciesIndices }).ok, true);

  const disallowedSnap = createAsyncPvpSnapshot({
    trainerName: 'OutOfDemo',
    rosterVersion: 'demo-v1',
    team: [{ speciesIndex: disallowedSp, syncLevel: 10, personality: 1, stats: legalStats(disallowedSp), moves: ['m1', 'm2'] }]
  });
  const check = validateAsyncPvpSnapshot(disallowedSnap.json, { allowedSpecies: demo.speciesIndices });
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((e) => e.code === 'DISALLOWED_SPECIES'));
});

test('auditRosterIpHygiene accurately detects remaining flagged zh-Hant species names without modifying data', () => {
  const fullAudit = auditRosterIpHygiene();
  assert.ok(fullAudit.scannedCount >= 225);
  assert.ok(fullAudit.flaggedCount > 0, 'detects remaining legacy names such as GR40 星核豆獸 / 天女獸 / 機暴龍');
  const codes = new Set(fullAudit.flaggedNames.map((f) => f.displayCode));
  assert.equal(codes.has('GR40'), true, `expected GR40 (${resolveSpeciesDisplayNameZh(237)}) to be flagged for pre-Steam rename`);

  // Scoped audit on curated list only reports the small subset needing rename before release.
  const curatedAudit = auditRosterIpHygiene({ codes: COMMERCIAL_CURATED_CODES });
  assert.equal(curatedAudit.scannedCount, COMMERCIAL_CURATED_CODES.length);
  assert.ok(curatedAudit.flaggedCount < fullAudit.flaggedCount);
});
