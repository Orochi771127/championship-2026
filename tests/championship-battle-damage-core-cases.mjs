// Battle damage core — OVL19 resolver 0x021149A8, curve + power /100 only.
//
// This suite is the original arithmetic, not a battle screen. Hit/miss, TP,
// crit, field matrix and variance stay out until they have their own traces.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ACTION_POWER_FIELD_OFFSET,
  BATTLE_DAMAGE_CORE_EVIDENCE,
  BATTLE_DAMAGE_CORE_RESOLVER,
  BATTLE_STAT_CURVE,
  BATTLE_STAT_CURVE_MAX_INDEX,
  resolveBattleDamageCore
} from "../src/championship/battle/battleDamageCore.js";

const ROM_CURVE = Object.freeze([
  10, 14, 18, 22, 26, 30, 38, 46, 54, 66, 78, 90, 102, 117, 132,
  147, 162, 180, 198, 216, 234, 252, 270, 290, 310, 330, 350
]);

function coreTerm(attackerIndex, defenderIndex) {
  const attackCurve = ROM_CURVE[Math.min(attackerIndex, 26)];
  const defenseCurve = ROM_CURVE[Math.min(defenderIndex, 26)];
  return Math.trunc((5 * attackCurve) / 2) - defenseCurve;
}

test("the 27-entry curve is the ARM9 table at 0x020CA00C", () => {
  assert.equal(BATTLE_STAT_CURVE.length, 27);
  assert.equal(BATTLE_STAT_CURVE_MAX_INDEX, 26);
  assert.deepEqual([...BATTLE_STAT_CURVE], [...ROM_CURVE]);
  assert.equal(BATTLE_DAMAGE_CORE_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_DAMAGE_CORE_RESOLVER, "OVL19:0x021149A8");
  assert.equal(ACTION_POWER_FIELD_OFFSET, 0x4a);
});

test("equal mid indices and power 100 yield trunc((5A/2) - A)", () => {
  const resolved = resolveBattleDamageCore({
    attackerIndex: 5,
    defenderIndex: 5,
    power: 100
  });
  assert.equal(resolved.attackCurve, 30);
  assert.equal(resolved.defenseCurve, 30);
  assert.equal(resolved.coreTerm, 45);
  assert.equal(resolved.damageCore, 45);
  assert.equal(resolved.evidence, BATTLE_DAMAGE_CORE_EVIDENCE);
});

test("an odd curve value truncates (5A)/2 toward zero", () => {
  // Index 13 is 117. 5*117 = 585; ARM asr after sign-adjust gives 292, not 293.
  const resolved = resolveBattleDamageCore({
    attackerIndex: 13,
    defenderIndex: 0,
    power: 100
  });
  assert.equal(resolved.attackCurve, 117);
  assert.equal(resolved.defenseCurve, 10);
  assert.equal(resolved.coreTerm, 282);
  assert.equal(resolved.damageCore, 282);
});

test("a larger defender index can make a negative core", () => {
  const resolved = resolveBattleDamageCore({
    attackerIndex: 0,
    defenderIndex: 26,
    power: 100
  });
  assert.equal(resolved.coreTerm, -325);
  assert.equal(resolved.damageCore, -325);
});

test("the /100 step truncates toward zero and drops the remainder", () => {
  const term = coreTerm(12, 12);
  assert.equal(term, 153);
  const resolved = resolveBattleDamageCore({
    attackerIndex: 12,
    defenderIndex: 12,
    power: 99
  });
  assert.equal(resolved.coreTerm, 153);
  assert.equal(resolved.damageCore, 151);
  assert.equal(
    resolveBattleDamageCore({ attackerIndex: 5, defenderIndex: 5, power: 1 }).damageCore,
    0
  );
});

test("an index above 26 clamps to 26 like the original GT #26 move", () => {
  const clamped = resolveBattleDamageCore({
    attackerIndex: 27,
    defenderIndex: 40,
    power: 100
  });
  const atMax = resolveBattleDamageCore({
    attackerIndex: 26,
    defenderIndex: 26,
    power: 100
  });
  assert.equal(clamped.attackerIndex, 26);
  assert.equal(clamped.defenderIndex, 26);
  assert.equal(clamped.damageCore, atMax.damageCore);
  assert.equal(clamped.damageCore, 525);
});

test("a negative index is rejected instead of inventing a 0-clamp the ARM does not do", () => {
  assert.throws(
    () => resolveBattleDamageCore({ attackerIndex: -1, defenderIndex: 0, power: 100 }),
    { name: "ChampionshipBattleDamageError" }
  );
  assert.throws(
    () => resolveBattleDamageCore({ attackerIndex: 0, defenderIndex: -1, power: 100 }),
    { name: "ChampionshipBattleDamageError" }
  );
});

test("power is the original u16 at action +0x4A", () => {
  assert.equal(
    resolveBattleDamageCore({ attackerIndex: 26, defenderIndex: 0, power: 600 }).damageCore,
    5190
  );
  assert.throws(
    () => resolveBattleDamageCore({ attackerIndex: 5, defenderIndex: 5, power: 65536 }),
    { name: "ChampionshipBattleDamageError" }
  );
  assert.throws(
    () => resolveBattleDamageCore({ attackerIndex: 5, defenderIndex: 5, power: -1 }),
    { name: "ChampionshipBattleDamageError" }
  );
});

test("the core function does not take hit, TP, crit or field modifiers", () => {
  const source = fs.readFileSync(
    path.join("src", "championship", "battle", "battleDamageCore.js"),
    "utf8"
  );
  assert.equal(source.includes("hitChance"), false);
  assert.equal(source.includes("critical"), false);
  assert.equal(source.includes("fieldMatrix"), false);
  const keys = Object.keys(
    resolveBattleDamageCore({ attackerIndex: 5, defenderIndex: 5, power: 100 })
  ).sort();
  assert.deepEqual(keys, [
    "attackCurve",
    "attackerIndex",
    "coreTerm",
    "damageCore",
    "defenderIndex",
    "defenseCurve",
    "evidence",
    "power"
  ]);
});

test("damage core is not wired into the standalone app or screens", () => {
  const appTree = "src/championship/app";
  const offenders = fs.readdirSync(appTree)
    .filter((name) => name.endsWith(".js"))
    .filter((name) => fs.readFileSync(path.join(appTree, name), "utf8").includes("battleDamageCore"));
  assert.deepEqual(offenders, []);
});
