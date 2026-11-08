// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): burst evolution in the Data Arena relay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import { burstFormsFor } from '../src/championship/contracts/productBurstEvolution.js';

const relay = (partnerId, reserveId = 'relay-species-096', relayBurstPlans = {}) => createDataArenaSimulation({ mode: 'RELAY', partnerId, relayReserveId: reserveId, relayArenaId: 'field_bm02_01', seed: 5, relayBurstPlans });

test('a 成熟期 fighter bursts once into the form it learned, is drawn as it, and returns weakened', () => {
  const form = burstFormsFor(87).find(f => f.tier === 1).form;
  const sim = relay('relay-species-087', 'relay-species-096', { 'relay-species-087': { form, tier: 1 } });
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

// Owner 2026-11-08: only a form learned on the ranch; a 成熟期 that learned none (a Dex-only entry) never bursts.
test('a 成熟期 that learned no form never bursts', () => {
  assert.equal(relay('relay-species-087').getSnapshot().relay.burst, null);
});

test('a 成長期 has no burst, and the rival that is a 成熟期 has its own', () => {
  const sim = relay('relay-species-035');
  assert.equal(sim.getSnapshot().relay.burst, null);
  const rivalPlans = [sim.getSnapshot().relay.rivalBurst];
  assert.ok(rivalPlans.every(plan => plan === null || plan.phase === 'CHARGING'));
});
