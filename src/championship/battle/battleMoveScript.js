// Move scripts — the three script entry points a move record carries.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// B1 transcribed three pointer columns out of the move table and named them for
// their offsets because nothing said what they were. They are script entry
// addresses, and each is started at its own site with its own argument frame:
//
//   +0x1C   OVL19 0x0211C560   VM at combatant +0xEC
//   +0x28   OVL19 0x0211CB7C   VM at combatant +0xEC
//   +0x3C   OVL19 0x0211C904 and 0x0211DF04, six arguments
//
// The move record itself is reached as [combatant +0x20] and [action +0x20], so
// the same record backs both. That is B1 → B2 → B4 closed: the catalog's
// pointer columns, the bytecode VM, and the routine that runs them.
//
// THE SIX-ARGUMENT FRAME
// ----------------------
// At OVL19 0x0211DEA8..0x0211DF04 the routine builds `mov r2, #6` arguments:
//
//   [0]  a pointer taken from +0x24 of another object
//   [1]  a second pointer
//   [2]  the action object
//   [3]  moveRecord +0x43, ldrsb, then << 12
//   [4]  a base word plus moveRecord +0x40, ldrsb, then << 12
//   [5]  a second base word plus moveRecord +0x41, ldrsb, then << 12
//
// The shift is what identifies those three: they are Q12 quantities, not
// indices. What the catalog says about them differs field by field, and the
// difference matters:
//
//   +0x40, +0x41   constant zero across all 596 records, so arguments 4 and 5
//                  are the two base words unchanged in every retail move
//   +0x43          -1 on 585 of the 596, and 0, 1, 2, 3 or 4 on the other
//                  eleven — so argument 3 is -1.0 in Q12 for almost every move
//                  and a small whole number for a handful
//
// The two other signed bytes the +0x1C entry reads, +0x20 and +0x21, behave the
// same way: zero on 580 records apiece, with a scattering of 16/24/32 and -5/-8
// on +0x20 and of -8 down to -48 on +0x21.
//
// HOW A SCRIPT REACHES ITS ARGUMENTS
// ----------------------------------
// The VM's init pushes the array in reverse, then two zeros, and sets frameBase
// to the resulting stack pointer. So for an init of N arguments, frameBase is
// N + 2, argArray[k] lands at slot N-1-k, and PUSH_LOCAL with a signed operand
// of -(k+3) reads it — the same index whatever N is. Locals -1 and -2 are the
// zero return address and the zero saved frame base.
//
// The blob bears that out: across all 23,121 instructions the negative local
// indices used run -3 to -17, and -3 through -6 account for most of them.
//
// THE -17, RESOLVED
// -----------------
// A local of -17 was read here as proof that some entry starts a script with
// fifteen arguments, and that the start site had not been found. That was
// wrong, and there is nothing to find: a script-level CALL builds a frame of
// its own, so fifteen arguments never had to come from an init.
//
// ARM9 0x02055500, the CALL handler, does exactly what init does:
//
//   02055538  str  r1, [r0, #8]      push the return address, pc + 5
//   02055554  str  r1, [r0, #8]      push the caller's frame base
//   0205555C  str  r0, [r4, #0x18c]  frame base = the new stack depth
//
// So a called routine's locals -1 and -2 are that return address and that saved
// frame base -- the two slots init fills with zeros -- and -3 downward reach
// whatever the caller left on the stack. The addressing is the same; only the
// ORDER differs, because init reverses the argument array and a CALL does not.
// In an init frame local -3 is argument 0; in a call frame local -3 is the LAST
// value pushed.
//
// All three uses of -17 in the blob sit in one routine, 0x02128680, which is
// not in the move table and is reached only by two CALLs. Both callers are
// +0x28 entries, so both hold fourteen arguments of their own, and both push a
// literal and then their own fourteen from -16 down to -3:
//
//   record 565, species 215, +0x28 = 0x021292C9   pushes 0x00001000, Q12 1.0
//   record 441, species 176, +0x28 = 0x021292F8   pushes 0x00000000
//
// Pushing them high-to-low undoes init's reversal, so inside 0x02128680 locals
// -3..-16 mean exactly what they meant in the caller and -17 is the prepended
// literal. Both call sites are followed by `POP.N 0x8F`, whose low seven bits
// are 15 -- the frame's own depth, counted by the ROM rather than by this note.
//
// Checked from the other side as well: every ARM-mode BL to the init at
// 0x020548D4, across ARM9 and all 22 overlays, is one of 24 sites, and the
// argument counts they pass are only 0, 1, 6, 8 and 14. No init anywhere in the
// image passes fifteen, because none needs to.
//
// THE BUILT-IN SCRIPT
// -------------------
// One of the two paths does not use the move's own pointer at all: OVL19
// 0x0211DD14 loads the literal 0x0212F94E and starts that instead, with the same
// six-argument frame. That address is 161 instructions and 445 bytes of the
// blob, and it is exactly the 445-byte run B2's reachability walk could not
// account for — it is unreachable from any move record because it lives in
// OVL19's literal pool, not in the table.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What arguments 0 and 1 point at. What the two base words added to arguments 4
// and 5 are. What the prepended literal means to 0x02128680 — 1.0 from one
// caller and 0.0 from the other is a switch of some kind, but which, is the
// bytecode's business. And nothing about what any of the scripts then does:
// that is battleScriptVm's to execute and not this module's to interpret.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_MOVE_SCRIPT_EVIDENCE = "VERIFIED_BINARY";

/** The move record is [combatant +0x20] and [action +0x20]. */
export const BATTLE_MOVE_RECORD_OFFSET = 0x20;

/** The three script entry columns, and where each is started. */
export const BATTLE_MOVE_SCRIPT_ENTRIES = deepFreeze([
  { field: "pointer1C", offset: 0x1c, startSite: "OVL19:0x0211C560", vmOffset: 0xec, argumentCount: 8 },
  { field: "pointer28", offset: 0x28, startSite: "OVL19:0x0211CB7C", vmOffset: 0xec, argumentCount: 14 },
  { field: "pointer3C", offset: 0x3c, startSite: "OVL19:0x0211DF04", vmOffset: 0x2a0, argumentCount: 6 }
]);

/**
 * The +0x1C frame. `mov r2, #8` at 0x0211C51C with the array at sp+4.
 *
 * These two counts went untraced for a long time and the cost was invisible: a
 * runner that passed no arguments made every arg(0) zero, so the accessor
 * natives returned zero, so the scripts divided by zero. It read like a decode
 * fault and was an empty frame.
 */
export const BATTLE_MOVE_SCRIPT_FRAME_1C = deepFreeze([
  { slot: 0, source: "PRELUDE_ACTOR", site: "OVL19:0x0211C500" },
  { slot: 1, source: "CALLER_R6", site: "OVL19:0x0211C504" },
  { slot: 2, source: "ACTION_OBJECT", site: "OVL19:0x0211C508" },
  { slot: 3, source: "MOVE_FIELD_U8_Q12", moveField: 0x22, site: "OVL19:0x0211C524" },
  { slot: 4, source: "MOVE_FIELD_S8_Q12", moveField: 0x20, site: "OVL19:0x0211C534" },
  { slot: 5, source: "MOVE_FIELD_S8_Q12", moveField: 0x21, site: "OVL19:0x0211C544" },
  { slot: 6, source: "CALLER_BLOCK_0", site: "OVL19:0x0211C54C" },
  { slot: 7, source: "CALLER_BLOCK_4", site: "OVL19:0x0211C554" }
]);

/**
 * The +0x28 frame. `mov r2, #0xE` at 0x0211CABC with the array at sp+0.
 *
 * The `/ 100` slots are the signed-divide magic 0x51EB851F with asr #5, the same
 * one battleDamageResolver uses; they are quoted as a division rather than as a
 * shift so the intent survives.
 */
export const BATTLE_MOVE_SCRIPT_FRAME_28 = deepFreeze([
  { slot: 0, source: "OBJECT_FIELD", objectField: 0x24, site: "OVL19:0x0211CA98" },
  { slot: 1, source: "OBJECT_FIELD", objectField: 0x28, site: "OVL19:0x0211CAA4" },
  { slot: 2, source: "OBJECT_FIELD", objectField: 0xe4, site: "OVL19:0x0211CAB4" },
  { slot: 3, source: "INFLIGHT_OBJECT", site: "OVL19:0x0211CAB0" },
  { slot: 4, source: "MOVE_FIELD_U16_Q12_PER_100", moveField: 0x08, site: "OVL19:0x0211CAD4" },
  { slot: 5, source: "MOVE_FIELD_U16_SHIFTED", moveField: 0x38, site: "OVL19:0x0211CAE8" },
  { slot: 6, source: "MOVE_FIELD_S8_Q12", moveField: 0x2c, site: "OVL19:0x0211CAF8" },
  { slot: 7, source: "MOVE_FIELD_S8_Q12", moveField: 0x2d, site: "OVL19:0x0211CB08" },
  { slot: 8, source: "MOVE_FIELD_U16_Q12_PER_100", moveField: 0x2e, site: "OVL19:0x0211CB24" },
  { slot: 9, source: "MOVE_FIELD_S8_Q12", moveField: 0x32, site: "OVL19:0x0211CB34" },
  { slot: 10, source: "MOVE_FIELD_S8_Q12", moveField: 0x33, site: "OVL19:0x0211CB44" },
  { slot: 11, source: "MOVE_FIELD_U16_Q12_PER_100", moveField: 0x34, site: "OVL19:0x0211CB60" },
  { slot: 12, source: "OBJECT_FIELD", objectField: 0x14, site: "OVL19:0x0211CB68" },
  { slot: 13, source: "OBJECT_FIELD", objectField: 0x18, site: "OVL19:0x0211CB70" }
]);

/** A second start site for the same +0x3C column, on the contact path. */
export const BATTLE_MOVE_SCRIPT_CONTACT_START_SITE = "OVL19:0x0211C904";

/** OVL19 0x0211DD14 loads this literal instead of a move's own pointer. */
export const BATTLE_MOVE_SCRIPT_BUILTIN = 0x0212f94e;
export const BATTLE_MOVE_SCRIPT_BUILTIN_BYTES = 445;
export const BATTLE_MOVE_SCRIPT_BUILTIN_INSTRUCTIONS = 161;

/** `mov r2, #6` at 0x0211DEC8 and 0x0211DD34. */
export const BATTLE_MOVE_SCRIPT_ARGUMENT_COUNT = 6;

/** Q12, the same scale the script VM's fixed-point opcodes use. */
export const BATTLE_MOVE_SCRIPT_Q12_SHIFT = 12;

/** The six-argument frame, in array order. */
export const BATTLE_MOVE_SCRIPT_ARGUMENTS = deepFreeze([
  { index: 0, source: "POINTER", site: "OVL19:0x0211DEB0" },
  { index: 1, source: "POINTER", site: "OVL19:0x0211DEB4" },
  { index: 2, source: "ACTION_OBJECT", site: "OVL19:0x0211DEB8" },
  { index: 3, source: "MOVE_FIELD_Q12", moveField: 0x43, site: "OVL19:0x0211DED0" },
  { index: 4, source: "BASE_PLUS_MOVE_FIELD_Q12", moveField: 0x40, site: "OVL19:0x0211DEE4" },
  { index: 5, source: "BASE_PLUS_MOVE_FIELD_Q12", moveField: 0x41, site: "OVL19:0x0211DEF8" }
]);

/** The move-record bytes read with `ldrsb` and shifted into Q12. */
export const BATTLE_MOVE_SCRIPT_Q12_FIELDS = deepFreeze([0x20, 0x21, 0x40, 0x41, 0x43]);

/** Locals -1 and -2 are init's two zeros, so arguments start at -3. */
export const BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL = -3;

/** The deepest negative local any script in the blob reads. */
export const BATTLE_MOVE_SCRIPT_DEEPEST_LOCAL = -17;

/** ARM9 0x02055500. A CALL pushes these two before setting the new frame base. */
export const BATTLE_MOVE_SCRIPT_CALL_SITE = "ARM9:0x02055500";
export const BATTLE_MOVE_SCRIPT_CALL_FRAME_OVERHEAD = 2;

/**
 * Where the fifteen-deep frame actually comes from. 0x02128680 is not in the
 * move table; it is reached only by these two CALLs, each from a +0x28 entry
 * that pushes one literal and then its own fourteen arguments.
 */
export const BATTLE_MOVE_SCRIPT_DEEP_FRAME = deepFreeze({
  routine: 0x02128680,
  frameSize: 15,
  isMoveTableEntry: false,
  localUses: deepFreeze([0x02128c41, 0x02128f68, 0x021290f3]),
  callers: deepFreeze([
    { site: 0x021292ea, entry: 0x021292c9, recordIndex: 565, speciesId: 215, literal: 0x00001000 },
    { site: 0x02129319, entry: 0x021292f8, recordIndex: 441, speciesId: 176, literal: 0x00000000 }
  ]),
  /** `POP.N 0x8F` after each call: bit 7 is the slide flag, the low seven are 15. */
  popAfterCall: 0x8f
});

/**
 * Every ARM-mode BL to the init at 0x020548D4 in ARM9 and all 22 overlays: 24
 * sites, and these are the only argument counts any of them passes. The
 * fifteen-argument start site this lane went looking for does not exist.
 */
export const BATTLE_MOVE_SCRIPT_INIT_SITE_COUNT = 24;
export const BATTLE_MOVE_SCRIPT_INIT_ARGUMENT_COUNTS = deepFreeze([0, 1, 6, 8, 14]);

function scriptError(message) {
  return new Error(`BATTLE_MOVE_SCRIPT_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw scriptError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

export function getMoveScriptEntry(field) {
  const entry = BATTLE_MOVE_SCRIPT_ENTRIES.find((item) => item.field === field || item.offset === field);
  if (!entry) {
    throw scriptError(`UNKNOWN_ENTRY: ${field}`);
  }
  return entry;
}

/**
 * The local index a script uses to read init argument `k`. Independent of the
 * argument count, because init pushes the array in reverse and then two zeros.
 */
export function argumentLocalIndex(argumentIndex) {
  requireInteger(argumentIndex, "ARGUMENT_INDEX");
  if (argumentIndex < 0) {
    throw scriptError("ARGUMENT_INDEX_MUST_NOT_BE_NEGATIVE");
  }
  return BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL - argumentIndex;
}

/** The inverse: which init argument a negative local refers to, or null. */
export function localArgumentIndex(local) {
  requireInteger(local, "LOCAL");
  if (local > BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL) {
    return null;
  }
  return BATTLE_MOVE_SCRIPT_FIRST_ARGUMENT_LOCAL - local;
}

/** `ldrsb` then `lsl #0xc`: a signed byte becomes a Q12 whole number. */
export function moveFieldToQ12(signedByte) {
  requireInteger(signedByte, "SIGNED_BYTE");
  if (signedByte < -128 || signedByte > 127) {
    throw scriptError("SIGNED_BYTE_OUT_OF_RANGE");
  }
  return signedByte << BATTLE_MOVE_SCRIPT_Q12_SHIFT;
}

/**
 * Build the six-argument array the +0x3C entry is started with. `bases` are the
 * two words arguments 4 and 5 are offset from; the module does not know what
 * they are, only that the move's Q12 fields are added to them.
 */
export function buildMoveScriptArguments(input) {
  if (!input || typeof input !== "object") {
    throw scriptError("FRAME_REQUIRES_AN_OBJECT");
  }
  const { pointer0 = 0, pointer1 = 0, actionObject = 0, field40 = 0, field41 = 0, field43 = 0 } = input;
  const bases = input.bases ?? [0, 0];
  if (!Array.isArray(bases) || bases.length !== 2) {
    throw scriptError("BASES_MUST_BE_A_PAIR");
  }
  for (const [label, value] of [["POINTER0", pointer0], ["POINTER1", pointer1],
    ["ACTION_OBJECT", actionObject], ["BASE0", bases[0]], ["BASE1", bases[1]]]) {
    requireInteger(value, label);
  }
  return deepFreeze([
    pointer0,
    pointer1,
    actionObject,
    moveFieldToQ12(field43),
    (bases[0] + moveFieldToQ12(field40)) | 0,
    (bases[1] + moveFieldToQ12(field41)) | 0
  ]);
}

/**
 * Which script address a start would use: the move's own column, or the
 * built-in literal when the caller takes the 0x0211DD68 path.
 */
export function resolveMoveScriptAddress(input) {
  if (!input || typeof input !== "object") {
    throw scriptError("RESOLVE_REQUIRES_AN_OBJECT");
  }
  if (input.useBuiltIn === true) {
    return deepFreeze({
      address: BATTLE_MOVE_SCRIPT_BUILTIN,
      source: "BUILT_IN",
      site: "OVL19:0x0211DD68"
    });
  }
  const entry = getMoveScriptEntry(input.field ?? "pointer3C");
  const address = requireInteger(input.address ?? 0, "ADDRESS");
  if (address === 0) {
    // A null column means the move has no script on that path at all.
    return deepFreeze({ address: 0, source: "NONE", site: entry.startSite });
  }
  return deepFreeze({ address, source: entry.field, site: entry.startSite });
}
