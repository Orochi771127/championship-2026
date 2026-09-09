// Move scripts — the three script entry columns of a move record.
//
// The case that matters most is the last one: it decodes the built-in script
// out of the committed blob with the product decoder and checks that its
// prologue reads exactly the locals the six-argument frame predicts. That ties
// B1's catalog, B2's VM and B4's routine together with nothing taken on trust.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_MOVE_RECORD_OFFSET,
  BATTLE_MOVE_SCRIPT_ARGUMENTS,
  BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT,
  BATTLE_MOVE_SCRIPT_BUILTIN,
  BATTLE_MOVE_SCRIPT_BUILTIN_BYTES,
  BATTLE_MOVE_SCRIPT_BUILTIN_INSTRUCTIONS,
  BATTLE_MOVE_SCRIPT_CALL_FRAME_OVERHEAD,
  BATTLE_MOVE_SCRIPT_DEEPEST_LOCAL,
  BATTLE_MOVE_SCRIPT_DEEP_FRAME,
  BATTLE_MOVE_SCRIPT_ENTRIES,
  BATTLE_MOVE_SCRIPT_EVIDENCE,
  BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL,
  BATTLE_MOVE_SCRIPT_INIT_ARGUMENT_COUNTS,
  BATTLE_MOVE_SCRIPT_INIT_SITE_COUNT,
  BATTLE_MOVE_SCRIPT_Q12_FIELDS,
  BATTLE_MOVE_SCRIPT_Q12_SHIFT,
  argumentLocalIndex,
  buildMoveScriptArguments,
  getMoveScriptEntry,
  localArgumentIndex,
  moveFieldToQ12,
  resolveMoveScriptAddress
} from "../src/championship/battle/battleMoveScript.js";

import {
  BATTLE_SCRIPT_FX_ONE,
  decodeBattleScriptInstruction,
  decodeBattleScriptRoutine
} from "../src/championship/battle/battleScriptVm.js";

import { getBattleCatalog, listBattleCatalogRecords } from "../src/championship/battle/battleCatalogs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-scripts.r1.json"), "utf8")
);
const BLOB = Buffer.from(SCRIPTS.blob.base64, "base64");
const ORIGIN = Number.parseInt(SCRIPTS.blob.ramBase, 16);

test("the three entry columns are the ones B1 catalogued", () => {
  assert.equal(BATTLE_MOVE_SCRIPT_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_MOVE_RECORD_OFFSET, 0x20);
  assert.deepEqual(BATTLE_MOVE_SCRIPT_ENTRIES.map((entry) => entry.offset), [0x1c, 0x28, 0x3c]);
  assert.deepEqual(BATTLE_MOVE_SCRIPT_ENTRIES.map((entry) => entry.field),
    ["pointer1C", "pointer28", "pointer3C"]);

  // The move catalog carries exactly those three columns, by those names.
  const fieldMap = getBattleCatalog("moves").fieldMap;
  for (const entry of BATTLE_MOVE_SCRIPT_ENTRIES) {
    const declared = fieldMap.find((field) => field.name === entry.field);
    assert.ok(declared, entry.field);
    assert.equal(declared.offset, entry.offset);
    assert.equal(declared.width, "u32");
  }
  // Two run on the combatant's VM, one on the action's.
  assert.deepEqual(BATTLE_MOVE_SCRIPT_ENTRIES.map((entry) => entry.vmOffset), [0xec, 0xec, 0x2a0]);
});

test("every value in those columns is a real script entry in the blob", () => {
  const moves = listBattleCatalogRecords("moves");
  const boundaries = new Set();
  let address = ORIGIN;
  while (address < ORIGIN + BLOB.length) {
    const instruction = decodeBattleScriptInstruction(BLOB, address, ORIGIN);
    boundaries.add(address);
    address += instruction.bytes;
  }
  let checked = 0;
  for (const record of moves) {
    for (const entry of BATTLE_MOVE_SCRIPT_ENTRIES) {
      const value = record[entry.field];
      if (value === 0) {
        continue;
      }
      assert.ok(boundaries.has(value), `${entry.field} of move ${record.recordIndex}`);
      checked += 1;
    }
  }
  // 595 + 565 + 595 non-null values across the three columns.
  assert.equal(checked, 1755);
});

test("the six-argument frame is the one the routine builds", () => {
  assert.equal(BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT, 6);
  assert.equal(BATTLE_MOVE_SCRIPT_ARGUMENTS.length, 6);
  assert.deepEqual(BATTLE_MOVE_SCRIPT_ARGUMENTS.map((a) => a.source), [
    "POINTER", "POINTER", "ACTION_OBJECT",
    "MOVE_FIELD_Q12", "BASE_PLUS_MOVE_FIELD_Q12", "BASE_PLUS_MOVE_FIELD_Q12"
  ]);
  assert.deepEqual(
    BATTLE_MOVE_SCRIPT_ARGUMENTS.filter((a) => a.moveField !== undefined).map((a) => a.moveField),
    [0x43, 0x40, 0x41]
  );
  for (const argument of BATTLE_MOVE_SCRIPT_ARGUMENTS) {
    assert.match(argument.site, /^OVL19:0x0211D[0-9A-F]{3}$/);
  }
});

test("the move fields those arguments carry are signed bytes read as Q12", () => {
  assert.equal(BATTLE_MOVE_SCRIPT_Q12_SHIFT, 12);
  assert.equal(moveFieldToQ12(0), 0);
  assert.equal(moveFieldToQ12(1), BATTLE_SCRIPT_FX_ONE);
  assert.equal(moveFieldToQ12(-1), -BATTLE_SCRIPT_FX_ONE);
  assert.equal(moveFieldToQ12(127), 127 * 0x1000);
  assert.throws(() => moveFieldToQ12(128), /SIGNED_BYTE_OUT_OF_RANGE/);
  assert.throws(() => moveFieldToQ12(-129), /SIGNED_BYTE_OUT_OF_RANGE/);

  // Every one is a B1 field read with ldrsb, but only two are constant zero.
  const fieldMap = getBattleCatalog("moves").fieldMap;
  for (const offset of BATTLE_MOVE_SCRIPT_Q12_FIELDS) {
    const declared = fieldMap.find((field) => field.offset === offset);
    assert.ok(declared, `+0x${offset.toString(16)}`);
    assert.equal(declared.width, "s8", `+0x${offset.toString(16)} must be a signed byte`);
  }
  // Arguments 4 and 5 carry no offset in any retail move.
  for (const offset of [0x40, 0x41]) {
    assert.equal(fieldMap.find((field) => field.offset === offset).constantValue, 0);
  }
  // Argument 3 does vary: -1 on almost every move, 0..4 on eleven of them.
  const moves = listBattleCatalogRecords("moves");
  const byValue = new Map();
  for (const record of moves) {
    byValue.set(record.field43, (byValue.get(record.field43) ?? 0) + 1);
  }
  assert.deepEqual([...byValue.keys()].sort((a, b) => a - b), [-1, 0, 1, 2, 3, 4]);
  assert.equal(byValue.get(-1), 585);
  assert.equal(moves.length - byValue.get(-1), 11);
  assert.equal(moveFieldToQ12(-1), -BATTLE_SCRIPT_FX_ONE, "so argument 3 is -1.0 for nearly every move");

  const frame = buildMoveScriptArguments({
    pointer0: 0x1000, pointer1: 0x2000, actionObject: 0x3000,
    bases: [100, 200], field40: 0, field41: 0, field43: 0
  });
  assert.deepEqual([...frame], [0x1000, 0x2000, 0x3000, 0, 100, 200]);
  const shifted = buildMoveScriptArguments({ bases: [100, 200], field40: 1, field41: -1, field43: 2 });
  assert.deepEqual([...shifted], [0, 0, 0, 2 * 0x1000, 100 + 0x1000, 200 - 0x1000]);
  assert.throws(() => buildMoveScriptArguments({ bases: [0] }), /BASES_MUST_BE_A_PAIR/);
});

test("argument k is local -(k+3), whatever the argument count", () => {
  assert.equal(BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL, -3);
  for (let index = 0; index < 15; index += 1) {
    assert.equal(argumentLocalIndex(index), -(index + 3), `argument ${index}`);
    assert.equal(localArgumentIndex(-(index + 3)), index);
  }
  // -1 and -2 are init's two zeros, not arguments.
  assert.equal(localArgumentIndex(-1), null);
  assert.equal(localArgumentIndex(-2), null);
  assert.equal(localArgumentIndex(0), null);
  assert.throws(() => argumentLocalIndex(-1), /ARGUMENT_INDEX_MUST_NOT_BE_NEGATIVE/);
});

test("the negative locals the blob actually reads fit that mapping", () => {
  const used = new Set();
  let address = ORIGIN;
  while (address < ORIGIN + BLOB.length) {
    const instruction = decodeBattleScriptInstruction(BLOB, address, ORIGIN);
    if ((instruction.name === "PUSH_LOCAL" || instruction.name === "POP_TO_LOCAL") && instruction.operand < 0) {
      used.add(instruction.operand);
    }
    address += instruction.bytes;
  }
  const sorted = [...used].sort((a, b) => b - a);
  assert.equal(sorted[0], BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL, "nothing reads -1 or -2");
  assert.equal(sorted.at(-1), BATTLE_MOVE_SCRIPT_DEEPEST_LOCAL);
  // A contiguous run, so every argument slot between the two ends is used.
  assert.deepEqual(sorted, Array.from({ length: 15 }, (unused, i) => -3 - i));
  // All three columns are traced: +0x3C passes 6, +0x1C passes 8 and +0x28
  // passes 14. The deepest local reads one deeper than the widest of the three,
  // and that used to be recorded here as a start site nobody had found.
  assert.equal(localArgumentIndex(BATTLE_MOVE_SCRIPT_DEEPEST_LOCAL), 14);
  assert.deepEqual(BATTLE_MOVE_SCRIPT_ENTRIES.map((e) => e.argumentCount), [8, 14, 6]);
  const widest = Math.max(...BATTLE_MOVE_SCRIPT_ENTRIES.map((e) => e.argumentCount));
  assert.equal(widest, 14);
  // CORRECTION. There is no such site. A script-level CALL builds its own frame
  // with the same two-slot overhead init writes as zeros, so fifteen arguments
  // never had to come from an init at all.
  assert.equal(BATTLE_MOVE_SCRIPT_DEEP_FRAME.frameSize, widest + 1);
  assert.equal(BATTLE_MOVE_SCRIPT_DEEP_FRAME.isMoveTableEntry, false);
  assert.equal(BATTLE_MOVE_SCRIPT_CALL_FRAME_OVERHEAD, 2);
});

test("the fifteen-deep frame is a script CALL, not a start site nobody found", () => {
  const deep = BATTLE_MOVE_SCRIPT_DEEP_FRAME;
  assert.equal(deep.routine, 0x02128680);
  assert.equal(deep.callers.length, 2);

  // Both callers are +0x28 entries, so each holds fourteen arguments of its own.
  const plus28 = getMoveScriptEntry(0x28);
  for (const caller of deep.callers) {
    assert.equal(plus28.argumentCount, 14);
    // Each pushes one literal and then its own fourteen, high local to low, so
    // -3..-16 keep their meaning inside the callee and -17 is the literal.
    assert.equal(deep.frameSize, plus28.argumentCount + 1);
    assert.ok(Number.isSafeInteger(caller.recordIndex));
  }
  // One prepends Q12 1.0 and the other zero. What that selects is bytecode.
  assert.deepEqual(deep.callers.map((c) => c.literal), [0x1000, 0x0000]);

  // The ROM counts the frame itself: `POP.N 0x8F` after each call, bit 7 the
  // slide flag and the low seven bits the fifteen slots being dropped.
  assert.equal(deep.popAfterCall & 0x7f, deep.frameSize);
  assert.equal(deep.popAfterCall & 0x80, 0x80);

  // All three uses of the deepest local sit inside that one routine, above its
  // start and below the next.
  for (const use of deep.localUses) {
    assert.ok(use > deep.routine, `${use.toString(16)} is inside 0x02128680`);
  }

  // And from the other side: no init anywhere in the image passes fifteen.
  assert.equal(BATTLE_MOVE_SCRIPT_INIT_SITE_COUNT, 24);
  assert.equal(BATTLE_MOVE_SCRIPT_INIT_ARGUMENT_COUNTS.includes(15), false);
  assert.deepEqual([...BATTLE_MOVE_SCRIPT_INIT_ARGUMENT_COUNTS], [0, 1, 6, 8, 14]);
  for (const entry of BATTLE_MOVE_SCRIPT_ENTRIES) {
    assert.ok(BATTLE_MOVE_SCRIPT_INIT_ARGUMENT_COUNTS.includes(entry.argumentCount));
  }
});

test("the built-in script is the run B2's reachability walk could not account for", () => {
  assert.equal(BATTLE_MOVE_SCRIPT_BUILTIN, 0x0212f94e);
  const routine = decodeBattleScriptRoutine(BLOB, BATTLE_MOVE_SCRIPT_BUILTIN, ORIGIN);
  assert.equal(routine.length, BATTLE_MOVE_SCRIPT_BUILTIN_INSTRUCTIONS);
  assert.equal(routine.length, 161);
  assert.equal(routine.at(-1).address + 1 - BATTLE_MOVE_SCRIPT_BUILTIN, BATTLE_MOVE_SCRIPT_BUILTIN_BYTES);
  assert.equal(BATTLE_MOVE_SCRIPT_BUILTIN_BYTES, 445);
  assert.equal(routine.at(-1).name, "RETURN");

  // No move record points at it: it is a literal in OVL19, not a table column.
  for (const record of listBattleCatalogRecords("moves")) {
    for (const entry of BATTLE_MOVE_SCRIPT_ENTRIES) {
      assert.notEqual(record[entry.field], BATTLE_MOVE_SCRIPT_BUILTIN);
    }
  }
  assert.equal(SCRIPTS.moveRecordEntryPoints.includes("0x0212F94E"), false);
});

test("its prologue reads exactly the locals the six-argument frame predicts", () => {
  const routine = decodeBattleScriptRoutine(BLOB, BATTLE_MOVE_SCRIPT_BUILTIN, ORIGIN);
  assert.equal(routine[0].name, "PUSH_ZEROS", "a routine reserves its locals first");
  assert.equal(routine[0].operand, 8);

  // The first three locals it touches are arguments 2, 1 and 0 — the action
  // object and the two pointers the routine put in front of it.
  const reads = routine.filter((i) => i.name === "PUSH_LOCAL" && i.operand < 0).slice(0, 3);
  assert.deepEqual(reads.map((i) => i.operand), [-5, -4, -3]);
  assert.deepEqual(reads.map((i) => localArgumentIndex(i.operand)), [2, 1, 0]);
  assert.equal(argumentLocalIndex(2), -5, "argument 2 is the action object");

  // And it compares against 1.0 in Q12, which is what those arguments are.
  const immediates = routine.filter((i) => i.name === "PUSH_IMM32").map((i) => i.operand);
  assert.ok(immediates.includes(BATTLE_SCRIPT_FX_ONE), "0x1000 appears as a literal");

  // Every local it reads is inside the eight it reserved, or an argument.
  for (const instruction of routine) {
    if (instruction.name === "PUSH_LOCAL" || instruction.name === "POP_TO_LOCAL") {
      assert.ok(instruction.operand >= -8 && instruction.operand < 8,
        `local ${instruction.operand} at 0x${instruction.address.toString(16)}`);
    }
  }
});

test("resolving an entry picks the column or the literal, and admits a null", () => {
  const own = resolveMoveScriptAddress({ field: "pointer3C", address: 0x0212f6ab });
  assert.deepEqual(own, { address: 0x0212f6ab, source: "pointer3C", site: "OVL19:0x0211DF04" });
  const builtIn = resolveMoveScriptAddress({ useBuiltIn: true });
  assert.deepEqual(builtIn, { address: BATTLE_MOVE_SCRIPT_BUILTIN, source: "BUILT_IN", site: "OVL19:0x0211DD68" });
  const none = resolveMoveScriptAddress({ field: "pointer28", address: 0 });
  assert.equal(none.source, "NONE");
  assert.equal(none.address, 0);
  assert.throws(() => getMoveScriptEntry("pointerFF"), /UNKNOWN_ENTRY/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleMoveScript.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
