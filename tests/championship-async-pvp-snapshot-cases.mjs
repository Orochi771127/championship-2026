import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_PVP_MAX_BYTES,
  ASYNC_PVP_SCHEMA,
  ASYNC_PVP_SNAPSHOT_JSON_SCHEMA,
  asyncPvpStatCeilings,
  computeAsyncPvpChecksum,
  createAsyncPvpSnapshot,
  validateAsyncPvpSnapshot
} from '../src/championship/contracts/asyncPvpSnapshot.js';
import { burstFormsFor } from '../src/championship/contracts/productBurstEvolution.js';

function sampleTeam() {
  // MA16 黑煞狼 (#83), MA25 深海魷 (#91), MA29 黑岩龍 (#124)
  const makeMember = (sp, lv, p, moves) => {
    const ceil = asyncPvpStatCeilings(sp, lv);
    const stats = ceil.map((v) => Math.max(1, Math.floor(v * 0.85)));
    const bursts = burstFormsFor(sp);
    return {
      speciesIndex: sp,
      syncLevel: lv,
      personalityIndex: p,
      stats,
      moves,
      ...(bursts.length ? { burstForm: bursts[0].form } : {})
    };
  };
  return [
    makeMember(83, 25, 2, ['own-193', 'emberBolt', 'fangRush']),
    makeMember(91, 20, 4, ['tideBolt', 'tideWave', 'foamZone']),
    makeMember(124, 30, 1, ['shardVolley', 'quakeSlam', 'brutalCharge'])
  ];
}

test('full 3-partner Async PvP snapshot fits comfortably under 1 KB and round-trips cleanly', () => {
  assert.equal(ASYNC_PVP_SNAPSHOT_JSON_SCHEMA.properties.s.const, ASYNC_PVP_SCHEMA);
  const created = createAsyncPvpSnapshot({
    trainerName: '錦標賽訓練師Max',
    rosterVersion: '2026.11-steam',
    timestamp: 1764140000,
    team: sampleTeam()
  });

  assert.ok(created.bytes < ASYNC_PVP_MAX_BYTES, `expected < ${ASYNC_PVP_MAX_BYTES} B, got ${created.bytes} B`);
  assert.ok(created.bytes < 600, `3-partner snapshot should be compact, got ${created.bytes} B`);

  const verified = validateAsyncPvpSnapshot(created.json);
  assert.equal(verified.ok, true);
  assert.equal(verified.snapshot.tn, '錦標賽訓練師Max');
  assert.equal(verified.snapshot.tm.length, 3);
});

test('anti-cheat validator rejects tampered stats, checksum forgery, illegal burst lineage, duplicate moves, and oversized payloads', () => {
  const created = createAsyncPvpSnapshot({
    trainerName: 'LegitPlayer',
    timestamp: 1764140000,
    team: sampleTeam()
  });

  // 1. Direct JSON edit without recomputing checksum -> CHECKSUM_MISMATCH
  const tamperedNoCk = structuredClone(created.snapshot);
  tamperedNoCk.tm[0].st[1] += 1;
  const r1 = validateAsyncPvpSnapshot(tamperedNoCk);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.code === 'CHECKSUM_MISMATCH'));

  // 2. Hacked 9999 stat even WITH recomputed checksum -> STAT_EXCEEDS_CEILING
  const hackedStat = structuredClone(created.snapshot);
  hackedStat.tm[0].st[1] = 9999;
  hackedStat.ck = computeAsyncPvpChecksum(hackedStat);
  const r2 = validateAsyncPvpSnapshot(hackedStat);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.code === 'STAT_EXCEEDS_CEILING'));

  // 3. Illegal burst form (species 83 cannot burst into species 190 潛艇龍) -> ILLEGAL_BURST_LINEAGE
  const hackedBurst = structuredClone(created.snapshot);
  hackedBurst.tm[0].bf = 190;
  hackedBurst.ck = computeAsyncPvpChecksum(hackedBurst);
  const r3 = validateAsyncPvpSnapshot(hackedBurst);
  assert.equal(r3.ok, false);
  assert.ok(r3.errors.some((e) => e.code === 'ILLEGAL_BURST_LINEAGE'));

  // 4. Duplicate equipped moves -> DUPLICATE_MOVES
  const dupMoves = structuredClone(created.snapshot);
  dupMoves.tm[1].mv = ['tideBolt', 'tideBolt'];
  dupMoves.ck = computeAsyncPvpChecksum(dupMoves);
  const r4 = validateAsyncPvpSnapshot(dupMoves);
  assert.equal(r4.ok, false);
  assert.ok(r4.errors.some((e) => e.code === 'DUPLICATE_MOVES'));

  // 5. Egg speciesIndex (< 8) or unknown species (228) -> UNKNOWN_SPECIES
  const eggMember = structuredClone(created.snapshot);
  eggMember.tm[0].sp = 0;
  eggMember.ck = computeAsyncPvpChecksum(eggMember);
  const r5 = validateAsyncPvpSnapshot(eggMember);
  assert.equal(r5.ok, false);
  assert.ok(r5.errors.some((e) => e.code === 'UNKNOWN_SPECIES'));

  // 6. Optional Demo / Commercial roster allowlist enforcement -> DISALLOWED_SPECIES
  const r6 = validateAsyncPvpSnapshot(created.json, { allowedSpecies: new Set([83, 179]) });
  assert.equal(r6.ok, false);
  assert.ok(r6.errors.some((e) => e.code === 'DISALLOWED_SPECIES'));

  // 7. Oversized > 1024 byte payload -> PAYLOAD_TOO_LARGE
  const r7 = validateAsyncPvpSnapshot(' '.repeat(1025));
  assert.equal(r7.ok, false);
  assert.equal(r7.errors[0].code, 'PAYLOAD_TOO_LARGE');
});
