import assert from "node:assert/strict";
import test from "node:test";

import {
  TAMER_INFO_FIELDS,
  TAMER_INFO_FIELD_EVIDENCE,
  TAMER_INFO_MONEY_CAP,
  TAMER_INFO_SCENES,
  TAMER_INFO_UNSOURCED_EVIDENCE,
  TAMER_INFO_UNSOURCED_FIELDS
} from "../src/championship/app/tamerInfoScreen.js";
import { BATTLE_REWARD_WALLET_CAP } from "../src/championship/battle/battleRewardTransaction.js";

test("the fields are the two scenes' node rows, in scene order", () => {
  // An earlier version of this list had 8 entries because the scene dump had been
  // truncated. The sub scene carries 23 nodes and five more real fields.
  assert.equal(TAMER_INFO_FIELDS.length, 12);
  assert.deepEqual(
    TAMER_INFO_FIELDS.map((field) => field.id),
    ["title", "guid", "map", "battle", "win",
     "name", "rank", "money", "time", "license", "have", "cage"]
  );
  assert.equal(TAMER_INFO_FIELDS.filter((field) => field.scene === "main").length, 5);
  assert.equal(TAMER_INFO_FIELDS.filter((field) => field.scene === "sub").length, 7);
  assert.deepEqual(TAMER_INFO_SCENES, [
    "tamer_info/tamer_info_main_scene.nxr",
    "tamer_info/tamer_info_sub_scene.nxr"
  ]);
  assert.equal(TAMER_INFO_FIELD_EVIDENCE, "ROM_VERIFIED");
});

test("digit widths are the node counts the scenes fix", () => {
  const widths = Object.fromEntries(
    TAMER_INFO_FIELDS.filter((field) => field.digits).map((field) => [field.id, field.digits])
  );
  assert.deepEqual(widths, {
    title: 3, guid: 3, map: 3, battle: 4, win: 3, money: 7, time: 3, have: 3, cage: 2
  });
  // name, rank and licence are not digit cells and must not claim a width.
  for (const id of ["name", "rank", "license"]) {
    const field = TAMER_INFO_FIELDS.find((entry) => entry.id === id);
    assert.equal(field.digits, undefined, `${id} must not claim a digit count`);
    assert.ok(["text", "region"].includes(field.kind));
  }
  // Only the play-time row is split by a separator node, into 3 then 2.
  const time = TAMER_INFO_FIELDS.find((field) => field.id === "time");
  assert.equal(time.minorDigits, 2);
  for (const field of TAMER_INFO_FIELDS) {
    if (field.id === "time") continue;
    assert.equal(field.minorDigits, undefined, `${field.id} must not be split`);
  }
});

test("each row keeps the y position the scene gives it, and they ascend per scene", () => {
  const main = TAMER_INFO_FIELDS.filter((field) => field.scene === "main").map((field) => field.y);
  const sub = TAMER_INFO_FIELDS.filter((field) => field.scene === "sub").map((field) => field.y);
  assert.deepEqual(main, [22, 44, 66, 109, 131]);
  // have and cage share the y=154 row, at x=86..104 and x=206/215.
  assert.deepEqual(sub, [38, 51, 72, 113, 119, 154, 154]);
});

test("the 7-digit money width agrees with the battle reward wallet cap", () => {
  // Two independent ROM witnesses for the same width: the sub scene lays out
  // money0..money6, and the reward path clamps the wallet at 9999999.
  const money = TAMER_INFO_FIELDS.find((field) => field.id === "money");
  assert.equal(money.digits, 7);
  assert.equal(TAMER_INFO_MONEY_CAP, 9999999);
  assert.equal(TAMER_INFO_MONEY_CAP, BATTLE_REWARD_WALLET_CAP);
  assert.equal(String(TAMER_INFO_MONEY_CAP).length, money.digits);
});

test("only the fields with a real source claim one", () => {
  const sourced = TAMER_INFO_FIELDS.filter((field) => field.source !== null);
  assert.deepEqual(sourced.map((field) => field.id), ["rank", "money", "have"]);
  assert.deepEqual(sourced.map((field) => field.source), ["tamerRank", "shopWalletBits", "rosterCount"]);
  assert.deepEqual(
    [...TAMER_INFO_UNSOURCED_FIELDS],
    ["title", "guid", "map", "battle", "win", "name", "time", "license", "cage"]
  );
  assert.equal(TAMER_INFO_UNSOURCED_EVIDENCE, "UNKNOWN_REQUIRES_TRACE");
  assert.equal(TAMER_INFO_UNSOURCED_FIELDS.length + sourced.length, TAMER_INFO_FIELDS.length);
});

test("the field table is frozen, so a caller cannot quietly add a source", () => {
  assert.throws(() => { TAMER_INFO_FIELDS.push({ id: "invented" }); });
  assert.throws(() => { TAMER_INFO_FIELDS[0].source = "madeUp"; }, undefined,
    "an untraced field must not become sourced by assignment");
  assert.equal(TAMER_INFO_FIELDS[0].source, null);
});
