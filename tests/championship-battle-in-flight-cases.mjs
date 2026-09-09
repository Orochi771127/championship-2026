// In-flight objects — how a launched action reaches the roster.
//
// The chain this closes: the frame walks the twelve-object pool, a kind-0
// object's update is the contact walk, and contact calls the damage resolver.
// No state handler ever calls the resolver, and these cases hold that line.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_FRAME_LOOPS,
  BATTLE_INFLIGHT_DISPATCH_BREAK_SITE,
  BATTLE_INFLIGHT_ENGAGED_SITE,
  BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT,
  BATTLE_INFLIGHT_FIRST_WALK_PERIOD,
  BATTLE_INFLIGHT_FIRST_WALK_SITE,
  BATTLE_INFLIGHT_HANDLE_BINDING_OFFSET,
  BATTLE_INFLIGHT_HANDLE_COUNT,
  BATTLE_INFLIGHT_HANDLE_ENABLED_OFFSET,
  BATTLE_INFLIGHT_HANDLE_OFFSET,
  BATTLE_INFLIGHT_HANDLE_OWNER_OFFSET,
  BATTLE_INFLIGHT_PRIMARY_SCRIPT_OFFSET,
  BATTLE_INFLIGHT_SCRIPT_ACTIVE_BIT,
  BATTLE_INFLIGHT_SCRIPT_ACTIVE_OFFSET,
  BATTLE_INFLIGHT_SCRIPT_ARRAY_COUNT,
  BATTLE_INFLIGHT_SCRIPT_ARRAY_OFFSET,
  BATTLE_INFLIGHT_SCRIPT_ARRAY_STRIDE,
  BATTLE_INFLIGHT_SCRIPT_FINISHED,
  BATTLE_INFLIGHT_SCRIPT_FINISHED_SITE,
  BATTLE_INFLIGHT_SCRIPT_STEPPED,
  BATTLE_INFLIGHT_SKIP_UNENGAGED,
  BATTLE_INFLIGHT_COMMON_TAIL,
  BATTLE_INFLIGHT_DAMAGE_SITE,
  BATTLE_INFLIGHT_EVIDENCE,
  BATTLE_INFLIGHT_KINDS,
  BATTLE_INFLIGHT_KIND_OFFSET,
  BATTLE_INFLIGHT_OWNER_LOCK_OFFSET,
  BATTLE_INFLIGHT_OWNER_OFFSET,
  BATTLE_INFLIGHT_RUN,
  BATTLE_INFLIGHT_SKIP_IDLE,
  BATTLE_INFLIGHT_SKIP_LOCKED,
  BATTLE_INFLIGHT_SKIP_ORPHANED,
  BATTLE_INFLIGHT_UPDATE_SITE,
  BATTLE_INFLIGHT_WALK_COUNT,
  BATTLE_INFLIGHT_WALK_SITE,
  anyCombatantEngaged,
  firstInFlightWalkRuns,
  inFlightHandlerForKind,
  releaseScriptHandles,
  scriptIsActive,
  stepEngagedInFlightPhase,
  stepInFlightPhase,
  stepInFlightScripts,
  stepStateDispatchWalk,
  updateInFlightObject
} from "../src/championship/battle/battleInFlight.js";

import { BATTLE_LAUNCH_POOL_SIZE } from "../src/championship/battle/battleLaunchPool.js";
import { BATTLE_ACTION_APPLY_ATTACKER_OFFSET, BATTLE_ACTION_APPLY_GUARD_OFFSET } from "../src/championship/battle/battleActionApplication.js";
import { BATTLE_FRAME_LOOP_SITE } from "../src/championship/battle/battleFrameLoop.js";
import { BATTLE_STATE_FRAME_PHASE_ORDER } from "../src/championship/battle/battleStateMachine.js";
import { BATTLE_STATE_GRAPH_EVIDENCE } from "../src/championship/battle/battleStateGraph.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pool = () => new Array(BATTLE_INFLIGHT_WALK_COUNT).fill(null);

test("the frame walks the whole pool, not a combatant's three", () => {
  assert.equal(BATTLE_INFLIGHT_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_INFLIGHT_WALK_SITE, "OVL19:0x0210D694");
  assert.equal(BATTLE_INFLIGHT_UPDATE_SITE, "OVL19:0x0211CC7C");
  assert.equal(BATTLE_INFLIGHT_WALK_COUNT, 12);
  assert.equal(BATTLE_INFLIGHT_WALK_COUNT, BATTLE_LAUNCH_POOL_SIZE, "the same twelve the allocator scans");
  assert.equal(BATTLE_STATE_GRAPH_EVIDENCE, "VERIFIED_BINARY");
});

test("the frame function runs eleven loops, and the in-flight walk is between the two named ones", () => {
  assert.equal(BATTLE_FRAME_LOOPS.length, 11);
  // Address order, and each bound is one the ROM compares against.
  for (let index = 1; index < BATTLE_FRAME_LOOPS.length; index += 1) {
    assert.ok(BATTLE_FRAME_LOOPS[index].site > BATTLE_FRAME_LOOPS[index - 1].site);
    assert.ok([2, 6, 12].includes(BATTLE_FRAME_LOOPS[index].bound));
  }
  const named = BATTLE_FRAME_LOOPS.filter((entry) => entry.phase !== null);
  assert.deepEqual(named.map((entry) => entry.phase),
    ["INFLIGHT_UPDATE_ENGAGED", "STATE_DISPATCH", "INFLIGHT_UPDATE", "STATUS_AND_COUNTERS"]);
  // The in-flight walk sits between the two an earlier reading named.
  const dispatch = BATTLE_FRAME_LOOPS.find((e) => e.phase === "STATE_DISPATCH").site;
  const inflight = BATTLE_FRAME_LOOPS.find((e) => e.phase === "INFLIGHT_UPDATE").site;
  const tick = BATTLE_FRAME_LOOPS.find((e) => e.phase === "STATUS_AND_COUNTERS").site;
  assert.ok(dispatch < inflight && inflight < tick);
  assert.equal(tick, Number.parseInt(BATTLE_FRAME_LOOP_SITE.slice(6), 16));
  // Those two are exactly what the state machine already exported.
  assert.deepEqual(BATTLE_STATE_FRAME_PHASE_ORDER.map((e) => e.phase),
    ["STATE_DISPATCH", "STATUS_AND_COUNTERS"]);
  assert.equal(BATTLE_FRAME_LOOPS.filter((e) => e.bound === 12).length, 2, "two pool walks per frame");
});

test("kind 0 is the contact walk, and that is where damage comes from", () => {
  assert.equal(BATTLE_INFLIGHT_KIND_OFFSET, 0x04);
  assert.deepEqual(BATTLE_INFLIGHT_KINDS.map((entry) => entry.kind), [0, 1, 2]);
  assert.equal(inFlightHandlerForKind(0), 0x0211c714, "battleContactTargeting's walk");
  assert.equal(BATTLE_INFLIGHT_KINDS[0].name, "CONTACT_WALK");
  assert.equal(BATTLE_INFLIGHT_KINDS[0].traced, true);
  // The other two step scripts rather than touching the roster directly.
  assert.equal(inFlightHandlerForKind(1), 0x0211cba4);
  assert.equal(inFlightHandlerForKind(2), 0x0211cc18);
  assert.deepEqual(BATTLE_INFLIGHT_KINDS.map((e) => e.name),
    ["CONTACT_WALK", "STEP_ALL_FIVE_SCRIPTS", "STEP_FOUR_SCRIPTS"]);
  assert.deepEqual(BATTLE_INFLIGHT_KINDS.filter((e) => e.traced).map((e) => e.kind), [0, 1, 2]);
  // Anything else falls into the shared tail.
  assert.equal(inFlightHandlerForKind(3), null);
  assert.equal(inFlightHandlerForKind(99), null);
  assert.equal(BATTLE_INFLIGHT_COMMON_TAIL, 0x0211cce0);
  assert.equal(BATTLE_INFLIGHT_DAMAGE_SITE, "OVL19:0x0211C92C");
});

test("an orphaned object does nothing, and a lock elsewhere stops it", () => {
  const self = { tag: "object" };
  const owner = { tag: "owner" };

  assert.equal(updateInFlightObject({ self, owner: null, kind: 0 }).outcome, BATTLE_INFLIGHT_SKIP_ORPHANED);
  // A null lock lets it through.
  assert.equal(updateInFlightObject({ self, owner, ownerLock: 0, kind: 0 }).outcome, BATTLE_INFLIGHT_RUN);
  assert.equal(updateInFlightObject({ self, owner, ownerLock: null, kind: 0 }).outcome, BATTLE_INFLIGHT_RUN);
  // A lock naming this object lets it through.
  assert.equal(updateInFlightObject({ self, owner, ownerLock: self, kind: 0 }).outcome, BATTLE_INFLIGHT_RUN);
  // A lock naming another does not.
  assert.equal(updateInFlightObject({ self, owner, ownerLock: { tag: "other" }, kind: 0 }).outcome,
    BATTLE_INFLIGHT_SKIP_LOCKED);
});

test("the walk updates only the in-use objects and reports each index", () => {
  const objects = pool();
  const owner = { tag: "owner" };
  objects[0] = { self: "a", owner, ownerLock: 0, kind: 0, inUse: true };
  objects[4] = { self: "b", owner, ownerLock: "a", kind: 0, inUse: true };
  objects[7] = { self: "c", owner: null, kind: 0, inUse: true };
  objects[11] = { self: "d", owner, ownerLock: 0, kind: 5, inUse: true };

  const results = stepInFlightPhase(objects);
  assert.equal(results.length, 12);
  assert.deepEqual(results.map((entry) => entry.index), [...Array(12).keys()]);
  assert.equal(results[0].outcome, BATTLE_INFLIGHT_RUN);
  assert.equal(results[0].handler, 0x0211c714);
  assert.equal(results[4].outcome, BATTLE_INFLIGHT_SKIP_LOCKED, "the owner is locked onto 'a'");
  assert.equal(results[7].outcome, BATTLE_INFLIGHT_SKIP_ORPHANED);
  assert.equal(results[11].outcome, BATTLE_INFLIGHT_RUN);
  assert.equal(results[11].handler, null, "kind 5 takes the shared tail");
  assert.equal(results[11].tail, BATTLE_INFLIGHT_COMMON_TAIL);
  // Everything else was simply not in use.
  for (const index of [1, 2, 3, 5, 6, 8, 9, 10]) {
    assert.equal(results[index].outcome, BATTLE_INFLIGHT_SKIP_IDLE, `slot ${index}`);
  }
  assert.throws(() => stepInFlightPhase([null]), /POOL_MUST_BE_12_LONG/);
});

test("the owner and lock offsets are the ones the application module reads", () => {
  assert.equal(BATTLE_INFLIGHT_OWNER_OFFSET, BATTLE_ACTION_APPLY_ATTACKER_OFFSET);
  assert.equal(BATTLE_INFLIGHT_OWNER_OFFSET, 0xe4);
  assert.equal(BATTLE_INFLIGHT_OWNER_LOCK_OFFSET, BATTLE_ACTION_APPLY_GUARD_OFFSET);
  assert.equal(BATTLE_INFLIGHT_OWNER_LOCK_OFFSET, 0x94);
  // Which means an in-flight object and a move script's "action object" are one
  // thing, and the fourth target rejection reads this same lock.
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleInFlight.js"), "utf8");
  assert.match(module, /an in-flight\s*\n\/\/ object and the "action object"/);
});

test("no state handler reaches the damage resolver, and it never needed to", () => {
  const graph = fs.readFileSync(path.join(root, "src/championship/battle/battleStateGraph.js"), "utf8");
  assert.match(graph, /Not one of the 27 handlers calls the damage resolver/);
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleInFlight.js"), "utf8");
  // The phrase wraps across comment lines after the damage-path correction.
  assert.match(module, /Nothing in the state machine ever calls the[\s\S]{0,8}resolver/);
  // And the walk no longer claims to be where an ordinary attack is resolved.
  assert.match(module, /this walk is a smaller sibling of it/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleInFlight.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("the first walk runs one frame in eight and only for engaged owners", () => {
  assert.equal(BATTLE_INFLIGHT_FIRST_WALK_SITE, "OVL19:0x0210D490");
  assert.equal(BATTLE_INFLIGHT_FIRST_WALK_PERIOD, 8);
  assert.deepEqual([...Array(17).keys()].filter((n) => firstInFlightWalkRuns(n)), [0, 8, 16]);

  const objects = pool();
  const engaged = { tag: "engaged" };
  const idle = { tag: "idle" };
  objects[0] = { self: "a", owner: engaged, ownerLock: "a", kind: 0, inUse: true };
  objects[1] = { self: "b", owner: idle, ownerLock: 0, kind: 0, inUse: true };
  objects[2] = { self: "c", owner: null, kind: 0, inUse: true };

  const first = stepEngagedInFlightPhase(objects);
  assert.equal(first[0].outcome, BATTLE_INFLIGHT_RUN, "its owner is committed to it");
  assert.equal(first[1].outcome, BATTLE_INFLIGHT_SKIP_UNENGAGED);
  assert.equal(first[2].outcome, BATTLE_INFLIGHT_SKIP_UNENGAGED, "no owner, no lock to read");
  assert.equal(first[3].outcome, BATTLE_INFLIGHT_SKIP_IDLE);

  // The second walk has no such gate, so an engaged owner's object is updated
  // twice on the frames where both run.
  const second = stepInFlightPhase(objects);
  assert.equal(second[0].outcome, BATTLE_INFLIGHT_RUN);
  assert.equal(second[1].outcome, BATTLE_INFLIGHT_RUN);
  assert.equal(second[2].outcome, BATTLE_INFLIGHT_SKIP_ORPHANED);
  const updatedTwice = objects
    .map((object, index) => (first[index].outcome === BATTLE_INFLIGHT_RUN && second[index].outcome === BATTLE_INFLIGHT_RUN ? index : null))
    .filter((index) => index !== null);
  assert.deepEqual(updatedTwice, [0]);
});

test("engagement ends the state dispatch for the rest of the frame", () => {
  assert.equal(BATTLE_INFLIGHT_ENGAGED_SITE, "OVL19:0x0210FA28");
  assert.equal(BATTLE_INFLIGHT_DISPATCH_BREAK_SITE, "OVL19:0x0210D678");
  assert.equal(BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT, 6);

  const roster = () => [0, 1, 2, 3, 4, 5].map((index) => ({ index, lock: 0 }));
  assert.equal(anyCombatantEngaged(roster()), false);
  const committed = roster();
  committed[4].lock = { tag: "object" };
  assert.equal(anyCombatantEngaged(committed), true);
  assert.throws(() => anyCombatantEngaged([null]), /ROSTER_MUST_BE_6_LONG/);

  // Nobody commits: all six dispatch.
  const quiet = roster();
  const all = stepStateDispatchWalk(quiet, () => "idle");
  assert.deepEqual(all.visited.map((entry) => entry.index), [0, 1, 2, 3, 4, 5]);
  assert.equal(all.stoppedAfter, null);

  // Slot 2 commits, so slots 3..5 wait for the next frame.
  const acting = roster();
  const stopped = stepStateDispatchWalk(acting, (combatant) => {
    if (combatant.index === 2) combatant.lock = { tag: "launched" };
    return combatant.index;
  });
  assert.deepEqual(stopped.visited.map((entry) => entry.index), [0, 1, 2]);
  assert.equal(stopped.stoppedAfter, 2);

  // An empty slot is skipped without ending the walk.
  const sparse = roster();
  sparse[1] = null;
  assert.deepEqual(stepStateDispatchWalk(sparse, () => null).visited.map((e) => e.index), [0, 2, 3, 4, 5]);

  // A combatant already engaged when the frame starts stops it after slot 0.
  const carried = roster();
  carried[0].lock = { tag: "held" };
  assert.equal(stepStateDispatchWalk(carried, () => null).stoppedAfter, 0);
});

test("an object carries five script VMs, and kind 2 skips the primary", () => {
  assert.equal(BATTLE_INFLIGHT_PRIMARY_SCRIPT_OFFSET, 0xec);
  assert.equal(BATTLE_INFLIGHT_SCRIPT_ARRAY_OFFSET, 0x2a0);
  assert.equal(BATTLE_INFLIGHT_SCRIPT_ARRAY_STRIDE, 0x1b4);
  assert.equal(BATTLE_INFLIGHT_SCRIPT_ARRAY_COUNT, 4);
  assert.equal(BATTLE_INFLIGHT_SCRIPT_ACTIVE_OFFSET, 0x190);
  assert.equal(BATTLE_INFLIGHT_SCRIPT_ACTIVE_BIT, 1);

  assert.equal(scriptIsActive(0), false);
  assert.equal(scriptIsActive(1), true);
  assert.equal(scriptIsActive(0xfffe), false, "only bit 0 counts");

  const scripts = [{ flags: 1 }, { flags: 0 }, { flags: 1 }, { flags: 0 }];
  const kindOne = stepInFlightScripts({ kind: 1, primary: { flags: 1 }, scripts });
  assert.equal(kindOne.primary.offset, 0xec);
  assert.equal(kindOne.primary.stepped, true);
  assert.equal(kindOne.anyActive, null, "kind 1 reports nothing back");
  assert.deepEqual(kindOne.scripts.map((entry) => entry.offset),
    [0x2a0, 0x2a0 + 0x1b4, 0x2a0 + 2 * 0x1b4, 0x2a0 + 3 * 0x1b4]);
  assert.deepEqual([...kindOne.released], [1, 3]);
  assert.deepEqual(kindOne.scripts.map((entry) => entry.outcome),
    [BATTLE_INFLIGHT_SCRIPT_STEPPED, BATTLE_INFLIGHT_SCRIPT_FINISHED, BATTLE_INFLIGHT_SCRIPT_STEPPED, BATTLE_INFLIGHT_SCRIPT_FINISHED]);

  const kindTwo = stepInFlightScripts({ kind: 2, primary: { flags: 1 }, scripts });
  assert.equal(kindTwo.primary, null, "0x0211CC18 never touches +0xEC");
  assert.equal(kindTwo.anyActive, true);
  assert.equal(stepInFlightScripts({ kind: 2, scripts: [{ flags: 0 }, {}, {}, {}] }).anyActive, false);
  assert.deepEqual([...stepInFlightScripts({ kind: 2, scripts: [{ flags: 0 }, {}, {}, {}] }).released], [0, 1, 2, 3]);

  assert.throws(() => stepInFlightScripts({ kind: 0, scripts }), /SCRIPT_STEP_IS_KIND_1_OR_2/);
  assert.throws(() => stepInFlightScripts({ kind: 1, scripts: [{}] }), /SCRIPT_ARRAY_MUST_BE_4_LONG/);
});

test("a finished script releases only its own handles, out of twenty-four", () => {
  assert.equal(BATTLE_INFLIGHT_SCRIPT_FINISHED_SITE, "OVL19:0x0211CD80");
  assert.equal(BATTLE_INFLIGHT_HANDLE_COUNT, 24);
  assert.equal(BATTLE_INFLIGHT_HANDLE_OFFSET, 0x24);
  assert.equal(BATTLE_INFLIGHT_HANDLE_OWNER_OFFSET, 0x84);
  assert.equal(BATTLE_INFLIGHT_HANDLE_BINDING_OFFSET, 0x970);
  assert.equal(BATTLE_INFLIGHT_HANDLE_ENABLED_OFFSET, 0x5b);
  // The tail's `cmp r7,#0x18` and the release hook walk the same twenty-four.
  assert.equal(BATTLE_INFLIGHT_HANDLE_COUNT, 0x18);

  const mine = { tag: "script-a" };
  const theirs = { tag: "script-b" };
  const handleA = { tag: "handle-a" };
  const handleB = { tag: "handle-b" };
  const handles = new Array(BATTLE_INFLIGHT_HANDLE_COUNT).fill(null).map(() => ({ handle: null, owner: null, binding: 0, enabled: 1 }));
  handles[0] = { handle: handleA, owner: mine, binding: handleA, enabled: 1 };
  handles[3] = { handle: handleB, owner: theirs, binding: handleB, enabled: 1 };
  handles[7] = { handle: null, owner: mine, binding: 0, enabled: 1 };
  handles[9] = { handle: handleA, owner: mine, binding: 0, enabled: 1 };

  const released = releaseScriptHandles(handles, mine);
  assert.deepEqual([...released.released], [0, 9], "index 7 has no handle to switch off");
  assert.equal(released.handles[0].enabled, 0);
  assert.equal(released.handles[0].binding, 0, "the binding named it, so it is cleared");
  assert.equal(released.handles[9].binding, 0, "and one that did not stays as it was");
  assert.equal(released.handles[3].enabled, 1, "another script's handle is untouched");
  assert.equal(released.handles[7].enabled, 1);
  assert.throws(() => releaseScriptHandles([], mine), /HANDLES_MUST_BE_24_LONG/);
});

test("every frame loop carries the routines it calls, translated or not", () => {
  for (const loop of BATTLE_FRAME_LOOPS) {
    assert.ok(Array.isArray(loop.calls), `0x${loop.site.toString(16)} has a call list`);
    for (const target of loop.calls) {
      assert.equal(Number.isSafeInteger(target), true);
      assert.ok(target >= 0x02000000 && target < 0x02200000, `0x${target.toString(16)} is a RAM address`);
    }
  }
  // The two pool walks call the one update, and the dispatch loop calls the
  // state dispatcher, the per-slot routine, and the engagement test.
  const byPhase = (phase) => BATTLE_FRAME_LOOPS.find((loop) => loop.phase === phase);
  assert.deepEqual([...byPhase("INFLIGHT_UPDATE").calls], [0x0211cc7c]);
  assert.deepEqual([...byPhase("INFLIGHT_UPDATE_ENGAGED").calls], [0x0211cc7c]);
  assert.ok(byPhase("STATE_DISPATCH").calls.includes(0x0210fa28), "the engagement test is in the dispatch loop");
  // Seven remain untranslated, and the module says so rather than implying more.
  assert.equal(BATTLE_FRAME_LOOPS.filter((loop) => loop.phase === null).length, 7);
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleInFlight.js"), "utf8");
  assert.match(module, /a call target is not a meaning/);
});
