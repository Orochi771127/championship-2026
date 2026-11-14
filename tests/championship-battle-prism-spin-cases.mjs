import assert from 'node:assert/strict';
import test from 'node:test';
import { bindBattlePrismSpin, prismDragRatio, prismFrontIndex, prismSettleTurn, prismShape, prismTurnFor } from '../src/championship/presentation/vs5/battlePrismSpin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const rect = { left: 20, top: 30, width: 336, height: 276, right: 356, bottom: 306 };

function setup({ sides = 6 } = {}) {
  class Target {
    listeners = new Map();
    addEventListener(type, callback) { const list = this.listeners.get(type) ?? new Set(); list.add(callback); this.listeners.set(type, list); }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    dispatch(type, options = {}) {
      const event = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: 'touch', clientX: 180, clientY: 160,
        preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
      for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
      return event;
    }
  }
  const canvas = new Target(), view = new Target();
  canvas.ownerDocument = { defaultView: view };
  canvas.getBoundingClientRect = () => rect;
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = id => canvas.dispatch('lostpointercapture', { pointerId: id });
  canvas.focus = () => {};
  let clock = 0;
  const log = { turned: 0, releases: [], taps: 0, steps: [], activations: 0 };
  const controls = bindBattlePrismSpin({ canvas, sides: () => sides, now: () => clock,
    onTurn(delta) { log.turned += delta; }, onRelease(velocity) { log.releases.push(velocity); },
    onTap() { log.taps++; }, onStep(direction) { log.steps.push(direction); }, onActivate() { log.activations++; } });
  return { canvas, view, controls, log, tick(ms) { clock += ms; } };
}

test('the prism has one face per mode and turns one face per step', () => {
  const hex = prismShape(6);
  near(hex.step, Math.PI / 3);
  near(hex.faceWidth, 1); // a regular hexagon's side equals its circumradius
  const hept = prismShape(7);
  near(hept.step, Math.PI * 2 / 7);
  assert.throws(() => prismShape(2), /THREE_FACES/);
  assert.throws(() => prismShape(4.5), /THREE_FACES/);
});

test('the front face follows the turn in both directions and wraps round', () => {
  const step = Math.PI / 3;
  assert.equal(prismFrontIndex(0, 6), 0);
  assert.equal(prismFrontIndex(-step, 6), 1);
  assert.equal(prismFrontIndex(step, 6), 5);
  assert.equal(prismFrontIndex(-step * 6.4, 6), 0);
  assert.equal(prismFrontIndex(-step * 7, 6), 1);
  assert.equal(prismFrontIndex(-step * 0.49, 6), 0);
  assert.equal(prismFrontIndex(-step * 0.51, 6), 1);
});

test('turning to a face takes the short way round from where the prism is', () => {
  const step = Math.PI / 3, lap = Math.PI * 2;
  near(prismTurnFor(1, 0, 6), -step);
  near(prismTurnFor(5, 0, 6), -5 * step + lap); // one face back, not five forward
  near(prismTurnFor(0, -lap * 3 - 0.2, 6), -lap * 3);
  for (let index = 0; index < 7; index++) assert.equal(prismFrontIndex(prismTurnFor(index, 12.3, 7), 7), index);
});

test('a release settles on the nearest face and a flick carries it one further', () => {
  const step = Math.PI / 3;
  near(prismSettleTurn(step * 0.3, 0, 6), 0);
  near(prismSettleTurn(step * 0.7, 0, 6), step);
  near(prismSettleTurn(step * 0.3, 3, 6), step); // flicked forward past the near face
  near(prismSettleTurn(-step * 0.3, -3, 6), -step);
  near(prismSettleTurn(step * 0.7, 3, 6), step); // already heading to the next face
  near(prismSettleTurn(0, 3, 6), step);
  near(prismSettleTurn(step * 0.3, 1, 6), 0); // a slow release is not a flick
});

test('a drag across the canvas width turns a little more than two faces', () => {
  const ratio = prismDragRatio(6, rect.width);
  near(ratio * rect.width, Math.PI / 3 / 0.42);
  assert.ok(prismDragRatio(6, 0) > 0);
});

test('a horizontal drag turns the prism and a release reports its speed', () => {
  const s = setup();
  s.canvas.dispatch('pointerdown');
  for (let i = 1; i <= 5; i++) { s.tick(16); s.canvas.dispatch('pointermove', { clientX: 180 + i * 20 }); }
  s.tick(16);
  s.canvas.dispatch('pointerup', { clientX: 280 });
  near(s.log.turned, 100 * prismDragRatio(6, rect.width));
  assert.equal(s.log.taps, 0);
  assert.equal(s.log.releases.length, 1);
  assert.ok(s.log.releases[0] > 3, `flick speed ${s.log.releases[0]}`);
  assert.equal(s.controls.isDragging(), false);
  s.controls.dispose();
});

test('a slow drag released after a pause is not a flick', () => {
  const s = setup();
  s.canvas.dispatch('pointerdown');
  s.tick(16); s.canvas.dispatch('pointermove', { clientX: 240 });
  s.tick(400);
  s.canvas.dispatch('pointerup', { clientX: 240 });
  assert.deepEqual(s.log.releases, [0]);
});

test('vertical travel does not turn the prism, and a press without travel is a tap', () => {
  const s = setup();
  s.canvas.dispatch('pointerdown');
  s.canvas.dispatch('pointermove', { clientY: 230 });
  s.canvas.dispatch('pointerup', { clientY: 230 });
  assert.equal(s.log.turned, 0);
  assert.equal(s.log.taps, 0);
  s.canvas.dispatch('pointerdown');
  s.canvas.dispatch('pointerup', { clientX: 183 });
  assert.equal(s.log.taps, 1);
  // The compatibility click after a tap never reaches the page.
  const click = s.canvas.dispatch('click');
  assert.ok(click.prevented && click.stopped);
});

test('cancelled and lost pointers settle without a tap', () => {
  for (const kind of ['pointercancel', 'touchcancel', 'blur']) {
    const s = setup();
    s.canvas.dispatch('pointerdown');
    s.canvas.dispatch('pointermove', { clientX: 200 });
    (kind === 'blur' ? s.view : s.canvas).dispatch(kind, kind === 'pointercancel' ? {} : { pointerId: undefined });
    s.canvas.dispatch('pointerup');
    assert.equal(s.log.taps, 0, kind);
    assert.deepEqual(s.log.releases, [0], kind);
    assert.equal(s.controls.isDragging(), false);
  }
});

test('only a primary left press starts a drag', () => {
  const s = setup();
  s.canvas.dispatch('pointerdown', { button: 2 });
  s.canvas.dispatch('pointerdown', { isPrimary: false });
  assert.equal(s.controls.isDragging(), false);
});

test('arrow keys step one face, Enter and Space press the front face', () => {
  const s = setup();
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter', ' ', 'a']) s.canvas.dispatch('keydown', { key });
  assert.deepEqual(s.log.steps, [-1, 1]);
  assert.equal(s.log.activations, 2);
  s.canvas.dispatch('keydown', { key: 'ArrowRight', ctrlKey: true });
  assert.deepEqual(s.log.steps, [-1, 1]);
});

test('dispose removes every listener', () => {
  const s = setup();
  s.controls.dispose();
  s.controls.dispose();
  s.canvas.dispatch('pointerdown');
  s.canvas.dispatch('pointerup');
  s.canvas.dispatch('keydown', { key: 'Enter' });
  assert.equal(s.log.taps, 0);
  assert.equal(s.log.activations, 0);
  for (const list of s.canvas.listeners.values()) assert.equal(list.size, 0);
  for (const list of s.view.listeners.values()) assert.equal(list.size, 0);
});
