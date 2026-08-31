// Negative-status slot -- OVL19 0x021145C0 apply, 0x0211452C clear,
// 0x021152E0 proc, 0x0210D700 tick / DoT.
//
// Independently re-dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 (OVL19 ram 0x0210B300).
//
// One slot per combatant: +0x158 runtime code, +0x15C remaining ticks.
// Overwrite, do not stack. Duration table is u16 at 0x0212FECC, indexed by
// runtime code * 2: 0, then 600 for 1..11, 900 for 12..14. A 0 duration does
// not write the slot (code 0 goes through clear instead).
//
// Action field_5C 1..13 → runtime codes via the second jump at 0x021153D4.
// Proc: delta = clamp(attackerIndex - resistanceIndex, -4, +4); tableIndex =
// delta+4; ldr [table, index lsl #3] so the payload is the first word of an
// 8-byte record. Normal table 0x02130038; field_5C==13 uses 0x02130034.
// RNG channel 216; apply if roll < threshold. Thresholds are not percents.
//
// Tick: if remaining <= 0, clear without DoT. Else remaining -= 1, then:
//   runtime 7 or 13 and remaining % 180 == 0 → subtract trunc(maxHP * 3 / 100)
//   runtime 14 and remaining % 10 == 0 → subtract trunc(maxHP * 5 / 100)
// If the subtract leaves HP < 0, store 0 and clear. Exact 0 does not clear.
//
// NOT in this file: reconstructed status names as gameplay, hit/miss,
// Sense downstream, a battle screen.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_STATUS_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_STATUS_PROC_RNG_CHANNEL = 216;
export const BATTLE_STATUS_PROC_DELTA_MIN = -4;
export const BATTLE_STATUS_PROC_DELTA_MAX = 4;

// 0 unused; field_5C 1..13 at 0x02115418.
const ACTION_STATUS_TO_RUNTIME = deepFreeze([
  0, 5, 7, 10, 9, 11, 8, 6, 12, 13, 2, 1, 4, 14
]);

export const BATTLE_STATUS_DURATION_BY_RUNTIME_CODE = deepFreeze([
  0, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 900, 900, 900
]);

export const BATTLE_STATUS_NORMAL_PROC_THRESHOLDS = deepFreeze([
  0, 5, 10, 15, 20, 25, 30, 35, 40
]);

export const BATTLE_STATUS_ID13_PROC_THRESHOLDS = deepFreeze([
  0, 0, 0, 0, 5, 6, 8, 12, 24
]);

export const BATTLE_STATUS_RESISTANCE_SENTINEL = 999;

export const BATTLE_STATUS_GATE_NORMAL = "NORMAL_SELECTION";
export const BATTLE_STATUS_GATE_CLEAR_THEN_NORMAL = "CLEAR_THEN_NORMAL";
export const BATTLE_STATUS_GATE_FORCE_STATE = "FORCE_STATE";
export const BATTLE_STATUS_GATE_SPECIAL = "SPECIAL_BRANCH";

const SPECIAL_MOVEMENT_Q12 = deepFreeze({ field184: 204800, field188: 122880 });

// field_5C 1..13 at 0x021152F4. "selected" is leftover r4 (defender index after +1).
// Offsets are on the defender stats object (combatant +0x10). Sentinel 999 @ 0x021156B0.
const RESISTANCE_SOURCE_BY_STATUS_ID = deepFreeze({
  1: "selected",
  2: 0xa0,
  3: 0xa4,
  4: "selected",
  5: 0x9c,
  6: "sentinel",
  7: "selected",
  8: "selected",
  9: 0xa0,
  10: 0xa0,
  11: "sentinel",
  12: "sentinel",
  13: 0x9c
});

const EMPTY_SLOT = deepFreeze({ runtimeCode: 0, remainingDuration: 0 });

function statusError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleStatusError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw statusError(`${label} must be a safe integer`);
  }
  return value;
}

function remainderTowardZero(value, modulus) {
  return value - modulus * Math.trunc(value / modulus);
}

export function mapActionStatusToRuntimeCode(actionStatusId) {
  requireSafeInteger(actionStatusId, "actionStatusId");
  if (actionStatusId < 1 || actionStatusId > 13) {
    throw statusError("action field_5C status id must be 1..13");
  }
  return ACTION_STATUS_TO_RUNTIME[actionStatusId];
}

function emptySlot() {
  return EMPTY_SLOT;
}

/**
 * 0x021145C0: HP <= 0 returns without writing. Code 0 clears. Duration 0
 * (ldrh cmp #0) does not store. Otherwise overwrite the single slot.
 */
export function applyNegativeStatus(input) {
  if (!input || typeof input !== "object") {
    throw statusError("applyNegativeStatus requires { runtimeCode, currentHp }");
  }
  const runtimeCode = requireSafeInteger(input.runtimeCode, "runtimeCode");
  const currentHp = requireSafeInteger(input.currentHp, "currentHp");
  if (currentHp <= 0) {
    return emptySlot();
  }
  if (runtimeCode === 0) {
    return emptySlot();
  }
  if (runtimeCode < 0 || runtimeCode >= BATTLE_STATUS_DURATION_BY_RUNTIME_CODE.length) {
    throw statusError("runtime status code must be 0..14");
  }
  const remainingDuration = BATTLE_STATUS_DURATION_BY_RUNTIME_CODE[runtimeCode];
  if (remainingDuration === 0) {
    return emptySlot();
  }
  return deepFreeze({ runtimeCode, remainingDuration });
}

export function statusResistanceIndex(input) {
  if (!input || typeof input !== "object") {
    throw statusError("statusResistanceIndex requires a plain object");
  }
  const actionStatusId = requireSafeInteger(input.actionStatusId, "actionStatusId");
  const source = RESISTANCE_SOURCE_BY_STATUS_ID[actionStatusId];
  if (source === undefined) {
    throw statusError("action field_5C status id must be 1..13");
  }
  if (source === "sentinel") {
    return BATTLE_STATUS_RESISTANCE_SENTINEL;
  }
  if (source === "selected") {
    return requireSafeInteger(input.selectedDefenseIndex, "selectedDefenseIndex");
  }
  if (source === 0x9c) {
    return requireSafeInteger(input.defenseIndex0x9C, "defenseIndex0x9C");
  }
  if (source === 0xa0) {
    return requireSafeInteger(input.defenseIndex0xA0, "defenseIndex0xA0");
  }
  return requireSafeInteger(input.defenseIndex0xA4, "defenseIndex0xA4");
}

export function statusProcThreshold(input) {
  if (!input || typeof input !== "object") {
    throw statusError("statusProcThreshold requires { actionStatusId, attackerIndex, resistanceIndex|routing }");
  }
  const actionStatusId = requireSafeInteger(input.actionStatusId, "actionStatusId");
  const attackerIndex = requireSafeInteger(input.attackerIndex, "attackerIndex");
  const resistanceIndex = input.resistanceIndex === undefined
    ? statusResistanceIndex(input)
    : requireSafeInteger(input.resistanceIndex, "resistanceIndex");
  if (actionStatusId < 1 || actionStatusId > 13) {
    throw statusError("action field_5C status id must be 1..13");
  }
  let delta = attackerIndex - resistanceIndex;
  if (delta < BATTLE_STATUS_PROC_DELTA_MIN) delta = BATTLE_STATUS_PROC_DELTA_MIN;
  if (delta > BATTLE_STATUS_PROC_DELTA_MAX) delta = BATTLE_STATUS_PROC_DELTA_MAX;
  const table = actionStatusId === 13
    ? BATTLE_STATUS_ID13_PROC_THRESHOLDS
    : BATTLE_STATUS_NORMAL_PROC_THRESHOLDS;
  return table[delta + 4];
}

function normalGate() {
  return deepFreeze({
    family: BATTLE_STATUS_GATE_NORMAL,
    clearsNegativeStatus: false,
    nextState: null,
    resetCooldownFromSpeed: false,
    movementQ12: null
  });
}

function forceState(nextState) {
  return deepFreeze({
    family: BATTLE_STATUS_GATE_FORCE_STATE,
    clearsNegativeStatus: false,
    nextState,
    resetCooldownFromSpeed: false,
    movementQ12: null
  });
}

function clearThenNormal() {
  return deepFreeze({
    family: BATTLE_STATUS_GATE_CLEAR_THEN_NORMAL,
    clearsNegativeStatus: true,
    nextState: null,
    resetCooldownFromSpeed: false,
    movementQ12: null
  });
}

/**
 * 0x021157BC. Runtime codes only. nextState values are the ARM r1 arguments
 * to 0x02114984 (8 / 10 / 9 / 12 / 3). Special branches do not apply Speed 80%.
 */
export function negativeStatusActionGate(input) {
  if (!input || typeof input !== "object") {
    throw statusError("negativeStatusActionGate requires { runtimeCode }");
  }
  const runtimeCode = requireSafeInteger(input.runtimeCode, "runtimeCode");
  if (runtimeCode < 0 || runtimeCode > 14) {
    throw statusError("runtime status code must be 0..14");
  }
  if (runtimeCode === 3) return forceState(9);
  if (runtimeCode === 4) return forceState(12);
  if (runtimeCode === 8 || runtimeCode === 9 || runtimeCode === 10 || runtimeCode === 12) {
    return clearThenNormal();
  }
  if (runtimeCode === 1 || runtimeCode === 5) {
    const auxiliaryTimer24 = requireSafeInteger(
      input.auxiliaryTimer24 === undefined ? 0 : input.auxiliaryTimer24,
      "auxiliaryTimer24"
    );
    if (auxiliaryTimer24 <= 0) {
      return deepFreeze({
        family: BATTLE_STATUS_GATE_SPECIAL,
        clearsNegativeStatus: false,
        nextState: runtimeCode === 1 ? 8 : 10,
        resetCooldownFromSpeed: false,
        movementQ12: null
      });
    }
    const speedIndex = requireSafeInteger(
      input.speedIndex === undefined ? 0 : input.speedIndex,
      "speedIndex"
    );
    return deepFreeze({
      family: BATTLE_STATUS_GATE_SPECIAL,
      clearsNegativeStatus: false,
      nextState: 3,
      resetCooldownFromSpeed: true,
      movementQ12: SPECIAL_MOVEMENT_Q12,
      decisionCooldown: 90 - 2 * speedIndex
    });
  }
  return normalGate();
}

/**
 * 0x021152E0: field_5C 0 skips before RNG. Apply when roll < threshold.
 * Pass resistanceIndex or the jump-table fields (selectedDefenseIndex / 0x9C / 0xA0 / 0xA4).
 */
export function tryApplyNegativeStatus(input) {
  if (!input || typeof input !== "object") {
    throw statusError("tryApplyNegativeStatus requires a plain object");
  }
  const actionStatusId = requireSafeInteger(input.actionStatusId, "actionStatusId");
  if (actionStatusId === 0) {
    return deepFreeze({ applied: false, runtimeCode: 0, remainingDuration: 0 });
  }
  const threshold = statusProcThreshold(input);
  const rng = input.rng;
  if (!rng || typeof rng.next !== "function") {
    throw statusError("status proc requires rng.next(channel)");
  }
  const roll = rng.next(BATTLE_STATUS_PROC_RNG_CHANNEL);
  if (!Number.isSafeInteger(roll)) {
    throw statusError("RNG channel 216 must return a safe integer");
  }
  if (roll >= threshold) {
    return deepFreeze({ applied: false, runtimeCode: 0, remainingDuration: 0 });
  }
  const slot = applyNegativeStatus({
    runtimeCode: mapActionStatusToRuntimeCode(actionStatusId),
    currentHp: input.currentHp
  });
  return deepFreeze({
    applied: slot.runtimeCode !== 0,
    runtimeCode: slot.runtimeCode,
    remainingDuration: slot.remainingDuration
  });
}

function applyDot(currentHp, maxHp, numerator) {
  const loss = Math.trunc((maxHp * numerator) / 100);
  return currentHp - loss;
}

/**
 * 0x0210D700. Decrements first, then tests the new remaining against 180 or 10.
 * HP < 0 after DoT → store 0 and clear. HP == 0 keeps the slot.
 */
export function tickNegativeStatus(input) {
  if (!input || typeof input !== "object") {
    throw statusError("tickNegativeStatus requires { runtimeCode, remainingDuration, currentHp, maxHp }");
  }
  const runtimeCode = requireSafeInteger(input.runtimeCode, "runtimeCode");
  const remainingDuration = requireSafeInteger(input.remainingDuration, "remainingDuration");
  let currentHp = requireSafeInteger(input.currentHp, "currentHp");
  const maxHp = requireSafeInteger(input.maxHp, "maxHp");

  if (runtimeCode === 0) {
    return deepFreeze({ runtimeCode: 0, remainingDuration, currentHp });
  }
  if (remainingDuration <= 0) {
    return deepFreeze({ runtimeCode: 0, remainingDuration: 0, currentHp });
  }

  const remaining = remainingDuration - 1;
  if (runtimeCode === 7 || runtimeCode === 13) {
    if (remainderTowardZero(remaining, 180) === 0) {
      currentHp = applyDot(currentHp, maxHp, 3);
    }
  } else if (runtimeCode === 14) {
    if (remainderTowardZero(remaining, 10) === 0) {
      currentHp = applyDot(currentHp, maxHp, 5);
    }
  }

  if (currentHp < 0) {
    return deepFreeze({ runtimeCode: 0, remainingDuration: 0, currentHp: 0 });
  }
  return deepFreeze({ runtimeCode, remainingDuration: remaining, currentHp });
}
