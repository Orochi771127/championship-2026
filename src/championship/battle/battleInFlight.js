// In-flight objects — how a launched action reaches the roster.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// State 15 allocates an object out of the twelve-object pool and puts it in one
// of the combatant's three slots. This is what happens to it afterwards, and it
// is the last link in the chain from a frame to damage.
//
// THE TWO PER-FRAME WALKS
// -----------------------
// The frame has two alternative pool walks. D478 selects one; D5F8 prevents
// the exclusive walk from falling through into the ordinary walk.
//
//   0210D464  ldr   r0, [r0, #0x138]
//   0210D46C  rsb   r0, r1, r0, lsl #29
//   0210D470  adds  r0, r1, r0, ror #29    a signed remainder
//   0210D474  bne   #0x210da00             skipped unless it is zero
//   0210D488  mov   r5, r4                 0
//   0210D48C  mov   r6, #1                 1
//   0210D4AC  ldr   r1, [r0, #0xe4]
//   0210D4B0  ldr   r1, [r1, #0x94]        the OWNER's lock
//   0210D4B8  movne r1, r6
//   0210D4BC  moveq r1, r5
//   0210D4C4  beq   #0x210d4cc             an unengaged owner is skipped
//   0210D4C8  bl    #0x211cc7c
//
// The remainder idiom was checked numerically rather than read: it is x % 8, so
// the nonzero slowdown counter admits only multiples of eight (zero admits
// every frame). After that gate, any +94 lock selects the exclusive D490 walk;
// otherwise D694 updates every in-use object. Engaged objects are NOT updated
// twice. R13 original ARM D478 branch receipts supersede that earlier reading.
//
//   0210D694  add  r0, sl, r4, lsl #2
//   0210D69C  ldr  r0, [r0, #0x948]     pool[i], globalCtx + 0x47948 + i*4
//   0210D6A8  lsrs r1, r1, #0x1f        bit 0, the in-use flag
//   0210D6B0  bl   #0x211cc7c
//   0210D6B8  cmp  r4, #0xc
//
// ENGAGEMENT STOPS THE STATE DISPATCH
// -----------------------------------
//   0210FA34  ldr   r1, [r1, #0xe20]    roster[slot], battleCtx + 0x5E20 + s*4
//   0210FA3C  ldrne r1, [r1, #0x94]
//   0210FA44  movne r0, #1              anyone engaged: yes
//   0210FA50  cmp   r2, #6
//
//   0210D664  bl    #0x21156f8          dispatch this slot's state
//   0210D678  bl    #0x210fa28
//   0210D680  bne   #0x210d690          and leave the loop
//
// The dispatch loop asks after every slot and breaks out the moment anyone is
// engaged. So the six slots do not all act on a frame where one of them commits;
// the rest wait for the next frame. This is not a fairness rule the remake may
// smooth over — it is the order the original plays in.
//
// THE UPDATE, AND WHERE DAMAGE COMES FROM
// ---------------------------------------
//   0211CC84  ldr  r0, [r4, #0xe4]      the owner
//   0211CC8C  popeq                     an orphaned object does nothing
//   0211CC90  ldr  r0, [r0, #0x94]
//   0211CC98  cmpne r0, r4
//   0211CC9C  popne                     the owner's lock must be null or this
//   0211CCA0  ldr  r0, [r4, #4]         the object's kind
//   0211CCC4  bl   #0x211c714           kind 0: the contact walk
//   0211CCD0  bl   #0x211cba4           kind 1
//   0211CCDC  bl   #0x211cc18           kind 2
//                                        anything else: the common tail
//
// Kind 0's update IS battleContactTargeting's walk, and that routine calls the
// damage resolver at 0x0211C92C. Nothing in the state machine ever calls the
// resolver, and it never needed to.
//
// CORRECTION: this walk is NOT the main damage path
// -------------------------------------------------
// An earlier revision of this comment said the chain closed here. It does not.
// The contact walk proceeds only for move records whose +0x50 is 2 or 3 (`sub
// #2 / cmp #1 / bhi` at 0x0211C770), and the resolver's own switch at
// 0x021149E8 sends those two kinds somewhere other than the curve-and-power
// term. Of the 596 move records, 27 are kind 2 and 3 are kind 3, and their
// powers are only 0 or 15.
//
// The 566 moves with real power are kinds 0 and 1, and they reach the resolver
// through its other two callers, 0x0211D9E0 and 0x0211D9FC, both inside the
// script native at 0x0211D71C. So the ordinary attack is resolved by a MOVE
// SCRIPT running on the VM, and this walk is a smaller sibling of it.
// battleDamageInputs carries the routing table.
//
// TWO FIELDS THAT NOW READ THE SAME EVERYWHERE
// --------------------------------------------
// +0xE4 is the owner. battleActionApplication reads the attacker as the action
// object's +0xE4, which is the same field on the same object -- an in-flight
// object and the "action object" a move script operates on are one thing.
//
// +0x94 on the OWNER is a lock naming one in-flight object. The update refuses
// unless the lock is null or names this object. battleActionApplication's fourth
// target rejection tests the same field from the other side: an attacker with a
// non-zero +0x94 skips any target whose own +0x94 is zero. And the engagement
// test above reads that same lock across all six slots, which is what makes
// "engaged" and "holding an in-flight object" the same statement.
//
// FIVE SCRIPTS PER OBJECT
// -----------------------
// Kinds 1 and 2 are not a second damage path. They step scripts.
//
//   0211CBAC  add r0, r6, #0xec
//   0211CBB0  bl  #0x2054980            step the primary script
//   0211CBB4  add r5, r6, #0x2a0
//   0211CBC0  bl  #0x2054980            step this one
//   0211CBC8  bl  #0x2054a4c            still running?
//   0211CBDC  bl  #0x211cd80            no: release what it held
//   0211CBE4  cmp r4, #4
//   0211CBE8  add r5, r5, #0x1b4
//
// So an object carries five script VMs: one at +0xEC and four in an array at
// +0x2A0 with stride 0x1B4. Kind 1 steps all five. Kind 2 steps only the four
// and remembers whether any of them stayed running (0x0211CC44). Whether a VM is
// running is bit 0 of its +0x190, which is the same word 0x02054980 tests before
// it will step at all.
//
// WHAT A FINISHED SCRIPT RELEASES  (0x0211CD80)
// ---------------------------------------------
//   0211CD9C  ldr   r2, [r4, #0x84]     which script owns handle i
//   0211CDA0  cmp   r2, r1
//   0211CDA8  ldr   r8, [r4, #0x24]     the handle itself
//   0211CDB8  strb  r5, [r8, #0x5b]     switched off
//   0211CDC0  ldr   r2, [r4, #0x970]
//   0211CDC8  streq lr, [r4, #0x970]    and unbound
//
// and the common tail walks the same handles:
//
//   0211CCF0  ldr   r0, [r0, #0x24]
//   0211CCF8  ldrbne r1, [r0, #0x5b]
//   0211CD20  cmp   r7, #0x18           twenty-four of them
//
// Three parallel arrays of twenty-four, indexed together: the handle at +0x24,
// the script that owns it at +0x84, a binding at +0x970. This is the presentation
// side of an action, which is why the natives this lane ranked by size turned out
// to be drawing work. It is recorded for its shape; what a handle draws is not
// decided here.
//
// THE LOOPS THAT ARE STILL ONLY ADDRESSES
// ---------------------------------------
// Seven of the eleven frame loops are not translated. They are listed with the
// routines they call, so the next pass starts from a fact rather than a search,
// and so nobody mistakes an unlisted loop for a loop that does not exist. What
// they do is NOT claimed here -- a call target is not a meaning.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What the scripts inside kinds 1 and 2 do — they are data, and a script may
// call any native, so "kind 1 cannot hurt anyone" is NOT claimed. What a handle
// at +0x24 is. What the object's +0x04 kind means beyond the dispatch. And what
// the counter at +0x1F138 that paces the first walk counts.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_INFLIGHT_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_INFLIGHT_WALK_SITE = "OVL19:0x0210D694";
export const BATTLE_INFLIGHT_UPDATE_SITE = "OVL19:0x0211CC7C";

/** cmp r4,#0xC — the whole pool is walked every frame. */
export const BATTLE_INFLIGHT_WALK_COUNT = 12;

/** Object offsets the update reads. */
export const BATTLE_INFLIGHT_KIND_OFFSET = 0x04;
export const BATTLE_INFLIGHT_OWNER_OFFSET = 0xe4;
/** On the OWNER, not the object. */
export const BATTLE_INFLIGHT_OWNER_LOCK_OFFSET = 0x94;

/** The kind dispatch at 0x0211CCA0. */
export const BATTLE_INFLIGHT_KINDS = deepFreeze([
  { kind: 0, handler: 0x0211c714, name: "CONTACT_WALK", traced: true },
  { kind: 1, handler: 0x0211cba4, name: "STEP_ALL_FIVE_SCRIPTS", traced: true },
  { kind: 2, handler: 0x0211cc18, name: "STEP_FOUR_SCRIPTS", traced: true }
]);

/** Anything else falls into the shared tail. */
export const BATTLE_INFLIGHT_COMMON_TAIL = 0x0211cce0;

/** The resolver call inside the contact walk, the end of the whole chain. */
export const BATTLE_INFLIGHT_DAMAGE_SITE = "OVL19:0x0211C92C";

/** The first walk, its gate, and the pace it runs at. */
export const BATTLE_INFLIGHT_FIRST_WALK_SITE = "OVL19:0x0210D490";
/** `x % 8`, proven numerically rather than read off the shift idiom. */
export const BATTLE_INFLIGHT_FIRST_WALK_PERIOD = 8;

/** The engagement test and the dispatch loop that breaks on it. */
export const BATTLE_INFLIGHT_ENGAGED_SITE = "OVL19:0x0210FA28";
export const BATTLE_INFLIGHT_DISPATCH_BREAK_SITE = "OVL19:0x0210D678";
export const BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT = 6;

/** The five script VMs an object carries. */
export const BATTLE_INFLIGHT_SCRIPT_STEP_SITE = "ARM9:0x02054980";
export const BATTLE_INFLIGHT_SCRIPT_ACTIVE_SITE = "ARM9:0x02054A4C";
export const BATTLE_INFLIGHT_SCRIPT_ACTIVE_OFFSET = 0x190;
export const BATTLE_INFLIGHT_SCRIPT_ACTIVE_BIT = 1;
export const BATTLE_INFLIGHT_PRIMARY_SCRIPT_OFFSET = 0xec;
export const BATTLE_INFLIGHT_SCRIPT_ARRAY_OFFSET = 0x2a0;
export const BATTLE_INFLIGHT_SCRIPT_ARRAY_STRIDE = 0x1b4;
export const BATTLE_INFLIGHT_SCRIPT_ARRAY_COUNT = 4;

/** The release hook and the three parallel handle arrays. */
export const BATTLE_INFLIGHT_SCRIPT_FINISHED_SITE = "OVL19:0x0211CD80";
export const BATTLE_INFLIGHT_HANDLE_COUNT = 24;
export const BATTLE_INFLIGHT_HANDLE_OFFSET = 0x24;
export const BATTLE_INFLIGHT_HANDLE_OWNER_OFFSET = 0x84;
export const BATTLE_INFLIGHT_HANDLE_BINDING_OFFSET = 0x970;
/** A byte on the handle, cleared when its script finishes. */
export const BATTLE_INFLIGHT_HANDLE_ENABLED_OFFSET = 0x5b;

/**
 * Every loop the frame function at 0x0210D33C runs, in address order, with its
 * bound. Four are translated; the rest are listed for their order alone. An
 * earlier reading of this lane named only two and missed the in-flight walk
 * sitting between them.
 */
export const BATTLE_FRAME_LOOPS = deepFreeze([
  { site: 0x0210d3c0, bound: 6, phase: null, calls: deepFreeze([]) },
  { site: 0x0210d490, bound: 12, phase: "INFLIGHT_UPDATE_ENGAGED", calls: deepFreeze([0x0211cc7c]) },
  { site: 0x0210d4f8, bound: 6, phase: null, calls: deepFreeze([0x02064e20, 0x0210f5d8, 0x02112980, 0x02112d18]) },
  { site: 0x0210d590, bound: 6, phase: null, calls: deepFreeze([0x0210de60, 0x0210ed70, 0x02111910, 0x02111b04, 0x02119d68, 0x0211b228, 0x0211b54c]) },
  { site: 0x0210d624, bound: 2, phase: null, calls: deepFreeze([0x0211240c]) },
  { site: 0x0210d644, bound: 6, phase: "STATE_DISPATCH", calls: deepFreeze([0x021156f8, 0x02112980, 0x0210fa28]) },
  { site: 0x0210d694, bound: 12, phase: "INFLIGHT_UPDATE", calls: deepFreeze([0x0211cc7c]) },
  { site: 0x0210d6e4, bound: 6, phase: "STATUS_AND_COUNTERS", calls: deepFreeze([]) },
  { site: 0x0210d9a8, bound: 6, phase: null, calls: deepFreeze([0x0210ec14, 0x02111910, 0x02111b04, 0x02119d68, 0x0211b228]) },
  { site: 0x0210dc58, bound: 6, phase: null, calls: deepFreeze([0x020472c4, 0x02089f48]) },
  { site: 0x0210dd18, bound: 2, phase: null, calls: deepFreeze([0x0207c488]) }
]);

export const BATTLE_INFLIGHT_SKIP_ORPHANED = "ORPHANED";
export const BATTLE_INFLIGHT_SKIP_LOCKED = "OWNER_LOCKED_ELSEWHERE";
export const BATTLE_INFLIGHT_SKIP_IDLE = "NOT_IN_USE";
export const BATTLE_INFLIGHT_SKIP_UNENGAGED = "OWNER_NOT_ENGAGED";
export const BATTLE_INFLIGHT_RUN = "UPDATED";

export const BATTLE_INFLIGHT_SCRIPT_STEPPED = "STEPPED";
export const BATTLE_INFLIGHT_SCRIPT_FINISHED = "FINISHED";
export const BATTLE_INFLIGHT_SCRIPT_DORMANT = "DORMANT";

function inFlightError(message) {
  return new Error(`BATTLE_INFLIGHT_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw inFlightError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** Which handler a kind reaches, or null for the shared tail. */
export function inFlightHandlerForKind(kind) {
  requireInteger(kind, "KIND");
  const entry = BATTLE_INFLIGHT_KINDS.find((item) => item.kind === kind);
  return entry ? entry.handler : null;
}

/**
 * OVL19 0x0211CC7C. `object` carries its kind and owner; `ownerLock` is the
 * owner's +0x94. Reports what the update would do rather than doing it, since
 * what a script does is data.
 */
export function updateInFlightObject(object) {
  if (!object || typeof object !== "object") {
    throw inFlightError("UPDATE_REQUIRES_AN_OBJECT");
  }
  const owner = object.owner ?? null;
  if (!owner) {
    // `cmp r0,#0 / popeq` — no owner, nothing happens.
    return deepFreeze({ outcome: BATTLE_INFLIGHT_SKIP_ORPHANED, kind: null, handler: null });
  }
  const lock = object.ownerLock ?? null;
  if (lock !== null && lock !== 0 && lock !== object.self) {
    // `cmp r0,#0 / cmpne r0,r4 / popne` — a lock naming something else stops it.
    return deepFreeze({ outcome: BATTLE_INFLIGHT_SKIP_LOCKED, kind: null, handler: null });
  }
  const kind = requireInteger(object.kind ?? 0, "KIND");
  return deepFreeze({
    outcome: BATTLE_INFLIGHT_RUN,
    kind,
    handler: inFlightHandlerForKind(kind),
    tail: inFlightHandlerForKind(kind) === null ? BATTLE_INFLIGHT_COMMON_TAIL : null
  });
}

/**
 * The frame's second in-flight phase at 0x0210D694: walk all twelve, update the
 * in-use ones. `pool` is twelve entries, each null for a free slot or an object.
 */
export function stepInFlightPhase(pool) {
  if (!Array.isArray(pool) || pool.length !== BATTLE_INFLIGHT_WALK_COUNT) {
    throw inFlightError(`POOL_MUST_BE_${BATTLE_INFLIGHT_WALK_COUNT}_LONG`);
  }
  return deepFreeze(pool.map((object, index) => {
    if (!object || !object.inUse) {
      return deepFreeze({ index, outcome: BATTLE_INFLIGHT_SKIP_IDLE, kind: null, handler: null });
    }
    return deepFreeze({ index, ...updateInFlightObject(object) });
  }));
}

/** `+0x1F138 % 8 == 0` — the first walk runs on one frame in eight. */
export function firstInFlightWalkRuns(counter) {
  const value = requireInteger(counter, "COUNTER");
  const remainder = value % BATTLE_INFLIGHT_FIRST_WALK_PERIOD;
  return remainder === 0;
}

/**
 * The frame's FIRST in-flight phase at 0x0210D490. Same update, one extra gate:
 * the owner must be engaged. Callers decide whether the frame runs it at all
 * with firstInFlightWalkRuns.
 */
export function stepEngagedInFlightPhase(pool) {
  if (!Array.isArray(pool) || pool.length !== BATTLE_INFLIGHT_WALK_COUNT) {
    throw inFlightError(`POOL_MUST_BE_${BATTLE_INFLIGHT_WALK_COUNT}_LONG`);
  }
  return deepFreeze(pool.map((object, index) => {
    if (!object || !object.inUse) {
      return deepFreeze({ index, outcome: BATTLE_INFLIGHT_SKIP_IDLE, kind: null, handler: null });
    }
    // 0x0210D4AC dereferences +0xE4 without a null test: an in-use object is
    // assumed to have an owner. Modelled as unengaged rather than as a fault.
    const lock = object.owner ? object.ownerLock ?? null : null;
    if (lock === null || lock === 0) {
      return deepFreeze({ index, outcome: BATTLE_INFLIGHT_SKIP_UNENGAGED, kind: null, handler: null });
    }
    return deepFreeze({ index, ...updateInFlightObject(object) });
  }));
}

/** Bit 0 of a VM's +0x190 — what 0x02054A4C returns and 0x02054980 checks. */
export function scriptIsActive(flagWord) {
  return (requireInteger(flagWord ?? 0, "SCRIPT_FLAGS") & BATTLE_INFLIGHT_SCRIPT_ACTIVE_BIT) !== 0;
}

/**
 * Kinds 1 and 2. `scripts` is the four-entry array at +0x2A0, each entry an
 * object with a `flags` word; `primary` is the VM at +0xEC. Kind 1 steps the
 * primary as well; kind 2 steps only the four and reports whether any survived.
 *
 * A step is only attempted on an active VM — 0x02054980 returns immediately
 * otherwise — and a VM that has gone inactive reaches 0x0211CD80.
 */
export function stepInFlightScripts(input) {
  if (!input || typeof input !== "object") {
    throw inFlightError("SCRIPT_STEP_REQUIRES_AN_OBJECT");
  }
  const kind = requireInteger(input.kind, "KIND");
  if (kind !== 1 && kind !== 2) {
    throw inFlightError("SCRIPT_STEP_IS_KIND_1_OR_2");
  }
  const scripts = input.scripts;
  if (!Array.isArray(scripts) || scripts.length !== BATTLE_INFLIGHT_SCRIPT_ARRAY_COUNT) {
    throw inFlightError(`SCRIPT_ARRAY_MUST_BE_${BATTLE_INFLIGHT_SCRIPT_ARRAY_COUNT}_LONG`);
  }

  const steps = scripts.map((script, index) => {
    const active = scriptIsActive(script?.flags ?? 0);
    return deepFreeze({
      index,
      offset: BATTLE_INFLIGHT_SCRIPT_ARRAY_OFFSET + index * BATTLE_INFLIGHT_SCRIPT_ARRAY_STRIDE,
      stepped: active,
      outcome: active ? BATTLE_INFLIGHT_SCRIPT_STEPPED : BATTLE_INFLIGHT_SCRIPT_FINISHED,
      released: !active
    });
  });

  return deepFreeze({
    kind,
    // 0x0211CBAC only exists on kind 1's path.
    primary: kind === 1
      ? deepFreeze({
        offset: BATTLE_INFLIGHT_PRIMARY_SCRIPT_OFFSET,
        stepped: scriptIsActive(input.primary?.flags ?? 0),
        outcome: scriptIsActive(input.primary?.flags ?? 0) ? BATTLE_INFLIGHT_SCRIPT_STEPPED : BATTLE_INFLIGHT_SCRIPT_DORMANT
      })
      : null,
    scripts: deepFreeze(steps),
    // 0x0211CC44 `movne r5, r4` — kind 2's only reported result.
    anyActive: kind === 2 ? steps.some((entry) => entry.stepped) : null,
    released: deepFreeze(steps.filter((entry) => entry.released).map((entry) => entry.index))
  });
}

/**
 * OVL19 0x0211CD80. Every handle the finished script owned is switched off, and
 * any binding that still named it is cleared. `handles` is the twenty-four-entry
 * view: `{ handle, owner, binding }` per index.
 */
export function releaseScriptHandles(handles, script) {
  if (!Array.isArray(handles) || handles.length !== BATTLE_INFLIGHT_HANDLE_COUNT) {
    throw inFlightError(`HANDLES_MUST_BE_${BATTLE_INFLIGHT_HANDLE_COUNT}_LONG`);
  }
  const released = [];
  const next = handles.map((entry, index) => {
    const slot = entry ?? {};
    // `ldr r2,[r4,#0x84] / cmp r2,r1 / bne` — only this script's handles.
    if (slot.owner !== script) return deepFreeze({ ...slot });
    // `ldr r8,[r4,#0x24] / cmp r8,#0 / beq` — an empty handle is skipped.
    if (!slot.handle) return deepFreeze({ ...slot });
    released.push(index);
    return deepFreeze({
      ...slot,
      enabled: 0,
      binding: slot.binding === slot.handle ? 0 : slot.binding ?? 0
    });
  });
  return deepFreeze({ handles: deepFreeze(next), released: deepFreeze(released) });
}

/**
 * OVL19 0x0210FA28. True when any of the six roster slots holds a non-zero
 * +0x94 — that is, has an in-flight object it is committed to.
 */
export function anyCombatantEngaged(roster) {
  if (!Array.isArray(roster) || roster.length !== BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT) {
    throw inFlightError(`ROSTER_MUST_BE_${BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT}_LONG`);
  }
  for (const combatant of roster) {
    if (!combatant) continue;
    const lock = combatant.lock ?? 0;
    if (lock !== 0 && lock !== null) return true;
  }
  return false;
}

/**
 * OVL19 0x0210D644's loop. Each occupied slot dispatches, then the frame asks
 * whether anyone is engaged and stops if so. `dispatch(combatant, index)` is the
 * caller's state step; it may set a lock, which ends the walk after it.
 */
export function stepStateDispatchWalk(roster, dispatch) {
  if (!Array.isArray(roster) || roster.length !== BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT) {
    throw inFlightError(`ROSTER_MUST_BE_${BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT}_LONG`);
  }
  if (typeof dispatch !== "function") {
    throw inFlightError("DISPATCH_MUST_BE_A_FUNCTION");
  }
  const visited = [];
  for (let index = 0; index < BATTLE_INFLIGHT_ENGAGED_SLOT_COUNT; index += 1) {
    const combatant = roster[index];
    // `cmp r0,#0 / beq` — an empty slot is skipped without asking again.
    if (!combatant) continue;
    visited.push({ index, result: dispatch(combatant, index) ?? null });
    if (anyCombatantEngaged(roster)) {
      return deepFreeze({ visited: deepFreeze(visited.map((e) => deepFreeze(e))), stoppedAfter: index });
    }
  }
  return deepFreeze({ visited: deepFreeze(visited.map((e) => deepFreeze(e))), stoppedAfter: null });
}
