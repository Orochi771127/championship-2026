// Real-time ranch clock -- OWNER_APPROVED_ADAPTATION 2026-11-02 (STAGE_REDESIGN_BURST_20261102, real time).
//
// NOT original behaviour. Under REALTIME_V1 the ranch clock is the device's local time: no fast-forward and no
// 22:00 day end. 22:00-07:00 is the night nap: partners sleep, and a touch, feeding or treatment wakes one for
// ten minutes. Growth keeps the native age units and lifespans but runs at a product pace per stage (units per
// real second), so a new egg reaches 成熟期 in about a day and a half. While the game is closed up to twelve
// hours count, as growth only: no hunger, sickness or death, and an evolution waits until the player is back.
// The calendar keeps the native eight days a season, so a season is about eight real days.
// The app's default stays NATIVE (parity fixtures and replays); the product entry passes REALTIME_V1.

export const CLOCK_POLICY_NATIVE = 'NATIVE';
export const CLOCK_POLICY_REALTIME = 'REALTIME_V1';
export const CLOCK_POLICIES = Object.freeze([CLOCK_POLICY_NATIVE, CLOCK_POLICY_REALTIME]);

export const REALTIME_NIGHT_START_MINUTE = 22 * 60;
export const REALTIME_NIGHT_END_MINUTE = 7 * 60;
export const REALTIME_WAKE_SECONDS = 600;
// Night disturbance (Owner 2026-11-02): waking a sleeping partner by handling it (a tap, the hand, a carry; never
// feeding or treatment) costs 育成妨礙 +1 on the native care-mistake count (at most 7, the native cap; lifetime
// evolution routes read it) and affection -5. It stays awake for REALTIME_WAKE_SECONDS, so it is counted again
// only after it falls asleep again.
export const REALTIME_DISTURBANCE = Object.freeze({careMistakes: 1, careMistakeMaximum: 7, affectionLoss: 5});
export const REALTIME_OFFLINE_CAP_SECONDS = 12 * 3600;
// Native age units per real second by generation (egg, 幼年期 I, 幼年期 II, 成長期, 成熟期, 覺醒體, 究極體).
// With the native lifespans 60 / 1440 / 5760 / 11520 that is about 2 min / 30 min / 3 h / 32 h per stage.
// 成熟期 and later never age out; their rate only paces hunger, rest and care.
export const REALTIME_AGE_UNITS_PER_SECOND = Object.freeze([0.5, 0.8, 5760 / 10800, 0.1, 0.05, 0.05, 0.05]);
// Food left out spoils at the 成長期 pace.
export const REALTIME_FOOD_UNITS_PER_SECOND = 0.1;

const DAY_MS = 86_400_000;
export function localMinuteOfDay(ms) { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
/** Whole local days since the epoch (a local midnight starts the next one). */
export function localDayNumber(ms) { return Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / DAY_MS); }
export function isNightNap(minute) { return minute >= REALTIME_NIGHT_START_MINUTE || minute < REALTIME_NIGHT_END_MINUTE; }
/** The four parts of the day the ranch is lit for. */
export function realtimeDayPeriod(minute) {
  if (minute >= 5 * 60 && minute < 10 * 60) return 'MORNING';
  if (minute >= 10 * 60 && minute < 17 * 60) return 'DAY';
  if (minute >= 17 * 60 && minute < 19 * 60) return 'DUSK';
  return 'NIGHT';
}

/**
 * World minutes to advance a clock that shows `clockMinutes`, last matched to the real time `lastMs`, so that it
 * shows `nowMs`: every real day in between, then the minute. Never backwards: when the device clock is set back
 * the world clock waits for it (0). Only on loading (`rollForward`) does a clock ahead of the device -- a save
 * from the fast-forward clock -- move on to the same minute of the next day.
 */
export function realtimeClockAdvance({clockMinutes, lastMs, nowMs, rollForward = false}) {
  if (!Number.isFinite(nowMs)) return 0;
  if (!Number.isFinite(lastMs)) lastMs = nowMs;
  if (nowMs < lastMs) return 0;
  let minutes = (localDayNumber(nowMs) - localDayNumber(lastMs)) * 1440 + localMinuteOfDay(nowMs) - clockMinutes;
  if (minutes < 0) minutes = rollForward ? minutes + Math.ceil(-minutes / 1440) * 1440 : 0;
  return minutes;
}

/** Real seconds that count as offline growth (capped at twelve hours). */
export function offlineGrowthSeconds(lastMs, nowMs) {
  if (!Number.isFinite(lastMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.min(REALTIME_OFFLINE_CAP_SECONDS, (nowMs - lastMs) / 1000));
}

// Recovery cages -- OWNER_APPROVED_ADAPTATION 2026-11-03 (infirmary heal on real time). Natively the mini infirmary,
// the hot spring and the infirmary heal on the partner's age clock, most of it in the 22:00 overnight settlement.
// Real time has neither (from 成熟期 on a partner ages one unit per twenty seconds), so a partner barely healed.
// Here their condition commands tick once a real second instead, at their native intervals. Each HP step heals
// delta/2400 of the maximum HP, so at any maximum the mini infirmary (+8 every 2 ticks) heals fully in about ten
// minutes, the infirmary (+12) in about seven and the hot spring (+20) in about four. Stress and affection keep
// their native steps (the mini infirmary: stress -1 every 6 s).
export const REALTIME_RECOVERY_CAGES = Object.freeze([15, 18, 28]);
export const REALTIME_RECOVERY_TICKS_PER_SECOND = 1;
export function realtimeRecoveryEffect(effect, maxHp) {
  if (effect.kind !== 1 || effect.delta === 0) return effect;
  return {...effect, delta: Math.sign(effect.delta) * Math.max(1, Math.ceil((maxHp >>> 0) * Math.abs(effect.delta) / 2400))};
}

export function realtimeAgeRate(generation) {
  return REALTIME_AGE_UNITS_PER_SECOND[generation] ?? REALTIME_AGE_UNITS_PER_SECOND[4];
}

/** Add `amount` to the fractional age kept under `key`; returns the whole units reached (at most `cap`). */
export function takeAgeUnits(accumulators, key, amount, cap = 2) {
  const value = (accumulators.get(key) ?? 0) + amount;
  const whole = Math.max(0, Math.min(cap, Math.floor(value + 1e-9)));
  accumulators.set(key, value - whole);
  return whole;
}
