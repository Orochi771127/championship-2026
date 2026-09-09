// Battle outcome — the end of a match, and what the tournament does with it.
//
// Two facts are worth guarding above the rest: the time limit is 7200 frames
// with a strictly-greater test, and the payout gate is every round of the
// tournament rather than the single flag an earlier reading recorded.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_OUTCOME_END_CHECK_SITE,
  BATTLE_OUTCOME_END_NONE,
  BATTLE_OUTCOME_END_PHASE,
  BATTLE_OUTCOME_END_TEAM_DOWN,
  BATTLE_OUTCOME_END_TIME_UP,
  BATTLE_OUTCOME_EVIDENCE,
  BATTLE_OUTCOME_HP_DIVISOR_OFFSET,
  BATTLE_OUTCOME_HP_OFFSET,
  BATTLE_OUTCOME_INVERTED_TYPE,
  BATTLE_OUTCOME_JUDGE_SITE,
  BATTLE_OUTCOME_LEVEL,
  BATTLE_OUTCOME_PAYOUT_GATE_SITE,
  BATTLE_OUTCOME_ROUND_CURSOR_OFFSET,
  BATTLE_OUTCOME_ROUND_FLAG_OFFSET,
  BATTLE_OUTCOME_RUNNING,
  BATTLE_OUTCOME_TALLY_CAP,
  BATTLE_OUTCOME_TALLY_GATE_VALUE,
  BATTLE_OUTCOME_TEAM_BASE_OFFSET,
  BATTLE_OUTCOME_TEAM_COUNT,
  BATTLE_OUTCOME_TEAM_ONE_AHEAD,
  BATTLE_OUTCOME_TEAM_SLOT_COUNT,
  BATTLE_OUTCOME_TEAM_ZERO_AHEAD,
  BATTLE_OUTCOME_TIER_FRAMES,
  BATTLE_OUTCOME_TIER_MAX,
  BATTLE_OUTCOME_TIME_LIMIT_FRAMES,
  battleTimeTier,
  checkBattleEnd,
  demoteLevelVerdict,
  judgeBattle,
  payoutAllowed,
  recordRoundOutcome,
  standingOnTeam,
  teamHealthTotal,
  tickBattleClock,
  verdictIsWin
} from "../src/championship/battle/battleOutcome.js";

import { BATTLE_FRAME_ROSTER_BASE_OFFSET, BATTLE_FRAME_SLOT_COUNT } from "../src/championship/battle/battleFrameLoop.js";
import { BATTLE_COMBATANT_SLOT_COUNT } from "../src/championship/battle/battleDamageResolver.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const member = (currentHp, maxHp = 100) => ({ currentHp, maxHp });
const team = (members, extra = {}) => ({
  members: [...members, null, null, null].slice(0, BATTLE_OUTCOME_TEAM_SLOT_COUNT),
  count: BATTLE_OUTCOME_TEAM_SLOT_COUNT,
  downed: 0,
  ...extra
});

test("the two teams of three are the six slots the frame already walks", () => {
  assert.equal(BATTLE_OUTCOME_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_OUTCOME_TEAM_COUNT * BATTLE_OUTCOME_TEAM_SLOT_COUNT, 6);
  assert.equal(BATTLE_OUTCOME_TEAM_COUNT * BATTLE_OUTCOME_TEAM_SLOT_COUNT, BATTLE_FRAME_SLOT_COUNT);
  assert.equal(BATTLE_FRAME_SLOT_COUNT, BATTLE_COMBATANT_SLOT_COUNT);
  // The two team pointers sit immediately below the flat six the frame reads.
  assert.equal(BATTLE_OUTCOME_TEAM_BASE_OFFSET + BATTLE_OUTCOME_TEAM_COUNT * 4, BATTLE_FRAME_ROSTER_BASE_OFFSET);
  assert.equal(BATTLE_OUTCOME_END_CHECK_SITE, "OVL19:0x021107E0");
  assert.equal(BATTLE_OUTCOME_JUDGE_SITE, "OVL19:0x0210DF9C");
});

test("the clock is 7200 frames in eight 900-frame tiers", () => {
  assert.equal(BATTLE_OUTCOME_TIME_LIMIT_FRAMES, 7200);
  assert.equal(BATTLE_OUTCOME_TIER_FRAMES, 900);
  assert.equal(BATTLE_OUTCOME_TIER_MAX, 7);
  // The tier saturates exactly as the limit arrives: 8 * 900 == 7200.
  assert.equal((BATTLE_OUTCOME_TIER_MAX + 1) * BATTLE_OUTCOME_TIER_FRAMES, BATTLE_OUTCOME_TIME_LIMIT_FRAMES);

  assert.equal(battleTimeTier(0), 0);
  assert.equal(battleTimeTier(899), 0);
  assert.equal(battleTimeTier(900), 1);
  assert.equal(battleTimeTier(6299), 6);
  assert.equal(battleTimeTier(6300), 7);
  assert.equal(battleTimeTier(7200), 7, "clamped, not 8");
  assert.equal(battleTimeTier(1_000_000), 7);
  assert.throws(() => battleTimeTier(-1), /FRAMES_MUST_NOT_BE_NEGATIVE/);

  assert.deepEqual({ ...tickBattleClock(899) }, { frames: 900, tier: 1 });
  assert.deepEqual({ ...tickBattleClock(7200) }, { frames: 7201, tier: 7 });
});

test("the divisor is 900 across the whole range the ROM's magic number covers", () => {
  // The magic 0x91A2B3C5 with asr #9. Read by hand it is easy to get wrong --
  // that mistake produced a wrong cooldown formula earlier in this lane -- so it
  // is checked numerically instead.
  const magic = 0x91a2b3c5 - 2 ** 32;
  for (let n = 0; n < 20000; n += 1) {
    const high = Math.floor((magic * n) / 2 ** 32);
    const rom = (n >>> 31) + ((n + high) >> 9);
    assert.equal(rom, Math.floor(n / BATTLE_OUTCOME_TIER_FRAMES), `n=${n}`);
  }
});

test("more standing wins outright, and only the first `count` slots are counted", () => {
  assert.equal(BATTLE_OUTCOME_HP_OFFSET, 0x50);
  assert.equal(BATTLE_OUTCOME_HP_DIVISOR_OFFSET, 0x58);

  assert.equal(standingOnTeam(team([member(10), member(10), member(10)])), 3);
  assert.equal(standingOnTeam(team([member(10), member(0), member(10)])), 2, "0 hp is down");
  assert.equal(standingOnTeam(team([member(-1), member(-1), member(-1)])), 0);
  // A shorter roster never looks past its own count.
  assert.equal(standingOnTeam(team([member(10)], { count: 1 })), 1);
  assert.equal(standingOnTeam(team([], { count: 0 })), 0);

  const strong = team([member(1), member(1), member(1)]);
  const weak = team([member(100), member(100), null]);
  assert.equal(judgeBattle([strong, weak]), BATTLE_OUTCOME_TEAM_ZERO_AHEAD, "3 standing beats 2, however hurt");
  assert.equal(judgeBattle([weak, strong]), BATTLE_OUTCOME_TEAM_ONE_AHEAD);
});

test("a level count is broken by summed health fractions in single precision", () => {
  const half = team([member(50), member(50), member(50)]);
  const full = team([member(100), member(100), member(100)]);
  assert.equal(judgeBattle([half, full]), BATTLE_OUTCOME_TEAM_ONE_AHEAD);
  assert.equal(judgeBattle([full, half]), BATTLE_OUTCOME_TEAM_ZERO_AHEAD);
  assert.equal(judgeBattle([full, full]), BATTLE_OUTCOME_LEVEL);

  // Rounding happens at every divide and every add, so the total is a float32
  // and not the double-precision sum of the same three fractions.
  const sevenths = team([member(1, 7), member(1, 7), member(1, 7)]);
  const chained = Math.fround(Math.fround(Math.fround(Math.fround(1 / 7) + Math.fround(1 / 7))) + Math.fround(1 / 7));
  assert.equal(teamHealthTotal(sevenths), chained);
  assert.notEqual(teamHealthTotal(sevenths), 1 / 7 + 1 / 7 + 1 / 7, "the ROM's precision, not JavaScript's");
  assert.equal(Object.is(teamHealthTotal(sevenths), Math.fround(teamHealthTotal(sevenths))), true);
  // A null slot contributes nothing rather than dividing zero by zero.
  assert.equal(Number.isNaN(teamHealthTotal(team([member(10), null, null]))), false);
});

test("both teams are tested with no early exit, and the time check still runs", () => {
  const alive = team([member(10), member(10), member(10)]);
  const wiped = team([member(-1), member(-1), member(-1)], { downed: 3 });

  const running = checkBattleEnd({ teams: [alive, alive], frames: 10 });
  assert.equal(running.ended, false);
  assert.equal(running.reason, BATTLE_OUTCOME_END_NONE);
  assert.equal(running.verdict, BATTLE_OUTCOME_RUNNING);
  assert.equal(running.phase, null);

  const ko = checkBattleEnd({ teams: [alive, wiped], frames: 10 });
  assert.equal(ko.ended, true);
  assert.equal(ko.reason, BATTLE_OUTCOME_END_TEAM_DOWN);
  assert.equal(ko.phase, BATTLE_OUTCOME_END_PHASE);
  assert.equal(ko.verdict, BATTLE_OUTCOME_TEAM_ZERO_AHEAD);
  assert.deepEqual(ko.judgements.map((entry) => entry.team), [1]);

  // No early exit: two wiped teams judge twice.
  const both = checkBattleEnd({ teams: [wiped, wiped], frames: 10 });
  assert.deepEqual(both.judgements.map((entry) => entry.team), [0, 1]);
  assert.equal(both.verdict, BATTLE_OUTCOME_LEVEL, "nobody standing, and the totals match");

  // And the time check runs after the loop, overwriting the reason.
  const together = checkBattleEnd({ teams: [alive, wiped], frames: 7201 });
  assert.deepEqual(together.judgements.map((entry) => entry.reason),
    [BATTLE_OUTCOME_END_TEAM_DOWN, BATTLE_OUTCOME_END_TIME_UP]);
  assert.equal(together.reason, BATTLE_OUTCOME_END_TIME_UP);
});

test("frame 7200 still plays and frame 7201 does not", () => {
  const alive = team([member(10), member(10), member(10)]);
  assert.equal(checkBattleEnd({ teams: [alive, alive], frames: 7199 }).ended, false);
  assert.equal(checkBattleEnd({ teams: [alive, alive], frames: 7200 }).ended, false, "`ble` returns");
  const over = checkBattleEnd({ teams: [alive, alive], frames: 7201 });
  assert.equal(over.ended, true);
  assert.equal(over.reason, BATTLE_OUTCOME_END_TIME_UP);
  assert.equal(over.judgements[0].team, null);
});

test("a team is out when downed reaches its count, not when it passes it", () => {
  const hurt = team([member(1), member(1), member(1)]);
  assert.equal(checkBattleEnd({ teams: [hurt, { ...hurt, downed: 2 }], frames: 0 }).ended, false);
  assert.equal(checkBattleEnd({ teams: [hurt, { ...hurt, downed: 3 }], frames: 0 }).ended, true);
  // A one-member team is out at one.
  const solo = team([member(1)], { count: 1, downed: 1 });
  assert.equal(checkBattleEnd({ teams: [hurt, solo], frames: 0 }).ended, true);
});

test("type 2 inverts the test, and the level demotion can never change the answer", () => {
  assert.equal(BATTLE_OUTCOME_INVERTED_TYPE, 2);
  for (const type of [0, 1, 3, 99]) {
    assert.equal(verdictIsWin(BATTLE_OUTCOME_TEAM_ZERO_AHEAD, type), true, `type ${type}`);
    assert.equal(verdictIsWin(BATTLE_OUTCOME_TEAM_ONE_AHEAD, type), false);
    assert.equal(verdictIsWin(BATTLE_OUTCOME_LEVEL, type), false);
  }
  assert.equal(verdictIsWin(BATTLE_OUTCOME_TEAM_ZERO_AHEAD, 2), false);
  assert.equal(verdictIsWin(BATTLE_OUTCOME_TEAM_ONE_AHEAD, 2), true);
  assert.equal(verdictIsWin(BATTLE_OUTCOME_LEVEL, 2), true);

  // 0x02110B5C demotes 5 to 3. Whichever order the two routines run in, the
  // recorded flag is the same -- which is why this lane does not need to know.
  assert.equal(demoteLevelVerdict(BATTLE_OUTCOME_LEVEL), BATTLE_OUTCOME_TEAM_ONE_AHEAD);
  assert.equal(demoteLevelVerdict(BATTLE_OUTCOME_TEAM_ZERO_AHEAD), BATTLE_OUTCOME_TEAM_ZERO_AHEAD);
  for (const type of [0, 1, 2, 3]) {
    for (const verdict of [BATTLE_OUTCOME_TEAM_ONE_AHEAD, BATTLE_OUTCOME_TEAM_ZERO_AHEAD, BATTLE_OUTCOME_LEVEL]) {
      assert.equal(verdictIsWin(verdict, type), verdictIsWin(demoteLevelVerdict(verdict), type),
        `verdict ${verdict} type ${type}`);
    }
  }
});

test("the round flag is written at the cursor and the cursor then advances", () => {
  assert.equal(BATTLE_OUTCOME_ROUND_CURSOR_OFFSET, 0xca4);
  assert.equal(BATTLE_OUTCOME_ROUND_FLAG_OFFSET, 0xcac);

  const first = recordRoundOutcome({ flags: [], cursor: 0, verdict: BATTLE_OUTCOME_TEAM_ZERO_AHEAD, battleType: 0 });
  assert.deepEqual([...first.flags], [1]);
  assert.equal(first.cursor, 1);
  assert.equal(first.won, true);

  const second = recordRoundOutcome({ flags: first.flags, cursor: first.cursor, verdict: BATTLE_OUTCOME_TEAM_ONE_AHEAD, battleType: 0 });
  assert.deepEqual([...second.flags], [1, 0]);
  assert.equal(second.cursor, 2);
  assert.equal(second.won, false);
  assert.throws(() => recordRoundOutcome({ cursor: -1, verdict: 4 }), /CURSOR_MUST_NOT_BE_NEGATIVE/);
});

test("the tally counts wins under gate 3 only, never resets, and caps at 9999", () => {
  assert.equal(BATTLE_OUTCOME_TALLY_GATE_VALUE, 3);
  assert.equal(BATTLE_OUTCOME_TALLY_CAP, 9999);

  const win = (tally, gate) => recordRoundOutcome({ flags: [], cursor: 0, verdict: BATTLE_OUTCOME_TEAM_ZERO_AHEAD, battleType: 0, tallyGate: gate, tally }).tally;
  const loss = (tally, gate) => recordRoundOutcome({ flags: [], cursor: 0, verdict: BATTLE_OUTCOME_TEAM_ONE_AHEAD, battleType: 0, tallyGate: gate, tally }).tally;

  assert.equal(win(0, 3), 1);
  assert.equal(win(5, 3), 6);
  assert.equal(win(5, 2), 5, "another gate value counts nothing");
  assert.equal(loss(5, 3), 5, "a loss leaves it alone rather than clearing it");
  assert.equal(win(9998, 3), 9999);
  assert.equal(win(9999, 3), 9999, "`cmp / strlt` stops at the cap");
  assert.equal(win(10_000, 3), 10_000, "and never writes a smaller value back");
});

test("the payout needs every round of the tournament, which is the reward module's flag", () => {
  assert.equal(BATTLE_OUTCOME_PAYOUT_GATE_SITE, "OVL8:0x0210D0C8");
  assert.equal(payoutAllowed([], 0), true, "`bls` skips the loop before the first round");
  assert.equal(payoutAllowed([1], 1), true);
  assert.equal(payoutAllowed([1, 1, 1], 3), true);
  assert.equal(payoutAllowed([1, 0, 1], 3), false, "one lost round takes the whole payout");
  assert.equal(payoutAllowed([0, 1, 1], 3), false);
  // Flags past the cursor are not looked at.
  assert.equal(payoutAllowed([1, 1, 0], 2), true);

  // And the reward module's "win flag == 0 -> return" is this gate's output.
  const reward = fs.readFileSync(path.join(root, "src/championship/battle/battleRewardTransaction.js"), "utf8");
  assert.match(reward, /0x0210D184\s+win flag == 0/);
  assert.match(reward, /credited whole or not at all/);
});

test("a full tournament run composes end to end", () => {
  const alive = team([member(100), member(100), member(100)]);
  const wiped = team([member(0), member(0), member(0)], { downed: 3 });
  let flags = [];
  let cursor = 0;
  for (const opponent of [wiped, wiped, alive]) {
    const end = checkBattleEnd({ teams: [alive, opponent], frames: 7201 });
    assert.equal(end.ended, true);
    const recorded = recordRoundOutcome({ flags, cursor, verdict: demoteLevelVerdict(end.verdict), battleType: 0 });
    flags = recorded.flags;
    cursor = recorded.cursor;
  }
  assert.deepEqual([...flags], [1, 1, 0], "the third was level, and level is not a win");
  assert.equal(payoutAllowed(flags, cursor), false);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleOutcome.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
