// OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102): burst evolution in the auto battle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleBurst,BATTLE_BURST_WRAP_FRAMES,BATTLE_BURST_FRAMES,BATTLE_BURST_WEAK_FRAMES} from '../src/championship/battle/battleBurst.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createChannelRng} from '../src/championship/battle/battleRngChannel.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {burstBasesFor,burstFormsFor} from '../src/championship/contracts/productBurstEvolution.js';

const alive = () => ({currentHp: 100});

test('a full gauge wraps (battle held), bursts, reverts weakened, then is spent; once per battle', () => {
  const burst = createBattleBurst({policy: 'BURST_V1', plans: [{form: 139, tier: 1}, null, null, null, null, null]});
  const slots = [alive(), null, null, alive(), null, null];
  assert.equal(burst.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), 100);
  burst.onHit({attackerSlot: 3, defenderSlot: 0, damage: 60, defenderMaxHp: 100}); // taken 60% of max -> 120
  assert.equal(burst.snapshot(0).gauge, 100);
  assert.deepEqual(burst.step(10, slots).map(e => e.kind), ['WRAP']);
  assert.equal(burst.holding(), true);
  assert.equal(burst.display(0), null, 'still the 成熟期 while the shell wraps');
  for (let i = 1; i < BATTLE_BURST_WRAP_FRAMES; i++) assert.deepEqual(burst.hold(10), []);
  assert.equal(burst.snapshot(0).wrapFrame, BATTLE_BURST_WRAP_FRAMES - 1);
  assert.deepEqual(burst.hold(10).map(e => e.kind), ['BURST']);
  assert.equal(burst.holding(), false);
  assert.equal(burst.display(0), 139);
  assert.equal(burst.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), 140);
  assert.equal(burst.scaleDamage({attackerSlot: 3, defenderSlot: 0, damage: 140}), 100);
  assert.deepEqual(burst.step(10 + BATTLE_BURST_FRAMES, slots).map(e => e.kind), ['REVERT']);
  assert.equal(burst.display(0), null);
  assert.equal(burst.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), 85);
  assert.deepEqual(burst.step(10 + BATTLE_BURST_FRAMES + BATTLE_BURST_WEAK_FRAMES, slots).map(e => e.kind), ['RECOVERED']);
  burst.onHit({attackerSlot: 3, defenderSlot: 0, damage: 100, defenderMaxHp: 100});
  assert.deepEqual(burst.step(99999, slots), [], 'once per battle');
  assert.deepEqual(burst.bursts().map(b => [b.slot, b.form]), [[0, 139]]);
});

test('a former 究極體 preset is shown as its 成熟期 and fights at its preset strength only after bursting', () => {
  const base = burstBasesFor(211)[0];
  const burst = createBattleBurst({policy: 'BURST_V1', plans: [null, null, null, {form: 211, tier: 2, baseline: 1.7, base}, null, null]});
  assert.equal(burst.display(3), base);
  assert.equal(burst.scaleDamage({attackerSlot: 3, defenderSlot: 0, damage: 170}), 100);
  assert.equal(burst.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), 170);
  burst.onHit({attackerSlot: 0, defenderSlot: 3, damage: 60, defenderMaxHp: 100});
  burst.step(1, [alive(), null, null, alive(), null, null]);
  for (let i = 0; i < BATTLE_BURST_WRAP_FRAMES; i++) burst.hold(1);
  assert.equal(burst.display(3), null, 'after its burst it is its own preset species');
  assert.equal(burst.scaleDamage({attackerSlot: 3, defenderSlot: 0, damage: 170}), 170);
});

test('OFF changes nothing and a down combatant never bursts', () => {
  const off = createBattleBurst({policy: 'OFF', plans: [{form: 139, tier: 1}]});
  off.onHit({attackerSlot: 1, defenderSlot: 0, damage: 999, defenderMaxHp: 1});
  assert.deepEqual(off.step(1, [alive()]), []);
  assert.equal(off.scaleDamage({attackerSlot: 0, defenderSlot: 1, damage: 7}), 7);
  assert.equal(off.snapshot(0), null);
  const on = createBattleBurst({policy: 'BURST_V1', plans: [{form: 139, tier: 1}]});
  on.onHit({attackerSlot: 1, defenderSlot: 0, damage: 999, defenderMaxHp: 1});
  assert.deepEqual(on.step(1, [{currentHp: 0}]), []);
  assert.throws(() => createBattleBurst({policy: 'X'}), /BATTLE_BURST_POLICY_UNKNOWN/);
});

test('a real match holds the battle during the wrap, shows the burst form and reports it for the encyclopedia', () => {
  const individual = (id, species) => ({instanceId: id, nativeProfile: nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => 50}}))});
  const playerBase = burstBasesFor(139)[0], form = burstFormsFor(playerBase).find(f => f.form === 139);
  const runtime = createBattleRuntime({mode: 3, battleType: 0, localTeamIndex: 0, rng: createChannelRng(0x2026),
    playerIndividuals: [individual('qa-player', playerBase)], opponentIndividuals: [individual('qa-foe', 144)],
    burstPolicy: 'BURST_V1', burstPlans: [{form: form.form, tier: form.tier}, null, null, null, null, null]});
  try {
    runtime.chooseLinkBattle({arenaIndex: 0});
    const source = runtime.startMatch();
    let wrapFrame = null, held = 0, shownForm = false;
    for (let tick = 0; tick < 30000 && !source.getView().outcome.ended; tick++) {
      const before = source.getView().combatants[0];
      source.tick();
      const after = source.getView().combatants[0];
      if (after.burst?.phase === 'WRAP') {
        held++;
        if (wrapFrame === null) wrapFrame = source.getView().clock.frames;
        assert.equal(after.speciesId, `species-${String(playerBase).padStart(3, '0')}`);
      }
      if (before.burst?.phase === 'WRAP' && after.burst?.phase === 'WRAP') assert.equal(source.getView().clock.frames, wrapFrame, 'the battle clock holds');
      if (after.burst?.phase === 'BURST') {
        shownForm ||= after.speciesId === `species-${String(form.form).padStart(3, '0')}`;
        assert.equal(after.nativeAnimation, null, 'the burst form is drawn from its own art');
      }
    }
    assert.ok(held >= 1, 'the partner burst');
    assert.ok(shownForm, 'the burst form was shown');
    const result = runtime.getSettlementResult();
    assert.deepEqual(result.bursts, [form.form]);
  } finally { runtime.dispose(); }
});
