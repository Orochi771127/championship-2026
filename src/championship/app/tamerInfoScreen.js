import { uiText, TAMER_FIELD_LABELS } from "../text/uiText.js";
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
// Three of the twelve fields have a traced value source in this build:
//
//   money  the shop wallet, which is persisted and ROM-capped at 9999999
//   have   the roster length
//   rank   the tamer rank -- PlayerData +0x0AE8, the same u16 the title-match scan
//          at ARM9 0x02089230 halves to gate a fixture, and the index into the
//          rank table at ARM9 0x020E1E18 that sets the ranch slot count
//
// title, guid, map, battle, win and time are lifetime counters the cartridge keeps
// in its save. This build has no traced read site for any of them, so they are
// drawn as unsourced at their correct width rather than as zeros. A zero in a
// counter reads as "you have won nothing"; a row of dashes reads as "this build
// does not know", which is the true statement.
//
// The labels are the ROM's own node names. No English gloss is invented for the
// ambiguous ones -- `guid` and `map` are what the scene calls them, and guessing
// at "Guide entries" or "Maps discovered" would put my reading on screen.

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
  { id: "title", scene: "main", y: 22, digits: 3, source: null },
  { id: "guid", scene: "main", y: 44, digits: 3, source: null },
  { id: "map", scene: "main", y: 66, digits: 3, source: null },
  { id: "battle", scene: "main", y: 109, digits: 4, source: null },
  { id: "win", scene: "main", y: 131, digits: 3, source: null },
  // Not digit cells: a text label and two dynamic regions the cartridge fills.
  { id: "name", scene: "sub", y: 38, kind: "text", source: null },
  { id: "rank", scene: "sub", y: 51, kind: "region", source: "tamerRank" },
  { id: "money", scene: "sub", y: 72, digits: 7, source: "shopWalletBits" },
  // The only field the cartridge splits with a separator node: three digits, the
  // separator at x=87, then two more. A clock, not a plain counter.
  { id: "time", scene: "sub", y: 113, digits: 3, minorDigits: 2, source: null },
  { id: "license", scene: "sub", y: 119, kind: "region", source: null },
  { id: "have", scene: "sub", y: 154, digits: 3, source: "rosterCount" },
  // Shares the y=154 row with `have`, sitting right at x=206/215.
  { id: "cage", scene: "sub", y: 154, digits: 2, source: null }
]);

/** The `G` node at y=161 is the unit glyph beside the capacity figure, not a field. */
export const TAMER_INFO_UNIT_GLYPHS = deepFreeze(["G"]);

/** ROM_VERIFIED: the battle reward path clamps the wallet here. */
export const TAMER_INFO_MONEY_CAP = 9999999;

export const TAMER_INFO_UNSOURCED_FIELDS = deepFreeze(
  TAMER_INFO_FIELDS.filter((field) => field.source === null).map((field) => field.id)
);
export const TAMER_INFO_UNSOURCED_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";

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

/**
 * Mount Tamer Info.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {number|null} [options.walletBits]  the shop wallet, or null if unavailable
 * @param {number|null} [options.rosterCount] how many Digimon the player holds
 * @param {number|null} [options.tamerRank]   PlayerData +0x0AE8
 * @param {() => void} [options.onExit]
 */
export function createTamerInfoView({ root, walletBits = null, rosterCount = null, tamerRank = null, trainerName=null, onExit } = {}) {
  if (!root) throw new TypeError("Tamer Info requires a root element");

  root.replaceChildren();
  root.className = "cm-tamer-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.originalScenes = TAMER_INFO_SCENES.join(",");

  const values = {
    money: Number.isInteger(walletBits) ? Math.min(walletBits, TAMER_INFO_MONEY_CAP) : null,
    have: Number.isInteger(rosterCount) ? rosterCount : null,
    rank: Number.isInteger(tamerRank) ? tamerRank : null,
    name:trainerName
  };

  const shell = element("section", "cm-tamer-shell");
  shell.append(element("p", "cm-tamer-kicker", "TAMER"), element("h1", "cm-tamer-title", "TAMER INFO"));

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
      cell.textContent = uiText(field.digits ? padToWidth(value, field.digits) : String(value));
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
    table.append(label, cell);
  }

  const note = element("p", "cm-tamer-note",
    `共 ${TAMER_INFO_FIELDS.length} 個欄位，其中 ${TAMER_INFO_FIELDS.length-sourced} 個欄位的資料來源尚待確認，以橫線表示，並非零。`);

  const back = element("button", "cm-tamer-back", "BACK");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });

  shell.append(table, note, back);
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
