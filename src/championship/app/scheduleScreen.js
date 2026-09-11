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

  const shell = element("section", "cm-schedule-shell");
  shell.append(
    element("p", "cm-schedule-kicker", "TITLE MATCHES"),
    element("h1", "cm-schedule-title", "SCHEDULE")
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
  const detail = element("div", "cm-schedule-detail");

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
    facts.append(
      element("dt", null, "RECORD"),
      element("dd", null, String(selected.recordIndex))
    );
    // battle_menu/titlematch_top_sub_scene.nxr lays pay_1..pay_7 against
    // have_1..have_7 and turns on pay_red when the fee cannot be met, so the
    // fee is never shown without what the player actually holds beside it.
    const fee = matchEntryFee(selected.recordIndex);
    const short = Number.isInteger(bits) && bits < fee;
    const feeValue = element("dd", null, `${fee} 位元幣`);
    if (short) feeValue.dataset.short = "true";
    facts.append(
      element("dt", null, "TAMER RANK"),
      element("dd", null, String(selected.unlockThreshold * 2)),
      element("dt", null, "ENTRY FEE"),
      feeValue,
      element("dt", null, "HELD"),
      element("dd", null, Number.isInteger(bits) ? `${bits} 位元幣` : "—"),
      element("dt", null, "PRIZE"),
      element("dd", null, `${matchPayout(selected.recordIndex)} 位元幣`)
    );
    if (short) facts.append(element("dt", null, ""), element("p", "cm-schedule-short", "持有金額不足以支付入場費。"));
    detail.append(facts);

    if(progress){
      const won=progress.won.includes(selected.recordIndex),registered=progress.registered.includes(selected.recordIndex);
      const register=element('button','cm-schedule-back',won?'已獲勝':registered?'取消登錄':'登錄比賽');
      register.type='button';register.dataset.action='title-registration';
      register.disabled=won||selected.unlockThreshold>(progress.rank>>>1)||!onToggleRegistration;
      register.addEventListener('click',()=>{progress=onToggleRegistration(selected.recordIndex)??progress;renderDetail();renderRegistration();});
      detail.append(register);
    }
  }

  function select(event) {
    selected = event;
    for (const cell of board.querySelectorAll("[data-record-index]")) {
      cell.setAttribute("aria-pressed", String(Number(cell.dataset.recordIndex) === event.recordIndex));
    }
    renderDetail();
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
          button.addEventListener("click", () => select(event));
          cell.append(button);
        }
      }
      days.append(cell);
    });

    row.append(days);
    board.append(row);
  });

  const footer = element("p", "cm-schedule-footer", `${TITLE_EVENT_SCAN_LIMIT} scheduled fixtures across four seasons.`);


  const back = element("button", "cm-schedule-back", "BACK");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });

  const championship=element('button','cm-schedule-back');championship.type='button';
  championship.addEventListener('click',()=>{progress=onToggleChampionship?.()??progress;renderRegistration();});
  // Appended in final order rather than inserted before BACK: every other node
  // in this file is placed with append, and insertBefore is the one DOM call
  // the mounted-view suites do not provide.
  shell.append(board, detail, footer, championship, back);
  root.append(shell);
  renderDetail();

  function renderRegistration(){
    for(const button of board.querySelectorAll('[data-record-index]')){
      const id=Number(button.dataset.recordIndex);
      button.dataset.registered=String(progress?.registered.includes(id)??false);
      button.dataset.won=String(progress?.won.includes(id)??false);
    }
    championship.hidden=!progress||progress.championship.stage<1;
    const key=calendar?.year%4===3?'worldEntry':'entry';
    championship.textContent=`${progress?.championship[key]?'取消登錄':'登錄'}${key==='worldEntry'?'世界冠軍賽':'冠軍賽'}`;
    championship.disabled=!onToggleChampionship||!Number.isInteger(calendar?.year);
  }
  renderRegistration();

  function renderCalendar(next = {}) {
    if(next.progress){progress=next.progress;renderDetail();renderRegistration();}
    if (!next.calendar) return;
    calendar=next.calendar;
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
