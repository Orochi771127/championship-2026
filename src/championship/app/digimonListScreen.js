import { uiText } from "../text/uiText.js";
import { formatList } from "../text/locale.js";
import {generationName,personalityName,specialSkillName,speciesName} from '../text/zhHant.js';
import {speciesTaxonomy,TAXONOMY_RESISTANCE_AXES} from '../contracts/speciesTaxonomy.js';
import {taxonomyText} from '../text/taxonomyText.js';
import {taxonomyBadgeRow} from '../presentation/taxonomyBadgeArt.js';
import {elementChartButton} from './elementChartModal.js';
import { databaseHeroPortrait } from "../presentation/databaseHeroPortraits.js";
// The Digimon roster -- the original's ui/digimon_list_* scenes.
//
// STRUCTURE COMES FROM THE ROM SCENES, NOT FROM TASTE
// ---------------------------------------------------
// Three shared NXR scenes describe this screen, and their node tables are the
// blueprint this file follows:
//
//   digimon_list_item (7)  digimon, name_text, new_mark, base,
//                          win_left / win_center / win_right
//   digimon_list_main (21) name_edit_button, delete_button, entry_button,
//                          num_cur0..2, num_limit0..2, slash, cur_unit,
//                          limit_unit, graph
//   digimon_list_sub  (19) name, nickname, HP, TP, ap, size, attack, def, wiz,
//                          spd, sp1, sp2, num_battle, win_rate, family, gen,
//                          mind, digitama, align_icon
//
// WHAT IS FILLED AND WHAT IS LEFT OUT
// -----------------------------------
// ARM9 02088480, its formatting strings and the 17-node binding table now
// close the individual HP/TP, size, combat stats, battle and rebirth counts.
// Remaining untranslated or untraced rows are ABSENT rather than shown as zero. A zero in a
// stat row reads as a real value; an absent row reads as missing, which is true.
//
// The three-digit current/limit counter and its unit labels are likewise not
// drawn: the capacity field is a candidate, not a confirmed reading, so there is
// no honest number to put in it yet.
//
// The name_edit / delete / entry buttons are drawn disabled for the same reason
// the unbuilt submenu entries are: the original has them, this build does not
// implement them, and deleting them would misrepresent the screen.

const GENERATION_EVIDENCE = "VERIFIED_BINARY";
const RESISTANCE_LABELS = Object.freeze({HEAT:'熱',COLD:'寒',THUNDER:'雷',LIGHT:'光',DARK:'闇'});

/** Rows of digimon_list_sub this build can source. Order follows the scene. */
const TRACED_DETAIL_ROWS = Object.freeze([
  { id: "nickname", label: "暱稱", read: (entry) => entry.displayName },
  // The cartridge's own name for the species, as it prints it on screen.
  { id: "species", label: "SPECIES", read: (entry) => entry.identity?.speciesName ?? null },
  { id: "HP", label: "HP", read: (entry) => vital(entry.stats?.currentHp,entry.stats?.maxHp) },
  { id: "TP", label: "TP", read: (entry) => vital(entry.stats?.currentTp,entry.stats?.maxTp) },
  { id: "size", label: "容量", read: (entry) => entry.stats?.capacityG == null ? null : `${entry.stats.capacityG} G` },
  { id: "attack", label: "攻擊", read: (entry) => entry.stats?.attack ?? null },
  { id: "def", label: "防禦", read: (entry) => entry.stats?.defense ?? null },
  { id: "wiz", label: "智力", read: (entry) => entry.stats?.wisdom ?? null },
  { id: "spd", label: "速度", read: (entry) => entry.stats?.speed ?? null },
  { id: "sp1", label: "特殊技能Ⅰ", read: (entry) => specialSkillName(entry.stats?.source12C) },
  { id: "sp2", label: "特殊技能Ⅱ", read: (entry) => specialSkillName(entry.stats?.source130) },
  { id: "num_battle", label: "戰鬥次數", read: (entry) => entry.stats?.battleCount ?? null },
  { id: "win_rate", label: "勝率", read: (entry) => entry.stats?.winPercent == null ? null : `${entry.stats.winPercent.toFixed(1)} %` },
  { id: "digitama", label: "退化次數", read: (entry) => entry.stats?.rebirthCount ?? null },
  { id: "gen", label: "GEN.", read: (entry) => generationName(entry.identity?.generationIndex) },
  { id: "mind", label: "性格", read: (entry) => entry.identity?.generationIndex===0?'？？？':personalityName(entry.stats?.personalityIndex) },
  // Owner 2026-10-29: the raw attribute index and family give way to the three-axis taxonomy
  // (faction renames the attribute, race renames the family), drawn as emblems by appendCreatureDetail.
]);

/** Rows the original shows that this build has no traced source for. */
export const UNTRACED_DETAIL_ROWS = Object.freeze([
  "ap"
]);

function vital(current,maximum) {
  return current == null || maximum == null ? null : `${current}/${maximum}`;
}

/** Controls the original carries that this build has not implemented. */
export const UNIMPLEMENTED_CONTROLS = Object.freeze(["delete_button", "entry_button"]);
/** Name edit now uses the product given-name rule the Database already uses. */
export const ROSTER_CONTROLS = Object.freeze(["name_edit_button", ...UNIMPLEMENTED_CONTROLS]);
const ROSTER_NAME_MAX_LENGTH = 24;

function element(tag, className, text, localize = true) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = localize ? uiText(text) : text;
  return node;
}

/**
 * The traced detail rows and the resistance graph for one roster entry.
 * Shared by this screen and the Raising Home detail sheet (2026-09-29), so
 * both read one source and show the same rows in the same order.
 */
// Owner 2026-10-27: the roster reads as a bento of groups. Each label/value
// pair sits in one wrapper (display: contents everywhere except the arcade
// roster), so the shared detail sheet keeps its two-column list unchanged.
const ROW_GROUPS = Object.freeze({
  nickname: "identity", species: "identity", gen: "identity", mind: "identity", family: "identity", align_icon: "identity",
  HP: "vital", TP: "vital", size: "vital",
  attack: "combat", def: "combat", wiz: "combat", spd: "combat",
  sp1: "skill", sp2: "skill",
  num_battle: "record", win_rate: "record", digitama: "record"
});

export function appendCreatureDetail(detail, entry) {
  for (const row of TRACED_DETAIL_ROWS) {
    const value = row.read(entry);
    if (value === null || value === undefined) continue;
    const term = element("dt", "cm-digimon-detail__label", row.label);
    term.setAttribute("data-row", row.id);
    const cell = element("dd", "cm-digimon-detail__value", String(value), row.id !== "nickname");
    const group = element("div", "cm-digimon-stat");
    group.dataset.row = row.id;
    group.dataset.group = ROW_GROUPS[row.id] ?? "identity";
    // Vital bars read their fill from the same numbers the text shows.
    const pair = row.id === "HP" ? [entry.stats?.currentHp, entry.stats?.maxHp] : row.id === "TP" ? [entry.stats?.currentTp, entry.stats?.maxTp] : null;
    if (pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1]) && pair[1] > 0) group.style.setProperty("--fill", String(Math.max(0, Math.min(1, pair[0] / pair[1]))));
    group.append(term, cell);
    detail.append(group);
  }
  const taxonomy = speciesTaxonomy(entry.identity?.recordIndex);
  if (taxonomy) {
    const group = element("div", "cm-digimon-stat cm-digimon-stat--taxonomy");
    group.dataset.row = "taxonomy";
    group.dataset.group = "identity";
    const term = element("dt", "cm-digimon-detail__label", taxonomyText('label.element'), false);
    term.setAttribute("data-row", "taxonomy");
    const cell = element("dd", "cm-digimon-detail__value cm-taxonomy-detail");
    cell.append(taxonomyBadgeRow(taxonomy), elementChartButton(taxonomy.element));
    group.append(term, cell);
    detail.append(group);
  }
  // OWNER_APPROVED_ADAPTATION 2026-11-02: a 成熟期 partner's burst forms, unlocked or with their progress.
  if (Array.isArray(entry.burst) && entry.burst.length) {
    const group = element("div", "cm-digimon-stat cm-digimon-burst");
    group.dataset.row = "burst";
    group.dataset.group = "record";
    group.append(element("dt", "cm-digimon-detail__label", "DEX_BURST"));
    const cell = element("dd", "cm-digimon-detail__value");
    for (const form of entry.burst) {
      const line = element("p", "cm-digimon-burst__form");
      line.dataset.tier = String(form.tier);
      line.dataset.unlocked = String(form.unlocked);
      line.append(element("strong", "", `DEX_BURST_TIER_${form.tier}`), " ", element("span", "", speciesName(form.form), false), " ");
      if (form.unlocked) line.append(element("span", "cm-digimon-burst__state", "已解鎖"));
      else line.append(element("span", "cm-digimon-burst__state", form.rows.map(row => `${uiText(`DEX_CONDITION_${row.id}`)} ${row.current}/${row.value}`).join("・"), false));
      cell.append(line);
    }
    group.append(cell);
    detail.append(group);
  }
  const graphValues = entry.stats?.resistanceGraph;
  if (Array.isArray(graphValues) && graphValues.length === 5) {
    const graph = element('div', 'cm-digimon-resistance');
    graph.setAttribute('role', 'img');
    graph.setAttribute('aria-label', formatList(graphValues.map(part => `${uiText(RESISTANCE_LABELS[part.id] ?? part.id)} ${part.pixels}`)));
    graph.append(element('span', 'cm-digimon-resistance__title', '抗性'));
    const bar = element('span', 'cm-digimon-resistance__bar');
    for (const part of graphValues) {
      const segment = element('span', `cm-digimon-resistance__segment cm-digimon-resistance__segment--${part.id.toLowerCase()}`);
      segment.style.flexGrow = String(part.pixels);
      segment.title = `${uiText(RESISTANCE_LABELS[part.id] ?? part.id)} ${part.pixels}/78`;
      bar.append(segment);
    }
    graph.append(bar);
    // Each bar keeps its original meaning and also covers one new element (Owner 2026-10-29).
    const axes = element('span', 'cm-digimon-resistance__axes');
    for (const [axis, pair] of Object.entries(TAXONOMY_RESISTANCE_AXES)) {
      const item = element('span', '', `${taxonomyText(`axis.${axis}`)}＝${pair.map(el => taxonomyText(`element.${el}`)).join('／')}`, false);
      item.dataset.axis = axis;
      axes.append(item);
    }
    graph.append(axes);
    detail.append(graph);
  }
}

/**
 * Mount the roster.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {Array<object>} options.entries roster entries with displayName, stats, identity
 * @param {() => void} options.onExit
 * @param {(instanceId: string, name: string) => ({ok: boolean, entries?: Array<object>})} [options.onRename]
 * @param {(instanceId: string) => ({ok: boolean, reason?: string, entries?: Array<object>})} [options.onRebirth]
 */
export function createDigimonListView({ root, entries = [], onExit, onRename = null, onRebirth = null } = {}) {
  if (!root) throw new TypeError("The Digimon list requires a root element");

  root.replaceChildren();
  root.className = "cm-digimon-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.originalScenes = "ui/digimon_list_main.nxr,ui/digimon_list_sub.nxr,ui/digimon_list_item.nxr";

  const shell = element("section", "cm-digimon-shell");
  shell.append(element("p", "cm-digimon-kicker", "管理"), element("h1", "cm-digimon-title", "ROSTER"));

  const list = element("ul", "cm-digimon-list");
  const detail = element("dl", "cm-digimon-detail");

  let selectedIndex = entries.length > 0 ? 0 : -1;

  function renderDetail() {
    detail.replaceChildren();
    const entry = entries[selectedIndex];
    if (!entry) {
      detail.append(element("p", "cm-digimon-empty", "No partner in the roster."));
      return;
    }
    appendCreatureDetail(detail, entry);
    // Say what is missing rather than leaving the panel silently short.
    const note = element("p", "cm-digimon-untraced",
      `${UNTRACED_DETAIL_ROWS.length} further rows the original shows are not traced yet.`);
    note.dataset.untraced = UNTRACED_DETAIL_ROWS.join(",");
    note.hidden = new URLSearchParams(globalThis.location?.search??'').get('presentation') !== 'developer';
    detail.append(note);
  }

  function renderList() {
    list.replaceChildren();
    entries.forEach((entry, index) => {
      const item = element("li", "cm-digimon-item");
      const button = element("button", "cm-digimon-item__button");
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("aria-pressed", String(index === selectedIndex));
      // A thumbnail of the partner (the encyclopedia's own art) leads the name.
      const art = databaseHeroPortrait(entry.identity?.recordIndex)?.thumbnail;
      const thumb = element(art ? "img" : "span", "cm-digimon-item__thumb");
      thumb.setAttribute("aria-hidden", "true");
      if (art) { thumb.alt = ""; thumb.decoding = "async"; thumb.src = art.src; }
      const nameNode = element("span", "cm-digimon-item__name", entry.displayName, false);
      if (entry.bloodline) {
        // Cyber Gachapon metal bloodline badge before the name.
        const badge = element("span", "cm-gacha-badge", `[${entry.bloodline.title}]`, false);
        badge.style.setProperty("--bloodline", entry.bloodline.color);
        nameNode.prepend(badge, " ");
        button.dataset.bloodline = entry.bloodline.family;
      }
      button.append(thumb, nameNode);
      button.addEventListener("click", () => {
        selectedIndex = index;
        closeEditor();
        renderList();
        renderDetail();
        refreshControls();
      });
      item.append(button);
      list.append(item);
    });
    if (entries.length === 0) list.append(element("li", "cm-digimon-empty", "Empty roster."));
  }

  const controls = element("div", "cm-digimon-controls");
  let nameEdit = null;
  for (const id of ROSTER_CONTROLS) {
    const button = element("button", "cm-digimon-control", id.replace("_button", "").replace("_", " ").toUpperCase());
    button.type = "button";
    button.dataset.control = id;
    if (id === "name_edit_button") { nameEdit = button; continue; }
    button.disabled = true;
    button.dataset.state = "NOT_IMPLEMENTED";
    button.title = uiText("In the original, not yet in this build");
    controls.append(button);
  }
  controls.prepend(nameEdit);
  // OWNER_APPROVED_ADAPTATION 2026-11-02: 成熟期 no longer ages out, so rebirth is the player's choice.
  const rebirth = element("button", "cm-digimon-control", "轉生");
  rebirth.type = "button";
  rebirth.dataset.control = "rebirth_button";
  controls.append(rebirth);
  // Say why two of the three stay grey instead of leaving a silent row.
  const controlsNote = element("p", "cm-digimon-controls-note", "移除與報名尚未開放。");

  // Name edit opens in place under the controls and writes through the
  // existing rename; the starter's name comes from the opening and is fixed.
  const editor = element("form", "cm-digimon-rename");
  editor.hidden = true;
  const editorLabel = element("label", "cm-digimon-rename__label", "新的暱稱");
  const editorInput = element("input", "cm-digimon-rename__input");
  editorInput.type = "text";
  editorInput.maxLength = ROSTER_NAME_MAX_LENGTH;
  editorInput.autocomplete = "off";
  editorInput.spellcheck = false;
  editorInput.setAttribute("aria-label", uiText("新的暱稱"));
  editorLabel.append(editorInput);
  const editorMessage = element("p", "cm-digimon-rename__message");
  editorMessage.setAttribute("role", "status");
  const editorActions = element("div", "cm-digimon-rename__actions");
  const editorCancel = element("button", "cm-screen-back", "取消");
  editorCancel.type = "button";
  const editorSave = element("button", "cm-screen-primary", "儲存名稱");
  editorSave.type = "submit";
  editorActions.append(editorCancel, editorSave);
  editor.append(editorLabel, editorMessage, editorActions);
  // Rebirth asks once in place, like Name Edit, and reports the result under the controls.
  const rebirthPanel = element("div", "cm-digimon-rename cm-digimon-rebirth");
  rebirthPanel.hidden = true;
  const rebirthQuestion = element("p", "cm-digimon-rename__label", "", false);
  const rebirthActions = element("div", "cm-digimon-rename__actions");
  const rebirthCancel = element("button", "cm-screen-back", "取消");
  rebirthCancel.type = "button";
  const rebirthConfirm = element("button", "cm-screen-primary", "轉生");
  rebirthConfirm.type = "button";
  rebirthActions.append(rebirthCancel, rebirthConfirm);
  const rebirthMessage = element("p", "cm-digimon-rename__message");
  rebirthMessage.setAttribute("role", "status");
  rebirthPanel.append(rebirthQuestion, rebirthActions);
  const REBIRTH_REFUSALS = Object.freeze({
    PARTNER_NOT_IN_RANCH: "這隻拍檔不在牧場裡，請先讓牠住進籠舍再轉生。",
    EVOLUTION_RUNNING: "牧場裡正在進化，請稍後再試。",
    NOT_FINAL_STAGE: "只有成熟期的拍檔可以轉生。"
  });
  function closeRebirth() { rebirthPanel.hidden = true; }
  function closeEditor() { editor.hidden = true; editorMessage.textContent = ""; closeRebirth(); }
  function refreshControls() {
    const entry = entries[selectedIndex];
    const renameable = Boolean(onRename && entry && entry.renameable !== false);
    nameEdit.disabled = !renameable;
    nameEdit.dataset.state = onRename ? "READY" : "NOT_IMPLEMENTED";
    nameEdit.title = !onRename ? uiText("In the original, not yet in this build")
      : entry?.renameable === false ? uiText("初始夥伴的名字在開場時決定，無法更改。") : "";
    const mature = entry?.identity?.generationIndex === 4;
    rebirth.disabled = !(onRebirth && mature);
    rebirth.dataset.state = onRebirth ? "READY" : "NOT_IMPLEMENTED";
    rebirth.title = onRebirth && !mature ? uiText("只有成熟期的拍檔可以轉生。") : "";
  }
  rebirth.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry || rebirth.disabled) return;
    editor.hidden = true;
    rebirthMessage.textContent = "";
    rebirthQuestion.textContent = uiText("讓 {name} 轉生回蛋嗎？轉生次數 +1，下一代的能力會得到加成。", { name: entry.displayName ?? "" });
    rebirthPanel.hidden = false;
    rebirthPanel.scrollIntoView?.({ block: "center" });
  });
  rebirthCancel.addEventListener("click", () => closeRebirth());
  rebirthConfirm.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry) return;
    const result = onRebirth?.(entry.instanceId);
    closeRebirth();
    if (!result?.ok) { rebirthMessage.textContent = uiText(REBIRTH_REFUSALS[result?.reason] ?? "現在無法轉生。"); return; }
    rebirthMessage.textContent = uiText("{name} 開始轉生，回到牧場就能看到。", { name: entry.displayName ?? "" });
    if (Array.isArray(result.entries)) entries = result.entries;
    renderList();
    renderDetail();
    refreshControls();
  });
  nameEdit.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry || nameEdit.disabled) return;
    editorInput.value = entry.displayName ?? "";
    editorMessage.textContent = "";
    editor.hidden = false;
    // The editor opens under the controls; bring it above the footer.
    editor.scrollIntoView?.({ block: "center" });
    editorInput.focus?.({ preventScroll: true });
  });
  editorCancel.addEventListener("click", () => closeEditor());
  editor.addEventListener("submit", (event) => {
    event?.preventDefault?.();
    const entry = entries[selectedIndex];
    const name = String(editorInput.value ?? "").trim();
    if (!entry || !name || name.length > ROSTER_NAME_MAX_LENGTH) {
      editorMessage.textContent = uiText("名稱需為 1 至 {max} 個字。", { max: ROSTER_NAME_MAX_LENGTH });
      return;
    }
    const result = onRename?.(entry.instanceId, name);
    if (!result?.ok) {
      editorMessage.textContent = result?.reason === "NOT_RENAMEABLE" ? uiText("這隻拍檔的名字無法更改。") : uiText("名稱需為 1 至 {max} 個字。", { max: ROSTER_NAME_MAX_LENGTH });
      return;
    }
    if (Array.isArray(result.entries)) entries = result.entries;
    closeEditor();
    renderList();
    renderDetail();
    refreshControls();
    editorMessage.textContent = "";
  });

  const footer = element("footer", "cm-screen-footer");
  const back = element("button", "cm-screen-back cm-digimon-back", "返回牧場");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });
  footer.append(back);

  shell.append(list, detail, controls, controlsNote, editor, rebirthPanel, rebirthMessage, footer);
  root.append(shell);
  renderList();
  renderDetail();
  refreshControls();

  return Object.freeze({
    render() {},
    inspect() {
      return Object.freeze({
        entryCount: entries.length,
        tracedRows: TRACED_DETAIL_ROWS.map((row) => row.id),
        untracedRows: UNTRACED_DETAIL_ROWS,
        generationEvidence: GENERATION_EVIDENCE
      });
    },
    dispose() {
      root.replaceChildren();
      root.className = "";
    }
  });
}
