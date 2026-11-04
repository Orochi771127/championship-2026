import { uiText, TAMER_FIELD_LABELS } from "../text/uiText.js";
import {generationName,tamerRankName,gateName,shopItemName} from '../text/zhHant.js';
import {PRODUCT_RAISING_LIFECYCLE_RULES} from '../contracts/productSpeciesData.js';
import {PRODUCT_FINAL_NATURAL_GENERATION} from '../contracts/productGrowthRules.js';
import {RANK_UNLOCKS,TAMER_RANK_COUNT} from './rankUnlocks.js';
import {NATIVE_RAISING_LIFECYCLE_RULES} from '../raising/nativeRaisingLifecycle.js';
import {slotCountForTamerRank} from '../cage/cageCatalog.js';
import {nativeBattleWinPercent} from '../battle/nativeTitleProgression.js';
import {onboardingText} from '../text/onboardingText.js';
// Tamer Info -- the original's tamer_info_main_scene and tamer_info_sub_scene.
//
// THE FIELD LIST AND THE DIGIT WIDTHS ARE ROM_VERIFIED
// ----------------------------------------------------
// Both scenes' node tables name every field and, because each digit is its own
// sprite-cell node, they also fix how many digits each one has. Reading the node
// names and their x positions off the scene gives the whole screen:
//
//   tamer_info_main_scene.nxr (OVL4)
//     y=22    title0  title1  title2               3 digits
//     y=44    guid0   guid1   guid2                3 digits
//     y=66    map0    map1    map2                 3 digits
//     y=109   battle0 battle1 battle2 battle3      4 digits
//     y=131   win0    win1    win2                 3 digits
//
//   tamer_info_sub_scene.nxr (OVL4) -- 23 nodes, not 17
//     y=38    name                                 dynamic text label
//     y=51    rank                                 dynamic region
//     y=72    money0 .. money6                     7 digits
//     y=113   time0 time1 time2 : minuts0 minuts1  3 digits, then 2
//     y=119   license                              dynamic region
//     y=154   have0 have1 have2   +  cage0 cage1   3 digits, then 2 at x=206/215
//     y=161   G                                    unit glyph, cell 6
//
// A CORRECTION THAT MATTERS
// -------------------------
// An earlier read of this scene listed 17 sub-scene nodes and called that the
// field set. It was a truncated dump: the sub scene has 23, and name / rank /
// license / cage0 / cage1 / G were below the cut. The five real fields among them
// are not incidental -- rank, license and cage are exactly what help topics 61
// (tamer rank), 62 (raising licence) and 63 (cage space) describe, and G is the
// unit glyph for the capacity figure in topics 44 and 64.
//
// The 7-digit money field is corroborated twice over: the battle reward path caps
// the wallet at 9999999, and the gate draw call at OVL12 0x0210E588 passes a field
// width of 7 to the number renderer. Three independent witnesses, same width.
//
// WHAT HAS A SOURCE AND WHAT DOES NOT
// ------------------------------------
// OVL4 0210BB9C now closes the numeric/text bindings (2026-09-13):
//
//   money  the shop wallet, which is persisted and ROM-capped at 9999999
//   have   rank-table capacity (020E1E14), NOT the number of held residents
//   rank   the tamer rank -- PlayerData +0x0AE8, the same u16 the title-match scan
//          at ARM9 0x02089230 halves to gate a fixture, and the index into the
//          rank table at ARM9 0x020E1E18 that sets the ranch slot count
//
// title/guid/map are completion percentages (61/216/17 records), battle is
// player +4D8, win is rounded percentage of +4DA/+4D8, time is minutes +AEA.
// The original map flags and elapsed play minutes have no durable Web writer;
// their known read addresses do not justify inventing history in old saves.
//
// Player labels use the verified completion/count bindings; internal NXR node
// names remain in data-field-id for comparison with the source scene.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const TAMER_INFO_FIELD_EVIDENCE = "ROM_VERIFIED";
export const TAMER_INFO_SCENES = deepFreeze([
  "tamer_info/tamer_info_main_scene.nxr",
  "tamer_info/tamer_info_sub_scene.nxr"
]);

/**
 * The twelve fields, in the scenes' own order, with the digit widths the node
 * tables fix. `source` names where a value comes from, or null when none is traced.
 */
export const TAMER_INFO_FIELDS = deepFreeze([
  { id: "title", scene: "main", y: 22, digits: 3, source: "titleCompletionPercent" },
  { id: "guid", scene: "main", y: 44, digits: 3, source: "bookCompletionPercent" },
  { id: "map", scene: "main", y: 66, digits: 3, source: null },
  { id: "battle", scene: "main", y: 109, digits: 4, source: "nativeBattleRecord" },
  { id: "win", scene: "main", y: 131, digits: 3, source: "nativeBattleWinPercent" },
  // Not digit cells: a text label and two dynamic regions the cartridge fills.
  { id: "name", scene: "sub", y: 38, kind: "text", source: "trainerName" },
  { id: "rank", scene: "sub", y: 51, kind: "region", source: "tamerRank" },
  { id: "money", scene: "sub", y: 72, digits: 7, source: "shopWalletBits" },
  // The only field the cartridge splits with a separator node: three digits, the
  // separator at x=87, then two more. A clock, not a plain counter.
  { id: "time", scene: "sub", y: 113, digits: 3, minorDigits: 2, source: null },
  { id: "license", scene: "sub", y: 119, kind: "region", source: "nativeRankGeneration" },
  { id: "have", scene: "sub", y: 154, digits: 3, source: "nativeRankCapacity" },
  // Shares the y=154 row with `have`, sitting right at x=206/215.
  { id: "cage", scene: "sub", y: 154, digits: 2, source: "nativeRankSlots" }
]);

/** The `G` node at y=161 is the unit glyph beside the capacity figure, not a field. */
export const TAMER_INFO_UNIT_GLYPHS = deepFreeze(["G"]);

/** ROM_VERIFIED: the battle reward path clamps the wallet here. */
export const TAMER_INFO_MONEY_CAP = 9999999;

export const TAMER_INFO_UNSOURCED_FIELDS = deepFreeze(
  TAMER_INFO_FIELDS.filter((field) => field.source === null).map((field) => field.id)
);
export const TAMER_INFO_UNSOURCED_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";

const TAMER_FIELD_GROUPS = Object.freeze({ name: "card", rank: "card", license: "card", money: "card",
  title: "progress", guid: "progress", map: "progress", battle: "stats", win: "stats", time: "stats", have: "stats", cage: "stats" });

/** The furthest stage a partner grows to by itself at this rank (awakened forms come from the cage, not age). */
function naturalCeiling(rank) {
  return Math.min(PRODUCT_RAISING_LIFECYCLE_RULES.ranks[rank].generation, PRODUCT_FINAL_NATURAL_GENERATION);
}

/**
 * Owner 2026-11-04: every rank and what reaching it opens -- hunt grounds, shop cages and tools,
 * title matches, the growth ceiling and the first-time diamonds -- with the current and next rank
 * marked. Read from the gating tables themselves (rankUnlocks.js).
 */
function rankUnlockPanel(current) {
  const panel = element("details", "cm-rank-unlocks");
  panel.dataset.currentRank = String(current);
  const next = current + 1 < TAMER_RANK_COUNT ? RANK_UNLOCKS[current + 1] : null;
  const summary = element("summary", "cm-rank-unlocks__summary");
  summary.append(element("span", "cm-rank-unlocks__title", "階級解鎖一覽"));
  const preview = element("span", "cm-rank-unlocks__preview", next
    ? uiText("下一階 {rank}：{items}", { rank: tamerRankName(next.rank), items: unlockLines(next).slice(0, 2).join("・") })
    : uiText("已達最高階級"));
  summary.append(preview);
  panel.append(summary);
  const list = element("ol", "cm-rank-unlocks__list");
  for (const row of RANK_UNLOCKS) {
    const item = element("li", "cm-rank-unlocks__row");
    item.dataset.rank = String(row.rank);
    item.dataset.state = row.rank < current ? "reached" : row.rank === current ? "current" : row.rank === current + 1 ? "next" : "locked";
    const head = element("p", "cm-rank-unlocks__head");
    head.append(element("strong", "cm-rank-unlocks__name", tamerRankName(row.rank)));
    if (row.rank === current) head.append(element("span", "cm-rank-unlocks__tag", "目前"));
    else if (row.rank === current + 1) head.append(element("span", "cm-rank-unlocks__tag cm-rank-unlocks__tag--next", "下一階"));
    if (row.diamonds > 0) head.append(element("span", "cm-rank-unlocks__diamonds", uiText("首次升階 {n} 鑽", { n: row.diamonds.toLocaleString() })));
    const lines = element("ul", "cm-rank-unlocks__lines");
    for (const text of unlockLines(row)) { const line = document.createElement("li"); line.textContent = text; lines.append(line); }
    item.append(head, lines);
    list.append(item);
  }
  panel.append(list);
  return panel;
}

/** One rank's openings as short localized lines; rank 0 reads as what is open from the start. */
function unlockLines(row) {
  const lines = [];
  if (row.gates.length) lines.push(uiText("狩獵場：{names}", { names: row.gates.map(index => gateName(index)).join("、") }));
  if (row.shop.cages.length) lines.push(uiText("商店籠舍：{names}", { names: row.shop.cages.map(index => shopItemName(index)).join("、") }));
  if (row.shop.tools || row.shop.plugins) lines.push(uiText("狩獵道具 {tools} 項・外掛 {plugins} 項", { tools: row.shop.tools, plugins: row.shop.plugins }));
  if (row.titles) lines.push(uiText("頭銜賽 {n} 場", { n: row.titles }));
  const ceiling = naturalCeiling(row.rank), before = row.rank > 0 ? naturalCeiling(row.rank - 1) : -1;
  if (ceiling !== before) lines.push(uiText("自然進化可達 {stage}", { stage: generationName(ceiling) }));
  return lines;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

/** Right-align into the ROM's digit count, the way a fixed cell row reads. */
function padToWidth(value, digits) {
  return String(value).padStart(digits, "0");
}

// 0210BB9C uses rounded Q12 division, then drops the percentage fraction for
// completion rows. Battle win percentage uses the distinct rounded rule.
export function tamerCompletionPercent(count,total){
  if(!Number.isInteger(count)||count<0||count>total)return null;
  const q=Number(((BigInt(count)<<32n)/BigInt(total)+0x80000n)>>20n);
  return (q*100)>>12;
}

/**
 * Mount Tamer Info.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {number|null} [options.walletBits]  the shop wallet, or null if unavailable
 * @param {number|null} [options.titleCount] completed original title records
 * @param {number|null} [options.registeredCount] registered original book entries
 * @param {object|null} [options.battleRecord] existing persistent player battle totals
 * @param {number|null} [options.tamerRank]   PlayerData +0x0AE8
 * @param {() => void} [options.onExit]
 */
export function createTamerInfoView({ root, walletBits = null, tamerRank = null, trainerName=null,
  titleCount=null,registeredCount=null,battleRecord=null,tamerCard=null,renderOnline=null,onExit,landCells=null } = {}) {
  if (!root) throw new TypeError("Tamer Info requires a root element");

  root.replaceChildren();
  root.className = "cm-tamer-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.originalScenes = TAMER_INFO_SCENES.join(",");

  const rank=Number.isInteger(tamerRank)?NATIVE_RAISING_LIFECYCLE_RULES.ranks[tamerRank]:null;
  const values = {
    money: Number.isInteger(walletBits) ? Math.min(walletBits, TAMER_INFO_MONEY_CAP) : null,
    have:rank?.capacity??null,
    // Owner 2026-11-04: with the product economy the cell count is the land bought with diamonds, not the rank.
    cage:Number.isInteger(landCells)?landCells:rank?slotCountForTamerRank(tamerRank):null,
    // The licence names the furthest natural stage at this rank under the product's growth rules.
    license:rank?generationName(naturalCeiling(tamerRank)):null,
    rank:tamerRankName(tamerRank),
    title:tamerCompletionPercent(titleCount,61),
    guid:tamerCompletionPercent(registeredCount,216),
    battle:battleRecord?.battles??null,
    win:nativeBattleWinPercent(battleRecord),
    name:trainerName
  };

  const shell = element("section", "cm-tamer-shell");
  shell.append(element("p", "cm-tamer-kicker", "管理"), element("h1", "cm-tamer-title", "TAMER INFO"));
  // Owner 2026-10-28: the tamer card code (futureSystemsPort.js) beside the
  // licence; product-authored, outside the ROM field table below.
  if (tamerCard?.code) {
    const words = onboardingText(), card = element("p", "cm-tamer-code");
    card.dataset.tamerCode = tamerCard.code;
    const label = document.createElement("span"), value = document.createElement("strong");
    label.className = "cm-tamer-code__label"; label.textContent = words.tamerCode;
    value.className = "cm-tamer-code__value"; value.textContent = tamerCard.code;
    card.append(label, value);
    if (tamerCard.mode === "GUEST") { const guest = document.createElement("span"); guest.className = "cm-tamer-code__guest"; guest.textContent = words.guestPass; card.append(guest); }
    shell.append(card);
  }
  // Owner 2026-10-28: friends and the account panel open from the licence; the ROM field table below stays as it is.
  // Owner 2026-10-29: the brag card joins them on top; the passport and community dock follow the table ("bottom").
  if (typeof renderOnline === "function") renderOnline(shell, "top");

  const table = element("dl", "cm-tamer-fields");
  let sourced = 0;

  for (const field of TAMER_INFO_FIELDS) {
    const label = element("dt", "cm-tamer-field__label", TAMER_FIELD_LABELS[field.id] ?? "未確認欄位");
    label.dataset.scene = field.scene;

    const cell = element("dd", "cm-tamer-field__value");
    cell.dataset.fieldId = field.id;
    if (field.digits) cell.dataset.digits = String(field.digits);
    cell.dataset.kind = field.kind ?? "digits";

    const value = values[field.id];
    if ((field.source||field.id==='name') && value !== null && value !== undefined) {
      sourced += 1;
      cell.dataset.state = "SOURCED";
      cell.dataset.source = field.source??'trainerName';
      const suffix=['title','guid','win'].includes(field.id)?' %':field.id==='have'?' G':'';
      cell.textContent = field.id==='name'?String(value):uiText((field.digits ? padToWidth(value, field.digits) : String(value))+suffix);
    } else {
      // Drawn at the ROM's width so the screen keeps its shape, but never as a
      // number -- an unsourced counter must not read as a real total. The name,
      // rank and licence nodes are not digit cells, so they get a plain marker
      // rather than a width that would imply a digit count they do not have.
      cell.dataset.state = "UNSOURCED";
      cell.textContent = uiText(field.digits
        ? "-".repeat(field.digits) + (field.minorDigits ? ":" + "-".repeat(field.minorDigits) : "")
        : "—");
      cell.title = uiText("The original draws this field; this build has no traced source for it");
    }
    // Owner 2026-10-27: a licence card, three progress tiles and a stats
    // matrix. One wrapper per field (display: contents outside the arcade skin).
    const group = element("div", "cm-tamer-field");
    group.dataset.fieldId = field.id;
    group.dataset.group = TAMER_FIELD_GROUPS[field.id] ?? "stats";
    if (["title", "guid"].includes(field.id) && Number.isFinite(Number(value))) group.style.setProperty("--fill", String(Math.max(0, Math.min(1, Number(value) / 100))));
    group.append(label, cell);
    table.append(group);
  }

  const note = element("p", "cm-tamer-note",
    uiText("共 {total} 個欄位，其中 {unsourced} 個欄位的資料來源尚待確認，以橫線表示，並非零。", { total: TAMER_INFO_FIELDS.length, unsourced: TAMER_INFO_FIELDS.length - sourced }));
  note.hidden = new URLSearchParams(globalThis.location?.search??'').get('presentation') !== 'developer';

  // Every screen leaves from the same sticky footer, named for where it goes.
  const footer = element("footer", "cm-screen-footer");
  const back = element("button", "cm-screen-back cm-tamer-back", "返回牧場");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });
  footer.append(back);

  shell.append(table, rankUnlockPanel(Number.isInteger(tamerRank) ? tamerRank : 0), note);
  if (typeof renderOnline === "function") renderOnline(shell, "bottom");
  shell.append(footer);
  root.append(shell);

  return Object.freeze({
    render() {},
    inspect() {
      return Object.freeze({
        fieldCount: TAMER_INFO_FIELDS.length,
        sourcedCount: sourced,
        unsourcedFields: TAMER_INFO_FIELDS.filter(field=>!(field.source||field.id==='name')||values[field.id]===null||values[field.id]===undefined).map(field=>field.id),
        fieldEvidence: TAMER_INFO_FIELD_EVIDENCE,
        moneyCap: TAMER_INFO_MONEY_CAP
      });
    },
    dispose() {
      root.replaceChildren();
      root.className = "";
    }
  });
}
