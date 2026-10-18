import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBattleArenaHazards, battleArenaTerrainMap, battleArenaHasHazards, BATTLE_ARENA_HAZARD_RULES as R}
  from '../src/championship/battle/battleArenaHazards.js';
import {battleTeamOfSlot} from '../src/championship/battle/battleOutcome.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {DATA_ARENA_TERRAIN as T} from '../src/championship/modes/dataArena/dataArenaConfig.js';

const terrain = JSON.parse(fs.readFileSync(new URL('../src/data/championship/battle-arena-terrain/field_bm04_01.r2.json', import.meta.url), 'utf8'));
const moves = JSON.parse(fs.readFileSync(new URL('../src/data/championship/catalogs/battle-moves.r1.json', import.meta.url), 'utf8')).records;
const THUNDER = moves[364];   // species 151, thunder palette, power 300
const FIRE = moves.find(m => m.elementSelect === 1 && m.kind === 1 && m.power > 0);
const Q = n => n * 4096;
const at = (x, y, z = 0) => [Q(x), Q(y), Q(z)];

test('BM04 terrain is the lagoon: six READY feet stand in shallow water, the shores are dry', () => {
  const map = battleArenaTerrainMap(terrain);
  assert.equal(map.cols * map.cell, 416);
  assert.equal(map.rows * map.cell, 272);
  const cellAt = (x, y) => terrain.grid[Math.floor(y / 8)][Math.floor(x / 8)];
  for (const [x, y] of [[112,148],[128,108],[128,188],[304,148],[288,188],[288,108]]) assert.equal(cellAt(x, y), '~');
  assert.equal(cellAt(4, 4), '.');      // top-left beach
  assert.equal(cellAt(410, 266), '.');  // bottom-right palm cay
  const kinds = new Set(map.rects.map(r => r[4]));
  assert.deepEqual([...kinds].sort(), [T.GROUND, T.SHALLOW].sort());
  assert.equal(battleArenaHasHazards('field_bm04_01'), true);
  assert.equal(battleArenaHasHazards('field_bm02_01'), false);
});

test('only a thunder hit on standing water charges it, owned by the attacker team', () => {
  const hz = createBattleArenaHazards({fieldId:'field_bm04_01', teamOfSlot:battleTeamOfSlot});
  assert.equal(hz.onHit({move:FIRE, attackerSlot:0, targetPosition:at(200, 140)}), 0);
  assert.equal(hz.onHit({move:THUNDER, attackerSlot:0, targetPosition:at(4, 4)}), 0);        // dry beach
  assert.equal(hz.onHit({move:THUNDER, attackerSlot:0, targetPosition:at(200, 140, 20)}), 0); // airborne target
  assert.ok(hz.onHit({move:THUNDER, attackerSlot:0, targetPosition:at(200, 140)}) > 50);
  const snap = hz.snapshot();
  assert.ok(snap.charged.every(([, , team]) => team === 0));
  assert.equal(snap.recent.at(-1).type, 'SHOCK_CHARGE');
  assert.equal(createBattleArenaHazards({fieldId:'field_bm02_01', teamOfSlot:battleTeamOfSlot}), null);
});

test('charge ticks enemies every half second, spares allies, airborne and resistant fighters, and never defeats', () => {
  const hz = createBattleArenaHazards({fieldId:'field_bm04_01', teamOfSlot:battleTeamOfSlot});
  hz.onHit({move:THUNDER, attackerSlot:0, targetPosition:at(200, 140)});
  const slots = [{currentHp:500, maxHp:1000}, null, null, {currentHp:500, maxHp:1000}, {currentHp:500, maxHp:1000}, {currentHp:2, maxHp:1000}];
  const pos = {0:at(200,140), 3:at(204,140), 4:at(206,140,30), 5:at(198,142)};
  const levels = {0:0, 3:0, 4:0, 5:0};
  const run = frames => { for (let f = 0; f < frames; f++) hz.step({slots, positionOf:s => pos[s] ?? null, thunderStatOf:s => levels[s]}); };
  run(R.shock.tickFrames - 1);
  assert.equal(slots[3].currentHp, 500);
  run(1);
  assert.equal(slots[3].currentHp, 500 - 20);  // 2% of max HP
  assert.equal(slots[0].currentHp, 500);       // the caster team is never shocked
  assert.equal(slots[4].currentHp, 500);       // airborne
  assert.equal(slots[5].currentHp, 1);         // floored at 1, never defeated
  run(R.shock.tickFrames);
  assert.equal(slots[5].currentHp, 1);
  assert.ok(hz.snapshot().recent.some(e => e.type === 'SHOCK_FLOORED' && e.slot === 5));
  levels[3] = R.shock.immuneStat;
  const before = slots[3].currentHp;
  run(R.shock.tickFrames);
  assert.equal(slots[3].currentHp, before);
  assert.ok(hz.snapshot().recent.some(e => e.type === 'SHOCK_RESISTED' && e.slot === 3));
  run(Math.round(R.shock.seconds * 60));
  assert.equal(hz.snapshot().charged.length, 0);
  const settled = slots[3].currentHp;
  levels[3] = 0; run(R.shock.tickFrames * 2);
  assert.equal(slots[3].currentHp, settled);   // cleared water is harmless again
});

function individual(id, species, personality, rngSeed) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile};
}
function practice(seed, options) {
  const a = [135, 152, 207], b = [124, 149, 186];
  const runtime = createBattleRuntime({mode:5, battleType:0, seed, ...options,
    playerIndividuals:a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals:b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  runtime.choosePracticeBattle({arenaIndex:3});
  const source = runtime.startMatch();
  const events = new Map();
  let frames = 0;
  for (; frames < 12000 && !source.getView().outcome.ended; frames++) {
    source.tick();
    for (const e of source.getView().arenaHazards?.recent ?? []) events.set(e.seq, e);
  }
  const view = source.getView();
  runtime.dispose();
  return {frames, verdict:view.outcome.verdict, hp:view.combatants.map(c => c.hp?.current ?? null), hazards:view.arenaHazards, events:[...events.values()]};
}

test('off by default: a BM04 practice battle keeps the original rules and exposes no hazard state', () => {
  const plain = practice(3, {}), off = practice(3, {arenaHazards:false});
  assert.equal(plain.hazards, null);
  assert.deepEqual(off, plain);
});

test('opt-in BM04 battle: thunder charges the lagoon, shocks only opponents of the charge, deterministically', () => {
  const on = practice(3, {arenaHazards:true}), again = practice(3, {arenaHazards:true});
  assert.deepEqual(on.events, again.events);
  const charges = on.events.filter(e => e.type === 'SHOCK_CHARGE');
  const shocks = on.events.filter(e => e.type === 'SHOCKED');
  assert.ok(charges.length >= 1);
  assert.ok(shocks.length >= 1);
  const chargeTeams = new Set(charges.map(e => e.team));
  for (const shock of shocks) {
    assert.ok(shock.hp >= 1);
    assert.ok(!chargeTeams.has(battleTeamOfSlot(shock.slot)) || chargeTeams.size > 1);
  }
  assert.equal(on.hazards.authority, 'OWNER_APPROVED_ADAPTATION_2026-10-18');
});
