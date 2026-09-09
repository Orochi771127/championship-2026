// Battle session — the traced modules composed in the original's frame order.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// Sixteen battle modules were translated one at a time and every one passes its
// own cases, but until now nothing checked that they compose. This runs them in
// the order OVL19 0x0210D33C runs them:
//
//   0x0210D644  state dispatch over six slots, ascending
//   0x0210D6E4  status, threshold, timer and the two counters, same six slots
//
// and follows the traced chain from a spent cooldown to a chosen action.
//
// WHAT IT REFUSES TO DO
// ---------------------
// The bound normal runtime supplies states 3/4/5/6/7/14/15/16 and three launch
// slots. R8 supplies hit and recovery notifications. Remaining negative-state
// bodies still emit their existing SEAM; a playable match is not full parity.
//
// THE CHAIN THAT DOES COMPOSE
// ---------------------------
//   battleFrameLoop      ticks +0x28 down                     0x0210D8F4
//   state 3              returns while +0x28 > 0              0x021161D4
//                        otherwise falls into state 1         0x021161E0
//   state 1              negativeStatusActionGate             0x021157BC
//                        NORMAL selection reaches state 2     0x02115920
//   state 2              AI action selection                  0x021159D4
//
// R9 binds target selection, approach and launch states through normalFlow.
// 02111F20 selects a TARGET; combatant +5C holds that target. committedAction
// remains a compatibility view. The normal runtime enumerates all three slots.
// Standalone scalar tests retain the old adapter when normalFlow is absent.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { negativeStatusActionGate, BATTLE_STATUS_GATE_NORMAL } from "./battleStatus.js";
import { selectBattleAiAction } from "./battleActionSelection.js";
import { buildCandidateBuckets } from "./battleCandidateBuckets.js";
import { buildMoveBucketsForSpecies } from "./battleMoveBuckets.js";
import { applyBattleHp, rebuildDecisionCooldown } from "./battleDamageResolver.js";
import {
  BATTLE_STATE_ACTION_GATE,
  BATTLE_STATE_AI_SELECT,
  BATTLE_STATE_COOLDOWN_GATE,
  BATTLE_STATE_DISPATCH_ENTER,
  BATTLE_STATE_DISPATCH_SUSPENDED,
  BATTLE_STATE_DISPATCH_THROTTLED,
  BATTLE_STATE_DEFEATED,
  BATTLE_STATE_ENTRY_COUNTER,
  cooldownGateAllowsAction,
  dispatchBattleState,
  getBattleStateHandler,
  notifyBattleState
} from "./battleStateMachine.js";
import {
  BATTLE_STATE_BODIES_TRANSLATED,
  runDefeatedState,
  runIdleState,
  runStatusWaitState
} from "./battleStateGraph.js";
import { anyCombatantEngaged } from "./battleInFlight.js";
import { BATTLE_HIT_FIELDS } from './battleHitState.js';
import { BATTLE_NORMAL_FIELDS } from './battleNormalFlow.js';
import {
  BATTLE_OUTCOME_END_NONE,
  BATTLE_OUTCOME_RUNNING,
  battleTeamOfSlot,
  battleTeamsFromRoster,
  checkBattleEnd,
  demoteLevelVerdict,
  tickBattleClock
} from "./battleOutcome.js";
import {
  BATTLE_FRAME_COMBATANT_FIELDS,
  BATTLE_FRAME_EVENT_DEFEATED,
  BATTLE_FRAME_SLOT_COUNT,
  createFrameCombatant,
  stepFrameSlot
} from "./battleFrameLoop.js";

export const BATTLE_SESSION_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_SESSION_FRAME_FUNCTION = "OVL19:0x0210D33C";
export const BATTLE_SESSION_SLOT_COUNT = BATTLE_FRAME_SLOT_COUNT;

export const BATTLE_SESSION_EVENT_STATE_CHANGED = "STATE_CHANGED";
export const BATTLE_SESSION_EVENT_ACTION_GATE = "ACTION_GATE";
export const BATTLE_SESSION_EVENT_ACTION_CHOSEN = "ACTION_CHOSEN";
export const BATTLE_SESSION_EVENT_ACTION_COMMITTED = "ACTION_COMMITTED";
export const BATTLE_SESSION_EVENT_ACTION_RELEASED = "ACTION_RELEASED";
export const BATTLE_SESSION_EVENT_SEAM = "SEAM";
export const BATTLE_SESSION_EVENT_DISPATCH_STOPPED = "DISPATCH_STOPPED";
export const BATTLE_SESSION_EVENT_BATTLE_ENDED = "BATTLE_ENDED";
export const BATTLE_SESSION_EVENT_DAMAGE_RESOLVED = "DAMAGE_RESOLVED";
export const BATTLE_SESSION_EVENT_NOTIFIED = "NOTIFIED";

/** Every place the evidence runs out, named once so a test can pin the list. */
export const BATTLE_SESSION_SEAMS = deepFreeze({
  UNTRACED_STATE_BODY: {
    reason: "UNTRACED_STATE_BODY",
    note: "the state's handler has a profile in the graph but no translated body"
  },
  ACTION_ALLOCATION: {
    reason: "ACTION_ALLOCATION",
    site: "OVL19:0x02111F20",
    note: "runtime launch adapter absent; original 02111F20 selects a target, not an action object"
  },
  ACTION_GATE_NON_NORMAL: {
    reason: "ACTION_GATE_NON_NORMAL",
    site: "OVL19:0x021157BC",
    note: "the gate returned a family other than NORMAL, whose follow-through is not traced"
  },
  INFLIGHT_RESOLUTION: {
    reason: "INFLIGHT_RESOLUTION",
    site: "OVL19:0x0210D694",
    note: "a committed action is walked here, and turning it into contact needs the move record it names, which this module does not read"
  }
});

const SESSION_FIELDS = deepFreeze([
  ...BATTLE_NORMAL_FIELDS,
  ...BATTLE_HIT_FIELDS,
  "state", "stateCounter", "statePeriod", "flags9A",
  "profileIndex", "speciesId", "field54", "field94",
  // The two words at stats +0x12C and +0x130 that fill the candidate buckets,
  // and the four scalars AI selection reads alongside them.
  "source12C", "source130",
  "sessionScalarIndex", "metricBase", "metricLimit", "pendingField24",
  // +0x5C, the action object currently claimed, and stats +0x8C, the speed the
  // rebuilt cooldown is computed from.
  "committedAction", "speedIndex"
]);

function sessionError(message) {
  return new Error(`BATTLE_SESSION_${message}`);
}

/**
 * A combatant carrying everything the traced modules read: the frame-loop
 * fields plus the state-machine and targeting ones.
 */
export function createSessionCombatant(overrides = {}) {
  const frameFields = {};
  const sessionFields = {
    ...Object.fromEntries(BATTLE_NORMAL_FIELDS.map(k=>[k,0])),
    ...Object.fromEntries(BATTLE_HIT_FIELDS.map(k=>[k,k==='field98'?2:0])),
    state: 0,
    stateCounter: BATTLE_STATE_ENTRY_COUNTER,
    statePeriod: 0,
    flags9A: 0,
    profileIndex: 0,
    speciesId: 0,
    field54: 0,
    field94: 0,
    source12C: 0,
    source130: 0,
    sessionScalarIndex: 0,
    metricBase: 0,
    metricLimit: 0,
    pendingField24: 0,
    committedAction: 0,
    speedIndex: 0
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (SESSION_FIELDS.includes(key)) {
      sessionFields[key] = value;
    } else {
      frameFields[key] = value;
    }
  }
  for (const key of SESSION_FIELDS) {
    if (!Number.isSafeInteger(sessionFields[key])) {
      throw sessionError(`${key.toUpperCase()}_MUST_BE_AN_INTEGER`);
    }
  }
  // createFrameCombatant rejects any field it does not own, so a typo anywhere
  // in the overrides fails here rather than being silently carried.
  return { ...createFrameCombatant(frameFields), ...sessionFields };
}

export function createBattleSession(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.roster)) {
    throw sessionError("REQUIRES_A_ROSTER_ARRAY");
  }
  if (input.roster.length !== BATTLE_SESSION_SLOT_COUNT) {
    throw sessionError(`ROSTER_MUST_BE_${BATTLE_SESSION_SLOT_COUNT}_LONG`);
  }
  const rng = input.rng ?? null;
  if (rng !== null && typeof rng.next !== "function") {
    throw sessionError("RNG_MUST_EXPOSE_NEXT");
  }
  const allocateAction = input.allocateAction ?? null;
  if (allocateAction !== null && typeof allocateAction !== "function") {
    throw sessionError("ALLOCATE_ACTION_MUST_BE_A_FUNCTION");
  }
  // The in-flight walk turns a committed action into contact. Doing that needs
  // the move record the action names, and this module reads no catalog, so the
  // caller supplies it exactly as it supplies the pool. Without one the phase
  // is a seam rather than an invention.
  const resolveContact = input.resolveContact ?? null;
  if (resolveContact !== null && typeof resolveContact !== "function") {
    throw sessionError("RESOLVE_CONTACT_MUST_BE_A_FUNCTION");
  }
  const downed = input.downed ?? [0, 0];
  if (!Array.isArray(downed) || downed.length !== 2 || !downed.every((value) => Number.isSafeInteger(value))) {
    throw sessionError("DOWNED_MUST_BE_TWO_INTEGERS");
  }
  return {
    frame: 0,
    rng,
    allocateAction,
    resolveContact,
    waitForNativeAction: input.waitForNativeAction === true,
    stepNotification: input.stepNotification ?? null,
    onFrameEvents: input.onFrameEvents ?? null,
    notify: input.notify ?? null,
    normalFlow: null,
    // +0x5E98 and +0x5E9C. The frame counter is not the loop index: the ROM
    // advances it inside the frame function, and the end check reads it there.
    clock: 0,
    tier: 0,
    downed: [...downed],
    ended: false,
    endReason: BATTLE_OUTCOME_END_NONE,
    verdict: BATTLE_OUTCOME_RUNNING,
    slots: input.roster.map((entry) => (entry === null || entry === undefined ? null : { ...entry }))
  };
}

/** State 3's body: the cooldown gate, then state 1's routine if it is spent. */
function runCooldownGate(combatant, slot, events, rng, allocateAction, session) {
  if(session.waitForNativeAction && combatant.committedAction)return;
  if (!cooldownGateAllowsAction(combatant.field28)) {
    return;
  }
  runActionGate(combatant, slot, events, rng, allocateAction, session);
}

/** State 1's body, then state 2's, as far as both are traced. */
function runActionGate(combatant, slot, events, rng, allocateAction, session) {
  if(!session.normalFlow && session.waitForNativeAction && combatant.committedAction)return;
  if(session.normalFlow?.statusGate(slot))return;
  const gate = negativeStatusActionGate({ runtimeCode: combatant.statusCode });
  events.push({ type: BATTLE_SESSION_EVENT_ACTION_GATE, slot, family: gate.family });
  if (gate.family !== BATTLE_STATUS_GATE_NORMAL) {
    // Every other family leads somewhere this trace has not gone.
    events.push({ ...BATTLE_SESSION_SEAMS.ACTION_GATE_NON_NORMAL, slot, family: gate.family });
    return;
  }
  if (!rng) {
    throw sessionError("AI_SELECTION_NEEDS_AN_RNG");
  }
  const targeting=session.normalFlow?.prepareGate(slot);
  if(session.normalFlow&&!targeting)return;
  // Two different structures, and they were being confused. The nine groups
  // built from the two source codes feed the TARGETED cascade; the ladder's
  // three buckets are the creature's own move list, classified by kind at
  // 0x02113E5C. Passing the nine into the three meant the ladder never had a
  // candidate and every roll fell through to the move ladder.
  const built = buildCandidateBuckets([combatant.source12C, combatant.source130]);
  const ladder = buildMoveBucketsForSpecies(combatant.speciesId);
  const decision = selectBattleAiAction({
    profileIndex: combatant.profileIndex,
    negativeStatusCode: combatant.statusCode,
    pendingField24: combatant.pendingField24,
    // 0x021159F0 reads this off the BATTLE, not the combatant: it is the clock
    // tier at ctx +0x5E9C that battleOutcome already advances every 900 frames.
    // A per-combatant field was being passed here, and it defaulted to 0, which
    // is the tier whose reserve percent is 0 for two of the three profiles --
    // so no action was ever affordable and the AI always fell to the move
    // ladder. The ROM's rule is that a match opens passive and grows more
    // willing to spend as the clock runs out.
    sessionScalarIndex: session.tier,
    metricBase: combatant.metricBase,
    metricLimit: combatant.metricLimit,
    candidateBuckets: ladder.buckets,
    targeted: {
      ...(targeting?.targeted??{}),
      scanGroups: built.scanGroups,
      actionCostById: built.actionCostById,
      // 0x02115C40's group-1 and group-3 branches scan the roster for a target,
      // and 0x02115DF0's group-5 collects from it. Without it every targeted
      // group reports NO_TARGET and the cascade always falls to the move
      // ladder, which is what kept a composed battle from ever attacking.
      roster: targeting?.targeted.roster ?? session.slots.map((entry) => (entry
        ? {
          currentHp: entry.currentHp,
          metric44: entry.metric44 ?? 0,
          metric54: entry.metric54 ?? 0,
          positiveEffectCode: entry.field160 ?? 0
        }
        : null))
    },
    rng
  });
  events.push({
    type: BATTLE_SESSION_EVENT_ACTION_CHOSEN,
    slot,
    decision: decision.decision,
    state: decision.state ?? null,
    roll: decision.roll ?? null,
    actionId: decision.action ? decision.action.actionId : null
  });

  if(session.normalFlow){
    session.normalFlow.commitDecision(slot,decision,targeting);
    combatant.field28=rebuildDecisionCooldown(combatant.speedIndex,combatant.field160);
    return;
  }

  // Runtime adapter for the unported intervening launch states. 021158F8
  // itself selects a target via 02111F20; it does not allocate this action.
  if (typeof allocateAction !== "function") {
    events.push({ ...BATTLE_SESSION_SEAMS.ACTION_ALLOCATION, slot, state: BATTLE_STATE_AI_SELECT });
    return;
  }
  const claimed = allocateAction(slot, decision);
  if (!claimed) {
    // An unavailable runtime launch leaves this adapter without a claim.
    return;
  }

  // Replace a prior runtime claim only when it differs. This is not the
  // original 02115924 target-link reference counting.
  const previous = combatant.committedAction;
  if (previous !== 0 && previous !== claimed) {
    previous?.release?.();
    events.push({ type: BATTLE_SESSION_EVENT_ACTION_RELEASED, slot, action: previous });
  }
  combatant.committedAction = claimed;
  // The existing normal-launch adapter waits in 3 while its VM owns the
  // action. Returning from notification 15 must rejoin that same adapter;
  // leaving it at 23/notify1 would replace a live VM every four frames.
  // Original intervening states 4..16 remain a separate translation boundary.
  if(session.waitForNativeAction && combatant.state!==3)enterState(combatant,3,slot,events);

  // 0x0211594C: cooldown = 90 - 2*speed, then 80% when +0x160 is exactly 3.
  combatant.field28 = rebuildDecisionCooldown(combatant.speedIndex, combatant.field160);
  events.push({
    type: BATTLE_SESSION_EVENT_ACTION_COMMITTED,
    slot,
    action: claimed,
    cooldown: combatant.field28
  });
}

function enterState(combatant, state, slot, events) {
  combatant.state = state;
  combatant.stateCounter = BATTLE_STATE_ENTRY_COUNTER;
  events.push({ type: BATTLE_SESSION_EVENT_STATE_CHANGED, slot, state });
}

/**
 * 0x02112820. The two stores are traced and applied; the exit routine it runs
 * for the code the combatant was already carrying is not, so the event names
 * that code rather than pretending nothing was skipped.
 */
function applyNotify(combatant, code, slot, events, notify=null) {
  const notified = notifyBattleState(code, combatant.field17C ?? 0);
  if(notify)notify(slot,code);
  else {combatant.field17C = notified.code;combatant.field180 = notified.counter;}
  events.push({
    type: BATTLE_SESSION_EVENT_NOTIFIED,
    slot,
    code: notified.code,
    exitHandlerFor: notified.exitHandlerFor
  });
}

function runStateBody(combatant, slot, events, counterSeen, rng, allocateAction, session) {
  if(session.normalFlow?.stepState(slot,()=>runActionGate(combatant,slot,events,rng,allocateAction,session)))return;
  switch (combatant.state) {
    case 0: {
      const result = runIdleState(counterSeen);
      if (result.period !== null) {
        combatant.statePeriod = result.period;
      }
      return;
    }
    case BATTLE_STATE_ACTION_GATE:
      runActionGate(combatant, slot, events, rng, allocateAction, session);
      return;
    case BATTLE_STATE_COOLDOWN_GATE:
      runCooldownGate(combatant, slot, events, rng, allocateAction, session);
      return;
    case 11: {
      const result = runStatusWaitState({
        counter: counterSeen,
        statusRemaining: combatant.statusRemaining,
        currentHp: combatant.currentHp
      });
      if (result.period !== null) {
        combatant.statePeriod = result.period;
      }
      if (result.clearedStatus) {
        combatant.statusCode = 0;
        combatant.statusRemaining = 0;
      }
      if (result.nextState !== null) {
        enterState(combatant, result.nextState, slot, events);
      }
      // 0x02116858 and 0x02116870 both call the notify straight after the state
      // setter. The result carried the code all along and nothing consumed it,
      // so +0x17C never moved -- which is the field state 23 gates on.
      if (result.notify !== null) {
        applyNotify(combatant, result.notify, slot, events,session.notify);
      }
      return;
    }
    case BATTLE_STATE_DEFEATED: {
      const result = runDefeatedState({
        counter: counterSeen,
        field17C: combatant.field17C ?? 0
      });
      if (result.period !== null) {
        combatant.statePeriod = result.period;
      }
      if (result.runsActionGate) {
        // 0x021170FC calls state 1's routine in place. The combatant stays in
        // 0x17: this handler never calls 0x02114984, so being down is durable
        // even on the frame it acts.
        runActionGate(combatant, slot, events, rng, allocateAction, session);
      }
      return;
    }
    default:
      events.push({
        ...BATTLE_SESSION_SEAMS.UNTRACED_STATE_BODY,
        slot,
        state: combatant.state,
        handler: `0x${getBattleStateHandler(combatant.state).toString(16).toUpperCase().padStart(8, "0")}`
      });
  }
}

/** One frame: the dispatch loop, then the tick loop, both ascending. */
export function stepBattleSession(session) {
  if (!session || typeof session !== "object" || !Array.isArray(session.slots)) {
    throw sessionError("STEP_REQUIRES_A_SESSION");
  }
  const events = [];
  session.normalFlow?.beforeFrame();

  // --- OVL19 0x0210D644 -------------------------------------------------
  for (let slot = 0; slot < BATTLE_SESSION_SLOT_COUNT; slot += 1) {
    const combatant = session.slots[slot];
    if (!combatant) {
      continue;
    }
    const dispatched = dispatchBattleState({
      state: combatant.state,
      counter: combatant.stateCounter,
      period: combatant.statePeriod,
      flags9A: combatant.flags9A
    });
    combatant.stateCounter = dispatched.counter;
    if (!(dispatched.outcome === BATTLE_STATE_DISPATCH_SUSPENDED
      || dispatched.outcome === BATTLE_STATE_DISPATCH_THROTTLED
      || dispatched.inert)) {
      // 02115794 increments after the handler, so the body sees counter - 1.
      if(session.normalFlow)combatant.stateCounter=dispatched.counter-1;
      runStateBody(combatant, slot, events, dispatched.counter - 1, session.rng, session.allocateAction, session);
      if(session.normalFlow)combatant.stateCounter++;
    }
    // 0210D668..670 follows the state dispatcher even when it was throttled or
    // suspended. Recovery owns +180 and must never be gated by +16C's period.
    session.stepNotification?.(slot);
    // 0x0210D678: the loop asks after every slot and leaves the moment anyone
    // is engaged, so the remaining slots wait for the next frame.
    if (anyCombatantEngaged(session.slots.map((entry) => (entry ? { lock: entry.field94 } : null)))) {
      events.push({ type: BATTLE_SESSION_EVENT_DISPATCH_STOPPED, slot });
      break;
    }
  }

  // --- OVL19 0x0210D694 -------------------------------------------------
  // The in-flight walk, between the dispatch loop and the tick loop, which is
  // where BATTLE_FRAME_LOOPS puts it. A kind-0 object's update IS the contact
  // walk, and the contact walk is what calls the resolver, so this is the only
  // place in a frame where anyone can lose HP.
  const inFlight=session.normalFlow?.inFlight()??session.slots.flatMap((c,slot)=>c?.committedAction?[{slot,action:c.committedAction}]:[]);
  for (const {slot,action} of inFlight) {
    const combatant = session.slots[slot];
    if (!combatant || (session.normalFlow&&!session.normalFlow.isActive(action))) {
      continue;
    }
    if (typeof session.resolveContact !== "function") {
      events.push({ ...BATTLE_SESSION_SEAMS.INFLIGHT_RESOLUTION, slot });
      continue;
    }
    const resolved = session.resolveContact({
      slot,
      attacker: combatant,
      action,
      slots: session.slots,
      rng: session.rng
    });
    if (!resolved) {
      continue;
    }
    for (const hit of resolved.hits ?? []) {
      const target = session.slots[hit.slot];
      if (!target) continue;
      // 0x021149D8 already refused a target at or below zero, and applyBattleHp
      // refuses again. Neither floors at zero, so a killing blow goes negative
      // and battleFrameLoop's `hp < 0` sees it.
      target.currentHp = applyBattleHp(target.currentHp, hit.damage);
      events.push({
        type: BATTLE_SESSION_EVENT_DAMAGE_RESOLVED,
        slot,
        target: hit.slot,
        damage: hit.damage,
        critical: hit.critical === true,
        currentHp: target.currentHp
      });
    }
    // The walk writes a terminal phase when it takes the contact path. What
    // frees the object afterwards is the script-completion hook at 0x0211CD80,
    // whose timing this lane has traced in shape but not in frames, so the
    // claim is dropped here and the caller's pool is told.
    if (resolved.terminal) {
      const claimed = action;
      if(combatant.committedAction===claimed)combatant.committedAction = 0;
      claimed?.release?.();
      events.push({ type: BATTLE_SESSION_EVENT_ACTION_RELEASED, slot, action: claimed });
    }
  }

  session.normalFlow?.afterActions();

  // --- OVL19 0x0210D6E4 -------------------------------------------------
  for (let slot = 0; slot < BATTLE_SESSION_SLOT_COUNT; slot += 1) {
    const combatant = session.slots[slot];
    if (!combatant) {
      continue;
    }
    const frameFields = {};
    for (const key of BATTLE_FRAME_COMBATANT_FIELDS) {
      frameFields[key] = combatant[key];
    }
    const ticked = stepFrameSlot(frameFields, slot);
    for (const [key, value] of Object.entries(ticked.combatant)) {
      combatant[key] = value;
    }
    session.onFrameEvents?.(slot,ticked.events,frameFields);
    events.push(...ticked.events);
  }

  // --- OVL19 0x0210D93C, then the end check at 0x021107E0 ------------------
  const clock = tickBattleClock(session.clock);
  session.clock = clock.frames;
  session.tier = clock.tier;

  // The production notification adapter counts +0x14 at final-down 21 only.
  // Standalone scalar-session fixtures retain their earlier DoT event tally;
  // those fixtures do not execute the recovery handlers.
  for (const event of events) {
    if (event.type !== BATTLE_FRAME_EVENT_DEFEATED) continue;
    const team = battleTeamOfSlot(event.slot);
    // The bound notification adapter counts only final-down 21 (02112630).
    // A pending recovery is not yet a permanently removed team member.
    if(!session.onFrameEvents)session.downed[team] += 1;
  }

  const teams = battleTeamsFromRoster(session.slots, session.downed);
  // The ROM's wipe test is `downed >= count`, and its rosters always have three
  // members a side, so `count == 0` is outside the compare's domain. A fixture
  // with an empty side is not a battle the original can produce, and reading
  // 0 >= 0 as a wipe would be answering a question the ROM never asks.
  const populated = teams.every((team) => team.count > 0);
  const end = populated
    ? checkBattleEnd({ teams, frames: session.clock })
    : { ended: false, reason: BATTLE_OUTCOME_END_NONE, verdict: BATTLE_OUTCOME_RUNNING, phase: null };
  if (end.ended && !session.ended) {
    session.ended = true;
    session.endReason = end.reason;
    // 0x02110B5C demotes a level verdict before anything reads it.
    session.verdict = demoteLevelVerdict(end.verdict);
    events.push({
      type: BATTLE_SESSION_EVENT_BATTLE_ENDED,
      reason: end.reason,
      verdict: session.verdict,
      phase: end.phase,
      frames: session.clock
    });
  }

  session.frame += 1;
  return deepFreeze({ frame: session.frame, events: deepFreeze(events), ended: session.ended });
}

/**
 * Run frames and collect what happened. `frames` is a bound; the run also stops
 * when the battle ends, which battleOutcome now traces — a wipe, or the clock
 * passing 7200.
 */
export function runBattleSession(session, frames) {
  if (!Number.isSafeInteger(frames) || frames < 0) {
    throw sessionError("FRAMES_MUST_BE_A_NON_NEGATIVE_INTEGER");
  }
  const events = [];
  let ran = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const stepped = stepBattleSession(session);
    events.push(...stepped.events);
    ran += 1;
    if (stepped.ended) break;
  }
  return deepFreeze({
    frames: ran,
    bound: frames,
    ended: session.ended,
    reason: session.endReason,
    verdict: session.verdict,
    events: deepFreeze(events)
  });
}

/** Which seams a run hit, and how often. The inventory of what is left. */
export function summariseSeams(events) {
  // Only the named seams count. BATTLE_ENDED also carries a `reason` -- the
  // end-reason code, 1 for the clock and 2 for a wipe -- and once matches
  // started actually ending, a finished battle was being reported as a seam
  // numbered 2. A seam is one of the three this module declares, nothing else.
  const seamReasons = new Set(Object.values(BATTLE_SESSION_SEAMS).map((seam) => seam.reason));
  const counts = new Map();
  for (const event of events) {
    if (!event.reason || !seamReasons.has(event.reason)) {
      continue;
    }
    const key = event.reason === BATTLE_SESSION_SEAMS.UNTRACED_STATE_BODY.reason
      ? `${event.reason}:${event.state}`
      : event.reason;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return deepFreeze([...counts.entries()].sort().map(([seam, count]) => ({ seam, count })));
}

/** Every state the graph knows whose body this session can actually run. */
export const BATTLE_SESSION_RUNNABLE_STATES = deepFreeze([
  ...BATTLE_STATE_BODIES_TRANSLATED,
  BATTLE_STATE_ACTION_GATE,
  BATTLE_STATE_COOLDOWN_GATE
].sort((a, b) => a - b));
