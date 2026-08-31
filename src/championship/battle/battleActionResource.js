// Action resource -- OVL19 0x0211C144, the commit that charges an action.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1 (OVL19 ram 0x0210B300).
//
// THIS IS THE FIELD THE BRIEF CALLED "TP", AND IT IS REAL
// -------------------------------------------------------
// The Cursor handoff forbade inventing TP, correctly, because nothing had traced
// a spendable battle resource. One is now traced, so this is a translation and
// not an invention:
//
//   0x0211C23C  ldr  r0, [r7, #32]      action record
//   0x0211C240  ldr  r1, [r6, #16]      combatant stats
//   0x0211C244  ldrh r2, [r0, #0x48]    the action's cost
//   0x0211C248  ldr  r0, [r1, #0x54]    the combatant's current resource
//   0x0211C24C  cmp  r0, r2
//   0x0211C250  blt  -> return 0        refuse, and charge nothing
//   0x0211C25C  sub  r0, r0, r2
//   0x0211C260  str  r0, [r1, #0x54]    current -= cost
//
// The compare is signed and the refusal is `lt`, so paying down to exactly zero
// is allowed; only a cost strictly greater than the balance is refused. On
// refusal the routine returns 0 before the subtract, so a failed action costs
// nothing.
//
// The original never names this resource. It is called `actionResource` here,
// with the offsets in the names' documentation, rather than labelled TP as
// though the ROM said so.
//
// WHAT THIS RESOLVES ELSEWHERE
// ----------------------------
// battleActionSelection's reserve reads the same two fields, which now have
// meanings rather than offsets:
//   stats +0x5C is the MAXIMUM  (the AI scales a percentage off it)
//   stats +0x54 is the CURRENT  (the AI caps the reserve at what it holds)
// so the AI reserve is min(trunc(max * profilePercent / 100), current): never
// commit to an action costing more than a profile-scaled slice of full capacity,
// and never more than is actually held.
//
// Action +0x48 is read at exactly five sites in OVL19: this charge, the
// affordability scan 0x02114504, the two ladder gates 0x02115AA8 / 0x02115AFC,
// and 0x0210BDE8, which is unrelated (it masks a hardware register at
// 0x04001008). Only this site writes, so the resource is spent here and nowhere
// else in the overlay.
//
// NOT TRACED, THEREFORE NOT IMPLEMENTED
// -------------------------------------
// How the resource is restored between actions or between battles, its starting
// value, and whether anything outside OVL19 writes it. Nothing here regenerates
// it: a caller that needs regeneration must trace that first.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_ACTION_RESOURCE_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_ACTION_RESOURCE_CHARGE_SITE = "OVL19:0x0211C144";

/** Combatant stats offsets. Names describe the traced role, not a ROM label. */
export const BATTLE_ACTION_RESOURCE_CURRENT_OFFSET = 0x54;
export const BATTLE_ACTION_RESOURCE_MAX_OFFSET = 0x5c;

/** Action record offset holding the cost, read as a u16. */
export const BATTLE_ACTION_RESOURCE_COST_OFFSET = 0x48;

export const BATTLE_ACTION_RESOURCE_CHARGED = "CHARGED";
export const BATTLE_ACTION_RESOURCE_REFUSED = "REFUSED_INSUFFICIENT";

function resourceError(message) {
  const error = new Error(message);
  error.name = "ChampionshipBattleResourceError";
  return error;
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw resourceError(`${label} must be a safe integer`);
  return value;
}

function requireCost(value) {
  requireSafeInteger(value, "cost");
  if (value < 0 || value > 0xffff) {
    throw resourceError("cost must be a u16 (0..65535), matching ldrh at action+0x48");
  }
  return value;
}

/**
 * `cmp current, cost` then `blt` -- refuse only when the balance is strictly
 * smaller. Spending the balance to exactly zero is allowed.
 */
export function canAffordAction(current, cost) {
  requireSafeInteger(current, "current");
  return current >= requireCost(cost);
}

/**
 * The charge at 0x0211C244. Returns the new balance and the outcome; a refusal
 * leaves the balance untouched because the original returns before the subtract.
 *
 * @param {{ current: number, cost: number }} input
 */
export function chargeActionResource(input) {
  if (!input || typeof input !== "object") {
    throw resourceError("chargeActionResource requires { current, cost }");
  }
  const current = requireSafeInteger(input.current, "current");
  const cost = requireCost(input.cost);

  if (current < cost) {
    return deepFreeze({
      outcome: BATTLE_ACTION_RESOURCE_REFUSED,
      current,
      charged: 0,
      evidence: BATTLE_ACTION_RESOURCE_EVIDENCE
    });
  }
  return deepFreeze({
    outcome: BATTLE_ACTION_RESOURCE_CHARGED,
    current: current - cost,
    charged: cost,
    evidence: BATTLE_ACTION_RESOURCE_EVIDENCE
  });
}
