// Channel RNG — ARM9 0x020431D4 roll and 0x02043240 seeder.
//
// The seeding was the open residual: the range and modulus were known, the
// sequence was not reproducible. It is now, because the two array pointers are
// reachable only through the header, so a master seed fixes the whole state.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_RNG_CHANNEL_COUNT,
  BATTLE_RNG_DIVISION_MAGIC,
  BATTLE_RNG_DIVISION_SHIFT,
  BATTLE_RNG_EVIDENCE,
  BATTLE_RNG_MODULUS,
  BATTLE_RNG_ROLL_SITE,
  BATTLE_RNG_SEED_SITE,
  BATTLE_RNG_TABLE,
  BATTLE_RNG_TRACED_MASTER_SEED,
  countCycleHitsBelow,
  createChannelRng,
  remainderBy103
} from "../src/championship/battle/battleRngChannel.js";

import {
  BATTLE_STATUS_PROC_RNG_CHANNEL,
  statusProcThreshold,
  tryApplyNegativeStatus
} from "../src/championship/battle/battleStatus.js";

import { BATTLE_AI_RNG_CHANNEL, BATTLE_AI_RNG_MODULUS } from "../src/championship/battle/battleActionSelection.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/championship/catalogs/rng-channels.r1.json"), "utf8")
);

test("the generator's constants are the dumped ones", () => {
  assert.equal(BATTLE_RNG_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_RNG_ROLL_SITE, "ARM9:0x020431D4");
  assert.equal(BATTLE_RNG_SEED_SITE, "ARM9:0x02043240");
  assert.equal(BATTLE_RNG_MODULUS, 103);
  assert.equal(BATTLE_RNG_CHANNEL_COUNT, 217);
  assert.equal(BATTLE_RNG_DIVISION_MAGIC, 0x13e22cbd);
  assert.equal(BATTLE_RNG_DIVISION_SHIFT, 3);
  assert.equal(BATTLE_RNG_TRACED_MASTER_SEED, 0x14);

  assert.equal(CATALOG.generator.modulus, 103);
  assert.equal(CATALOG.generator.channelCount, 217);
  assert.equal(CATALOG.generator.cursorArray, "0x02105084");
  assert.equal(CATALOG.generator.seedArray, "0x02104D20");
  // The seed and cursor arrays are adjacent, 217 words apart.
  assert.equal(
    Number.parseInt(CATALOG.generator.seedArray, 16) + 217 * 4,
    Number.parseInt(CATALOG.generator.cursorArray, 16)
  );

  // 216 is a channel id, not a modulus. Both consumers already agree.
  assert.equal(BATTLE_STATUS_PROC_RNG_CHANNEL, 216);
  assert.equal(BATTLE_AI_RNG_CHANNEL, 216);
  assert.equal(BATTLE_AI_RNG_MODULUS, BATTLE_RNG_MODULUS);
  assert.ok(BATTLE_AI_RNG_CHANNEL < BATTLE_RNG_CHANNEL_COUNT);
});

test("the table is 103 entries and is not a permutation of 0..102", () => {
  assert.equal(BATTLE_RNG_TABLE.length, 103);
  assert.deepEqual([...BATTLE_RNG_TABLE], CATALOG.table.entries);
  assert.equal(Math.min(...BATTLE_RNG_TABLE), 0);
  assert.equal(Math.max(...BATTLE_RNG_TABLE), 101);
  assert.equal(new Set(BATTLE_RNG_TABLE).size, 100);

  const counts = new Map();
  for (const entry of BATTLE_RNG_TABLE) {
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }
  const twice = [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort((a, b) => a - b);
  const missing = [];
  for (let value = 0; value < 103; value += 1) {
    if (!counts.has(value)) {
      missing.push(value);
    }
  }
  assert.deepEqual(twice, [0, 50, 99]);
  assert.deepEqual(missing, [46, 100, 102]);
  assert.deepEqual(CATALOG.distribution.valuesTwiceInTable, twice);
  assert.deepEqual(CATALOG.distribution.valuesNeverInTable, missing);
  assert.equal(BATTLE_RNG_TABLE[0], 67);
  assert.equal(BATTLE_RNG_TABLE[102], 17);
  assert.match(CATALOG.table.boundaryEvidence, /cmp r1,#0x67/);
});

test("the magic division is a C truncating remainder over the whole int32 range", () => {
  const reference = (value) => {
    const x = value | 0;
    const quotient = Math.trunc(x / 103);
    return x - 103 * quotient;
  };
  for (let value = -6000; value <= 6000; value += 1) {
    assert.equal(remainderBy103(value), reference(value), `remainder of ${value}`);
  }
  for (const value of [0, 103, -103, 2147483647, -2147483648, 1234567, -1234567, 0x40000000]) {
    assert.equal(remainderBy103(value), reference(value), `remainder of ${value}`);
  }
  // Truncating, not flooring: the original applies no correction to a negative.
  assert.equal(remainderBy103(250), 44);
  assert.equal(remainderBy103(-250), -44);
});

test("a master seed fixes all 217 channels", () => {
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  // seed[0] = master, straight from 0x02043294, and it is never written again.
  assert.equal(rng.seedOf(0), 20);
  // cursor[0] starts at master % 103, then the seeder rolls channel 0 twice for
  // each of the 216 derived channels, so it ends 432 advances further on.
  assert.equal(rng.cursorOf(0), (20 % 103 + 432) % 103);
  assert.equal(rng.cursorOf(0), 40);
  // Channels 1..216 come from rolling channel 0 twice apiece.
  assert.deepEqual([1, 2, 3, 4].map((channel) => rng.seedOf(channel)), [115, 192, 199, 217]);
  assert.deepEqual([1, 2, 3, 4].map((channel) => rng.cursorOf(channel)), [19, 54, 95, 37]);
  assert.equal(rng.seedOf(216), 10887);
  assert.equal(rng.cursorOf(216), 57);
  // The same master seed rebuilds the same state, every time.
  const again = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  assert.deepEqual(
    Array.from({ length: 217 }, (unused, channel) => [again.seedOf(channel), again.cursorOf(channel)]),
    Array.from({ length: 217 }, (unused, channel) => [rng.seedOf(channel), rng.cursorOf(channel)])
  );
});

test("channel 216 is a fixed cycle of period 103", () => {
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  const seedBefore = rng.seedOf(216);
  const first = Array.from({ length: 103 }, () => rng.next(216));
  const second = Array.from({ length: 103 }, () => rng.next(216));
  const third = Array.from({ length: 103 }, () => rng.next(216));
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  // The roll never writes the seed, which is why the period is exactly 103.
  assert.equal(rng.seedOf(216), seedBefore);

  assert.deepEqual(first.slice(0, 12), [68, 1, 80, 17, 46, 22, 45, 37, 28, 95, 78, 8]);
  assert.equal(Math.min(...first), 0);
  assert.equal(Math.max(...first), 102);
  assert.equal(new Set(first).size, 100);
  // cycleOf reports the same multiset without touching the cursor.
  const cursorBefore = rng.cursorOf(216);
  assert.deepEqual([...rng.cycleOf(216)].sort((a, b) => a - b), [...first].sort((a, b) => a - b));
  assert.equal(rng.cursorOf(216), cursorBefore);
});

test("every roll on every channel stays inside 0..102", () => {
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  for (let channel = 0; channel < BATTLE_RNG_CHANNEL_COUNT; channel += 1) {
    for (const value of rng.cycleOf(channel)) {
      assert.ok(value >= 0 && value < BATTLE_RNG_MODULUS, `channel ${channel} produced ${value}`);
    }
  }
});

test("the threshold rate is the cycle count, which is not always the threshold", () => {
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  // Exact for every threshold up to 15: the table's gaps and repeats sit above.
  for (let threshold = 0; threshold <= 15; threshold += 1) {
    assert.equal(countCycleHitsBelow(rng, 216, threshold), threshold, `threshold ${threshold}`);
  }
  // The traced critical thresholds land inside that exact range.
  assert.deepEqual([2, 3, 5, 7].map((t) => countCycleHitsBelow(rng, 216, t)), [2, 3, 5, 7]);
  // Above it the count is off by one at six thresholds, and only by one.
  const skewed = [];
  for (let threshold = 0; threshold <= 103; threshold += 1) {
    const delta = countCycleHitsBelow(rng, 216, threshold) - threshold;
    if (delta !== 0) {
      skewed.push([threshold, delta]);
    }
  }
  assert.deepEqual(skewed, [[16, -1], [17, -1], [18, -1], [19, -1], [69, 1], [72, -1]]);
});

test("the two untraced entry conditions are refused, not guessed", () => {
  // A master seed of 0 sends the seeder to the console clock at 0x0201034C.
  assert.throws(() => createChannelRng(0), /MASTER_SEED_ZERO_REQUIRES_EXPLICIT_RTC_INPUT/);
  assert.throws(() => createChannelRng(1.5), /MASTER_SEED_MUST_BE_AN_INTEGER/);
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  assert.throws(() => rng.next(217), /CHANNEL_OUT_OF_RANGE/);
  assert.throws(() => rng.next(-1), /CHANNEL_OUT_OF_RANGE/);
  assert.throws(() => rng.cycleOf(217), /CHANNEL_OUT_OF_RANGE/);
});

test("nothing outside the roll and the seeder can reach the generator's state", () => {
  // The builder proves this on every run; the claim is recorded here so a
  // future trace that finds another writer has to change this file too.
  assert.match(CATALOG.generator.stateIsolationEvidence, /exactly\s+once in the whole ARM9 image/);
  assert.equal(CATALOG.generator.seedingCallSites.length, 3);
  const constant = CATALOG.generator.seedingCallSites.find((site) => site.master === "0x14");
  assert.equal(constant.site, "OVL9:0x021775DC");
  const boot = CATALOG.generator.seedingCallSites.find((site) => site.master === "0");
  assert.equal(boot.site, "ARM9:0x02000C90");
  assert.match(boot.note, /clock path/);
});

test("the generator drives the status roll the battle module already takes", () => {
  const rng = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  const base = { actionStatusId: 1, attackerIndex: 0, resistanceIndex: 0, currentHp: 100 };
  const threshold = statusProcThreshold(base);
  assert.ok(threshold > 0 && threshold <= BATTLE_RNG_MODULUS);

  let applied = 0;
  for (let index = 0; index < BATTLE_RNG_MODULUS; index += 1) {
    if (tryApplyNegativeStatus({ ...base, rng }).applied) {
      applied += 1;
    }
  }
  // One full cycle, so the observed count is exactly the cycle count.
  assert.equal(applied, countCycleHitsBelow(rng, BATTLE_STATUS_PROC_RNG_CHANNEL, threshold));

  // And the same seed replays the same run.
  const replay = createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED);
  let replayed = 0;
  for (let index = 0; index < BATTLE_RNG_MODULUS; index += 1) {
    if (tryApplyNegativeStatus({ ...base, rng: replay }).applied) {
      replayed += 1;
    }
  }
  assert.equal(replayed, applied);
});

test("the builder takes the ROM path from the caller and hard-codes no drive", () => {
  const builder = fs.readFileSync(path.join(root, "scripts/build-rng-channel-catalog.py"), "utf8");
  assert.match(builder, /os\.environ\.get\("YDIJ_ROM"\)/);
  assert.match(builder, /encoding="utf-8", newline="\\n"/);
  assert.doesNotMatch(builder, /[A-Za-z]:\\\\/, "no absolute Windows path may be baked into the builder");
  assert.doesNotMatch(builder, /NEXUS/, "the builder must not read a research pack");
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleRngChannel.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
