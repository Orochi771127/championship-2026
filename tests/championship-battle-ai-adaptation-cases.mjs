// Improved battle AI v1 (OWNER_APPROVED_ADAPTATION 2026-10-13).
//
// Not original behaviour: the original approach states leave a standing
// fighter idle inside a 32..48 px / vertical dead band (CPU-verified, see
// tests/championship-battle-null-target-launch-cases.mjs and the corner-stall
// report). These cases pin what the adaptation may do and what it must not.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BATTLE_AI_IDLE_FRAMES, BATTLE_AI_KICKS_PER_DECISION, battleAiApproachAim, stepBattleAiApproach
} from '../src/championship/battle/battleAiAdaptation.js';
import {battleAngleIndex} from '../src/championship/battle/battleNativeMath.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';

const px = n => n * 4096;
const noRng = {next() { throw new Error('the adaptation must not draw a random number'); }};

function host({point, targetPoint, frame, notification = 1, finished = 1, walk = 4096, status = 0}) {
  const notes = [];
  const angle = battleAngleIndex(targetPoint[1] - point[1], targetPoint[0] - point[0]);
  const distance = Math.round(Math.hypot(targetPoint[0] - point[0], targetPoint[1] - point[1]));
  return {notes, c: {state: 4, stateCounter: 8, field17C: notification, statusCode: status, field44: 0},
    h: {target: {}, point, targetPoint, angle, distance, frame, rng: noRng, notify: n => notes.push(n),
      finished: () => finished, walkSpeed: () => walk, angleTo: (x, y) => battleAngleIndex(y - point[1], x - point[0])}};
}

test('a standing fighter in the dead band walks only after the idle window, toward the original aim point', () => {
  const memo = {idleSince: null, kicks: 0};
  const point = [px(200), px(150), 0], targetPoint = [px(240), px(150), 0]; // 40 px, horizontal: dead band
  for (let frame = 100; frame < 100 + BATTLE_AI_IDLE_FRAMES; frame += 4) {
    const {c, h, notes} = host({point, targetPoint, frame});
    assert.equal(stepBattleAiApproach(c, h, memo), null);
    assert.deepEqual(notes, []);
  }
  const {c, h, notes} = host({point, targetPoint, frame: 100 + BATTLE_AI_IDLE_FRAMES});
  assert.equal(stepBattleAiApproach(c, h, memo), 'WALK');
  assert.deepEqual(notes, [7], 'the original walk notification');
  const aim = battleAiApproachAim(point, targetPoint, h.angle);
  assert.equal(aim.x, px(224), 'the original handler aims 16 px short of the target');
  assert.equal(c.field44, h.angleTo(aim.x, aim.y));
});

test('outside the dead band the original rule is left alone', () => {
  for (const targetPoint of [[px(260), px(150), 0], [px(225), px(150), 0]]) { // 60 px walks itself; 25 px launches itself
    const memo = {idleSince: 0, kicks: 0};
    const {c, h, notes} = host({point: [px(200), px(150), 0], targetPoint, frame: 500});
    assert.equal(stepBattleAiApproach(c, h, memo), null);
    assert.deepEqual(notes, []);
  }
});

test('hit, down, recovery, negative status, an unfinished attack pose or no walk speed: no action', () => {
  const point = [px(200), px(150), 0], targetPoint = [px(240), px(150), 0];
  for (const blocked of [{notification: 15}, {notification: 18}, {notification: 21}, {status: 6},
    {notification: 9, finished: 0}, {walk: 0}]) {
    const memo = {idleSince: 0, kicks: 0};
    const {c, h, notes} = host({point, targetPoint, frame: 500, ...blocked});
    assert.equal(stepBattleAiApproach(c, h, memo), null, JSON.stringify(blocked));
    assert.deepEqual(notes, []);
  }
  // A finished attack pose is a standing pose.
  const {c, h, notes} = host({point, targetPoint, frame: 500, notification: 9, finished: 1});
  assert.equal(stepBattleAiApproach(c, h, {idleSince: 0, kicks: 0}), 'WALK');
  assert.deepEqual(notes, [7]);
});

test('at most a few walks per decision, and a new decision restores the budget', () => {
  const memo = {idleSince: null, kicks: 0};
  const point = [px(200), px(150), 0], targetPoint = [px(240), px(150), 0];
  let frame = 0, walks = 0;
  for (let i = 0; i < 400; i++, frame += 4) {
    const {c, h} = host({point, targetPoint, frame});
    if (stepBattleAiApproach(c, h, memo)) walks++;
  }
  assert.equal(walks, BATTLE_AI_KICKS_PER_DECISION);
  const {c, h} = host({point, targetPoint, frame});
  c.stateCounter = 0; // the handler's entry frame: a fresh decision
  stepBattleAiApproach(c, h, memo);
  assert.equal(memo.kicks, 0);
});

test('a target on the wall is approached from its reachable side', () => {
  // Attacker below-left of a target near the left wall: the original aim
  // (16 px left of the target, x=28) is outside the 32 px clamp.
  const point = [px(34), px(190), 0], targetPoint = [px(44), px(150), 0];
  const memo = {idleSince: 0, kicks: 0};
  const {c, h, notes} = host({point, targetPoint, frame: 500});
  const aim = battleAiApproachAim(point, targetPoint, h.angle);
  assert.equal(aim.mirrored, true);
  assert.equal(aim.x, px(60), 'the same 16 px offset on the reachable side');
  assert.equal(stepBattleAiApproach(c, h, memo), 'WALK_MIRRORED');
  assert.deepEqual(notes, [7]);
  assert.equal(c.field44, h.angleTo(px(60), px(150)));
  // A reachable original aim is never mirrored.
  assert.equal(battleAiApproachAim([px(200), px(150), 0], [px(240), px(150), 0], 0).mirrored, false);
});

function individual(id, species, personality, rngSeed) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile};
}
/** Seed 5: four fighters held the dead band for ~400 frames under the original rule. */
function longestIdle(aiPolicy) {
  const seed = 5, a = [159, 148, 61], b = [124, 149, 186];
  const runtime = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy,
    playerIndividuals: a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals: b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  runtime.choosePracticeBattle({arenaIndex: 2});
  const source = runtime.startMatch();
  const last = [], run = Array(6).fill(0), longest = Array(6).fill(0);
  let clock = -1, adaptations = 0;
  for (let t = 0; t < 12000 && !source.getView().outcome.ended; t++) {
    source.tick();
    const view = source.getView();
    adaptations = view.nativeLifecycle.normalFlow.history.filter(e => e.type === 'AI_ADAPTATION').length || adaptations;
    if (view.clock.frames === clock) continue;
    clock = view.clock.frames;
    const flow = view.nativeLifecycle.normalFlow.slots, reactions = view.nativeLifecycle.reactions.combatants;
    view.combatants.forEach((c, i) => {
      if (!c?.present || !flow[i]) return;
      const p = flow[i].point, moved = last[i] ? Math.hypot(p[0] - last[i][0], p[1] - last[i][1]) : 1;
      last[i] = p;
      const able = c.hp.current > 0 && !reactions[i].suspended && [4, 5].includes(flow[i].state) && !flow[i].launches.some(x => x !== null);
      run[i] = able && moved < 1024 ? run[i] + 1 : 0;
      longest[i] = Math.max(longest[i], run[i]);
    });
  }
  runtime.dispose();
  return {longest: Math.max(...longest), adaptations, policy: aiPolicy};
}

test('baseline kept: the original rule still holds the seed-5 stand-off; the improved AI breaks it', () => {
  const original = longestIdle('ORIGINAL'), improved = longestIdle('IMPROVED_V1');
  assert.ok(original.longest >= 300, `original stand-off ${original.longest} frames`);
  assert.ok(improved.longest < 120, `improved longest idle ${improved.longest} frames`);
  assert.equal(original.adaptations, 0, 'the original policy never adapts');
});

test('the runtime defaults to the original rule and refuses an unknown policy', () => {
  const runtime = createBattleRuntime({schedule: {entryMode: 0, scheduleSlotA: 2, scheduleSlotB: 3, progressCounter: 0}});
  assert.equal(runtime.aiPolicy(), 'ORIGINAL');
  runtime.dispose();
  assert.throws(() => createBattleRuntime({schedule: {entryMode: 0}, aiPolicy: 'CHEAT'}), /AI_POLICY_UNKNOWN/);
});
