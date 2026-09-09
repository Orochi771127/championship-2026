// Move script execution — the original's own bytecode, on the traced VM.
//
// The point of these cases is that nothing here reimplements a move. The VM
// decodes the cartridge's instructions and the caller supplies the natives, so
// what a move does is the original's behaviour rather than this lane's reading
// of it.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_SCRIPT_BLOB_END,
  BATTLE_SCRIPT_BLOB_INSTRUCTIONS,
  BATTLE_SCRIPT_BLOB_LENGTH,
  BATTLE_SCRIPT_BLOB_ORIGIN,
  BATTLE_SCRIPT_REWRITES,
  BATTLE_SCRIPT_REWRITE_SITE,
  BATTLE_SCRIPT_RUN_EVIDENCE,
  battleScriptBlob,
  isInsideScriptBlob,
  rewriteMoveScriptPointers,
  runMoveScript
} from "../src/championship/battle/battleMoveScriptRun.js";

import {
  BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT,
  BATTLE_MOVE_SCRIPT_ENTRIES,
  moveFieldToQ12
} from "../src/championship/battle/battleMoveScript.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moves = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-moves.r1.json"), "utf8")).records;

const attackMove = moves.find((record) => record.kind === 1 && record.power >= 300);

test("the segment is the one the script catalog already carried", () => {
  assert.equal(BATTLE_SCRIPT_RUN_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_SCRIPT_BLOB_ORIGIN, 0x021204a0);
  assert.equal(BATTLE_SCRIPT_BLOB_END, 0x0212fda4);
  assert.equal(BATTLE_SCRIPT_BLOB_LENGTH, BATTLE_SCRIPT_BLOB_END - BATTLE_SCRIPT_BLOB_ORIGIN);
  assert.equal(BATTLE_SCRIPT_BLOB_LENGTH, 63748);
  assert.equal(BATTLE_SCRIPT_BLOB_INSTRUCTIONS, 23121);
  assert.equal(battleScriptBlob().length, BATTLE_SCRIPT_BLOB_LENGTH);
  // Decoded once and handed back the same view.
  assert.equal(battleScriptBlob(), battleScriptBlob());
});

test("every move's three script columns land inside the segment", () => {
  assert.deepEqual(BATTLE_MOVE_SCRIPT_ENTRIES.map((entry) => entry.field),
    ["pointer1C", "pointer28", "pointer3C"]);
  let counted = 0;
  for (const record of moves) {
    for (const entry of BATTLE_MOVE_SCRIPT_ENTRIES) {
      const address = record[entry.field];
      if (!address) continue;
      assert.equal(isInsideScriptBlob(address), true,
        `move ${record.recordIndex} ${entry.field} 0x${address.toString(16)}`);
      counted += 1;
    }
  }
  assert.ok(counted > 1700, "and there are that many columns to check");
  assert.equal(isInsideScriptBlob(BATTLE_SCRIPT_BLOB_ORIGIN - 1), false);
  assert.equal(isInsideScriptBlob(BATTLE_SCRIPT_BLOB_END), false, "the end is exclusive");
});

test("the launch rewrites two pointers before starting them, in order", () => {
  assert.equal(BATTLE_SCRIPT_REWRITE_SITE, "OVL19:0x0211C198");
  assert.equal(BATTLE_SCRIPT_REWRITES.length, 3);

  // The +0x28 swap needs field0C to be 1.
  const swapped = rewriteMoveScriptPointers({ field0C: 1, pointer28: 0x02124d82, pointer1C: 0 });
  assert.equal(swapped.pointer28, 0x02120d8a);
  assert.deepEqual([...swapped.applied], ["pointer28"]);
  const untouched = rewriteMoveScriptPointers({ field0C: 0, pointer28: 0x02124d82, pointer1C: 0 });
  assert.equal(untouched.pointer28, 0x02124d82);
  assert.deepEqual([...untouched.applied], []);

  // The +0x1C swap reads +0x28 AFTER the first store, so one record can take
  // both: 0x02124D82 becomes 0x02120D8A, which then satisfies the second test.
  const both = rewriteMoveScriptPointers({ field0C: 1, pointer28: 0x02124d82, pointer1C: 0x02120674 });
  assert.equal(both.pointer28, 0x02120d8a);
  assert.equal(both.pointer1C, 0x02120754);
  assert.deepEqual([...both.applied], ["pointer28", "pointer1C"]);

  // And without the first store the second does not fire.
  const neither = rewriteMoveScriptPointers({ field0C: 0, pointer28: 0x02124d82, pointer1C: 0x02120674 });
  assert.equal(neither.pointer1C, 0x02120674);
  assert.throws(() => rewriteMoveScriptPointers(null), /RECORD_REQUIRED/);
});

test("a real move script runs the cartridge's own instructions", () => {
  const run = runMoveScript({ record: attackMove, field: "pointer3C", frames: 2, actionObject: 0x1000 });
  assert.equal(run.started, true);
  assert.equal(run.field, "pointer3C");
  assert.equal(isInsideScriptBlob(run.address), true);
  // +0x3C runs on the array at +0x2A0 with the six-argument frame.
  assert.equal(run.vmOffset, 0x2a0);
  assert.equal(run.argumentCount, BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT);
  // It reaches real natives, which is the whole point: the behaviour is the
  // original's, not a reimplementation of it.
  assert.ok(run.routines.length > 5, `called ${run.routines.length} distinct natives`);
  for (const routine of run.routines) {
    assert.ok(Number.isSafeInteger(routine) && routine > 0x02000000, `0x${routine.toString(16)}`);
  }
});

test("the six-argument frame is the traced one, Q12 fields included", () => {
  const record = { ...attackMove, field40: 4, field41: -4, field43: 1 };
  const run = runMoveScript({
    record, field: "pointer3C", frames: 1, actionObject: 0x2000,
    pointer0: 0x11, pointer1: 0x22, bases: [1000, 2000]
  });
  assert.equal(run.argumentCount, 6);
  // moveFieldToQ12 is battleMoveScript's, and the bases are added to two of them.
  assert.equal(moveFieldToQ12(4), 4 << 12);
  assert.equal(moveFieldToQ12(-4), (-4) << 12);
  assert.equal(run.started, true);
});

test("a column a move does not have is reported rather than guessed at", () => {
  const bare = { recordIndex: 0, pointer1C: 0, pointer28: 0, pointer3C: 0 };
  const run = runMoveScript({ record: bare, field: "pointer3C" });
  assert.equal(run.started, false);
  assert.equal(run.reason, "NO_SCRIPT_ON_THIS_COLUMN");
  assert.throws(() => runMoveScript({}), /RECORD_REQUIRED/);
  assert.throws(() => runMoveScript(null), /REQUIRES_AN_OBJECT/);
});

test("the yield is what makes a script span frames instead of spinning", () => {
  // 0x0211E28C is sixteen bytes: bl 0x02054A24, return 0. A caller stub that
  // merely returned 0 for it left the script inside one resume until the budget
  // ran out, which looked like a decode fault and was not one.
  const run = runMoveScript({ record: attackMove, field: "pointer3C", frames: 4, actionObject: 0x1000 });
  assert.equal(run.error, null, "the script finishes rather than exhausting its budget");
  assert.ok(run.steps > 0, `it executed ${run.steps} instructions`);
  assert.equal(run.active, false, "and it ran to its end");

  // Routines the catalog knows are run here; the rest still fall to the caller.
  const seen = [];
  runMoveScript({
    record: attackMove, field: "pointer3C", frames: 4, actionObject: 0x1000,
    callNative(routine) { seen.push(routine); return 0; }
  });
  assert.deepEqual([...new Set(seen)].sort((a, b) => a - b),
    [...new Set([...run.unimplemented,...run.needsObjectGraph,...run.unresolvedHostCalls])].sort((a,b)=>a-b),
    "the caller supplies only unresolved engine and object-graph dependencies");

  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleMoveScriptRun.js"), "utf8");
  assert.match(module, /WHAT THIS STILL DOES NOT DO/);
  // And the record of how the segment came to be here is kept honest.
  assert.match(module, /THE SEGMENT WAS ALREADY HERE/);
  assert.match(module, /it just ratified something/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleMoveScriptRun.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("the two untraced columns had empty frames, and that was the real blocker", async () => {
  const { BATTLE_MOVE_SCRIPT_FRAME_1C, BATTLE_MOVE_SCRIPT_FRAME_28 } =
    await import("../src/championship/battle/battleMoveScript.js");

  // `mov r2, #8` at 0x0211C51C and `mov r2, #0xE` at 0x0211CABC.
  assert.equal(BATTLE_MOVE_SCRIPT_FRAME_1C.length, 8);
  assert.equal(BATTLE_MOVE_SCRIPT_FRAME_28.length, 14);
  for (const table of [BATTLE_MOVE_SCRIPT_FRAME_1C, BATTLE_MOVE_SCRIPT_FRAME_28]) {
    table.forEach((slot, index) => {
      assert.equal(slot.slot, index, "slots are in stack order");
      assert.match(slot.site, /^OVL19:0x[0-9A-F]{8}$/);
    });
  }

  // A run of each column now hands the script a frame of the right width. Before
  // this was traced the runner passed nothing, every arg(0) was zero, the
  // accessor natives returned zero and the scripts divided by zero -- which read
  // like a decode fault and was an empty frame.
  for (const [field, width] of [["pointer1C", 8], ["pointer28", 14], ["pointer3C", 6]]) {
    const record = moves.find((entry) => entry[field]);
    const run = runMoveScript({ record, field, frames: 1, actionObject: 0x1000, inFlightObject: 0x2000 });
    assert.equal(run.argumentCount, width, `${field} passes ${width}`);
  }
});

test("most of the move table now runs to its end", () => {
  // The measure that matters: how many distinct scripts finish without stopping
  // on a native nobody has read. This was 9 of 36 before the frames were traced.
  const seen = new Set();
  let clean = 0;
  let total = 0;
  for (const record of moves) {
    for (const field of ["pointer1C", "pointer28", "pointer3C"]) {
      const address = record[field];
      if (!address || seen.has(`${field}:${address}`)) continue;
      seen.add(`${field}:${address}`);
      const run = runMoveScript({ record, field, frames: 120, actionObject: 0x1000, inFlightObject: 0x2000 });
      if (!run.started) continue;
      total += 1;
      if (!run.error) clean += 1;
    }
  }
  assert.equal(total, 36, "the table holds 36 distinct script columns");
  assert.ok(clean >= 26, `${clean} of ${total} run clean`);
});

test("the host memory is scaffolding and the module says so", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleMoveScriptRun.js"), "utf8");
  assert.match(module, /is a HOST, not a claim/);
  // A caller can supply its own map, which is how a populated object graph will
  // arrive once the launch initialiser's field setup is traced.
  const mine = new Map([["8192:232", 0x1000]]);
  const record = moves.find((entry) => entry.pointer28);
  const run = runMoveScript({
    record, field: "pointer28", frames: 1, actionObject: 0x1000, inFlightObject: 0x2000, memory: mine
  });
  assert.equal(run.started, true);
});
