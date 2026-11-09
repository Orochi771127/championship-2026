import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  TOWER_FLOORS, TOWER_BANDS, towerBand, towerOpponents, towerOpponentSpecies, towerRewards, isTowerGuardianFloor, isTowerChestFloor,
  normalizeJourney, patrolRate, patrolStatus, claimPatrol, quickPatrol, clearTowerFloor, towerNextFloor
} from '../src/championship/contracts/productJourney.js';
import { productSpeciesRecord } from '../src/championship/contracts/productSpeciesData.js';

const catalog = JSON.parse(readFileSync('src/data/championship/catalogs/free-battle.r1.json', 'utf8'));
const HOUR = 3600000;

test('the bands cover floors 1-100 once, in the original preset tiers, low to high', () => {
  const covered = [];
  for (const band of TOWER_BANDS) for (let f = band.from; f <= band.to; f++) covered.push(f);
  assert.deepEqual(covered, Array.from({ length: TOWER_FLOORS }, (_, i) => i + 1));
  assert.deepEqual(TOWER_BANDS.map(b => b.tier), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(towerBand(25).stage, 'ROOKIE');
  assert.equal(towerBand(26).stage, 'CHAMPION');
  assert.equal(towerBand(61).stage, 'AWAKENED');
  assert.equal(towerBand(100).stage, 'ULTIMATE');
});

test('every floor fights real presets of its tier, the same ones every time, without repeats', () => {
  for (let floor = 1; floor <= TOWER_FLOORS; floor++) {
    const opponents = towerOpponents(floor);
    assert.equal(opponents.length, floor <= 10 ? 1 : 3, `floor ${floor}`);
    assert.equal(new Set(opponents).size, opponents.length);
    const tier = new Set(catalog.pools[towerBand(floor).tier].flat());
    assert.ok(opponents.every(index => tier.has(index)), `floor ${floor} stays in its tier`);
    assert.deepEqual(towerOpponents(floor), opponents);
    assert.equal(towerOpponentSpecies(floor).length, opponents.length);
  }
  // The top floors are 究極體 (generation 6) teams, the first floors 幼年期.
  assert.ok(towerOpponentSpecies(100).every(s => productSpeciesRecord(s).generationIndex >= 5));
  assert.ok(towerOpponentSpecies(1).every(s => productSpeciesRecord(s).generationIndex <= 3));
});

test('a guardian floor leads with its tier\'s richest preset', () => {
  for (const floor of [10, 50, 100]) {
    const pool = [...new Set(catalog.pools[towerBand(floor).tier].flat())];
    const richest = Math.max(...pool.map(i => catalog.presets[i - catalog.presetStart].field0C));
    assert.equal(catalog.presets[towerOpponents(floor)[0] - catalog.presetStart].field0C, richest);
  }
});

test('rewards: crystals every floor, a chest every 5th, a guardian prize every 10th, never Bits', () => {
  assert.deepEqual({ ...towerRewards(3) }, { floor: 3, crystals: 120, tickets: 0, diamonds: 0, chest: false, guardian: false });
  assert.deepEqual({ ...towerRewards(5) }, { floor: 5, crystals: 200 + 500 + 300, tickets: 1, diamonds: 0, chest: true, guardian: false });
  assert.deepEqual({ ...towerRewards(10) }, { floor: 10, crystals: 400 + 500 + 600, tickets: 3, diamonds: 100, chest: true, guardian: true });
  assert.equal(isTowerGuardianFloor(30), true); assert.equal(isTowerChestFloor(35), true); assert.equal(isTowerChestFloor(36), false);
  let diamonds = 0; for (let f = 1; f <= 100; f++) diamonds += towerRewards(f).diamonds;
  assert.equal(diamonds, 1000);
  assert.ok(!Object.keys(towerRewards(10)).includes('bits'));
});

test('floors are climbed in order; a first clear pays once and a replay pays nothing', () => {
  let state = normalizeJourney(null);
  assert.equal(towerNextFloor(state), 1);
  assert.equal(clearTowerFloor(state, 2).rewards, null, 'cannot skip a floor');
  let cleared = clearTowerFloor(state, 1, ['a', 'b']);
  assert.equal(cleared.rewards.floor, 1);
  state = cleared.state;
  assert.equal(state.tower.best, 1); assert.deepEqual(state.tower.team, ['a', 'b']);
  assert.equal(towerNextFloor(state), 2);
  assert.equal(clearTowerFloor(state, 1).rewards, null, 'a replay pays nothing');
  state = normalizeJourney({ version: 1, tower: { best: 100 } });
  assert.equal(towerNextFloor(state), 100);
});

test('patrol makes 120 + 38 x best floor an hour and holds at most 12 hours', () => {
  const at = 1_700_000_000_000;
  let state = normalizeJourney({ version: 1, tower: { best: 50 } });
  assert.equal(patrolRate(state), 2020);
  const started = claimPatrol(state, at);
  assert.equal(started.crystals, 0, 'the first collect only starts the count');
  state = started.state;
  assert.deepEqual({ ...patrolStatus(state, at + 3 * HOUR) }, { rate: 2020, hours: 3, crystals: 6060, full: false, started: true });
  assert.equal(patrolStatus(state, at + 30 * HOUR).crystals, 2020 * 12);
  assert.equal(patrolStatus(state, at + 30 * HOUR).full, true);
  const paid = claimPatrol(state, at + 3 * HOUR);
  assert.equal(paid.crystals, 6060);
  assert.equal(patrolStatus(paid.state, at + 3 * HOUR).crystals, 0);
  // A clock set backwards restarts the count and pays nothing.
  const back = claimPatrol(paid.state, at);
  assert.equal(back.crystals, 0);
  assert.equal(back.state.patrol.since, at);
});

test('the quick patrol is two hours, once per local day', () => {
  const state = normalizeJourney({ version: 1, tower: { best: 10 } });
  const quick = quickPatrol(state, '2026-11-10');
  assert.equal(quick.crystals, (120 + 380) * 2);
  assert.equal(quickPatrol(quick.state, '2026-11-10'), null);
  assert.ok(quickPatrol(quick.state, '2026-11-11'));
  assert.equal(quickPatrol(state, 'yesterday'), null);
});

test('a broken record falls back field by field', () => {
  assert.deepEqual(normalizeJourney({ version: 1, tower: { best: 999, team: ['a', 'a', 7, 'b', 'c', 'd'] }, patrol: { since: -5, quickDay: 'x' } }),
    { version: 1, tower: { best: 100, team: ['a', 'b', 'c'] }, patrol: { since: null, quickDay: null } });
  assert.deepEqual(normalizeJourney('nope').tower, { best: 0, team: [] });
});
