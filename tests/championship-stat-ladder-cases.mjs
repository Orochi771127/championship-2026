import assert from "node:assert/strict";
import test from "node:test";

import statCurve from "../src/data/championship/catalogs/creature-stat-curve.r1.json" with { type: "json" };
import {
  CREATURE_RECORD_RUNG_EVIDENCE,
  CREATURE_RECORD_STRIDE,
  STAT_LADDER_EVIDENCE,
  STAT_LADDER_ROW_STRIDE,
  STAT_LADDER_RUNGS,
  STAT_LADDER_UNREAD_COLUMN,
  hpForRung,
  sharedColumnsAgree,
  statForRung,
  statLadder
} from "../src/championship/raising/statLadder.js";

test("the ladder is the 27-row table with 8 halfword columns", () => {
  assert.equal(STAT_LADDER_RUNGS, 27);
  assert.equal(STAT_LADDER_ROW_STRIDE, 16);
  const rows = statCurve.records ?? statCurve.rows;
  // 8 signed halfwords is exactly the 16-byte stride the reader shifts for.
  assert.equal(rows[0].length, 8);
  assert.equal(rows[0].length * 2, STAT_LADDER_ROW_STRIDE);
  assert.equal(STAT_LADDER_EVIDENCE, "ROM_VERIFIED");
});

test("the ends of both ladders are the cartridge's numbers", () => {
  assert.equal(hpForRung(0), 200);
  assert.equal(hpForRung(26), 7000);
  assert.equal(statForRung(0), 10);
  assert.equal(statForRung(26), 350);
  assert.equal(hpForRung(13), 2340);
  assert.equal(statForRung(13), 117);
});

test("both ladders ascend, which is what makes them growth ladders", () => {
  for (let rung = 1; rung < STAT_LADDER_RUNGS; rung += 1) {
    assert.ok(hpForRung(rung) > hpForRung(rung - 1), `HP falls at rung ${rung}`);
    assert.ok(statForRung(rung) > statForRung(rung - 1), `stat falls at rung ${rung}`);
  }
});

test("columns 1..6 agree, which is the premise of one shared ladder", () => {
  // If this ever stops holding, the shared-ladder reading is wrong and every
  // non-HP stat needs its own column again.
  assert.equal(sharedColumnsAgree(), true);
});

test("a rung off the ladder is refused rather than clamped", () => {
  assert.throws(() => hpForRung(-1), /RUNG_OUT_OF_RANGE/);
  assert.throws(() => hpForRung(27), /RUNG_OUT_OF_RANGE/);
  assert.throws(() => statForRung(1.5), /RUNG_OUT_OF_RANGE/);
  assert.throws(() => statForRung(null), /RUNG_OUT_OF_RANGE/);
});

test("the ladder projection carries every rung once, in order", () => {
  const ladder = statLadder();
  assert.equal(ladder.length, 27);
  ladder.forEach((step, index) => {
    assert.equal(step.rung, index);
    assert.equal(step.hp, hpForRung(index));
    assert.equal(step.stat, statForRung(index));
  });
});

test("where a creature stands on the ladder is declared untraced", () => {
  // The rungs live in the 68-byte per-creature record, which is save state and
  // not a ROM table. This module must not gain a way to guess one.
  assert.equal(CREATURE_RECORD_STRIDE, 0x44);
  assert.equal(CREATURE_RECORD_RUNG_EVIDENCE, "UNKNOWN_REQUIRES_TRACE");
});

test("column 7 is named as unread rather than quietly used", () => {
  assert.equal(STAT_LADDER_UNREAD_COLUMN, 7);
  const rows = statCurve.records ?? statCurve.rows;
  const column7 = [...new Set(rows.map((row) => row[7]))].sort((a, b) => a - b);
  assert.deepEqual(column7, [4, 8, 12, 15, 18, 20]);
});
