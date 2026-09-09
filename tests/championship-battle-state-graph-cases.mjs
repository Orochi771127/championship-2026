// Battle state graph — the 27 handlers' transitions, periods and reach.
//
// The rows were extracted mechanically from the handlers' bytes and three were
// then read by hand. These cases pin the graph's shape, the three hand-read
// bodies, and the finding that no state handler applies damage itself.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_DAMAGE_RESOLVER_CALL_SITES,
  BATTLE_SCRIPT_DAMAGE_NATIVE,
  BATTLE_STATE_BODIES_TRANSLATED,
  BATTLE_STATE_GRAPH_EVIDENCE,
  BATTLE_STATE_PROFILES,
  assertGraphMatchesMachine,
  getStateProfile,
  listStateTransitions,
  runDefeatedState,
  runIdleState,
  runStatusWaitState
} from "../src/championship/battle/battleStateGraph.js";

import {
  BATTLE_STATE_ACTION_GATE,
  BATTLE_STATE_AI_SELECT,
  BATTLE_STATE_CODES_SET_BY_ROM,
  BATTLE_STATE_COUNT,
  BATTLE_STATE_DEFEATED,
  BATTLE_STATE_INERT_STATES
} from "../src/championship/battle/battleStateMachine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the graph describes exactly the states the machine has", () => {
  assert.equal(BATTLE_STATE_GRAPH_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_STATE_PROFILES.length, BATTLE_STATE_COUNT);
  assert.equal(assertGraphMatchesMachine(), true);
  BATTLE_STATE_PROFILES.forEach((profile, index) => {
    assert.equal(profile.state, index);
    assert.ok(profile.handlerBytes > 0, `state ${index}`);
  });
  // Every state named as a destination is itself a state in the table.
  for (const profile of BATTLE_STATE_PROFILES) {
    for (const destination of profile.transitionsTo) {
      assert.ok(destination >= 0 && destination < BATTLE_STATE_COUNT,
        `state ${profile.state} -> ${destination}`);
      assert.doesNotThrow(() => getStateProfile(destination));
    }
  }
});

test("state 1 is the hub and the 14/15/16 group always comes back to it", () => {
  assert.deepEqual(listStateTransitions(BATTLE_STATE_ACTION_GATE), [3, 8, 9, 10, 12, 13]);
  assert.deepEqual(listStateTransitions(BATTLE_STATE_AI_SELECT), [3, 4, 5, 6, 7]);
  for (const state of [14, 15, 16]) {
    assert.deepEqual(listStateTransitions(state), [BATTLE_STATE_ACTION_GATE], `state ${state}`);
  }
  // 4, 5, 6 and 7 are what lead into that group.
  assert.deepEqual(listStateTransitions(4), [14]);
  assert.deepEqual(listStateTransitions(5), [15]);
  assert.deepEqual(listStateTransitions(6), [15]);
  assert.deepEqual(listStateTransitions(7), [16]);
  // Every state the ROM sets is reachable from 1 or 2, except 0, 11 and 23.
  const fromHubs = new Set([
    ...listStateTransitions(BATTLE_STATE_ACTION_GATE),
    ...listStateTransitions(BATTLE_STATE_AI_SELECT)
  ]);
  const unreachedFromHubs = BATTLE_STATE_CODES_SET_BY_ROM
    .filter((state) => !fromHubs.has(state) && state !== BATTLE_STATE_ACTION_GATE);
  assert.deepEqual(unreachedFromHubs, [0, 11, 14, 15, 16, BATTLE_STATE_DEFEATED]);
});

test("the inert states are exactly the four-byte handlers", () => {
  const fourByte = BATTLE_STATE_PROFILES.filter((p) => p.handlerBytes === 4).map((p) => p.state);
  assert.deepEqual(fourByte, [...BATTLE_STATE_INERT_STATES]);
  for (const state of fourByte) {
    assert.deepEqual(getStateProfile(state).transitionsTo, []);
    assert.deepEqual(getStateProfile(state).reaches, []);
    assert.equal(getStateProfile(state).entryPeriod, null);
  }
});

test("the periods a state arms are the immediates its handler writes", () => {
  assert.equal(getStateProfile(0).entryPeriod, 60, "0x021157A8 moveq r1,#0x3c");
  assert.equal(getStateProfile(11).entryPeriod, 1, "0x0211681C moveq r0,#1");
  assert.equal(getStateProfile(BATTLE_STATE_DEFEATED).entryPeriod, 4);
  for (const state of [4, 5, 8, 10]) {
    assert.equal(getStateProfile(state).entryPeriod, 4, `state ${state}`);
  }
  for (const state of [13, 14, 15, 16]) {
    assert.equal(getStateProfile(state).entryPeriod, 1, `state ${state}`);
  }
  // Two handlers work the value out instead of writing a literal.
  assert.equal(getStateProfile(3).entryPeriod, "COMPUTED");
  assert.equal(getStateProfile(12).entryPeriod, "COMPUTED");
});

test("no state handler applies damage or walks contact itself", () => {
  for (const profile of BATTLE_STATE_PROFILES) {
    assert.equal(profile.reaches.includes("DAMAGE_RESOLVER"), false, `state ${profile.state}`);
    assert.equal(profile.reaches.includes("CONTACT_WALK"), false, `state ${profile.state}`);
  }
  // The resolver's three call sites are the contact walk and a script native.
  assert.equal(BATTLE_DAMAGE_RESOLVER_CALL_SITES.length, 3);
  const withinNative = BATTLE_DAMAGE_RESOLVER_CALL_SITES.filter((entry) => entry.within.startsWith("SCRIPT_NATIVE"));
  assert.equal(withinNative.length, 2);
  assert.equal(BATTLE_SCRIPT_DAMAGE_NATIVE, 0x0211d71c);
  for (const entry of withinNative) {
    assert.equal(entry.within, `SCRIPT_NATIVE_0x${BATTLE_SCRIPT_DAMAGE_NATIVE.toString(16).toUpperCase().padStart(8, "0")}`);
  }
});

test("that damage native is one of the script's own CALL_NATIVE targets", () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-scripts.r1.json"), "utf8")
  );
  const targets = catalog.nativeTargets.map((entry) => Number.parseInt(entry.address, 16));
  assert.ok(targets.includes(BATTLE_SCRIPT_DAMAGE_NATIVE), "the script blob calls it");
  const entry = catalog.nativeTargets.find(
    (item) => Number.parseInt(item.address, 16) === BATTLE_SCRIPT_DAMAGE_NATIVE
  );
  assert.equal(entry.callSites, 1, "one call site, but it is the attack");
});

test("state 0 arms a sixty-frame period and then does nothing", () => {
  assert.deepEqual(runIdleState(0), { period: 60, nextState: null });
  assert.deepEqual(runIdleState(1), { period: null, nextState: null });
  assert.deepEqual(runIdleState(600), { period: null, nextState: null });
  assert.throws(() => runIdleState(1.5), /COUNTER_MUST_BE_AN_INTEGER/);
  assert.ok(BATTLE_STATE_BODIES_TRANSLATED.includes(0));
});

test("state 11 waits out the status, then resumes or drops to idle", () => {
  // Still running: nothing happens but the entry period.
  assert.deepEqual(runStatusWaitState({ counter: 0, statusRemaining: 5, currentHp: 10 }),
    { period: 1, waiting: true, clearedStatus: false, nextState: null, notify: null });
  assert.deepEqual(runStatusWaitState({ counter: 3, statusRemaining: 5, currentHp: 10 }),
    { period: null, waiting: true, clearedStatus: false, nextState: null, notify: null });

  // Spent and alive: clear, then back to the action gate, notifying 1.
  assert.deepEqual(runStatusWaitState({ counter: 3, statusRemaining: 0, currentHp: 10 }),
    { period: null, waiting: false, clearedStatus: true, nextState: 1, notify: 1 });

  // Spent and dead: clear, then idle, notifying 0x12 — the frame loop's code.
  assert.deepEqual(runStatusWaitState({ counter: 3, statusRemaining: 0, currentHp: 0 }),
    { period: null, waiting: false, clearedStatus: true, nextState: 0, notify: 0x12 });
  // `popgt` on the HP compare, so zero is not alive here.
  assert.equal(runStatusWaitState({ counter: 1, statusRemaining: 0, currentHp: 1 }).nextState, 1);

  assert.deepEqual([...BATTLE_STATE_BODIES_TRANSLATED], [0, 11, 23]);
  assert.throws(() => runStatusWaitState(null), /STATUS_WAIT_REQUIRES_AN_OBJECT/);
  assert.throws(() => runStatusWaitState({ counter: 0, statusRemaining: 0, currentHp: 1.5 }),
    /CURRENTHP_MUST_BE_AN_INTEGER/);
});

test("state 23 is the defeated state, and it never leaves itself", () => {
  // 0x021170D0, thirteen instructions. Entry frame: arm 4 and return.
  assert.deepEqual(runDefeatedState({ counter: 0, field17C: 1 }),
    { period: 4, runsActionGate: false });
  assert.deepEqual(runDefeatedState({ counter: 0, field17C: 0x12 }),
    { period: 4, runsActionGate: false });

  // Later frames: any notify code but 1 re-arms 4 and returns.
  for (const field17C of [0, 2, 0x12, 18, 21]) {
    assert.deepEqual(runDefeatedState({ counter: 5, field17C }),
      { period: 4, runsActionGate: false }, `code ${field17C}`);
  }

  // Code 1 alone falls into state 1's routine, and leaves the period alone.
  assert.deepEqual(runDefeatedState({ counter: 5, field17C: 1 }),
    { period: null, runsActionGate: true });

  // It names no successor: the profile's transitionsTo is empty, so nothing in
  // this handler moves a combatant out of 0x17.
  assert.deepEqual(getStateProfile(23).transitionsTo, []);
  assert.equal(getStateProfile(23).entryPeriod, 4);
  assert.equal(getStateProfile(23).handlerBytes, 52);

  assert.throws(() => runDefeatedState(null), /DEFEATED_REQUIRES_AN_OBJECT/);
  assert.throws(() => runDefeatedState({ counter: 0, field17C: 1.5 }),
    /FIELD17C_MUST_BE_AN_INTEGER/);
  assert.throws(() => runDefeatedState({ counter: null, field17C: 1 }),
    /COUNTER_MUST_BE_AN_INTEGER/);
});

test("only three of the twenty-seven bodies are claimed as translated", () => {
  assert.equal(BATTLE_STATE_BODIES_TRANSLATED.length, 3);
  const graph = fs.readFileSync(path.join(root, "src/championship/battle/battleStateGraph.js"), "utf8");
  // The module says so in as many words, so the claim cannot quietly widen.
  assert.match(graph, /Twenty-four of the twenty-seven handler bodies/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleStateGraph.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
