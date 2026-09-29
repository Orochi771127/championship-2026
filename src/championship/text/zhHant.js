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
import { SPECIES_NAMES_ZH, HELP_ZH, TITLE_EVENTS_ZH, SHOP_NAMES_ZH, SHOP_DESCRIPTIONS_ZH } from "./catalogs.zhHant.js";
// English (settings round, 2026-09-29): the accessors below return English
// when the display language is English and an English entry exists. The
// tables in this file stay the zh-Hant source; nothing here is replaced.
import { isEnglish } from "./locale.js";
import {
  BATTLE_FACE_LABELS_EN, BATTLE_MENU_LABELS_EN, CAGE_EFFECT_LABELS_EN, CAGE_NAMES_EN, DIGI_EGG_EN,
  FAMILY_LABELS_EN, GATE_NAMES_EN, GENERATIONS_EN, PERSONALITIES_EN, RESIST_LABELS_EN, ROSTER_FAMILIES_EN,
  SPECIAL_SKILLS_EN, TAMER_RANK_NAMES_EN, UNKNOWN_DIGIMON_EN
} from "./gameText.en.js";
import { HELP_EN, SHOP_DESCRIPTIONS_EN, SHOP_NAMES_EN, TITLE_EVENTS_EN } from "./catalogs.en.js";

export const TEXT_LOCALE = "zh-Hant";
export const TEXT_EVIDENCE = "PRODUCT_AUTHORED";
export const TEXT_SOURCE_LANGUAGE = "ja";

// Display translations keyed by the original text-bank selectors confirmed at
// ARM9 02088480 and OVL4 0210BB9C (2026-09-13). Unknown indices stay absent.
const GENERATIONS = Object.freeze(['數碼蛋','幼年期Ⅰ','幼年期Ⅱ','成長期','成熟期','完全體','究極體']);
const PERSONALITIES = Object.freeze(['坦率','任性','急躁','悠閒','熱血','冷靜','大膽','膽小','？？？']);
const ROSTER_FAMILIES = Object.freeze(['無','獸','機械','昆蟲植物','鳥','龍','水','聖','暗黑']);
const TAMER_RANK_NAMES = Object.freeze(['綠階','藍階','紅階','白階','青銅','白銀','黃金','白金','冠軍','大師']);
const SPECIAL_SKILLS = Object.freeze(['無','挑釁','治癒 α','治癒 β','治癒 γ','全體治癒 α','全體治癒 β','全體治癒 γ',
  '淨化','全體淨化','強化攻擊','全體強化攻擊','防護','全體防護','加速','全體加速','感知','全體感知',
  '耐火','全體耐火','耐水','全體耐水','耐雷','全體耐雷','耐光','全體耐光','耐暗','全體耐暗','復活 α','復活 β','勇氣']);
const localized = (zh, en, key) => (isEnglish() ? en[key] ?? zh[key] : zh[key]) ?? null;
export const generationName = index => localized(GENERATIONS, GENERATIONS_EN, index);
export const personalityName = index => localized(PERSONALITIES, PERSONALITIES_EN, index);
export const rosterFamilyName = ordinal => localized(ROSTER_FAMILIES, ROSTER_FAMILIES_EN, ordinal);
export const tamerRankName = index => localized(TAMER_RANK_NAMES, TAMER_RANK_NAMES_EN, index);
export const specialSkillName = index => localized(SPECIAL_SKILLS, SPECIAL_SKILLS_EN, index);

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

/** The battle menu's copy in the display language (a fresh object per call). */
export function battleMenuLabels() {
  return isEnglish() ? { ...BATTLE_MENU_LABELS, ...BATTLE_MENU_LABELS_EN } : { ...BATTLE_MENU_LABELS };
}

/** A battle mode's name in the display language. */
export function battleFaceLabel(id) {
  return (isEnglish() ? BATTLE_FACE_LABELS_EN[id] : null) ?? BATTLE_FACE_LABELS[id] ?? id;
}

/** Chinese (or English) for a cage, falling back to the cartridge's Japanese. */
export function cageName(cageIndex, japanese) {
  if (isEnglish() && CAGE_NAMES_EN[cageIndex]) return CAGE_NAMES_EN[cageIndex];
  return lookup(CAGE_NAMES, cageIndex, japanese);
}

/** Chinese (or English) for a gate, falling back to the cartridge's Japanese. */
export function gateName(recordIndex, japanese) {
  if (isEnglish() && GATE_NAMES_EN[recordIndex]) return GATE_NAMES_EN[recordIndex];
  return lookup(GATE_NAMES, recordIndex, japanese);
}

/**
 * Only catalog identity is localized here; never pass a player's nickname.
 * Species names have no approved English form, so English shows the approved
 * zh-Hant name; the eggs and the unknown fallback are ordinary words.
 */
export function speciesName(recordIndex, fallback = undefined) {
  if (Number.isInteger(recordIndex) && recordIndex >= 0 && recordIndex < 8) return isEnglish() ? DIGI_EGG_EN : "數碼蛋";
  return lookup(SPECIES_NAMES_ZH, recordIndex, fallback === undefined ? (isEnglish() ? UNKNOWN_DIGIMON_EN : "未知數碼獸") : fallback);
}

export function speciesNameForId(speciesId, fallback = undefined) {
  const unknown = fallback === undefined ? (isEnglish() ? UNKNOWN_DIGIMON_EN : "未知數碼獸") : fallback;
  const match = /^(?:championship:creature:)?species-(\d+)$/.exec(speciesId ?? "");
  return match ? speciesName(Number(match[1]), unknown) : unknown;
}

/** A Shop item's name and description in the display language. */
export function shopItemName(recordIndex, fallback = null) {
  return (isEnglish() ? SHOP_NAMES_EN[recordIndex] : null) ?? SHOP_NAMES_ZH[recordIndex] ?? fallback;
}
export function shopItemDescription(recordIndex, fallback = null) {
  return (isEnglish() ? SHOP_DESCRIPTIONS_EN[recordIndex] : null) ?? SHOP_DESCRIPTIONS_ZH[recordIndex] ?? fallback;
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
  return (isEnglish() ? HELP_EN[entryIndex]?.[field] : null) ?? HELP_ZH[entryIndex]?.[field] ?? fallback;
}

export function titleEventText(recordIndex, field, fallback) {
  return (isEnglish() ? TITLE_EVENTS_EN[recordIndex]?.[field] : null) ?? TITLE_EVENTS_ZH[recordIndex]?.[field] ?? fallback;
}

/** Chinese (or English) for a cage effect, falling back to the raw kind:target key. */
export function cageEffectLabel(kind, target) {
  const key = `${kind}:${target}`;
  const english = isEnglish();
  const direct = english ? CAGE_EFFECT_LABELS_EN[key] ?? CAGE_EFFECT_LABELS[key] : CAGE_EFFECT_LABELS[key];
  if (direct) return direct;
  if (kind === "FAMILY_UP") {
    if (english && FAMILY_LABELS_EN[target]) return `${FAMILY_LABELS_EN[target]} up`;
    const family = FAMILY_LABELS[target];
    return family ? `${family}屬性上升` : null;
  }
  if (kind === "RESIST_UP") {
    const resist = english ? RESIST_LABELS_EN[target] ?? RESIST_LABELS[target] : RESIST_LABELS[target];
    return resist ?? null;
  }
  return null;
}
