// Five-locale copy for the three-axis taxonomy (faction / race / element), its resonance passives,
// habitat match and the element chart. Faction names replace the attribute names in display only.
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from './locale.js';

export const TAXONOMY_COPY = deepFreeze({
  'zh-Hant': {
    'faction.LUMEN': '心輝', 'faction.IRON': '黑鐵', 'faction.RIFT': '裂隙', 'faction.NONE': '未定',
    'race.DRAGON': '龍族', 'race.BEAST': '獸族', 'race.AVIAN': '羽翼族', 'race.SYLVAN': '森羅族', 'race.AQUATIC': '海淵族', 'race.MECHANOID': '機巧族', 'race.ASTRAL': '星靈族', 'race.NETHER': '幽冥族', 'race.NONE': '幼生',
    'element.METAL': '金', 'element.WOOD': '木', 'element.EARTH': '土', 'element.WATER': '水', 'element.FIRE': '火', 'element.SUN': '日', 'element.ICE': '冰', 'element.WIND': '風', 'element.THUNDER': '雷', 'element.MOON': '月',
    'ring.EARTHLY': '地上五行環', 'ring.CELESTIAL': '天上天象環',
    'axis.HEAT': '熱', 'axis.COLD': '冷', 'axis.LIGHT': '光', 'axis.DARK': '暗', 'axis.THUNDER': '雷',
    'label.faction': '陣營', 'label.race': '種族', 'label.element': '屬性', 'label.points': '{faction}點數',
    'chart.open': '屬性相剋表', 'chart.title': '屬性相剋表', 'chart.close': '關閉', 'chart.effective': '剋制 ×1.5', 'chart.resisted': '被剋 ×0.75',
    'chart.physical': '物理招式不參與屬性相剋。', 'chart.axes': '抗性條對應', 'chart.focus': '當前拍檔【{element}】 剋制【{beats}】(×1.5) ｜ 被【{beatenBy}】剋制 (×0.75)',
    'chart.pick': '點選環上的屬性，查看它的剋制關係。',
    'resonance.LUMEN': '心輝守護', 'resonance.IRON': '黑鐵超頻', 'resonance.RIFT': '裂隙狂暴', 'resonance.TRI': '三元心核協同',
    'resonance.LUMEN.desc': '承受傷害 −10%，每 5 秒回復 1% 生命。', 'resonance.IRON.desc': '招式冷卻 −10%；自動對戰開局技力 +20%、防禦 +8%。',
    'resonance.RIFT.desc': '暴擊率 +10%，必殺技傷害 +15%。', 'resonance.TRI.desc': '攻擊、防禦 +8%；勝利的位元幣與親密度 +15%。',
    'resonance.title': '陣營共鳴', 'resonance.none': '同陣營 2 隻，或三陣營各 1 隻時啟動。',
    'habitat.badge': '種族適居（{race}）', 'habitat.desc': '養成成長 +20%、散步尋寶 +25%、心情提升。', 'habitat.common': '通用照護區'
  },
  en: {
    'faction.LUMEN': 'Lumen', 'faction.IRON': 'Black Iron', 'faction.RIFT': 'Rift', 'faction.NONE': 'Unaligned',
    'race.DRAGON': 'Dragon', 'race.BEAST': 'Beast', 'race.AVIAN': 'Avian', 'race.SYLVAN': 'Sylvan', 'race.AQUATIC': 'Aquatic', 'race.MECHANOID': 'Mechanoid', 'race.ASTRAL': 'Astral', 'race.NETHER': 'Nether', 'race.NONE': 'Fledgling',
    'element.METAL': 'Metal', 'element.WOOD': 'Wood', 'element.EARTH': 'Earth', 'element.WATER': 'Water', 'element.FIRE': 'Fire', 'element.SUN': 'Sun', 'element.ICE': 'Ice', 'element.WIND': 'Wind', 'element.THUNDER': 'Thunder', 'element.MOON': 'Moon',
    'ring.EARTHLY': 'Earthly Ring', 'ring.CELESTIAL': 'Celestial Ring',
    'axis.HEAT': 'Heat', 'axis.COLD': 'Cold', 'axis.LIGHT': 'Light', 'axis.DARK': 'Dark', 'axis.THUNDER': 'Thunder',
    'label.faction': 'Faction', 'label.race': 'Race', 'label.element': 'Element', 'label.points': '{faction} points',
    'chart.open': 'Element chart', 'chart.title': 'Element chart', 'chart.close': 'Close', 'chart.effective': 'Strong ×1.5', 'chart.resisted': 'Weak ×0.75',
    'chart.physical': 'Physical moves ignore elements.', 'chart.axes': 'Resistance bars', 'chart.focus': 'This partner [{element}]: strong vs [{beats}] (×1.5) | weak to [{beatenBy}] (×0.75)',
    'chart.pick': 'Tap an element on a ring to see its matchups.',
    'resonance.LUMEN': 'Lumen Aegis', 'resonance.IRON': 'Black Iron Overclock', 'resonance.RIFT': 'Rift Frenzy', 'resonance.TRI': 'Tri-Core Harmony',
    'resonance.LUMEN.desc': 'Damage taken −10%; recover 1% HP every 5 seconds.', 'resonance.IRON.desc': 'Move cooldowns −10%; auto battles start with +20% TP and +8% defence.',
    'resonance.RIFT.desc': 'Critical chance +10%; signature move damage +15%.', 'resonance.TRI.desc': 'Attack and defence +8%; +15% bits and bond after a win.',
    'resonance.title': 'Faction resonance', 'resonance.none': 'Active with two of one faction, or one of each.',
    'habitat.badge': 'Habitat match ({race})', 'habitat.desc': 'Training growth +20%, stroll finds +25%, better mood.', 'habitat.common': 'Shared care area'
  },
  ja: {
    'faction.LUMEN': '心輝', 'faction.IRON': '黒鉄', 'faction.RIFT': '裂隙', 'faction.NONE': '未定',
    'race.DRAGON': '竜族', 'race.BEAST': '獣族', 'race.AVIAN': '羽翼族', 'race.SYLVAN': '森羅族', 'race.AQUATIC': '海淵族', 'race.MECHANOID': '機巧族', 'race.ASTRAL': '星霊族', 'race.NETHER': '幽冥族', 'race.NONE': '幼生',
    'element.METAL': '金', 'element.WOOD': '木', 'element.EARTH': '土', 'element.WATER': '水', 'element.FIRE': '火', 'element.SUN': '日', 'element.ICE': '氷', 'element.WIND': '風', 'element.THUNDER': '雷', 'element.MOON': '月',
    'ring.EARTHLY': '地上五行環', 'ring.CELESTIAL': '天上天象環',
    'axis.HEAT': '熱', 'axis.COLD': '冷', 'axis.LIGHT': '光', 'axis.DARK': '闇', 'axis.THUNDER': '雷',
    'label.faction': '陣営', 'label.race': '種族', 'label.element': '属性', 'label.points': '{faction}ポイント',
    'chart.open': '属性相性表', 'chart.title': '属性相性表', 'chart.close': '閉じる', 'chart.effective': '有利 ×1.5', 'chart.resisted': '不利 ×0.75',
    'chart.physical': '物理技は属性相性の対象外です。', 'chart.axes': '耐性バーの対応', 'chart.focus': 'このパートナー【{element}】 【{beats}】に有利 (×1.5) ｜ 【{beatenBy}】に不利 (×0.75)',
    'chart.pick': '環の属性をタップすると相性を確認できます。',
    'resonance.LUMEN': '心輝の守護', 'resonance.IRON': '黒鉄オーバークロック', 'resonance.RIFT': '裂隙の狂乱', 'resonance.TRI': '三元心核の調和',
    'resonance.LUMEN.desc': '被ダメージ −10%、5 秒ごとに HP を 1% 回復。', 'resonance.IRON.desc': '技のクールダウン −10%。オートバトルは開始時 TP +20%・防御 +8%。',
    'resonance.RIFT.desc': 'クリティカル率 +10%、必殺技ダメージ +15%。', 'resonance.TRI.desc': '攻撃・防御 +8%。勝利時のビットと親密度 +15%。',
    'resonance.title': '陣営共鳴', 'resonance.none': '同じ陣営が 2 体、または 3 陣営が 1 体ずつで発動。',
    'habitat.badge': '種族適所（{race}）', 'habitat.desc': '育成の伸び +20%、散歩の発見 +25%、機嫌アップ。', 'habitat.common': '共用ケアエリア'
  },
  th: {
    'faction.LUMEN': 'ลูเมน', 'faction.IRON': 'เหล็กดำ', 'faction.RIFT': 'รอยแยก', 'faction.NONE': 'ไม่สังกัด',
    'race.DRAGON': 'เผ่ามังกร', 'race.BEAST': 'เผ่าสัตว์ป่า', 'race.AVIAN': 'เผ่าปีก', 'race.SYLVAN': 'เผ่าพงไพร', 'race.AQUATIC': 'เผ่าห้วงน้ำ', 'race.MECHANOID': 'เผ่าจักรกล', 'race.ASTRAL': 'เผ่าดวงดาว', 'race.NETHER': 'เผ่ายมโลก', 'race.NONE': 'วัยเยาว์',
    'element.METAL': 'โลหะ', 'element.WOOD': 'ไม้', 'element.EARTH': 'ดิน', 'element.WATER': 'น้ำ', 'element.FIRE': 'ไฟ', 'element.SUN': 'ตะวัน', 'element.ICE': 'น้ำแข็ง', 'element.WIND': 'ลม', 'element.THUNDER': 'สายฟ้า', 'element.MOON': 'จันทรา',
    'ring.EARTHLY': 'วงธาตุพิภพ', 'ring.CELESTIAL': 'วงธาตุนภา',
    'axis.HEAT': 'ร้อน', 'axis.COLD': 'เย็น', 'axis.LIGHT': 'แสง', 'axis.DARK': 'มืด', 'axis.THUNDER': 'สายฟ้า',
    'label.faction': 'ฝ่าย', 'label.race': 'เผ่า', 'label.element': 'ธาตุ', 'label.points': 'แต้ม{faction}',
    'chart.open': 'ตารางธาตุ', 'chart.title': 'ตารางธาตุ', 'chart.close': 'ปิด', 'chart.effective': 'ได้เปรียบ ×1.5', 'chart.resisted': 'เสียเปรียบ ×0.75',
    'chart.physical': 'ท่ากายภาพไม่นับธาตุ', 'chart.axes': 'แถบต้านทาน', 'chart.focus': 'พาร์ตเนอร์นี้ [{element}] ได้เปรียบ [{beats}] (×1.5) | เสียเปรียบ [{beatenBy}] (×0.75)',
    'chart.pick': 'แตะธาตุบนวงเพื่อดูความได้เปรียบ',
    'resonance.LUMEN': 'ปราการลูเมน', 'resonance.IRON': 'เหล็กดำโอเวอร์คล็อก', 'resonance.RIFT': 'คลั่งรอยแยก', 'resonance.TRI': 'สามแกนประสาน',
    'resonance.LUMEN.desc': 'รับความเสียหาย −10% ฟื้น HP 1% ทุก 5 วินาที', 'resonance.IRON.desc': 'คูลดาวน์ท่า −10% การต่อสู้อัตโนมัติเริ่มด้วย TP +20% และป้องกัน +8%',
    'resonance.RIFT.desc': 'โอกาสคริติคอล +10% ท่าไม้ตายแรงขึ้น +15%', 'resonance.TRI.desc': 'โจมตีและป้องกัน +8% บิตและความผูกพันหลังชนะ +15%',
    'resonance.title': 'การประสานฝ่าย', 'resonance.none': 'ทำงานเมื่อมีฝ่ายเดียวกัน 2 ตัว หรือครบทั้ง 3 ฝ่าย',
    'habitat.badge': 'ถิ่นที่เหมาะ ({race})', 'habitat.desc': 'การเติบโต +20% ของที่พบระหว่างเดินเล่น +25% อารมณ์ดีขึ้น', 'habitat.common': 'พื้นที่ดูแลรวม'
  },
  vi: {
    'faction.LUMEN': 'Tâm Huy', 'faction.IRON': 'Hắc Thiết', 'faction.RIFT': 'Khe Nứt', 'faction.NONE': 'Chưa định',
    'race.DRAGON': 'Long tộc', 'race.BEAST': 'Thú tộc', 'race.AVIAN': 'Vũ Dực tộc', 'race.SYLVAN': 'Sâm La tộc', 'race.AQUATIC': 'Hải Uyên tộc', 'race.MECHANOID': 'Cơ Xảo tộc', 'race.ASTRAL': 'Tinh Linh tộc', 'race.NETHER': 'U Minh tộc', 'race.NONE': 'Ấu sinh',
    'element.METAL': 'Kim', 'element.WOOD': 'Mộc', 'element.EARTH': 'Thổ', 'element.WATER': 'Thủy', 'element.FIRE': 'Hỏa', 'element.SUN': 'Nhật', 'element.ICE': 'Băng', 'element.WIND': 'Phong', 'element.THUNDER': 'Lôi', 'element.MOON': 'Nguyệt',
    'ring.EARTHLY': 'Vòng Ngũ Hành', 'ring.CELESTIAL': 'Vòng Thiên Tượng',
    'axis.HEAT': 'Nhiệt', 'axis.COLD': 'Lạnh', 'axis.LIGHT': 'Sáng', 'axis.DARK': 'Tối', 'axis.THUNDER': 'Sấm',
    'label.faction': 'Phe', 'label.race': 'Chủng tộc', 'label.element': 'Thuộc tính', 'label.points': 'Điểm {faction}',
    'chart.open': 'Bảng tương khắc', 'chart.title': 'Bảng tương khắc', 'chart.close': 'Đóng', 'chart.effective': 'Khắc ×1.5', 'chart.resisted': 'Bị khắc ×0.75',
    'chart.physical': 'Chiêu vật lý không tính tương khắc.', 'chart.axes': 'Thanh kháng', 'chart.focus': 'Bạn đồng hành [{element}]: khắc [{beats}] (×1.5) | bị [{beatenBy}] khắc (×0.75)',
    'chart.pick': 'Chạm vào thuộc tính trên vòng để xem tương khắc.',
    'resonance.LUMEN': 'Tâm Huy Hộ Thể', 'resonance.IRON': 'Hắc Thiết Tăng Tốc', 'resonance.RIFT': 'Khe Nứt Cuồng Nộ', 'resonance.TRI': 'Tam Tâm Hòa Hợp',
    'resonance.LUMEN.desc': 'Sát thương nhận −10%, hồi 1% HP mỗi 5 giây.', 'resonance.IRON.desc': 'Hồi chiêu −10%; trận tự động bắt đầu với TP +20% và phòng thủ +8%.',
    'resonance.RIFT.desc': 'Tỉ lệ chí mạng +10%, sát thương chiêu tất sát +15%.', 'resonance.TRI.desc': 'Tấn công và phòng thủ +8%; bit và độ thân thiết khi thắng +15%.',
    'resonance.title': 'Cộng hưởng phe', 'resonance.none': 'Kích hoạt khi có 2 cùng phe, hoặc đủ cả 3 phe.',
    'habitat.badge': 'Môi trường hợp ({race})', 'habitat.desc': 'Tăng trưởng huấn luyện +20%, nhặt đồ khi dạo +25%, tâm trạng tốt hơn.', 'habitat.common': 'Khu chăm sóc chung'
  }
});
export function taxonomyText(key, values = {}, locale = getLocale()) {
  const table = Object.hasOwn(TAXONOMY_COPY, locale) ? TAXONOMY_COPY[locale] : TAXONOMY_COPY['zh-Hant'];
  const text = Object.hasOwn(table, key) ? table[key] : '';
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
