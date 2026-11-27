// Standard W3C Gamepad API input mapper for Data Arena PC / Steam Deck manual play.
//
// Pure, standalone, zero-DOM-dependency module matching Data Arena's exact input
// contract (`moveX`, `moveY`, `aimX`, `aimY`, `fire`, `dash`, `guard`, `cast`,
// `ult`, `autoAim`, `switchPartner`, `burst`, `overLimit`, `pause`).
// Designed to plug into `dataArenaScreen.js` once the parallel VFX branch lands.

export const DEFAULT_GAMEPAD_DEADZONE = 0.18;
export const DEFAULT_TRIGGER_THRESHOLD = 0.35;

/** W3C Standard Gamepad button indices (Xbox / PlayStation / Steam Deck / Switch Pro). */
export const STANDARD_BUTTONS = Object.freeze({
  SOUTH: 0,      // A / Cross / B(Nintendo)
  EAST: 1,       // B / Circle / A(Nintendo)
  WEST: 2,       // X / Square / Y(Nintendo)
  NORTH: 3,      // Y / Triangle / X(Nintendo)
  LB: 4,         // L1
  RB: 5,         // R1
  LT: 6,         // L2
  RT: 7,         // R2
  BACK: 8,       // View / Create / Minus
  START: 9,      // Menu / Options / Plus
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
});

export const DEFAULT_ARENA_GAMEPAD_BINDINGS = Object.freeze({
  fire: Object.freeze([STANDARD_BUTTONS.RT]),
  dash: Object.freeze([STANDARD_BUTTONS.SOUTH]),
  guard: Object.freeze([STANDARD_BUTTONS.LT]),
  skill0: Object.freeze([STANDARD_BUTTONS.WEST]),
  skill1: Object.freeze([STANDARD_BUTTONS.NORTH]),
  skill2: Object.freeze([STANDARD_BUTTONS.EAST]),
  ult: Object.freeze([STANDARD_BUTTONS.RB]),
  switchPartner: Object.freeze([STANDARD_BUTTONS.LB]),
  burst: Object.freeze([STANDARD_BUTTONS.BACK, STANDARD_BUTTONS.R3]),
  pause: Object.freeze([STANDARD_BUTTONS.START])
});

export const GAMEPAD_PROMPTS = Object.freeze({
  xbox: Object.freeze({
    fire: 'RT', dash: 'A', guard: 'LT', skill0: 'X', skill1: 'Y', skill2: 'B',
    ult: 'RB', switchPartner: 'LB', burst: 'View', pause: 'Menu'
  }),
  playstation: Object.freeze({
    fire: 'R2', dash: '✕', guard: 'L2', skill0: '□', skill1: '△', skill2: '○',
    ult: 'R1', switchPartner: 'L1', burst: 'R3', pause: 'Options'
  }),
  nintendo: Object.freeze({
    fire: 'ZR', dash: 'B', guard: 'ZL', skill0: 'Y', skill1: 'X', skill2: 'A',
    ult: 'R', switchPartner: 'L', burst: '-', pause: '+'
  }),
  generic: Object.freeze({
    fire: 'RT', dash: 'A', guard: 'LT', skill0: 'X', skill1: 'Y', skill2: 'B',
    ult: 'RB', switchPartner: 'LB', burst: 'R3', pause: 'Start'
  })
});

export function detectControllerFamily(gamepadId) {
  const id = String(gamepadId ?? '').toLowerCase();
  if (!id) return 'generic';
  if (/dualsense|dualshock|playstation|sony|054c/.test(id)) return 'playstation';
  if (/nintendo|pro controller|joy-con|057e/.test(id)) return 'nintendo';
  if (/xbox|xinput|steam|deck|045e|28de/.test(id)) return 'xbox';
  return 'generic';
}

export function getGamepadPrompts(gamepadId) {
  return GAMEPAD_PROMPTS[detectControllerFamily(gamepadId)] ?? GAMEPAD_PROMPTS.generic;
}

/** Apply smooth radial deadzone and clamp magnitude to 1. */
export function applyRadialDeadzone(rawX, rawY, deadzone = DEFAULT_GAMEPAD_DEADZONE) {
  const x = Number.isFinite(rawX) ? rawX : 0;
  const y = Number.isFinite(rawY) ? rawY : 0;
  const mag = Math.hypot(x, y);
  const dz = Math.max(0, Math.min(0.9, Number.isFinite(deadzone) ? deadzone : DEFAULT_GAMEPAD_DEADZONE));
  if (mag <= dz) return { x: 0, y: 0, magnitude: 0 };
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled, magnitude: scaled };
}

function isButtonPressed(buttons, index, triggerThreshold) {
  const btn = buttons?.[index];
  if (!btn) return false;
  if (typeof btn === 'number') return btn >= triggerThreshold;
  if (typeof btn.value === 'number' && btn.value >= triggerThreshold) return true;
  return Boolean(btn.pressed);
}

function anyButtonPressed(buttons, indices, triggerThreshold) {
  for (const idx of indices) {
    if (isButtonPressed(buttons, idx, triggerThreshold)) return true;
  }
  return false;
}

function selectActiveGamepad(list, preferredIndex) {
  if (!list) return null;
  const pads = Array.from(list).filter((p) => p && p.connected !== false);
  if (!pads.length) return null;
  if (Number.isInteger(preferredIndex)) {
    const exact = pads.find((p) => p.index === preferredIndex);
    if (exact) return exact;
  }
  return pads.find((p) => p.mapping === 'standard') ?? pads[0];
}

/**
 * Create a stateful poller that converts the active connected Gamepad into a
 * frame-accurate Data Arena input snapshot with rising-edge one-shot latches.
 */
export function createGamepadInputMapper({
  getGamepads = () => (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []),
  deadzone = DEFAULT_GAMEPAD_DEADZONE,
  triggerThreshold = DEFAULT_TRIGGER_THRESHOLD,
  bindings = DEFAULT_ARENA_GAMEPAD_BINDINGS,
  preferredIndex = null
} = {}) {
  const mergedBindings = { ...DEFAULT_ARENA_GAMEPAD_BINDINGS, ...bindings };
  const prevState = {
    dash: false,
    guard: false,
    skill0: false,
    skill1: false,
    skill2: false,
    ult: false,
    switchPartner: false,
    burst: false,
    pause: false
  };
  let activeGamepadId = null;

  function resetLatches() {
    for (const k of Object.keys(prevState)) prevState[k] = false;
  }

  function poll() {
    let pads = null;
    try { pads = getGamepads(); } catch { pads = null; }
    const pad = selectActiveGamepad(pads, preferredIndex);
    if (!pad) {
      resetLatches();
      activeGamepadId = null;
      return Object.freeze({
        connected: false,
        gamepadId: null,
        family: 'generic',
        active: false,
        moveX: 0,
        moveY: 0,
        aimX: 0,
        aimY: 0,
        hasManualAim: false,
        fire: false,
        dash: false,
        guard: false,
        cast: null,
        ult: false,
        switchPartner: false,
        burst: false,
        pause: false
      });
    }

    if (activeGamepadId !== pad.id) {
      resetLatches();
      activeGamepadId = pad.id ?? '';
    }

    const axes = pad.axes ?? [];
    const buttons = pad.buttons ?? [];

    // Left stick with D-pad fallback.
    let move = applyRadialDeadzone(axes[0] ?? 0, axes[1] ?? 0, deadzone);
    if (move.magnitude === 0) {
      const dx = (isButtonPressed(buttons, STANDARD_BUTTONS.DPAD_RIGHT, triggerThreshold) ? 1 : 0)
        - (isButtonPressed(buttons, STANDARD_BUTTONS.DPAD_LEFT, triggerThreshold) ? 1 : 0);
      const dy = (isButtonPressed(buttons, STANDARD_BUTTONS.DPAD_DOWN, triggerThreshold) ? 1 : 0)
        - (isButtonPressed(buttons, STANDARD_BUTTONS.DPAD_UP, triggerThreshold) ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const inv = 1 / Math.hypot(dx, dy);
        move = { x: dx * inv, y: dy * inv, magnitude: 1 };
      }
    }

    // Right stick manual aim (autoAim resumes when right stick returns to deadzone).
    const aim = applyRadialDeadzone(axes[2] ?? 0, axes[3] ?? 0, deadzone);
    const hasManualAim = aim.magnitude > 0;

    const fire = anyButtonPressed(buttons, mergedBindings.fire, triggerThreshold);

    const rising = {};
    for (const key of Object.keys(prevState)) {
      const down = anyButtonPressed(buttons, mergedBindings[key] ?? [], triggerThreshold);
      rising[key] = down && !prevState[key];
      prevState[key] = down;
    }

    const cast = rising.skill0 ? 0 : rising.skill1 ? 1 : rising.skill2 ? 2 : null;
    const active = move.magnitude > 0 || hasManualAim || fire || cast !== null
      || rising.dash || rising.guard || rising.ult || rising.switchPartner || rising.burst || rising.pause;

    return Object.freeze({
      connected: true,
      gamepadId: activeGamepadId,
      family: detectControllerFamily(activeGamepadId),
      active,
      moveX: move.x,
      moveY: move.y,
      aimX: hasManualAim ? aim.x : 0,
      aimY: hasManualAim ? aim.y : 0,
      hasManualAim,
      fire,
      dash: rising.dash,
      guard: rising.guard,
      cast,
      ult: rising.ult,
      switchPartner: rising.switchPartner,
      burst: rising.burst,
      pause: rising.pause
    });
  }

  return Object.freeze({ poll, reset: resetLatches });
}

/**
 * Merge a polled gamepad frame into an existing Data Arena keyboard/mouse/touch
 * input object without clobbering active keyboard movement or mouse aim.
 */
export function mergeArenaGamepadInput(baseInput, pad) {
  if (!pad || !pad.connected || !pad.active) return baseInput;
  const usePadMove = baseInput.moveX === 0 && baseInput.moveY === 0 && (pad.moveX !== 0 || pad.moveY !== 0);
  const usePadAim = pad.hasManualAim;
  return {
    ...baseInput,
    moveX: usePadMove ? pad.moveX : baseInput.moveX,
    moveY: usePadMove ? pad.moveY : baseInput.moveY,
    aimX: usePadAim ? pad.aimX : baseInput.aimX,
    aimY: usePadAim ? pad.aimY : baseInput.aimY,
    autoAim: usePadAim ? false : baseInput.autoAim,
    fire: Boolean(baseInput.fire || pad.fire),
    dash: Boolean(baseInput.dash || pad.dash),
    guard: Boolean(baseInput.guard || pad.guard),
    cast: baseInput.cast !== null && baseInput.cast !== undefined ? baseInput.cast : pad.cast,
    ult: Boolean(baseInput.ult || pad.ult),
    switchPartner: Boolean(baseInput.switchPartner || pad.switchPartner),
    burst: Boolean(baseInput.burst || pad.burst)
  };
}
