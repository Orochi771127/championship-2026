// RELAY stage three (Owner 2026-10-28): destructible cover in each field's
// material and timed arena zones. Rules only; the scene reads these states.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RELAY_MAP_IDS, relayBattleMap, relayRotateCell } from '../src/championship/modes/dataArena/dataArenaRelayMaps.js';
import { RELAY_FIELD_THEMES, RELAY_COVER_LAYOUTS, RELAY_COVER_MATERIALS, RELAY_ARENA_RULES, createRelayArenaEvents } from '../src/championship/modes/dataArena/dataArenaRelayArena.js';
import { createDataArenaGrid } from '../src/championship/modes/dataArena/dataArenaGrid.js';
import { DATA_ARENA_TERRAIN as T } from '../src/championship/modes/dataArena/dataArenaConfig.js';
import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import { relayMoveElement } from '../src/championship/modes/dataArena/dataArenaRelay.js';

const run = (sim, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.step(input); };

test('every field places its whole cover layout on walkable ground, in both orientations', () => {
  for (const id of RELAY_MAP_IDS) {
    const theme = RELAY_FIELD_THEMES[id];
    for (const portrait of [false, true]) {
      const map = relayBattleMap(id, portrait), grid = createDataArenaGrid({ map });
      assert.equal(map.cover.length, RELAY_COVER_LAYOUTS[theme.layout].length, `${id} ${portrait}`);
      assert.equal(grid.props.length, map.cover.length);
      for (const prop of grid.props) {
        assert.equal(prop.material, theme.material);
        assert.equal(prop.maxHp, RELAY_COVER_MATERIALS[theme.material].hp);
        assert.ok(prop.cells.every(i => grid.terrain[i] === T.SOLID && !(grid.ice[i] > 0)), `${id} ${prop.id}`);
      }
      for (const [c, r] of map.arenaZones) assert.ok(['GROUND', 'SHALLOW', 'ICE'].includes(grid.surfaceAt((c + 0.5) * map.cell, (r + 0.5) * map.cell)), `${id} zone ${c},${r}`);
    }
    const wide = relayBattleMap(id, false), tall = relayBattleMap(id, true);
    assert.deepEqual(tall.arenaZones, wide.arenaZones.map(p => relayRotateCell(p)));
  }
});

test('cover takes 1.4x from its weak elements, breaks open and wood burns', () => {
  const stone = createDataArenaGrid({ map: relayBattleMap('field_bm01_01') }).props[0];
  const grid = createDataArenaGrid({ map: relayBattleMap('field_bm01_01') }), prop = grid.props[0], events = [];
  grid.damageProp(prop, 10, events, 'PROJECTILE', 'earth');
  assert.equal(prop.hp, stone.maxHp - 14);
  assert.ok(events.some(e => e.type === 'PROP_HIT' && e.weak && e.material === 'STONE'));
  grid.damageProp(prop, 10, events, 'PROJECTILE', 'fire');
  assert.equal(prop.hp, stone.maxHp - 24);
  grid.damageProp(prop, 999, events, 'PROJECTILE', 'fire');
  assert.ok(prop.destroyed && prop.cells.every(i => grid.terrain[i] === T.GROUND));
  assert.ok(events.some(e => e.type === 'PROP_DESTROYED' && e.material === 'STONE'));
  const wood = createDataArenaGrid({ map: relayBattleMap('field_bm02_01') });
  assert.ok(wood.props.every(p => p.combustible && p.cells.every(i => wood.flammable[i] === 1)));
  assert.equal(relayMoveElement('quakeSlam'), 'physical');
  assert.equal(relayMoveElement('relayBreath', 'fire'), 'fire');
  assert.equal(relayMoveElement('emberBolt'), 'fire');
});

test('arena zones follow warning, active and dormant on the round clock and pay once per cycle', () => {
  const map = relayBattleMap('field_bm01_01'), grid = createDataArenaGrid({ map }), events = [];
  const player = { x: 0, y: 0, hp: 100, maxHp: 100, energy: 50, cooldowns: { a: 5 } }, rival = { x: 0, y: 0, hp: 100, maxHp: 100, energy: 100, cooldowns: {} };
  const arena = createRelayArenaEvents({ map, grid, emit: e => events.push(e), now: () => 0, bodies: () => [player, rival],
    effects: { tpMax: 100, heal() {}, dashMissing: () => false, refillDash() {} } });
  const R = RELAY_ARENA_RULES, at = (t) => arena.step(1 / 60, t);
  at(R.firstWarning - 0.1); assert.equal(arena.state.phase, 'DORMANT');
  at(R.firstWarning + 0.1); assert.equal(arena.state.phase, 'WARNING');
  const zone = arena.state.zones[0]; player.x = zone.x; player.y = zone.y;
  at(R.firstWarning + R.warningSeconds + 0.1); assert.equal(arena.state.phase, 'ACTIVE');
  let t = R.firstWarning + R.warningSeconds + 0.1;
  for (let i = 0; i < 60; i++) at(t += 1 / 60);
  assert.equal(player.cooldowns.a, 5 - R.cooldownCut);
  assert.equal(events.filter(e => e.type === 'ARENA_CLAIM').length, 1);
  for (let i = 0; i < 120; i++) at(t += 1 / 60);
  assert.equal(events.filter(e => e.type === 'ARENA_CLAIM').length, 1, 'one claim per cycle');
  at(R.firstWarning + R.warningSeconds + R.activeSeconds + 0.1); assert.equal(arena.state.phase, 'DORMANT');
  at(R.firstWarning + R.intervalSeconds + 0.1); assert.equal(arena.state.phase, 'WARNING');
  assert.deepEqual(arena.state.claimed, [false, false]);
});

test('vents crack cover each active phase, updrafts speed only the bodies inside, the rival seeks useful zones', () => {
  const R = RELAY_ARENA_RULES, zoneOf = (arena) => arena.state.zones[0];
  const make = (id, rival) => { const map = relayBattleMap(id), grid = createDataArenaGrid({ map }), events = [];
    const player = { x: 0, y: 0, hp: 100, maxHp: 100, energy: 100, cooldowns: {} };
    return { grid, events, player, arena: createRelayArenaEvents({ map, grid, emit: e => events.push(e), now: () => 0, bodies: () => [player, rival],
      effects: { tpMax: 100, heal() {}, dashMissing: () => false, refillDash() {} } }) }; };
  const vent = make('field_bm03_01', { x: 0, y: 0, hp: 100, maxHp: 100, energy: 100, cooldowns: {} });
  vent.arena.step(1 / 60, R.firstWarning + R.warningSeconds + 0.1);
  for (const prop of vent.grid.props) assert.equal(prop.hp, prop.maxHp * (1 - R.coverPressure));
  vent.arena.step(1 / 60, R.firstWarning + R.warningSeconds + 0.2);
  for (const prop of vent.grid.props) assert.equal(prop.hp, prop.maxHp * (1 - R.coverPressure), 'once per phase');
  const rival = { x: 0, y: 0, hp: 100, maxHp: 100, energy: 40, cooldowns: {} };
  const up = make('field_bm05_01', rival);
  up.arena.step(1 / 60, R.firstWarning + R.warningSeconds + 0.1);
  const zone = zoneOf(up.arena);
  up.player.x = zone.x; up.player.y = zone.y;
  assert.equal(up.arena.speedScale(up.player), R.speedScale);
  assert.equal(up.arena.speedScale({ x: zone.x + 400, y: zone.y, hp: 1 }), 1);
  rival.x = zone.x + 100; rival.y = zone.y;
  assert.ok(up.arena.rivalTarget(rival));
  rival.x = zone.x + 2000; assert.equal(up.arena.rivalTarget(rival), null);
});

test('a real relay match runs its arena cycle and the rival chips cover', () => {
  const sim = createDataArenaSimulation({ mode: 'RELAY', partnerId: 'relay-species-106', relayArenaId: 'field_bm02_01', seed: 5 });
  const events = [];
  for (let i = 0; i < 60 * 36; i++) { sim.step({}); events.push(...sim.drainEvents()); }
  assert.ok(events.some(e => e.type === 'ARENA_WARNING') && events.some(e => e.type === 'ARENA_ACTIVE'));
  assert.equal(sim.getState().relay.arena.kind, 'BLOOM');
  assert.ok(events.some(e => e.type === 'PROP_HIT'), 'cover takes hits in a live match');
});
