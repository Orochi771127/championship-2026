// Product-authored presentation copy for the read-only medal detail adapter.
// This copy explains existing runtime rules; it is not recovered original UI.
// Shared item, gate, growth-stage, personality and family names stay in zhHant.js.
import { getLocale } from './locale.js';
import { deepFreeze } from '../contracts/championshipContracts.js';

export const MEDAL_DETAIL_TEXT = deepFreeze({
  'zh-Hant': {
    teamSize: '隊伍人數', participation: '隊員限制', arena: '指定場地', entryFee: '報名費', victoryPrize: '勝利獎金', functions: '實際功能',
    slots: '最多 {count} 隻夥伴', unrestricted: '無額外隊員限制',
    family: '種族須為：{names}（符合其中一種即可）', generation: '限定{value}', attribute: '限定{value}屬性', personality: '限定{value}個性',
    rebirth: '每隻隊員至少轉生為蛋 {count} 次', capacity: '每隻隊員容量至少 {count}',
    plantType: '限定植物類型', mamemonType: '限定豆豆獸類型',
    originDigital: '限定曾登場於《數碼怪獸》的種類', originPendulum: '限定曾登場於《數碼怪獸擺錘機》的種類',
    unknown: '本條件的說明尚待查證', bits: '{value} 位元幣',
    shop: '獲勝後可在商店購買：{names}。須另行付費，不會免費獲得物品。',
    gate: '獲勝後開放狩獵場：{names}。仍依既有入場費規則收費。',
    noDirectUnlock: '計入頭銜收藏；本頭銜沒有獨立的商店或狩獵場解鎖。',
    ageHealth: '所有隊員仍須符合一般成長階段與健康資格；此頁不判定目前隊伍能否參賽。',
    collection: '勝利記入頭銜收藏；升階另依目前階級與指定類別的不同已贏頭銜數判定，並非取得一枚就立即升階。',
    noEquipment: '目前徽章不是可裝備稱號，也不會因持有或展示而直接增加攻防能力。',
    prizeNote: '勝利獎金由比賽結果結算，不是佩戴徽章或重看收藏的獎勵。',
    attributes: { 1: '疫苗', 2: '病毒', 3: '資料' },
    arenas: { 2: '火山', 3: '水域', 4: '冰雪', 5: '沙漠', 8: '競技場' }
  },
  en: {
    teamSize: 'Team size', participation: 'Team restrictions', arena: 'Fixed arena', entryFee: 'Entry fee', victoryPrize: 'Victory prize', functions: 'What it unlocks',
    slots: 'Up to {count} partners', unrestricted: 'No additional team restrictions',
    family: 'Allowed families: {names} (any one qualifies)', generation: '{value} stage only', attribute: '{value} attribute only', personality: '{value} personality only',
    rebirth: 'Each team member must have returned to an egg at least {count} times', capacity: 'Each team member must have a capacity of at least {count}',
    plantType: 'Plant type only', mamemonType: 'Mamemon type only',
    originDigital: 'Only species that appeared in Digital Monster', originPendulum: 'Only species that appeared in Digital Monster Pendulum',
    unknown: 'This condition still needs a verified explanation', bits: '{value} Bits',
    shop: 'Winning makes these available to buy in the shop: {names}. Payment is still required; the items are not granted for free.',
    gate: 'Winning opens these hunt areas: {names}. Normal admission-fee rules still apply.',
    noDirectUnlock: 'Counts toward the title collection; this title has no separate shop or hunt-area unlock.',
    ageHealth: 'All team members must still meet the normal growth-stage and health requirements. This page does not assess your current team.',
    collection: 'Wins are recorded in the title collection. Rank advancement uses your current rank and distinct wins in the required tier, not an automatic rank-up for each medal.',
    noEquipment: 'Medals are not currently equippable titles. Holding or displaying one does not directly boost attack or defense.',
    prizeNote: 'The victory prize is settled by the match result, not by equipping a medal or reopening the collection.',
    attributes: { 1: 'Vaccine', 2: 'Virus', 3: 'Data' },
    arenas: { 2: 'Volcano', 3: 'Water', 4: 'Ice', 5: 'Desert', 8: 'Colosseum' }
  },
  ja: {
    teamSize: 'チーム人数', participation: '出場メンバーの条件', arena: '指定バトル場', entryFee: '参加費', victoryPrize: '勝利賞金', functions: '解放されるもの',
    slots: 'パートナーは最大{count}体', unrestricted: '追加のメンバー制限なし',
    family: '対象種族：{names}（いずれかに該当）', generation: '{value}限定', attribute: '{value}属性限定', personality: '{value}な性格限定',
    rebirth: '各メンバーがタマゴに戻った回数が{count}回以上', capacity: '各メンバーの容量が{count}以上',
    plantType: '植物タイプ限定', mamemonType: 'マメモンタイプ限定',
    originDigital: '「デジタルモンスター」に登場した種類限定', originPendulum: '「デジタルモンスターペンデュラム」に登場した種類限定',
    unknown: 'この条件の説明は確認中です', bits: '{value}ビット',
    shop: '勝利後、ショップで購入可能：{names}。別途支払いが必要で、無料配布ではありません。',
    gate: '勝利後、ハントエリアを解放：{names}。入場料は通常のルールに従います。',
    noDirectUnlock: 'タイトル収集に記録されます。このタイトル固有のショップ商品・ハントエリアの解放はありません。',
    ageHealth: '全メンバーが通常の成長段階・健康条件も満たす必要があります。この画面では現在のチームの出場可否を判定しません。',
    collection: '勝利はタイトル収集に記録されます。昇格は現在のランクと指定区分の異なるタイトルの勝利数で判定され、メダルごとに即昇格するわけではありません。',
    noEquipment: '現在、メダルは装備できる称号ではありません。所持や表示による攻撃力・防御力の直接上昇もありません。',
    prizeNote: '勝利賞金は試合結果で精算されます。メダルの装備やコレクションの再表示による報酬ではありません。',
    attributes: { 1: 'ワクチン', 2: 'ウイルス', 3: 'データ' },
    arenas: { 2: '火山', 3: '水', 4: '氷雪', 5: '砂漠', 8: 'コロシアム' }
  },
  th: {
    teamSize: 'จำนวนสมาชิกทีม', participation: 'เงื่อนไขสมาชิกทีม', arena: 'สนามที่กำหนด', entryFee: 'ค่าสมัคร', victoryPrize: 'เงินรางวัลเมื่อชนะ', functions: 'สิ่งที่ปลดล็อก',
    slots: 'พาร์ตเนอร์สูงสุด {count} ตัว', unrestricted: 'ไม่มีข้อจำกัดสมาชิกทีมเพิ่มเติม',
    family: 'เผ่าที่เข้าร่วมได้: {names} (ตรงกับเผ่าใดเผ่าหนึ่งก็ได้)', generation: 'เฉพาะขั้น{value}', attribute: 'เฉพาะคุณสมบัติ{value}', personality: 'เฉพาะนิสัย{value}',
    rebirth: 'สมาชิกแต่ละตัวต้องกลับเป็นไข่มาแล้วอย่างน้อย {count} ครั้ง', capacity: 'สมาชิกแต่ละตัวต้องมีความจุอย่างน้อย {count}',
    plantType: 'เฉพาะประเภทพืช', mamemonType: 'เฉพาะประเภทมาเมมอน',
    originDigital: 'เฉพาะสายพันธุ์ที่ปรากฏใน Digital Monster', originPendulum: 'เฉพาะสายพันธุ์ที่ปรากฏใน Digital Monster Pendulum',
    unknown: 'คำอธิบายเงื่อนไขนี้ยังต้องได้รับการยืนยัน', bits: '{value} บิต',
    shop: 'เมื่อชนะ จะซื้อสิ่งเหล่านี้ได้ในร้านค้า: {names} ต้องจ่ายเงินซื้อแยก ไม่ได้รับไอเทมฟรี',
    gate: 'เมื่อชนะ จะเปิดพื้นที่ล่า: {names} ยังคงใช้กฎค่าเข้าตามปกติ',
    noDirectUnlock: 'นับรวมในคอลเลกชันตำแหน่ง ตำแหน่งนี้ไม่มีการปลดล็อกสินค้าหรือพื้นที่ล่าเฉพาะ',
    ageHealth: 'สมาชิกทุกตัวยังต้องผ่านเงื่อนไขขั้นการเติบโตและสุขภาพตามปกติ หน้านี้ไม่ได้ประเมินสิทธิ์เข้าร่วมของทีมปัจจุบัน',
    collection: 'ชัยชนะจะบันทึกในคอลเลกชันตำแหน่ง การเลื่อนอันดับขึ้นอยู่กับอันดับปัจจุบันและจำนวนตำแหน่งที่ชนะไม่ซ้ำในระดับที่กำหนด ไม่ได้เลื่อนอันดับทันทีทุกครั้งที่ได้เหรียญ',
    noEquipment: 'ขณะนี้เหรียญไม่ใช่ตำแหน่งที่สวมใส่ได้ การครอบครองหรือแสดงเหรียญไม่ได้เพิ่มพลังโจมตีหรือป้องกันโดยตรง',
    prizeNote: 'เงินรางวัลเมื่อชนะจะจ่ายตามผลการแข่งขัน ไม่ใช่รางวัลจากการสวมเหรียญหรือเปิดคอลเลกชันอีกครั้ง',
    attributes: { 1: 'วัคซีน', 2: 'ไวรัส', 3: 'ข้อมูล' },
    arenas: { 2: 'ภูเขาไฟ', 3: 'น้ำ', 4: 'น้ำแข็ง', 5: 'ทะเลทราย', 8: 'โคลอสเซียม' }
  },
  vi: {
    teamSize: 'Số thành viên', participation: 'Điều kiện đội hình', arena: 'Đấu trường cố định', entryFee: 'Phí tham gia', victoryPrize: 'Tiền thưởng chiến thắng', functions: 'Nội dung được mở khóa',
    slots: 'Tối đa {count} bạn đồng hành', unrestricted: 'Không có giới hạn đội hình bổ sung',
    family: 'Tộc được tham gia: {names} (chỉ cần thuộc một tộc)', generation: 'Chỉ giai đoạn {value}', attribute: 'Chỉ thuộc tính {value}', personality: 'Chỉ tính cách {value}',
    rebirth: 'Mỗi thành viên phải từng trở về trứng ít nhất {count} lần', capacity: 'Mỗi thành viên phải có dung lượng ít nhất {count}',
    plantType: 'Chỉ loại thực vật', mamemonType: 'Chỉ loại Mamemon',
    originDigital: 'Chỉ các loài từng xuất hiện trong Digital Monster', originPendulum: 'Chỉ các loài từng xuất hiện trong Digital Monster Pendulum',
    unknown: 'Mô tả điều kiện này vẫn cần được xác minh', bits: '{value} Bit',
    shop: 'Chiến thắng cho phép mua trong cửa hàng: {names}. Vẫn phải trả tiền riêng, không được tặng vật phẩm miễn phí.',
    gate: 'Chiến thắng mở khu săn: {names}. Vẫn áp dụng quy tắc phí vào cửa thông thường.',
    noDirectUnlock: 'Được tính vào bộ sưu tập danh hiệu; danh hiệu này không mở riêng vật phẩm cửa hàng hay khu săn.',
    ageHealth: 'Mọi thành viên vẫn phải đáp ứng điều kiện thông thường về giai đoạn phát triển và sức khỏe. Trang này không đánh giá đội hình hiện tại.',
    collection: 'Chiến thắng được ghi vào bộ sưu tập danh hiệu. Việc thăng hạng dựa trên hạng hiện tại và số danh hiệu khác nhau đã thắng ở bậc yêu cầu, không tự động thăng hạng sau mỗi huy chương.',
    noEquipment: 'Hiện huy chương không phải danh hiệu có thể trang bị. Sở hữu hoặc trưng bày không trực tiếp tăng tấn công hay phòng thủ.',
    prizeNote: 'Tiền thưởng chiến thắng được quyết toán theo kết quả trận đấu, không phải phần thưởng khi trang bị huy chương hay mở lại bộ sưu tập.',
    attributes: { 1: 'Vắc-xin', 2: 'Vi-rút', 3: 'Dữ liệu' },
    arenas: { 2: 'Núi lửa', 3: 'Nước', 4: 'Băng tuyết', 5: 'Sa mạc', 8: 'Đấu trường' }
  }
});

export function medalDetailText(key, params = {}) {
  const table = MEDAL_DETAIL_TEXT[getLocale()] ?? MEDAL_DETAIL_TEXT['zh-Hant'];
  const template = table[key];
  if (typeof template !== 'string') return null;
  return template.replace(/\{(\w+)\}/g, (match, name) => params[name] === undefined ? match : String(params[name]));
}

export function medalDetailTerm(group, key) {
  const table = MEDAL_DETAIL_TEXT[getLocale()] ?? MEDAL_DETAIL_TEXT['zh-Hant'];
  return table[group]?.[key] ?? null;
}
