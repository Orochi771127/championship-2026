import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataArenaGrid} from '../src/championship/modes/dataArena/dataArenaGrid.js';
import {DATA_ARENA_GRID_RULES as RULES, DATA_ARENA_TERRAIN as T} from '../src/championship/modes/dataArena/dataArenaConfig.js';

// 20 x 10 cells of 8 px: a shallow lagoon with a dry sandbar column at c=10
// and an open WATER pocket on the right edge, so connectivity is observable.
const MAP = Object.freeze({cell:8, cols:20, rows:10, stage:null, pylons:[], flammable:[],
  rects:[[0,0,20,10,T.SHALLOW],[10,0,1,10,T.GROUND],[16,3,4,4,T.WATER]]});
const at = (c, r) => [(c + .5) * 8, (r + .5) * 8];
const step = (grid, seconds) => {const events = []; for (let i = 0; i < Math.round(seconds * 60); i++) grid.step(1 / 60, events); return events;};

test('SHALLOW is walkable ground for everyone and reports its own surface', () => {
  const grid = createDataArenaGrid({map:MAP});
  const i = grid.index(2, 2);
  assert.equal(grid.surface(i), 'SHALLOW');
  assert.equal(grid.blocksMove(i, 'walker'), false);
  assert.equal(grid.blocksMove(i, 'swimmer'), false);
  assert.equal(grid.isWaterTerrain(i), false);
  assert.equal(grid.isConductive(i), true);
  assert.equal(grid.isConductive(grid.index(10, 2)), false);
});

test('thunder on dry ground conducts nothing', () => {
  const grid = createDataArenaGrid({map:MAP});
  const events = [];
  assert.equal(grid.applyShock(...at(10, 4), {team:0}, events), 0);
  assert.equal(grid.chargedCount, 0);
  assert.deepEqual(events, []);
});

test('charge floods only connected conductive cells inside the radius, owned by the caster team', () => {
  const grid = createDataArenaGrid({map:MAP});
  const events = [];
  const cells = grid.applyShock(...at(4, 4), {team:1, radius:5}, events);
  assert.ok(cells > 20);
  assert.equal(events[0].type, 'SHOCK_CHARGE');
  assert.equal(events[0].team, 1);
  assert.equal(grid.chargeAt(...at(4, 4)).team, 1);
  assert.ok(grid.chargeAt(...at(8, 4)));                 // within radius, same side
  assert.equal(grid.chargeAt(...at(10, 4)), null);        // the sandbar is dry
  assert.equal(grid.chargeAt(...at(11, 4)), null);        // the far side is not connected
  assert.equal(grid.chargeAt(...at(4, 4 + 0)).seconds, RULES.shockSeconds);
});

test('charge counts down, flickers once before fading, then clears', () => {
  const grid = createDataArenaGrid({map:MAP});
  grid.applyShock(...at(3, 3), {team:0}, []);
  let events = step(grid, RULES.shockSeconds - RULES.shockWarnSeconds - .1);
  assert.equal(events.filter(e => e.type === 'SHOCK_FADING').length, 0);
  assert.equal(grid.chargeAt(...at(3, 3)).fading, false);
  events = step(grid, .3);
  assert.equal(events.filter(e => e.type === 'SHOCK_FADING').length, 1);
  assert.equal(grid.chargeAt(...at(3, 3)).fading, true);
  events = step(grid, RULES.shockWarnSeconds);
  assert.ok(events.some(e => e.type === 'SHOCK_CLEARED'));
  assert.equal(grid.chargedCount, 0);
  assert.equal(grid.chargeAt(...at(3, 3)), null);
});

test('ice insulates: freezing a charged water cell clears it and frozen water does not conduct', () => {
  const grid = createDataArenaGrid({map:MAP});
  grid.applyShock(...at(17, 4), {team:0, radius:3}, []);
  const i = grid.index(17, 4);
  assert.ok(grid.charge[i] > 0);
  grid.freezeCell(i, 5, []);
  assert.equal(grid.charge[i], 0);
  assert.equal(grid.isConductive(i), false);
  const before = grid.chargedCount;
  assert.equal(grid.applyShock(...at(17, 4), {team:0}, []), 0);
  assert.equal(grid.chargedCount, before);
});

test('a later burst re-owns overlapping cells and resetDynamic clears all charge', () => {
  const grid = createDataArenaGrid({map:MAP});
  grid.applyShock(...at(3, 3), {team:0, radius:3}, []);
  grid.applyShock(...at(4, 3), {team:1, radius:3}, []);
  assert.equal(grid.chargeAt(...at(4, 3)).team, 1);
  grid.resetDynamic();
  assert.equal(grid.chargedCount, 0);
  assert.equal(grid.chargeAt(...at(4, 3)), null);
});

test('the harbor and duel maps never contain SHALLOW, so their rules are unchanged', async () => {
  const {DATA_ARENA_MAP, DATA_ARENA_DUEL_MAP} = await import('../src/championship/modes/dataArena/dataArenaConfig.js');
  for (const map of [DATA_ARENA_MAP, DATA_ARENA_DUEL_MAP]) assert.ok(map.rects.every(rect => rect[4] !== T.SHALLOW));
});
