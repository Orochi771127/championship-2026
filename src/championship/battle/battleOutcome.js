// Battle outcome — how a match ends, who is judged to have won, and what the
// tournament does with that.
//
// Independently dumped from YDIJ ROM SHA-256 8ad375ba…c5d1.
//
// This is the last link the battle lane was missing. Everything else described
// what happens inside a frame; nothing described how the frames stop.
//
// THE TWO WAYS A MATCH ENDS  (OVL19 0x021107E0)
// ---------------------------------------------
//   021107F8  ldr r0, [r0, #0xe18]     team roster, battleCtx + 0x5E18 + t*4
//   021107FC  ldr r1, [r0, #0x14]
//   02110800  ldr r0, [r0, #0x10]
//   02110804  cmp r1, r0
//   02110808  blt #0x2110824           still standing: next team
//   02110810  str r7, [r5, #0xea0]     end reason := 2
//   02110814  bl  #0x210df9c           judge
//   02110820  bl  #0x210de38           request phase 4
//   02110828  cmp r4, #2               both teams, every frame
//
//   02110834  ldr r2, [r1, #0xe98]     the frame counter
//   02110838  ldr r0, [pc, #0x38]      0x00001C20 = 7200
//   0211083C  cmp r2, r0
//   02110840  pople                    7200 exactly does NOT end it
//   0211084C  str r2, [r1, #0xea0]     end reason := 1
//
// 7200 frames is 120 seconds at 60fps. The loop has no early exit, so a frame
// that wipes both teams judges twice, and a frame that both wipes a team and
// runs out of time ends up recording the time-up reason over the wipe.
//
// THE CLOCK  (OVL19 0x0210D93C, inside the frame function)
// --------------------------------------------------------
//   0210D93C  ldr   r1, [pc, #0x4cc]   0x91A2B3C5
//   0210D940  add   r4, r0, #1
//   0210D944  smull r0, r3, r1, r4
//   0210D950  add   r3, r0, r3, asr #9
//   0210D954  cmp   r3, #8
//   0210D958  str   r4, [r2, #0xe98]
//   0210D95C  strlt r3, [r2, #0xe9c]
//
// The magic number was not read by hand. Dividing by 900 was checked against
// every n in 0..99,999 with no mismatch — this is the trap that produced a wrong
// cooldown formula earlier in this lane. So +0xE9C is min(7, frames / 900): an
// eight-step tier that lands on 7 exactly as the 7200-frame limit arrives.
//
// THE JUDGE  (OVL19 0x0210DF9C)
// -----------------------------
// First, how many are still standing on each side (0x021127B0):
//
//   021127B0  ldr   ip, [r0, #0x10]    the team's member count
//   021127D0  ldr   r1, [r1, #0x50]    member->+0x10->+0x50
//   021127D4  cmp   r1, #0
//   021127D8  addle r2, r2, #1         <= 0 is down
//   021127E4  sub   r0, ip, r2
//
//   0210DFC4  cmp r4, r0
//   0210DFC8  bne #0x210e090           different counts: more standing wins
//
// If the counts are level it goes to a sum of health fractions, in IEEE-754
// single precision — not Q12. 0x0202AE3C is int-to-float, 0x0202A98C is float
// divide (a reciprocal table at pc-0x94 plus Newton steps, exponents
// subtracted), 0x0202A1F0 is float add, 0x0202A8B0 compares for equality and
// 0x0202A79C for magnitude:
//
//   0210DFEC  ldr r0, [sb, r7, lsl #2]   the team's three members
//   0210DFF0  beq #0x210e02c             a null slot contributes nothing
//   0210DFFC  ldr r0, [r8, #0x50]
//   0210E008  ldr r0, [r8, #0x58]
//   0210E018  bl  #0x202a98c             +0x50 / +0x58
//   0210E024  bl  #0x202a1f0             into this team's running total
//
//   0210E050  bne #0x210e068             equal totals: verdict 5
//   0210E078  movhs r1, #4               team 0 ahead
//   0210E080  movlo r1, #3               team 1 ahead
//
// +0x50 and +0x58 are the two battleFrameLoop already names currentHp and maxHp
// on the same stats block, and the judge dividing one by the other agrees with
// that reading. Rounding happens at every divide and every add, so the sum is
// modelled with Math.fround at each step rather than in double precision.
//
// The two death tests do NOT agree, and that is the ROM's doing: the frame loop
// reports a combatant defeated on `hp < 0`, so exactly zero survives the frame,
// while the standing count here is `hp <= 0`. A combatant on exactly zero is
// alive to the frame and down to the judge. Neither was made to match.
//
// WHICH SLOTS ARE WHICH TEAM  (OVL19 0x0210CAB8)
// ----------------------------------------------
//   0210CAB8  add sl, r6, r0          slot := withinTeam + base
//   0210CCF0  add r0, r0, #3          base advances by three per team
//   0210CCE8  cmp r0, #2
//
// So slots 0..2 are team 0 and slots 3..5 are team 1, and the six the frame
// walks at +0x5E20 are the two teams laid end to end. Each combatant is 0x18C
// bytes (`mov r0, #0x18c` at 0x0210CAD8).
//
// A LEVEL VERDICT IS NOT A DRAW  (OVL19 0x02110B4C)
// -------------------------------------------------
//   02110B58  cmp   r1, #5
//   02110B5C  moveq r1, #3
//
// Verdict 5 is demoted to 3 before the result is shown. It cannot change the win
// flag either way — see the test — but the ROM does it, so this does too.
//
// RECORDING THE ROUND  (OVL19 0x0210E280)
// ---------------------------------------
//   0210E284  ldr  r0, [r0]            *0x0210B2DC, the battle type
//   0210E28C  cmpne r0, #1
//   0210E294  cmp  r0, #2              only type 2 takes the other branch
//   0210E2BC  ldr  r1, [r3, #0xca4]    the round cursor
//   0210E2C4  str  r2, [r1, #0xcac]    flags[cursor] := 1
//   0210E304  str  r1, [r0, #0xcac]    flags[cursor] := 0
//   0210E390  add  r3, r3, #1
//   0210E394  str  r3, [r4, #0xca4]    cursor advances
//
// Type 0 and type 1 win on verdict 4. Type 2 wins on anything but 4 — the test
// is inverted, not the verdict. And on a win, when +0xC98 is 3:
//
//   0210E2D0  cmp   r0, #3
//   0210E2DC  ldr   r0, [pc, #0x81c]   0x0000270F = 9999
//   0210E2E8  strlt r0, [r2, #0xeac]
//
// a tally climbs by one, capped at 9999. Nothing in OVL19 ever clears it, so it
// accumulates rather than being a streak.
//
// THE PAYOUT GATE  (OVL8 0x0210D0C8)
// ----------------------------------
//   0210D0E8  str   r0, [r5, #0x7fc]   assume paid
//   0210D0F4  cmp   r0, #0
//   0210D0F8  bls   #0x210d124         no rounds yet: still paid
//   0210D104  ldr   r0, [r0, #0xcac]
//   0210D110  streq r2, [r5, #0x7fc]   any lost round zeroes it
//   0210D184  popeq                    and then nothing is paid
//
// So battleRewardTransaction's "win flag" is really every round of the
// tournament so far. Lose one and the whole payout is gone, which is why that
// module found the payout is credited whole or not at all.
//
// WHAT IS NOT DECIDED HERE
// ------------------------
// What +0xC98 is beyond the one value that gates the tally. What the battle type
// at 0x0210B2DC means — it is a runtime static, and only the three-way split is
// traced. What the phase 4 requested at the end actually draws. And whether the
// team roster's +0x10/+0x14 are written anywhere this lane has walked: the end
// check reads them, and that is all that is claimed.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const BATTLE_OUTCOME_EVIDENCE = "VERIFIED_BINARY";
export const BATTLE_OUTCOME_END_CHECK_SITE = "OVL19:0x021107E0";
export const BATTLE_OUTCOME_CLOCK_SITE = "OVL19:0x0210D93C";
export const BATTLE_OUTCOME_JUDGE_SITE = "OVL19:0x0210DF9C";
export const BATTLE_OUTCOME_STANDING_COUNT_SITE = "OVL19:0x021127B0";
export const BATTLE_OUTCOME_DEMOTION_SITE = "OVL19:0x02110B4C";
export const BATTLE_OUTCOME_RECORD_SITE = "OVL19:0x0210E280";
export const BATTLE_OUTCOME_PAYOUT_GATE_SITE = "OVL8:0x0210D0C8";
export const BATTLE_OUTCOME_PHASE_REQUEST_SITE = "OVL19:0x0210DE38";
export const BATTLE_OUTCOME_INIT_SITE = "OVL19:0x0210CDC8";

/** The battle-type static the recorder switches on. */
export const BATTLE_OUTCOME_TYPE_SELECTOR = 0x0210b2dc;

/** Battle-context offsets, absolute from the context base. */
export const BATTLE_OUTCOME_TEAM_BASE_OFFSET = 0x5e18;
export const BATTLE_OUTCOME_FRAME_COUNTER_OFFSET = 0x5e98;
export const BATTLE_OUTCOME_TIER_OFFSET = 0x5e9c;
export const BATTLE_OUTCOME_END_REASON_OFFSET = 0x5ea0;
export const BATTLE_OUTCOME_VERDICT_OFFSET = 0x5ea4;

/** Two teams of three; `cmp r4,#2` and `cmp r7,#3`. */
export const BATTLE_OUTCOME_TEAM_COUNT = 2;
export const BATTLE_OUTCOME_TEAM_SLOT_COUNT = 3;

/** On the team roster. */
export const BATTLE_OUTCOME_ROSTER_COUNT_OFFSET = 0x10;
export const BATTLE_OUTCOME_ROSTER_DOWNED_OFFSET = 0x14;

/** On a member: +0x10 reaches the block the other two live on. */
export const BATTLE_OUTCOME_MEMBER_BLOCK_OFFSET = 0x10;
export const BATTLE_OUTCOME_HP_OFFSET = 0x50;
export const BATTLE_OUTCOME_HP_DIVISOR_OFFSET = 0x58;

/** OVL19 0x0210CAB8 / 0x0210CCF0 — three slots per team, in order. */
export const BATTLE_OUTCOME_ROSTER_INIT_SITE = "OVL19:0x0210CAB8";
/** `mov r0, #0x18c` at 0x0210CAD8. */
export const BATTLE_OUTCOME_COMBATANT_SIZE = 0x18c;

/** 0x1C20, and the compare is `ble` — 7200 exactly keeps playing. */
export const BATTLE_OUTCOME_TIME_LIMIT_FRAMES = 7200;
/** Proven against every n in 0..99,999, not read off the magic number. */
export const BATTLE_OUTCOME_TIER_FRAMES = 900;
/** `cmp r3,#8 / strlt` — the tier stops at 7. */
export const BATTLE_OUTCOME_TIER_MAX = 7;

export const BATTLE_OUTCOME_RUNNING = 0;
export const BATTLE_OUTCOME_TEAM_ONE_AHEAD = 3;
export const BATTLE_OUTCOME_TEAM_ZERO_AHEAD = 4;
export const BATTLE_OUTCOME_LEVEL = 5;

export const BATTLE_OUTCOME_END_NONE = 0;
export const BATTLE_OUTCOME_END_TIME_UP = 1;
export const BATTLE_OUTCOME_END_TEAM_DOWN = 2;

/** Only type 2 inverts the test; every other value takes the fallthrough. */
export const BATTLE_OUTCOME_INVERTED_TYPE = 2;

/** Tournament fields, on the session context at *0x020FBA08. */
export const BATTLE_OUTCOME_ROUND_CURSOR_OFFSET = 0xca4;
export const BATTLE_OUTCOME_ROUND_FLAG_OFFSET = 0xcac;
export const BATTLE_OUTCOME_TALLY_GATE_OFFSET = 0xc98;
export const BATTLE_OUTCOME_TALLY_GATE_VALUE = 3;
export const BATTLE_OUTCOME_TALLY_OFFSET = 0xeac;
export const BATTLE_OUTCOME_TALLY_CAP = 9999;
/** Cleared alongside the cursor advance at 0x0210E39C. */
export const BATTLE_OUTCOME_CLEARED_ON_ADVANCE_OFFSET = 0xcc;

/** `bl 0x210de38` with r1 = 4 on both end paths. */
export const BATTLE_OUTCOME_END_PHASE = 4;

function outcomeError(message) {
  return new Error(`BATTLE_OUTCOME_${message}`);
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw outcomeError(`${label}_MUST_BE_AN_INTEGER`);
  }
  return value;
}

function requireFinite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw outcomeError(`${label}_MUST_BE_A_FINITE_NUMBER`);
  }
  return value;
}

/** min(7, frames / 900) — the eight-step tier at +0x5E9C. */
export function battleTimeTier(frames) {
  const elapsed = requireInteger(frames, "FRAMES");
  if (elapsed < 0) {
    throw outcomeError("FRAMES_MUST_NOT_BE_NEGATIVE");
  }
  const tier = Math.floor(elapsed / BATTLE_OUTCOME_TIER_FRAMES);
  return tier > BATTLE_OUTCOME_TIER_MAX ? BATTLE_OUTCOME_TIER_MAX : tier;
}

/** One frame of the clock: the counter always advances, the tier saturates. */
export function tickBattleClock(frames) {
  const next = requireInteger(frames, "FRAMES") + 1;
  return deepFreeze({ frames: next, tier: battleTimeTier(next) });
}

function requireTeam(team, label) {
  if (!team || typeof team !== "object") {
    throw outcomeError(`${label}_REQUIRES_AN_OBJECT`);
  }
  const members = team.members;
  if (!Array.isArray(members) || members.length !== BATTLE_OUTCOME_TEAM_SLOT_COUNT) {
    throw outcomeError(`${label}_NEEDS_${BATTLE_OUTCOME_TEAM_SLOT_COUNT}_SLOTS`);
  }
  return team;
}

function requireTeams(teams) {
  if (!Array.isArray(teams) || teams.length !== BATTLE_OUTCOME_TEAM_COUNT) {
    throw outcomeError(`TEAMS_MUST_BE_${BATTLE_OUTCOME_TEAM_COUNT}_LONG`);
  }
  teams.forEach((team, index) => requireTeam(team, `TEAM_${index}`));
  return teams;
}

/**
 * OVL19 0x021127B0. `count` is the roster's +0x10 and only the first `count`
 * slots are looked at; a member is down when its hp is <= 0.
 */
export function standingOnTeam(team) {
  requireTeam(team, "TEAM");
  const count = requireInteger(team.count ?? BATTLE_OUTCOME_TEAM_SLOT_COUNT, "COUNT");
  if (count <= 0) {
    // `cmp ip,#0 / ble` — the loop is skipped and count - 0 is returned.
    return count;
  }
  let down = 0;
  for (let index = 0; index < count; index += 1) {
    const member = team.members[index];
    if (!member || requireFinite(member.hp ?? member.currentHp ?? 0, "HP") <= 0) {
      down += 1;
    }
  }
  return count - down;
}

/**
 * The health-fraction total for one team, in single precision and in slot order,
 * because the ROM rounds at every divide and every add. A null slot is skipped
 * outright, so an empty team never divides zero by zero.
 */
export function teamHealthTotal(team) {
  requireTeam(team, "TEAM");
  let total = Math.fround(0);
  for (const member of team.members) {
    if (!member) continue;
    const hp = Math.fround(requireFinite(member.currentHp ?? 0, "HP"));
    const divisor = Math.fround(requireFinite(member.maxHp ?? 0, "MAX_HP"));
    total = Math.fround(total + Math.fround(hp / divisor));
  }
  return total;
}

/**
 * OVL19 0x0210DF9C. Returns 4 when team 0 is ahead, 3 when team 1 is, and 5 when
 * the two are exactly level. `teams` is [team0, team1], each with three slots.
 */
export function judgeBattle(teams) {
  requireTeams(teams);
  const standing = teams.map((team) => standingOnTeam(team));
  if (standing[0] !== standing[1]) {
    // 0x0210E090: `movgt #4 / movle #3`, and they are already known unequal.
    return standing[0] > standing[1] ? BATTLE_OUTCOME_TEAM_ZERO_AHEAD : BATTLE_OUTCOME_TEAM_ONE_AHEAD;
  }
  const totals = teams.map((team) => teamHealthTotal(team));
  if (totals[0] === totals[1]) {
    return BATTLE_OUTCOME_LEVEL;
  }
  return totals[0] > totals[1] ? BATTLE_OUTCOME_TEAM_ZERO_AHEAD : BATTLE_OUTCOME_TEAM_ONE_AHEAD;
}

/**
 * OVL19 0x021107E0, run every frame. Reports what the ROM would have written,
 * in the order it writes it: both teams are tested with no early exit, and the
 * time check runs afterwards regardless.
 */
export function checkBattleEnd(input) {
  if (!input || typeof input !== "object") {
    throw outcomeError("END_CHECK_REQUIRES_AN_OBJECT");
  }
  const teams = requireTeams(input.teams);
  const frames = requireInteger(input.frames ?? 0, "FRAMES");

  const judgements = [];
  let reason = BATTLE_OUTCOME_END_NONE;

  for (let index = 0; index < BATTLE_OUTCOME_TEAM_COUNT; index += 1) {
    const team = teams[index];
    const count = requireInteger(team.count ?? BATTLE_OUTCOME_TEAM_SLOT_COUNT, "COUNT");
    const downed = requireInteger(team.downed ?? 0, "DOWNED");
    // `cmp r1,r0 / blt` — the team is out once downed reaches the count.
    if (downed < count) continue;
    reason = BATTLE_OUTCOME_END_TEAM_DOWN;
    judgements.push({ reason: BATTLE_OUTCOME_END_TEAM_DOWN, team: index, verdict: judgeBattle(teams) });
  }

  // `cmp r2,r0 / pople` — strictly greater, so frame 7200 still plays.
  if (frames > BATTLE_OUTCOME_TIME_LIMIT_FRAMES) {
    reason = BATTLE_OUTCOME_END_TIME_UP;
    judgements.push({ reason: BATTLE_OUTCOME_END_TIME_UP, team: null, verdict: judgeBattle(teams) });
  }

  return deepFreeze({
    ended: judgements.length > 0,
    reason,
    phase: judgements.length > 0 ? BATTLE_OUTCOME_END_PHASE : null,
    verdict: judgements.length > 0 ? judgements[judgements.length - 1].verdict : BATTLE_OUTCOME_RUNNING,
    judgements: judgements.map((entry) => deepFreeze(entry))
  });
}

/** OVL19 0x02110B5C — a level verdict is shown as a loss for team 0. */
export function demoteLevelVerdict(verdict) {
  return requireInteger(verdict, "VERDICT") === BATTLE_OUTCOME_LEVEL
    ? BATTLE_OUTCOME_TEAM_ONE_AHEAD
    : verdict;
}

/**
 * OVL19 0x0210E280's two branches. Types 0 and 1 — and every value that is not
 * 2 — win on verdict 4; type 2 wins on anything else.
 */
export function verdictIsWin(verdict, battleType) {
  const value = requireInteger(verdict, "VERDICT");
  const type = requireInteger(battleType ?? 0, "BATTLE_TYPE");
  const aheadOnPoints = value === BATTLE_OUTCOME_TEAM_ZERO_AHEAD;
  return type === BATTLE_OUTCOME_INVERTED_TYPE ? !aheadOnPoints : aheadOnPoints;
}

/**
 * OVL19 0x0210E280 end to end: write the flag at the cursor, count the win when
 * the gate value is 3, then advance the cursor.
 */
export function recordRoundOutcome(input) {
  if (!input || typeof input !== "object") {
    throw outcomeError("RECORD_REQUIRES_AN_OBJECT");
  }
  const flags = Array.isArray(input.flags) ? [...input.flags] : [];
  const cursor = requireInteger(input.cursor ?? 0, "CURSOR");
  if (cursor < 0) {
    throw outcomeError("CURSOR_MUST_NOT_BE_NEGATIVE");
  }
  const won = verdictIsWin(input.verdict, input.battleType ?? 0);
  const gate = requireInteger(input.tallyGate ?? 0, "TALLY_GATE");
  let tally = requireInteger(input.tally ?? 0, "TALLY");

  while (flags.length < cursor) flags.push(0);
  flags[cursor] = won ? 1 : 0;

  if (won && gate === BATTLE_OUTCOME_TALLY_GATE_VALUE && tally < BATTLE_OUTCOME_TALLY_CAP) {
    tally += 1;
  }

  return deepFreeze({ flags: deepFreeze(flags), cursor: cursor + 1, won, tally });
}

/**
 * OVL8 0x0210D0C8. The payout stands only if every round recorded so far was
 * won; with no rounds recorded the loop never runs and it stands.
 */
export function payoutAllowed(flags, cursor) {
  const played = requireInteger(cursor ?? 0, "CURSOR");
  if (!Array.isArray(flags)) {
    throw outcomeError("FLAGS_MUST_BE_AN_ARRAY");
  }
  if (played <= 0) return true;
  for (let index = 0; index < played; index += 1) {
    if ((flags[index] ?? 0) === 0) return false;
  }
  return true;
}

/**
 * OVL19 0x0210CAB8. Slots 0..2 are team 0, slots 3..5 are team 1 — the six the
 * frame walks are the two teams laid end to end.
 */
export function battleTeamOfSlot(slot) {
  const index = requireInteger(slot, "SLOT");
  if (index < 0 || index >= BATTLE_OUTCOME_TEAM_COUNT * BATTLE_OUTCOME_TEAM_SLOT_COUNT) {
    throw outcomeError("SLOT_OUT_OF_RANGE");
  }
  return Math.floor(index / BATTLE_OUTCOME_TEAM_SLOT_COUNT);
}

/**
 * The two team views of a six-slot roster, in the ROM's order. `downed` is not
 * derived: the end check reads the roster's own +0x14, and nothing traced here
 * writes it, so a caller that has one passes it in.
 */
export function battleTeamsFromRoster(roster, downed = [0, 0]) {
  if (!Array.isArray(roster) || roster.length !== BATTLE_OUTCOME_TEAM_COUNT * BATTLE_OUTCOME_TEAM_SLOT_COUNT) {
    throw outcomeError("ROSTER_MUST_BE_6_LONG");
  }
  if (!Array.isArray(downed) || downed.length !== BATTLE_OUTCOME_TEAM_COUNT) {
    throw outcomeError(`DOWNED_MUST_BE_${BATTLE_OUTCOME_TEAM_COUNT}_LONG`);
  }
  return deepFreeze([0, 1].map((team) => {
    const members = roster.slice(team * BATTLE_OUTCOME_TEAM_SLOT_COUNT, (team + 1) * BATTLE_OUTCOME_TEAM_SLOT_COUNT);
    return deepFreeze({
      // Only the two fields the judge reads. Copying a whole combatant used to
      // work and stopped once one could reference a live script VM, whose slots
      // are typed arrays and cannot be frozen -- and a judge has no business
      // holding a window into a running VM anyway.
      members: deepFreeze(members.map((member) => (member
        ? deepFreeze({ currentHp: member.currentHp ?? 0, maxHp: member.maxHp ?? 0 })
        : null))),
      count: members.filter((member) => member).length,
      downed: requireInteger(downed[team], "DOWNED")
    });
  }));
}
