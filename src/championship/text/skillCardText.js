// Five-locale copy for the tamer skill cards (ROADMAP_R4_20261118). A name and one short line each; the card's picture
// says the rest (in-game copy short: numbers first, no sentences).
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from './locale.js';

const LOCALES = ['zh-Hant', 'en', 'ja', 'th', 'vi'];
// [name, effect] per locale, in LOCALES order.
const ROWS = {
  'basic.cheer': [['加油聲援', '全隊 TP +20%'], ['Cheer', 'Team TP +20%'], ['声援', '全員 TP +20%'], ['เชียร์', 'TP ทีม +20%'], ['Cổ vũ', 'TP đội +20%']],
  'basic.firstAid': [['急救噴霧', '最傷的回 15% HP'], ['First aid', 'Most hurt +15% HP'], ['救急スプレー', '一番弱い味方 HP +15%'], ['ปฐมพยาบาล', 'ตัวที่เจ็บสุด HP +15%'], ['Sơ cứu', 'Người yếu nhất +15% HP']],
  'basic.focus': [['專注指令', '下一招必殺 +25%'], ['Focus', 'Next finisher +25%'], ['集中指令', '次の必殺 +25%'], ['สมาธิ', 'ท่าไม้ตายถัดไป +25%'], ['Tập trung', 'Chiêu cuối kế +25%']],
  'basic.cover': [['掩護指令', '8 秒受傷 −20%'], ['Cover', '8 s: damage taken −20%'], ['援護指令', '8 秒 被ダメ −20%'], ['คุ้มกัน', '8 วิ ดาเมจรับ −20%'], ['Yểm hộ', '8 giây: nhận sát thương −20%']],
  'hunter.stunShot': [['麻痺彈', '一名敵人停 2 秒'], ['Stun shot', 'One foe stalls 2 s'], ['麻痺弾', '敵 1 体 2 秒停止'], ['กระสุนชา', 'ศัตรู 1 ตัวหยุด 2 วิ'], ['Đạn tê liệt', '1 địch đứng 2 giây']],
  'hunter.weakMark': [['弱點標記', '一名敵人 10 秒受傷 +15%'], ['Weak mark', 'One foe takes +15% for 10 s'], ['弱点マーク', '敵 1 体 10 秒 被ダメ +15%'], ['มาร์กจุดอ่อน', 'ศัตรู 1 ตัวรับ +15% 10 วิ'], ['Đánh dấu', '1 địch nhận +15% trong 10 giây']],
  'hunter.smoke': [['干擾煙幕', '敵方 TP −30%'], ['Smoke screen', 'Foes TP −30%'], ['煙幕', '敵 TP −30%'], ['ม่านควัน', 'TP ศัตรู −30%'], ['Màn khói', 'TP địch −30%']],
  'hunter.snare': [['陷阱繩', '全體敵人停 1 秒'], ['Snare', 'All foes stall 1 s'], ['罠ロープ', '敵全員 1 秒停止'], ['บ่วงดัก', 'ศัตรูทั้งหมดหยุด 1 วิ'], ['Bẫy dây', 'Mọi địch đứng 1 giây']],
  'breeder.nutrient': [['營養劑', '全隊 HP +10%'], ['Nutrient', 'Team HP +10%'], ['栄養剤', '全員 HP +10%'], ['สารอาหาร', 'HP ทีม +10%'], ['Dinh dưỡng', 'HP đội +10%']],
  'breeder.calm': [['鎮靜香', '解除全隊異常'], ['Calming incense', 'Team status cleared'], ['鎮静香', '全員の状態異常を解除'], ['ธูปสงบ', 'ล้างสถานะผิดปกติทีม'], ['Hương an thần', 'Xoá hiệu ứng xấu cả đội']],
  'breeder.vitality': [['活力循環', '10 秒每 2 秒 HP +2%'], ['Vitality', 'HP +2% every 2 s, 10 s'], ['活力循環', '10 秒 2 秒ごと HP +2%'], ['วงจรพลัง', 'HP +2% ทุก 2 วิ 10 วิ'], ['Sinh lực', 'HP +2% mỗi 2 giây, 10 giây']],
  'breeder.guts': [['毅力', '下次致命傷留 1 HP'], ['Guts', 'Next fatal hit leaves 1 HP'], ['根性', '次の致命傷を HP 1 で耐える'], ['ใจสู้', 'โดนตายครั้งหน้าเหลือ 1 HP'], ['Kiên cường', 'Đòn chí mạng kế còn 1 HP']],
  'commander.charge': [['全軍突擊', '8 秒傷害 +15%'], ['Charge', '8 s: damage +15%'], ['全軍突撃', '8 秒 与ダメ +15%'], ['บุกเต็มกำลัง', '8 วิ ดาเมจ +15%'], ['Xung phong', '8 giây: sát thương +15%']],
  'commander.critDrill': [['爆擊教範', '8 秒爆擊 +15'], ['Crit drill', '8 s: crit +15'], ['会心教範', '8 秒 会心 +15'], ['ตำราคริติคอล', '8 วิ คริ +15'], ['Giáo trình chí mạng', '8 giây: chí mạng +15']],
  'commander.link': [['連攜號令', '全隊冷卻減半'], ['Link order', 'Team cooldowns halved'], ['連携号令', '全員のクールダウン半減'], ['คำสั่งประสาน', 'คูลดาวน์ทีมลดครึ่ง'], ['Hiệu lệnh', 'Hồi chiêu cả đội giảm nửa']],
  'commander.awaken': [['覺醒共鳴', '爆裂量表 +25%'], ['Awaken', 'Burst gauge +25%'], ['覚醒共鳴', 'バーストゲージ +25%'], ['ปลุกพลัง', 'เกจเบิร์สต์ +25%'], ['Thức tỉnh', 'Thanh bùng nổ +25%']],
  'trader.bounty': [['賞金加碼', '勝利 Bits +20%'], ['Bounty up', 'Win: Bits +20%'], ['賞金アップ', '勝利 Bits +20%'], ['เพิ่มรางวัล', 'ชนะ: Bits +20%'], ['Thưởng thêm', 'Thắng: Bits +20%']],
  'trader.sync': [['同步增幅', '勝利同步 EXP +25%'], ['Sync boost', 'Win: Sync EXP +25%'], ['同期ブースト', '勝利 同期 EXP +25%'], ['เพิ่มซิงก์', 'ชนะ: EXP ซิงก์ +25%'], ['Tăng đồng bộ', 'Thắng: EXP đồng bộ +25%']],
  'trader.probe': [['結晶探測', '勝利結晶 +30'], ['Crystal probe', 'Win: crystals +30'], ['結晶探知', '勝利 結晶 +30'], ['เรดาร์คริสตัล', 'ชนะ: คริสตัล +30'], ['Dò tinh thể', 'Thắng: tinh thể +30']],
  'trader.lucky': [['幸運籤', '勝利 30% 得轉蛋券'], ['Lucky draw', 'Win: 30% a gacha ticket'], ['幸運くじ', '勝利 30% でガチャ券'], ['สลากโชค', 'ชนะ: 30% ได้ตั๋วกาชา'], ['Thăm may mắn', 'Thắng: 30% vé gacha']]
};
const UI = {
  'hand': ['馴獸師技能卡', 'Tamer cards', 'テイマーカード', 'การ์ดเทมเมอร์', 'Thẻ huấn luyện'],
  'hint': ['上滑丟出', 'Swipe up to throw', '上にスワイプで投げる', 'ปัดขึ้นเพื่อโยน', 'Vuốt lên để ném'],
  'wait': ['{seconds} 秒', '{seconds}s', '{seconds} 秒', '{seconds} วิ', '{seconds} giây'],
  'NOT_READY': ['還沒好', 'Not yet', 'まだ', 'ยังไม่พร้อม', 'Chưa được'],
  'ALREADY_PLAYED': ['已使用', 'Used', '使用済み', 'ใช้แล้ว', 'Đã dùng']
};
export const SKILL_CARD_COPY = deepFreeze(Object.fromEntries(LOCALES.map((locale, i) => [locale, {
  ...Object.fromEntries(Object.entries(ROWS).flatMap(([id, row]) => [[`${id}.name`, row[i][0]], [`${id}.effect`, row[i][1]]])),
  ...Object.fromEntries(Object.entries(UI).map(([key, row]) => [key, row[i]]))
}])));

export function skillCardText(key, params = null, locale = getLocale()) {
  const table = SKILL_CARD_COPY[locale] ?? SKILL_CARD_COPY['zh-Hant'];
  const template = table[key] ?? SKILL_CARD_COPY['zh-Hant'][key] ?? key;
  return params ? template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : template;
}
