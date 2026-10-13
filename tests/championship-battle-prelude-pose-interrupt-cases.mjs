// Special whose owner is hit on its launch frame (2026-10-13).
//
// ROM (OVL19, SHA-256 8ad375ba…c5d1):
//   0210D678  the slot loop leaves once any +94 is set, but 0210D690 still
//             dispatches every active action object (0211CC7C)
//   0211D7C0  only an ENGAGED attacker is limited to engaged targets, so an
//             unengaged projectile may hit the owner that just engaged
//   0210D534  the exclusive branch runs the owner's notification update, whose
//             hit reaction selects its own sequences over the script's pose
//   02120900  the prelude leaves its pose wait only through 0211D3A8 ->
//             02047C48 (actor+0x7C == 0); CPU oracle: no other exit in 3600 frames
// The reaction ends on a looping idle that never clears +0x7C, so the battle
// waited forever: in the prelude (seed 2, detected as
// PRELUDE_NATIVE_TIMELINE_MISMATCH) or silently in the primary (seed 5).
// OWNER_APPROVED_ADAPTATION 2026-10-13: while the special holds the owner's
// lock, a script pose replaced by the owner's own notification lane counts as
// finished.

import assert from 'node:assert/strict';
import test from 'node:test';

import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';

function individual(id, species, personality, rngSeed) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile};
}

/** Diagnostic practice matches (fixed seeds, arena 2), not normal-game evidence. */
function run(seed, a, b) {
  const runtime = createBattleRuntime({mode: 5, battleType: 0, seed,
    playerIndividuals: a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals: b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  runtime.choosePracticeBattle({arenaIndex: 2});
  const source = runtime.startMatch();
  const launches = new Map(), reactions = new Map();
  let error = null, held = 0, longestHeld = 0, lastClock = -1;
  for (let tick = 0; tick < 12000 && !source.getView().outcome.ended; tick++) {
    try { source.tick(); } catch (e) { error = e; break; }
    const view = source.getView();
    for (const e of view.nativeLifecycle.normalFlow.history) if (e.type === 'LAUNCHED') launches.set(`${e.frame}:${e.slot}`, e);
    for (const e of view.nativeLifecycle.reactions.history) reactions.set(`${e.frame}:${e.slot}:${e.type}`, e);
    held = view.clock.frames === lastClock ? held + 1 : 0;
    longestHeld = Math.max(longestHeld, held);
    lastClock = view.clock.frames;
  }
  const view = source.getView();
  const result = {error, outcome: view.outcome, adaptations: view.nativeLifecycle.poseWaitAdaptations, longestHeld,
    launches: [...launches.values()], reactions: [...reactions.values()], engaged: view.combatants.map(c => c?.engaged ?? false)};
  runtime.dispose();
  return result;
}

const SEED2 = () => run(2, [8, 33, 174], [173, 34, 99]);
const SEED5 = () => run(5, [159, 148, 61], [124, 149, 186]);

function assertCompletes(r) {
  assert.equal(r.error, null, `the battle must not throw: ${r.error?.message}`);
  assert.equal(r.outcome.ended, true, 'the match reaches a result');
  // The battle clock stops only for hit pause and a special's engagement; the
  // old freezes held it forever. 600 ticks is far above one special's length.
  assert.ok(r.longestHeld < 600, `longest held battle clock: ${r.longestHeld} ticks`);
  assert.ok(r.engaged.every(e => !e), 'no engagement lock survives the match');
}

function assertLaunchOnce(r, frame, slot, moveId, cost) {
  assert.ok(r.reactions.find(e => e.slot === slot && e.type === 'HIT_STATE_WRITTEN' && e.frame === frame), 'owner hit on its launch frame');
  const launch = r.launches.find(e => e.slot === slot && e.frame === frame);
  assert.equal(launch?.moveId, moveId);
  assert.equal(launch.resourceBefore - launch.resourceAfter, cost, 'the special costs its action cost once');
  assert.equal(r.launches.filter(e => e.decisionId === launch.decisionId).length, 1, 'one launch per decision');
}

test('seed 2: the prelude whose owner was hit finishes and the match continues', () => {
  const r = SEED2();
  assertCompletes(r);
  assertLaunchOnce(r, 2380, 2, 435, 25);
  assert.deepEqual(r.adaptations.map(a => [a.slot, a.moveId, a.phase, a.reason]), [[2, 435, 'PRELUDE', 'OWNER_POSE_REPLACED_BY_NOTIFICATION']]);
  assert.equal(r.adaptations[0].replacedBy, 'ROM_NOTIFICATION_UPDATE');
  assert.ok(r.adaptations[0].preludeFrame > 0 && r.adaptations[0].preludeFrame < 84, 'the wait ends inside the projected prelude');
});

test('seed 5: the primary waiting on a replaced pose finishes instead of holding the clock', () => {
  const r = SEED5();
  assertCompletes(r);
  assertLaunchOnce(r, 1188, 1, 356, 40);
  assert.deepEqual(r.adaptations.map(a => [a.slot, a.moveId, a.phase]), [[1, 356, 'PRELUDE'], [1, 356, 'PRIMARY']]);
});
