// Damage inputs — which numbers on which object reach the resolver.
//
// battleDamageCore has had the formula for days and refused to name its two
// arguments Attack and Defense, because nothing had traced where they are
// loaded from. These cases pin the answer: one attacker level, and six defender
// levels the action chooses between.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_DAMAGE_ATTACKER_BUFF_OFFSET,
  BATTLE_DAMAGE_ATTACKER_LEVEL_OFFSET,
  BATTLE_DAMAGE_ATTACKER_RAISE_VALUE,
  BATTLE_DAMAGE_ATTACKER_SITE,
  BATTLE_DAMAGE_ATTACKER_STATUS_OFFSET,
  BATTLE_DAMAGE_CREATURE_OFFSET,
  BATTLE_DAMAGE_CURVE_MAX_INDEX,
  BATTLE_DAMAGE_DEFENDER_TABLE,
  BATTLE_DAMAGE_ELEMENT_OFFSET,
  BATTLE_DAMAGE_HP_OFFSET,
  BATTLE_DAMAGE_INPUTS_EVIDENCE,
  BATTLE_DAMAGE_OWNER_OFFSET,
  BATTLE_DAMAGE_POWER_OFFSET,
  attackerCurveLevel,
  clampCurveLevel,
  damageInputsFor,
  defenderBranchFor,
  defenderCurveLevel
} from "../src/championship/battle/battleDamageInputs.js";

import { BATTLE_STAT_CURVE, BATTLE_STAT_CURVE_MAX_INDEX, resolveBattleDamageCore } from "../src/championship/battle/battleDamageCore.js";
import { BATTLE_CREATURE_CURVE, BATTLE_CREATURE_STAT_MAP } from "../src/championship/battle/battleCreatureBuild.js";
import { BATTLE_INFLIGHT_OWNER_OFFSET } from "../src/championship/battle/battleInFlight.js";
import { BATTLE_OUTCOME_HP_OFFSET } from "../src/championship/battle/battleOutcome.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the damage curve is a column of the creature curve, proven not assumed", () => {
  assert.equal(BATTLE_DAMAGE_INPUTS_EVIDENCE, "VERIFIED_BINARY");
  // battleDamageCore dumped 0x020CA00C on 2026-08-31; battleCreatureBuild
  // catalogued the whole table at 0x020CA008 today. They are the same rows.
  assert.equal(BATTLE_STAT_CURVE.length, BATTLE_CREATURE_CURVE.length);
  assert.deepEqual([...BATTLE_STAT_CURVE], BATTLE_CREATURE_CURVE.map((row) => row[1]));
  assert.deepEqual([...BATTLE_STAT_CURVE], BATTLE_CREATURE_CURVE.map((row) => row[2]));
  assert.equal(BATTLE_DAMAGE_CURVE_MAX_INDEX, BATTLE_STAT_CURVE_MAX_INDEX);
  assert.equal(BATTLE_DAMAGE_CURVE_MAX_INDEX, 26);
});

test("the offsets are the ones the rest of the lane already reads", () => {
  assert.equal(BATTLE_DAMAGE_OWNER_OFFSET, BATTLE_INFLIGHT_OWNER_OFFSET,
    "the attacker is the in-flight object's owner");
  assert.equal(BATTLE_DAMAGE_HP_OFFSET, BATTLE_OUTCOME_HP_OFFSET,
    "and the guard reads the HP the judge counts");
  assert.equal(BATTLE_DAMAGE_CREATURE_OFFSET, 0x10);
  assert.equal(BATTLE_DAMAGE_POWER_OFFSET, 0x4a);
  assert.equal(BATTLE_DAMAGE_ELEMENT_OFFSET, 0x58);
  assert.equal(BATTLE_DAMAGE_ATTACKER_SITE, "OVL19:0x02114A50");
});

test("every level the resolver reads is one the creature builder writes", () => {
  const written = new Set(BATTLE_CREATURE_STAT_MAP.map((entry) => entry.level).filter((offset) => offset !== null));
  assert.equal(written.has(BATTLE_DAMAGE_ATTACKER_LEVEL_OFFSET), true, "the attacker's +0x84");
  for (const branch of BATTLE_DAMAGE_DEFENDER_TABLE) {
    assert.equal(written.has(branch.levelOffset), true, `defender +0x${branch.levelOffset.toString(16)}`);
  }
  // Which is what makes an opponent built out of the ROM able to resist at all.
  assert.equal(BATTLE_DAMAGE_DEFENDER_TABLE.length, 6);
});

test("the selector picks one of six defender levels and anything above five is the default", () => {
  assert.deepEqual(BATTLE_DAMAGE_DEFENDER_TABLE.map((entry) => entry.levelOffset),
    [0x88, 0x94, 0x98, 0x9c, 0xa0, 0xa4]);
  assert.deepEqual(BATTLE_DAMAGE_DEFENDER_TABLE.map((entry) => entry.buffCode), [2, 5, 6, 8, 9, 7]);

  for (let selector = 0; selector <= 5; selector += 1) {
    assert.equal(defenderBranchFor(selector).selector, selector);
  }
  // `addls pc, pc, r2, lsl #2` does not fire above five, and the fallthrough is
  // the same branch selector 0 takes.
  assert.equal(defenderBranchFor(6).levelOffset, 0x88);
  assert.equal(defenderBranchFor(99).levelOffset, 0x88);
  assert.deepEqual({ ...defenderBranchFor(6) }, { ...defenderBranchFor(0) });
});

test("a buff raises exactly one step, and only the resistance it belongs to", () => {
  assert.equal(BATTLE_DAMAGE_ATTACKER_RAISE_VALUE, 1);
  assert.equal(BATTLE_DAMAGE_ATTACKER_BUFF_OFFSET, 0x160);
  assert.equal(BATTLE_DAMAGE_ATTACKER_STATUS_OFFSET, 0x158);

  assert.equal(attackerCurveLevel({ attackerLevel: 6 }), 6);
  assert.equal(attackerCurveLevel({ attackerLevel: 6, buffCode: 1 }), 7);
  assert.equal(attackerCurveLevel({ attackerLevel: 6, statusCode: 1 }), 7);
  assert.equal(attackerCurveLevel({ attackerLevel: 6, buffCode: 1, statusCode: 1 }), 7, "one step, not two");
  assert.equal(attackerCurveLevel({ attackerLevel: 6, buffCode: 2 }), 6, "any other value does nothing");

  const levels = { 0x88: 4, 0x94: 5, 0x98: 6, 0x9c: 7, 0xa0: 8, 0xa4: 9 };
  // Selector 1 uses +0x94 and is raised only by buff code 5.
  assert.equal(defenderCurveLevel({ levels, buffCode: 5 }, 1).level, 6);
  assert.equal(defenderCurveLevel({ levels, buffCode: 6 }, 1).level, 5, "code 6 belongs to selector 2");
  assert.equal(defenderCurveLevel({ levels, buffCode: 6 }, 2).level, 7);
  assert.equal(defenderCurveLevel({ levels }, 5).level, 9);
});

test("the clamp is high only, exactly as the ROM's is", () => {
  assert.equal(clampCurveLevel(0), 0);
  assert.equal(clampCurveLevel(26), 26);
  assert.equal(clampCurveLevel(27), 26);
  assert.equal(clampCurveLevel(9999), 26);
  // `movle / movgt` never raises a low value, so a negative one stays negative
  // and the core is the module that refuses it.
  assert.equal(clampCurveLevel(-1), -1);
  assert.throws(() => resolveBattleDamageCore({ attackerIndex: -1, defenderIndex: 0, power: 10 }), /must be >= 0/);
});

test("a target already down takes nothing, before any level is read", () => {
  const attacker = { attackerLevel: 10 };
  const levels = { 0x88: 4 };
  assert.equal(damageInputsFor({ attacker, defender: { currentHp: 0, levels }, action: { power: 50 } }), null);
  assert.equal(damageInputsFor({ attacker, defender: { currentHp: -1, levels }, action: { power: 50 } }), null);
  const live = damageInputsFor({ attacker, defender: { currentHp: 1, levels }, action: { power: 50 } });
  assert.equal(live.attackerIndex, 10);
  assert.equal(live.defenderIndex, 4);
  assert.equal(live.power, 50);
});

test("the inputs feed the core the lane already had, end to end", () => {
  const inputs = damageInputsFor({
    attacker: { attackerLevel: 12 },
    defender: { currentHp: 500, levels: { 0x94: 6 } },
    action: { power: 60, elementSelector: 1 }
  });
  assert.equal(inputs.defenderBranch.levelOffset, 0x94);

  const core = resolveBattleDamageCore(inputs);
  // trunc(5 * curve[12] / 2) - curve[6], all times power over 100.
  const expectedTerm = Math.trunc((5 * BATTLE_STAT_CURVE[12]) / 2) - BATTLE_STAT_CURVE[6];
  assert.equal(core.coreTerm, expectedTerm);
  assert.equal(core.damageCore, Math.trunc((expectedTerm * 60) / 100));
  assert.ok(core.damageCore > 0, "a real match-up does real damage");
});

test("the module names roles, never RPG stats", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleDamageInputs.js"), "utf8");
  const code = module.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["attackStat", "defenseStat", "defence", "fire", "water", "earth", "wind"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(code.replace(/const defence =[^\n]*\n/g, "")), false, forbidden);
  }
  assert.match(module, /never as Attack, Defense, Fire or/);
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("only kinds 0 and 1 reach the curve-and-power term", async () => {
  const {
    BATTLE_DAMAGE_KIND_ROUTES,
    BATTLE_DAMAGE_RESOLVER_CALLERS,
    damageRouteForKind
  } = await import("../src/championship/battle/battleDamageInputs.js");
  const { BATTLE_CONTACT_ACTION_KINDS, BATTLE_DAMAGE_RESOLVER_CALL_SITES, isContactActionKind } =
    await import("../src/championship/battle/battleContactTargeting.js");

  assert.deepEqual(BATTLE_DAMAGE_KIND_ROUTES.map((entry) => entry.route),
    ["DAMAGE", "DAMAGE", "OTHER_HANDLER", "RETURNS"]);
  assert.equal(damageRouteForKind(0).route, "DAMAGE");
  assert.equal(damageRouteForKind(1).route, "DAMAGE");
  assert.equal(damageRouteForKind(2).route, "OTHER_HANDLER");
  assert.equal(damageRouteForKind(9).route, "RETURNS", "above three leaves like kind three");

  // The contact walk runs for exactly the kinds the resolver sends elsewhere,
  // so the walk is not where an ordinary attack is resolved.
  assert.deepEqual([...BATTLE_CONTACT_ACTION_KINDS], [2, 3]);
  for (const kind of BATTLE_CONTACT_ACTION_KINDS) {
    assert.equal(isContactActionKind(kind), true);
    assert.notEqual(damageRouteForKind(kind).route, "DAMAGE");
  }
  // And every caller is accounted for, with the walk the minority of three.
  assert.deepEqual(BATTLE_DAMAGE_RESOLVER_CALLERS.map((entry) => entry.site),
    [...BATTLE_DAMAGE_RESOLVER_CALL_SITES]);
  assert.equal(BATTLE_DAMAGE_RESOLVER_CALLERS.filter((entry) => entry.from === "CONTACT_WALK").length, 1);
  assert.equal(BATTLE_DAMAGE_RESOLVER_CALLERS.filter((entry) => entry.from.includes("0x0211D71C")).length, 2);
});

test("the move table backs the routing: power lives with kinds 0 and 1", async () => {
  const moves = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-moves.r1.json"), "utf8")).records;
  const { damageRouteForKind } = await import("../src/championship/battle/battleDamageInputs.js");

  const byKind = new Map();
  for (const record of moves) {
    if (!byKind.has(record.kind)) byKind.set(record.kind, []);
    byKind.get(record.kind).push(record.power);
  }
  assert.deepEqual([...byKind.keys()].sort(), [0, 1, 2, 3]);
  assert.equal(byKind.get(0).length, 205);
  assert.equal(byKind.get(1).length, 361);
  assert.equal(byKind.get(2).length, 27);
  assert.equal(byKind.get(3).length, 3);

  // Kind 1 carries the real spread; the two kinds the contact walk handles do not.
  assert.equal(Math.max(...byKind.get(1)), 600);
  assert.equal(new Set(byKind.get(1)).size, 27);
  assert.deepEqual([...new Set(byKind.get(2))].sort((a, b) => a - b), [0, 15]);
  assert.deepEqual([...new Set(byKind.get(3))], [0]);

  // Which is the point: the kinds with power are the kinds routed to DAMAGE.
  for (const [kind, powers] of byKind) {
    const route = damageRouteForKind(kind).route;
    if (route === "DAMAGE") assert.ok(Math.max(...powers) >= 300, `kind ${kind} carries real power`);
    else assert.ok(Math.max(...powers) <= 15, `kind ${kind} does not`);
  }
});

test("the in-flight note no longer claims the contact walk closes the chain", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleInFlight.js"), "utf8");
  assert.match(module, /CORRECTION: this walk is NOT the main damage path/);
  assert.equal(/So the chain closes: the frame updates/.test(module), false);
});
