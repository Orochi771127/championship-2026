// Battle script VM — ARM9 0x020549D4 dispatch, 52 opcodes at ARM9 0x020BDEAC.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// THE DISPATCH LOOP
// -----------------
//   020549D4  ldr   r4, =0x020BDEAC      opcode table
//   020549D8  ldr   r0, [r5, #4]         pc
//   020549DC  ldrb  r1, [r0]             opcode = *pc
//   020549E0  add   r0, r4, r1, lsl #3   &table[opcode]      -- stride 8
//   020549E8  ldr   r2, [r4, r1, lsl #3]
//   02054A04  blx   r2
//   02054A08  ldr   r0, [r5, #0x190]
//   02054A0C  lsl   r0, r0, #0x1e
//   02054A10  lsrs  r0, r0, #0x1f        keep-running bit
//   02054A14  bne   #0x20549d8
//
// The entries are 8-byte C++ pointer-to-member pairs {function, thisAdjust}.
// All 52 adjust words are zero, so every handler is a plain call.
//
// WHY 52 AND NOT SOME OTHER NUMBER
// --------------------------------
// The table ends where the compiler put the assert strings for the two handlers
// that check the stack: 0x020BE04C is "script.cpp" and 0x020BE058 is
// "Script Stack Overflow!\n". Entry 52 would start at 0x020BE04C, so the last
// opcode is 0x33. The bound is the ROM's own data, not a count taken on trust.
//
// The opcode table proves the count; the scripts prove the operand sizes. A
// linear decode of the whole OVL19 script blob with the sizes below consumes
// 0x021204A0..0x0212FDA4 exactly — 23,121 instructions ending on the byte where
// ARM code resumes — and all 1,290 branch targets (380 JUMP, 736 JUMP_IF_ZERO,
// 42 JUMP_IF_NONZERO, 132 CALL) land on an instruction boundary. A wrong size
// anywhere would desynchronise the stream long before the end.
//
// THE OBJECT
// ----------
// One flat struct, addressed off r0 throughout:
//   +0x000  script base           set once by init
//   +0x004  pc
//   +0x008  slot[0] … slot[95]    operand stack and locals, ends at +0x184
//   +0x188  sp                    slot index, not a byte offset
//   +0x18C  frameBase
//   +0x190  flags: bit0 active, bit1 keep-running
//   +0x194  the second array ops 0x03 and 0x07 index
//
// init (0x020548D4) pushes the arguments in reverse, then pushes two zeros —
// a return address of 0 and a saved frame base of 0 — and sets frameBase = sp.
// The top frame is therefore shaped exactly like a CALL frame, which is why
// RETURN stops the script when the restored pc is 0 rather than by testing a
// separate depth counter.
//
// WHAT THIS MODULE DOES NOT DECIDE
// --------------------------------
// CALL_NATIVE (0x32) takes an absolute code address. It is by far the most
// common instruction in the blob — 3,014 of the 23,121 — and the battle scripts
// name 67 distinct targets, all in OVL19 0x0211CDFC..0x0211EA68. Not one of them
// is traced. They are dispatched to an injected handler; this module invents no
// behavior for them and no default.
//
// Division by zero in the two fixed-point opcodes goes through NDS hardware
// (0x04000280) whose zero-denominator result is not established by anything in
// this ROM, so those raise rather than guess. The unsigned software divide the
// integer opcodes use IS traced: 0x0202B764 returns with r0 and r1 untouched
// when the denominator is zero, so DIV yields the numerator and MOD yields 0.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_SCRIPT_VM_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_SCRIPT_VM_DISPATCH_SITE = "ARM9:0x020549D4";
export const BATTLE_SCRIPT_OPCODE_TABLE_BASE = 0x020bdeac;
export const BATTLE_SCRIPT_OPCODE_TABLE_STRIDE = 8;
export const BATTLE_SCRIPT_OPCODE_COUNT = 52;

/** slot[0] is +0x08 and slot[95] is +0x184, so the array holds 96 words. */
export const BATTLE_SCRIPT_SLOT_COUNT = 96;

/** cmp r0,#0x5E at 0x0205550C and cmp r0,#0x60 at 0x020555A0. */
export const BATTLE_SCRIPT_CALL_STACK_LIMIT = 0x5e;
export const BATTLE_SCRIPT_CALL_NATIVE_STACK_LIMIT = 0x60;

/** The fixed-point opcodes are Q12: 0x18 adds 0x1000 and 0x15 shifts by 12. */
export const BATTLE_SCRIPT_FX_SHIFT = 12;
export const BATTLE_SCRIPT_FX_ONE = 0x1000;

/** flags at +0x190. */
export const BATTLE_SCRIPT_FLAG_ACTIVE = 1;
export const BATTLE_SCRIPT_FLAG_RUNNING = 2;

/**
 * Every opcode, with the handler that proves it and the byte length the decoder
 * uses. `handler` is the ARM9 address the table holds; `bytes` is the encoded
 * length, counting the opcode byte.
 */
export const BATTLE_SCRIPT_OPCODES = deepFreeze([
  { code: 0x00, name: "NOP", bytes: 1, handler: 0x02054a5c },
  { code: 0x01, name: "PUSH_IMM32", bytes: 5, handler: 0x02054a6c },
  { code: 0x02, name: "PUSH_LOCAL", bytes: 2, handler: 0x02054ab0, signedOperand: true },
  { code: 0x03, name: "PUSH_SLOT194", bytes: 2, handler: 0x02054aec, signedOperand: true },
  { code: 0x04, name: "LOAD_INDIRECT", bytes: 1, handler: 0x02054b20 },
  { code: 0x05, name: "PUSH_LOCAL_ADDRESS", bytes: 2, handler: 0x02054b64, signedOperand: true },
  { code: 0x06, name: "POP_TO_LOCAL", bytes: 2, handler: 0x02054c40, signedOperand: true },
  { code: 0x07, name: "POP_TO_SLOT194", bytes: 2, handler: 0x02054c7c, signedOperand: true },
  { code: 0x08, name: "STORE_INDIRECT", bytes: 1, handler: 0x02054cb0 },
  { code: 0x09, name: "PUSH_ZEROS", bytes: 2, handler: 0x02054ba4 },
  { code: 0x0a, name: "POP_N", bytes: 2, handler: 0x02054bf4 },
  { code: 0x0b, name: "ADD", bytes: 1, handler: 0x02054cfc },
  { code: 0x0c, name: "SUB", bytes: 1, handler: 0x02054d30 },
  { code: 0x0d, name: "MUL", bytes: 1, handler: 0x02054d64 },
  { code: 0x0e, name: "DIV_UNSIGNED", bytes: 1, handler: 0x02054d98 },
  { code: 0x0f, name: "MOD_UNSIGNED", bytes: 1, handler: 0x02054dd0 },
  { code: 0x10, name: "INC", bytes: 1, handler: 0x02054e08 },
  { code: 0x11, name: "DEC", bytes: 1, handler: 0x02054e2c },
  { code: 0x12, name: "DUP", bytes: 1, handler: 0x02054e50 },
  { code: 0x13, name: "ADD_FX", bytes: 1, handler: 0x02054e7c },
  { code: 0x14, name: "SUB_FX", bytes: 1, handler: 0x02054eb0 },
  { code: 0x15, name: "MUL_FX", bytes: 1, handler: 0x02054ee4 },
  { code: 0x16, name: "DIV_FX", bytes: 1, handler: 0x02054f28 },
  { code: 0x17, name: "MOD_FX", bytes: 1, handler: 0x02054f64 },
  { code: 0x18, name: "INC_FX", bytes: 1, handler: 0x02054fa0 },
  { code: 0x19, name: "DEC_FX", bytes: 1, handler: 0x02054fc4 },
  { code: 0x1a, name: "INDEX_FX", bytes: 1, handler: 0x02054fe8 },
  { code: 0x1b, name: "AND", bytes: 1, handler: 0x02055020 },
  { code: 0x1c, name: "OR", bytes: 1, handler: 0x02055054 },
  { code: 0x1d, name: "XOR", bytes: 1, handler: 0x02055088 },
  { code: 0x1e, name: "LOGICAL_AND", bytes: 1, handler: 0x020550bc },
  { code: 0x1f, name: "LOGICAL_OR", bytes: 1, handler: 0x020550fc },
  { code: 0x20, name: "LOGICAL_NOT", bytes: 1, handler: 0x0205513c },
  { code: 0x21, name: "BITWISE_NOT", bytes: 1, handler: 0x0205516c },
  { code: 0x22, name: "NEGATE", bytes: 1, handler: 0x02055190 },
  { code: 0x23, name: "SHL", bytes: 1, handler: 0x020551b4 },
  { code: 0x24, name: "SHR_LOGICAL", bytes: 1, handler: 0x020551e8 },
  { code: 0x25, name: "SHL_2", bytes: 1, handler: 0x0205521c },
  { code: 0x26, name: "SHR_ARITHMETIC", bytes: 1, handler: 0x02055250 },
  { code: 0x27, name: "COMPARE3_UNSIGNED", bytes: 1, handler: 0x02055284 },
  { code: 0x28, name: "JUMP", bytes: 5, handler: 0x020552d0 },
  { code: 0x29, name: "JUMP_IF_ZERO", bytes: 5, handler: 0x020552f8 },
  { code: 0x2a, name: "JUMP_IF_NONZERO", bytes: 5, handler: 0x02055348 },
  { code: 0x2b, name: "EQ", bytes: 1, handler: 0x02055398 },
  { code: 0x2c, name: "NE", bytes: 1, handler: 0x020553d4 },
  { code: 0x2d, name: "LT", bytes: 1, handler: 0x02055410 },
  { code: 0x2e, name: "LE", bytes: 1, handler: 0x0205544c },
  { code: 0x2f, name: "GE", bytes: 1, handler: 0x02055488 },
  { code: 0x30, name: "GT", bytes: 1, handler: 0x020554c4 },
  { code: 0x31, name: "CALL", bytes: 5, handler: 0x02055500 },
  { code: 0x32, name: "CALL_NATIVE", bytes: 5, handler: 0x02055594 },
  { code: 0x33, name: "RETURN", bytes: 1, handler: 0x02055614 }
]);

/**
 * Pairs of opcodes whose handlers are byte-for-byte identical. The split is
 * real — the compiler emits a distinct opcode per operand type — but the
 * integer and fixed-point forms of add, subtract and shift-left are the same
 * operation on the raw word, so the ROM shares no code and gives no way to tell
 * the two apart from the handler alone. The FX label on 0x13/0x14 comes from
 * the block they sit in, whose other members prove it: 0x15 rounds and shifts
 * by 12, 0x16 divides a value shifted left by 32 and shifts the result back by
 * 20, and 0x18/0x19 step by 0x1000.
 */
export const BATTLE_SCRIPT_IDENTICAL_HANDLER_PAIRS = deepFreeze([
  [0x0b, 0x13],
  [0x0c, 0x14],
  [0x23, 0x25]
]);

const BY_CODE = new Map(BATTLE_SCRIPT_OPCODES.map((entry) => [entry.code, entry]));
const JUMP_CODES = new Set([0x28, 0x29, 0x2a, 0x31]);

function vmError(message) {
  return new Error(`BATTLE_SCRIPT_${message}`);
}

export function getBattleScriptOpcode(code) {
  const entry = BY_CODE.get(code);
  if (!entry) {
    throw vmError(`UNKNOWN_OPCODE: 0x${code.toString(16)}`);
  }
  return entry;
}

/** Little-endian, the way every 4-byte operand handler assembles its bytes. */
function readImm32(bytes, at) {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

/**
 * Decode one instruction at the RAM `address`. `origin` is the address the
 * image's byte 0 was loaded at. Addresses stay absolute the whole way through,
 * as they are in the cartridge: jump and call operands are absolute, and
 * RETURN's stop condition is a restored pc of exactly 0, which only means
 * "no caller" while addresses are not rebased.
 */
export function decodeBattleScriptInstruction(bytes, address, origin = 0) {
  const at = address - origin;
  const code = at < 0 ? undefined : bytes[at];
  if (code === undefined) {
    throw vmError(`DECODE_PAST_END: 0x${(address >>> 0).toString(16)}`);
  }
  const entry = getBattleScriptOpcode(code);
  const instruction = { address, code, name: entry.name, bytes: entry.bytes, operand: null };
  if (entry.bytes === 2) {
    const raw = bytes[at + 1];
    instruction.operand = entry.signedOperand ? (raw << 24) >> 24 : raw;
  } else if (entry.bytes === 5) {
    instruction.operand = readImm32(bytes, at + 1);
    if (JUMP_CODES.has(code)) {
      instruction.target = instruction.operand;
    }
  }
  return instruction;
}

/** Decode from `address` up to and including the first RETURN. */
export function decodeBattleScriptRoutine(bytes, address, origin = 0, limit = 100000) {
  const out = [];
  let at = address;
  for (let step = 0; step < limit; step += 1) {
    const instruction = decodeBattleScriptInstruction(bytes, at, origin);
    out.push(instruction);
    if (instruction.code === 0x33) {
      return out;
    }
    at += instruction.bytes;
  }
  throw vmError(`ROUTINE_DID_NOT_RETURN: 0x${(address >>> 0).toString(16)}`);
}

const MASK = 0xffffffff;
const toI32 = (value) => value | 0;
const toU32 = (value) => value >>> 0;

/** smull, then +0x800 and >>12 across the 64-bit product (0x02054EF4). */
function mulFx(a, b) {
  const product = (BigInt(toI32(a)) * BigInt(toI32(b)) + 0x800n) >> 12n;
  return Number(BigInt.asIntN(32, product));
}

/**
 * 0x02002844 loads DIV_NUMER_H with the operand and zero in the low word, so
 * the numerator is a << 32; 0x020027B0 adds 0x80000 and keeps bits 20..51.
 */
export function divFx(a, b) {
  if (toI32(b) === 0) {
    // SDK 02002738/2844 uses hardware mode 1. Its signed 64-bit result is
    // +1 or -1 on zero denominator; 020027B0 rounds either to Q12 zero.
    // Original CPU oracle: BATTLE_LIFECYCLE_CPU_2026-09-07, all signed cases.
    return 0;
  }
  // BigInt division truncates toward zero, which is what the NDS divider does.
  const quotient = (BigInt(toI32(a)) << 32n) / BigInt(toI32(b));
  return Number(BigInt.asIntN(32, (quotient + 0x80000n) >> 20n));
}

/** 0x0202B764: unsigned, and a zero denominator returns r0 and r1 unchanged. */
function divUnsigned(a, b) {
  const denominator = toU32(b);
  if (denominator === 0) {
    return { quotient: toI32(a), remainder: 0 };
  }
  const numerator = toU32(a);
  return {
    quotient: toI32(Math.floor(numerator / denominator)),
    remainder: toI32(numerator % denominator)
  };
}

/**
 * A VM instance. `slots`, `sp`, `frameBase` and `flags` are the four fields the
 * handlers touch; `objectBase` is what an address opcode adds its slot offset
 * to, so a pointer produced by PUSH_LOCAL_ADDRESS can be range-checked exactly
 * the way the original checks against r0+8 and r0+0x184.
 */
export function createBattleScriptVm({ objectBase = 0, callNative = null } = {}) {
  return {
    objectBase,
    callNative,
    base: 0,
    pc: 0,
    slots: new Int32Array(BATTLE_SCRIPT_SLOT_COUNT),
    slots194: new Int32Array(BATTLE_SCRIPT_SLOT_COUNT),
    sp: 0,
    frameBase: 0,
    flags: 0
  };
}

/** ARM9 0x020548D4. Arguments go on in reverse, then the zero return frame. */
export function initBattleScript(vm, scriptAddress, args = []) {
  vm.base = scriptAddress;
  vm.pc = scriptAddress;
  vm.flags = scriptAddress !== 0 ? BATTLE_SCRIPT_FLAG_ACTIVE : 0;
  vm.sp = 0;
  for (let index = 0; index < args.length; index += 1) {
    vm.slots[vm.sp] = toI32(args[args.length - 1 - index]);
    vm.sp += 1;
  }
  vm.slots[vm.sp] = 0;
  vm.sp += 1;
  vm.slots[vm.sp] = 0;
  vm.sp += 1;
  vm.frameBase = vm.sp;
  return vm;
}

/** ARM9 0x02054A24: clears the keep-running bit, ending the loop this frame. */
export function yieldBattleScript(vm) {
  vm.flags &= ~BATTLE_SCRIPT_FLAG_RUNNING;
}

/** ARM9 0x02054A4C. */
export function isBattleScriptActive(vm) {
  return (vm.flags & BATTLE_SCRIPT_FLAG_ACTIVE) !== 0;
}

/** ARM9 0x02054A34: the helper a native uses to read its nth argument. */
export function readBattleScriptArgument(vm, index) {
  return vm.slots[vm.sp - index - 1];
}

const SLOT_LOW = 0x08;
const SLOT_HIGH = 0x184;

function addressToSlot(vm, address) {
  const offset = address - vm.objectBase;
  if (offset < SLOT_LOW || offset > SLOT_HIGH) {
    return -1;
  }
  if ((offset - SLOT_LOW) % 4 !== 0) {
    throw vmError("UNALIGNED_INDIRECT_ACCESS_UNTRACED");
  }
  return (offset - SLOT_LOW) / 4;
}

function slotToAddress(vm, slot) {
  return vm.objectBase + SLOT_LOW + slot * 4;
}

/**
 * Execute one instruction. Returns the decoded instruction. `script` is the
 * byte image and `origin` the RAM address of its byte 0; `vm.pc` is the RAM
 * address, not an index into `script`.
 */
export function stepBattleScript(vm, script, origin = 0) {
  const instruction = decodeBattleScriptInstruction(script, vm.pc, origin);
  const { code, operand } = instruction;
  const slots = vm.slots;
  const advance = instruction.bytes;

  switch (code) {
    case 0x00:
      break;
    case 0x01:
      slots[vm.sp] = toI32(operand);
      vm.sp += 1;
      break;
    case 0x02:
      slots[vm.sp] = slots[vm.frameBase + operand];
      vm.sp += 1;
      break;
    case 0x03:
      slots[vm.sp] = vm.slots194[operand];
      vm.sp += 1;
      break;
    case 0x04: {
      const slot = addressToSlot(vm, slots[vm.sp - 1]);
      slots[vm.sp - 1] = slot < 0 ? 0 : slots[slot];
      break;
    }
    case 0x05:
      slots[vm.sp] = slotToAddress(vm, vm.frameBase + operand);
      vm.sp += 1;
      break;
    case 0x06:
      vm.sp -= 1;
      slots[vm.frameBase + operand] = slots[vm.sp];
      break;
    case 0x07:
      vm.sp -= 1;
      vm.slots194[operand] = slots[vm.sp];
      break;
    case 0x08: {
      vm.sp -= 1;
      const value = slots[vm.sp];
      vm.sp -= 1;
      const slot = addressToSlot(vm, slots[vm.sp]);
      if (slot >= 0) {
        slots[slot] = value;
      }
      break;
    }
    case 0x09:
      for (let index = 0; index < operand; index += 1) {
        slots[vm.sp] = 0;
        vm.sp += 1;
      }
      break;
    case 0x0a: {
      const count = operand & 0x7f;
      if (operand & 0x80) {
        slots[vm.sp - count - 1] = slots[vm.sp - 1];
      }
      vm.sp -= count;
      break;
    }
    case 0x0b:
    case 0x13:
      slots[vm.sp - 2] = toI32(slots[vm.sp - 2] + slots[vm.sp - 1]);
      vm.sp -= 1;
      break;
    case 0x0c:
    case 0x14:
      slots[vm.sp - 2] = toI32(slots[vm.sp - 2] - slots[vm.sp - 1]);
      vm.sp -= 1;
      break;
    case 0x0d:
      slots[vm.sp - 2] = Math.imul(slots[vm.sp - 2], slots[vm.sp - 1]);
      vm.sp -= 1;
      break;
    case 0x0e:
      slots[vm.sp - 2] = divUnsigned(slots[vm.sp - 2], slots[vm.sp - 1]).quotient;
      vm.sp -= 1;
      break;
    case 0x0f:
      slots[vm.sp - 2] = divUnsigned(slots[vm.sp - 2], slots[vm.sp - 1]).remainder;
      vm.sp -= 1;
      break;
    case 0x10:
      slots[vm.sp - 1] = toI32(slots[vm.sp - 1] + 1);
      break;
    case 0x11:
      slots[vm.sp - 1] = toI32(slots[vm.sp - 1] - 1);
      break;
    case 0x12:
      slots[vm.sp] = slots[vm.sp - 1];
      vm.sp += 1;
      break;
    case 0x15:
      slots[vm.sp - 2] = mulFx(slots[vm.sp - 2], slots[vm.sp - 1]);
      vm.sp -= 1;
      break;
    case 0x16:
      slots[vm.sp - 2] = divFx(slots[vm.sp - 2], slots[vm.sp - 1]);
      vm.sp -= 1;
      break;
    case 0x17: {
      const denominator = slots[vm.sp - 1];
      if (denominator === 0) {
        throw vmError("MOD_FX_BY_ZERO_UNTRACED");
      }
      slots[vm.sp - 2] = toI32(slots[vm.sp - 2] % denominator);
      vm.sp -= 1;
      break;
    }
    case 0x18:
      slots[vm.sp - 1] = toI32(slots[vm.sp - 1] + BATTLE_SCRIPT_FX_ONE);
      break;
    case 0x19:
      slots[vm.sp - 1] = toI32(slots[vm.sp - 1] - BATTLE_SCRIPT_FX_ONE);
      break;
    case 0x1a:
      slots[vm.sp - 2] = toI32(slots[vm.sp - 2] + ((slots[vm.sp - 1] >> 12) << 2));
      vm.sp -= 1;
      break;
    case 0x1b:
      slots[vm.sp - 2] = slots[vm.sp - 2] & slots[vm.sp - 1];
      vm.sp -= 1;
      break;
    case 0x1c:
      slots[vm.sp - 2] = slots[vm.sp - 2] | slots[vm.sp - 1];
      vm.sp -= 1;
      break;
    case 0x1d:
      slots[vm.sp - 2] = slots[vm.sp - 2] ^ slots[vm.sp - 1];
      vm.sp -= 1;
      break;
    case 0x1e:
      slots[vm.sp - 2] = slots[vm.sp - 1] !== 0 && slots[vm.sp - 2] !== 0 ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x1f:
      slots[vm.sp - 2] = slots[vm.sp - 1] !== 0 || slots[vm.sp - 2] !== 0 ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x20:
      slots[vm.sp - 1] = slots[vm.sp - 1] === 0 ? 1 : 0;
      break;
    case 0x21:
      slots[vm.sp - 1] = ~slots[vm.sp - 1];
      break;
    case 0x22:
      slots[vm.sp - 1] = toI32(-slots[vm.sp - 1]);
      break;
    case 0x23:
    case 0x25:
      slots[vm.sp - 2] = toI32(slots[vm.sp - 2] << (slots[vm.sp - 1] & 0xff));
      vm.sp -= 1;
      break;
    case 0x24:
      slots[vm.sp - 2] = toI32(toU32(slots[vm.sp - 2]) >>> (slots[vm.sp - 1] & 0xff));
      vm.sp -= 1;
      break;
    case 0x26:
      slots[vm.sp - 2] = slots[vm.sp - 2] >> (slots[vm.sp - 1] & 0xff);
      vm.sp -= 1;
      break;
    case 0x27: {
      const left = toU32(slots[vm.sp - 2]);
      const right = toU32(slots[vm.sp - 1]);
      slots[vm.sp - 2] = left < right ? -1 : left > right ? 1 : 0;
      vm.sp -= 1;
      break;
    }
    case 0x28:
      vm.pc = operand;
      return instruction;
    case 0x29:
      vm.sp -= 1;
      if (slots[vm.sp] === 0) {
        vm.pc = operand;
        return instruction;
      }
      break;
    case 0x2a:
      vm.sp -= 1;
      if (slots[vm.sp] !== 0) {
        vm.pc = operand;
        return instruction;
      }
      break;
    case 0x2b:
      slots[vm.sp - 2] = slots[vm.sp - 2] === slots[vm.sp - 1] ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x2c:
      slots[vm.sp - 2] = slots[vm.sp - 2] !== slots[vm.sp - 1] ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x2d:
      slots[vm.sp - 2] = slots[vm.sp - 2] < slots[vm.sp - 1] ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x2e:
      slots[vm.sp - 2] = slots[vm.sp - 2] <= slots[vm.sp - 1] ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x2f:
      slots[vm.sp - 2] = slots[vm.sp - 2] >= slots[vm.sp - 1] ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x30:
      slots[vm.sp - 2] = slots[vm.sp - 2] > slots[vm.sp - 1] ? 1 : 0;
      vm.sp -= 1;
      break;
    case 0x31: {
      if (vm.sp >= BATTLE_SCRIPT_CALL_STACK_LIMIT) {
        // The original prints "Script Stack Overflow!" and then pushes anyway,
        // over sp and frameBase. That overrun is a defect, not a behavior.
        throw vmError("STACK_OVERFLOW_ON_CALL");
      }
      slots[vm.sp] = vm.pc + 5;
      vm.sp += 1;
      slots[vm.sp] = vm.frameBase;
      vm.sp += 1;
      vm.frameBase = vm.sp;
      vm.pc = operand;
      return instruction;
    }
    case 0x32: {
      if (vm.sp >= BATTLE_SCRIPT_CALL_NATIVE_STACK_LIMIT) {
        throw vmError("STACK_OVERFLOW_ON_CALL_NATIVE");
      }
      if (typeof vm.callNative !== "function") {
        throw vmError(`NATIVE_NOT_PROVIDED: 0x${operand.toString(16)}`);
      }
      slots[vm.sp] = toI32(vm.callNative(operand, vm));
      vm.sp += 1;
      break;
    }
    case 0x33: {
      vm.sp -= 1;
      const returned = slots[vm.sp];
      vm.sp = vm.frameBase - 1;
      vm.frameBase = slots[vm.sp];
      vm.sp -= 1;
      vm.pc = slots[vm.sp];
      if (vm.pc === 0) {
        vm.flags &= ~(BATTLE_SCRIPT_FLAG_RUNNING | BATTLE_SCRIPT_FLAG_ACTIVE);
        return instruction;
      }
      slots[vm.sp] = returned;
      vm.sp += 1;
      return instruction;
    }
    default:
      throw vmError(`UNHANDLED_OPCODE: 0x${code.toString(16)}`);
  }

  vm.pc += advance;
  return instruction;
}

/**
 * ARM9 0x02054980. Runs until a native clears the keep-running bit or the
 * script returns through its zero frame. `budget` bounds a run that never
 * yields; the original has no such bound and would simply hang.
 */
export function runBattleScript(vm, script, origin = 0, budget = 1000000) {
  if (!isBattleScriptActive(vm)) {
    return 0;
  }
  if (vm.pc === 0) {
    vm.flags &= ~BATTLE_SCRIPT_FLAG_ACTIVE;
    return 0;
  }
  vm.flags |= BATTLE_SCRIPT_FLAG_RUNNING;
  let executed = 0;
  while ((vm.flags & BATTLE_SCRIPT_FLAG_RUNNING) !== 0) {
    if (executed >= budget) {
      throw vmError("RUN_BUDGET_EXHAUSTED");
    }
    stepBattleScript(vm, script, origin);
    executed += 1;
  }
  return executed;
}
