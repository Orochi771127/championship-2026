// Launch with a cleared target (2026-10-13): the corner stall.
//
// ROM (OVL19, SHA-256 8ad375ba…c5d1):
//   02116B10  bl 0x0210F8C4      allocate from the launch-object pool; no target read
//   02116B68  ldr r3,[r5,#0x5C]  the target object, passed to the initialiser
//   0211C0A0  movs r4,r3 / moveq r0,#0 / popeq   a null target returns 0
//   02116C24  release the slot, clear object bit 0, state 1
// So a combatant whose target was knocked out on the frame it reached launch
// range goes back to choosing. The port refused the allocation instead, which
// sent state 14 down the "no object" path that waits for its current animation
// to finish -- a looping walk never does, so the combatant walked into the
// arena edge and stood there for the rest of the match.

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

/** The diagnostic practice match that first showed the stall (seed 24). */
function runSeed24() {
  const seed = 24, a = [14, 183, 60], b = [179, 184, 185];
  const runtime = createBattleRuntime({mode: 5, battleType: 0, seed,
    playerIndividuals: a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals: b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  runtime.choosePracticeBattle({arenaIndex: 2});
  const source = runtime.startMatch();
  const inLaunch = Array(6).fill(0), longest = Array(6).fill(0), history = new Map();
  let lastClock = -1;
  for (let tick = 0; tick < 12000 && !source.getView().outcome.ended; tick++) {
    source.tick();
    const view = source.getView();
    for (const entry of view.nativeLifecycle.normalFlow.history) history.set(`${entry.frame}:${entry.slot}:${entry.type}:${entry.reason ?? ''}`, entry);
    if (view.clock.frames === lastClock) continue; // hit pause: the battle clock holds
    lastClock = view.clock.frames;
    view.nativeLifecycle.normalFlow.slots.forEach((slot, i) => {
      inLaunch[i] = slot && slot.state === 14 && view.combatants[i].hp.current > 0 ? inLaunch[i] + 1 : 0;
      longest[i] = Math.max(longest[i], inLaunch[i]);
    });
  }
  const outcome = source.getView().outcome;
  runtime.dispose();
  return {longest, history: [...history.values()], outcome};
}

test('a launch whose target was cleared is refused by the initialiser and the combatant chooses again', () => {
  const {longest, history, outcome} = runSeed24();
  const refused = history.filter(entry => entry.type === 'LAUNCH_REFUSED' && entry.reason === 'NULL_TARGET_0211C0A0');
  assert.ok(refused.length >= 1, 'the cleared-target launch reaches the initialiser');
  for (const entry of refused) assert.equal(entry.resourceAfter, entry.resourceBefore, 'a refused launch charges nothing');
  // Before the fix slot 5 held state 14 for well over 1000 battle frames.
  assert.ok(Math.max(...longest) < 200, `longest uninterrupted state-14 hold: ${Math.max(...longest)} frames`);
  assert.equal(outcome.ended, true);
});
