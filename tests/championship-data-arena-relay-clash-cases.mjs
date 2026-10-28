// RELAY stage four (Owner 2026-10-28): hitstun delays windups, opposing shots
// clash both ways, and an element wheel scales damage 1.25x / 0.8x.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import { RELAY_ELEMENT_STRONG, RELAY_ELEMENTS, relayEffectiveness, relayElementWeakTo } from '../src/championship/modes/dataArena/dataArenaRelayElements.js';
import { RELAY_ROSTER } from '../src/championship/modes/dataArena/dataArenaRelayRoster.js';
import { relayBattleMap } from '../src/championship/modes/dataArena/dataArenaRelayMaps.js';

const run = (sim, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.step(input); };
const elementOf = (speciesId) => RELAY_ROSTER.find(p => p.speciesId === speciesId)?.element;
const fight = (partnerId, seed = 7) => { const sim = createDataArenaSimulation({ mode: 'RELAY', partnerId, relayArenaId: 'field_bm01_01', seed }); run(sim, 2.1); sim.drainEvents(); return sim; };

test('the element wheel is consistent: every element but physical beats and fears something', () => {
  for (const element of RELAY_ELEMENTS) {
    if (element === 'physical') { assert.deepEqual(RELAY_ELEMENT_STRONG.physical, []); assert.deepEqual(relayElementWeakTo('physical'), []); continue; }
    assert.ok(RELAY_ELEMENT_STRONG[element].length >= 1, element);
    assert.ok(relayElementWeakTo(element).length >= 1, element);
  }
  assert.equal(relayEffectiveness('fire', 'nature'), 1.25);
  assert.equal(relayEffectiveness('nature', 'fire'), 0.8);
  assert.equal(relayEffectiveness('water', 'fire'), 1.25);
  assert.equal(relayEffectiveness('physical', 'fire'), 1);
  assert.equal(relayEffectiveness('light', 'shadow'), 1.25);
  assert.equal(relayEffectiveness('shadow', 'light'), 1.25);
  for (const a of RELAY_ELEMENTS) for (const b of RELAY_ELEMENTS)
    if (!['light', 'shadow'].includes(a) || a === b) assert.ok(!(RELAY_ELEMENT_STRONG[a].includes(b) && RELAY_ELEMENT_STRONG[b].includes(a)), `${a}/${b}`);
});

test('a skill hit is scaled by the matchup and announced', () => {
  const sim = fight('ember-lizard');
  const rival = sim.getState().rivals[0], mult = relayEffectiveness('fire', elementOf(rival.speciesId));
  const events = [];
  for (let tries = 0; tries < 8 && !events.some(e => e.type === 'RIVAL_HIT' && e.cause === 'SKILL'); tries++) {
    sim.step({ cast: 0, autoAim: true }); for (let i = 0; i < 70; i++) { sim.step({}); events.push(...sim.drainEvents()); }
  }
  const hit = events.find(e => e.type === 'RIVAL_HIT' && e.cause === 'SKILL');
  assert.ok(hit, 'the ember bolt lands');
  assert.ok(Math.abs(hit.amount - 20 * mult) < 1e-6, `${hit.amount} vs ${20 * mult}`);
  if (mult !== 1) assert.ok(events.some(e => e.type === 'EFFECTIVE' && e.mult === mult && e.target === 'rival'));
});

test('hitstun pauses the staggered fighter\'s windup and walking, then lets it finish', () => {
  const sim = fight('corona-cub'), state = sim.getState();
  sim.step({ cast: 0, autoAim: true });
  const cast = state.player.cast;
  assert.ok(cast, 'a windup is in progress');
  state.player.hitstun = 0.15;
  const t = cast.t, x = state.player.x;
  for (let i = 0; i < 6; i++) sim.step({ moveX: 1 });
  assert.equal(state.player.cast?.t, t, 'windup clock held');
  assert.equal(state.player.x, x, 'no walking while staggered');
  run(sim, 0.5);
  assert.ok(sim.drainEvents().some(e => e.type === 'CAST_RELEASE'), 'the cast still releases afterwards');
});

test('opposing shots clash: steam, waves swallow, heavy wins, equals trade', () => {
  const zone = relayBattleMap('field_bm01_01').arenaZones[0], at = { x: (zone[0] + 0.5) * 32, y: (zone[1] + 0.5) * 32 };
  const shot = (owner, extra) => ({ id: Math.random(), owner, kind: owner === 'player' ? 'PBOLT' : 'RBOLT', x: at.x, y: at.y, vx: 0, vy: 0, radius: 10, damage: 15,
    range: 900, travelled: 0, life: 0, pierce: 0, hits: new Set(), onHit: null, onTerrain: null, knockback: 0, hp: 0, moveType: 'BOLT', arenaElement: 'physical', ...extra });
  const clash = (a, b) => { const sim = fight('ember-lizard'), shots = sim.getState().projectiles; shots.length = 0; shots.push(shot('player', a), shot('rival', b));
    sim.step({}); return { left: sim.getState().projectiles.map(p => p.owner), events: sim.drainEvents() }; };
  const steam = clash({ arenaElement: 'water' }, { arenaElement: 'fire' });
  assert.deepEqual(steam.left, []);
  assert.ok(steam.events.some(e => e.rule === 'STEAM_CLASH') && steam.events.some(e => e.type === 'ELEMENT_CHAIN' && e.kind === 'STEAM'));
  assert.deepEqual(clash({ moveType: 'WAVE', radius: 34 }, {}).left, ['player']);
  assert.deepEqual(clash({}, { moveType: 'WAVE', radius: 34 }).left, ['rival']);
  assert.deepEqual(clash({ radius: 14 }, {}).left, ['player']);
  assert.deepEqual(clash({}, {}).left, []);
  const pierce = clash({ radius: 14, pierce: 2 }, {});
  assert.deepEqual(pierce.left, ['player']);
  // A real rival wave (kind WAVE) meeting the player's fire shot: steam, not a one-way swallow.
  const realWave = clash({ arenaElement: 'fire' }, { kind: 'WAVE', moveType: 'WAVE', radius: 34, arenaElement: 'water' });
  assert.deepEqual(realWave.left, []);
  assert.ok(realWave.events.some(e => e.rule === 'STEAM_CLASH') && !realWave.events.some(e => e.rule === 'WAVE_SWALLOWS_SHOT'));
  // Equal waves trade from either side; a heavier wave wins from either side.
  assert.deepEqual(clash({ moveType: 'WAVE', radius: 34 }, { kind: 'WAVE', moveType: 'WAVE', radius: 34 }).left, []);
  assert.deepEqual(clash({ moveType: 'WAVE', radius: 40 }, { kind: 'WAVE', moveType: 'WAVE', radius: 34 }).left, ['player']);
  assert.deepEqual(clash({ moveType: 'WAVE', radius: 34 }, { kind: 'WAVE', moveType: 'WAVE', radius: 40 }).left, ['rival']);
});

test('a fighter staggered mid-walk stops at once (no walking drift)', () => {
  const sim = fight('corona-cub'), state = sim.getState();
  run(sim, 0.5, { moveX: 1 });
  assert.ok(Math.abs(state.player.vx) > 50, 'walking speed built up');
  state.player.hitstun = 0.15;
  const x = state.player.x, y = state.player.y;
  for (let i = 0; i < 6; i++) sim.step({ moveX: 1 });
  assert.ok(Math.hypot(state.player.x - x, state.player.y - y) < 0.5, `drifted ${Math.hypot(state.player.x - x, state.player.y - y)} px`);
});

test('frost puts a burn out (steam) and fire thaws a root', () => {
  const sim = fight('frost-drake', 11), rival = sim.getState().rivals[0];
  rival.burn = 3;
  const events = [], start = sim.getState().time;
  let clearedAt = null;
  for (let tries = 0; tries < 8 && clearedAt === null; tries++) {
    sim.step({ cast: 0, autoAim: true });
    for (let i = 0; i < 60; i++) { sim.step({}); events.push(...sim.drainEvents()); if (rival.burn === 0 && clearedAt === null) clearedAt = sim.getState().time - start; }
  }
  assert.ok(clearedAt !== null && clearedAt < 2.5, `burn cleared by the frost hit, not by running out (${clearedAt})`);
  assert.ok(events.some(e => e.type === 'ELEMENT_CHAIN' && e.kind === 'STEAM'));
});
