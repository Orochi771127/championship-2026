// Battle script VM — the 52-opcode table at ARM9 0x020BDEAC and OVL19's blob.
//
// The decisive case is `the whole blob decodes with no byte left over`: with the
// operand sizes this module claims, a linear decode of all 63,748 bytes lands
// exactly on the byte where ARM code resumes and every branch target falls on an
// instruction boundary. One wrong size desynchronises the stream and both fail.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_SCRIPT_CALL_NATIVE_STACK_LIMIT,
  BATTLE_SCRIPT_CALL_STACK_LIMIT,
  BATTLE_SCRIPT_FLAG_ACTIVE,
  BATTLE_SCRIPT_FLAG_RUNNING,
  BATTLE_SCRIPT_FX_ONE,
  BATTLE_SCRIPT_IDENTICAL_HANDLER_PAIRS,
  BATTLE_SCRIPT_OPCODES,
  BATTLE_SCRIPT_OPCODE_COUNT,
  BATTLE_SCRIPT_OPCODE_TABLE_BASE,
  BATTLE_SCRIPT_OPCODE_TABLE_STRIDE,
  BATTLE_SCRIPT_SLOT_COUNT,
  BATTLE_SCRIPT_VM_DISPATCH_SITE,
  BATTLE_SCRIPT_VM_EVIDENCE,
  createBattleScriptVm,
  decodeBattleScriptInstruction,
  decodeBattleScriptRoutine,
  getBattleScriptOpcode,
  initBattleScript,
  isBattleScriptActive,
  readBattleScriptArgument,
  runBattleScript,
  stepBattleScript,
  yieldBattleScript
} from "../src/championship/battle/battleScriptVm.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-scripts.r1.json"), "utf8")
);
const BLOB = Buffer.from(CATALOG.blob.base64, "base64");
const ORIGIN = Number.parseInt(CATALOG.blob.ramBase, 16);

const OP = Object.fromEntries(BATTLE_SCRIPT_OPCODES.map((entry) => [entry.name, entry.code]));

// A hand-built program. `origin` is deliberately non-zero: a pc of 0 is the
// original's "no caller" sentinel, so a script may never live at address 0.
const TEST_ORIGIN = 0x1000;

function assemble(items) {
  const out = [];
  for (const item of items) {
    if (typeof item === "number") {
      out.push(item & 0xff);
    } else if (item.imm32 !== undefined) {
      const value = item.imm32 >>> 0;
      out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function machine(program, { args = [], callNative = null, objectBase = 0 } = {}) {
  const vm = createBattleScriptVm({ callNative, objectBase });
  initBattleScript(vm, TEST_ORIGIN, args);
  return { vm, script: program, step: () => stepBattleScript(vm, program, TEST_ORIGIN) };
}

/** Run `count` instructions of a program that starts at TEST_ORIGIN. */
function runSteps(program, count, options = {}) {
  const context = machine(program, options);
  for (let index = 0; index < count; index += 1) {
    context.step();
  }
  return context.vm;
}

test("the opcode table is 52 entries and the module agrees with the catalog", () => {
  assert.equal(BATTLE_SCRIPT_VM_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_SCRIPT_VM_DISPATCH_SITE, "ARM9:0x020549D4");
  assert.equal(BATTLE_SCRIPT_OPCODE_COUNT, 52);
  assert.equal(BATTLE_SCRIPT_OPCODE_TABLE_BASE, 0x020bdeac);
  assert.equal(BATTLE_SCRIPT_OPCODE_TABLE_STRIDE, 8);
  assert.equal(BATTLE_SCRIPT_OPCODES.length, 52);
  assert.equal(CATALOG.vm.opcodeCount, 52);

  // Entry 52 would begin at the assert strings the two stack checks point at.
  assert.equal(
    BATTLE_SCRIPT_OPCODE_TABLE_BASE + BATTLE_SCRIPT_OPCODE_COUNT * BATTLE_SCRIPT_OPCODE_TABLE_STRIDE,
    0x020be04c
  );
  assert.match(CATALOG.vm.opcodeCountEvidence, /Script Stack Overflow/);

  const handlers = new Set();
  BATTLE_SCRIPT_OPCODES.forEach((entry, index) => {
    assert.equal(entry.code, index);
    assert.equal(entry.handler, Number.parseInt(CATALOG.opcodes[index].handler, 16), entry.name);
    assert.equal(entry.name, CATALOG.opcodes[index].name);
    assert.equal(entry.bytes, CATALOG.opcodes[index].bytes, entry.name);
    assert.equal(handlers.has(entry.handler), false, `duplicate handler for ${entry.name}`);
    handlers.add(entry.handler);
  });
});

test("operand sizes are exactly the seven one-byte and six four-byte forms", () => {
  const twoByte = BATTLE_SCRIPT_OPCODES.filter((entry) => entry.bytes === 2).map((entry) => entry.code);
  const fiveByte = BATTLE_SCRIPT_OPCODES.filter((entry) => entry.bytes === 5).map((entry) => entry.code);
  assert.deepEqual(twoByte, [0x02, 0x03, 0x05, 0x06, 0x07, 0x09, 0x0a]);
  assert.deepEqual(fiveByte, [0x01, 0x28, 0x29, 0x2a, 0x31, 0x32]);
  assert.equal(BATTLE_SCRIPT_OPCODES.filter((entry) => entry.bytes === 1).length, 39);
  // The four operands that hold a slot index are read with ldrsb, not ldrb.
  const signed = BATTLE_SCRIPT_OPCODES.filter((entry) => entry.signedOperand).map((entry) => entry.code);
  assert.deepEqual(signed, [0x02, 0x03, 0x05, 0x06, 0x07]);
  assert.throws(() => getBattleScriptOpcode(0x34), /UNKNOWN_OPCODE/);
});

test("the whole blob decodes with no byte left over", () => {
  assert.equal(BLOB.length, 63748);
  assert.equal(ORIGIN, 0x021204a0);
  assert.equal(Number.parseInt(CATALOG.blob.ramEnd, 16), ORIGIN + BLOB.length);

  const boundaries = new Set();
  const counts = new Map();
  let address = ORIGIN;
  let executed = 0;
  while (address < ORIGIN + BLOB.length) {
    const instruction = decodeBattleScriptInstruction(BLOB, address, ORIGIN);
    boundaries.add(instruction.address);
    counts.set(instruction.code, (counts.get(instruction.code) ?? 0) + 1);
    address += instruction.bytes;
    executed += 1;
  }
  assert.equal(address, ORIGIN + BLOB.length, "the decode must close exactly on the end of the blob");
  assert.equal(executed, 23121);
  assert.equal(executed, CATALOG.blob.instructionCount);

  // Every branch target lands on a boundary. 1,290 chances to be wrong.
  let branches = 0;
  address = ORIGIN;
  while (address < ORIGIN + BLOB.length) {
    const instruction = decodeBattleScriptInstruction(BLOB, address, ORIGIN);
    if (instruction.target !== undefined) {
      branches += 1;
      assert.equal(boundaries.has(instruction.target), true,
        `target 0x${instruction.target.toString(16)} from 0x${address.toString(16)}`);
    }
    address += instruction.bytes;
  }
  assert.equal(branches, 1290);

  // The per-opcode counts the catalog records are the ones a decode produces.
  for (const entry of CATALOG.opcodes) {
    assert.equal(counts.get(entry.code) ?? 0, entry.occurrencesInBattleScripts, entry.name);
  }
  assert.equal(counts.get(OP.CALL_NATIVE), 3014);
  assert.equal(counts.get(OP.RETURN), 53);
});

test("every move record's script entry is a routine that reaches a RETURN", () => {
  assert.equal(CATALOG.moveRecordEntryPoints.length, 36);
  for (const text of CATALOG.moveRecordEntryPoints) {
    const entry = Number.parseInt(text, 16);
    const routine = decodeBattleScriptRoutine(BLOB, entry, ORIGIN);
    assert.equal(routine.at(-1).code, OP.RETURN, text);
    assert.ok(routine.length > 1, text);
  }
  // 67 native targets, all inside OVL19's code, none of them traced.
  assert.equal(CATALOG.nativeTargets.length, 67);
  for (const native of CATALOG.nativeTargets) {
    const address = Number.parseInt(native.address, 16);
    assert.ok(address >= 0x0211cdfc && address <= 0x0211ea68, native.address);
  }
});

test("init lays out the frame the way RETURN expects to find it", () => {
  const vm = createBattleScriptVm();
  initBattleScript(vm, TEST_ORIGIN, [11, 22, 33]);
  // Arguments go on in reverse, then a zero return address and a zero frame base.
  assert.deepEqual([...vm.slots.slice(0, 5)], [33, 22, 11, 0, 0]);
  assert.equal(vm.sp, 5);
  assert.equal(vm.frameBase, 5);
  assert.equal(vm.flags, BATTLE_SCRIPT_FLAG_ACTIVE);
  // readBattleScriptArgument is the helper natives use: index 0 is the top.
  assert.equal(readBattleScriptArgument(vm, 0), 0);
  assert.equal(readBattleScriptArgument(vm, 2), 11);

  // A script address of 0 is the sentinel, so init leaves the VM inactive.
  const empty = createBattleScriptVm();
  initBattleScript(empty, 0);
  assert.equal(isBattleScriptActive(empty), false);
});

test("RETURN through the zero frame stops the script and drops the value", () => {
  const program = assemble([OP.PUSH_IMM32, { imm32: 42 }, OP.RETURN]);
  const vm = createBattleScriptVm();
  initBattleScript(vm, TEST_ORIGIN);
  const executed = runBattleScript(vm, program, TEST_ORIGIN);
  assert.equal(executed, 2);
  assert.equal(isBattleScriptActive(vm), false);
  assert.equal(vm.pc, 0);
  assert.equal(vm.sp, 0);
  assert.equal(vm.frameBase, 0);
});

test("CALL saves the return address and frame base, RETURN restores both", () => {
  // 0x1000 CALL 0x1006 ; 0x1005 RETURN ; 0x1006 PUSH 7 ; RETURN
  const program = assemble([
    OP.CALL, { imm32: TEST_ORIGIN + 6 },
    OP.RETURN,
    OP.PUSH_IMM32, { imm32: 7 },
    OP.RETURN
  ]);
  const context = machine(program);
  const { vm } = context;
  const outerFrame = vm.frameBase;

  context.step();
  assert.equal(vm.pc, TEST_ORIGIN + 6);
  assert.equal(vm.slots[outerFrame], TEST_ORIGIN + 5, "return address is pc + 5");
  assert.equal(vm.slots[outerFrame + 1], outerFrame, "the caller's frame base is saved");
  assert.equal(vm.frameBase, outerFrame + 2);

  context.step();
  context.step();
  assert.equal(vm.pc, TEST_ORIGIN + 5, "control returns after the CALL");
  assert.equal(vm.frameBase, outerFrame);
  assert.equal(vm.slots[vm.sp - 1], 7, "the callee's value is pushed into the caller");
  assert.equal(isBattleScriptActive(vm), true);

  context.step();
  assert.equal(isBattleScriptActive(vm), false);
});

test("locals are frame-relative and the operand is signed", () => {
  const vm = createBattleScriptVm();
  initBattleScript(vm, TEST_ORIGIN, [5, 9]);
  // frameBase is 4; local -4 is the first argument slot.
  const program = assemble([OP.PUSH_LOCAL, 0xfc, OP.PUSH_LOCAL, 0xfd, OP.POP_TO_LOCAL, 0xfc]);
  stepBattleScript(vm, program, TEST_ORIGIN);
  assert.equal(vm.slots[vm.sp - 1], 9, "local -4 is the last argument pushed");
  stepBattleScript(vm, program, TEST_ORIGIN);
  assert.equal(vm.slots[vm.sp - 1], 5);
  stepBattleScript(vm, program, TEST_ORIGIN);
  assert.equal(vm.slots[vm.frameBase - 4], 5, "POP_TO_LOCAL writes back through the same index");
});

test("PUSH_ZEROS reserves locals and POP_N optionally carries the top down", () => {
  const reserve = runSteps(assemble([OP.PUSH_ZEROS, 4]), 1);
  assert.equal(reserve.sp, 6);
  assert.deepEqual([...reserve.slots.slice(2, 6)], [0, 0, 0, 0]);

  // Without bit 7 the top is discarded with the rest.
  const plain = runSteps(assemble([
    OP.PUSH_IMM32, { imm32: 1 }, OP.PUSH_IMM32, { imm32: 2 },
    OP.PUSH_IMM32, { imm32: 99 }, OP.POP_N, 3
  ]), 4);
  assert.equal(plain.sp, 2);

  // With bit 7 the top survives n slots down, which is how a call returns.
  const keeping = runSteps(assemble([
    OP.PUSH_IMM32, { imm32: 1 }, OP.PUSH_IMM32, { imm32: 2 },
    OP.PUSH_IMM32, { imm32: 99 }, OP.POP_N, 0x82
  ]), 4);
  assert.equal(keeping.sp, 3);
  assert.equal(keeping.slots[keeping.sp - 1], 99);
});

test("indirect access is bounded to the VM's own slot array", () => {
  // Locals and the operand stack share one array, so a routine reserves its
  // locals first; without PUSH_ZEROS, local 0 is the next slot the stack uses.
  const program = assemble([
    OP.PUSH_ZEROS, 2,
    OP.PUSH_IMM32, { imm32: 77 }, OP.POP_TO_LOCAL, 0x00,
    OP.PUSH_LOCAL_ADDRESS, 0x00, OP.LOAD_INDIRECT
  ]);
  const vm = runSteps(program, 5);
  assert.equal(vm.slots[vm.sp - 1], 77);

  // An address outside [base+8, base+0x184] reads as 0 rather than faulting.
  const outside = runSteps(assemble([OP.PUSH_IMM32, { imm32: 0x0210b300 }, OP.LOAD_INDIRECT]), 2);
  assert.equal(outside.slots[outside.sp - 1], 0);

  // And a store through such an address is dropped.
  const dropped = runSteps(assemble([
    OP.PUSH_IMM32, { imm32: 0x0210b300 }, OP.PUSH_IMM32, { imm32: 5 }, OP.STORE_INDIRECT
  ]), 3);
  assert.equal(dropped.sp, 2);
});

test("integer and fixed-point arithmetic are the two families the ROM splits", () => {
  const binary = (code, left, right) => {
    const vm = runSteps(assemble([
      OP.PUSH_IMM32, { imm32: left }, OP.PUSH_IMM32, { imm32: right }, code
    ]), 3);
    return vm.slots[vm.sp - 1];
  };

  assert.equal(binary(OP.ADD, 7, 5), 12);
  assert.equal(binary(OP.SUB, 7, 5), 2);
  assert.equal(binary(OP.MUL, 7, 5), 35);
  assert.equal(binary(OP.MUL, 0x40000000, 4), 0, "MUL wraps at 32 bits, as mul does");
  assert.equal(binary(OP.DIV_UNSIGNED, 17, 5), 3);
  assert.equal(binary(OP.MOD_UNSIGNED, 17, 5), 2);
  // 0x0202B764 returns with r0 and r1 untouched when the denominator is zero.
  assert.equal(binary(OP.DIV_UNSIGNED, 17, 0), 17);
  assert.equal(binary(OP.MOD_UNSIGNED, 17, 0), 0);

  // Q12: 2.5 * 4.0 = 10.0, with the +0x800 rounding the ROM applies.
  assert.equal(binary(OP.MUL_FX, 2.5 * 0x1000, 4 * 0x1000), 10 * 0x1000);
  assert.equal(binary(OP.MUL_FX, 1, 1), 0, "0x800 rounds a sub-unit product to zero");
  assert.equal(binary(OP.MUL_FX, 0x800, 1), 1, "and rounds one half-unit up");
  assert.equal(binary(OP.DIV_FX, 10 * 0x1000, 4 * 0x1000), 2.5 * 0x1000);
  assert.equal(binary(OP.DIV_FX, -0x1000, 2 * 0x1000), -0x800);
  assert.equal(binary(OP.MOD_FX, 7 * 0x1000, 2 * 0x1000), 0x1000);

  // ADD_FX/SUB_FX share their handler with ADD/SUB, so they must agree.
  assert.equal(binary(OP.ADD_FX, 7, 5), binary(OP.ADD, 7, 5));
  assert.equal(binary(OP.SUB_FX, 7, 5), binary(OP.SUB, 7, 5));
  assert.equal(binary(OP.SHL_2, 3, 4), binary(OP.SHL, 3, 4));
  assert.deepEqual(
    BATTLE_SCRIPT_IDENTICAL_HANDLER_PAIRS.map((pair) => pair.slice()),
    [[0x0b, 0x13], [0x0c, 0x14], [0x23, 0x25]]
  );

  // The step opcodes are what prove the two families apart.
  const unary = (code, value) => {
    const vm = runSteps(assemble([OP.PUSH_IMM32, { imm32: value }, code]), 2);
    return vm.slots[vm.sp - 1];
  };
  assert.equal(unary(OP.INC, 5), 6);
  assert.equal(unary(OP.DEC, 5), 4);
  assert.equal(unary(OP.INC_FX, 5), 5 + BATTLE_SCRIPT_FX_ONE);
  assert.equal(unary(OP.DEC_FX, 5), 5 - BATTLE_SCRIPT_FX_ONE);
  assert.equal(BATTLE_SCRIPT_FX_ONE, 0x1000);

  // SDK DIV_FX rounds the signed hardware result back to zero (R7 CPU oracle).
  // MOD_FX's separate helper remains untraced for a zero divisor.
  assert.equal(binary(OP.DIV_FX, 1, 0), 0);
  assert.throws(() => binary(OP.MOD_FX, 1, 0), /MOD_FX_BY_ZERO_UNTRACED/);
});

test("logic, shifts and comparisons keep the ROM's signedness", () => {
  const binary = (code, left, right) => {
    const vm = runSteps(assemble([
      OP.PUSH_IMM32, { imm32: left }, OP.PUSH_IMM32, { imm32: right }, code
    ]), 3);
    return vm.slots[vm.sp - 1];
  };
  assert.equal(binary(OP.AND, 0b1100, 0b1010), 0b1000);
  assert.equal(binary(OP.OR, 0b1100, 0b1010), 0b1110);
  assert.equal(binary(OP.XOR, 0b1100, 0b1010), 0b0110);
  assert.equal(binary(OP.LOGICAL_AND, 3, 4), 1);
  assert.equal(binary(OP.LOGICAL_AND, 3, 0), 0);
  assert.equal(binary(OP.LOGICAL_OR, 0, 4), 1);
  assert.equal(binary(OP.LOGICAL_OR, 0, 0), 0);

  // 0x24 is lsr and 0x26 is asr: the pair is the whole reason both exist.
  assert.equal(binary(OP.SHR_LOGICAL, -16, 1), 0x7ffffff8);
  assert.equal(binary(OP.SHR_ARITHMETIC, -16, 1), -8);
  assert.equal(binary(OP.SHL, 3, 4), 48);

  // 0x2B..0x30 use lt/le/ge/gt, so they are signed.
  assert.equal(binary(OP.EQ, 5, 5), 1);
  assert.equal(binary(OP.NE, 5, 5), 0);
  assert.equal(binary(OP.LT, -1, 1), 1);
  assert.equal(binary(OP.LE, 5, 5), 1);
  assert.equal(binary(OP.GE, -1, 1), 0);
  assert.equal(binary(OP.GT, 1, -1), 1);

  // 0x27 uses lo/hi, so its three-way answer is unsigned: -1 is the larger.
  assert.equal(binary(OP.COMPARE3_UNSIGNED, -1, 1), 1);
  assert.equal(binary(OP.COMPARE3_UNSIGNED, 1, -1), -1);
  assert.equal(binary(OP.COMPARE3_UNSIGNED, 4, 4), 0);

  const unary = (code, value) => {
    const vm = runSteps(assemble([OP.PUSH_IMM32, { imm32: value }, code]), 2);
    return vm.slots[vm.sp - 1];
  };
  assert.equal(unary(OP.LOGICAL_NOT, 0), 1);
  assert.equal(unary(OP.LOGICAL_NOT, 9), 0);
  assert.equal(unary(OP.BITWISE_NOT, 0), -1);
  assert.equal(unary(OP.NEGATE, 9), -9);

  // DUP and INDEX_FX round out the stack shuffling.
  const duplicated = runSteps(assemble([OP.PUSH_IMM32, { imm32: 8 }, OP.DUP]), 2);
  assert.equal(duplicated.sp, 4);
  assert.equal(duplicated.slots[duplicated.sp - 1], 8);
  assert.equal(duplicated.slots[duplicated.sp - 2], 8);
  // element size 4, index taken as the whole part of a Q12 value
  assert.equal(binary(OP.INDEX_FX, 0x100, 3 * 0x1000), 0x100 + 12);
});

test("the three branch opcodes take the ROM's polarity", () => {
  const jumped = (code, value) => {
    const program = assemble([
      OP.PUSH_IMM32, { imm32: value }, code, { imm32: TEST_ORIGIN + 0x40 }
    ]);
    const vm = runSteps(program, 2);
    return vm.pc === TEST_ORIGIN + 0x40;
  };
  assert.equal(jumped(OP.JUMP_IF_ZERO, 0), true);
  assert.equal(jumped(OP.JUMP_IF_ZERO, 1), false);
  assert.equal(jumped(OP.JUMP_IF_NONZERO, 1), true);
  assert.equal(jumped(OP.JUMP_IF_NONZERO, 0), false);

  const plain = runSteps(assemble([OP.JUMP, { imm32: TEST_ORIGIN + 0x40 }]), 1);
  assert.equal(plain.pc, TEST_ORIGIN + 0x40);
  // A conditional branch that does not take pops its test value and moves on 5.
  const fellThrough = runSteps(assemble([
    OP.PUSH_IMM32, { imm32: 1 }, OP.JUMP_IF_ZERO, { imm32: TEST_ORIGIN + 0x40 }
  ]), 2);
  assert.equal(fellThrough.pc, TEST_ORIGIN + 10);
  assert.equal(fellThrough.sp, 2);
});

test("CALL_NATIVE dispatches outward and pushes what the handler returns", () => {
  const seen = [];
  const program = assemble([OP.CALL_NATIVE, { imm32: 0x0211cdfc }, OP.RETURN]);
  const vm = createBattleScriptVm({
    callNative(address, machineState) {
      seen.push(address);
      assert.equal(machineState.pc, TEST_ORIGIN);
      return 0x1234;
    }
  });
  initBattleScript(vm, TEST_ORIGIN);
  stepBattleScript(vm, program, TEST_ORIGIN);
  assert.deepEqual(seen, [0x0211cdfc]);
  assert.equal(vm.slots[vm.sp - 1], 0x1234);
  assert.equal(vm.pc, TEST_ORIGIN + 5);

  // With no handler the module refuses rather than inventing a result.
  const bare = createBattleScriptVm();
  initBattleScript(bare, TEST_ORIGIN);
  assert.throws(() => stepBattleScript(bare, program, TEST_ORIGIN), /NATIVE_NOT_PROVIDED/);
});

test("a native can yield, which is how the run loop gives up the frame", () => {
  const program = assemble([
    OP.CALL_NATIVE, { imm32: 0x0211cdfc }, OP.POP_N, 1,
    OP.CALL_NATIVE, { imm32: 0x0211cdfc }, OP.POP_N, 1,
    OP.PUSH_IMM32, { imm32: 0 }, OP.RETURN
  ]);
  const vm = createBattleScriptVm({
    callNative() {
      yieldBattleScript(vm);
      return 0;
    }
  });
  initBattleScript(vm, TEST_ORIGIN);
  assert.equal(runBattleScript(vm, program, TEST_ORIGIN), 1, "the loop stops after the native");
  assert.equal(isBattleScriptActive(vm), true);
  assert.equal((vm.flags & BATTLE_SCRIPT_FLAG_RUNNING) === 0, true);
  runBattleScript(vm, program, TEST_ORIGIN);
  runBattleScript(vm, program, TEST_ORIGIN);
  assert.equal(isBattleScriptActive(vm), false);
});

test("the two stack guards are the ones the ROM compares against", () => {
  assert.equal(BATTLE_SCRIPT_CALL_STACK_LIMIT, 0x5e);
  assert.equal(BATTLE_SCRIPT_CALL_NATIVE_STACK_LIMIT, 0x60);
  assert.equal(BATTLE_SCRIPT_SLOT_COUNT, 96);
  assert.equal(CATALOG.vm.callStackLimit, 0x5e);
  assert.equal(CATALOG.vm.callNativeStackLimit, 0x60);
  assert.equal(CATALOG.vm.slotCount, 96);

  const call = createBattleScriptVm();
  initBattleScript(call, TEST_ORIGIN);
  call.sp = BATTLE_SCRIPT_CALL_STACK_LIMIT;
  assert.throws(
    () => stepBattleScript(call, assemble([OP.CALL, { imm32: TEST_ORIGIN }]), TEST_ORIGIN),
    /STACK_OVERFLOW_ON_CALL$/
  );

  const twoNatives = assemble([
    OP.CALL_NATIVE, { imm32: 1 },
    OP.CALL_NATIVE, { imm32: 1 }
  ]);
  const native = createBattleScriptVm({ callNative: () => 0 });
  initBattleScript(native, TEST_ORIGIN);
  native.sp = BATTLE_SCRIPT_CALL_NATIVE_STACK_LIMIT - 1;
  stepBattleScript(native, twoNatives, TEST_ORIGIN);
  assert.equal(native.sp, BATTLE_SCRIPT_CALL_NATIVE_STACK_LIMIT, "the last free slot is usable");
  assert.throws(
    () => stepBattleScript(native, twoNatives, TEST_ORIGIN),
    /STACK_OVERFLOW_ON_CALL_NATIVE/
  );
});

test("the original scripts execute without leaving the machine's own bounds", () => {
  // The natives are not traced, so this stub returns 1.0 in Q12 and yields, the
  // way a real one would give the frame back. It is a smoke test of the VM, not
  // a claim about what any native does.
  let completed = 0;
  let maximumStack = 0;
  const failures = new Map();
  for (const text of CATALOG.moveRecordEntryPoints) {
    const vm = createBattleScriptVm({
      callNative() {
        yieldBattleScript(vm);
        return BATTLE_SCRIPT_FX_ONE;
      }
    });
    initBattleScript(vm, Number.parseInt(text, 16), [0, 0, 0, 0]);
    try {
      for (let frame = 0; frame < 20000 && isBattleScriptActive(vm); frame += 1) {
        runBattleScript(vm, BLOB, ORIGIN, 100000);
        maximumStack = Math.max(maximumStack, vm.sp);
      }
      if (!isBattleScriptActive(vm)) {
        completed += 1;
      }
    } catch (error) {
      const kind = error.message.split(":")[0];
      failures.set(kind, (failures.get(kind) ?? 0) + 1);
    }
  }
  assert.equal(completed, 33);
  assert.ok(maximumStack <= BATTLE_SCRIPT_SLOT_COUNT, `stack reached ${maximumStack}`);
  assert.deepEqual([...failures], [], 'No decode fault, unaligned access or overflow, including zero-distance division');
});

test("the eighteen opcodes the battle scripts never use are recorded, not dropped", () => {
  assert.deepEqual(CATALOG.opcodesUnusedByBattleScripts, [
    0x03, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11,
    0x1d, 0x1e, 0x1f, 0x21, 0x23, 0x24, 0x25, 0x26, 0x27
  ]);
  // The integer arithmetic family is entirely unused: these scripts are Q12.
  for (const code of [0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11]) {
    assert.equal(CATALOG.opcodes[code].occurrencesInBattleScripts, 0);
  }
  for (const code of [0x13, 0x14, 0x15, 0x16, 0x18, 0x19]) {
    assert.ok(CATALOG.opcodes[code].occurrencesInBattleScripts > 0, `0x${code.toString(16)}`);
  }
  // They are still implemented, because the VM is the ROM's, not the scripts'.
  assert.equal(BATTLE_SCRIPT_OPCODES.length, 52);
});

test("the script builder takes the ROM path from the caller and hard-codes no drive", () => {
  const builder = fs.readFileSync(path.join(root, "scripts/build-battle-script-catalog.py"), "utf8");
  assert.match(builder, /os\.environ\.get\("YDIJ_ROM"\)/);
  assert.match(builder, /encoding="utf-8", newline="\\n"/);
  assert.doesNotMatch(builder, /[A-Za-z]:\\\\/, "no absolute Windows path may be baked into the builder");
  assert.doesNotMatch(builder, /NEXUS/, "the builder must not read a research pack");
});

test("the VM imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleScriptVm.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
