// Script natives — the 67 routines a move's bytecode calls out to.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// CALL_NATIVE is the most common instruction in the battle scripts: 3,014 of
// their 23,121 instructions, reaching 67 distinct OVL19 routines between
// 0x0211CDFC and 0x0211EA68. Together they are 7,788 bytes, but the shape is
// lopsided — four routines are half of that and the other sixty-three average
// sixty bytes apiece.
//
// TWO LAYERS, AND WHICH IS WHICH
// ------------------------------
// The catalog holds all 67, extracted mechanically: how many script arguments
// each reads, every offset it loads or stores and at what width, what it calls,
// whether it yields. No routine is named there, the way B1 named no move field
// it had not traced.
//
// This module implements all 67 bodies, covering all 3,014 static call sites.
// Each body's source and bounds are retained; implementing a body does not
// establish the runtime ownership of actors and effects passed to its host.
//
// THE HOST
// --------
// These routines dereference real objects, and a JavaScript rebuild has no raw
// addresses. Every implemented native therefore takes a `host` that supplies the
// object graph: `readU32(object, offset)`, `readU8`, `writeU32`, `writeU8`, plus
// `call(address, ...)` for the two that tail-call somewhere unread and `yield()`
// for the one that gives up the frame. The arithmetic, the offsets, the null
// guards and the Q12 shifts are the ROM's; the graph is the caller's.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What any of them means. `native0x0211CE7C` reads +0x2C then +0x00 and returns
// it; that is all that is claimed. Translated delegates still require their
// engine-host bindings; body coverage is not complete encounter acceptance.

import nativeDocument from "../../data/championship/catalogs/battle-natives.r1.json" with { type: "json" };
import { BATTLE_REMAINING_NATIVES } from "./battleRemainingNatives.js";
import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  cellBoxExtentY,
  readCellRecordBox,
  readSpriteCellBox
} from "./battleSpriteCellBox.js";
import {
  BATTLE_ACTION_APPLY_ARG_KIND,
  BATTLE_ACTION_APPLY_KIND_SPECIAL,
  actionKindFromQ12
} from "./battleActionApplication.js";

export const BATTLE_NATIVE_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_NATIVE_COUNT = 67;
export const BATTLE_NATIVE_TOTAL_CALL_SITES = 3014;

export const BATTLE_NATIVE_SHAPE_GETTER = "GETTER";
export const BATTLE_NATIVE_SHAPE_SETTER = "SETTER";
export const BATTLE_NATIVE_SHAPE_COMPOUND = "COMPOUND";
export const BATTLE_NATIVE_SHAPE_TRIVIAL = "TRIVIAL";
export const BATTLE_NATIVE_SHAPE_YIELD = "YIELD";

/** Q12 again: `lsl #0xc` on the way out, `asr #0xc` on the way in. */
export const BATTLE_NATIVE_Q12_SHIFT = 12;

function nativeError(message) {
  return new Error(`BATTLE_NATIVE_${message}`);
}

/** `lsl #4 / lsr #0x10 / asr #4` -- an angle wrapped into the table's 0..4095. */
function angleIndex(value) {
  return (((value << 4) >>> 16) >> 4) & 0xfff;
}

/** The sin and cos table both angle natives read. */
export const BATTLE_NATIVE_TRIG_TABLE = 0x02099d6c;
export const BATTLE_NATIVE_TRIG_ENTRIES = 4096;
export const BATTLE_NATIVE_TRIG_SCALE = 4096;

function requireHost(host, ...methods) {
  if (!host || typeof host !== "object") {
    throw nativeError("REQUIRES_A_HOST");
  }
  for (const method of methods) {
    if (typeof host[method] !== "function") {
      throw nativeError(`HOST_MUST_PROVIDE_${method.toUpperCase()}`);
    }
  }
  return host;
}

/** `[x + 0x2C]` then a word off that, with no null guard in the original. */
function chainThrough2C(host, object, offset) {
  const inner = host.readU32(object, 0x2c);
  return host.readU32(inner, offset);
}

/**
 * ARM9 0x02047E00, read whole. The animation table at [obj+0x8C] is a count and
 * a pointer; each of its entries is eight bytes with a u16 at +4, and this sums
 * that field over every entry.
 *
 *   02047E08  ldrh ip, [r1]           the count
 *   02047E10  cmp  ip, #0 / bxls lr   an empty table is 0, unsigned
 *   02047E18  ldr  r3, [r1, #0xc]     the array base, read ONCE
 *   02047E1C  add  r1, r3, r2, lsl #3 stride 8
 *   02047E20  ldrh r1, [r1, #4]
 *   02047E2C  add  r0, r0, r1
 *
 * What the u16 means is not decided here. It is summed over the whole table and
 * the native shifts the total into Q12, which is what a total duration would
 * look like -- but the field has not been read from the other side, so it keeps
 * the offset for a name.
 */
function animationTableSumOf4(host, object) {
  const table = host.readU32(object, 0x8c);
  const count = host.readU16(table, 0x00);
  if (count === 0) {
    return 0;
  }
  const base = host.readU32(table, 0x0c);
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total = (total + host.readU16(base, index * 8 + 4)) | 0;
  }
  return total;
}

/** The reads the cell-box walk needs on top of the base contract. */
const CELL_BOX_HOST = deepFreeze(["readU16", "readS16"]);
/** 0x02047E00 reads the count and each entry's u16, so `ldrh` but no `ldrsh`. */
const ANIMATION_TABLE_HOST = deepFreeze(["readU16"]);

/** The name for the one boundary these three natives can hit. */
export const BATTLE_NATIVE_NEEDS_OBJECT_GRAPH = "BATTLE_NATIVE_NEEDS_OBJECT_GRAPH";

/**
 * These three walk a real object into the animation runtime, and the original
 * applies no null check on the way: 0x02047E88 dereferences whatever the bank
 * lookup returned. A host with no object graph is not that fault -- it is a
 * caller who has not supplied the graph yet -- so rather than invent a box or
 * pretend the ROM returns zero, the native says which boundary it hit and lets
 * the caller decide. battleMoveScriptRun counts it beside the unread natives.
 */
function needsObjectGraph(address) {
  return nativeError(`NEEDS_OBJECT_GRAPH: 0x${address.toString(16)}`);
}

/** `add r0,r0,r0,lsr #31 / asr r0,r0,#1` -- halve toward zero. */
function halveTowardZero(value) {
  return (value + (value >>> 31)) >> 1;
}

/**
 * The sixteen bodies read whole. Each entry is { address, argumentCount, run },
 * and `run(args, host)` is the routine. Offsets and shifts are quoted from the
 * disassembly in the comment above each.
 */
const IMPLEMENTED = [
  // 0211CE7C  bl arg(0) / ldr r0,[r0,#0x2c] / ldr r0,[r0]
  { address: 0x0211ce7c, argumentCount: 1, run: (args, host) => chainThrough2C(host, args[0], 0x00) },
  // 0211CE94  ... ldr r0,[r0,#0x2c] / ldr r0,[r0,#4]
  { address: 0x0211ce94, argumentCount: 1, run: (args, host) => chainThrough2C(host, args[0], 0x04) },
  // 0211CEAC  ... ldr r0,[r0,#0x2c] / ldr r0,[r0,#8]
  { address: 0x0211ceac, argumentCount: 1, run: (args, host) => chainThrough2C(host, args[0], 0x08) },
  // 0211CFD8  ldr r0,[r0,#4] / ldr r0,[r0,#0x6dc] / lsl r0,r0,#0xc
  {
    address: 0x0211cfd8,
    argumentCount: 1,
    run: (args, host) => host.readU32(host.readU32(args[0], 0x04), 0x6dc) << BATTLE_NATIVE_Q12_SHIFT
  },
  // 0211CFF4  ldr r0,[r0,#4]
  { address: 0x0211cff4, argumentCount: 1, run: (args, host) => host.readU32(args[0], 0x04) },
  // 0211D1A8  cmp r0,#0 / moveq r0,#0 / ldrne r0,[r0,#0x24]
  { address: 0x0211d1a8, argumentCount: 1, run: (args, host) => (args[0] ? host.readU32(args[0], 0x24) : 0) },
  // 0211D1C4  ... ldrne r0,[r0,#0x28]
  { address: 0x0211d1c4, argumentCount: 1, run: (args, host) => (args[0] ? host.readU32(args[0], 0x28) : 0) },
  // 0211D1E0  ... ldrne r0,[r0,#0x2c]
  { address: 0x0211d1e0, argumentCount: 1, run: (args, host) => (args[0] ? host.readU32(args[0], 0x2c) : 0) },
  // 0211D2BC  ldrbne r0,[r0,#0x58] / addne r0,r0,#1 / lslne r0,r0,#0xc
  {
    address: 0x0211d2bc,
    argumentCount: 1,
    run: (args, host) => (args[0] ? (host.readU8(args[0], 0x58) + 1) << BATTLE_NATIVE_Q12_SHIFT : 0)
  },
  // 0211D238  the cell box's Y midpoint, in Q12.
  //   0211D250  mov   r1, #1              apply the transform
  //   0211D254  bl    #0x2047e58
  //   0211D258  ldrsh r1, [r0, #6]        the returned pointer's low Y
  //   0211D25C  ldrsh r0, [r0, #2]        its high Y
  //   0211D260  add   r0, r1, r0
  //   0211D264  lsl   r0, r0, #0xc        Q12 FIRST, then halve -- so an odd
  //   0211D268  add   r0, r0, r0, lsr #31 sum keeps its half unit rather than
  //   0211D26C  asr   r0, r0, #1          being rounded away before the shift
  {
    address: 0x0211d238,
    argumentCount: 1,
    requires: CELL_BOX_HOST,
    run: (args, host) => {
      if (!args[0]) return 0;
      const resolved = readSpriteCellBox(host, args[0], 1);
      if (resolved === null) {
        throw needsObjectGraph(0x0211d238);
      }
      return halveTowardZero((resolved.box.lowY + resolved.box.highY) << BATTLE_NATIVE_Q12_SHIFT);
    }
  },
  // 0211D298  bl #0x2047d98 / lsl r0,r0,#0xc -- the cell box's Y extent in Q12.
  // 0x02047D98 does its own walk and does NOT apply the transform, so this is
  // the record's own height and not the object's scaled copy.
  {
    address: 0x0211d298,
    argumentCount: 1,
    requires: CELL_BOX_HOST,
    run: (args, host) => {
      if (!args[0]) return 0;
      const found = readCellRecordBox(host, args[0]);
      if (found === null) {
        throw needsObjectGraph(0x0211d298);
      }
      return cellBoxExtentY(found.box) << BATTLE_NATIVE_Q12_SHIFT;
    }
  },
  // 0211D33C  bl #0x2047e00 / lsl r0,r0,#0xc -- the animation table's summed
  // u16 at +4, in Q12. Nothing here touches the cell box.
  {
    address: 0x0211d33c,
    argumentCount: 1,
    requires: ANIMATION_TABLE_HOST,
    run: (args, host) => (args[0]
      ? animationTableSumOf4(host, args[0]) << BATTLE_NATIVE_Q12_SHIFT
      : 0)
  },
  // 0211CEC4  ldr r1,[r4,#0x154] / cmp r1,#0 / streq / moveq r0,#1 / movne r0,#0
  {
    address: 0x0211cec4,
    argumentCount: 2,
    run: (args, host) => {
      if (host.readU32(args[0], 0x154) !== 0) {
        return 0;
      }
      host.writeU32(args[0], 0x154, args[1]);
      return 1;
    }
  },
  // 0211CEFC / CF1C: release only when the supplied owner matches +154.
  {
    address: 0x0211cefc,
    argumentCount: 2,
    run: (args, host) => {
      if (host.readU32(args[0], 0x154) !== args[1]) {
        return 0;
      }
      host.writeU32(args[0], 0x154, 0);
      return 1;
    }
  },
  // 0211D514  movs r4,r0 / popeq 0 / arg(1) / asr r0,r0,#0xc / strb r0,[r4,#0x14]
  {
    address: 0x0211d514,
    argumentCount: 2,
    run: (args, host) => {
      if (!args[0]) {
        return 0;
      }
      host.writeU8(args[0], 0x14, args[1] >> BATTLE_NATIVE_Q12_SHIFT);
      return 0;
    }
  },
  // 0211D3A8  cmp r0,#0 / moveq r0,#1 / popeq / bl 0x02047C48
  {
    address: 0x0211d3a8,
    argumentCount: 1,
    run: (args, host) => (args[0] ? host.call(0x02047c48, args[0]) : 1)
  },
  // 0211D2E0  movs r1,r0 / popeq 0 / bl 0x0211AD9C / lsl r0,r0,#0x14
  {
    address: 0x0211d2e0,
    argumentCount: 1,
    run: (args, host) => {
      if(!args[0])return 0;
      const world=host.readU32(0x02131c40,0);
      if(!world)throw needsObjectGraph(0x0211d2e0);
      return host.call(0x0211ad9c,world+0x1f218,args[0])<<20;
    }
  },
  // 0211E28C  bl 0x02054A24 / mov r0,#0
  {
    address: 0x0211e28c,
    argumentCount: 0,
    run: (unusedArgs, host) => {
      host.yield();
      return 0;
    }
  },
  // 0211D3C8  movs r5,r0 / popeq 0 / arg(1) / arg(2) / bl 0x02048190
  //
  // ARM9 0x02048190 is two stores and a return: `str r1,[r0,#0x24]` then
  // `str r2,[r0,#0x28]`. So this is a two-word setter behind a helper, and the
  // blob calls it 274 times inside a single attack script.
  {
    address: 0x0211d3c8,
    argumentCount: 3,
    run: (args, host) => {
      if (!args[0]) {
        return 0;
      }
      host.writeU32(args[0], 0x24, args[1]);
      host.writeU32(args[0], 0x28, args[2]);
      return 0;
    }
  },
  // 0211D54C  movs r4,r0 / popeq 0 / arg(1) / bl 0x02047C84 / arg(2) / bl 0x02047C8C
  //
  // ARM9 0x02047C84 is `str r1,[r0,#4]` and 0x02047C8C is `str r1,[r0,#8]`,
  // each a single store. Two separate helpers rather than one, and the pair
  // writes the second and third words of the same block the three getters at
  // 0x0211CE7C, 0x0211CE94 and 0x0211CEAC read through +0x2C.
  {
    address: 0x0211d54c,
    argumentCount: 3,
    run: (args, host) => {
      if (!args[0]) {
        return 0;
      }
      host.writeU32(args[0], 0x04, args[1]);
      host.writeU32(args[0], 0x08, args[2]);
      return 0;
    }
  },
  // 0211E2C4  arg(0) / bl 0x02002758
  //
  // ARM9 0x02002758 is the DS square-root unit: `strh #1` to SQRTCNT at
  // 0x040002B0 selects 64-bit mode, the parameter goes to +0x8 and +0xC with a
  // zero high word, and 0x02002818 waits and reads the result back. A value at
  // or below zero returns zero without touching the hardware at all.
  //
  // Twenty-five of the thirty-six distinct move scripts call this one, which
  // makes it the single routine that unblocked the most of them.
  {
    address: 0x0211e2c4,
    argumentCount: 1,
    run: (args) => {
      // `cmp r0,#0 / movle r0,#0 / pople`
      if (args[0] <= 0) {
        return 0;
      }
      // ARM9 02002758 puts value<<32 into the 64-bit square-root unit;
      // 02002818 adds 512 then shifts ten. This is sqrt in Q12, not isqrt.
      return Math.floor((Math.floor(Math.sqrt(args[0] * 2 ** 32)) + 512) / 1024);
    }
  },
  // 0211D418  movs r4,r0 / popeq 0 / arg(1) / str r0,[r4,#0x2c]
  //
  // The setter for the block the three getters at 0x0211CE7C, 0x0211CE94 and
  // 0x0211CEAC read through, and that 0x0211D1E0 returns whole.
  {
    address: 0x0211d418,
    argumentCount: 2,
    run: (args, host) => {
      if (!args[0]) {
        return 0;
      }
      host.writeU32(args[0], 0x2c, args[1]);
      return 0;
    }
  },
  // 0211D050  cmp r0,#0 / moveq r0,#0 / ldrne r0,[r0,#0xe8]
  //
  // +0xE8 is where the launch initialiser stores the action, which
  // battleLaunchPool already names.
  {
    address: 0x0211d050,
    argumentCount: 1,
    run: (args, host) => (args[0] ? host.readU32(args[0], 0xe8) : 0)
  },
  // 0211E388  cmp r0,#0 / rsblt r0,r0,#0
  {
    address: 0x0211e388,
    argumentCount: 1,
    run: (args) => (args[0] < 0 ? -args[0] : args[0])
  },
  // 0211D008  arg(0) / arg(1) / asr r2,r0,#0xc / ldr r1,[r4,#4] / str r2,[r1,#0x440]
  //
  // No null guard in the original: it dereferences +0x04 whatever arg 0 is.
  {
    address: 0x0211d008,
    argumentCount: 2,
    run: (args, host) => {
      host.writeU32(host.readU32(args[0], 0x04), 0x440, args[1] >> BATTLE_NATIVE_Q12_SHIFT);
      return 0;
    }
  },
  // 0211E29C  arg(0) / mov r0,#0xd8 / bl 0x020431D4 / asr r1,r4,#0xc
  //           / bl 0x0202B558 / lsl r0,r1,#0xc
  //
  // 0xD8 is 216, the same channel the crit and variance rolls use, so a script
  // randomises off the one shared cycle. 0x0202B558 is the signed divide whose
  // REMAINDER comes back in r1, and that is the half taken. The argument is Q12,
  // the divisor is it shifted down, and the answer is shifted back up.
  {
    address: 0x0211e29c,
    argumentCount: 1,
    run: (args, host) => {
      const divisor = args[0] >> BATTLE_NATIVE_Q12_SHIFT;
      const roll = host.call(0x020431d4, 0xd8) | 0;
      // What the original's divide does with a zero divisor is not traced, so
      // this refuses to invent a value and yields nothing rather than a NaN.
      if (divisor === 0) {
        return 0;
      }
      return (roll % divisor) << BATTLE_NATIVE_Q12_SHIFT;
    }
  },
  // 0211CE5C  arg(0) / ldr r1,=0x00007FFF / bl 0x020472EC
  //
  // ARM9 0x020472EC is `strh r1,[r0,#0x18]` and a return, so this parks 0x7FFF
  // in a halfword. Delegated rather than stored inline because the host contract
  // has no halfword write and inventing one would widen it for a single call.
  {
    address: 0x0211ce5c,
    argumentCount: 1,
    run: (args, host) => {
      host.call(0x020472ec, args[0], 0x7fff);
      return 0;
    }
  },
  // 0211D490  movs r4,r0 / popeq 0 / arg(1) / lsl r1,r0,#4 / asr r1,r1,#0x10
  //           / bl 0x020472FC
  //
  // ARM9 0x020472FC is `strb r1,[r0,#0x17]`. The shift pair is a sign-extending
  // narrow of the Q12 argument, kept literal rather than simplified to >>12.
  {
    address: 0x0211d490,
    argumentCount: 2,
    run: (args, host) => {
      if (!args[0]) {
        return 0;
      }
      host.call(0x020472fc, args[0], ((args[1] << 4) >> 16));
      return 0;
    }
  },
  // 0211D44C  movs r4,r0 / popeq 0 / arg(1) / asr r0,r0,#0xc / and r1,r0,#0xff
  //           / sub r1,r1,#1 / bl 0x02047904
  //
  // 0x02047904 keeps the previous value at +0x59 before storing the new one at
  // +0x58 and then continues into the animation runtime, which this lane has not
  // traced. Delegated whole so the tail stays the host's rather than being half
  // implemented here.
  {
    address: 0x0211d44c,
    argumentCount: 2,
    run: (args, host) => {
      if (!args[0]) {
        return 0;
      }
      host.call(0x02047904, args[0], (((args[1] >> BATTLE_NATIVE_Q12_SHIFT) & 0xff) - 1));
      return 0;
    }
  },
  // 0211D03C  arg(0) / bl 0x0211436C
  //
  // 0x0211436C reads +0x14 then +0x2C and runs float compares through
  // 0x0202AECC and 0x0202A7F8. Delegated: its body is arithmetic this lane has
  // not walked, and guessing at it would be worse than naming it.
  {
    address: 0x0211d03c,
    argumentCount: 1,
    run: (args, host) => host.call(0x0211436c, args[0])
  },
  // 0211E2D8  arg(0) / lsl #4 / lsr #0x10 / asr #4 / lsl #2 / ldrsh [0x02099D6C]
  // 0211E304  the same index, then (idx*2 + 1)*2 -- the second halfword
  //
  // 0x02099D6C is 4,096 entries of two signed halfwords. Reading the whole table
  // out of the cartridge and comparing it against round(4096 * sin(2*PI*i/4096))
  // and its cosine gave zero mismatches across all 4,096 rows and both columns,
  // so the closed form IS the table and carrying 16 KB of it would add nothing.
  // The index arithmetic is kept literal: the shifts wrap an angle into 0..4095.
  {
    address: 0x0211e2d8,
    argumentCount: 1,
    run: (args) => Math.round(4096 * Math.sin((2 * Math.PI * angleIndex(args[0])) / 4096))
  },
  {
    address: 0x0211e304,
    argumentCount: 1,
    run: (args) => Math.round(4096 * Math.cos((2 * Math.PI * angleIndex(args[0])) / 4096))
  },
  // 0211D71C  mov r1,#2 / bl arg / asr r1,r1,#0xc / bl 0x0211D740
  //
  // The attack. Two thousand one hundred and twenty-four bytes of body, and the
  // entry itself is nine instructions: read argument 2, shift it down out of
  // Q12, and tail into the same 0x0211D740 that 0x0211D70C enters with a forced
  // kind of 13. So the two natives are one routine with a variable and a fixed
  // kind, and battleActionApplication already models what that routine does.
  //
  // Delegated for the same reason its sibling is: the body walks the roster and
  // calls the damage resolver at 0x021149A8, which needs battle state this
  // module is deliberately kept away from. The host supplies it.
  {
    address: 0x0211d71c,
    argumentCount: 3,
    run: (args, host) => host.readArgument
      ? host.call(0x0211d740, actionKindFromQ12(args[BATTLE_ACTION_APPLY_ARG_KIND]),args[0],args[1])
      : host.call(0x0211d740, actionKindFromQ12(args[BATTLE_ACTION_APPLY_ARG_KIND]))
  },
  // 0211D70C  ldr ip,=0x0211D740 / mov r1,#0xd / bx ip
  //
  // A sixteen-byte tail call into the action-application body with the kind
  // argument forced to 13 — which is exactly the value that routine treats as
  // special at 0x0211DA04. The blob calls it 56 times.
  {
    address: 0x0211d70c,
    argumentCount: 0,
    run: (unusedArgs, host) => host.readArgument
      ? host.call(0x0211d740, BATTLE_ACTION_APPLY_KIND_SPECIAL,host.readArgument(0),host.readArgument(1))
      : host.call(0x0211d740, BATTLE_ACTION_APPLY_KIND_SPECIAL)
  },
  // Remaining primitive actor natives, read from OVL19 at their addresses.
  // Complex engine helpers remain explicit host calls, never inferred names.
  {address:0x0211cf34,argumentCount:2,run:(a,h)=>{h.writeU32(h.readU32(a[0],4),0x6d0,a[1]!==0?1:0);return 0;}},
  {address:0x0211cf70,argumentCount:3,run:(a,h)=>{const p=h.readU32(a[0],0x2c);h.writeU32(p,0,a[1]);h.writeU32(p,4,a[2]);return 0;}},
  {address:0x0211cfac,argumentCount:2,run:(a,h)=>{h.writeU32(h.readU32(a[0],0x2c),8,a[1]);return 0;}},
  {address:0x0211d1fc,argumentCount:1,requires:CELL_BOX_HOST,run:(a,h)=>{
    if(!a[0])return 0;const found=readSpriteCellBox(h,a[0],1);
    if(!found)throw needsObjectGraph(0x0211d1fc);
    return halveTowardZero((found.box.lowX+found.box.highX)<<12);
  }},
  {address:0x0211d274,argumentCount:1,requires:CELL_BOX_HOST,run:(a,h)=>{
    if(!a[0])return 0;const found=readCellRecordBox(h,a[0]);
    if(!found)throw needsObjectGraph(0x0211d274);
    return (found.box.highX-found.box.lowX)<<12;
  }},
  {address:0x0211d318,argumentCount:1,run:(a,h)=>a[0] ? h.call(0x02047c5c,a[0])<<12 : 0},
  {address:0x0211d360,argumentCount:1,run:(a,h)=>a[0] ? h.call(0x02047e38,a[0])<<12 : 0},
  {address:0x0211d384,argumentCount:1,run:(a,h)=>a[0] ? h.call(0x02047c6c,a[0])<<12 : 0},
  {address:0x0211d4d0,argumentCount:2,run:(a,h)=>{if(a[0])h.call(0x020479a4,a[0],h.readU8(a[0],0x58),a[1]>>12);return 0;}},
  {address:0x0211d5a0,argumentCount:2,run:(a,h)=>{
    if(a[0]){const angle=2*Math.PI*angleIndex(a[1])/4096;h.call(0x0204730c,a[0],Math.round(4096*Math.sin(angle)),Math.round(4096*Math.cos(angle)));}return 0;
  }},
  {address:0x0211e0d4,argumentCount:2,run:(a,h)=>{
    if(!a[1])return 0;h.writeU8(a[1],0x5b,0);
    for(let i=0;i<24;i++)if(h.readU32(a[0],0x24+i*4)===a[1]){h.writeU32(a[0],0x24+i*4,0);h.writeU32(a[0],0x84+i*4,0);break;}
    for(let i=0;i<4;i++)if(h.readU32(a[0],0x970+i*4)===a[1]){h.writeU32(a[0],0x970+i*4,0);break;}
    return 0;
  }},
  {address:0x0211e164,argumentCount:2,requires:CELL_BOX_HOST,run:(a,h)=>{
    const actor=a[1];if(!actor)return 1;
    const found=readSpriteCellBox(h,actor,1);if(!found)throw needsObjectGraph(0x0211e164);
    const {highX,highY,lowX,lowY}=found.box;
    const x=h.readU32(actor,0x24)|0,y=h.readU32(actor,0x28)|0,z=h.readU32(actor,0x2c)|0;
    return Number(((x+(highX<<12))|0)<0 || ((y+(highY<<12)-z)|0)<0
      || ((x+(lowX<<12))|0)>=0x1a0000 || ((y+(lowY<<12)-z)|0)>=0x110000);
  }},
  {address:0x0211e36c,argumentCount:1,run:a=>a[0]&-4096},
  {address:0x0211e554,argumentCount:1,run:(a,h)=>{h.call(0x0203eae8,6);return 0;}},
  {address:0x0211e570,argumentCount:2,run:(a,h)=>{h.writeU32(a[1],8,0);h.writeU32(a[1],12,0);return 0;}},
  ...BATTLE_REMAINING_NATIVES
];

const BY_ADDRESS = new Map(IMPLEMENTED.map((entry) => [entry.address, entry]));

/** The addresses this module actually runs, in catalog order. */
export const BATTLE_NATIVE_IMPLEMENTED = deepFreeze(IMPLEMENTED.map((entry) => entry.address).sort((a, b) => a - b));

/** 0x0211D70C forces this kind; battleActionApplication found it special. */
export const BATTLE_NATIVE_SPECIAL_KIND_ENTRY = 0x0211d70c;

export function getBattleNativeCatalog() {
  if (nativeDocument.nativeCount !== BATTLE_NATIVE_COUNT
    || nativeDocument.natives.length !== BATTLE_NATIVE_COUNT) {
    throw nativeError("CATALOG_COUNT_MISMATCH");
  }
  return nativeDocument;
}

export function listBattleNatives() {
  return getBattleNativeCatalog().natives;
}

export function describeBattleNative(address) {
  const found = listBattleNatives().find((entry) => Number.parseInt(entry.address, 16) === address);
  if (!found) {
    throw nativeError(`UNKNOWN: 0x${address.toString(16)}`);
  }
  return found;
}

export function isBattleNativeImplemented(address) {
  return BY_ADDRESS.has(address);
}

/**
 * Run one native. `args` are the script arguments it would have read, in index
 * order. An address in the catalog but not implemented raises rather than
 * returning a value nobody traced.
 */
export function callBattleNative(address, args, host) {
  const entry = BY_ADDRESS.get(address);
  if (!entry) {
    describeBattleNative(address);
    throw nativeError(`NOT_IMPLEMENTED: 0x${address.toString(16)}`);
  }
  if (!Array.isArray(args) || args.length < entry.argumentCount) {
    throw nativeError(`NEEDS_${entry.argumentCount}_ARGUMENTS: 0x${address.toString(16)}`);
  }
  // The base contract every native has always needed, plus whatever this one
  // asks for on top. The cell-box natives want `ldrh` and `ldrsh` readers; the
  // other thirty-one do not, and widening the contract for all of them would
  // have made every existing host wrong for no reason.
  requireHost(host, "readU32", "readU8", "writeU32", "writeU8", "call", "yield");
  if (entry.requires) {
    requireHost(host, ...entry.requires);
  }
  return entry.run(args, host);
}

/** How much of the scripts' native traffic the implemented set covers. */
export function nativeCallSiteCoverage() {
  const natives = listBattleNatives();
  const covered = natives
    .filter((entry) => BY_ADDRESS.has(Number.parseInt(entry.address, 16)))
    .reduce((total, entry) => total + entry.callSites, 0);
  const total = natives.reduce((sum, entry) => sum + entry.callSites, 0);
  return deepFreeze({ covered, total, implemented: BY_ADDRESS.size, natives: natives.length });
}
