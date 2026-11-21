// Wave 3 (2026-11-21): Cyber Dungeon Roguelike Phase 1 & 3-Pillar Battle Hub tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CYBER_DUNGEON_CHIPS,
  CYBER_DUNGEON_ROOMS_TOTAL,
  CYBER_DUNGEON_SECTORS,
  aggregateDungeonChips,
  chooseDungeonDoor,
  createCyberDungeonRun,
  deserializeCyberDungeonRun,
  pickDungeonChip,
  resolveDungeonCombat,
  resolveDungeonEvent,
  serializeCyberDungeonRun
} from '../src/championship/contracts/productCyberDungeon.js';
import { CYBER_DUNGEON_COPY, cyberDungeonText } from '../src/championship/text/cyberDungeonText.js';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { createNativeHuntIndividual } from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import { nativeHuntSpeciesByIndex } from '../src/championship/hunt/capture/nativeHuntSources.js';
import { nativeIndividualProfile } from '../src/championship/raising/nativeIndividualProfile.js';
import { inspectScopedLocaleCopy } from '../scripts/check-locale-coverage.mjs';

const readJson = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const CATALOG = readJson('src/data/championship/catalogs/creature-species.r1.json');
const CAGES = readJson('docs/contracts/championship/raising-home-presentation.v1.json').cages;

test('Cyber Dungeon: complete 5-room roguelike run with 3-pick-1 chip draft, 2-door forks, event rooms, and Room 5 Boss clear', () => {
  let run = createCyberDungeonRun({ sectorId: 2, party: ['p1', 'p2'], seed: 20261121, runId: 'dg-test-1' });
  assert.equal(run.totalRooms, CYBER_DUNGEON_ROOMS_TOTAL);
  assert.equal(run.roomIndex, 0);
  assert.equal(run.status, 'READY');
  assert.equal(run.activeRoom.kind, 'COMBAT');
  assert.ok(run.activeRoom.presets.length >= 1);

  // Room 1 combat win -> 3 distinct Data Chips offered, duplicate attemptId is idempotent.
  const w1 = resolveDungeonCombat(run, { attemptId: 'a1', won: true, partyRatios: { p1: { hp: 0.7, tp: 0.4 }, p2: { hp: 0.8, tp: 0.5 } } });
  run = w1.run;
  assert.equal(run.status, 'CHIP_DRAFT');
  assert.equal(run.chipDraft.length, 3);
  assert.equal(new Set(run.chipDraft).size, 3);
  assert.ok(w1.delta.crystals > 0 && w1.delta.bits > 0);

  const dup = resolveDungeonCombat(run, { attemptId: 'a1', won: true });
  assert.equal(dup.delta, null, 'Duplicate attemptId must not double-pay or advance twice');

  // Pick 1 chip -> unlocks 2 distinct doors (left combat/elite + right event).
  const firstChip = run.chipDraft[0];
  run = pickDungeonChip(run, firstChip);
  assert.equal(run.status, 'DOOR_CHOICE');
  assert.deepEqual(run.chips, [firstChip]);
  assert.equal(run.doors.length, 2);

  // Walk through Rooms 2, 3, 4 (choosing the event door when available so we verify events too), then Room 5 Boss.
  let sawEvent = false;
  for (let step = 0; step < 4; step++) {
    const eventDoorIdx = run.doors.findIndex((d) => ['CAMPFIRE', 'ALTAR', 'SIGNAL'].includes(d.kind));
    const doorIdx = eventDoorIdx >= 0 ? eventDoorIdx : 0;
    run = chooseDungeonDoor(run, doorIdx);

    if (run.status === 'EVENT') {
      sawEvent = true;
      const opt = run.activeRoom.kind === 'CAMPFIRE' ? 'REST' : run.activeRoom.kind === 'ALTAR' ? 0 : 'SUPPLY';
      const ev = resolveDungeonEvent(run, opt);
      run = ev.run;
      assert.equal(run.status, 'DOOR_CHOICE');
    } else if (run.status === 'READY') {
      const won = resolveDungeonCombat(run, { attemptId: `step-${step}`, won: true, partyRatios: { p1: { hp: 0.9, tp: 0.6 }, p2: { hp: 0.9, tp: 0.6 } } });
      run = won.run;
      if (run.status === 'CHIP_DRAFT') {
        run = pickDungeonChip(run, run.chipDraft[0]);
      }
    }
  }

  assert.equal(sawEvent, true, 'Expected at least one interactive event room along the 5-room run');
  assert.equal(run.status, 'CLEARED');
  assert.equal(run.clearedRooms, CYBER_DUNGEON_ROOMS_TOTAL);
  assert.ok(run.totalCrystals > CYBER_DUNGEON_SECTORS[1].bossCrystals);
  assert.ok(run.totalBits > CYBER_DUNGEON_SECTORS[1].bossBits);
});

test('Cyber Dungeon: aggregateDungeonChips sums effects cleanly and storage round-trips safely', () => {
  const mods = aggregateDungeonChips(['TP_SURGE', 'VAMP_LINK', 'CRYSTAL_MAGNET', 'BITS_SIPHON', 'BOSS_BREAKER']);
  assert.equal(mods.startTpBonusPct, 30);
  assert.equal(mods.postHealPct, 25);
  assert.equal(mods.crystalsBonusPct, 40);
  assert.equal(mods.bitsPerRoom, 80);
  assert.equal(mods.bossCrystalsBonus, 120);
  assert.equal(CYBER_DUNGEON_CHIPS.length, 10);

  const run = createCyberDungeonRun({ sectorId: 1, party: ['p1'], seed: 99, runId: 'dg-save' });
  const raw = serializeCyberDungeonRun(run);
  const loaded = deserializeCyberDungeonRun(raw);
  assert.deepEqual(loaded.runId, run.runId);
  assert.deepEqual(loaded.party, run.party);
  assert.equal(deserializeCyberDungeonRun('invalid-json'), null);
  assert.equal(serializeCyberDungeonRun(null), null);
});

test('Cyber Dungeon app integration: prepareDungeonBattle honors HP/TP carry-over + TP_SURGE and Altar feeds real Open Evolution points', async () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  const app = createChampionshipStandaloneApp({
    storage,
    catalog: CATALOG,
    cages: CAGES,
    rngClock: () => ({ hour: 13, minute: 20, second: 50 })
  });
  try {
    await app.newGame();
    app.save();
    const [key, text] = [...map.entries()][0];
    const save = JSON.parse(text);
    save.creature.speciesId = 'species-053';
    save.creature.nativeProfile = nativeIndividualProfile(createNativeHuntIndividual({ species: nativeHuntSpeciesByIndex(53), rng: { next: () => 19 } }));
    map.set(key, JSON.stringify(save));
    await app.continueGame();
    const id = app.getRaisingInstances()[0].instanceId;
    const beforeDragon = app.getCreature().nativeProfile.fields['10c'] | 0;
    const beforeCrystals = app.getJourneyFrame().crystals;
    const beforeBits = app.getShopFrame().bits;

    // Grant room crystals + Bits + Dragon Altar blessing (+12 pts) -> real profile & wallet updates!
    const paid = app.grantCyberDungeonRewards({
      crystals: 40,
      bits: 120,
      altarBlessing: { kind: 'RACE', key: 'DRAGON', field: '10c', points: 12 },
      leadInstanceId: id
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.altarApplied, true);
    assert.ok(app.getJourneyFrame().crystals >= beforeCrystals + 40);
    assert.equal(app.getShopFrame().bits, beforeBits + 120);
    assert.equal(app.getCreature().nativeProfile.fields['10c'] | 0, beforeDragon + 12);

    // Prepare Dungeon combat with 50% carry HP/TP + 30% TP_SURGE chip -> battle clone carries exact ratio without mutating ranch!
    const run = createCyberDungeonRun({ sectorId: 1, party: [id], seed: 7 });
    const prep = await app.prepareDungeonBattle({
      presetIndices: run.activeRoom.presets,
      partyIds: [id],
      arenaIndex: run.activeRoom.arenaIndex,
      carryRatioById: { [id]: { hp: 0.5, tp: 0.5 } },
      startTpBonusPct: 30
    });
    assert.equal(prep.ok, true, prep.reason);
    const f = prep.individuals[0].nativeProfile.fields;
    assert.equal(f['050'], Math.round(f['058'] * 0.5));
    assert.equal(f['054'], Math.min(f['05c'], Math.round(f['05c'] * 0.5) + Math.round(f['05c'] * 0.3)));
  } finally {
    await app.dispose();
  }
});

test('Cyber Dungeon & 3-Pillar Battle Hub: 5-locale copy coverage has zero gaps', () => {
  const coverage = inspectScopedLocaleCopy('src/championship/text/cyberDungeonText.js', CYBER_DUNGEON_COPY);
  assert.deepEqual(coverage.gaps, []);
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    assert.ok(cyberDungeonText('pillar.dungeon.title', {}, locale).length > 0);
    assert.ok(cyberDungeonText('chip.TP_SURGE.name', {}, locale).length > 0);
  }
});
