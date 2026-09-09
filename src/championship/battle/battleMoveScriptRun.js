// Move script execution — the original's own bytecode, on the traced VM.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// Three pieces existed separately and never met: battleScriptVm decodes and
// executes the 52 opcodes, battleMoveScript traces which column a move runs and
// what its six-argument frame holds, and battle-script-blob.r1.json carries the
// segment those addresses point into. This joins them, so a committed action can
// run the script the original would have run for it.
//
// THE SEGMENT WAS ALREADY HERE
// ----------------------------
// Reachability was measured before anything was written. Decoding from all 36
// move-record entry points and following every in-range target visits 22,032 of
// the segment's 23,121 instructions and touches 63,747 of its 63,748 bytes, so
// there is no subset: running move scripts means carrying the whole segment.
//
// That was put to the Owner as a decision and authorized on 2026-09-02 -- and
// then the segment turned out to be in the tree already. battle-scripts.r1.json
// has carried it in `blob.base64` since the B2 pass, byte for byte the same
// 63,748 bytes, sha e089685d…. A second copy was written and deleted; this reads
// the one that was always here. The decision stands, it just ratified something
// rather than authorizing it.
//
// THE THREE COLUMNS
// -----------------
// battleMoveScript already traced them: +0x1C and +0x28 start on the VM at the
// object's +0xEC, and +0x3C starts on the array at +0x2A0 with six arguments.
// All three of a record's pointers land inside the segment -- 3 distinct values
// for +0x1C across 595 records, 31 for +0x28 across 565, 2 for +0x3C across 595.
//
// THE LAUNCH REWRITES TWO OF THEM FIRST  (OVL19 0x0211C198)
// ----------------------------------------------------------
//   0211C198  cmp   r0, #1
//   0211C19C  ldreq r1, [r2, #0x28]
//   0211C1A4  cmpeq r1, r0                 0x02124D82
//   0211C1AC  streq r0, [r2, #0x28]        becomes 0x02120D8A
//   0211C1B8  ldr   r1, [r2, #0x1c]
//   0211C1BC  cmp   r1, r0                 0x02120674
//   0211C1C8  cmpeq r1, r0                 and +0x28 is 0x02120D8A
//   0211C1D0  streq r0, [r2, #0x1c]        becomes 0x02120754
//
// The record is edited in place before the script starts, so a runner that reads
// the catalog straight would start the wrong address for those moves.
//
// THE NATIVES, AND THE ONE THAT MATTERS MOST
// ------------------------------------------
// battleScriptNatives implements all 67 bodies / 3,014 static call sites.
// Engine delegates and missing object edges remain separately reported.
//
// The one that unblocked everything is 0x0211E28C: sixteen bytes, no arguments,
// `bl 0x02054A24` and return 0 -- the per-frame yield. A caller stub that merely
// returned 0 for it left the script running inside one resume until the budget
// ran out, which looked like a decode fault and was not one. A battle script is
// written to span frames, and it only spans them if the yield yields.
//
// WHAT THIS STILL DOES NOT DO
// ---------------------------
// `memory` is a plain map scaffold. A caller with a populated original graph
// supplies `memoryAccess` for byte-address aliases and its own engine bindings.
// Neither interface invents the missing launch/effect pool or target choice.
// This is a HOST, not a claim of complete original object ownership.

import { deepFreeze } from "../contracts/championshipContracts.js";
import scriptCatalog from "../../data/championship/catalogs/battle-scripts.r1.json" with { type: "json" };
import {
  BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT,
  BATTLE_MOVE_SCRIPT_FRAME_1C,
  BATTLE_MOVE_SCRIPT_FRAME_28,
  BATTLE_MOVE_SCRIPT_Q12_SHIFT,
  buildMoveScriptArguments,
  getMoveScriptEntry
} from "./battleMoveScript.js";
import {
  createBattleScriptVm,
  initBattleScript,
  isBattleScriptActive,
  readBattleScriptArgument,
  runBattleScript,
  yieldBattleScript
} from "./battleScriptVm.js";
import { callBattleNative, describeBattleNative, isBattleNativeImplemented } from "./battleScriptNatives.js";
import { callBattleNativeMath } from './battleNativeMath.js';

export const BATTLE_SCRIPT_RUN_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_SCRIPT_REWRITE_SITE = "OVL19:0x0211C198";

/** The segment's RAM base, which is the origin every script address is read against. */
export const BATTLE_SCRIPT_BLOB_ORIGIN = Number.parseInt(scriptCatalog.blob.ramBase, 16);
export const BATTLE_SCRIPT_BLOB_END = Number.parseInt(scriptCatalog.blob.ramEnd, 16);
export const BATTLE_SCRIPT_BLOB_LENGTH = scriptCatalog.blob.byteLength;
export const BATTLE_SCRIPT_BLOB_INSTRUCTIONS = scriptCatalog.blob.instructionCount;

/** The three literals the launch compares and substitutes at 0x0211C198. */
export const BATTLE_SCRIPT_REWRITES = deepFreeze([
  { field: "pointer28", whenField0C: 1, from: 0x02124d82, to: 0x02120d8a, site: "OVL19:0x0211C1AC" },
  { field: "pointer1C", whenPointer28: 0x02120d8a, from: 0x02120674, to: 0x02120754, site: "OVL19:0x0211C1D0" },
  { field: "pointer28", whenField0C: 2, from: 0x02120d8a, to: 0x02124d82, site: "OVL19:0x0211C194" }
]);

let decodedBlob = null;

/** The segment's bytes, decoded once. */
export function battleScriptBlob() {
  if (decodedBlob === null) {
    const binary = atob(scriptCatalog.blob.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (bytes.length !== BATTLE_SCRIPT_BLOB_LENGTH) {
      throw runError("BLOB_LENGTH_MISMATCH");
    }
    decodedBlob = bytes;
  }
  return decodedBlob;
}

function runError(message) {
  return new Error(`BATTLE_SCRIPT_RUN_${message}`);
}

/** `lsl #0xc` on a byte already widened by ldrsb or ldrb. */
function toQ12(value) {
  return (value | 0) << BATTLE_MOVE_SCRIPT_Q12_SHIFT;
}

/** The `/ 100` the 0x51EB851F magic with asr #5 performs, toward zero. */
function per100(value) {
  return Math.trunc(((value | 0) << BATTLE_MOVE_SCRIPT_Q12_SHIFT) / 100);
}

/**
 * Build one column's argument frame from its traced slot table.
 *
 * `object` and `owner` are the in-flight object and its owner, which the caller
 * supplies; every other slot comes off the move record. A slot whose source this
 * lane has not resolved to a caller value stays zero and is named in the result,
 * so an empty frame can never again look like a working one.
 */
function buildFrame(entry, record, input) {
  if (entry.argumentCount === BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT) {
    return buildMoveScriptArguments({
      pointer0: input.pointer0 ?? 0,
      pointer1: input.pointer1 ?? 0,
      actionObject: input.actionObject ?? 0,
      field40: record.field40 ?? 0,
      field41: record.field41 ?? 0,
      field43: record.field43 ?? 0,
      bases: input.bases ?? [0, 0]
    });
  }
  const table = entry.field === "pointer1C" ? BATTLE_MOVE_SCRIPT_FRAME_1C : BATTLE_MOVE_SCRIPT_FRAME_28;
  const object = input.inFlightObject ?? input.actionObject ?? 0;
  const memory = input.memory instanceof Map ? input.memory : null;
  const readObject = (offset) => input.memoryAccess?.readU32(object,offset)
    ?? (memory ? memory.get(`${object}:${offset}`) ?? 0 : 0);

  return table.map((slot) => {
    switch (slot.source) {
      case "INFLIGHT_OBJECT": return object;
      case "PRELUDE_ACTOR": return input.preludeActor ?? 0;
      case "ACTION_OBJECT": return input.actionObject ?? 0;
      case "OBJECT_FIELD": return readObject(slot.objectField);
      case "MOVE_FIELD_S8_Q12": return toQ12(signedByte(record[fieldName(slot.moveField)] ?? 0));
      case "MOVE_FIELD_U8_Q12": return toQ12((record[fieldName(slot.moveField)] ?? 0) & 0xff);
      case "MOVE_FIELD_U16_Q12_PER_100": return per100((record[fieldName(slot.moveField)] ?? 0) & 0xffff);
      // `lsl #0x18 / lsr #0xc` keeps the low byte and lands it twelve up.
      case "MOVE_FIELD_U16_SHIFTED": return (((record[fieldName(slot.moveField)] ?? 0) << 24) >>> 12) | 0;
      default: return input[slot.source] ?? 0;
    }
  });
}

function fieldName(offset) {
  return `field${offset.toString(16).toUpperCase().padStart(2, "0")}`;
}

function signedByte(value) {
  const byte = value & 0xff;
  return byte > 0x7f ? byte - 0x100 : byte;
}

/** Whether an address lands inside the segment the VM can execute. */
export function isInsideScriptBlob(address) {
  return Number.isSafeInteger(address)
    && address >= BATTLE_SCRIPT_BLOB_ORIGIN
    && address < BATTLE_SCRIPT_BLOB_END;
}

/**
 * OVL19 0x0211C198. The launch edits a record's script pointers before starting
 * them, so this returns the addresses a run should actually use.
 */
export function rewriteMoveScriptPointers(record) {
  if (!record || typeof record !== "object") {
    throw runError("RECORD_REQUIRED");
  }
  let pointer1C = record.pointer1C ?? 0;
  let pointer28 = record.pointer28 ?? 0;
  const applied = [];

  // `cmp r0,#1` on the record's +0x0C, then the +0x28 literal swap.
  if ((record.field0C ?? 0) === 1 && pointer28 === BATTLE_SCRIPT_REWRITES[0].from) {
    pointer28 = BATTLE_SCRIPT_REWRITES[0].to;
    applied.push(BATTLE_SCRIPT_REWRITES[0].field);
  }
  if ((record.field0C ?? 0) === 2 && pointer28 === BATTLE_SCRIPT_REWRITES[2].from) {
    pointer28=BATTLE_SCRIPT_REWRITES[2].to;
    applied.push('pointer28');
  }
  // The second test reads +0x28 AFTER the first store, so order matters.
  if (pointer1C === BATTLE_SCRIPT_REWRITES[1].from && pointer28 === BATTLE_SCRIPT_REWRITES[1].whenPointer28) {
    pointer1C = BATTLE_SCRIPT_REWRITES[1].to;
    applied.push(BATTLE_SCRIPT_REWRITES[1].field);
  }
  return deepFreeze({ pointer1C, pointer28, pointer3C: record.pointer3C ?? 0, applied: deepFreeze(applied) });
}

/**
 * Start and run one of a move's script columns.
 *
 * `callNative(address, args)` is the caller's; the VM hands it the resolved
 * routine address. `budget` bounds a single resume, and `frames` bounds how many
 * times a yielded script is resumed, because a battle script is written to run
 * across frames and will not finish inside one.
 */
export function runMoveScript(input) {
  if (!input || typeof input !== "object") {
    throw runError("REQUIRES_AN_OBJECT");
  }
  const record = input.record;
  if (!record || typeof record !== "object") {
    throw runError("RECORD_REQUIRED");
  }
  const field = input.field ?? "pointer3C";
  const entry = getMoveScriptEntry(field);
  const rewritten = rewriteMoveScriptPointers(record);
  const address = rewritten[field];
  if (!isInsideScriptBlob(address)) {
    return deepFreeze({ started: false, reason: "NO_SCRIPT_ON_THIS_COLUMN", address, field });
  }

  const args = input.args ?? buildFrame(entry, record, input);

  const calls = [];
  const memory = input.memory instanceof Map ? input.memory : new Map();
  // A battle script spans frames, and the object it belongs to carries its VM:
  // one at +0xEC and four at +0x2A0. A runner that built a fresh VM every frame
  // would restart the script from the top each time and fire whatever it does
  // once per frame instead of once. `state` is where a caller keeps it.
  const state = input.state && typeof input.state === "object" ? input.state : null;
  const unimplemented = new Set();
  // Natives that ARE translated but need a real object graph to run. The
  // scaffold memory below has none, so a walk into the animation runtime stops
  // here rather than returning a number nobody traced.
  const needsObjectGraph = new Set();
  const unresolvedHostCalls = new Set();
  let vm = null;

  // The host battleScriptNatives asks for. The reads and writes go to a plain
  // map: this is scaffolding for the object graph, not a model of it.
  const host = {
    vmAddress: input.vmAddress,
    readArgument: index => readBattleScriptArgument(vm,index),
    readU32: (base, offset) => memory.get(`${base}:${offset}`) ?? 0,
    readU8: (base, offset) => (memory.get(`${base}:${offset}`) ?? 0) & 0xff,
    readU16: (base, offset) => (memory.get(`${base}:${offset}`) ?? 0) & 0xffff,
    readS16: (base, offset) => (((memory.get(`${base}:${offset}`) ?? 0) << 16) >> 16),
    writeU32: (base, offset, value) => { memory.set(`${base}:${offset}`, value | 0); },
    writeU8: (base, offset, value) => { memory.set(`${base}:${offset}`, value & 0xff); },
    call: (routine, ...rest) => {
      const math = callBattleNativeMath(routine, rest, host);
      if (math !== undefined) return math;
      const value=input.callNative?.(routine,rest);
      if(value===undefined || value===null)unresolvedHostCalls.add(routine);
      return value??0;
    },
    yield: () => { yieldBattleScript(vm); }
  };
  if (input.memoryAccess !== undefined) {
    for (const key of ['readU32','readU8','readU16','readS16','writeU32','writeU8']) {
      if (typeof input.memoryAccess?.[key] !== 'function') throw runError('MEMORY_ACCESS_MISSING_'+key);
      host[key] = input.memoryAccess[key];
    }
  }

  const resuming = state?.vm != null && isBattleScriptActive(state.vm);
  vm = resuming ? state.vm : createBattleScriptVm({objectBase: input.objectBase ?? 0});
    // The VM hands over the routine address and ITSELF, which is how the ROM
    // works too: 0x02054A34 takes the vm and an index, and each native reads its
    // own arguments off the frame. So the arity comes from the catalog and the
    // values come from the VM, exactly as they do in the original.
  vm.callNative = (routine, runningVm) => {
      const described = describeBattleNative(routine);
      const arity = described?.argumentCount ?? 0;
      const args = [];
      for (let index = 0; index < arity; index += 1) {
        args.push(readBattleScriptArgument(runningVm, index));
      }
      calls.push({ routine, args });
      if (isBattleNativeImplemented(routine)) {
        try {
          return callBattleNative(routine, args, host) ?? 0;
        } catch (caught) {
          if (!String(caught.message).startsWith("BATTLE_NATIVE_NEEDS_OBJECT_GRAPH")) {
            throw caught;
          }
          needsObjectGraph.add(routine);
          return typeof input.callNative === "function" ? input.callNative(routine, args) ?? 0 : 0;
        }
      }
      unimplemented.add(routine);
      return typeof input.callNative === "function" ? input.callNative(routine, args) ?? 0 : 0;
  };
  if (!resuming) {
    initBattleScript(vm, address, args);
    if (state) state.vm = vm;
  }

  const blob = battleScriptBlob();
  const frames = input.frames ?? 1;
  const budget = input.budget ?? 20000;
  let steps = 0;
  let error = null;
  let resumed = 0;
  try {
    while (resumed < frames && isBattleScriptActive(vm)) {
      steps += runBattleScript(vm, blob, BATTLE_SCRIPT_BLOB_ORIGIN, budget);
      resumed += 1;
    }
  } catch (caught) {
    error = caught.message;
  }

  return deepFreeze({
    started: true,
    resumed: resuming,
    field,
    address,
    vmOffset: entry.vmOffset,
    argumentCount: args.length,
    steps,
    resumeCount: resumed,
    active: isBattleScriptActive(vm),
    error,
    // The VM's second argument is whatever its CALL_NATIVE handler passes; it is
    // not always an array, so it is carried through rather than reshaped.
    calls: deepFreeze(calls.map((call) => deepFreeze({
      routine: call.routine,
      args: call.args === null ? null : deepFreeze([...call.args])
    }))),
    routines: deepFreeze([...new Set(calls.map((call) => call.routine))].sort((a, b) => a - b)),
    // Which routines the script wanted that nobody could run. This is the list
    // that shrinks as natives are read, and the honest measure of how far a
    // script's behaviour is the original's.
    unimplemented: deepFreeze([...unimplemented].sort((a, b) => a - b)),
    // Translated, but they walk an object graph this scaffold does not hold.
    // Distinct from `unimplemented`: the routine is read, the caller is what is
    // missing, and supplying a populated memory map is all it takes.
    needsObjectGraph: deepFreeze([...needsObjectGraph].sort((a, b) => a - b)),
    unresolvedHostCalls: deepFreeze([...unresolvedHostCalls].sort((a,b)=>a-b))
  });
}
