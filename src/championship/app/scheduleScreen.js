import { titleEventText } from "../text/zhHant.js";
import { uiText } from "../text/uiText.js";
// The title-match schedule board.
//
// WHAT THIS DRAWS AND WHY IT IS THE ORIGINAL'S
// --------------------------------------------
// The 62-record table at ARM9 0x020CD004 carries a season column (field14, 0..3)
// and a day column (field18, 0..7). The game's own scan at ARM9 0x02089230
// matches on exactly those two, which is what makes them the fixture date rather
// than my reading of two small integers. The names and blurbs are the cartridge's
// own text, pulled from ui/txt/txt_list_txt.dat at the indices the table's
// field00 and field04 columns point at.
//
// The grid is 4 seasons by 8 days because that is the clock cascade at ARM9
// 0x020C8A4C, the same cascade the status bar runs on. Every one of the 61
// scanned records lands in exactly one cell.
//
// THE LANGUAGE IS THE CARTRIDGE'S
// -------------------------------
// This ROM is the Japanese YDIJ release, so the fixture names are Japanese. The
// gameplay footage in the research set is the English release, a different build,
// and its English labels are not evidence for this ROM's string table. Rather
// than treating translations as ROM evidence, the board keys product-authored
// Traditional Chinese copy by the original record index.
//
// WHAT IS DELIBERATELY NOT SHOWN AS FACT
// --------------------------------------
// The scan's third condition compares field10 against the tamer rank at
// player+0x0AE8, halved. field10 is therefore a rank TIER, and a fixture needs
// rank 2 * field10 -- see titleEventSchedule.js for why that identification is
// solid. The board shows the requirement rather than enforcing it: hiding a
// season's fixtures would misreport the schedule.
//
// field0C and field1C remain unknown. Round 1 traced field24 as entry fee
// and field20 as payout; the detail panel uses those verified accessors.

import {
  TITLE_EVENT_SCAN_LIMIT,
  TITLE_EVENT_UNLOCK_COUNTER_EVIDENCE,
  TITLE_EVENT_UNLOCK_COUNTER_SITE,
  titleEventYearGrid
} from "../battle/titleEventSchedule.js";
import { WORLD_SEASONS } from "../time/championshipWorldClock.js";
import { matchEntryFee, matchPayout } from "../battle/battleMatchSelection.js";

/** Columns the original's table carries that have no traced meaning yet. */
export const SCHEDULE_UNTRACED_COLUMNS = Object.freeze(["field0C", "field1C"]);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

/**
 * Mount the schedule board.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {number} [options.season]       the current season, to mark today
 * @param {number} [options.dayOfSeason]  the current day, to mark today
 * @param {() => void} [options.onExit]
 */
export function createScheduleView({ root, bits = null, calendar = null, season = calendar?.season ?? null,
  dayOfSeason = calendar?.dayOfSeason ?? null, eligibleRecordIndices = [], progress=null,
  onToggleRegistration,onToggleChampionship,onExit } = {}) {
  if (!root) throw new TypeError("The schedule requires a root element");

  root.replaceChildren();
  root.className = "cm-schedule-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.sourceTable = "ARM9:0x020CD004";
  root.dataset.scanSite = "ARM9:0x02089230";

  const grid = titleEventYearGrid();
  const developer = new URLSearchParams(globalThis.location?.search ?? "").get("presentation") === "developer";

  const shell = element("section", "cm-schedule-shell");
  shell.append(
    element("p", "cm-schedule-kicker", "管理"),
    element("h1", "cm-schedule-title", "SCHEDULE"),
    element("p", "cm-screen-lede", "點選賽事查看報名費、獎金與參賽階級。今天可參加的賽事會標示出來。")
  );

  // Selection starts on today when the caller knows it, else on the first
  // fixture of the year, so the detail panel is never empty on arrival.
  let selected = null;
  if (Number.isInteger(season) && Number.isInteger(dayOfSeason) && grid[season]?.[dayOfSeason]?.length) {
    selected = grid[season][dayOfSeason][0];
  } else {
    outer: for (const seasonDays of grid) {
      for (const day of seasonDays) if (day.length) { selected = day[0]; break outer; }
    }
  }

  const board = element("div", "cm-schedule-board");
  // The detail opens as a sheet over the board, where the player is looking,
  // instead of below 32 calendar cells where a tap seemed to do nothing.
  const sheet = element("div", "cm-sheet");
  sheet.hidden = true;
  const scrim = element("div", "cm-sheet__scrim");
  scrim.addEventListener("click", () => closeDetail());
  const detail = element("div", "cm-schedule-detail cm-sheet__panel");
  detail.setAttribute("role", "dialog");
  detail.setAttribute("aria-label", "賽事詳細");
  sheet.append(scrim, detail);
  let opener = null;
  function closeDetail() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    opener?.focus?.({ preventScroll: true });
  }
  sheet.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDetail(); });

  function renderDetail() {
    detail.replaceChildren();
    if (!selected) {
      detail.append(element("p", "cm-schedule-empty", "No fixture selected."));
      return;
    }
    detail.append(element("h2", "cm-schedule-detail__name", titleEventText(selected.recordIndex, "name", selected.name ?? `Record ${selected.recordIndex}`)));
    detail.append(element("p", "cm-schedule-detail__when",
      `${WORLD_SEASONS[selected.season]} — Day ${selected.dayOfSeason + 1}`));

    if (selected.description) {
      const blurb = element("p", "cm-schedule-detail__blurb");
      // The cartridge writes its own line breaks; keep them.
      blurb.textContent = titleEventText(selected.recordIndex, "description", selected.description);
      detail.append(blurb);
    }

    const facts = element("dl", "cm-schedule-facts");
    // The record index is the table row, useful when comparing with the ROM
    // and meaningless to a player; it stays in developer presentation.
    if (developer) facts.append(element("dt", null, "RECORD"), element("dd", null, String(selected.recordIndex)));
    // battle_menu/titlematch_top_sub_scene.nxr lays pay_1..pay_7 against
    // have_1..have_7 and turns on pay_red when the fee cannot be met, so the
    // fee is never shown without what the player actually holds beside it.
    const fee = matchEntryFee(selected.recordIndex);
    const short = Number.isInteger(bits) && bits < fee;
    const feeValue = element("dd", null, `${fee.toLocaleString("en-US")} 位元幣`);
    if (short) feeValue.dataset.short = "true";
    const rankNeeded = selected.unlockThreshold * 2;
    const rankShort = Number.isInteger(progress?.rank) && selected.unlockThreshold > (progress.rank >>> 1);
    const rankValue = element("dd", null, rankNeeded > 0 ? `${rankNeeded} 以上` : "不限");
    if (rankShort) rankValue.dataset.short = "true";
    facts.append(
      element("dt", null, "參賽階級"),
      rankValue,
      element("dt", null, "ENTRY FEE"),
      feeValue,
      // Not the shared "HELD" copy: in the Shop that word means "at the limit".
      element("dt", null, "持有金額"),
      element("dd", null, Number.isInteger(bits) ? `${bits.toLocaleString("en-US")} 位元幣` : "—"),
      element("dt", null, "PRIZE"),
      element("dd", null, `${matchPayout(selected.recordIndex).toLocaleString("en-US")} 位元幣`)
    );
    if (short) facts.append(element("p", "cm-schedule-short", "持有金額不足以支付報名費。"));
    if (rankShort) facts.append(element("p", "cm-schedule-short", `馴獸師階級達到 ${rankNeeded} 後才能登錄這場比賽。`));
    detail.append(facts);

    const actions = element("div", "cm-sheet__actions");
    const close = element("button", "cm-screen-back cm-sheet__close", "關閉");
    close.type = "button";
    close.addEventListener("click", () => closeDetail());
    actions.append(close);
    if(progress){
      const won=progress.won.includes(selected.recordIndex),registered=progress.registered.includes(selected.recordIndex);
      const register=element('button','cm-screen-primary cm-schedule-register',won?'已獲勝':registered?'取消登錄':'登錄比賽');
      register.type='button';register.dataset.action='title-registration';
      register.disabled=won||rankShort||!onToggleRegistration;
      register.addEventListener('click',()=>{progress=onToggleRegistration(selected.recordIndex)??progress;renderDetail();renderRegistration();});
      actions.append(register);
    }
    detail.append(actions);
  }

  function select(event, button = null) {
    selected = event;
    for (const cell of board.querySelectorAll("[data-record-index]")) {
      cell.setAttribute("aria-pressed", String(Number(cell.dataset.recordIndex) === event.recordIndex));
    }
    renderDetail();
    opener = button;
    sheet.hidden = false;
    detail.querySelector?.(".cm-sheet__close")?.focus?.({ preventScroll: true });
  }

  grid.forEach((seasonDays, seasonIndex) => {
    const row = element("div", "cm-schedule-season");
    row.append(element("h2", "cm-schedule-season__name", WORLD_SEASONS[seasonIndex]));
    const days = element("div", "cm-schedule-days");

    seasonDays.forEach((events, dayIndex) => {
      const cell = element("div", "cm-schedule-day");
      cell.dataset.season = String(seasonIndex);
      cell.dataset.dayOfSeason = String(dayIndex);
      if (seasonIndex === season && dayIndex === dayOfSeason) {
        cell.dataset.today = "true";
        cell.setAttribute("aria-current", "date");
      }
      cell.append(element("p", "cm-schedule-day__number", String(dayIndex + 1)));

      if (events.length === 0) {
        cell.append(element("p", "cm-schedule-day__none", "—"));
      } else {
        for (const event of events) {
          const button = element("button", "cm-schedule-fixture");
          button.type = "button";
          button.dataset.recordIndex = String(event.recordIndex);
          button.setAttribute("aria-pressed", String(event.recordIndex === selected?.recordIndex));
          if (event.unlockThreshold > 0) button.dataset.gated = String(event.unlockThreshold);
          button.append(element("span", "cm-schedule-fixture__name", titleEventText(event.recordIndex, "name", event.name ?? `#${event.recordIndex}`)));
          button.addEventListener("click", () => select(event, button));
          cell.append(button);
        }
      }
      days.append(cell);
    });

    row.append(days);
    board.append(row);
  });

  const footer = element("p", "cm-schedule-footer", `${TITLE_EVENT_SCAN_LIMIT} scheduled fixtures across four seasons.`);

  // Leave on the left, the screen's one other action on the right.
  const actionBar = element("footer", "cm-screen-footer");
  const back = element("button", "cm-screen-back", "返回牧場");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });

  const championship=element('button','cm-screen-primary cm-schedule-championship');championship.type='button';
  championship.addEventListener('click',()=>{progress=onToggleChampionship?.()??progress;renderRegistration();});
  actionBar.append(back, championship);
  // Appended in final order rather than inserted before BACK: every other node
  // in this file is placed with append, and insertBefore is the one DOM call
  // the mounted-view suites do not provide.
  shell.append(board, footer, actionBar);
  root.append(shell, sheet);
  renderDetail();

  function renderRegistration(){
    for(const button of board.querySelectorAll('[data-record-index]')){
      const id=Number(button.dataset.recordIndex);
      button.dataset.registered=String(progress?.registered.includes(id)??false);
      button.dataset.won=String(progress?.won.includes(id)??false);
      // A lock the player can read replaces the bare rank-tier digit.
      const threshold=Number(button.dataset.gated??0);
      button.dataset.locked=String(Number.isInteger(progress?.rank)&&threshold>(progress.rank>>>1));
    }
    championship.hidden=!progress||progress.championship.stage<1;
    const key=calendar?.year%4===3?'worldEntry':'entry';
    const entered=Boolean(progress?.championship[key]);
    championship.textContent=`${entered?'取消登錄':'登錄'}${key==='worldEntry'?'世界冠軍賽':'冠軍賽'}`;
    // Registering is the action this footer offers; withdrawing is not a
    // primary action, so it drops the gold.
    championship.className=entered?'cm-screen-back cm-schedule-championship':'cm-screen-primary cm-schedule-championship';
    championship.disabled=!onToggleChampionship||!Number.isInteger(calendar?.year);
  }
  renderRegistration();

  function renderCalendar(next = {}) {
    if(next.progress){progress=next.progress;renderDetail();renderRegistration();}
    if (!next.calendar) return;
    // Keep the year the caller gave at mount: the Championship toggle needs
    // it, and a {season, day} refresh used to drop it until the next minute.
    calendar={...(calendar??{}),...next.calendar};
    season = next.calendar.season;
    dayOfSeason = next.calendar.dayOfSeason;
    for (const cell of board.querySelectorAll(".cm-schedule-day")) {
      const today = Number(cell.dataset.season) === season && Number(cell.dataset.dayOfSeason) === dayOfSeason;
      if (today) {
        cell.dataset.today = "true";
        cell.setAttribute("aria-current", "date");
      } else {
        delete cell.dataset.today;
        cell.removeAttribute("aria-current");
      }
    }
    const eligible = new Set(next.eligibleRecordIndices ?? []);
    for (const button of board.querySelectorAll("[data-record-index]")) {
      button.dataset.eligibleToday = String(eligible.has(Number(button.dataset.recordIndex)));
    }
    renderRegistration();
  }
  renderCalendar({ calendar: { season, dayOfSeason }, eligibleRecordIndices });

  return Object.freeze({
    render: renderCalendar,
    inspect() {
      return Object.freeze({
        fixtureCount: grid.flat(2).length,
        seasons: grid.length,
        daysPerSeason: grid[0].length,
        selectedRecordIndex: selected?.recordIndex ?? null,
        today: Object.freeze({ season, dayOfSeason }),
        untracedColumns: SCHEDULE_UNTRACED_COLUMNS,
        unlockCounterEvidence: TITLE_EVENT_UNLOCK_COUNTER_EVIDENCE
      });
    },
    dispose() {
      root.replaceChildren();
      root.className = "";
    }
  });
}
