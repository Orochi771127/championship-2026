import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDataArenaGrid} from '../src/championship/modes/dataArena/dataArenaGrid.js';
import {cellCost} from '../src/championship/modes/dataArena/dataArenaNav.js';
import {DATA_ARENA_GRID_RULES as G, DATA_ARENA_MAP, DATA_ARENA_DUEL_MAP} from '../src/championship/modes/dataArena/dataArenaConfig.js';
import {createBattleArenaHazards, battleArenaTerrainMap, BATTLE_ARENA_HAZARD_RULES as R} from '../src/championship/battle/battleArenaHazards.js';
import {battleTeamOfSlot} from '../src/championship/battle/battleOutcome.js';
import {describeBattleFxMove} from '../src/championship/presentation/battleFx/battleFxRecipes.js';

const moves = JSON.parse(fs.readFileSync(new URL('../src/data/championship/catalogs/battle-moves.r1.json', import.meta.url), 'utf8')).records;
const bm03 = JSON.parse(fs.readFileSync(new URL('../src/data/championship/battle-arena-terrain/field_bm03_01.r3.json', import.meta.url), 'utf8'));
const paletteOf = m => { try { return describeBattleFxMove(m).palette; } catch { return null; } };
const WATER = moves.find(m => m.kind <= 1 && m.power > 0 && paletteOf(m) === 'water');
const ICE = moves.find(m => m.kind <= 1 && m.power > 0 && paletteOf(m) === 'ice');
// 12 x 6 cells: a lava strip, ground around, and a water pocket.
const DOC = {fieldId:'test_lava', cellNativePx:8, cols:12, rows:6, nativeWidthPx:96, nativeHeightPx:48, grid:[
  '............',
  '..LLLLLLLL..',
  '..LLLLLLLL..',
  '..LLLLLLLL..',
  '..........ww',
  '..........ww']};
const at = (c, r) => [(c + .5) * 8, (r + .5) * 8];
const Q = ([x, y], z = 0) => [x * 4096, y * 4096, z * 4096];
const steps = (grid, seconds) => {const e = []; for (let i = 0; i < Math.round(seconds * 60); i++) grid.step(1 / 60, e); return e;};

test('lava crusts into rock under water, warns once before reheating, then is molten again; re-cooling never stacks', () => {
  const grid = createDataArenaGrid({map:battleArenaTerrainMap(DOC)});
  const i = grid.index(5, 2);
  assert.equal(grid.surface(i), 'LAVA');
  assert.equal(grid.blocksMove(i, 'walker'), false);
  assert.equal(grid.isConductive(i), false);
  const events = [];
  assert.ok(grid.coolLavaAt(...at(5, 2), {radius:1}, events) >= 5);
  assert.equal(events[0].type, 'LAVA_COOLED');
  assert.equal(grid.surface(i), 'COOLED_ROCK');
  grid.coolLavaAt(...at(5, 2), {radius:1}, []);
  assert.equal(grid.cooled[i], G.lavaCoolSeconds);           // reset, not stacked
  let e = steps(grid, G.lavaCoolSeconds - G.lavaWarnSeconds + .05);
  assert.equal(e.filter(x => x.type === 'LAVA_REHEAT_WARN').length, 1);
  assert.equal(grid.surface(i), 'COOLED_ROCK_REHEATING');
  e = steps(grid, G.lavaWarnSeconds);
  assert.ok(e.some(x => x.type === 'LAVA_RESTORED'));
  assert.equal(grid.surface(i), 'LAVA');
  assert.ok(cellCost(grid, i, 'walker') > 20);
  grid.coolLavaAt(...at(5, 2), {radius:1}, []);
  assert.equal(cellCost(grid, i, 'walker'), 1);
  grid.resetDynamic();
  assert.equal(grid.surface(i), 'LAVA');
  for (const map of [DATA_ARENA_MAP, DATA_ARENA_DUEL_MAP]) assert.equal(createDataArenaGrid({map}).lavaCount, 0);
});

test('molten lava burns by HEAT, crust is safe, enough HEAT is immune to lava only, and nobody is defeated', () => {
  const hz = createBattleArenaHazards({fieldId:'test_lava', teamOfSlot:battleTeamOfSlot, terrain:DOC});
  const slots = [{currentHp:1000, maxHp:1000}, {currentHp:1000, maxHp:1000}, {currentHp:2, maxHp:1000}, {currentHp:1000, maxHp:1000}];
  const pos = {0:Q(at(3, 2)), 1:Q(at(8, 2)), 2:Q(at(4, 1)), 3:Q(at(10, 4))};
  const heat = {0:0, 1:R.lava.immuneStat, 2:0, 3:R.lava.immuneStat};
  const run = n => { for (let f = 0; f < n; f++) hz.step({slots, positionOf:s => pos[s] ?? null, thunderStatOf:() => 0, heatStatOf:s => heat[s]}); };
  run(R.lava.tickFrames);
  assert.equal(slots[0].currentHp, 1000 - Math.round(1000 * R.lava.maxHpFraction));
  assert.equal(slots[1].currentHp, 1000);                    // HEAT immune
  assert.equal(slots[2].currentHp, 1);                       // floored
  assert.equal(slots[3].currentHp, 1000 - Math.round(1000 * R.fall.maxHpFraction));  // HEAT does not stop a fall
  const snap = hz.snapshot();
  assert.ok(snap.recent.some(e => e.type === 'LAVA_RESISTED' && e.slot === 1));
  assert.ok(snap.recent.some(e => e.type === 'FELL_IN_WATER' && e.slot === 3));
  // A water hit crusts the lava around slot 0; it stops burning while slot 2 (outside) still burns.
  hz.onHit({move:WATER, attackerSlot:3, targetPosition:pos[0]});
  const before = slots[0].currentHp;
  slots[2].currentHp = 500;
  pos[2] = Q(at(9, 3));
  run(R.lava.tickFrames);
  assert.equal(slots[0].currentHp, before);
  assert.ok(slots[2].currentHp < 500);
  assert.ok(hz.snapshot().lava.length > 0);
  if (ICE) { hz.onHit({move:ICE, attackerSlot:3, targetPosition:Q(at(9, 3))}); assert.equal(hz.grid.surfaceAt(...at(9, 3)), 'COOLED_ROCK'); }
});

test('BM03 R2 terrain: six feet on solid ground; the western trench and central fracture are lava', () => {
  const map = battleArenaTerrainMap(bm03);
  assert.equal(map.cols * map.cell, 416);
  const cellAt = (x, y) => bm03.grid[Math.floor(y / 8)][Math.floor(x / 8)];
  for (const [x, y] of [[112,148],[128,108],[128,188],[304,148],[288,188],[288,108]]) assert.equal(cellAt(x, y), '.');
  assert.equal(cellAt(8, 120), 'L');
  assert.ok(bm03.grid.slice(14, 23).some(row => row.slice(24, 34).includes('L')));
  const hz = createBattleArenaHazards({fieldId:'field_bm03_01', teamOfSlot:battleTeamOfSlot});
  assert.ok(hz.grid.lavaCount > 100);
});
