import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDataArenaGrid} from '../src/championship/modes/dataArena/dataArenaGrid.js';
import {DATA_ARENA_GRID_RULES as G, DATA_ARENA_MAP, DATA_ARENA_DUEL_MAP} from '../src/championship/modes/dataArena/dataArenaConfig.js';
import {createBattleArenaHazards, battleArenaTerrainMap, BATTLE_ARENA_HAZARD_RULES as R} from '../src/championship/battle/battleArenaHazards.js';
import {battleTeamOfSlot} from '../src/championship/battle/battleOutcome.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';

const moves = JSON.parse(fs.readFileSync(new URL('../src/data/championship/catalogs/battle-moves.r1.json', import.meta.url), 'utf8')).records;
const bm05 = JSON.parse(fs.readFileSync(new URL('../src/data/championship/battle-arena-terrain/field_bm05_01.r1.json', import.meta.url), 'utf8'));
const FIRE = moves.find(m => m.speciesId === 29 && m.kind <= 1 && m.power > 0 && m.elementSelect === 1) ?? moves[50];
const ICE = moves[219];
// 12 x 8 cells of 8 px: snow shore ring, natural ice inside, a bit of open sea.
const DOC = {fieldId:'test_ice', cellNativePx:8, cols:12, rows:8, nativeWidthPx:96, nativeHeightPx:64, grid:[
  'wwww........',
  '............',
  '..========..',
  '..========..',
  '..========..',
  '..========..',
  '............',
  '............']};
const at = (c, r) => [(c + .5) * 8, (r + .5) * 8];
const Q = ([x, y], z = 0) => [x * 4096, y * 4096, z * 4096];
const steps = (grid, seconds) => {const e = []; for (let i = 0; i < Math.round(seconds * 60); i++) grid.step(1 / 60, e); return e;};

test('natural ice is a permanent walkable sheet that heat wears down, cracks with warning, then opens', () => {
  const grid = createDataArenaGrid({map:battleArenaTerrainMap(DOC)});
  const i = grid.index(5, 4);
  assert.equal(grid.naturalCount, 32);
  assert.equal(grid.surface(i), 'ICE');
  assert.equal(grid.blocksMove(i, 'walker'), false);
  assert.equal(grid.isConductive(i), false);
  assert.equal(steps(grid, 30).length, 0);              // never times out on its own
  assert.equal(grid.heatIceAt(...at(5, 4), {radius:1, amount:40}, []), 0);
  assert.equal(grid.surface(i), 'ICE');
  assert.ok(grid.iceIntegrity[i] < G.naturalIceIntegrity);
  const events = [];
  assert.ok(grid.heatIceAt(...at(5, 4), {radius:1, amount:80}, events) >= 1);
  assert.equal(events[0].type, 'ICE_HEATED');
  let e = steps(grid, 1 / 60);
  assert.ok(e.some(x => x.type === 'ICE_CRACK_WARN'));
  assert.equal(grid.surface(i), 'ICE_CRACKING');
  e = steps(grid, G.iceWarnSeconds);
  assert.ok(e.some(x => x.type === 'ICE_MELT' && x.natural));
  assert.equal(grid.surface(i), 'WATER');
  assert.equal(grid.isConductive(i), true);
  e = steps(grid, G.naturalRefreezeSeconds + .05);
  assert.ok(e.some(x => x.type === 'ICE_FORM' && x.source === 'NATURAL_REFREEZE'));
  assert.equal(grid.surface(i), 'ICE');
  assert.equal(grid.iceIntegrity[i], G.naturalIceIntegrity);
});

test('cold refreezes opened natural ice at once; resetDynamic restores every sheet; harbor maps have none', () => {
  const grid = createDataArenaGrid({map:battleArenaTerrainMap(DOC)});
  grid.heatIceAt(...at(5, 4), {radius:1, amount:200}, []);
  steps(grid, G.iceWarnSeconds + .1);
  const i = grid.index(5, 4);
  assert.equal(grid.surface(i), 'WATER');
  const events = [];
  assert.ok(grid.coolAt(...at(5, 4), {radius:1}, events) >= 1);
  assert.equal(grid.surface(i), 'ICE');
  assert.ok(events.some(e => e.type === 'ICE_FORM' && e.seconds === Infinity));
  grid.heatIceAt(...at(4, 3), {radius:1, amount:200}, []);
  steps(grid, G.iceWarnSeconds + .1);
  grid.resetDynamic();
  for (let c = 2; c < 10; c++) for (let r = 2; r < 6; r++) assert.equal(grid.surface(grid.index(c, r)), 'ICE');
  for (const map of [DATA_ARENA_MAP, DATA_ARENA_DUEL_MAP]) assert.equal(createDataArenaGrid({map}).naturalCount, 0);
});

test('one fire attack heats a cell once per frame; a walker on opened ice falls, sinks, and is put ashore on full footing', () => {
  const hz = createBattleArenaHazards({fieldId:'test_ice', teamOfSlot:battleTeamOfSlot, terrain:DOC});
  const centre = at(5, 4);
  hz.onHit({move:FIRE, attackerSlot:0, targetPosition:Q(centre)});
  const once = hz.grid.iceIntegrity[hz.grid.index(5, 4)];
  hz.onHit({move:FIRE, attackerSlot:0, targetPosition:Q(centre)});   // same frame, same attack: deduped
  assert.equal(hz.grid.iceIntegrity[hz.grid.index(5, 4)], once);
  for (let k = 0; k < 4; k++) { hz.step({slots:[], positionOf:() => null, thunderStatOf:() => 0}); hz.onHit({move:FIRE, attackerSlot:0, targetPosition:Q(centre)}); }
  const slots = [null, null, null, {currentHp:1000, maxHp:1000}];
  let pos = Q(centre); const moved = [];
  const run = n => { for (let f = 0; f < n; f++) hz.step({slots, positionOf:s => s === 3 ? pos : null, thunderStatOf:() => 0,
    setPositionOf:(s, p) => { moved.push(p); pos = Q(p); }}); };
  let snap = hz.snapshot();
  for (let f = 0; f < 400 && !snap.recent.some(e => e.type === 'FELL_IN_WATER'); f++) { run(1); snap = hz.snapshot(); }
  assert.ok(snap.recent.some(e => e.type === 'FELL_IN_WATER' && e.slot === 3));
  assert.ok(snap.recent.some(e => e.type === 'ICE_CHANGES' && e.opened > 0));
  assert.equal(slots[3].currentHp, 1000 - Math.round(1000 * R.fall.maxHpFraction));
  assert.ok(snap.falls[3]);
  run(R.fall.sinkFrames);
  snap = hz.snapshot();
  assert.ok(snap.recent.some(e => e.type === 'RECOVERED' && e.slot === 3));
  assert.equal(moved.length, 1);
  const [lx, ly] = moved[0];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const s = hz.grid.surfaceAt(lx + dc * 8, ly + dr * 8);
    assert.ok(s === 'GROUND' || s === 'ICE', `landing neighbourhood ${s}`);
  }
  assert.equal(snap.grace[3] > 0, true);
  assert.equal(snap.fallTotals[3], 1);
});

test('falls never defeat, airborne fighters do not fall, and grace stops an immediate second fall', () => {
  const hz = createBattleArenaHazards({fieldId:'test_ice', teamOfSlot:battleTeamOfSlot, terrain:DOC});
  const sea = Q(at(1, 0)), air = Q(at(2, 0), 20);
  const slots = [{currentHp:3, maxHp:1000}, {currentHp:500, maxHp:1000}];
  const step = () => hz.step({slots, positionOf:s => s === 0 ? sea : air, thunderStatOf:() => 0});   // no setPositionOf
  step();
  assert.equal(slots[0].currentHp, 1);
  assert.equal(slots[1].currentHp, 500);
  for (let f = 0; f < R.fall.sinkFrames + R.fall.graceFrames - 2; f++) step();
  assert.equal(hz.snapshot().fallTotals[0], 1);   // still in the sea, but inside grace
  for (let f = 0; f < 4; f++) step();
  assert.equal(hz.snapshot().fallTotals[0], 2);
  assert.equal(slots[0].currentHp, 1);
});

test('BM05 R1 terrain: six feet on natural ice inside a solid shore; ice moves refreeze it', () => {
  const map = battleArenaTerrainMap(bm05);
  assert.equal(map.cols * map.cell, 416);
  const cellAt = (x, y) => bm05.grid[Math.floor(y / 8)][Math.floor(x / 8)];
  for (const [x, y] of [[112,148],[128,108],[128,188],[304,148],[288,188],[288,108]]) assert.equal(cellAt(x, y), '=');
  assert.equal(cellAt(4, 260), '.');
  assert.ok(bm05.grid.join('').includes('w'));
  const hz = createBattleArenaHazards({fieldId:'field_bm05_01', teamOfSlot:battleTeamOfSlot});
  const p = Q([208, 148]);
  for (let k = 0; k < 3; k++) { hz.onHit({move:moves[50], attackerSlot:0, targetPosition:p}); hz.step({slots:[], positionOf:() => null, thunderStatOf:() => 0}); }
  for (let f = 0; f < 200; f++) hz.step({slots:[], positionOf:() => null, thunderStatOf:() => 0});
  assert.equal(hz.grid.surfaceAt(208, 148), 'WATER');
  hz.onHit({move:ICE, attackerSlot:3, targetPosition:p});
  assert.equal(hz.grid.surfaceAt(208, 148), 'ICE');
});

function individual(id, species, personality, rngSeed) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile};
}
function practice(seed, options, a = [135, 113, 101]) {
  const b = [124, 149, 186];
  const runtime = createBattleRuntime({mode:5, battleType:0, seed, ...options,
    playerIndividuals:a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals:b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  runtime.choosePracticeBattle({arenaIndex:4});
  const source = runtime.startMatch();
  const events = new Map(); let minHp = Infinity;
  for (let f = 0; f < 12000 && !source.getView().outcome.ended; f++) {
    source.tick();
    const v = source.getView();
    for (const e of v.arenaHazards?.recent ?? []) events.set(e.seq, e);
  }
  const view = source.getView();
  runtime.dispose();
  return {verdict:view.outcome.verdict, hp:view.combatants.map(c => c.hp?.current ?? null), events:[...events.values()], hazards:view.arenaHazards};
}

// Fire is always a kind-1 special in the move table, and the original AI lands
// specials only occasionally, so a melt is an occasional battle event. Seed 16
// with this fire team is a recorded case where one connects and opens ice.
test('opt-in BM05 battle: a landed fire special opens the sheet, deterministically; off keeps the original', () => {
  const off = practice(16, {}), on = practice(16, {arenaHazards:createBattleArenaHazards}), again = practice(16, {arenaHazards:createBattleArenaHazards});
  assert.equal(off.hazards, null);
  assert.deepEqual(on.events, again.events);
  const kinds = new Set(on.events.map(e => e.type));
  assert.ok(kinds.has('ICE_HEATED'), [...kinds].join(','));
  assert.ok(on.events.some(e => e.type === 'ICE_CHANGES' && (e.cracked > 0 || e.opened > 0)));
  assert.notDeepEqual(off.hp, null);
  for (const e of on.events.filter(x => x.type === 'FELL_IN_WATER')) assert.ok(e.hp >= 1);
  const falls = on.events.filter(e => e.type === 'FELL_IN_WATER').length, recovered = on.events.filter(e => e.type === 'RECOVERED').length;
  assert.ok(recovered <= falls && falls - recovered <= 6);
});
