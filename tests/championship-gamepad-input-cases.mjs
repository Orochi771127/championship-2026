import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_BUTTONS,
  applyRadialDeadzone,
  createGamepadInputMapper,
  detectControllerFamily,
  getGamepadPrompts,
  mergeArenaGamepadInput
} from '../src/championship/app/gamepadInputMapper.js';

function makePad({ id = 'Xbox Wireless Controller (STANDARD GAMEPAD)', axes = [0, 0, 0, 0], pressed = [] } = {}) {
  const buttons = Array.from({ length: 16 }, (_, i) => ({
    pressed: pressed.includes(i),
    value: pressed.includes(i) ? 1 : 0
  }));
  return { index: 0, id, connected: true, mapping: 'standard', axes, buttons };
}

test('applyRadialDeadzone zeroes drift inside deadzone and rescales smoothly to unit circle', () => {
  assert.deepEqual(applyRadialDeadzone(0.1, -0.1, 0.18), { x: 0, y: 0, magnitude: 0 });
  const half = applyRadialDeadzone(0.59, 0, 0.18);
  assert.ok(half.x > 0.49 && half.x < 0.51);
  assert.equal(half.y, 0);
  const diag = applyRadialDeadzone(1, 1, 0.18);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-6);
});

test('gamepadInputMapper handles sticks, D-pad fallback, continuous fire, and rising-edge one-shot latches', () => {
  let pad = makePad({ axes: [0.05, 0.05, 0, 0], pressed: [] });
  const mapper = createGamepadInputMapper({ getGamepads: () => [pad] });

  // Idle frame
  const f0 = mapper.poll();
  assert.equal(f0.connected, true);
  assert.equal(f0.active, false);
  assert.equal(f0.family, 'xbox');

  // Press RT (fire), A (dash), X (skill0), RB (ult), LB (switchPartner), plus right-stick aim
  pad = makePad({
    axes: [0, 0, 0, -1],
    pressed: [STANDARD_BUTTONS.RT, STANDARD_BUTTONS.SOUTH, STANDARD_BUTTONS.WEST, STANDARD_BUTTONS.RB, STANDARD_BUTTONS.LB]
  });
  const f1 = mapper.poll();
  assert.equal(f1.active, true);
  assert.equal(f1.fire, true);
  assert.equal(f1.dash, true);
  assert.equal(f1.cast, 0);
  assert.equal(f1.ult, true);
  assert.equal(f1.switchPartner, true);
  assert.equal(f1.hasManualAim, true);
  assert.equal(f1.aimY, -1);

  // Holding the same buttons on next frame keeps continuous fire, does NOT re-trigger one-shots
  const f2 = mapper.poll();
  assert.equal(f2.fire, true);
  assert.equal(f2.dash, false);
  assert.equal(f2.cast, null);
  assert.equal(f2.ult, false);
  assert.equal(f2.switchPartner, false);

  // D-pad diagonal movement normalizes to unit length
  pad = makePad({ pressed: [STANDARD_BUTTONS.DPAD_UP, STANDARD_BUTTONS.DPAD_RIGHT] });
  const f3 = mapper.poll();
  assert.ok(Math.abs(Math.hypot(f3.moveX, f3.moveY) - 1) < 1e-6);
  assert.ok(f3.moveX > 0 && f3.moveY < 0);
});

test('mergeArenaGamepadInput preserves keyboard/mouse priority while adding controller actions', () => {
  const kbInput = {
    moveX: 0, moveY: 0, aimX: 1, aimY: 0, autoAim: true,
    fire: false, dash: false, guard: false, cast: null, ult: false, switchPartner: false, burst: false
  };
  const padFrame = {
    connected: true, active: true, moveX: 0.8, moveY: -0.6, aimX: 0, aimY: 1, hasManualAim: true,
    fire: true, dash: true, guard: false, cast: 2, ult: false, switchPartner: true, burst: false
  };
  const merged = mergeArenaGamepadInput(kbInput, padFrame);
  assert.equal(merged.moveX, 0.8);
  assert.equal(merged.aimY, 1);
  assert.equal(merged.autoAim, false);
  assert.equal(merged.fire, true);
  assert.equal(merged.dash, true);
  assert.equal(merged.cast, 2);
  assert.equal(merged.switchPartner, true);

  // When keyboard already moves, keyboard wins moveX/moveY
  const kbMoving = { ...kbInput, moveX: -1, moveY: 0, cast: 1 };
  const merged2 = mergeArenaGamepadInput(kbMoving, padFrame);
  assert.equal(merged2.moveX, -1);
  assert.equal(merged2.cast, 1);
});

test('controller family detection maps PlayStation, Nintendo, Xbox/Steam Deck prompts', () => {
  assert.equal(detectControllerFamily('DualSense Wireless Controller (054c-0ce6)'), 'playstation');
  assert.equal(getGamepadPrompts('DualSense Wireless Controller').dash, '✕');
  assert.equal(detectControllerFamily('Nintendo Switch Pro Controller'), 'nintendo');
  assert.equal(getGamepadPrompts('Nintendo Switch Pro Controller').ult, 'R');
  assert.equal(detectControllerFamily('Steam Deck Controller (28de-1205)'), 'xbox');
  assert.equal(getGamepadPrompts('Steam Deck Controller').switchPartner, 'LB');
});
