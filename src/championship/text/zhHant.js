// Traditional Chinese display copy.
//
// WHAT THIS IS, AND WHAT IT IS NOT
// --------------------------------
// This file is PRODUCT_AUTHORED. Every string in it was written for this build.
// None of it is recovered from the cartridge, and none of it may ever be cited as
// evidence of what the original says.
//
// The cartridge is the Japanese YDIJ release, so the ROM catalogs hold Japanese
// and keep holding it: species-names, cage-definitions, gate-table, help-text and
// the title events all stay exactly as transcribed. This layer sits ON TOP of
// them, keyed by the same record indices, so the two never mix and the Japanese
// is always one lookup away.
//
// WHY KEY BY INDEX AND NOT BY THE JAPANESE STRING
// -----------------------------------------------
// A translation keyed by text would silently follow a mistranscription. Keyed by
// record index it cannot: if a catalog's indices ever shift, the wrong Chinese
// appears against a name that no longer matches, which a test can catch. The
// catalogs remain the authority for WHICH record is which.
//
// Anything without an entry falls back to the cartridge's own Japanese rather
// than to a blank or to an invented word.

import { deepFreeze } from "../contracts/championshipContracts.js";
import { SPECIES_NAMES_ZH, SPECIAL_SPECIES_NAMES_ZH, HELP_ZH, TITLE_EVENTS_ZH, SHOP_NAMES_ZH, SHOP_DESCRIPTIONS_ZH } from "./catalogs.zhHant.js";
import { getLocale, isEnglish } from "./locale.js";
import {
  BATTLE_FACE_LABELS_EN, BATTLE_MENU_LABELS_EN, CAGE_EFFECT_LABELS_EN, CAGE_NAMES_EN, DIGI_EGG_EN,
  FAMILY_LABELS_EN, GATE_NAMES_EN, GENERATIONS_EN, PERSONALITIES_EN, RESIST_LABELS_EN, ROSTER_FAMILIES_EN,
  SPECIAL_SKILLS_EN, TAMER_RANK_NAMES_EN, UNKNOWN_DIGIMON_EN
} from "./gameText.en.js";
import {
  BATTLE_FACE_LABELS_JA, BATTLE_MENU_LABELS_JA, CAGE_EFFECT_LABELS_JA, CAGE_NAMES_JA, DIGI_EGG_JA,
  FAMILY_LABELS_JA, GATE_NAMES_JA, GENERATIONS_JA, PERSONALITIES_JA, RESIST_LABELS_JA, ROSTER_FAMILIES_JA,
  SPECIAL_SKILLS_JA, TAMER_RANK_NAMES_JA, UNKNOWN_DIGIMON_JA
} from "./gameText.ja.js";
import {
  BATTLE_FACE_LABELS_TH, BATTLE_MENU_LABELS_TH, CAGE_EFFECT_LABELS_TH, CAGE_NAMES_TH, DIGI_EGG_TH,
  FAMILY_LABELS_TH, GATE_NAMES_TH, GENERATIONS_TH, PERSONALITIES_TH, RESIST_LABELS_TH, ROSTER_FAMILIES_TH,
  SPECIAL_SKILLS_TH, TAMER_RANK_NAMES_TH, UNKNOWN_DIGIMON_TH
} from "./gameText.th.js";
import {
  BATTLE_FACE_LABELS_VI, BATTLE_MENU_LABELS_VI, CAGE_EFFECT_LABELS_VI, CAGE_NAMES_VI, DIGI_EGG_VI,
  FAMILY_LABELS_VI, GATE_NAMES_VI, GENERATIONS_VI, PERSONALITIES_VI, RESIST_LABELS_VI, ROSTER_FAMILIES_VI,
  SPECIAL_SKILLS_VI, TAMER_RANK_NAMES_VI, UNKNOWN_DIGIMON_VI
} from "./gameText.vi.js";
import { HELP_EN, SHOP_DESCRIPTIONS_EN, SHOP_NAMES_EN, TITLE_EVENTS_EN } from "./catalogs.en.js";
import { HELP_JA, SHOP_DESCRIPTIONS_JA, SHOP_NAMES_JA, TITLE_EVENTS_JA } from "./catalogs.ja.js";
import { HELP_TH, SHOP_DESCRIPTIONS_TH, SHOP_NAMES_TH, TITLE_EVENTS_TH } from "./catalogs.th.js";
import { HELP_VI, SHOP_DESCRIPTIONS_VI, SHOP_NAMES_VI, TITLE_EVENTS_VI } from "./catalogs.vi.js";

export const TEXT_LOCALE = "zh-Hant";
export const TEXT_EVIDENCE = "PRODUCT_AUTHORED";
export const TEXT_SOURCE_LANGUAGE = "ja";

// Display translations keyed by the original text-bank selectors confirmed at
// ARM9 02088480 and OVL4 0210BB9C (2026-09-13). Unknown indices stay absent.
const GENERATIONS = Object.freeze(['培育蛋','幼年期Ⅰ','幼年期Ⅱ','成長期','成熟期','完全體','究極體']);
const PERSONALITIES = Object.freeze(['坦率','任性','急躁','悠閒','熱血','冷靜','大膽','膽小','？？？']);
const ROSTER_FAMILIES = Object.freeze(['無','獸','機械','昆蟲植物','鳥','龍','水','聖','暗黑']);
const TAMER_RANK_NAMES = Object.freeze(['綠階','藍階','紅階','白階','青銅','白銀','黃金','白金','冠軍','大師']);
const SPECIAL_SKILLS = Object.freeze(['無','挑釁','治癒 α','治癒 β','治癒 γ','全體治癒 α','全體治癒 β','全體治癒 γ',
  '淨化','全體淨化','強化攻擊','全體強化攻擊','防護','全體防護','加速','全體加速','感知','全體感知',
  '耐火','全體耐火','耐水','全體耐水','耐雷','全體耐雷','耐光','全體耐光','耐暗','全體耐暗','復活 α','復活 β','勇氣']);

const GENERATIONS_BY_LOCALE = {
  "zh-Hant": GENERATIONS, "en": GENERATIONS_EN, "ja": GENERATIONS_JA, "th": GENERATIONS_TH, "vi": GENERATIONS_VI
};
const PERSONALITIES_BY_LOCALE = {
  "zh-Hant": PERSONALITIES, "en": PERSONALITIES_EN, "ja": PERSONALITIES_JA, "th": PERSONALITIES_TH, "vi": PERSONALITIES_VI
};
const ROSTER_FAMILIES_BY_LOCALE = {
  "zh-Hant": ROSTER_FAMILIES, "en": ROSTER_FAMILIES_EN, "ja": ROSTER_FAMILIES_JA, "th": ROSTER_FAMILIES_TH, "vi": ROSTER_FAMILIES_VI
};
const TAMER_RANK_NAMES_BY_LOCALE = {
  "zh-Hant": TAMER_RANK_NAMES, "en": TAMER_RANK_NAMES_EN, "ja": TAMER_RANK_NAMES_JA, "th": TAMER_RANK_NAMES_TH, "vi": TAMER_RANK_NAMES_VI
};
const SPECIAL_SKILLS_BY_LOCALE = {
  "zh-Hant": SPECIAL_SKILLS, "en": SPECIAL_SKILLS_EN, "ja": SPECIAL_SKILLS_JA, "th": SPECIAL_SKILLS_TH, "vi": SPECIAL_SKILLS_VI
};

const localized = (tables, key) => {
  const loc = getLocale();
  const table = tables[loc] ?? tables["zh-Hant"];
  return (table ? table[key] : null) ?? tables["zh-Hant"]?.[key] ?? null;
};
export const generationName = index => localized(GENERATIONS_BY_LOCALE, index);
export const personalityName = index => localized(PERSONALITIES_BY_LOCALE, index);
export const rosterFamilyName = ordinal => localized(ROSTER_FAMILIES_BY_LOCALE, ordinal);
export const tamerRankName = index => localized(TAMER_RANK_NAMES_BY_LOCALE, index);
export const specialSkillName = index => localized(SPECIAL_SKILLS_BY_LOCALE, index);

/** The status bar's mode field. The cartridge's own words are in the comments. */
export const MODE_LABELS = deepFreeze({
  RAISING: "育成",      // イクセイ
  BATTLE: "對戰",       // バトル
  HUNT: "狩獵",         // ハント
  SHOP: "商店"          // ショップ
});

/** The six stats, in the game's own order (text bank entries 35..40). */
export const STAT_LABELS = deepFreeze({
  HP: "生命值",         // HP
  TP: "技力",           // TP
  ATTACK: "攻擊",        // こうげき
  DEFENSE: "防禦",       // ぼうぎょ
  WISDOM: "智力",        // かしこさ
  SPEED: "速度"          // すばやさ
});

/** The five resistances (text bank entries 30..34). */
export const RESIST_LABELS = deepFreeze({
  ねつ: "耐熱",
  さむさ: "耐寒",
  かみなり: "耐雷",
  ひかり: "耐光",
  やみ: "耐暗"
});

/** The ten families (text bank entries 20..29). */
export const FAMILY_LABELS = deepFreeze({
  ワクチン: "疫苗",
  データ: "資料",
  リュウ: "龍",
  ケモノ: "獸",
  ミズ: "水",
  トリ: "鳥",
  キカイ: "機械",
  セイ: "聖",
  ムシクサ: "蟲草",
  アンコク: "暗黑",
  ウイルス: "病毒"
});

/** Cage names, keyed by CageDefinition index 0..35. */
export const CAGE_NAMES = deepFreeze({
  0: "空地", 1: "運動場", 2: "競技場", 3: "道場",
  4: "健身房", 5: "研究所", 6: "火山", 7: "草原",
  8: "海灘", 9: "高山", 10: "森林", 11: "叢林",
  12: "神殿", 13: "墓地", 14: "工廠", 15: "小保健室",
  16: "醫院", 17: "花園", 18: "溫泉", 19: "沙漠",
  20: "冰原", 21: "發電廠", 22: "毒氣室", 23: "寺廟",
  24: "動物園", 25: "牧場", 26: "擂台", 27: "小運動場",
  28: "保健室", 29: "小花園", 30: "小健身房", 31: "小火山",
  32: "小高山", 33: "小海灘", 34: "洞窟", 35: "等候室"
});

/** Cage effect summaries, keyed by the catalog's effect kind and target. */
export const CAGE_EFFECT_LABELS = deepFreeze({
  "STAT_UP:HP": "生命值上升",
  "STAT_UP:TP": "技力上升",
  "STAT_UP:ATTACK": "攻擊上升",
  "STAT_UP:DEFENSE": "防禦上升",
  "STAT_UP:SPEED": "速度上升",
  "STAT_UP:WISDOM": "智力上升",
  "STAT_UP:BATTLE_COUNT": "對戰次數上升",
  "RECOVER:HP_AND_STRESS": "回復生命值與壓力",
  "AUTO_CARE:FOOD_AND_DROPPINGS": "自動餵食與清潔"
});

/** Gate names, keyed by gate-table record index 0..16. */
export const GATE_NAMES = deepFreeze({
  0: "戴納草原", 1: "驅動莽原", 2: "模組之森", 3: "啟動叢林",
  4: "黏滑沼澤", 5: "波浪海岸", 6: "南橋峽谷", 7: "克隆礦坑",
  8: "杜比工廠", 9: "下水道路", 10: "雪之國度", 11: "裂岩地帶",
  12: "岩漿山脈", 13: "灼熱沙漠", 14: "澄澈綠洲", 15: "臨界遺跡",
  16: "教學關卡"
});

/** Original battle mode identities; native dispatch is traced separately. */
export const BATTLE_FACE_LABELS = deepFreeze({
  CHAMPIONSHIP: "冠軍賽",
  TITLE_MATCH: "頭銜賽",
  FREE_BATTLE: "自由對戰",
  LINK_BATTLE: "通訊對戰",
  PASSWORD_BATTLE: "密碼對戰",
  PRACTICE_BATTLE: "練習對戰"
});

/** Copy for the bounded battle-menu panel; match titles keep their source text. */
export const BATTLE_MENU_LABELS = deepFreeze({
  menu: "對戰選單", kicker: "對戰", chooseMatch: "選擇對戰",
  faceNotice: "拖曳立方體或使用左右方向鍵選擇模式，再選擇參加的對戰。",
  availableMatches: "目前可用的對戰", noMatch: "目前沒有開放的對戰。",
  match: "對戰", noPayout: "無獎金", returnHome: "返回牧場", conference: "多輪賽事"
});

function lookup(table, key, fallback) {
  const value = table[key];
  return value === undefined || value === null ? fallback : value;
}

const BATTLE_MENU_LABELS_BY_LOCALE = {
  "zh-Hant": BATTLE_MENU_LABELS, "en": BATTLE_MENU_LABELS_EN, "ja": BATTLE_MENU_LABELS_JA, "th": BATTLE_MENU_LABELS_TH, "vi": BATTLE_MENU_LABELS_VI
};
const BATTLE_FACE_LABELS_BY_LOCALE = {
  "zh-Hant": BATTLE_FACE_LABELS, "en": BATTLE_FACE_LABELS_EN, "ja": BATTLE_FACE_LABELS_JA, "th": BATTLE_FACE_LABELS_TH, "vi": BATTLE_FACE_LABELS_VI
};
const CAGE_NAMES_BY_LOCALE = {
  "zh-Hant": CAGE_NAMES, "en": CAGE_NAMES_EN, "ja": CAGE_NAMES_JA, "th": CAGE_NAMES_TH, "vi": CAGE_NAMES_VI
};
const GATE_NAMES_BY_LOCALE = {
  "zh-Hant": GATE_NAMES, "en": GATE_NAMES_EN, "ja": GATE_NAMES_JA, "th": GATE_NAMES_TH, "vi": GATE_NAMES_VI
};
const UNKNOWN_BY_LOCALE = {
  "zh-Hant": "未確認生物", "en": UNKNOWN_DIGIMON_EN, "ja": UNKNOWN_DIGIMON_JA, "th": UNKNOWN_DIGIMON_TH, "vi": UNKNOWN_DIGIMON_VI
};
const EGG_BY_LOCALE = {
  "zh-Hant": "培育蛋", "en": DIGI_EGG_EN, "ja": DIGI_EGG_JA, "th": DIGI_EGG_TH, "vi": DIGI_EGG_VI
};
const SHOP_NAMES_BY_LOCALE = {
  "zh-Hant": SHOP_NAMES_ZH, "en": SHOP_NAMES_EN, "ja": SHOP_NAMES_JA, "th": SHOP_NAMES_TH, "vi": SHOP_NAMES_VI
};
const SHOP_DESCRIPTIONS_BY_LOCALE = {
  "zh-Hant": SHOP_DESCRIPTIONS_ZH, "en": SHOP_DESCRIPTIONS_EN, "ja": SHOP_DESCRIPTIONS_JA, "th": SHOP_DESCRIPTIONS_TH, "vi": SHOP_DESCRIPTIONS_VI
};
const HELP_BY_LOCALE = {
  "zh-Hant": HELP_ZH, "en": HELP_EN, "ja": HELP_JA, "th": HELP_TH, "vi": HELP_VI
};
const TITLE_EVENTS_BY_LOCALE = {
  "zh-Hant": TITLE_EVENTS_ZH, "en": TITLE_EVENTS_EN, "ja": TITLE_EVENTS_JA, "th": TITLE_EVENTS_TH, "vi": TITLE_EVENTS_VI
};
const CAGE_EFFECT_LABELS_BY_LOCALE = {
  "zh-Hant": CAGE_EFFECT_LABELS, "en": CAGE_EFFECT_LABELS_EN, "ja": CAGE_EFFECT_LABELS_JA, "th": CAGE_EFFECT_LABELS_TH, "vi": CAGE_EFFECT_LABELS_VI
};
const FAMILY_LABELS_BY_LOCALE = {
  "zh-Hant": FAMILY_LABELS, "en": FAMILY_LABELS_EN, "ja": FAMILY_LABELS_JA, "th": FAMILY_LABELS_TH, "vi": FAMILY_LABELS_VI
};
const RESIST_LABELS_BY_LOCALE = {
  "zh-Hant": RESIST_LABELS, "en": RESIST_LABELS_EN, "ja": RESIST_LABELS_JA, "th": RESIST_LABELS_TH, "vi": RESIST_LABELS_VI
};

/** The battle menu's copy in the display language (a fresh object per call). */
export function battleMenuLabels() {
  const loc = getLocale();
  const specific = BATTLE_MENU_LABELS_BY_LOCALE[loc];
  return specific ? { ...BATTLE_MENU_LABELS, ...specific } : { ...BATTLE_MENU_LABELS };
}

/** A battle mode's name in the display language. */
export function battleFaceLabel(id) {
  const loc = getLocale();
  const table = BATTLE_FACE_LABELS_BY_LOCALE[loc] ?? BATTLE_FACE_LABELS;
  return table[id] ?? BATTLE_FACE_LABELS[id] ?? id;
}

/** Name for a cage, falling back to the cartridge's Japanese. */
export function cageName(cageIndex, japanese) {
  const loc = getLocale();
  const table = CAGE_NAMES_BY_LOCALE[loc] ?? CAGE_NAMES;
  if (table[cageIndex]) return table[cageIndex];
  return lookup(CAGE_NAMES, cageIndex, japanese);
}

/** Name for a gate, falling back to the cartridge's Japanese. */
export function gateName(recordIndex, japanese) {
  const loc = getLocale();
  const table = GATE_NAMES_BY_LOCALE[loc] ?? GATE_NAMES;
  if (table[recordIndex]) return table[recordIndex];
  return lookup(GATE_NAMES, recordIndex, japanese);
}

/**
 * Only catalog identity is localized here; never pass a player's nickname.
 * Species names have no approved translation, so they keep approved characters;
 * eggs and unknown fallback are ordinary localized words.
 */
export function speciesName(recordIndex, fallback = undefined) {
  const loc = getLocale();
  const egg = EGG_BY_LOCALE[loc] ?? "培育蛋";
  const unknown = fallback === undefined ? (UNKNOWN_BY_LOCALE[loc] ?? "未確認生物") : fallback;
  if (Number.isInteger(recordIndex) && recordIndex >= 0 && recordIndex < 8) return egg;
  if (SPECIAL_SPECIES_NAMES_ZH?.[recordIndex]) return SPECIAL_SPECIES_NAMES_ZH[recordIndex];
  return lookup(SPECIES_NAMES_ZH, recordIndex, unknown);
}

export function speciesNameForId(speciesId, fallback = undefined) {
  const loc = getLocale();
  const unknown = fallback === undefined ? (UNKNOWN_BY_LOCALE[loc] ?? "未確認生物") : fallback;
  const match = /^(?:championship:creature:)?species-(\d+)$/.exec(speciesId ?? "");
  return match ? speciesName(Number(match[1]), unknown) : unknown;
}

/** A Shop item's name and description in the display language. */
export function shopItemName(recordIndex, fallback = null) {
  const loc = getLocale();
  const table = SHOP_NAMES_BY_LOCALE[loc] ?? SHOP_NAMES_ZH;
  return table[recordIndex] ?? SHOP_NAMES_ZH[recordIndex] ?? fallback;
}
export function shopItemDescription(recordIndex, fallback = null) {
  const loc = getLocale();
  const table = SHOP_DESCRIPTIONS_BY_LOCALE[loc] ?? SHOP_DESCRIPTIONS_ZH;
  return table[recordIndex] ?? SHOP_DESCRIPTIONS_ZH[recordIndex] ?? fallback;
}

// Original starter constructor's 25 variants (two produce the same name).
// This is a display alias for the automatically named STARTER only. The native
// name stays in its record, and collection/player-edited names bypass this map.
export const STARTER_NAMES_ZH = deepFreeze({
  デジデジ: "迪吉迪吉", デジコ: "迪吉子", デジオ: "迪吉歐", デジリン: "迪吉鈴",
  デジリータ: "迪吉莉塔", デジポン: "迪吉碰", デジタロウ: "迪吉太郎", デジジロウ: "迪吉次郎",
  デジッチ: "迪吉奇", デジスケ: "迪吉助", デジルス: "迪吉魯斯", デジヨン: "迪吉勇",
  デジーン: "迪吉恩", デジックス: "迪吉克斯", デジノスケ: "迪吉之助", デジエモン: "迪吉衛門",
  デジタナ: "迪吉塔娜", デジジ: "迪吉吉", デジータ: "迪吉塔", デジプー: "迪吉噗",
  デジプス: "迪吉普斯", デジデ: "迪吉迪", デジドン: "迪吉咚", デジヤン: "迪吉楊"
});

export function starterName(name) {
  return STARTER_NAMES_ZH[name] ?? name;
}

export function raisingDisplayName(instance) {
  const name = instance.displayName ?? speciesNameForId(instance.speciesId);
  return instance.source?.kind === "STARTER" ? starterName(name) : name;
}

export function helpText(entryIndex, field, fallback) {
  const loc = getLocale();
  const table = HELP_BY_LOCALE[loc] ?? HELP_ZH;
  return table[entryIndex]?.[field] ?? HELP_ZH[entryIndex]?.[field] ?? fallback;
}

export function titleEventText(recordIndex, field, fallback) {
  const loc = getLocale();
  const table = TITLE_EVENTS_BY_LOCALE[loc] ?? TITLE_EVENTS_ZH;
  return table[recordIndex]?.[field] ?? TITLE_EVENTS_ZH[recordIndex]?.[field] ?? fallback;
}

/** Localized string for a cage effect. */
export function cageEffectLabel(kind, target) {
  const key = `${kind}:${target}`;
  const loc = getLocale();
  const direct = CAGE_EFFECT_LABELS_BY_LOCALE[loc]?.[key] ?? CAGE_EFFECT_LABELS[key];
  if (direct) return direct;
  if (kind === "FAMILY_UP") {
    const fam = FAMILY_LABELS_BY_LOCALE[loc]?.[target] ?? FAMILY_LABELS[target];
    if (loc === "en") return `${fam} up`;
    if (loc === "ja") return `${fam}上昇`;
    if (loc === "th") return `เพิ่มพลังเผ่า${fam}`;
    if (loc === "vi") return `Tăng tộc ${fam}`;
    return fam ? `${fam}屬性上升` : null;
  }
  if (kind === "RESIST_UP") {
    return RESIST_LABELS_BY_LOCALE[loc]?.[target] ?? RESIST_LABELS[target] ?? null;
  }
  return null;
}
