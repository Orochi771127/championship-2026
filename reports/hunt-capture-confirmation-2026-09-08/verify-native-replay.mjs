// Read-only comparison of this date's fresh ROM runs with the existing port.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createNativeRope, stepNativeRope } from '../../src/championship/hunt/capture/wildCaptureFlow.js';

const directory = new URL('./', import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory), 'utf8'));
const touch = read('native-touch-replay.json');
const cpu = read('native-distance-and-card.json');
assert.equal(touch.romSha256, cpu.romSha256);
assert.equal(touch.romSha256, '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1');
let before, input, pullCalls = 0;
const events = new Set();
for (const event of touch.events) {
  if (event.pc === '0x2114f54') before = event;
  if (event.input) input = event.input;
  if (!event.afterRope) continue;
  const actual = stepNativeRope(before.rope, before.target.hp, input);
  assert.deepEqual([actual.currentHp, actual.rope.durability, actual.rope.accumulatorQ12],
    [event.afterRope.hp, event.afterRope.durability, event.afterRope.accumulatorQ12], `fresh touch frame ${event.tick}`);
  if (actual.event !== null) events.add(actual.event);
  pullCalls++;
}
assert.equal(pullCalls, 198);
assert.deepEqual([...events].sort(), [0x11, 0x13]);
let boundaryUpdates = 0;
for (const vector of cpu.ropeBoundaryVectors) {
  let hp = 500;
  let rope = { ...createNativeRope({ ...cpu.input, maxHp: 500 }), damageQ12: vector.damageQ12 };
  for (const expected of vector.frames) {
    const result = stepNativeRope(rope, hp, {
      dxQ12: vector.distance * 4096, dyQ12: 0, movementBlocked: vector.movementBlocked,
    });
    hp = result.currentHp;
    rope = result.rope;
    assert.deepEqual([hp, rope.durability, rope.accumulatorQ12], expected, `fresh CPU distance ${vector.distance}`);
    boundaryUpdates++;
  }
}
const hpZero = touch.frames.find(frame => frame.hp === 0);
const handReady = touch.frames.find(frame => frame.ready === 1);
const onCard = touch.frames.find(frame => frame.cardCount === 1);
assert.deepEqual([hpZero.tick, handReady.tick, onCard.tick], [351, 367, 480]);
assert.equal(touch.frames.every(frame => frame.sourceHp === 210), true);
assert.deepEqual(touch.card, { speciesIndex: 10, currentHp: 210, maxHp: 210 });
assert.equal(cpu.output.homeCount, 1);
assert.equal(cpu.output.cardCountAfterHome, 0);

const source = JSON.parse(fs.readFileSync('docs/research/video-BV13u411B7BK/VIDEO_OBSERVATIONS.json', 'utf8'));
const inspectedFrames = source.observations.filter(row => ['V08', 'V50'].includes(row.id));
for (const row of inspectedFrames) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(row.framePath)).digest('hex'), row.sha256);
}
const privateDirectory = 'R:/Projects/Championship2026/_archive/hunt-confirmation-2026-09-08/';
const files = [
  ...['native-touch-replay.json', 'native-distance-and-card.json', 'verify-native-replay.mjs'].map(name => new URL(name, directory)),
  ...touch.pictures.map(row => privateDirectory + row.label + '.png'),
  privateDirectory + 'video-pull-live.png',
];
const hashes = files.map(path => ({
  path: path instanceof URL ? path.pathname : path,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),
}));
for (const row of touch.pictures) {
  assert.equal(hashes.find(file => file.path.endsWith('/' + row.label + '.png')).sha256, row.sha256);
}
const output = {
  date: '2026-09-08', status: 'PASS_BOUNDED_ORIGINAL_CAPTURE_CONFIRMATION', romSha256: touch.romSha256,
  inputAuthority: touch.inputAuthority, nativeStylusUpdatesCompared: pullCalls,
  boundaryDistances: cpu.ropeBoundaryVectors.map(row => row.distance), boundaryUpdates,
  observedFrames: { hpZero: hpZero.tick, handReady: handReady.tick, onCard: onCard.tick },
  originalCard: touch.card, controlledHomeCpuReplay: cpu.output,
  liveVideo: { mediaTimeSeconds: 64.029113, playerClockLabel: '01:05', observation: 'Two Pull labels; blue tether from left target to pointer. Local archived V08 and V50 frames separately re-inspected and hashes verified.' },
  runtimeModified: false, normalWebCaptureAccepted: false, physicalDeviceAccepted: false,
  batterySaveAccepted: false, batterySaveNote: 'DeSmuME warned that battery save was RAM-only. Capture/card evidence uses the loaded checkpoint and no battery-save claim is made.',
  limits: ['Japanese YDIJ versus English video; no binary version identity claim', 'One original touch encounter, not all species/tools/AI branches', 'CPU boundary replay uses declared host adapters and controlled state', 'No normal browser capture or new tool integration'],
  hashes,
};
fs.writeFileSync(new URL('verification.json', directory), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output, hashes: undefined }, null, 2));
