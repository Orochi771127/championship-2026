// Action application — OVL19 0x0211D71C, the script native that lands an attack.
//
// The four rejections are the whole point: they decide who an attack touches,
// and getting one backwards would change every multi-target move in the game.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_ACTION_APPLY_ARG_ACTION,
  BATTLE_ACTION_APPLY_ARG_KIND,
  BATTLE_ACTION_APPLY_ARG_PARAMETERS,
  BATTLE_ACTION_APPLY_ATTACKER_OFFSET,
  BATTLE_ACTION_APPLY_BODY,
  BATTLE_ACTION_APPLY_EVIDENCE,
  BATTLE_ACTION_APPLY_KIND_SHIFT,
  BATTLE_ACTION_APPLY_KIND_SPECIAL,
  BATTLE_ACTION_APPLY_NATIVE,
  BATTLE_ACTION_APPLY_OWN_PARAMETER_OFFSET,
  BATTLE_ACTION_APPLY_PARAMETER_OFFSET,
  BATTLE_ACTION_APPLY_PARAMETER_WORDS,
  BATTLE_ACTION_APPLY_REJECTIONS,
  BATTLE_ACTION_APPLY_REJECT_EMPTY,
  BATTLE_ACTION_APPLY_REJECT_GUARD,
  BATTLE_ACTION_APPLY_REJECT_SAME_SIDE,
  BATTLE_ACTION_APPLY_REJECT_SELF,
  BATTLE_ACTION_APPLY_RESOLVER,
  BATTLE_ACTION_APPLY_ROSTER_BASE_OFFSET,
  BATTLE_ACTION_APPLY_SIDE_BYPASS_STATUS,
  BATTLE_ACTION_APPLY_SLOT_COUNT,
  actionKindFromQ12,
  actionKindWritesField20,
  rejectActionTarget,
  resolveActionParameterSource,
  selectActionTargets
} from "../src/championship/battle/battleActionApplication.js";

import { BATTLE_FRAME_ROSTER_BASE_OFFSET, BATTLE_FRAME_SLOT_COUNT } from "../src/championship/battle/battleFrameLoop.js";
import { BATTLE_SCRIPT_DAMAGE_NATIVE } from "../src/championship/battle/battleStateGraph.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const foe = (extra = {}) => ({ field54: 1, field94: 0, field158: 0, ...extra });
const ally = (extra = {}) => ({ field54: 0, field94: 0, field158: 0, ...extra });

test("the native's shape is the immediates the ROM uses", () => {
  assert.equal(BATTLE_ACTION_APPLY_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_ACTION_APPLY_NATIVE, 0x0211d71c);
  assert.equal(BATTLE_ACTION_APPLY_BODY, 0x0211d740);
  assert.equal(BATTLE_ACTION_APPLY_SLOT_COUNT, 6);
  assert.equal(BATTLE_ACTION_APPLY_KIND_SHIFT, 12);
  assert.equal(BATTLE_ACTION_APPLY_KIND_SPECIAL, 13);
  assert.equal(BATTLE_ACTION_APPLY_SIDE_BYPASS_STATUS, 5);
  assert.equal(BATTLE_ACTION_APPLY_ATTACKER_OFFSET, 0xe4);
  assert.equal(BATTLE_ACTION_APPLY_RESOLVER, 0x021149a8);
  assert.equal(BATTLE_ACTION_APPLY_PARAMETER_WORDS, 3);
  assert.deepEqual(
    [BATTLE_ACTION_APPLY_ARG_ACTION, BATTLE_ACTION_APPLY_ARG_PARAMETERS, BATTLE_ACTION_APPLY_ARG_KIND],
    [0, 1, 2]
  );
});

test("it walks the same six-slot roster the frame loop does", () => {
  assert.equal(BATTLE_ACTION_APPLY_SLOT_COUNT, BATTLE_FRAME_SLOT_COUNT);
  assert.equal(BATTLE_ACTION_APPLY_ROSTER_BASE_OFFSET, BATTLE_FRAME_ROSTER_BASE_OFFSET);
  assert.equal(BATTLE_ACTION_APPLY_ROSTER_BASE_OFFSET, 0x5e20);
});

test("this is the native the state graph says damage hangs off", () => {
  assert.equal(BATTLE_ACTION_APPLY_NATIVE, BATTLE_SCRIPT_DAMAGE_NATIVE);
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-scripts.r1.json"), "utf8")
  );
  const entry = catalog.nativeTargets.find(
    (item) => Number.parseInt(item.address, 16) === BATTLE_ACTION_APPLY_NATIVE
  );
  assert.ok(entry, "the script blob calls it");
  assert.equal(entry.callSites, 1);
});

test("argument 2 is Q12 and the entry truncates it arithmetically", () => {
  assert.equal(actionKindFromQ12(13 * 0x1000), 13);
  assert.equal(actionKindFromQ12(0), 0);
  assert.equal(actionKindFromQ12(0x1000 - 1), 0, "a fraction below one truncates to zero");
  // `asr`, not `lsr`, so a negative floors rather than wrapping.
  assert.equal(actionKindFromQ12(-0x1000), -1);
  assert.equal(actionKindFromQ12(-1), -1);
  assert.throws(() => actionKindFromQ12(1.5), /KIND_Q12_MUST_BE_AN_INTEGER/);
});

test("the four rejections are the ones the ROM applies, in order", () => {
  assert.deepEqual(BATTLE_ACTION_APPLY_REJECTIONS.map((entry) => entry.reason), [
    BATTLE_ACTION_APPLY_REJECT_EMPTY,
    BATTLE_ACTION_APPLY_REJECT_SELF,
    BATTLE_ACTION_APPLY_REJECT_SAME_SIDE,
    BATTLE_ACTION_APPLY_REJECT_GUARD
  ]);
  for (const entry of BATTLE_ACTION_APPLY_REJECTIONS) {
    assert.match(entry.site, /^OVL19:0x0211D7[0-9A-F]{2}$/);
  }

  const attacker = ally();
  assert.equal(rejectActionTarget(attacker, null), BATTLE_ACTION_APPLY_REJECT_EMPTY);
  assert.equal(rejectActionTarget(attacker, undefined), BATTLE_ACTION_APPLY_REJECT_EMPTY);
  assert.equal(rejectActionTarget(attacker, attacker), BATTLE_ACTION_APPLY_REJECT_SELF);
  assert.equal(rejectActionTarget(attacker, ally()), BATTLE_ACTION_APPLY_REJECT_SAME_SIDE);
  assert.equal(rejectActionTarget(attacker, foe()), null);
});

test("status 5 skips the same-side rejection entirely", () => {
  const berserk = ally({ field158: BATTLE_ACTION_APPLY_SIDE_BYPASS_STATUS });
  // Its own side is now a legal target.
  assert.equal(rejectActionTarget(berserk, ally()), null);
  assert.equal(rejectActionTarget(berserk, foe()), null);
  // Every other status keeps the check.
  for (const field158 of [0, 1, 4, 6, 7, 13, 14]) {
    assert.equal(rejectActionTarget(ally({ field158 }), ally()), BATTLE_ACTION_APPLY_REJECT_SAME_SIDE,
      `status ${field158}`);
  }
  // Self is still rejected first, whatever the status.
  const self = ally({ field158: 5 });
  assert.equal(rejectActionTarget(self, self), BATTLE_ACTION_APPLY_REJECT_SELF);
});

test("the guard check only bites when the attacker has one", () => {
  // Attacker +0x94 zero: the target's value is never read.
  assert.equal(rejectActionTarget(ally({ field94: 0 }), foe({ field94: 0 })), null);
  assert.equal(rejectActionTarget(ally({ field94: 0 }), foe({ field94: 7 })), null);
  // Attacker +0x94 non-zero: the target must have one too.
  assert.equal(rejectActionTarget(ally({ field94: 1 }), foe({ field94: 0 })),
    BATTLE_ACTION_APPLY_REJECT_GUARD);
  assert.equal(rejectActionTarget(ally({ field94: 1 }), foe({ field94: 1 })), null);
  assert.equal(rejectActionTarget(ally({ field94: 9 }), foe({ field94: 3 })), null);
});

test("the walk returns the surviving slots and the count the routine returns", () => {
  const attacker = ally();
  const other = ally();
  const roster = [attacker, foe(), null, other, foe({ field94: 0 }), foe()];
  const result = selectActionTargets({ attacker, roster });
  assert.deepEqual(result.targets, [1, 4, 5]);
  assert.equal(result.hitCount, 3);
  assert.deepEqual(result.rejected, [
    { slot: 0, reason: BATTLE_ACTION_APPLY_REJECT_SELF },
    { slot: 2, reason: BATTLE_ACTION_APPLY_REJECT_EMPTY },
    { slot: 3, reason: BATTLE_ACTION_APPLY_REJECT_SAME_SIDE }
  ]);
  // Ascending, like every other six-bounded walk in the overlay.
  assert.deepEqual([...result.targets].sort((a, b) => a - b), [...result.targets]);

  // Nothing to hit is a legal outcome, and the routine returns zero.
  const alone = selectActionTargets({ attacker, roster: [attacker, null, null, null, null, null] });
  assert.deepEqual(alone.targets, []);
  assert.equal(alone.hitCount, 0);
});

test("the parameter block comes from the action or from argument 1", () => {
  const own = resolveActionParameterSource(0);
  assert.equal(own.source, "ACTION_OWN");
  assert.equal(own.site, "OVL19:0x0211D9E0");
  assert.equal(own.offset, BATTLE_ACTION_APPLY_OWN_PARAMETER_OFFSET);
  assert.equal(own.offset, 0x28, "0x020648F0 adds 4, then the routine adds 0x24");

  const supplied = resolveActionParameterSource(0x02100000);
  assert.equal(supplied.source, "SCRIPT_ARGUMENT");
  assert.equal(supplied.site, "OVL19:0x0211D9FC");
  assert.equal(supplied.offset, BATTLE_ACTION_APPLY_PARAMETER_OFFSET);
  assert.equal(supplied.offset, 0x24);

  for (const source of [own, supplied]) {
    assert.equal(source.words, 3, "three words are copied either way");
  }
  assert.throws(() => resolveActionParameterSource(1.5), /PARAMETER_ARGUMENT_MUST_BE_AN_INTEGER/);
});

test("kind 13 is the only one that skips the write to action +0x20", () => {
  assert.equal(actionKindWritesField20(BATTLE_ACTION_APPLY_KIND_SPECIAL), false);
  for (const kind of [0, 1, 5, 12, 14, 20, -1]) {
    assert.equal(actionKindWritesField20(kind), true, `kind ${kind}`);
  }
});

test("malformed input is refused rather than guessed at", () => {
  assert.throws(() => selectActionTargets(null), /WALK_REQUIRES_A_ROSTER_ARRAY/);
  assert.throws(() => selectActionTargets({ attacker: ally(), roster: [null] }), /ROSTER_MUST_BE_6_LONG/);
  assert.throws(() => selectActionTargets({ roster: new Array(6).fill(null) }), /WALK_REQUIRES_AN_ATTACKER/);
  assert.throws(() => rejectActionTarget(ally(), 5), /WALK_REQUIRES_COMBATANT_OBJECTS/);
  assert.throws(() => rejectActionTarget(ally({ field54: 1.5 }), foe()), /FIELD54_MUST_BE_AN_INTEGER/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleActionApplication.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
