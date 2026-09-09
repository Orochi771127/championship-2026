// Damage inputs — which numbers on which object reach the resolver.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// battleDamageCore has had the formula since 2026-08-31 and was careful to say
// that its two arguments are curve steps, not Attack and Defense. It could not
// say more, because nothing had traced where the two indices are LOADED from.
// This does, and the answer is more interesting than a pair of stats: the
// attacker always uses one level, and the action chooses which of six levels the
// defender resists it with.
//
// THE ATTACKER  (OVL19 0x02114A50)
// --------------------------------
//   02114A50  ldr r0, [r6, #0xe4]      the action's owner
//   02114A54  ldr r2, [r0, #0x10]      its creature record
//   02114A58  ldr r1, [r0, #0x160]
//   02114A5C  ldr sl, [r2, #0x84]      the attacker's curve level
//   02114A60  cmp r1, #1
//   02114A64  ldrne r1, [r0, #0x158]   otherwise the status code
//   02114A6C  cmpne r1, #1
//   02114A70  addeq sl, sl, #1         either being 1 raises it a step
//   02114A74  cmp sl, #0x1a
//   02114A7C  movgt r5, #0x1a          clamped high only, at 26
//
// +0xE4 is the owner field battleInFlight already reads, so the attacker of a
// damage resolution is the same object that owns the in-flight action.
//
// THE DEFENDER  (OVL19 0x02114A8C)
// --------------------------------
//   02114A8C  cmp r2, #5
//   02114A90  addls pc, pc, r2, lsl #2
//
// r2 is the action record's +0x58. Six destinations, each loading a DIFFERENT
// level off the defender's creature and each raised by its own buff code:
//
//   selector  level     buff code that adds one
//      0      +0x88            2
//      1      +0x94            5
//      2      +0x98            6
//      3      +0x9C            8
//      4      +0xA0            9
//      5      +0xA4            7
//   above 5   +0x88            2      (the `addls` does not fire)
//
// So an action names which of the defender's five resistances applies, with a
// sixth shared with the default. Those offsets are exactly the level fields
// battleCreatureBuild writes from preset +0x1C..+0x38, which is what makes an
// opponent built from the ROM able to resist correctly.
//
// THE CURVE IS THE ONE ALREADY CATALOGUED
// ---------------------------------------
// Every branch reads a base inside the 27-row stride-16 table at 0x020CA008 --
// 0x020CA00C, 0x020CA00E and 0x020CA014 are three of its identical columns, and
// battleCreatureBuild proved they are byte-identical. battleDamageCore's
// BATTLE_STAT_CURVE is that column: 10, 14, 18 … 350.
//
// THE TARGET MUST BE STANDING  (OVL19 0x021149BC)
// -----------------------------------------------
//   021149B4  ldr r4, [r7, #0x10]      the target's creature record
//   021149BC  ldr r5, [r4, #0x50]      its current HP
//   021149C4  cmp r5, #0
//   021149D8  pople                    <= 0 returns zero damage
//
// The resolver's own guard, and a second one after the contact walk's.
//
// WHICH MOVES REACH THIS AT ALL  (OVL19 0x021149DC)
// -------------------------------------------------
//   021149DC  ldr r3, [r6, #0x20]      the action's move record
//   021149E0  ldr r1, [r3, #0x50]      its kind
//   021149E4  cmp r1, #3
//   021149E8  addls pc, pc, r1, lsl #2
//
// pc reads as 0x021149F0, so the four destinations are kind 0 and kind 1 to the
// curve-and-power path at 0x02114A00, kind 2 to 0x02115504, and kind 3 straight
// out. Anything above 3 misses the `addls` and leaves as well.
//
// That is the opposite of what this lane assumed while the formula sat unused.
// The 596-record table divides as 205 moves of kind 0 (powers 0, 100, 300), 361
// of kind 1 (27 distinct powers from 30 to 600), 27 of kind 2 (0 or 15) and 3 of
// kind 3 (0). The moves with real power are kinds 0 and 1, and they are the ones
// that arrive here.
//
// AND WHERE THEY ARRIVE FROM
// --------------------------
// The resolver has three callers: 0x0211C92C, which is the contact walk, and
// 0x0211D9E0 and 0x0211D9FC, which are both inside the 2,124-byte script native
// at 0x0211D71C. The contact walk only runs for kinds 2 and 3 (`sub #2 / cmp #1
// / bhi` at 0x0211C770), the very kinds this switch sends elsewhere. So the
// damage the 566 real attack moves do is resolved by that NATIVE, called from a
// move script running on the VM -- not by the contact walk.
//
// An earlier note in this lane called the native presentation plumbing because
// every store in it lands in the handle arrays. That was true and incomplete:
// it also calls the resolver twice.
//
// That the record at action +0x20 really is a move-table record is not assumed.
// 0x0211C188 compares its +0x28 against the literal 0x02120D8A, and 262 of the
// 596 records carry exactly that pointer.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What any of the six levels MEANS. The read sites are traced and the roles in
// the formula are traced, so they are named for their role -- attacker level,
// defender level, element selector -- and never as Attack, Defense, Fire or
// Water. What +0x160 and +0x158 are beyond the one value each that raises a
// step. And the branches of the resolver's own outer switch on the action's
// +0x50, of which this covers the damage path only.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { BATTLE_STAT_CURVE_MAX_INDEX } from "./battleDamageCore.js";

export const BATTLE_DAMAGE_INPUTS_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_DAMAGE_ATTACKER_SITE = "OVL19:0x02114A50";
export const BATTLE_DAMAGE_DEFENDER_SITE = "OVL19:0x02114A8C";
export const BATTLE_DAMAGE_TARGET_GUARD_SITE = "OVL19:0x021149BC";

/** On a combatant: the creature record every stat is read through. */
export const BATTLE_DAMAGE_CREATURE_OFFSET = 0x10;
/** On the action: its owner, the same field battleInFlight reads. */
export const BATTLE_DAMAGE_OWNER_OFFSET = 0xe4;
/** On the creature: current HP, the resolver's first guard. */
export const BATTLE_DAMAGE_HP_OFFSET = 0x50;
/** On the action record: the u16 power battleDamageCore multiplies by. */
export const BATTLE_DAMAGE_POWER_OFFSET = 0x4a;
/** On the action record: which defender level resists it. */
export const BATTLE_DAMAGE_ELEMENT_OFFSET = 0x58;

/** The attacker's curve level, and the two fields that can raise it. */
export const BATTLE_DAMAGE_ATTACKER_LEVEL_OFFSET = 0x84;
export const BATTLE_DAMAGE_ATTACKER_BUFF_OFFSET = 0x160;
export const BATTLE_DAMAGE_ATTACKER_STATUS_OFFSET = 0x158;
/** `cmp #1` on both — one specific value, not "any buff". */
export const BATTLE_DAMAGE_ATTACKER_RAISE_VALUE = 1;

/** `cmp #0x1A / movgt` — clamped high only, and never clamped low. */
export const BATTLE_DAMAGE_CURVE_MAX_INDEX = BATTLE_STAT_CURVE_MAX_INDEX;

/**
 * The jump table at 0x02114A90. `selector` is the action record's +0x58; every
 * value above 5 takes the same path as 0.
 */
export const BATTLE_DAMAGE_DEFENDER_TABLE = deepFreeze([
  { selector: 0, levelOffset: 0x88, buffCode: 2, site: "OVL19:0x02114B8C" },
  { selector: 1, levelOffset: 0x94, buffCode: 5, site: "OVL19:0x02114AB0" },
  { selector: 2, levelOffset: 0x98, buffCode: 6, site: "OVL19:0x02114ADC" },
  { selector: 3, levelOffset: 0x9c, buffCode: 8, site: "OVL19:0x02114B08" },
  { selector: 4, levelOffset: 0xa0, buffCode: 9, site: "OVL19:0x02114B34" },
  { selector: 5, levelOffset: 0xa4, buffCode: 7, site: "OVL19:0x02114B60" }
]);

/**
 * The resolver's outer switch on the move record's +0x50, from the jump table at
 * 0x021149E8. Only DAMAGE kinds reach the curve-and-power term.
 */
export const BATTLE_DAMAGE_KIND_ROUTES = deepFreeze([
  { kind: 0, route: "DAMAGE", site: "OVL19:0x02114A00" },
  { kind: 1, route: "DAMAGE", site: "OVL19:0x02114A00" },
  { kind: 2, route: "OTHER_HANDLER", site: "OVL19:0x02115504" },
  { kind: 3, route: "RETURNS", site: null }
]);

/** Every caller of the resolver. The contact walk is the smallest of the three. */
export const BATTLE_DAMAGE_RESOLVER_CALLERS = deepFreeze([
  { site: "OVL19:0x0211C92C", from: "CONTACT_WALK", kinds: [2, 3] },
  { site: "OVL19:0x0211D9E0", from: "SCRIPT_NATIVE_0x0211D71C", kinds: [0, 1] },
  { site: "OVL19:0x0211D9FC", from: "SCRIPT_NATIVE_0x0211D71C", kinds: [0, 1] }
]);

/** Which route a move record's kind takes. Above 3 leaves like kind 3. */
export function damageRouteForKind(kind) {
  const value = requireInteger(kind, "KIND");
  return BATTLE_DAMAGE_KIND_ROUTES[value] ?? BATTLE_DAMAGE_KIND_ROUTES[3];
}

/** On the defender combatant: the field each branch compares its buff code to. */
export const BATTLE_DAMAGE_DEFENDER_BUFF_OFFSET = 0x160;

function inputsError(message) {
  return new Error(`BATTLE_DAMAGE_INPUTS_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw inputsError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** `cmp #0x1A / movle / movgt` — the high clamp, with no low clamp at all. */
export function clampCurveLevel(level) {
  const value = requireInteger(level, "LEVEL");
  return value > BATTLE_DAMAGE_CURVE_MAX_INDEX ? BATTLE_DAMAGE_CURVE_MAX_INDEX : value;
}

/** Which defender branch a selector reaches. Above 5 is the default. */
export function defenderBranchFor(selector) {
  const value = requireInteger(selector, "SELECTOR");
  return BATTLE_DAMAGE_DEFENDER_TABLE[value] ?? BATTLE_DAMAGE_DEFENDER_TABLE[0];
}

/**
 * OVL19 0x02114A50. `attacker` is the combatant that owns the action; its
 * `levels` are the creature's, keyed by offset.
 */
export function attackerCurveLevel(attacker) {
  return clampCurveLevel(attackerUnclampedLevel(attacker));
}

// sl survives the damage-curve clamp and is reused by the status threshold.
function attackerUnclampedLevel(attacker) {
  if (!attacker || typeof attacker !== "object") {
    throw inputsError("ATTACKER_REQUIRED");
  }
  const base = requireInteger(attacker.attackerLevel ?? 0, "ATTACKER_LEVEL");
  // `cmp r1,#1 / ldrne / cmpne r1,#1 / addeq` — either field being exactly 1.
  const raised = (attacker.buffCode ?? 0) === BATTLE_DAMAGE_ATTACKER_RAISE_VALUE
    || (attacker.statusCode ?? 0) === BATTLE_DAMAGE_ATTACKER_RAISE_VALUE;
  return base + (raised ? 1 : 0);
}

/**
 * OVL19 0x02114A8C. `defender` carries a `levels` map keyed by creature offset;
 * `selector` is the action's element and `buffCode` the defender's +0x160.
 */
export function defenderCurveLevel(defender, selector) {
  if (!defender || typeof defender !== "object") {
    throw inputsError("DEFENDER_REQUIRED");
  }
  const branch = defenderBranchFor(selector);
  const levels = defender.levels;
  if (!levels || typeof levels !== "object") {
    throw inputsError("DEFENDER_NEEDS_LEVELS");
  }
  const base = requireInteger(levels[branch.levelOffset] ?? 0, "DEFENDER_LEVEL");
  // Each branch compares the defender's +0x160 to its OWN code, so a buff only
  // raises the resistance it belongs to.
  const raised = (defender.buffCode ?? 0) === branch.buffCode;
  return deepFreeze({
    level: clampCurveLevel(base + (raised ? 1 : 0)),
    unclampedLevel: base + (raised ? 1 : 0),
    branch: deepFreeze({ ...branch })
  });
}

/**
 * Everything resolveBattleDamage needs, read off an attacker, a defender and an
 * action, in the ROM's own order. Returns null when the target is already down,
 * because that is what the resolver's first guard does.
 */
export function damageInputsFor(input) {
  if (!input || typeof input !== "object") {
    throw inputsError("REQUIRES_AN_OBJECT");
  }
  const { attacker, defender, action } = input;
  if (!action || typeof action !== "object") {
    throw inputsError("ACTION_REQUIRED");
  }
  if (!defender || typeof defender !== "object") {
    throw inputsError("DEFENDER_REQUIRED");
  }
  // 0x021149C4: a target at or below zero HP takes nothing, before anything
  // else is read.
  if (requireInteger(defender.currentHp ?? 0, "CURRENT_HP") <= 0) {
    return null;
  }
  const selector = requireInteger(action.elementSelector ?? 0, "ELEMENT_SELECTOR");
  const resisted = defenderCurveLevel(defender, selector);
  return deepFreeze({
    attackerIndex: attackerCurveLevel(attacker),
    defenderIndex: resisted.level,
    statusAttackerIndex: attackerUnclampedLevel(attacker),
    statusDefenderIndex: resisted.unclampedLevel,
    power: requireInteger(action.power ?? 0, "POWER"),
    elementSelector: selector,
    defenderBranch: resisted.branch
  });
}
