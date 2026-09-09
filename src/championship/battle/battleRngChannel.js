// Channel RNG — ARM9 0x020431D4 roll, ARM9 0x02043240 seeder.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This is the generator every battle roll goes through. The earlier reading that
// `mov r0, #216` passed a modulus was wrong and is already corrected in the
// status file: 216 is a CHANNEL id, and the modulus is 103. What was still open
// was the seeding, which made the sequence unreproducible. It is closed here.
//
// THE ROLL
// --------
//   020431E0  ldmib r1, {r2, r3}          r2 = cursor array, r3 = seed array
//   020431E4  ldr   r1, [r2, r0, lsl #2]  cursor[channel]
//   020431E8  ldr   r5, [r3, r0, lsl #2]  seed[channel]
//   020431EC  cmp   r1, #0x67             103
//   020431F0  movge r1, #0                reset on reaching the end
//   02043208  ldr   lr, [r4, r0, lsl #2]  re-read, then post-increment
//   02043214  ldr   r0, [r3, lr, lsl #2]  table[cursor]
//   02043218  add   lr, r5, r0
//   02043220  smull r3, r0, ip, lr        ip = 0x13E22CBD
//   02043224  add   r0, r1, r0, asr #3
//   0204322C  sub   r0, lr, r0            the remainder
//
// The seed is read and never written. So a channel is not a stream at all: it
// is one fixed cycle of period 103, `(seed[ch] + table[(start + i) % 103]) % 103`.
// Critical hits and status procs repeat every 103 rolls on their channel. That
// is the original's behavior, not a simplification made here.
//
// WHY THE SEEDING IS NOW REPRODUCIBLE
// -----------------------------------
// The header at 0x020BD230 holds the channel count and the two array pointers.
// A scan of the whole ARM9 image finds the seed pointer 0x02104D20 and the
// cursor pointer 0x02105084 at exactly one address each — inside that header —
// so no code outside the roll and the seeder can reach either array. The
// builder asserts that on every run. Given a master seed, the whole 217-channel
// state is therefore determined, and nothing can perturb it afterwards.
//
// The seeder derives channel 1..216 by rolling channel 0 twice per channel: the
// first roll accumulates into the seed total, the second into the cursor total.
//
// WHERE THE MASTER SEED COMES FROM
// --------------------------------
//   ARM9 0x02000C90   master 0 at boot, which takes the clock path at
//                     0x0201034C. Environmental; nothing in the ROM fixes it.
//   ARM9 0x0206AD6C   master loaded from a struct at +0x0C. Not traced.
//   OVL9 0x021775DC   `mov r0, #0x14`. A hard constant, fully reproducible.
//
// A zero master still requires the environmental clock. createClockChannelRng
// implements the now CPU-checked path with an explicit hour/minute/second input.
//
// THE TABLE IS NOT UNIFORM
// ------------------------
// It is 103 entries but only 100 distinct values: 0, 50 and 99 each appear
// twice, and 46, 100 and 102 never appear. So `roll < T` does not hit exactly
// T times in 103 for every T, and which thresholds are off depends on the
// channel's seed. At the traced master seed 0x14, channel 216 is off by one at
// six thresholds out of 104 and exact everywhere else. Do not replace this
// table with a uniform generator; the small skew is the original's.
//
// Curiously the word one past the reachable table is 46 — one of the three
// values the reachable 103 never produce. The cursor bound `cmp r1,#0x67` is
// what ends the table, not the data, so that word is never read.

import rngDocument from "../../data/championship/catalogs/rng-channels.r1.json" with { type: "json" };
import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_RNG_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_RNG_ROLL_SITE = "ARM9:0x020431D4";
export const BATTLE_RNG_SEED_SITE = "ARM9:0x02043240";

/** cmp r1,#0x67 at 0x020431EC. Every threshold in the game is out of this. */
export const BATTLE_RNG_MODULUS = 103;

/** The header's first word at 0x020BD230, so channels are 0..216. */
export const BATTLE_RNG_CHANNEL_COUNT = 217;

/** The signed magic division the ROM uses in place of a divide by 103. */
export const BATTLE_RNG_DIVISION_MAGIC = 0x13e22cbd;
export const BATTLE_RNG_DIVISION_SHIFT = 3;

/** The one master seed the ROM hard-codes, at OVL9 0x021775DC. */
export const BATTLE_RNG_TRACED_MASTER_SEED = 0x14;

export const BATTLE_RNG_TABLE = deepFreeze([...rngDocument.table.entries]);

const MAGIC = BigInt(BATTLE_RNG_DIVISION_MAGIC);

function rngError(message) {
  return new Error(`BATTLE_RNG_${message}`);
}

/**
 * The ROM's `x % 103`: smull by 0x13E22CBD, asr #3, plus the sign bit, then
 * subtract 103 times the quotient. It is a C truncating remainder, so a
 * negative input yields a negative result — the original has no correction.
 */
export function remainderBy103(value) {
  const x = value | 0;
  const high = Number(BigInt.asIntN(32, (MAGIC * BigInt(x)) >> 32n));
  const quotient = ((high >> BATTLE_RNG_DIVISION_SHIFT) + (x >>> 31)) | 0;
  return (x - Math.imul(BATTLE_RNG_MODULUS, quotient)) | 0;
}

/**
 * Build the 217-channel state from a master seed, exactly as ARM9 0x02043240
 * does. Returns an object whose `next(channel)` matches the interface the
 * battle modules already take.
 */
export function createChannelRng(masterSeed) {
  if (!Number.isSafeInteger(masterSeed)) {
    throw rngError("MASTER_SEED_MUST_BE_AN_INTEGER");
  }
  const master = masterSeed | 0;
  if (master === 0) {
    // 0x02043248 `movs sl, r0 / bne` sends a zero master to the clock read at
    // 0x0201034C. That value is the console's, not the cartridge's.
    throw rngError("MASTER_SEED_ZERO_REQUIRES_EXPLICIT_RTC_INPUT");
  }

  const seed = new Int32Array(BATTLE_RNG_CHANNEL_COUNT);
  const cursor = new Int32Array(BATTLE_RNG_CHANNEL_COUNT);
  const rng = channelRngHandle(seed, cursor, master);

  seed[0] = master;
  cursor[0] = remainderBy103(master);
  let seedTotal = master;
  let cursorTotal = remainderBy103(master);
  for (let channel = 1; channel < BATTLE_RNG_CHANNEL_COUNT; channel += 1) {
    seedTotal = (seedTotal + rng.next(0)) | 0;
    cursorTotal = (cursorTotal + rng.next(0)) | 0;
    seed[channel] = seedTotal;
    cursor[channel] = remainderBy103(cursorTotal);
  }
  return rng;
}

/** ARM9 02043250 -> SDK time reader 0201034C, callback case1 02010580.
 * The three decoded RTC words are hour/minute/second; add them, using 1 when
 * all are zero. The platform supplies local RTC time once, never every scene.
 * This is not the in-game Raising calendar and not a fixed battle seed.
 */
export function createClockChannelRng({ hour, minute, second } = {}) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23
    || !Number.isInteger(minute) || minute < 0 || minute > 59
    || !Number.isInteger(second) || second < 0 || second > 59) {
    throw rngError("RTC_HOUR_MINUTE_SECOND_REQUIRED");
  }
  return createChannelRng(hour + minute + second || 1);
}

/** Strict player-state projection for the existing save authority. null is
 * an old save with no recorded RNG history, never a synthetic seed/replay.
 */
export function normalizeGameplayRngState(state) {
  if (state === null) return null;
  if (!state || typeof state !== "object" || Array.isArray(state)
    || Object.keys(state).some((key) => !["version", "seeds", "cursors"].includes(key))
    || state.version !== 1) throw rngError("INVALID_PLAYER_STATE");
  return { version: 1, ...restoreChannelRng(state).snapshot() };
}

/** Continue the same original 217-channel state across scene boundaries.
 * This takes state, never a recorded list of future random results. It does
 * not infer a boot seed or install a separate game/save authority.
 */
export function restoreChannelRng({ seeds, cursors } = {}) {
  if (!Array.isArray(seeds) || !Array.isArray(cursors)
    || seeds.length !== BATTLE_RNG_CHANNEL_COUNT || cursors.length !== BATTLE_RNG_CHANNEL_COUNT
    || seeds.some((n) => !Number.isInteger(n) || n < -0x80000000 || n > 0xffffffff)
    || cursors.some((n) => !Number.isInteger(n) || n < 0 || n > BATTLE_RNG_MODULUS)) {
    throw rngError("COMPLETE_CHANNEL_STATE_REQUIRED");
  }
  return channelRngHandle(Int32Array.from(seeds), Int32Array.from(cursors), null);
}

function channelRngHandle(seed, cursor, masterSeed) {
  const roll = (channel) => {
    if (!Number.isInteger(channel) || channel < 0 || channel >= BATTLE_RNG_CHANNEL_COUNT) {
      throw rngError(`CHANNEL_OUT_OF_RANGE: ${channel}`);
    }
    if (cursor[channel] >= BATTLE_RNG_MODULUS) {
      cursor[channel] = 0;
    }
    const at = cursor[channel];
    if (at < 0) {
      // `cmp r1,#0x67 / movge` is signed, so the original would index before the
      // table. Nothing traced produces this; refuse rather than read rubbish.
      throw rngError(`CURSOR_NEGATIVE_UNTRACED: channel ${channel}`);
    }
    cursor[channel] = at + 1;
    return remainderBy103((seed[channel] + BATTLE_RNG_TABLE[at]) | 0);
  };

  return {
    masterSeed,
    next: roll,
    seedOf: (channel) => seed[channel],
    cursorOf: (channel) => cursor[channel],
    snapshot: () => ({ seeds: Array.from(seed), cursors: Array.from(cursor) }),
    /**
     * The channel's whole cycle in table order, without advancing anything.
     * Because the seed is never written, this is the complete set of values the
     * channel can ever return, and its length is the period.
     */
    cycleOf(channel) {
      if (!Number.isInteger(channel) || channel < 0 || channel >= BATTLE_RNG_CHANNEL_COUNT) {
        throw rngError(`CHANNEL_OUT_OF_RANGE: ${channel}`);
      }
      return BATTLE_RNG_TABLE.map((entry) => remainderBy103((seed[channel] + entry) | 0));
    }
  };
}

/**
 * How often `roll < threshold` comes up across one full cycle of a channel.
 * Returns the count out of 103, which is the honest rate: it is not always the
 * threshold itself, because the table repeats three values and omits three.
 */
export function countCycleHitsBelow(rng, channel, threshold) {
  if (!Number.isInteger(threshold)) {
    throw rngError("THRESHOLD_MUST_BE_AN_INTEGER");
  }
  return rng.cycleOf(channel).filter((value) => value < threshold).length;
}
