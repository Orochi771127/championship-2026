// Weekly title schedule copy -- PRODUCT_AUTHORED (WEEKLY_SEASON_20261110). Display only.
import { uiText } from "./uiText.js";
import { weeklySlotClock, weeklyTitleEntry } from "../time/weeklyTitleSchedule.js";
import { monthlyDayOfMonth } from "../time/monthlyCalendar.js";

export const WEEKLY_SEASON_NAMES = Object.freeze(["春季", "夏季", "秋季", "冬季"]);
export const WEEKLY_SLOT_NAMES = Object.freeze({ MORNING: "早場", AFTERNOON: "午場", EVENING: "晚場", DAYTIME: "日場", ALL_DAY: "全天" });

/** 「早場 07:00–12:00」 */
export function weeklySlotText(slot) {
  const name = WEEKLY_SLOT_NAMES[slot];
  return name ? uiText("{slot} {clock}", { slot: uiText(name), clock: weeklySlotClock(slot) }) : "";
}

/** 「春季 第 3 天（每月 3 日）」; winter's last day adds the overtime days. */
export function weeklyDayText(season, dayOfSeason) {
  const params = { season: uiText(WEEKLY_SEASON_NAMES[season] ?? ""), day: dayOfSeason + 1, date: monthlyDayOfMonth(season, dayOfSeason) };
  return season === 3 && dayOfSeason === 6 ? uiText("{season} 第 {day} 天（每月 {date} 日與 29–31 日）", params)
    : uiText("{season} 第 {day} 天（每月 {date} 日）", params);
}

/** 「春季 第 3 天（每月 3 日）・日場 07:00–17:00」 for one title, or null when it is not on the weekly calendar. */
export function weeklyTitleWhenText(recordIndex) {
  const entry = weeklyTitleEntry(recordIndex);
  return entry ? uiText("{day}・{slot}", { day: weeklyDayText(entry.season, entry.dayOfSeason), slot: weeklySlotText(entry.slot) }) : null;
}
