// Battle session — the sixteen traced modules composed in the frame order.
//
// Every module passes its own cases in isolation. These check they compose, and
// that where the evidence stops the session stops with it instead of guessing.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_SESSION_EVENT_ACTION_CHOSEN,
  BATTLE_SESSION_EVENT_ACTION_COMMITTED,
  BATTLE_SESSION_EVENT_ACTION_GATE,
  BATTLE_SESSION_EVENT_BATTLE_ENDED,
  BATTLE_SESSION_EVENT_DISPATCH_STOPPED,
  BATTLE_SESSION_EVENT_NOTIFIED,
  BATTLE_SESSION_EVENT_STATE_CHANGED,
  BATTLE_SESSION_EVIDENCE,
  BATTLE_SESSION_FRAME_FUNCTION,
  BATTLE_SESSION_RUNNABLE_STATES,
  BATTLE_SESSION_SEAMS,
  BATTLE_SESSION_SLOT_COUNT,
  createBattleSession,
  createSessionCombatant,
  runBattleSession,
  stepBattleSession,
  summariseSeams
} from "../src/championship/battle/battleSession.js";

import {
  BATTLE_STATE_ACTION_GATE,
  BATTLE_STATE_COOLDOWN_GATE,
  BATTLE_STATE_COUNT,
  BATTLE_STATE_ENTRY_COUNTER,
  BATTLE_STATE_SUSPEND_MASK
} from "../src/championship/battle/battleStateMachine.js";

import { BATTLE_FRAME_EVENT_DEFEATED, BATTLE_FRAME_SLOT_COUNT } from "../src/championship/battle/battleFrameLoop.js";
import {
  BATTLE_OUTCOME_END_TEAM_DOWN,
  BATTLE_OUTCOME_END_TIME_UP,
  BATTLE_OUTCOME_TEAM_ZERO_AHEAD
} from "../src/championship/battle/battleOutcome.js";
import { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { listMoveRecordsForSpecies } from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const emptyRoster = () => new Array(BATTLE_SESSION_SLOT_COUNT).fill(null);

function sessionWith(entries, options = {}) {
  const roster = emptyRoster();
  for (const [slot, combatant] of Object.entries(entries)) {
    roster[Number(slot)] = combatant;
  }
  return createBattleSession({
    roster, rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED), ...options
  });
}

/** A stand-in for the untraced pool at combatant +0x58. */
function pool() {
  let issued = 0;
  return () => {
    issued += 1;
    return { action: issued };
  };
}

test("a session is six slots and runs the frame function's two loops", () => {
  assert.equal(BATTLE_SESSION_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_SESSION_FRAME_FUNCTION, "OVL19:0x0210D33C");
  assert.equal(BATTLE_SESSION_SLOT_COUNT, BATTLE_FRAME_SLOT_COUNT);
  assert.equal(BATTLE_SESSION_SLOT_COUNT, 6);
  assert.throws(() => createBattleSession({ roster: [null] }), /ROSTER_MUST_BE_6_LONG/);
  assert.throws(() => createBattleSession({ roster: emptyRoster(), rng: {} }), /RNG_MUST_EXPOSE_NEXT/);
  // A typo in an override is refused rather than silently carried.
  assert.throws(() => createSessionCombatant({ statusCod: 7 }), /UNKNOWN_COMBATANT_FIELD/);
});

test("the tick loop runs even for a slot whose state does nothing", () => {
  const session = sessionWith({ 2: createSessionCombatant({ state: 0, field24: 3, field28: 2 }) });
  stepBattleSession(session);
  assert.equal(session.slots[2].field24, 2);
  assert.equal(session.slots[2].field28, 1);
  // State 0 arms its 60-frame period on the frame it is entered.
  assert.equal(session.slots[2].statePeriod, 60);
  assert.equal(session.slots[2].stateCounter, 1);
});

test("a spent cooldown reaches the action gate, and a running one does not", () => {
  // State 3 returns while +0x28 is above zero.
  const waiting = sessionWith({
    0: createSessionCombatant({ state: BATTLE_STATE_COOLDOWN_GATE, field28: 2, statePeriod: 1 })
  });
  const first = stepBattleSession(waiting);
  assert.equal(first.events.some((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE), false);
  assert.equal(waiting.slots[0].field28, 1, "but the tick loop still spends it");

  const second = stepBattleSession(waiting);
  assert.equal(second.events.some((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE), false);
  assert.equal(waiting.slots[0].field28, 0);

  // Now it is spent, so the third frame falls through into state 1's routine.
  const third = stepBattleSession(waiting);
  const gate = third.events.find((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE);
  assert.ok(gate, "the cooldown gate reached the action gate");
  assert.equal(gate.slot, 0);
  assert.equal(gate.family, "NORMAL_SELECTION");
});

test("without a pool the chain reaches a choice and stops at the allocator", () => {
  const session = sessionWith({
    1: createSessionCombatant({
      state: BATTLE_STATE_COOLDOWN_GATE, field28: 0, statePeriod: 1,
      source12C: 5, source130: 11, metricBase: 100, metricLimit: 100
    })
  });
  const { events } = stepBattleSession(session);
  const chosen = events.find((e) => e.type === BATTLE_SESSION_EVENT_ACTION_CHOSEN);
  assert.ok(chosen, "the AI ran and returned a decision");
  assert.equal(chosen.slot, 1);
  assert.ok(Number.isSafeInteger(chosen.roll) && chosen.roll >= 0 && chosen.roll < 103,
    "and it rolled the original's dice to get there");

  // Without a pool the commit is a seam, not an invention.
  const seam = events.find((e) => e.reason === BATTLE_SESSION_SEAMS.ACTION_ALLOCATION.reason);
  assert.ok(seam, "the session names the allocator rather than inventing an object");
  assert.match(seam.site, /0x02111F20/);
  assert.equal(events.some((e) => e.type === BATTLE_SESSION_EVENT_ACTION_COMMITTED), false);
});

test("given a pool, the loop closes: choose, commit, cool down, choose again", () => {
  const session = sessionWith({
    0: createSessionCombatant({
      state: BATTLE_STATE_COOLDOWN_GATE, field28: 0, statePeriod: 1,
      source12C: 5, source130: 11, metricBase: 100, metricLimit: 100,
      speedIndex: 40, currentHp: 100, maxHp: 100
    })
  }, { allocateAction: pool() });

  const first = stepBattleSession(session);
  const committed = first.events.find((e) => e.type === BATTLE_SESSION_EVENT_ACTION_COMMITTED);
  assert.ok(committed, "the action was committed");
  // 0x0211594C: 90 - 2*speed, and the tick loop spends one the same frame.
  assert.equal(committed.cooldown, 90 - 2 * 40);
  assert.equal(session.slots[0].field28, committed.cooldown - 1);

  // It stays quiet while the cooldown runs, then acts again.
  const { events } = runBattleSession(session, committed.cooldown + 2);
  const again = events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_COMMITTED);
  assert.equal(again.length, 1, "exactly one more action once the cooldown is spent");
  // The only seam left is the in-flight walk: this session was given a pool but
  // no contact resolver, so a committed action is walked and goes no further.
  assert.deepEqual(summariseSeams([...first.events, ...events]).map((entry) => entry.seam),
    ["INFLIGHT_RESOLUTION"]);
});

test("a status that is not normal selection is a seam of its own", () => {
  // Runtime code 7 is one the gate does not answer NORMAL for.
  const session = sessionWith({
    0: createSessionCombatant({
      state: BATTLE_STATE_ACTION_GATE, statePeriod: 1,
      statusCode: 7, statusRemaining: 500, currentHp: 100, maxHp: 100
    })
  });
  const { events } = stepBattleSession(session);
  const gate = events.find((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE);
  assert.ok(gate);
  if (gate.family !== "NORMAL_SELECTION") {
    const seam = events.find((e) => e.reason === BATTLE_SESSION_SEAMS.ACTION_GATE_NON_NORMAL.reason);
    assert.ok(seam, "a non-normal family is named, not followed");
    assert.equal(seam.family, gate.family);
  }
});

test("state 11 waits out its status and then hands back to the action gate", () => {
  const session = sessionWith({
    4: createSessionCombatant({
      state: 11, statePeriod: 1, statusCode: 14, statusRemaining: 2, currentHp: 100, maxHp: 100
    })
  });
  // Frame 1 enters: the status still has time, so it only arms the period.
  stepBattleSession(session);
  assert.equal(session.slots[4].statePeriod, 1);
  assert.equal(session.slots[4].state, 11);

  // The tick loop spends the status; once it is gone, state 11 releases.
  let released = null;
  for (let frame = 0; frame < 8 && released === null; frame += 1) {
    const { events } = stepBattleSession(session);
    released = events.find((e) => e.type === BATTLE_SESSION_EVENT_STATE_CHANGED) ?? null;
  }
  assert.ok(released, "state 11 eventually names a successor");
  assert.equal(released.state, BATTLE_STATE_ACTION_GATE, "alive, so back to the gate");
  assert.equal(session.slots[4].state, BATTLE_STATE_ACTION_GATE);
});

test("the suspend bit freezes a slot without freezing the others", () => {
  const session = sessionWith({
    0: createSessionCombatant({ state: 0, flags9A: BATTLE_STATE_SUSPEND_MASK, field24: 5 }),
    1: createSessionCombatant({ state: 0, field24: 5 })
  });
  stepBattleSession(session);
  // The state counter does not move for the suspended slot.
  assert.equal(session.slots[0].stateCounter, BATTLE_STATE_ENTRY_COUNTER);
  assert.equal(session.slots[1].stateCounter, 1);
  // But the tick loop is a separate loop, so its counters still run.
  assert.equal(session.slots[0].field24, 4);
  assert.equal(session.slots[1].field24, 4);
});

test("a full six-slot run carries every slot from cooldown to a committed action", () => {
  const roster = [];
  for (let slot = 0; slot < BATTLE_SESSION_SLOT_COUNT; slot += 1) {
    roster.push(createSessionCombatant({
      state: BATTLE_STATE_COOLDOWN_GATE,
      statePeriod: 1,
      field28: slot,
      field54: slot < 3 ? 0 : 1,
      currentHp: 100,
      maxHp: 100,
      speciesId: 1,
      source12C: 5,
      source130: 11,
      metricBase: 100,
      metricLimit: 100,
      speedIndex: 20
    }));
  }
  const session = createBattleSession({
    roster, rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED), allocateAction: pool()
  });
  const { events } = runBattleSession(session, 30);

  // Every slot got through its cooldown, reached the gate, and chose.
  const gated = new Set(events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE).map((e) => e.slot));
  assert.deepEqual([...gated].sort(), [0, 1, 2, 3, 4, 5]);
  const chose = new Set(events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_CHOSEN).map((e) => e.slot));
  assert.deepEqual([...chose].sort(), [0, 1, 2, 3, 4, 5]);

  // Every one committed. With a pool but no contact resolver, the only seam
  // left is the in-flight walk, which is where damage would come from.
  const committed = new Set(
    events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_COMMITTED).map((e) => e.slot)
  );
  assert.deepEqual([...committed].sort(), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(summariseSeams(events).map((entry) => entry.seam), ["INFLIGHT_RESOLUTION"]);
  // Speed 20 gives every one of them the same cooldown.
  for (const event of events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_COMMITTED)) {
    assert.equal(event.cooldown, 90 - 2 * 20);
  }

  // The same seed replays the same fight, roll for roll.
  const replayRoster = roster.map((entry) => ({ ...entry }));
  const replay = createBattleSession({
    roster: replayRoster, rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED), allocateAction: pool()
  });
  const again = runBattleSession(replay, 30);
  assert.deepEqual(
    again.events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_CHOSEN).map((e) => e.roll),
    events.filter((e) => e.type === BATTLE_SESSION_EVENT_ACTION_CHOSEN).map((e) => e.roll)
  );

  // The battle did not end, because nothing traced can end it.
  assert.equal(events.some((e) => e.type === BATTLE_FRAME_EVENT_DEFEATED), false);
  assert.equal(session.frame, 30);
});

test("an untraced state names its own handler address and changes nothing", () => {
  const untraced = [];
  for (let state = 0; state < BATTLE_STATE_COUNT; state += 1) {
    if (BATTLE_SESSION_RUNNABLE_STATES.includes(state)) {
      continue;
    }
    const session = sessionWith({ 0: createSessionCombatant({ state, statePeriod: 1 }) });
    const before = { ...session.slots[0] };
    const { events } = stepBattleSession(session);
    const seam = events.find((e) => e.reason === BATTLE_SESSION_SEAMS.UNTRACED_STATE_BODY.reason);
    if (seam) {
      untraced.push(state);
      assert.equal(seam.state, state);
      assert.match(seam.handler, /^0x0211[0-9A-F]{4}$/);
      // The combatant's state is untouched: no invented transition.
      assert.equal(session.slots[0].state, before.state);
    }
  }
  // The eight inert states never reach a body, so they raise no seam.
  assert.equal(untraced.length, BATTLE_STATE_COUNT - BATTLE_SESSION_RUNNABLE_STATES.length - 8);
  assert.deepEqual([...BATTLE_SESSION_RUNNABLE_STATES], [0, 1, 3, 11, 23]);
});

test("going down raises no seam, and the defeated state runs on its own period", () => {
  // The one seam a finished match still reported. A combatant that dies enters
  // 0x17 with the counter armed at -255, so the next frame is its entry frame
  // and the handler arms its own period of 4 -- rather than inheriting whatever
  // period the state it died out of had set.
  const session = sessionWith({
    0: createSessionCombatant({ state: 3, statePeriod: 1, statusCode: 14, statusRemaining: 11, currentHp: 4, maxHp: 500 }),
    3: createSessionCombatant({ state: 0, statePeriod: 60, currentHp: 500, maxHp: 500 })
    // A resolver that declines: the in-flight walk is a different seam and this
    // case is about the state body, not about contact.
  }, { allocateAction: pool(), resolveContact: () => null });

  const first = stepBattleSession(session);
  assert.equal(session.slots[0].state, 23);
  assert.equal(session.slots[0].stateCounter, BATTLE_STATE_ENTRY_COUNTER);
  assert.equal(session.slots[0].statePeriod, 1, "the period is not touched by the death itself");
  // The notify pair lands too: 0x12 in +0x17C, -255 in +0x180.
  assert.equal(session.slots[0].field17C, 0x12);
  assert.equal(session.slots[0].field180, -255);
  assert.ok(first.events.some((e) => e.type === BATTLE_FRAME_EVENT_DEFEATED));

  const all = [...first.events];
  for (let frame = 0; frame < 10; frame += 1) {
    all.push(...stepBattleSession(session).events);
  }
  assert.equal(session.slots[0].statePeriod, 4, "the entry frame armed the handler's own period");
  assert.equal(session.slots[0].state, 23, "and nothing in the handler moves it out");
  assert.deepEqual(summariseSeams(all), [], "state 23 no longer names an untraced body");
});

test("a defeated combatant acts only when the notify code is 1", () => {
  // 0x021170EC compares +0x17C against 1 and nothing else. The death path
  // notifies 0x12, so this arm needs a code the death itself does not set.
  const down = createSessionCombatant({
    state: 23, stateCounter: 3, statePeriod: 0, currentHp: 0, maxHp: 500,
    field17C: 0x12, speedIndex: 20, metricBase: 100, metricLimit: 100
  });
  const quiet = sessionWith({ 0: down }, { allocateAction: pool() });
  const stepped = stepBattleSession(quiet);
  assert.equal(stepped.events.some((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE), false);
  assert.equal(quiet.slots[0].statePeriod, 4);

  // With code 1 it falls into state 1's routine in place. 0x021157BC opens on
  // the +0x158 jump table and has no liveness gate, so being down does not stop
  // it -- and the handler never calls 0x02114984, so the state stays 0x17.
  const acting = sessionWith({
    0: createSessionCombatant({ ...down, field17C: 1 })
  }, { allocateAction: pool() });
  const ran = stepBattleSession(acting);
  assert.equal(ran.events.some((e) => e.type === BATTLE_SESSION_EVENT_ACTION_GATE), true);
  assert.equal(acting.slots[0].state, 23, "it acts without leaving the defeated state");
  assert.equal(acting.slots[0].statePeriod, 0, "and that arm does not rewrite the period");
});

test("state 11's notify reaches +0x17C, which is what state 23 reads", () => {
  // The result carried `notify` from the start and nothing consumed it, so
  // +0x17C never moved. 0x02116870 passes 1 on the living branch.
  const session = sessionWith({
    0: createSessionCombatant({
      state: 11, stateCounter: 4, statePeriod: 1, currentHp: 300, maxHp: 500,
      statusCode: 3, statusRemaining: 0, field17C: 7
    })
  }, { allocateAction: pool() });
  const { events } = stepBattleSession(session);
  const notified = events.find((e) => e.type === BATTLE_SESSION_EVENT_NOTIFIED);
  assert.ok(notified, "the notify is applied, not dropped");
  assert.equal(notified.code, 1);
  // The exit routine 0x02112820 runs for the code already held is not traced,
  // so the event names it rather than pretending nothing was skipped.
  assert.equal(notified.exitHandlerFor, 7);
  assert.equal(session.slots[0].field17C, 1);
  assert.equal(session.slots[0].field180, -255);
  assert.equal(session.slots[0].state, BATTLE_STATE_ACTION_GATE);
});

test("the catalogs it would draw a roster from are reachable from here", () => {
  // Species 1 owns thirty move records and the scan keeps the ROM's eight.
  const shared = listMoveRecordsForSpecies(1);
  assert.equal(shared.length, 8);
  for (const record of shared) {
    assert.equal(record.speciesId, 1);
    assert.ok(Number.isSafeInteger(record.actionCost));
  }
  // The generator a session takes is the traced one, and it replays.
  const first = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  const second = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  assert.equal(first.next(216), second.next(216));
});

test("the session imports only battle modules and the contracts leaf", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleSession.js"), "utf8");
  const specifiers = (module.match(/from "([^"]+)"/g) ?? []).map((line) => line.slice(6, -1));
  for (const specifier of specifiers) {
    assert.match(specifier, /^(\.\/battle[A-Za-z]+\.js|\.\.\/contracts\/championshipContracts\.js)$/, specifier);
  }
});

test("a populated two-team session runs to a verdict instead of to its bound", () => {
  const fighter = (currentHp) => createSessionCombatant({
    state: BATTLE_STATE_ACTION_GATE, statePeriod: 0, currentHp, maxHp: 100
  });
  // The roster's downed counter and the members' hp are independent fields in
  // the ROM, and the judge reads hp -- so a team that is out is out on both.
  const session = sessionWith({
    0: fighter(100), 1: fighter(100), 2: fighter(100),
    3: fighter(0), 4: fighter(0), 5: fighter(0)
  }, { allocateAction: pool(), downed: [0, 3] });

  const run = runBattleSession(session, 500);
  assert.equal(run.ended, true);
  assert.equal(run.reason, BATTLE_OUTCOME_END_TEAM_DOWN);
  assert.equal(run.verdict, BATTLE_OUTCOME_TEAM_ZERO_AHEAD, "team 1 is out, so team 0 takes it");
  assert.equal(run.frames, 1, "the end check runs on the first frame and stops the run");
  assert.ok(run.frames < run.bound);
  const ended = run.events.filter((event) => event.type === BATTLE_SESSION_EVENT_BATTLE_ENDED);
  assert.equal(ended.length, 1, "and it is announced exactly once");
  assert.equal(ended[0].phase, 4);
});

test("with nobody down the clock decides it, and 7200 frames is not enough", () => {
  const fighter = (currentHp) => createSessionCombatant({
    state: BATTLE_STATE_ACTION_GATE, statePeriod: 0, currentHp, maxHp: 100
  });
  const session = sessionWith({
    0: fighter(100), 1: fighter(100), 2: fighter(100),
    3: fighter(40), 4: fighter(40), 5: fighter(40)
  }, { allocateAction: pool() });

  // 0x0210840's `ble` returns, so the whole 7200th frame still plays.
  const short = runBattleSession(session, 7200);
  assert.equal(short.ended, false);
  assert.equal(session.clock, 7200);
  assert.equal(session.tier, 7, "and the tier has saturated exactly now");

  const last = runBattleSession(session, 1);
  assert.equal(last.ended, true);
  assert.equal(last.reason, BATTLE_OUTCOME_END_TIME_UP);
  assert.equal(last.verdict, BATTLE_OUTCOME_TEAM_ZERO_AHEAD, "healthier side on a judged finish");
});

test("engagement stops the dispatch, so a later slot waits a frame", () => {
  const fighter = () => createSessionCombatant({
    state: BATTLE_STATE_ACTION_GATE, statePeriod: 0, currentHp: 100, maxHp: 100
  });
  const session = sessionWith({
    0: fighter(), 1: fighter(), 2: fighter(), 3: fighter(), 4: fighter(), 5: fighter()
  });
  // Slot 1 is already committed to an in-flight object when the frame opens.
  session.slots[1].field94 = 1;

  const { events } = stepBattleSession(session);
  const stopped = events.filter((event) => event.type === BATTLE_SESSION_EVENT_DISPATCH_STOPPED);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0].slot, 0, "the loop asks after slot 0 and leaves");
  // Slot 0 reached its gate; nothing past slot 0 did.
  const gated = events.filter((event) => event.type === BATTLE_SESSION_EVENT_ACTION_GATE);
  assert.deepEqual(gated.map((event) => event.slot), [0]);
});

test("given a contact resolver as well, the last seam closes and HP moves", async () => {
  const { BATTLE_SESSION_EVENT_DAMAGE_RESOLVED } = await import("../src/championship/battle/battleSession.js");

  const roster = [];
  for (let slot = 0; slot < 6; slot += 1) {
    roster.push(createSessionCombatant({
      state: 1, statePeriod: 0, currentHp: 500, maxHp: 500,
      metricBase: 100, metricLimit: 100, speedIndex: 20
    }));
  }
  const session = createBattleSession({
    roster,
    rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED),
    allocateAction: pool(),
    // Stands in for the move-record lookup the runtime supplies: slot n hits
    // slot (n + 3) % 6 for a fixed amount, so the wiring is what is under test
    // and not the formula, which battleDamageCore already pins.
    resolveContact({ slot }) {
      return { hits: [{ slot: (slot + 3) % 6, damage: 40 }], terminal: true };
    }
  });

  const { events } = runBattleSession(session, 30);
  // The only seam a run like this can hit now is the death state: a combatant
  // that goes down enters 0x17, and that state's body is genuinely untranslated.
  // Everything upstream of it -- the gate, the choice, the commit, the contact
  // resolution -- is closed.
  for (const seam of summariseSeams(events)) {
    assert.match(String(seam.seam), /UNTRACED_STATE_BODY/, `unexpected seam ${seam.seam}`);
  }

  const damage = events.filter((e) => e.type === BATTLE_SESSION_EVENT_DAMAGE_RESOLVED);
  assert.ok(damage.length >= 6, "every slot resolved at least once");
  for (const slot of session.slots) {
    assert.ok(slot.currentHp < 500, `slot took damage: ${slot.currentHp}`);
  }
  // A terminal walk drops the claim, so the pool is not exhausted after twelve.
  assert.ok(damage.length > 12, "and the twelve objects are recycled");
});

test("without a resolver nobody loses HP, which is why the seam is named", () => {
  const roster = [createSessionCombatant({ state: 1, statePeriod: 0, currentHp: 500, maxHp: 500, metricBase: 100, metricLimit: 100, speedIndex: 20 }), null, null, null, null, null];
  const session = createBattleSession({
    roster, rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED), allocateAction: pool()
  });
  runBattleSession(session, 30);
  assert.equal(session.slots[0].currentHp, 500);
});
