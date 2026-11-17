// Five-locale copy for battle styles, special-skill effects and status names (BATTLE_STYLE_V1,
// 2026-11-16). Short labels, no sentences: they sit beside icons on cards and plates.
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';

const ZH = {
  label: '戰鬥風格',
  'style.ATTACK': '攻擊型', 'style.SKILL': '技能型', 'style.SUPPORT': '支援型',
  'short.ATTACK': '攻', 'short.SKILL': '技', 'short.SUPPORT': '支',
  'class.ATTACK': '攻擊', 'class.SKILL': '技能', 'class.SUPPORT': '支援',
  'target.ONE': '我方 1 隻', 'target.ALL': '我方全體', 'target.SELF': '自己',
  'effect.skill_taunt': '吸引敵人攻擊', 'effect.skill_heal': '{who}回復 HP', 'effect.skill_cleanse': '{who}解除異常',
  'effect.skill_attack_up': '{who}攻擊提升', 'effect.skill_guard': '{who}受到防護', 'effect.skill_haste': '{who}速度提升',
  'effect.skill_sense': '{who}感知提升', 'effect.resist_fire': '{who}耐火', 'effect.resist_water': '{who}耐水',
  'effect.resist_thunder': '{who}耐雷', 'effect.resist_light': '{who}耐光', 'effect.resist_dark': '{who}耐暗',
  'effect.skill_revive': '倒下的隊友復活', 'effect.skill_courage': '',
  'status.status_stunned': '暈眩', 'status.status_charmed': '魅惑', 'status.status_frozen': '冰凍', 'status.status_rage': '狂暴',
  'status.status_confused': '混亂', 'status.status_slowed': '緩慢', 'status.status_poisoned': '中毒', 'status.status_bleeding': '流血',
  'status.status_sleep': '睡眠', 'status.status_electrified': '麻痺', 'status.status_petrified': '石化', 'status.status_cursed': '詛咒',
  'status.status_burning': '灼燒',
  foeStatus: '對手：{list}', statusCount: '{name} ×{n}'
};

export const BATTLE_STYLE_COPY = deepFreeze({
  'zh-Hant': ZH,
  en: {
    label: 'Battle style',
    'style.ATTACK': 'Attacker', 'style.SKILL': 'Skill user', 'style.SUPPORT': 'Supporter',
    'short.ATTACK': 'ATK', 'short.SKILL': 'SKL', 'short.SUPPORT': 'SUP',
    'class.ATTACK': 'Attack', 'class.SKILL': 'Skill', 'class.SUPPORT': 'Support',
    'target.ONE': 'One ally', 'target.ALL': 'All allies', 'target.SELF': 'Self',
    'effect.skill_taunt': 'Draws enemy attacks', 'effect.skill_heal': '{who}: restore HP', 'effect.skill_cleanse': '{who}: cure ailments',
    'effect.skill_attack_up': '{who}: attack up', 'effect.skill_guard': '{who}: guard', 'effect.skill_haste': '{who}: speed up',
    'effect.skill_sense': '{who}: sense up', 'effect.resist_fire': '{who}: fire resist', 'effect.resist_water': '{who}: water resist',
    'effect.resist_thunder': '{who}: thunder resist', 'effect.resist_light': '{who}: light resist', 'effect.resist_dark': '{who}: dark resist',
    'effect.skill_revive': 'Revives a fallen ally', 'effect.skill_courage': '',
    'status.status_stunned': 'Stun', 'status.status_charmed': 'Charm', 'status.status_frozen': 'Freeze', 'status.status_rage': 'Rage',
    'status.status_confused': 'Confuse', 'status.status_slowed': 'Slow', 'status.status_poisoned': 'Poison', 'status.status_bleeding': 'Bleed',
    'status.status_sleep': 'Sleep', 'status.status_electrified': 'Paralyze', 'status.status_petrified': 'Stone', 'status.status_cursed': 'Curse',
    'status.status_burning': 'Burn',
    foeStatus: 'Foes: {list}', statusCount: '{name} ×{n}'
  },
  ja: {
    label: 'バトルスタイル',
    'style.ATTACK': 'アタック型', 'style.SKILL': 'スキル型', 'style.SUPPORT': 'サポート型',
    'short.ATTACK': '攻', 'short.SKILL': '技', 'short.SUPPORT': '支',
    'class.ATTACK': 'こうげき', 'class.SKILL': 'わざ', 'class.SUPPORT': 'サポート',
    'target.ONE': '味方1体', 'target.ALL': '味方全員', 'target.SELF': '自分',
    'effect.skill_taunt': '敵の攻撃を引きつける', 'effect.skill_heal': '{who}のHP回復', 'effect.skill_cleanse': '{who}の状態異常回復',
    'effect.skill_attack_up': '{who}の攻撃アップ', 'effect.skill_guard': '{who}を守る', 'effect.skill_haste': '{who}のスピードアップ',
    'effect.skill_sense': '{who}の感知アップ', 'effect.resist_fire': '{who}の火耐性', 'effect.resist_water': '{who}の水耐性',
    'effect.resist_thunder': '{who}の雷耐性', 'effect.resist_light': '{who}の光耐性', 'effect.resist_dark': '{who}の闇耐性',
    'effect.skill_revive': '倒れた味方を復活', 'effect.skill_courage': '',
    'status.status_stunned': 'スタン', 'status.status_charmed': 'みりょう', 'status.status_frozen': 'こおり', 'status.status_rage': 'いかり',
    'status.status_confused': 'こんらん', 'status.status_slowed': 'スロウ', 'status.status_poisoned': 'どく', 'status.status_bleeding': 'しゅっけつ',
    'status.status_sleep': 'ねむり', 'status.status_electrified': 'まひ', 'status.status_petrified': 'せきか', 'status.status_cursed': 'のろい',
    'status.status_burning': 'やけど',
    foeStatus: '相手：{list}', statusCount: '{name} ×{n}'
  },
  th: {
    label: 'สไตล์การต่อสู้',
    'style.ATTACK': 'สายโจมตี', 'style.SKILL': 'สายท่า', 'style.SUPPORT': 'สายสนับสนุน',
    'short.ATTACK': 'โจมตี', 'short.SKILL': 'ท่า', 'short.SUPPORT': 'ซัพ',
    'class.ATTACK': 'โจมตี', 'class.SKILL': 'ท่า', 'class.SUPPORT': 'สนับสนุน',
    'target.ONE': 'พวกเดียวกัน 1 ตัว', 'target.ALL': 'พวกเดียวกันทั้งหมด', 'target.SELF': 'ตัวเอง',
    'effect.skill_taunt': 'ล่อการโจมตีของศัตรู', 'effect.skill_heal': '{who} ฟื้น HP', 'effect.skill_cleanse': '{who} ล้างสถานะผิดปกติ',
    'effect.skill_attack_up': '{who} พลังโจมตีขึ้น', 'effect.skill_guard': '{who} ได้รับการป้องกัน', 'effect.skill_haste': '{who} ความเร็วขึ้น',
    'effect.skill_sense': '{who} การรับรู้ขึ้น', 'effect.resist_fire': '{who} ต้านไฟ', 'effect.resist_water': '{who} ต้านน้ำ',
    'effect.resist_thunder': '{who} ต้านสายฟ้า', 'effect.resist_light': '{who} ต้านแสง', 'effect.resist_dark': '{who} ต้านความมืด',
    'effect.skill_revive': 'ชุบชีวิตพวกที่ล้ม', 'effect.skill_courage': '',
    'status.status_stunned': 'มึน', 'status.status_charmed': 'หลงเสน่ห์', 'status.status_frozen': 'แช่แข็ง', 'status.status_rage': 'คลั่ง',
    'status.status_confused': 'สับสน', 'status.status_slowed': 'ช้าลง', 'status.status_poisoned': 'พิษ', 'status.status_bleeding': 'เลือดออก',
    'status.status_sleep': 'หลับ', 'status.status_electrified': 'ชา', 'status.status_petrified': 'กลายเป็นหิน', 'status.status_cursed': 'คำสาป',
    'status.status_burning': 'ไฟไหม้',
    foeStatus: 'ศัตรู: {list}', statusCount: '{name} ×{n}'
  },
  vi: {
    label: 'Phong cách chiến đấu',
    'style.ATTACK': 'Tấn công', 'style.SKILL': 'Kỹ năng', 'style.SUPPORT': 'Hỗ trợ',
    'short.ATTACK': 'Công', 'short.SKILL': 'Kỹ', 'short.SUPPORT': 'Hỗ',
    'class.ATTACK': 'Tấn công', 'class.SKILL': 'Kỹ năng', 'class.SUPPORT': 'Hỗ trợ',
    'target.ONE': '1 đồng đội', 'target.ALL': 'Cả đội', 'target.SELF': 'Bản thân',
    'effect.skill_taunt': 'Hút đòn của địch', 'effect.skill_heal': '{who} hồi HP', 'effect.skill_cleanse': '{who} giải trạng thái',
    'effect.skill_attack_up': '{who} tăng công', 'effect.skill_guard': '{who} được bảo vệ', 'effect.skill_haste': '{who} tăng tốc',
    'effect.skill_sense': '{who} tăng cảm nhận', 'effect.resist_fire': '{who} kháng lửa', 'effect.resist_water': '{who} kháng nước',
    'effect.resist_thunder': '{who} kháng sét', 'effect.resist_light': '{who} kháng ánh sáng', 'effect.resist_dark': '{who} kháng bóng tối',
    'effect.skill_revive': 'Hồi sinh đồng đội đã gục', 'effect.skill_courage': '',
    'status.status_stunned': 'Choáng', 'status.status_charmed': 'Mê hoặc', 'status.status_frozen': 'Đóng băng', 'status.status_rage': 'Cuồng nộ',
    'status.status_confused': 'Rối loạn', 'status.status_slowed': 'Chậm', 'status.status_poisoned': 'Độc', 'status.status_bleeding': 'Chảy máu',
    'status.status_sleep': 'Ngủ', 'status.status_electrified': 'Tê liệt', 'status.status_petrified': 'Hóa đá', 'status.status_cursed': 'Nguyền',
    'status.status_burning': 'Bỏng',
    foeStatus: 'Đối thủ: {list}', statusCount: '{name} ×{n}'
  }
});

export function battleStyleText(key, values = {}, locale = getLocale()) {
  const lang = Object.hasOwn(BATTLE_STYLE_COPY, locale) ? locale : 'zh-Hant';
  const text = BATTLE_STYLE_COPY[lang][key] ?? BATTLE_STYLE_COPY['zh-Hant'][key] ?? '';
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

/** One short effect line for a special skill glyph and reach (ONE / ALL / SELF); '' when untraced. */
export function specialSkillEffect(glyph, group, locale = getLocale()) {
  return battleStyleText(`effect.${glyph}`, { who: battleStyleText(`target.${group}`, {}, locale) }, locale);
}
