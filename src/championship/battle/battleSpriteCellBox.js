// Sprite cell box — ARM9 0x02047E58, and the bank lookup it goes through.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This was carried for a while as "the single remaining structural dependency,
// one routine", modelled as an input because it reaches into the animation
// runtime. Two of those three words were wrong. It is not one routine — it is
// three calls deep — and the arithmetic at the end of it is entirely traceable
// without knowing anything about the art. What is genuinely outside is only
// WHICH bank and WHICH cell index, which is the resource manager's answer.
//
// THE CHAIN
// ---------
//   02047E60  ldr   r0, [r4, #0xc8]
//   02047E68  bl    #0x2049714      `ldr r0,[r0,#4]`  — two instructions
//   02047E6C  bl    #0x2048b98      `ldr r0,[r0]`     — two instructions
//   02047E70  ldr   r1, [r4, #0x70] / ldr r1,[r1] / ldrh r1,[r1]   the cell index
//   02047E7C  bl    #0x202dd54      the bank lookup below
//
// So [[[obj+0xC8]+4]] is a cell bank, and the halfword at [[obj+0x70]] indexes
// it. Neither pointer is derived here.
//
// THE BANK LOOKUP, ARM9 0x0202DD54
// --------------------------------
//   0202DD54  ldrh  r2, [r0]              the count
//   0202DD58  cmp   r1, r2
//   0202DD5C  movhs r0, #0                UNSIGNED: out of range returns null
//   0202DD64  ldrh  r2, [r0, #2]          an attribute halfword
//   0202DD68  ldr   r0, [r0, #4]          the array base
//   0202DD6C  tst   r2, #1
//   0202DD70  addne r0, r0, r1, lsl #4    bit 0 set: stride 16
//   0202DD74  addeq r0, r0, r1, lsl #3    otherwise:  stride 8
//
// A consequence worth stating, because it is a check and not a guess: the box
// this module reads lives at +0x8..+0xE of a record, so it only fits a stride
// of 16. A bank whose attribute bit 0 is clear has no box to read.
//
// WHICH HALFWORD IS WHICH, WITHOUT NAMING ANYTHING IT HAS NOT EARNED
// ------------------------------------------------------------------
// The record's four signed halfwords sit at +0x8, +0xA, +0xC and +0xE. Rather
// than take an order from a sprite-format write-up, the roles come out of the
// ROM's own rounding: in the scale pass, one of each pair is computed with
// `mla` against the constant -4095 and the other with `mul` then +4095, both
// followed by `asr #12`. Rounding one edge down and the other up is what a
// bounding box does, and it says which edge is which:
//
//   +0x0C  rounded DOWN  -> the low X edge      (object +0xD0)
//   +0x08  rounded UP    -> the high X edge     (object +0xCC)
//   +0x0E  rounded DOWN  -> the low Y edge      (object +0xD2)
//   +0x0A  rounded UP    -> the high Y edge     (object +0xCE)
//
// THE TRANSFORM
// -------------
// r1 == 0 on entry, or no flip with both scales at Q12 1.0, returns the cell's
// own box at cell+8 untouched (0x02047FF0). Otherwise the object's copy at
// +0xCC is built and returned (0x02047FE8):
//
//   +0x14 bit 0   horizontal flip: negate both X edges and swap them
//   +0x14 bit 1   vertical flip:   negate both Y edges and swap them
//   +0x04         X scale, Q12. Skipped entirely when exactly 0x1000.
//   +0x08         Y scale, Q12. Same.
//
// A negative scale swaps which edge feeds which, so the box stays ordered. Each
// store is a `strh`, so every result is truncated to a signed halfword.
//
// WHO ASKS FOR IT, AND HOW NARROW THE GAP ACTUALLY IS
// ---------------------------------------------------
// The launch initialiser is the battle's only caller of interest, and it passes
// r1 = 1 unconditionally:
//
//   0211C0BC  ldr r0, [r4, #4]
//   0211C0C0  mov r1, #1
//   0211C0C4  bl  #0x2047e58
//
// So a launch never takes the r1 == 0 exit; the only way it gets the cell's own
// box is the no-flip, both-scales-1.0 case. And r4 is the initialiser's fourth
// argument, which its four callers fill from things this repository already
// models:
//
//   02116B70, 02116D70   ldr r3,[r5,#0x5c]   the committed action
//   02116F3C             ldr r3,[sl,#0x64]   the target
//   0211716C             r3 = the return of 0x02112394
//
// The sprite object is therefore that thing's +4. The gap is not "the cell box"
// any more; it is one field on an object the battle lane already holds.
//
// WHAT THIS MODULE DOES NOT DECIDE
// --------------------------------
// What [X+4] is, and what its +0xC8 and +0x70 hold on any given frame. Walking
// those into a loaded resource is the OVL9 resource manager's and the art
// lane's, and the remake's own art is not generated yet, so a dumped table of
// original boxes would have nothing to align to. Both stay inputs. This module
// turns a bank, an index and a transform into a box; it does not know which
// creature is on screen.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_CELL_BOX_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_CELL_BOX_SITE = "ARM9:0x02047E58";
export const BATTLE_CELL_BANK_LOOKUP_SITE = "ARM9:0x0202DD54";

/** The two accessors between the object and the bank, two instructions each. */
export const BATTLE_CELL_BANK_PATH = deepFreeze([
  { site: "ARM9:0x02049714", reads: "[r0, #4]", from: "OBJECT_FIELD_0xC8" },
  { site: "ARM9:0x02048B98", reads: "[r0]", from: "PREVIOUS" }
]);

/** The halfword at [[obj+0x70]] is the cell index, read at 0x02047E78. */
export const BATTLE_CELL_INDEX_PATH = deepFreeze(["OBJECT_FIELD_0x70", "DEREF", "DEREF", "U16"]);

/** OVL19 0x0211C0C0: the launch always asks for the transform. */
export const BATTLE_CELL_BOX_LAUNCH_APPLIES_TRANSFORM = 1;

/**
 * Where the sprite object comes from. Each caller of the launch initialiser
 * 0x0211C098 fills its fourth argument from a field this lane already holds,
 * and the sprite object is that thing's +4.
 */
export const BATTLE_CELL_BOX_OWNERS = deepFreeze([
  { site: "OVL19:0x02116B70", from: "COMBATANT_FIELD_0x5C", meaning: "the committed action" },
  { site: "OVL19:0x02116D70", from: "COMBATANT_FIELD_0x5C", meaning: "the committed action" },
  { site: "OVL19:0x02116F3C", from: "COMBATANT_FIELD_0x64", meaning: "the target" },
  { site: "OVL19:0x0211716C", from: "OVL19:0x02112394", meaning: "UNKNOWN_REQUIRES_TRACE" }
]);
export const BATTLE_CELL_BOX_OWNER_SPRITE_OFFSET = 0x04;

/** The bank header 0x0202DD54 reads. */
export const BATTLE_CELL_BANK_COUNT_OFFSET = 0x00;
export const BATTLE_CELL_BANK_ATTRIBUTE_OFFSET = 0x02;
export const BATTLE_CELL_BANK_ARRAY_OFFSET = 0x04;
/** `tst r2,#1` at 0x0202DD6C. */
export const BATTLE_CELL_BANK_WIDE_BIT = 1;
export const BATTLE_CELL_BANK_WIDE_STRIDE = 16;
export const BATTLE_CELL_BANK_NARROW_STRIDE = 8;

/** Inside a record. Only a 16-byte stride reaches +0xE. */
export const BATTLE_CELL_BOX_OFFSETS = deepFreeze({ highX: 0x08, highY: 0x0a, lowX: 0x0c, lowY: 0x0e });

/** The object's own copy, and what 0x02047FE8 returns a pointer to. */
export const BATTLE_CELL_BOX_OBJECT_OFFSETS = deepFreeze({ highX: 0xcc, highY: 0xce, lowX: 0xd0, lowY: 0xd2 });

export const BATTLE_CELL_BOX_FLIP_OFFSET = 0x14;
export const BATTLE_CELL_BOX_SCALE_X_OFFSET = 0x04;
export const BATTLE_CELL_BOX_SCALE_Y_OFFSET = 0x08;
export const BATTLE_CELL_BOX_FLIP_HORIZONTAL = 1;
export const BATTLE_CELL_BOX_FLIP_VERTICAL = 2;

/** Q12, the same scale the rest of the battle arithmetic uses. */
export const BATTLE_CELL_BOX_Q12_SHIFT = 12;
export const BATTLE_CELL_BOX_IDENTITY_SCALE = 0x1000;
/** `ldr r0,=0xFFFFF001` is -4095; the other edge adds 0xFF then 0xF00. */
export const BATTLE_CELL_BOX_ROUNDING = 0xfff;

export const BATTLE_CELL_BOX_SOURCE_CELL = "CELL";
export const BATTLE_CELL_BOX_SOURCE_OBJECT = "OBJECT";

function boxError(message) {
  return new Error(`BATTLE_CELL_BOX_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw boxError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

/** `strh` truncates, and every read back is `ldrsh`. */
function toSignedHalfword(value) {
  return (value << 16) >> 16;
}

/**
 * ARM9 0x0202DD54. The record address for a cell index, or null when the index
 * is out of range — the compare is unsigned, so a negative index is out of
 * range too rather than reading backwards.
 */
export function cellRecordAddress(bank, index) {
  if (!bank || typeof bank !== "object") {
    throw boxError("BANK_REQUIRED");
  }
  requireInteger(bank.count, "COUNT");
  requireInteger(bank.attribute, "ATTRIBUTE");
  requireInteger(bank.arrayBase, "ARRAY_BASE");
  requireInteger(index, "INDEX");
  if (bank.count < 0 || bank.count > 0xffff) {
    throw boxError(`COUNT_IS_NOT_A_U16: ${bank.count}`);
  }
  if ((index >>> 0) >= bank.count) {
    return null;
  }
  const stride = (bank.attribute & BATTLE_CELL_BANK_WIDE_BIT) !== 0
    ? BATTLE_CELL_BANK_WIDE_STRIDE
    : BATTLE_CELL_BANK_NARROW_STRIDE;
  return bank.arrayBase + index * stride;
}

/**
 * Whether a bank's records are wide enough to carry a box at all. +0xE is the
 * last halfword of a 16-byte record and the second halfword of the NEXT record
 * in an 8-byte one, so this is a real precondition and not a formality.
 */
export function cellBankCarriesBox(bank) {
  if (!bank || typeof bank !== "object") {
    throw boxError("BANK_REQUIRED");
  }
  requireInteger(bank.attribute, "ATTRIBUTE");
  return (bank.attribute & BATTLE_CELL_BANK_WIDE_BIT) !== 0;
}

/** The reads the walk needs: `ldr`, `ldrh`, `ldrsh` and `ldrb`. */
function requireWalkHost(host) {
  if (!host || typeof host !== "object") {
    throw boxError("WALK_REQUIRES_A_HOST");
  }
  for (const method of ["readU32", "readU16", "readS16", "readU8"]) {
    if (typeof host[method] !== "function") {
      throw boxError(`HOST_MUST_PROVIDE_${method.toUpperCase()}`);
    }
  }
  return host;
}

function requireBox(box, label) {
  if (!box || typeof box !== "object") {
    throw boxError(`${label}_REQUIRED`);
  }
  for (const edge of ["lowX", "lowY", "highX", "highY"]) {
    requireInteger(box[edge], edge.toUpperCase());
  }
  return box;
}

/** `mla`/`mul` keep the low 32 bits, then `asr #12`, then `strh`. */
function scaleLow(edge, scale) {
  return toSignedHalfword((Math.imul(edge, scale) - BATTLE_CELL_BOX_ROUNDING) >> BATTLE_CELL_BOX_Q12_SHIFT);
}

function scaleHigh(edge, scale) {
  return toSignedHalfword((Math.imul(edge, scale) + BATTLE_CELL_BOX_ROUNDING) >> BATTLE_CELL_BOX_Q12_SHIFT);
}

/**
 * ARM9 0x02047E58 from the bank lookup onward.
 *
 * `cellBox` is the record's four signed halfwords. `applyTransform` is the r1
 * the caller passes: zero returns the cell's own box and nothing is computed.
 * `flipFlags` is the object's +0x14 byte, `scaleX` and `scaleY` its +0x04 and
 * +0x08 words in Q12.
 *
 * Returns which of the two boxes the ROM would have handed back a pointer to,
 * and its four edges.
 */
export function resolveSpriteCellBox(input) {
  if (!input || typeof input !== "object") {
    throw boxError("RESOLVE_REQUIRES_AN_OBJECT");
  }
  const cellBox = requireBox(input.cellBox, "CELL_BOX");
  const applyTransform = input.applyTransform !== 0 && input.applyTransform !== false;
  const flipFlags = requireInteger(input.flipFlags ?? 0, "FLIP_FLAGS") & 0xff;
  const scaleX = requireInteger(input.scaleX ?? BATTLE_CELL_BOX_IDENTITY_SCALE, "SCALE_X");
  const scaleY = requireInteger(input.scaleY ?? BATTLE_CELL_BOX_IDENTITY_SCALE, "SCALE_Y");

  const untouched = deepFreeze({
    source: BATTLE_CELL_BOX_SOURCE_CELL,
    box: deepFreeze({ lowX: cellBox.lowX, lowY: cellBox.lowY, highX: cellBox.highX, highY: cellBox.highY })
  });
  // 0x02047E80: r1 == 0 leaves before anything is read.
  if (!applyTransform) {
    return untouched;
  }
  // 0x02047E88: no flip and both scales exactly 1.0 also returns the cell's own.
  if (flipFlags === 0
    && scaleX === BATTLE_CELL_BOX_IDENTITY_SCALE
    && scaleY === BATTLE_CELL_BOX_IDENTITY_SCALE) {
    return untouched;
  }

  // 0x02047EA4 and 0x02047ED4: a flip negates the pair and swaps it, so the low
  // edge stays the low edge.
  const flippedX = (flipFlags & BATTLE_CELL_BOX_FLIP_HORIZONTAL) !== 0;
  const flippedY = (flipFlags & BATTLE_CELL_BOX_FLIP_VERTICAL) !== 0;
  let lowX = flippedX ? toSignedHalfword(-cellBox.highX) : toSignedHalfword(cellBox.lowX);
  let highX = flippedX ? toSignedHalfword(-cellBox.lowX) : toSignedHalfword(cellBox.highX);
  let lowY = flippedY ? toSignedHalfword(-cellBox.highY) : toSignedHalfword(cellBox.lowY);
  let highY = flippedY ? toSignedHalfword(-cellBox.lowY) : toSignedHalfword(cellBox.highY);

  // 0x02047F00 and 0x02047F74. Exactly 0x1000 skips the whole pass, which is
  // not the same as multiplying by one: it also skips the rounding.
  if (scaleX !== BATTLE_CELL_BOX_IDENTITY_SCALE) {
    const fromLow = scaleX < 0 ? highX : lowX;
    const fromHigh = scaleX < 0 ? lowX : highX;
    lowX = scaleLow(fromLow, scaleX);
    highX = scaleHigh(fromHigh, scaleX);
  }
  if (scaleY !== BATTLE_CELL_BOX_IDENTITY_SCALE) {
    const fromLow = scaleY < 0 ? highY : lowY;
    const fromHigh = scaleY < 0 ? lowY : highY;
    lowY = scaleLow(fromLow, scaleY);
    highY = scaleHigh(fromHigh, scaleY);
  }

  return deepFreeze({
    source: BATTLE_CELL_BOX_SOURCE_OBJECT,
    box: deepFreeze({ lowX, lowY, highX, highY })
  });
}

/**
 * The walk itself, 0x02047E60..0x02047E7C, over a host of the kind
 * battleScriptNatives already asks for. Returns the record's four signed
 * halfwords, or null when the bank lookup refuses the index.
 *
 *   02047E60  ldr  r0, [r4, #0xc8]
 *   02047E68  bl   #0x2049714       r0 = [r0 + 4]
 *   02047E6C  bl   #0x2048b98       r0 = [r0]
 *   02047E70  ldr  r1, [r4, #0x70] / ldr r1,[r1] / ldrh r1,[r1]
 *   02047E7C  bl   #0x202dd54
 *
 * The original applies no null check to what comes back: 0x02047E88 onward
 * reads [r0, #0xC] whatever it is. A null there is a fault, not a value, so
 * this returns null and leaves the decision to the caller rather than inventing
 * a box the ROM never produced.
 */
export function readCellRecordBox(host, object) {
  requireWalkHost(host);
  const holder = host.readU32(object, 0xc8);
  const bank = host.readU32(host.readU32(holder, 0x04), 0x00);
  const index = host.readU16(host.readU32(host.readU32(object, 0x70), 0x00), 0x00);
  const record = cellRecordAddress({
    count: host.readU16(bank, BATTLE_CELL_BANK_COUNT_OFFSET),
    attribute: host.readU16(bank, BATTLE_CELL_BANK_ATTRIBUTE_OFFSET),
    arrayBase: host.readU32(bank, BATTLE_CELL_BANK_ARRAY_OFFSET)
  }, index);
  if (record === null) {
    return null;
  }
  return deepFreeze({
    record,
    index,
    box: deepFreeze({
      highX: host.readS16(record, BATTLE_CELL_BOX_OFFSETS.highX),
      highY: host.readS16(record, BATTLE_CELL_BOX_OFFSETS.highY),
      lowX: host.readS16(record, BATTLE_CELL_BOX_OFFSETS.lowX),
      lowY: host.readS16(record, BATTLE_CELL_BOX_OFFSETS.lowY)
    })
  });
}

/**
 * 0x02047E58 whole: the walk above, then the transform read off the object.
 * `applyTransform` is the r1 the caller passes.
 */
export function readSpriteCellBox(host, object, applyTransform) {
  const found = readCellRecordBox(host, object);
  if (found === null) {
    return null;
  }
  return resolveSpriteCellBox({
    cellBox: found.box,
    applyTransform,
    flipFlags: host.readU8(object, BATTLE_CELL_BOX_FLIP_OFFSET),
    // `ldr r3,[r4,#4] / cmp r3,#0 / blt` -- the scales are read signed.
    scaleX: host.readU32(object, BATTLE_CELL_BOX_SCALE_X_OFFSET) | 0,
    scaleY: host.readU32(object, BATTLE_CELL_BOX_SCALE_Y_OFFSET) | 0
  });
}

/**
 * ARM9 0x02047DCC and 0x02047D98. Two routines that do the same walk and then
 * subtract one edge of a pair from the other:
 *
 *   02047DF0  ldrsh r1,[r0,#8]  / ldrsh r0,[r0,#0xc] / sub r0,r1,r0
 *   02047DBC  ldrsh r1,[r0,#0xa]/ ldrsh r0,[r0,#0xe] / sub r0,r1,r0
 *
 * Neither applies the transform. They are also the second, independent proof of
 * which halfword is which: an extent is high minus low, so +0x08 and +0x0A are
 * the high edges and +0x0C and +0x0E the low ones. The rounding argument in the
 * header reaches the same answer from a different routine.
 */
export function cellBoxExtentX(box) {
  requireBox(box, "BOX");
  return toSignedHalfword(box.highX - box.lowX);
}

export function cellBoxExtentY(box) {
  requireBox(box, "BOX");
  return toSignedHalfword(box.highY - box.lowY);
}

/**
 * The shape battleLaunchPool.launchPosition reads.
 *
 * 0x02047E58 returns a POINTER, and the launch initialiser at OVL19 0x0211C098
 * reads it as `ldrsh r1,[r0]` and `ldrsh r2,[r0,#4]`. Both exits point at the
 * first of the four halfwords, so +0 and +4 are the high and low X edges and +2
 * and +6 are the high and low Y. The pool's `x0`/`x1` names came from that
 * ordering before the edges had roles; they are the same two numbers, and the
 * midpoint it takes is symmetric either way.
 */
export function cellBoxToLaunchCell(box) {
  requireBox(box, "BOX");
  return deepFreeze({ x0: box.highX, y0: box.highY, x1: box.lowX, y1: box.lowY });
}
