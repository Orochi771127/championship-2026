// Five-locale copy for the tamer level and talent tree (OWNER_APPROVED_ADAPTATION 2026-11-17, TAMER_TALENTS_20261117).
// Numbers first, at most 24 characters a line (Owner copy rule). Node names are short nouns; what a node does is
// printed from its own numbers (talentEffectText), so the copy cannot drift from the rules.
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';

const LOCALES = ['zh-Hant', 'en', 'ja', 'th', 'vi'];
// key -> [zh-Hant, en, ja, th, vi]
const ROWS = {
  'title': ['天賦', 'Talents', '天賦', 'พรสวรรค์', 'Thiên phú'],
  'open': ['天賦', 'Talents', '天賦', 'พรสวรรค์', 'Thiên phú'],
  'level': ['馴獸師 Lv.{level}', 'Tamer Lv.{level}', 'テイマー Lv.{level}', 'เทมเมอร์ Lv.{level}', 'Tamer Lv.{level}'],
  'exp': ['{exp} / {next} EXP', '{exp} / {next} EXP', '{exp} / {next} EXP', '{exp} / {next} EXP', '{exp} / {next} EXP'],
  'exp.max': ['Lv.MAX', 'Lv.MAX', 'Lv.MAX', 'Lv.MAX', 'Lv.MAX'],
  'points': ['點數 {free} / {points}', 'Points {free} / {points}', 'ポイント {free} / {points}', 'แต้ม {free} / {points}', 'Điểm {free} / {points}'],
  'line.spent': ['已投入 {spent}', 'Spent {spent}', '投入 {spent}', 'ใช้ไป {spent}', 'Đã dùng {spent}'],
  'tier': ['第 {tier} 層・{gate} 點開放', 'Tier {tier} · opens at {gate}', '第{tier}層・{gate}で開放', 'ชั้น {tier} · เปิดที่ {gate}', 'Tầng {tier} · mở ở {gate}'],
  'keystone': ['頂點・{gate} 點・二選一', 'Keystone · {gate} · 1 of 2', '頂点・{gate}・二択', 'ยอด · {gate} · 1 จาก 2', 'Đỉnh · {gate} · 1 trong 2'],
  'learn': ['+1', '+1', '+1', '+1', '+1'],
  'rank': ['{rank} / {max}', '{rank} / {max}', '{rank} / {max}', '{rank} / {max}', '{rank} / {max}'],
  'respec': ['重置天賦', 'Reset talents', '天賦リセット', 'รีเซ็ตพรสวรรค์', 'Đặt lại thiên phú'],
  'respec.free': ['首次免費', 'First reset free', '初回無料', 'ครั้งแรกฟรี', 'Lần đầu miễn phí'],
  'respec.cost': ['{cost} 結晶（持有 {have}）', '{cost} crystals (have {have})', '結晶 {cost}（所持 {have}）', 'คริสตัล {cost} (มี {have})', '{cost} tinh thể (có {have})'],
  'respec.confirm': ['確認重置', 'Confirm reset', 'リセットする', 'ยืนยันรีเซ็ต', 'Xác nhận đặt lại'],
  'gain': ['馴獸師 +{exp} EXP', 'Tamer +{exp} EXP', 'テイマー +{exp} EXP', 'เทมเมอร์ +{exp} EXP', 'Tamer +{exp} EXP'],
  'TALENT_NOT_OPEN': ['未開放', 'Not open yet', '未開放', 'ยังไม่เปิด', 'Chưa mở'],
  'TALENT_MAX': ['已滿', 'Max', '最大', 'เต็ม', 'Tối đa'],
  'TALENT_TIER_LOCKED': ['層級未開', 'Tier locked', '層が未開放', 'ชั้นยังล็อก', 'Tầng chưa mở'],
  'TALENT_NO_POINTS': ['點數不足', 'No points', 'ポイント不足', 'แต้มไม่พอ', 'Thiếu điểm'],
  'TALENT_KEYSTONE_TAKEN': ['已選另一個', 'Other one taken', 'もう一方を選択済み', 'เลือกอีกอันแล้ว', 'Đã chọn cái kia'],
  'TALENT_NOTHING_SPENT': ['沒有可退的點數', 'Nothing to reset', '戻すポイントなし', 'ไม่มีแต้มให้คืน', 'Không có điểm để hoàn'],
  'TALENT_NO_CRYSTALS': ['結晶不足', 'Not enough crystals', '結晶不足', 'คริสตัลไม่พอ', 'Thiếu tinh thể'],
  'SAVE_FAILED': ['存檔失敗，沒有變更', 'Save failed, unchanged', '保存失敗、変更なし', 'บันทึกล้มเหลว ไม่เปลี่ยน', 'Lưu lỗi, không đổi'],
  'line.hunter': ['獵人', 'Hunter', 'ハンター', 'นักล่า', 'Thợ săn'],
  'line.breeder': ['育成師', 'Breeder', 'ブリーダー', 'นักเพาะเลี้ยง', 'Người nuôi'],
  'line.commander': ['指揮官', 'Commander', 'コマンダー', 'ผู้บัญชาการ', 'Chỉ huy'],
  'line.trader': ['商人', 'Trader', 'トレーダー', 'พ่อค้า', 'Thương nhân'],
  'hunter.breath': ['長息', 'Long Breath', '長い息', 'ลมหายใจยาว', 'Hơi dài'],
  'hunter.ropeCare': ['繩索保養', 'Rope Care', 'ロープ手入れ', 'ดูแลเชือก', 'Bảo dưỡng dây'],
  'hunter.memory': ['記憶擴充', 'Memory Boost', 'メモリ拡張', 'ขยายหน่วยความจำ', 'Mở rộng bộ nhớ'],
  'hunter.herdSense': ['群聚嗅覺', 'Herd Sense', '群れの嗅覚', 'สัมผัสฝูง', 'Đánh hơi bầy'],
  'hunter.appraise': ['識貨', 'Appraise', '目利き', 'ตาถึง', 'Tinh mắt'],
  'hunter.wildSense': ['野性嗅覺', 'Wild Sense', '野性の嗅覚', 'สัมผัสป่า', 'Đánh hơi hoang dã'],
  'hunter.swift': ['疾步', 'Swift Step', '疾走', 'ก้าวไว', 'Bước nhanh'],
  'hunter.steady': ['穩手', 'Steady Hand', '安定の手', 'มือนิ่ง', 'Tay vững'],
  'hunter.thrift': ['省彈', 'Thrift', '節約', 'ประหยัดกระสุน', 'Tiết kiệm đạn'],
  'hunter.keenEye': ['慧眼', 'Keen Eye', '慧眼', 'ตาทิพย์', 'Mắt tinh'],
  'hunter.chainHunt': ['連獵', 'Chain Hunt', '連続狩り', 'ล่าต่อเนื่อง', 'Săn liên hoàn'],
  'breeder.care': ['精心照料', 'Tender Care', '丁寧な世話', 'ดูแลใส่ใจ', 'Chăm kỹ'],
  'breeder.soothe': ['安撫', 'Soothe', 'なだめる', 'ปลอบโยน', 'Vỗ về'],
  'breeder.nightWatch': ['守夜', 'Night Watch', '夜番', 'เฝ้ายาม', 'Canh đêm'],
  'breeder.syncFusion': ['同調融合', 'Sync Fusion', '同調融合', 'หลอมรวมซิงก์', 'Dung hợp đồng điệu'],
  'breeder.lineAffinity': ['同線親和', 'Line Affinity', '系統親和', 'ผูกพันสายพันธุ์', 'Thân dòng'],
  'breeder.automation': ['自動化', 'Automation', '自動化', 'ระบบอัตโนมัติ', 'Tự động hóa'],
  'breeder.strollLuck': ['散步好運', 'Stroll Luck', '散歩の幸運', 'โชคเดินเล่น', 'May mắn dạo chơi'],
  'breeder.herbal': ['藥膳', 'Herbal Diet', '薬膳', 'อาหารสมุนไพร', 'Dược thiện'],
  'breeder.lasting': ['長效', 'Lasting', '長持ち', 'ออกฤทธิ์นาน', 'Lâu tan'],
  'breeder.inherit': ['傳承', 'Inheritance', '継承', 'สืบทอด', 'Kế thừa'],
  'breeder.extract': ['萃取', 'Extract', '抽出', 'สกัด', 'Chiết xuất'],
  'commander.syncTraining': ['同步訓練', 'Sync Training', 'シンクロ訓練', 'ฝึกซิงก์', 'Luyện đồng bộ'],
  'commander.opening': ['先手', 'First Move', '先手', 'เปิดก่อน', 'Ra tay trước'],
  'commander.goodMood': ['好心情', 'Good Mood', 'ご機嫌', 'อารมณ์ดี', 'Tâm trạng tốt'],
  'commander.lumen': ['心輝共鳴', 'Lumen Resonance', '心輝共鳴', 'เรโซแนนซ์ลูเมน', 'Cộng hưởng Lumen'],
  'commander.iron': ['黑鐵共鳴', 'Iron Resonance', '黒鉄共鳴', 'เรโซแนนซ์เหล็กดำ', 'Cộng hưởng Sắt đen'],
  'commander.rift': ['裂隙共鳴', 'Rift Resonance', '裂隙共鳴', 'เรโซแนนซ์รอยแยก', 'Cộng hưởng Khe nứt'],
  'commander.charge': ['蓄能', 'Charge', '蓄積', 'สะสมพลัง', 'Tích năng'],
  'commander.adversity': ['逆境', 'Adversity', '逆境', 'ยามคับขัน', 'Nghịch cảnh'],
  'commander.finisher': ['必殺', 'Finisher', '必殺', 'ท่าไม้ตาย', 'Tất sát'],
  'commander.pureFaction': ['純色陣營', 'Pure Faction', '純色陣営', 'ฝ่ายสีเดียว', 'Phe thuần sắc'],
  'commander.triColor': ['三色指揮', 'Tri-Color Command', '三色指揮', 'บัญชาการสามสี', 'Chỉ huy tam sắc'],
  'trader.haggle': ['殺價', 'Haggle', '値切り', 'ต่อราคา', 'Mặc cả'],
  'trader.bounty': ['賞金', 'Bounty', '賞金', 'เงินรางวัล', 'Tiền thưởng'],
  'trader.crystal': ['結晶', 'Crystals', '結晶', 'คริสตัล', 'Tinh thể'],
  'trader.patrol': ['巡邏', 'Patrol', '巡回', 'ลาดตระเวน', 'Tuần tra'],
  'trader.tower': ['塔', 'Tower', '塔', 'หอคอย', 'Tháp'],
  'trader.regular': ['熟客', 'Regular', '常連', 'ลูกค้าประจำ', 'Khách quen'],
  'trader.belt': ['補給帶', 'Supply Belt', '補給ベルト', 'เข็มขัดเสบียง', 'Đai tiếp tế'],
  'trader.scavenge': ['拾荒', 'Scavenge', '拾い物', 'เก็บของ', 'Nhặt nhạnh'],
  'trader.appraisal': ['鑑價', 'Appraisal', '鑑定', 'ตีราคา', 'Định giá'],
  'trader.bountyHunter': ['賞金獵人', 'Bounty Hunter', '賞金稼ぎ', 'นักล่าเงินรางวัล', 'Thợ săn tiền thưởng'],
  'trader.peddler': ['行商', 'Peddler', '行商', 'พ่อค้าเร่', 'Hàng rong'],
  // What an effect key counts, for "+8 G 記憶卡".
  'key.memoryG': ['{value} G 記憶卡', '{value} G memory card', 'メモリ {value} G', 'การ์ด {value} G', 'Thẻ nhớ {value} G'],
  'key.huntSeconds': ['{value} 秒狩獵', '{value} s hunt time', '狩り {value} 秒', 'ล่า {value} วิ', 'Săn {value} giây'],
  'key.herdExtra': ['{value} 隻群體', '{value} herd partner', '群れ {value} 体', 'ฝูง {value} ตัว', 'Bầy {value} con'],
  'key.gradeHighPercent': ['{value}% S／A 機率', '{value}% S/A chance', 'S／A 率 {value}%', 'โอกาส S/A {value}%', 'Tỉ lệ S/A {value}%'],
  'key.growthPercent': ['{value}% 訓練成長', '{value}% training growth', '訓練成長 {value}%', 'เติบโต {value}%', 'Tăng trưởng {value}%'],
  'key.nightDisturbPercent': ['{value}% 夜間妨礙', '{value}% night disturbance', '夜の妨害 {value}%', 'รบกวนกลางคืน {value}%', 'Quấy đêm {value}%'],
  'key.fusionExpPercent': ['{value}% 融合 EXP', '{value}% fusion EXP', '融合 EXP {value}%', 'EXP หลอม {value}%', 'EXP dung hợp {value}%'],
  'key.fusionLowerLine': ['{value} 低階同線倍率', '{value} lower-stage share', '下位系統 {value}', 'สายต่ำ {value}', 'Dòng thấp {value}'],
  'key.syncExpPercent': ['{value}% 同步 EXP', '{value}% Sync EXP', 'シンクロ EXP {value}%', 'EXP ซิงก์ {value}%', 'EXP đồng bộ {value}%'],
  'key.crystalPercent': ['{value}% 結晶', '{value}% crystals', '結晶 {value}%', 'คริสตัล {value}%', 'Tinh thể {value}%']
};

export const TAMER_TALENT_COPY = deepFreeze(Object.fromEntries(LOCALES.map((locale, i) =>
  [locale, Object.fromEntries(Object.entries(ROWS).map(([key, row]) => [key, row[i]]))])));

export function talentText(key, params = null, locale = getLocale()) {
  const table = TAMER_TALENT_COPY[locale] ?? TAMER_TALENT_COPY['zh-Hant'];
  const template = table[key] ?? TAMER_TALENT_COPY['zh-Hant'][key] ?? key;
  return params ? template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : template;
}

/** "+8 G 記憶卡" for one rank of a node; an effect with no copy yet prints nothing. */
export function talentEffectText(node, ranks = 1, locale = getLocale()) {
  if (!(`key.${node.key}` in TAMER_TALENT_COPY['zh-Hant'])) return '';
  const amount = Math.round(node.per * ranks * 1000) / 1000;
  return talentText(`key.${node.key}`, { value: `${amount > 0 ? '+' : '−'}${Math.abs(amount)}` }, locale);
}
