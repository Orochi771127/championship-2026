import { uiText } from "../text/uiText.js";
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
// Only fields with a traced source are rendered: name, HP, TP, generation,
// attribute and family. The rest of digimon_list_sub -- ap, size, attack, def,
// wiz, spd, sp1, sp2, num_battle, win_rate, mind, digitama, nickname -- has no
// traced source, so those rows are ABSENT rather than shown as zero. A zero in a
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

/** Rows of digimon_list_sub this build can source. Order follows the scene. */
const TRACED_DETAIL_ROWS = Object.freeze([
  { id: "name", label: "NAME", read: (entry) => entry.displayName },
  // The cartridge's own name for the species, as it prints it on screen.
  { id: "species", label: "SPECIES", read: (entry) => entry.identity?.speciesName ?? null },
  { id: "HP", label: "HP", read: (entry) => entry.stats?.maxHp ?? null },
  { id: "TP", label: "TP", read: (entry) => entry.stats?.maxTp ?? null },
  { id: "gen", label: "GEN.", read: (entry) => entry.identity?.generationIndex ?? null },
  // A raw index, not a name: the species record stores 0..4 and no name table for
  // it has been traced, so the label says index rather than implying a named
  // attribute. Index 0 is a real value -- 38 species carry it -- not an absence.
  { id: "align_icon", label: "ATTR. INDEX", read: (entry) => entry.identity?.attributeIndex ?? null },
  // familyBits 0 means no family bit is set, which is a real answer and a
  // different thing from untraced. It is drawn as an explicit none so that an
  // ABSENT row keeps its single meaning: this build has no source.
  {
    id: "family",
    label: "FAMILY",
    read: (entry) =>
      entry.identity?.familyBits === 0 ? "none set" : (entry.identity?.familyOrdinal ?? null)
  }
]);

/** Rows the original shows that this build has no traced source for. */
export const UNTRACED_DETAIL_ROWS = Object.freeze([
  "ap", "size", "attack", "def", "wiz", "spd",
  "sp1", "sp2", "num_battle", "win_rate", "mind", "digitama", "nickname"
]);

/** Controls the original carries that this build has not implemented. */
export const UNIMPLEMENTED_CONTROLS = Object.freeze(["name_edit_button", "delete_button", "entry_button"]);

function element(tag, className, text, localize = true) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = localize ? uiText(text) : text;
  return node;
}

/**
 * Mount the roster.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {Array<object>} options.entries roster entries with displayName, stats, identity
 * @param {() => void} options.onExit
 */
export function createDigimonListView({ root, entries = [], onExit } = {}) {
  if (!root) throw new TypeError("The Digimon list requires a root element");

  root.replaceChildren();
  root.className = "cm-digimon-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.originalScenes = "ui/digimon_list_main.nxr,ui/digimon_list_sub.nxr,ui/digimon_list_item.nxr";

  const shell = element("section", "cm-digimon-shell");
  shell.append(element("p", "cm-digimon-kicker", "DIGIMON"), element("h1", "cm-digimon-title", "ROSTER"));

  const list = element("ul", "cm-digimon-list");
  const detail = element("dl", "cm-digimon-detail");

  let selectedIndex = entries.length > 0 ? 0 : -1;

  function renderDetail() {
    detail.replaceChildren();
    const entry = entries[selectedIndex];
    if (!entry) {
      detail.append(element("p", "cm-digimon-empty", "No Digimon in the roster."));
      return;
    }
    for (const row of TRACED_DETAIL_ROWS) {
      const value = row.read(entry);
      if (value === null || value === undefined) continue;
      detail.append(
        element("dt", "cm-digimon-detail__label", row.label),
        element("dd", "cm-digimon-detail__value", String(value), row.id !== "name")
      );
    }
    // Say what is missing rather than leaving the panel silently short.
    const note = element("p", "cm-digimon-untraced",
      `${UNTRACED_DETAIL_ROWS.length} further rows the original shows are not traced yet.`);
    note.dataset.untraced = UNTRACED_DETAIL_ROWS.join(",");
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
      button.append(element("span", "cm-digimon-item__name", entry.displayName, false));
      button.addEventListener("click", () => {
        selectedIndex = index;
        renderList();
        renderDetail();
      });
      item.append(button);
      list.append(item);
    });
    if (entries.length === 0) list.append(element("li", "cm-digimon-empty", "Empty roster."));
  }

  const controls = element("div", "cm-digimon-controls");
  for (const id of UNIMPLEMENTED_CONTROLS) {
    const button = element("button", "cm-digimon-control", id.replace("_button", "").replace("_", " ").toUpperCase());
    button.type = "button";
    button.disabled = true;
    button.dataset.state = "NOT_IMPLEMENTED";
    button.title = uiText("In the original, not yet in this build");
    controls.append(button);
  }

  const back = element("button", "cm-digimon-back", "BACK");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });

  shell.append(list, detail, controls, back);
  root.append(shell);
  renderList();
  renderDetail();

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
