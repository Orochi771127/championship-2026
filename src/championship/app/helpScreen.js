import { helpText } from "../text/zhHant.js";
import { uiText } from "../text/uiText.js";
// The in-game help -- the original's help_main_scene.
//
// THIS IS THE CARTRIDGE'S OWN TEXT
// --------------------------------
// Source records come from nitrofs/ui/txt/help_text_txt.dat; visible copy is
// PRODUCT_AUTHORED Traditional Chinese keyed by the original entry index. The
// bank holds 168 entries in two parallel blocks of 84: entry i is a title and
// entry i + 84 is its body. Sixteen bodies are the literal string "n/a" -- those
// titles are section headings the game lists with nothing to read. The other 68
// are topics.
//
// The heading/topic split is the FILE's, not a reading of the Japanese: a body of
// "n/a" is what marks a heading.
//
// WHY THIS IS A FLAT LIST AND NOT A TREE
// --------------------------------------
// The bank stores the 16 headings and the 68 topics as separate runs and carries
// no parent link. No grouping table turned up in ARM9, in OVL5 (which holds the
// help resource descriptor) or in OVL16 (which holds the loader pointer). The
// nesting is guessable by reading the Japanese -- ROPE and SHOT plainly belong
// under HUNT EQUIPMENT -- but guessing it would put invented structure on screen.
//
// So this renders the ROM's own order, marks each entry for what the file says it
// is, and says the grouping is untraced. When the table is found, the tree can be
// switched on without any of the text changing.
//
// The original is a two-screen DS layout (help_main_scene plus help_sub_scene);
// this is the single-screen remake, so the main scene's content is what it draws.
//
// NOTHING IS ADDED. There is no search box and no bookmarking: the original has
// neither.

import helpCatalog from "../../data/championship/catalogs/help-text.r1.json" with { type: "json" };

export const HELP_ENTRY_COUNT = helpCatalog.recordCount;
export const HELP_HEADING_COUNT = helpCatalog.headingCount;
export const HELP_TOPIC_COUNT = helpCatalog.topicCount;
export const HELP_GROUPING_EVIDENCE = helpCatalog.groupingEvidence;
export const HELP_SOURCE_FILE = helpCatalog.source.file;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

/**
 * Mount the help screen.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {number} [options.entryIndex] entry to open on, defaults to the first topic
 * @param {() => void} [options.onExit]
 */
export function createHelpView({ root, entryIndex = null, onExit } = {}) {
  if (!root) throw new TypeError("The help screen requires a root element");

  root.replaceChildren();
  root.className = "cm-help-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.originalScenes = "help/help_main_scene.nxr,help/help_sub_scene.nxr";
  root.dataset.sourceFile = HELP_SOURCE_FILE;

  const records = helpCatalog.records;
  const topics = records.filter((record) => record.kind === "topic");
  const developer = new URLSearchParams(globalThis.location?.search ?? "").get("presentation") === "developer";

  let selected =
    records.find((record) => record.entryIndex === entryIndex && record.kind === "topic")
    ?? topics[0]
    ?? null;

  // The screen is Help; the first record's title ("Hunt") is a section
  // heading and was being shown as if it were the screen's name.
  const shell = element("section", "cm-help-shell");
  shell.append(element("p", "cm-help-kicker", "系統"), element("h1", "cm-help-title", "說明"),
    element("p", "cm-screen-lede", "點選主題閱讀說明。分類與主題依原作順序排列。"));

  const list = element("div", "cm-help-list");
  // A topic opens as a sheet over the list rather than at the end of a long
  // page, and closing it leaves the list where it was.
  const sheet = element("div", "cm-sheet");
  sheet.hidden = true;
  const scrim = element("div", "cm-sheet__scrim");
  scrim.addEventListener("click", () => closeDetail());
  const detail = element("article", "cm-help-detail cm-sheet__panel");
  detail.setAttribute("role", "dialog");
  detail.setAttribute("aria-label", "說明內容");
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
      detail.append(element("p", "cm-help-empty", "No topic selected."));
      return;
    }
    detail.append(element("h2", "cm-help-detail__title", helpText(selected.entryIndex, "title", selected.title)));
    const body = element("p", "cm-help-detail__body");
    body.textContent = helpText(selected.entryIndex, "body", selected.body);
    detail.append(body);
    // String indices are for comparing with the cartridge, not for players.
    if (developer) {
      detail.append(element("p", "cm-help-detail__provenance",
        `Entry ${selected.entryIndex} — title string ${selected.titleStringIndex}, body string ${selected.bodyStringIndex}.`));
    }
    const actions = element("div", "cm-sheet__actions");
    const close = element("button", "cm-screen-back cm-sheet__close", "關閉");
    close.type = "button";
    close.addEventListener("click", () => closeDetail());
    actions.append(close);
    detail.append(actions);
  }

  function select(record, button = null) {
    selected = record;
    for (const node of list.querySelectorAll("[data-entry-index]")) {
      node.setAttribute("aria-pressed", String(Number(node.dataset.entryIndex) === record.entryIndex));
    }
    renderDetail();
    opener = button;
    sheet.hidden = false;
    detail.querySelector?.(".cm-sheet__close")?.focus?.({ preventScroll: true });
  }

  for (const record of records) {
    if (record.kind === "heading") {
      const heading = element("p", "cm-help-heading", helpText(record.entryIndex, "title", record.title));
      heading.dataset.entryIndex = String(record.entryIndex);
      // A heading has no body in the cartridge, so it is a label, not a control.
      heading.dataset.kind = "heading";
      list.append(heading);
      continue;
    }
    const button = element("button", "cm-help-topic", helpText(record.entryIndex, "title", record.title));
    button.type = "button";
    button.dataset.entryIndex = String(record.entryIndex);
    button.dataset.kind = "topic";
    button.setAttribute("aria-pressed", String(record.entryIndex === selected?.entryIndex));
    button.addEventListener("click", () => select(record, button));
    list.append(button);
  }

  // The grouping caveat is an evidence note, not player copy.
  const note = element("p", "cm-help-note",
    `依原作順序列出 ${HELP_TOPIC_COUNT} 個說明主題與 ${HELP_HEADING_COUNT} 個分類標題。分類與主題的從屬關係尚待確認。`);
  note.hidden = !developer;

  const footer = element("footer", "cm-screen-footer");
  const back = element("button", "cm-screen-back", "返回牧場");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });
  footer.append(back);

  shell.append(list, note, footer);
  root.append(shell, sheet);
  renderDetail();

  return Object.freeze({
    render() {},
    inspect() {
      return Object.freeze({
        entryCount: HELP_ENTRY_COUNT,
        headingCount: HELP_HEADING_COUNT,
        topicCount: HELP_TOPIC_COUNT,
        selectedEntryIndex: selected?.entryIndex ?? null,
        groupingEvidence: HELP_GROUPING_EVIDENCE
      });
    },
    dispose() {
      root.replaceChildren();
      root.className = "";
    }
  });
}
