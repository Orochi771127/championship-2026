// Action resource — OVL19 0x0211C144 charge, guard at 0x0211C24C.
// The field the brief called TP, now traced. Charge only; no regeneration.

import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_ACTION_RESOURCE_CHARGED,
  BATTLE_ACTION_RESOURCE_CHARGE_SITE,
  BATTLE_ACTION_RESOURCE_COST_OFFSET,
  BATTLE_ACTION_RESOURCE_CURRENT_OFFSET,
  BATTLE_ACTION_RESOURCE_EVIDENCE,
  BATTLE_ACTION_RESOURCE_MAX_OFFSET,
  BATTLE_ACTION_RESOURCE_REFUSED,
  canAffordAction,
  chargeActionResource
} from "../src/championship/battle/battleActionResource.js";

import { resolveAiReserve } from "../src/championship/battle/battleActionSelection.js";

test("offsets are the dumped ones", () => {
  assert.equal(BATTLE_ACTION_RESOURCE_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_ACTION_RESOURCE_CHARGE_SITE, "OVL19:0x0211C144");
  assert.equal(BATTLE_ACTION_RESOURCE_CURRENT_OFFSET, 0x54);
  assert.equal(BATTLE_ACTION_RESOURCE_MAX_OFFSET, 0x5c);
  assert.equal(BATTLE_ACTION_RESOURCE_COST_OFFSET, 0x48);
});

test("the guard is `blt`, so paying down to exactly zero is allowed", () => {
  assert.equal(canAffordAction(10, 10), true);
  assert.equal(canAffordAction(10, 11), false);
  assert.equal(canAffordAction(0, 0), true);

  const exact = chargeActionResource({ current: 10, cost: 10 });
  assert.equal(exact.outcome, BATTLE_ACTION_RESOURCE_CHARGED);
  assert.equal(exact.current, 0);
  assert.equal(exact.charged, 10);
});

test("a refused action costs nothing, because the original returns before the subtract", () => {
  const refused = chargeActionResource({ current: 3, cost: 4 });
  assert.equal(refused.outcome, BATTLE_ACTION_RESOURCE_REFUSED);
  assert.equal(refused.current, 3);
  assert.equal(refused.charged, 0);
});

test("an ordinary charge subtracts the cost", () => {
  const charged = chargeActionResource({ current: 250, cost: 40 });
  assert.equal(charged.current, 210);
  assert.equal(charged.charged, 40);
});

test("a zero-cost action is charged, not refused", () => {
  const free = chargeActionResource({ current: 0, cost: 0 });
  assert.equal(free.outcome, BATTLE_ACTION_RESOURCE_CHARGED);
  assert.equal(free.current, 0);
});

test("the AI reserve is min(max * percent / 100, current) over the same two fields", () => {
  // profile 0 scalar 7 is 100%, so the current balance is what caps it.
  const capped = resolveAiReserve({
    profileIndex: 0,
    sessionScalarIndex: 7,
    metricBase: 500,
    metricLimit: 120
  });
  assert.equal(capped, 120);

  // profile 1 scalar 1 is 15% of the maximum, well under a full balance.
  const scaled = resolveAiReserve({
    profileIndex: 1,
    sessionScalarIndex: 1,
    metricBase: 500,
    metricLimit: 500
  });
  assert.equal(scaled, 75);

  // An action the AI declines can still be affordable: the reserve is a policy,
  // the charge guard is the hard rule.
  assert.equal(canAffordAction(500, 200), true);
  assert.ok(200 > scaled);
});

test("invalid input is rejected instead of coerced", () => {
  assert.throws(() => chargeActionResource(null), /requires \{ current, cost \}/);
  assert.throws(() => chargeActionResource({ current: 1.5, cost: 1 }), /current must be a safe integer/);
  assert.throws(() => chargeActionResource({ current: 10, cost: -1 }), /cost must be a u16/);
  assert.throws(() => chargeActionResource({ current: 10, cost: 70000 }), /cost must be a u16/);
});

test("same-frame readiness ties resolve by ascending slot index", async () => {
  const mod = await import("../src/championship/battle/battleActionSelection.js");
  // Nineteen loops bounded by 6 in OVL19, all counting upward; the per-frame
  // pass at 0x0210D6E4 is the one that decrements the cooldown.
  assert.equal(mod.BATTLE_AI_SLOT_SERVICE_ORDER, "ASCENDING_SLOT_INDEX");
  assert.equal(mod.BATTLE_AI_FRAME_PASS, "OVL19:0x0210D6E4");
});
