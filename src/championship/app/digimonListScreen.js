import { uiText } from "../text/uiText.js";
import { formatList } from "../text/locale.js";
import {generationName,personalityName,specialSkillName} from '../text/zhHant.js';
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
 */
export function createDigimonListView({ root, entries = [], onExit, onRename = null } = {}) {
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
  function closeEditor() { editor.hidden = true; editorMessage.textContent = ""; }
  function refreshControls() {
    const entry = entries[selectedIndex];
    const renameable = Boolean(onRename && entry && entry.renameable !== false);
    nameEdit.disabled = !renameable;
    nameEdit.dataset.state = onRename ? "READY" : "NOT_IMPLEMENTED";
    nameEdit.title = !onRename ? uiText("In the original, not yet in this build")
      : entry?.renameable === false ? uiText("初始夥伴的名字在開場時決定，無法更改。") : "";
  }
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

  shell.append(list, detail, controls, controlsNote, editor, footer);
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
