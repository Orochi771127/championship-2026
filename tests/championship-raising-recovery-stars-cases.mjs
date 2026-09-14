// Recovery-cage stars against the bounded native replay of OVL18
// 02110FB0..021110D4 (scripts/research/check-raising-recovery-stars-cpu.py),
// then through the real application clock.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stepNativeRaisingRecoveryStars, projectNativeRaisingRecoveryStars, NATIVE_RECOVERY_STAR_CAGES,
  NATIVE_RECOVERY_STAR_SEQUENCE } from '../src/championship/raising/nativeRaisingRecoveryStars.js';
import { getCageTraining, CAGE_TRAINING_CHANNELS } from '../src/championship/cage/cageEffects.js';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { createNativeRaisingGround } from '../src/championship/raising/nativeRaisingGround.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const receipt = read('docs/research/RAISING_RECOVERY_STARS_CPU_2026-09-14.json');

test('the star loop agrees with every update of the original replay', () => {
  assert.equal(receipt.updates.length, 901);
  const actor = {};
  let ticksSinceStart = 0, starts = 0, submits = 0;
  receipt.updates.forEach((update, index) => {
    Object.assign(actor, { state: update.state, cageDefinitionIndex: update.cageDefinitionIndex, positionQ12: update.positionQ12 });
    const before = actor.recoveryStars?.animator ?? null;
    stepNativeRaisingRecoveryStars(actor);
    const stars = actor.recoveryStars;
    const started = update.calls.filter(call => call[0] === 'start');
    const submit = update.calls.find(call => call[0] === 'submit');
    assert.equal(Number(stars.active), update.active, `active flag, update ${index}`);
    assert.equal(stars.rest, update.rest, `rest counter, update ${index}`);
    assert.equal(stars.animator !== before, started.length === 1, `start, update ${index}`);
    for (const call of started) { assert.equal(call[1], NATIVE_RECOVERY_STAR_SEQUENCE); ticksSinceStart = 0; starts++; }
    ticksSinceStart += update.calls.filter(call => call[0] === 'advance').length;
    const projected = projectNativeRaisingRecoveryStars(actor);
    assert.equal(Boolean(projected), Boolean(submit), `submit, update ${index}`);
    if (submit) {
      submits++;
      assert.deepEqual([...projected.positionQ12], submit[3], `lifted position, update ${index}`);
      assert.equal(projected.frameIndex, Math.min(6, Math.floor(ticksSinceStart / 9)), `frame, update ${index}`);
      assert.equal(projected.cell, 148 + projected.frameIndex);
    }
  });
  assert.equal(starts, 6);
  assert.equal(submits, 347);
});

test('the three star cages are exactly the catalog cages that recover HP and stress', () => {
  const recovering = Array.from({ length: 36 }, (_, index) => index)
    .filter(index => getCageTraining(index)?.channels.some(channel => channel.id === CAGE_TRAINING_CHANNELS.RECOVER_HP_STRESS));
  assert.deepEqual(recovering, [...NATIVE_RECOVERY_STAR_CAGES]);
});

test('stars need a body position and never read HP', () => {
  const actor = { state: 1, cageDefinitionIndex: 15, positionQ12: null, currentHp: 1 };
  stepNativeRaisingRecoveryStars(actor);
  assert.equal(actor.recoveryStars.active, false);
  actor.positionQ12 = [0, 0, 0];
  stepNativeRaisingRecoveryStars(actor);
  assert.equal(projectNativeRaisingRecoveryStars(actor).cell, 148);
  const source = readFileSync(new URL('../src/championship/raising/nativeRaisingRecoveryStars.js', import.meta.url), 'utf8');
  // Code only: the module's comments say what it does not read.
  assert.doesNotMatch(source.replace(/\/\/.*$/gm, ''), /\bhp\b|currentHp|heal/i);
});

// Application seam: the same helpers the lifecycle app cases use.
function createApp() {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  return createChampionshipStandaloneApp({ storage, catalog: read('src/data/championship/catalogs/creature-species.r1.json'),
    cages: read('docs/contracts/championship/raising-home-presentation.v1.json').cages, rngClock: () => ({ hour: 12, minute: 34, second: 56 }) });
}
function frames(app, n) {
  for (let i = 0; i < n; i++) {
    if (app.hasRaisingPresentation()) app.advanceRaisingPresentation({ frames: 1 }); else app.advanceNaturalClock({ frames: 1 });
    const mailbox = app.getRaisingMailbox();
    if (mailbox.activeId !== null && mailbox.queue.find(q => q.id === mailbox.activeId)?.system) app.acknowledgeRaisingMail();
  }
}
async function hatch(app) {
  const id = app.getRaisingInstances()[0].instanceId;
  for (let i = 0; i < 3; i++) { app.touchRaisingEgg(id); frames(app, 1); }
  frames(app, 200);
  assert.ok(app.getRaisingActorFrame(id).speciesIndex >= 8);
  return id;
}

test('the real app shows native stars in the mini infirmary only, rests between plays and stops while carried', async () => {
  const app = createApp();
  await app.newGame();
  const id = await hatch(app);
  for (let i = 0; i < 300; i++) { frames(app, 1); assert.equal(app.getRaisingActorFrame(id).recoveryStars, null, 'no stars outside a recovery cage'); }
  for (let i = 0; i < 300 && ![1, 2, 3, 5, 17].includes(app.getRaisingActorFrame(id).state); i++) frames(app, 1);

  const ground = createNativeRaisingGround(app.getCageEditFrame());
  let tile = null;
  for (let i = 0; i < ground.owners.length && !tile; i++)
    if (ground.owners[i] === 15 && ground.terrain[i] !== 1) tile = { x: (i % ground.width) * 8 + 4, y: Math.floor(i / ground.width) * 8 + 4 };
  assert.ok(tile, 'the starting ranch holds the mini infirmary');
  assert.equal(app.moveRaisingResidentToGround(id, tile), true);
  assert.equal(app.getRaisingActorFrame(id).cageDefinitionIndex, 15);

  const cells = new Set();
  let shown = 0, longestGap = 0, gap = 0;
  for (let i = 0; i < 600; i++) {
    frames(app, 1);
    const stars = app.getRaisingActorFrame(id).recoveryStars;
    if (stars) { shown++; cells.add(stars.cell); longestGap = Math.max(longestGap, gap); gap = 0; } else gap++;
  }
  assert.deepEqual([...cells].sort((a, b) => a - b), [148, 149, 150, 151, 152, 153, 154], 'all seven native cells play');
  assert.ok(shown >= 63 * 2, `at least two full plays, saw ${shown} drawn updates`);
  assert.ok(longestGap >= 121, `a rest of 120 updates separates plays, longest gap ${longestGap}`);

  const here = app.getRaisingActorFrame(id).positionQ12;
  assert.equal(app.beginRaisingCarry(id, { x: here[0] / 4096, y: 80 }), true);
  frames(app, 1);
  assert.equal(app.getRaisingActorFrame(id).state, 6);
  for (let i = 0; i < 5; i++) { frames(app, 1); assert.equal(app.getRaisingActorFrame(id).recoveryStars, null, 'carrying stops the stars'); }
});
