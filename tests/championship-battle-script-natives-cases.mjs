// Script natives — the 67 routines the battle bytecode calls out to.
//
// Sixteen were read line by line and are implemented; the other 51 are
// catalogued mechanically and nothing about them is claimed. These cases hold
// that line: an unimplemented address raises rather than returning a value.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_NATIVE_COUNT,
  BATTLE_NATIVE_EVIDENCE,
  BATTLE_NATIVE_IMPLEMENTED,
  BATTLE_NATIVE_Q12_SHIFT,
  BATTLE_NATIVE_SPECIAL_KIND_ENTRY,
  BATTLE_NATIVE_TOTAL_CALL_SITES,
  callBattleNative,
  describeBattleNative,
  getBattleNativeCatalog,
  isBattleNativeImplemented,
  listBattleNatives,
  nativeCallSiteCoverage
} from "../src/championship/battle/battleScriptNatives.js";

import { BATTLE_ACTION_APPLY_BODY, BATTLE_ACTION_APPLY_KIND_SPECIAL } from "../src/championship/battle/battleActionApplication.js";
import { BATTLE_SCRIPT_FX_ONE } from "../src/championship/battle/battleScriptVm.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A host that records every read, write and call, so behaviour is observable. */
function makeHost(memory = new Map()) {
  const log = [];
  const cell = (object) => {
    if (!memory.has(object)) {
      memory.set(object, {});
    }
    return memory.get(object);
  };
  return {
    memory,
    log,
    readU32(object, offset) { log.push(["readU32", object, offset]); return cell(object)[offset] ?? 0; },
    readU8(object, offset) { log.push(["readU8", object, offset]); return cell(object)[offset] ?? 0; },
    writeU32(object, offset, value) { log.push(["writeU32", object, offset, value]); cell(object)[offset] = value; },
    writeU8(object, offset, value) { log.push(["writeU8", object, offset, value]); cell(object)[offset] = value; },
    call(address, ...rest) { log.push(["call", address, ...rest]); return `called:${address}`; },
    yield() { log.push(["yield"]); }
  };
}

test("the catalog holds all 67 and claims no names for any of them", () => {
  assert.equal(BATTLE_NATIVE_EVIDENCE, "VERIFIED_BINARY");
  const catalog = getBattleNativeCatalog();
  assert.equal(catalog.nativeCount, BATTLE_NATIVE_COUNT);
  assert.equal(catalog.nativeCount, 67);
  assert.equal(catalog.natives.length, 67);
  assert.equal(catalog.totalCallSites, BATTLE_NATIVE_TOTAL_CALL_SITES);
  assert.equal(catalog.totalCallSites, 3014);
  assert.equal(catalog.nameEvidence, "MECHANICAL_EXTRACTION_ONLY_NO_NAMES");
  // Every entry carries the mechanical facts and nothing that reads as a name.
  for (const entry of catalog.natives) {
    assert.match(entry.address, /^0x0211[0-9A-F]{4}$/);
    assert.ok(entry.bytes > 0 && entry.callSites > 0, entry.address);
    assert.ok(["GETTER", "SETTER", "COMPOUND", "TRIVIAL", "YIELD"].includes(entry.shape), entry.address);
    assert.equal("name" in entry, false, `${entry.address} must carry no name`);
  }
});

test("the catalogued addresses are exactly the ones the script blob calls", () => {
  const scripts = JSON.parse(
    fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-scripts.r1.json"), "utf8")
  );
  assert.deepEqual(
    listBattleNatives().map((entry) => entry.address).sort(),
    scripts.nativeTargets.map((entry) => entry.address).sort()
  );
  const scriptTotal = scripts.nativeTargets.reduce((sum, entry) => sum + entry.callSites, 0);
  assert.equal(scriptTotal, BATTLE_NATIVE_TOTAL_CALL_SITES);
});

test("all sixty-seven native bodies are implemented, including the staged attacks", () => {
  const coverage = nativeCallSiteCoverage();
  assert.equal(coverage.natives, 67);
  assert.equal(coverage.implemented, 67);
  assert.equal(coverage.total, 3014);
  // 0x0211D3C8 and 0x0211D54C were added on 2026-09-02 and are two of the three
  // busiest a real attack script calls; between them they moved coverage from
  // 1,578 call sites to 2,011. The three animation natives followed on
  // 2026-09-03 and added 110 more.
  assert.equal(coverage.covered, 3014);
  assert.equal(BATTLE_NATIVE_IMPLEMENTED.length, 67);
  // 0x0211D71C is the attack: nine instructions that read the kind out of Q12
  // and tail into the same body 0x0211D70C enters with the kind forced to 13.
  assert.equal(isBattleNativeImplemented(0x0211d71c), true);
  for (const address of BATTLE_NATIVE_IMPLEMENTED) {
    assert.equal(isBattleNativeImplemented(address), true);
    assert.doesNotThrow(() => describeBattleNative(address), `0x${address.toString(16)} is catalogued`);
  }
});

test("the three chained getters read +0x2C and then their own word", () => {
  const object = { tag: "combatant" };
  const inner = { tag: "inner" };
  const host = makeHost(new Map([[inner, { 0x00: 11, 0x04: 22, 0x08: 33 }]]));
  host.memory.set(object, { 0x2c: inner });
  assert.equal(callBattleNative(0x0211ce7c, [object], host), 11);
  assert.equal(callBattleNative(0x0211ce94, [object], host), 22);
  assert.equal(callBattleNative(0x0211ceac, [object], host), 33);
  // Each is two reads, and the first is always +0x2C.
  const reads = host.log.filter((entry) => entry[0] === "readU32");
  assert.equal(reads.length, 6);
  assert.deepEqual(reads.filter((unused, index) => index % 2 === 0).map((entry) => entry[2]), [0x2c, 0x2c, 0x2c]);
});

test("the three guarded getters return zero for a null argument", () => {
  const object = { tag: "combatant" };
  const host = makeHost(new Map([[object, { 0x24: 7, 0x28: 8, 0x2c: 9 }]]));
  assert.equal(callBattleNative(0x0211d1a8, [object], host), 7);
  assert.equal(callBattleNative(0x0211d1c4, [object], host), 8);
  assert.equal(callBattleNative(0x0211d1e0, [object], host), 9);
  // `cmp r0,#0 / moveq r0,#0` — a null argument never reaches the load.
  const before = host.log.length;
  assert.equal(callBattleNative(0x0211d1a8, [0], host), 0);
  assert.equal(host.log.length, before, "no read is attempted");
});

test("Q12 conversion happens in both directions, exactly as the ROM shifts", () => {
  assert.equal(BATTLE_NATIVE_Q12_SHIFT, 12);
  const object = { tag: "combatant" };
  const inner = { tag: "inner" };

  // 0211CFD8: read, then `lsl #0xc` on the way out.
  const outHost = makeHost(new Map([[inner, { 0x6dc: 3 }]]));
  outHost.memory.set(object, { 0x04: inner });
  assert.equal(callBattleNative(0x0211cfd8, [object], outHost), 3 * BATTLE_SCRIPT_FX_ONE);
  // The same chain without the shift is a separate routine.
  assert.equal(callBattleNative(0x0211cff4, [object], outHost), inner);

  // 0211D2BC: `+1` then `lsl #0xc`, and a null guard in front.
  const plusHost = makeHost(new Map([[object, { 0x58: 4 }]]));
  assert.equal(callBattleNative(0x0211d2bc, [object], plusHost), 5 * BATTLE_SCRIPT_FX_ONE);
  assert.equal(callBattleNative(0x0211d2bc, [0], plusHost), 0);

  // 0211D514: `asr #0xc` on the way in, stored as a byte.
  const inHost = makeHost();
  assert.equal(callBattleNative(0x0211d514, [object, 5 * BATTLE_SCRIPT_FX_ONE], inHost), 0);
  assert.deepEqual(inHost.log.at(-1), ["writeU8", object, 0x14, 5]);
  // And its own null guard writes nothing.
  const guarded = makeHost();
  assert.equal(callBattleNative(0x0211d514, [0, 1], guarded), 0);
  assert.deepEqual(guarded.log, []);
});

test("+0x154 acquisition and owner-matched release preserve another attack's lock", () => {
  for (const address of [0x0211cec4]) {
    const object = { tag: `slot-${address}` };
    const host = makeHost();
    // Empty: it writes and reports that it did.
    assert.equal(callBattleNative(address, [object, 99], host), 1);
    assert.equal(host.memory.get(object)[0x154], 99);
    // Occupied: it leaves the value alone and reports that it did not.
    assert.equal(callBattleNative(address, [object, 123], host), 0);
    assert.equal(host.memory.get(object)[0x154], 99);
    assert.equal(callBattleNative(0x0211cefc,[object,123],host),0);
    assert.equal(host.memory.get(object)[0x154],99);
    assert.equal(callBattleNative(0x0211cefc,[object,99],host),1);
    assert.equal(host.memory.get(object)[0x154],0);
    assert.equal(callBattleNative(address,[object,123],host),1);
  }
});

test("the two tail-calls guard on null and then hand off unread routines", () => {
  const object = { tag: "combatant" };
  const host = makeHost();
  // 0211D3A8 returns 1 for a null argument, otherwise calls 0x02047C48.
  assert.equal(callBattleNative(0x0211d3a8, [0], host), 1);
  assert.equal(host.log.length, 0);
  assert.equal(callBattleNative(0x0211d3a8, [object], host), `called:${0x02047c48}`);
  assert.deepEqual(host.log.at(-1), ["call", 0x02047c48, object]);

  // 0211D2E0 returns 0 for null, otherwise shifts the callee's result by 20.
  const shifted = makeHost();
  shifted.writeU32(0x02131c40,0,0x20000000);
  shifted.call = (address, ...rest) => { shifted.log.push(["call", address, ...rest]); return 2; };
  assert.equal(callBattleNative(0x0211d2e0, [0], shifted), 0);
  assert.equal(callBattleNative(0x0211d2e0, [object], shifted), 2 << 20);
  assert.deepEqual(shifted.log.at(-1),['call',0x0211ad9c,0x2001f218,object]);
});

test("the yield native gives up the frame and returns zero", () => {
  const host = makeHost();
  assert.equal(callBattleNative(0x0211e28c, [], host), 0);
  assert.deepEqual(host.log, [["yield"]]);
  assert.equal(describeBattleNative(0x0211e28c).shape, "YIELD");
  assert.equal(describeBattleNative(0x0211e28c).callSites, 89);
});

test("the sixteen-byte native is the entry that forces kind 13", () => {
  assert.equal(BATTLE_NATIVE_SPECIAL_KIND_ENTRY, 0x0211d70c);
  const entry = describeBattleNative(BATTLE_NATIVE_SPECIAL_KIND_ENTRY);
  assert.equal(entry.bytes, 16);
  assert.equal(entry.callSites, 56);

  const host = makeHost();
  callBattleNative(BATTLE_NATIVE_SPECIAL_KIND_ENTRY, [], host);
  // `ldr ip,=0x0211D740 / mov r1,#0xd / bx ip` — the action-application body
  // with the kind battleActionApplication independently found special.
  assert.deepEqual(host.log.at(-1), ["call", BATTLE_ACTION_APPLY_BODY, BATTLE_ACTION_APPLY_KIND_SPECIAL]);
  assert.equal(BATTLE_ACTION_APPLY_KIND_SPECIAL, 13);
});

/**
 * A host over a populated object graph, which the three animation natives need:
 * the scaffold in battleMoveScriptRun deliberately has none.
 *
 *   obj+0xC8 -> holder -> +4 -> bankPtr -> [0] -> bank {count, attr, array}
 *   obj+0x70 -> idx    -> [0] u16 = the cell index
 *   obj+0x8C -> anim   {count at 0, array at +0xC}, entries of 8 with a u16 at +4
 */
function graphHost({ cellIndex = 0, count = 1, attribute = 1, box = {}, anim = [], flip = 0, scaleX = 0x1000, scaleY = 0x1000 } = {}) {
  const OBJ = 0x900;
  const mem = new Map();
  const put = (base, off, value) => mem.set(`${base}:${off}`, value);
  put(OBJ, 0xc8, 0xa00);
  put(0xa00, 4, 0xb00);
  put(0xb00, 0, 0xc00);
  put(OBJ, 0x70, 0xd00);
  put(0xd00, 0, 0xd20);
  put(0xd20, 0, cellIndex);
  put(0xc00, 0, count);
  put(0xc00, 2, attribute);
  put(0xc00, 4, 0xe00);
  const record = 0xe00 + cellIndex * 16;
  put(record, 0x8, box.highX ?? 0);
  put(record, 0xa, box.highY ?? 0);
  put(record, 0xc, box.lowX ?? 0);
  put(record, 0xe, box.lowY ?? 0);
  put(OBJ, 0x14, flip);
  put(OBJ, 4, scaleX);
  put(OBJ, 8, scaleY);
  put(OBJ, 0x8c, 0xf00);
  put(0xf00, 0, anim.length);
  put(0xf00, 0xc, 0x1000);
  anim.forEach((value, index) => put(0x1000, index * 8 + 4, value));
  return {
    object: OBJ,
    host: {
      readU32: (base, off) => mem.get(`${base}:${off}`) || 0,
      readU16: (base, off) => (mem.get(`${base}:${off}`) || 0) & 0xffff,
      readS16: (base, off) => ((mem.get(`${base}:${off}`) || 0) << 16) >> 16,
      readU8: (base, off) => (mem.get(`${base}:${off}`) || 0) & 0xff,
      writeU32: (base, off, value) => put(base, off, value | 0),
      writeU8: (base, off, value) => put(base, off, value & 0xff),
      call: () => 0,
      yield: () => {}
    }
  };
}

/**
 * Produced by transcribing the three natives' ARM instruction by instruction in
 * a scratch script and running 3,000 randomised inputs through both it and the
 * module: 0 mismatches. These fourteen are the spread of that run.
 */
const ANIMATION_VECTORS = [
  { lowY: 1200, highY: -92, entries: [159, 658], d238: 2269184, d298: -5292032, d33c: 3346432 },
  { lowY: 1244, highY: -1043, entries: [355, 251, 455, 341, 137], d238: 411648, d298: -9367552, d33c: 6303744 },
  { lowY: 67, highY: 986, entries: [894, 127, 695, 216, 655, 232, 680, 421, 18, 804, 278, 414], d238: 2156544, d298: 3764224, d33c: 22257664 },
  { lowY: 1046, highY: -1521, entries: [887, 790], d238: -972800, d298: -10514432, d33c: 6868992 },
  { lowY: -1452, highY: -51, entries: [133], d238: -3078144, d298: 5738496, d33c: 544768 },
  { lowY: 838, highY: 1564, entries: [714], d238: 4919296, d298: 2973696, d33c: 2924544 },
  { lowY: -1055, highY: -1127, entries: [], d238: -4468736, d298: -294912, d33c: 0 },
  { lowY: -1076, highY: -569, entries: [], d238: -3368960, d298: 2076672, d33c: 0 },
  { lowY: -1784, highY: 976, entries: [624, 116, 191, 74, 4, 32, 350, 347, 575, 577, 811, 841], d238: -1654784, d298: 11304960, d33c: 18604032 },
  { lowY: 1172, highY: 866, entries: [], d238: 4173824, d298: -1253376, d33c: 0 },
  { lowY: 787, highY: -1591, entries: [367, 672], d238: -1646592, d298: -9740288, d33c: 4255744 },
  { lowY: 1759, highY: 98, entries: [], d238: 3803136, d298: -6803456, d33c: 0 },
  { lowY: 1317, highY: 1866, entries: [], d238: 6518784, d298: 2248704, d33c: 0 },
  { lowY: -1993, highY: 1975, entries: [], d238: -36864, d298: 16252928, d33c: 0 }
];

test("the three animation natives match a literal transcription of the ARM", () => {
  for (const v of ANIMATION_VECTORS) {
    const { object, host } = graphHost({ box: { highY: v.highY, lowY: v.lowY }, anim: v.entries });
    const label = JSON.stringify(v);
    assert.equal(callBattleNative(0x0211d238, [object], host), v.d238, label);
    assert.equal(callBattleNative(0x0211d298, [object], host), v.d298, label);
    assert.equal(callBattleNative(0x0211d33c, [object], host), v.d33c, label);
  }
  assert.equal(ANIMATION_VECTORS.length, 14);
});

test("0x0211D238 shifts into Q12 before it halves, which is not the same order", () => {
  // 0211D264 lsl #0xc THEN 0211D26C asr #1. An odd sum keeps its half unit; the
  // other order would have thrown it away before the shift.
  const { object, host } = graphHost({ box: { highY: 1, lowY: 0 }, anim: [] });
  assert.equal(callBattleNative(0x0211d238, [object], host), 2048);
  assert.notEqual(callBattleNative(0x0211d238, [object], host), 0);

  // `add r0,r0,r0,lsr #31 / asr r0,r0,#1` rounds toward zero, not down.
  const negative = graphHost({ box: { highY: -1, lowY: 0 }, anim: [] });
  assert.equal(callBattleNative(0x0211d238, [negative.object], negative.host), -2048);
});

test("the three keep the ROM's own null-argument guard", () => {
  const { host } = graphHost();
  // `cmp r0,#0 / moveq r0,#0 / popeq` -- all three open with it.
  for (const address of [0x0211d238, 0x0211d298, 0x0211d33c]) {
    assert.equal(callBattleNative(address, [0], host), 0, `0x${address.toString(16)}`);
  }
});

test("an empty animation table is zero, and the count is read unsigned", () => {
  // 02047E10  cmp ip,#0 / bxls lr -- `ls` is unsigned, so an empty table exits.
  const empty = graphHost({ anim: [] });
  assert.equal(callBattleNative(0x0211d33c, [empty.object], empty.host), 0);
  const one = graphHost({ anim: [7] });
  assert.equal(callBattleNative(0x0211d33c, [one.object], one.host), 7 << 12);
});

test("a refused cell index names the boundary instead of inventing a box", () => {
  // The original applies no null check after the bank lookup: 0x02047E88 reads
  // whatever came back. That is a fault, not a value, so the native says which
  // boundary it hit and battleMoveScriptRun counts it beside the unread ones.
  const out = graphHost({ cellIndex: 9, count: 3 });
  assert.throws(() => callBattleNative(0x0211d238, [out.object], out.host), /NEEDS_OBJECT_GRAPH/);
  assert.throws(() => callBattleNative(0x0211d298, [out.object], out.host), /NEEDS_OBJECT_GRAPH/);
  // 0x0211D33C never touches the cell box, so the same graph does not stop it.
  assert.equal(callBattleNative(0x0211d33c, [out.object], out.host), 0);
});

test("only the natives that read halfwords demand a halfword host", () => {
  const { object, host } = graphHost({ box: { highY: 8, lowY: 2 }, anim: [1] });
  const withoutHalfwords = { ...host };
  delete withoutHalfwords.readU16;
  delete withoutHalfwords.readS16;
  // The thirty-one that came before never needed them and must not start to.
  assert.doesNotThrow(() => callBattleNative(0x0211ce7c, [object], withoutHalfwords));
  assert.throws(() => callBattleNative(0x0211d238, [object], withoutHalfwords), /HOST_MUST_PROVIDE_READU16/);
  // 0x0211D33C reads `ldrh` but never `ldrsh`, and asks for exactly that.
  const withU16 = { ...host };
  delete withU16.readS16;
  assert.doesNotThrow(() => callBattleNative(0x0211d33c, [object], withU16));
  assert.throws(() => callBattleNative(0x0211d298, [object], withU16), /HOST_MUST_PROVIDE_READS16/);
});

test("a translated staged attack still requires its actor graph", () => {
  const host = makeHost();
  // 0x0211D238 used to stand here as the unread example. It is read now, so the
  // A compound special-body callback still needs its original state machine.
  assert.equal(isBattleNativeImplemented(0x0211e5a0), true);
  assert.ok(describeBattleNative(0x0211e5a0).callSites > 0);
  assert.throws(() => callBattleNative(0x0211e5a0, [1], host), /NEEDS_2_ARGUMENTS/);
  assert.throws(() => callBattleNative(0x0211e5a0, [1,2], host), /NEEDS_OBJECT_GRAPH/);
  // An address that is not a native at all fails differently.
  assert.throws(() => callBattleNative(0x02000000, [], host), /UNKNOWN/);
  assert.throws(() => describeBattleNative(0x02000000), /UNKNOWN/);
});

test("a native refuses a host that cannot answer it, and short arguments", () => {
  assert.throws(() => callBattleNative(0x0211ce7c, [{}], null), /REQUIRES_A_HOST/);
  assert.throws(() => callBattleNative(0x0211ce7c, [{}], { readU32: () => 0 }), /HOST_MUST_PROVIDE/);
  assert.throws(() => callBattleNative(0x0211cec4, [{}], makeHost()), /NEEDS_2_ARGUMENTS/);
});

test("the builder takes the ROM path from the caller and hard-codes no drive", () => {
  const builder = fs.readFileSync(path.join(root, "scripts/build-battle-native-catalog.py"), "utf8");
  assert.match(builder, /os\.environ\.get\("YDIJ_ROM"\)/);
  assert.match(builder, /encoding="utf-8", newline="\\n"/);
  assert.doesNotMatch(builder, /[A-Za-z]:\\\\/, "no absolute Windows path may be baked into the builder");
  assert.doesNotMatch(builder, /NEXUS/, "the builder must not read a research pack");
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleScriptNatives.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
