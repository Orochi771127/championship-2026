// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): burst evolution in the Data Arena relay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import { burstFormsFor } from '../src/championship/contracts/productBurstEvolution.js';

const relay = (partnerId, reserveId = 'relay-species-096') => createDataArenaSimulation({ mode: 'RELAY', partnerId, relayReserveId: reserveId, relayArenaId: 'field_bm02_01', seed: 5 });

test('a 成熟期 fighter bursts once into its first one-stage form, is drawn as it, and returns weakened', () => {
  const sim = relay('relay-species-087');
  const form = burstFormsFor(87).find(f => f.tier === 1).form;
  assert.equal(sim.getSnapshot().relay.burst.phase, 'CHARGING');
  assert.equal(sim.getSnapshot().relay.burst.form, form);
  const events = [];
  let burstAt = null;
  for (let i = 0; i < 60 * 150 && burstAt === null; i++) {
    sim.step({});
    for (const e of sim.drainEvents()) { events.push(e); if (e.type === 'BURST' && e.side === 'player') burstAt = sim.getState().time; }
  }
  assert.ok(burstAt !== null, 'the rival\'s hits fill the gauge and the partner bursts');
  assert.equal(sim.getState().player.burstPartnerId, `relay-species-${String(form).padStart(3, '0')}`);
  assert.equal(sim.getSnapshot().relay.burst.phase, 'BURST');
  for (let i = 0; i < 60 * 21 && sim.getSnapshot().relay?.burst?.phase === 'BURST'; i++) { sim.step({}); events.push(...sim.drainEvents()); }
  const phase = sim.getSnapshot().relay.burst.phase;
  assert.ok(['WEAK', 'SPENT'].includes(phase), phase);
  assert.ok(events.some(e => e.type === 'BURST_END' && e.side === 'player'));
  assert.equal(sim.getState().player.burstPartnerId, null);
  assert.equal(events.filter(e => e.type === 'BURST' && e.side === 'player').length, 1, 'once per match');
});

test('a 成長期 has no burst, and the rival that is a 成熟期 has its own', () => {
  const sim = relay('relay-species-035');
  assert.equal(sim.getSnapshot().relay.burst, null);
  const rivalPlans = [sim.getSnapshot().relay.rivalBurst];
  assert.ok(rivalPlans.every(plan => plan === null || plan.phase === 'CHARGING'));
});
