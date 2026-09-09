// Sprite cell box — ARM9 0x02047E58 and the bank lookup at 0x0202DD54.
//
// The vector table below was produced by transcribing the ARM instruction by
// instruction in a scratch script and running 4,000 randomised inputs through
// both it and the module: 0 mismatches. These are the spread of that run, one
// per combination of flip bits and scale signs, so the negative-scale swap, the
// halfword truncation and the two rounding directions are all pinned by numbers
// the ROM's own arithmetic produced rather than by a reading of it.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_CELL_BANK_LOOKUP_SITE,
  BATTLE_CELL_BANK_NARROW_STRIDE,
  BATTLE_CELL_BANK_WIDE_BIT,
  BATTLE_CELL_BANK_WIDE_STRIDE,
  BATTLE_CELL_BOX_EVIDENCE,
  BATTLE_CELL_BOX_IDENTITY_SCALE,
  BATTLE_CELL_BOX_LAUNCH_APPLIES_TRANSFORM,
  BATTLE_CELL_BOX_OFFSETS,
  BATTLE_CELL_BOX_OWNERS,
  BATTLE_CELL_BOX_OWNER_SPRITE_OFFSET,
  BATTLE_CELL_BOX_OBJECT_OFFSETS,
  BATTLE_CELL_BOX_ROUNDING,
  BATTLE_CELL_BOX_SITE,
  BATTLE_CELL_BOX_SOURCE_CELL,
  BATTLE_CELL_BOX_SOURCE_OBJECT,
  cellBankCarriesBox,
  cellBoxToLaunchCell,
  cellRecordAddress,
  resolveSpriteCellBox
} from "../src/championship/battle/battleSpriteCellBox.js";

import { launchPosition } from "../src/championship/battle/battleLaunchPool.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** cell is [+0x8, +0xA, +0xC, +0xE]; out is [+0xCC, +0xCE, +0xD0, +0xD2]. */
const VECTORS = [
  { cell: [1345, -869, 496, 1878], flip: 1, sx: 4096, sy: 4096, apply: 1, source: "OBJECT", out: [-496, -869, -1345, 1878] },
  { cell: [1473, -721, 239, -1192], flip: 2, sx: 2048, sy: -4660, apply: 1, source: "OBJECT", out: [737, -820, 118, -1358] },
  { cell: [1219, -52, 604, 441], flip: 0, sx: -2048, sy: 0, apply: 1, source: "OBJECT", out: [-302, 0, -611, -1] },
  { cell: [-1280, -263, 356, -1335], flip: 3, sx: 8192, sy: 0, apply: 1, source: "OBJECT", out: [-712, 0, 2559, -1] },
  { cell: [796, -1986, -1135, -1261], flip: 0, sx: 0, sy: 8192, apply: 1, source: "OBJECT", out: [0, -3972, -1, -2523] },
  { cell: [1865, -1329, 495, -1163], flip: 0, sx: -17185, sy: 801, apply: 1, source: "OBJECT", out: [-2076, -259, -7826, -229] },
  { cell: [1613, 353, 671, 49], flip: 0, sx: 2048, sy: 2048, apply: 1, source: "OBJECT", out: [807, 177, 334, 23] },
  { cell: [-155, -1468, -318, -1471], flip: 2, sx: 4096, sy: 8192, apply: 1, source: "OBJECT", out: [-155, 2942, -318, 2935] },
  { cell: [-1993, 1061, 1950, -1718], flip: 1, sx: 291, sy: -4660, apply: 1, source: "OBJECT", out: [-138, 1955, 140, -1209] },
  { cell: [-318, -1044, 843, -1963], flip: 0, sx: -2048, sy: -4660, apply: 1, source: "OBJECT", out: [-421, 2234, 158, 1186] },
  { cell: [-243, -1664, 1844, 144], flip: 0, sx: 4096, sy: -4096, apply: 1, source: "OBJECT", out: [-243, -144, 1844, 1663] },
  { cell: [419, 463, 1583, 1726], flip: 3, sx: -2048, sy: 8192, apply: 1, source: "OBJECT", out: [210, -3452, 790, -927] },
  { cell: [-1694, -1144, -1285, 213], flip: 3, sx: 0, sy: -2048, apply: 1, source: "OBJECT", out: [0, -572, -1, 105] },
  { cell: [20, -595, 929, 718], flip: 1, sx: 0, sy: -4660, apply: 1, source: "OBJECT", out: [0, -816, -1, 675] },
  { cell: [1873, 1075, 36, -36], flip: 3, sx: 4096, sy: 2048, apply: 1, source: "OBJECT", out: [-36, 18, -1873, -539] },
  { cell: [1722, -331, -463, -1247], flip: 3, sx: 4096, sy: -4096, apply: 1, source: "OBJECT", out: [463, -331, -1722, -1248] },
  { cell: [-1970, 777, 225, -971], flip: 2, sx: 0, sy: 8192, apply: 1, source: "OBJECT", out: [0, 1942, -1, -1555] },
  { cell: [1166, 773, -867, 593], flip: 0, sx: 8192, sy: 0, apply: 1, source: "OBJECT", out: [2332, 0, -1735, -1] },
  { cell: [-1147, -1606, -1220, 213], flip: 2, sx: -4096, sy: 8192, apply: 1, source: "OBJECT", out: [1220, -426, 1146, 3211] },
  { cell: [142, 1734, 661, -1663], flip: 3, sx: 0, sy: 801, apply: 1, source: "OBJECT", out: [0, 326, -1, -341] },
  { cell: [1065, -1473, -1959, 732], flip: 3, sx: -2048, sy: 0, apply: 1, source: "OBJECT", out: [533, 0, -981, -1] },
  { cell: [-64, 1959, -1941, 1766], flip: 2, sx: 0, sy: -2048, apply: 1, source: "OBJECT", out: [0, 980, -1, 882] },
  { cell: [392, 631, -1712, 1394], flip: 1, sx: 8192, sy: 0, apply: 1, source: "OBJECT", out: [3424, 0, -785, -1] },
  { cell: [44, 681, -121, -716], flip: 1, sx: -2048, sy: 2048, apply: 1, source: "OBJECT", out: [22, 341, -62, -359] },
  { cell: [741, 393, -1763, 1112], flip: 0, sx: 0, sy: -4096, apply: 1, source: "OBJECT", out: [0, -1112, -1, -394] },
  { cell: [-146, -220, -955, 947], flip: 2, sx: 4096, sy: 0, apply: 1, source: "OBJECT", out: [-146, 0, -955, -1] },
  { cell: [-257, -275, -1869, 1116], flip: 3, sx: -4096, sy: -2048, apply: 1, source: "OBJECT", out: [-257, -137, -1870, 557] },
  { cell: [932, 660, 1129, 1827], flip: 1, sx: -4096, sy: -4096, apply: 1, source: "OBJECT", out: [932, -1827, 1128, -661] },
  { cell: [483, 572, 1155, -1469], flip: 0, sx: 0, sy: 0, apply: 1, source: "OBJECT", out: [0, 0, -1, -1] },
  { cell: [-389, -1365, 1687, 412], flip: 2, sx: -17185, sy: 0, apply: 1, source: "OBJECT", out: [-7077, 0, 1631, -1] },
  { cell: [-1596, -300, 1861, -689], flip: 2, sx: -4096, sy: -4096, apply: 1, source: "OBJECT", out: [-1861, -300, 1595, -690] },
  { cell: [1989, -1029, 765, -568], flip: 1, sx: 0, sy: 801, apply: 1, source: "OBJECT", out: [0, -201, -1, -113] },
  { cell: [-312, 626, -534, -1240], flip: 2, sx: 0, sy: 0, apply: 1, source: "OBJECT", out: [0, 0, -1, -1] },
  { cell: [1, 682, 484, 985], flip: 1, sx: -4096, sy: 0, apply: 1, source: "OBJECT", out: [1, 0, 483, -1] },
  { cell: [-1816, 827, 519, 1809], flip: 1, sx: 0, sy: 0, apply: 1, source: "OBJECT", out: [0, 0, -1, -1] },
  { cell: [-1133, -1968, 928, 799], flip: 3, sx: 0, sy: 0, apply: 1, source: "OBJECT", out: [0, 0, -1, -1] },
  { cell: [1790, -1932, 541, 849], flip: 2, sx: 291, sy: 801, apply: 0, source: "CELL", out: [1790, -1932, 541, 849] }
];

function boxOf([highX, highY, lowX, lowY]) {
  return { highX, highY, lowX, lowY };
}

test("the module names its sites and its evidence", () => {
  assert.equal(BATTLE_CELL_BOX_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_CELL_BOX_SITE, "ARM9:0x02047E58");
  assert.equal(BATTLE_CELL_BANK_LOOKUP_SITE, "ARM9:0x0202DD54");
  assert.deepEqual({ ...BATTLE_CELL_BOX_OFFSETS }, { highX: 0x08, highY: 0x0a, lowX: 0x0c, lowY: 0x0e });
  assert.deepEqual({ ...BATTLE_CELL_BOX_OBJECT_OFFSETS }, { highX: 0xcc, highY: 0xce, lowX: 0xd0, lowY: 0xd2 });
  assert.equal(BATTLE_CELL_BOX_IDENTITY_SCALE, 0x1000);
  assert.equal(BATTLE_CELL_BOX_ROUNDING, 0xfff);
});

test("the transform matches a literal transcription of the ARM, case for case", () => {
  for (const v of VECTORS) {
    const got = resolveSpriteCellBox({
      cellBox: boxOf(v.cell),
      applyTransform: v.apply,
      flipFlags: v.flip,
      scaleX: v.sx,
      scaleY: v.sy
    });
    const label = JSON.stringify(v);
    assert.equal(got.source, v.source, label);
    assert.deepEqual([got.box.highX, got.box.highY, got.box.lowX, got.box.lowY], v.out, label);
  }
  // A scale of zero is not a no-op: the low edge becomes -1, because the ROM
  // adds -4095 before the shift and the shift is arithmetic.
  const zeroed = VECTORS.filter((v) => v.sx === 0 && v.apply === 1);
  assert.ok(zeroed.length > 0);
  for (const v of zeroed) {
    assert.deepEqual([v.out[0], v.out[2]], [0, -1], JSON.stringify(v));
  }
});

test("both early exits hand back the cell's own box untouched", () => {
  const cell = boxOf([100, 200, -100, -200]);
  // 0x02047E80: r1 == 0 leaves before anything is read, whatever the transform.
  const skipped = resolveSpriteCellBox({ cellBox: cell, applyTransform: 0, flipFlags: 3, scaleX: 0x800, scaleY: 0x800 });
  assert.equal(skipped.source, BATTLE_CELL_BOX_SOURCE_CELL);
  assert.deepEqual({ ...skipped.box }, { ...cell });

  // 0x02047E88: no flip AND both scales exactly 1.0. That is not the same as
  // "a scale of one" -- the identity check skips the rounding as well.
  const identity = resolveSpriteCellBox({ cellBox: cell, applyTransform: 1 });
  assert.equal(identity.source, BATTLE_CELL_BOX_SOURCE_CELL);
  assert.deepEqual({ ...identity.box }, { ...cell });

  const nearlyIdentity = resolveSpriteCellBox({ cellBox: cell, applyTransform: 1, scaleX: 0x1001 });
  assert.equal(nearlyIdentity.source, BATTLE_CELL_BOX_SOURCE_OBJECT);
  assert.notDeepEqual({ ...nearlyIdentity.box }, { ...cell });
});

test("a flip keeps the low edge low, and so does a negative scale", () => {
  const cell = boxOf([300, 400, -100, -200]);
  const flipped = resolveSpriteCellBox({ cellBox: cell, applyTransform: 1, flipFlags: 3 });
  assert.ok(flipped.box.lowX < flipped.box.highX);
  assert.ok(flipped.box.lowY < flipped.box.highY);
  assert.deepEqual({ ...flipped.box }, { lowX: -300, lowY: -400, highX: 100, highY: 200 });

  const mirrored = resolveSpriteCellBox({ cellBox: cell, applyTransform: 1, scaleX: -0x1000, scaleY: -0x1000 });
  assert.ok(mirrored.box.lowX < mirrored.box.highX);
  assert.ok(mirrored.box.lowY < mirrored.box.highY);
});

test("the bank lookup bounds-checks unsigned and strides on attribute bit 0", () => {
  const wide = { count: 4, attribute: BATTLE_CELL_BANK_WIDE_BIT, arrayBase: 0x02000000 };
  assert.equal(cellRecordAddress(wide, 0), 0x02000000);
  assert.equal(cellRecordAddress(wide, 3), 0x02000000 + 3 * BATTLE_CELL_BANK_WIDE_STRIDE);
  assert.equal(cellRecordAddress(wide, 4), null, "index == count is out of range");
  // The compare is unsigned, so a negative index is out of range rather than a
  // read backwards off the front of the array.
  assert.equal(cellRecordAddress(wide, -1), null);

  const narrow = { count: 4, attribute: 0, arrayBase: 0x02000000 };
  assert.equal(cellRecordAddress(narrow, 3), 0x02000000 + 3 * BATTLE_CELL_BANK_NARROW_STRIDE);

  // The box is at +0x8..+0xE, so only the wide stride can carry one.
  assert.equal(cellBankCarriesBox(wide), true);
  assert.equal(cellBankCarriesBox(narrow), false);
  assert.ok(BATTLE_CELL_BOX_OFFSETS.lowY < BATTLE_CELL_BANK_WIDE_STRIDE);
  assert.ok(BATTLE_CELL_BOX_OFFSETS.highX >= BATTLE_CELL_BANK_NARROW_STRIDE);
});

test("the resolved box feeds the launch position without renaming anything", () => {
  // 0x0211C098 reads the returned pointer at +0 and +4 for X, +2 and +6 for Y.
  const resolved = resolveSpriteCellBox({ cellBox: boxOf([60, 40, -20, -80]), applyTransform: 1, flipFlags: 1 });
  const cell = cellBoxToLaunchCell(resolved.box);
  assert.deepEqual({ ...cell }, {
    x0: resolved.box.highX, y0: resolved.box.highY, x1: resolved.box.lowX, y1: resolved.box.lowY
  });

  const placed = launchPosition({ x: 0, y: 0, z: 7 }, cell);
  // The midpoint is symmetric, so which of the pair is the high edge does not
  // change it -- swapping the two must land in the same place.
  const swapped = launchPosition({ x: 0, y: 0, z: 7 }, { x0: cell.x1, y0: cell.y1, x1: cell.x0, y1: cell.y0 });
  assert.deepEqual({ ...placed }, { ...swapped });
  assert.equal(placed.z, 7, "0x0211C120 stores z with no arithmetic");
});

test("it refuses what it cannot model, and imports nothing outside src", () => {
  assert.throws(() => resolveSpriteCellBox(null), /RESOLVE_REQUIRES_AN_OBJECT/);
  assert.throws(() => resolveSpriteCellBox({ cellBox: null }), /CELL_BOX_REQUIRED/);
  assert.throws(
    () => resolveSpriteCellBox({ cellBox: { lowX: 0, lowY: 0, highX: 0, highY: 1.5 } }),
    /HIGHY_MUST_BE_AN_INTEGER/
  );
  assert.throws(() => cellRecordAddress(null, 0), /BANK_REQUIRED/);
  assert.throws(() => cellRecordAddress({ count: 0x10000, attribute: 1, arrayBase: 0 }, 0), /COUNT_IS_NOT_A_U16/);

  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleSpriteCellBox.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
  // The module must keep saying what it does not decide, so "the routine is
  // translated" cannot quietly grow into "the box is derived".
  assert.match(module, /What \[X\+4\] is, and what its \+0xC8 and \+0x70 hold/);
});

test("the launch always asks for the transform, and the owner is already modelled", () => {
  // 0x0211C0C0 is `mov r1,#1`, so a launch never takes the r1 == 0 exit: the
  // only way it sees the cell's own box is the no-flip, both-scales-1.0 case.
  assert.equal(BATTLE_CELL_BOX_LAUNCH_APPLIES_TRANSFORM, 1);
  const cell = { highX: 40, highY: 30, lowX: -40, lowY: -30 };
  assert.equal(
    resolveSpriteCellBox({ cellBox: cell, applyTransform: BATTLE_CELL_BOX_LAUNCH_APPLIES_TRANSFORM }).source,
    BATTLE_CELL_BOX_SOURCE_CELL
  );
  assert.equal(
    resolveSpriteCellBox({
      cellBox: cell, applyTransform: BATTLE_CELL_BOX_LAUNCH_APPLIES_TRANSFORM, flipFlags: 1
    }).source,
    BATTLE_CELL_BOX_SOURCE_OBJECT
  );

  // Three of the four callers fill the initialiser's fourth argument from a
  // field this lane already holds; the fourth is honest about not knowing.
  assert.equal(BATTLE_CELL_BOX_OWNERS.length, 4);
  assert.equal(BATTLE_CELL_BOX_OWNER_SPRITE_OFFSET, 0x04);
  const known = BATTLE_CELL_BOX_OWNERS.filter((o) => o.meaning !== "UNKNOWN_REQUIRES_TRACE");
  assert.equal(known.length, 3);
  assert.deepEqual([...new Set(known.map((o) => o.from))].sort(),
    ["COMBATANT_FIELD_0x5C", "COMBATANT_FIELD_0x64"]);
  for (const owner of BATTLE_CELL_BOX_OWNERS) {
    assert.match(owner.site, /^OVL19:0x0211[0-9A-F]{4}$/);
  }
});
