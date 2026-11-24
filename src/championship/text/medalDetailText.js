// Product-authored presentation copy for the read-only medal detail adapter.
// This copy explains existing runtime rules; it is not recovered original UI.
// Shared item, gate, growth-stage, personality and family names stay in zhHant.js.
import { getLocale } from './locale.js';
import { deepFreeze } from '../contracts/championshipContracts.js';

export const MEDAL_DETAIL_TEXT = deepFreeze({
  'zh-Hant': {
    teamSize: '出戰名額', participation: '出賽資格', arena: '指定賽場', entryFee: '報名費', victoryPrize: '奪冠獎金', functions: '奪冠解鎖',
    slots: '最多 {count} 隻拍檔', unrestricted: '無額外隊員限制',
    family: '限定種族：{names}（符合其一即可）', generation: '限定{value}', attribute: '限定{value}陣營', personality: '限定{value}個性',
    rebirth: '每隻隊員須轉生為蛋至少 {count} 次', capacity: '每隻隊員容量須達 {count} 以上',
    plantType: '限定植物類型', mamemonType: '限定參賽種類：{names}',
    originDigital: '限定起源組：{names}', originPendulum: '限定擺錘組：{names}',
    unknown: '神秘賽事條件', bits: '{value} 位元幣',
    shop: '奪冠上架商店：{names}（須於商店購買）',
    gate: '奪冠解鎖狩獵場：{names}（照常收取出發入場費）',
    noDirectUnlock: '收錄至榮譽頭銜殿堂（無額外商店或狩獵場解鎖）',
    ageHealth: '出戰拍檔須處於健康且可參賽的成長階段。',
    collection: '奪冠即收錄至頭銜殿堂，累積指定階級的頭銜數即可晉升馴獸師階級。',
    noEquipment: '徽章為純榮譽收藏品，不提供額外攻防加成。',
    prizeNote: '奪冠獎金於賽後立即結算入帳。',
    attributes: { 1: '心輝', 2: '裂隙', 3: '黑鐵' },
    arenas: { 2: '火山', 3: '水域', 4: '冰雪', 5: '沙漠', 8: '競技場' }
  },
  en: {
    teamSize: 'Team size', participation: 'Eligibility', arena: 'Fixed arena', entryFee: 'Entry fee', victoryPrize: 'Champion prize', functions: 'Title unlocks',
    slots: 'Up to {count} partners', unrestricted: 'No extra team restrictions',
    family: 'Allowed families: {names} (any one qualifies)', generation: '{value} only', attribute: '{value} faction only', personality: '{value} personality only',
    rebirth: 'Each member must have rebirthed as an egg at least {count} times', capacity: 'Each member needs at least {count} capacity',
    plantType: 'Plant type only', mamemonType: 'Eligible species: {names}',
    originDigital: 'Origin group: {names}', originPendulum: 'Pendulum group: {names}',
    unknown: 'Special event rules', bits: '{value} Bits',
    shop: 'Unlocks in Shop: {names} (purchase required)',
    gate: 'Opens Hunt Area: {names} (standard entry fee applies)',
    noDirectUnlock: 'Recorded in your Hall of Titles (no extra shop or hunt unlocks)',
    ageHealth: 'All entrants must be healthy and at a battle-ready growth stage.',
    collection: 'Victories are enshrined in your Hall of Titles; collecting enough tier titles unlocks your next Tamer Rank.',
    noEquipment: 'Medals are pure honor collectibles and grant no direct combat stat bonuses.',
    prizeNote: 'Prize money is paid straight into your wallet after victory.',
    attributes: { 1: 'Lumen', 2: 'Rift', 3: 'Black Iron' },
    arenas: { 2: 'Volcano', 3: 'Water', 4: 'Ice', 5: 'Desert', 8: 'Colosseum' }
  },
  ja: {
    teamSize: '出場枠', participation: '出場条件', arena: '指定ステージ', entryFee: '参加費', victoryPrize: '優勝賞金', functions: '優勝特典',
    slots: 'パートナー最大{count}体', unrestricted: '追加のメンバー制限なし',
    family: '対象種族：{names}（いずれか該当）', generation: '{value}限定', attribute: '{value}陣営限定', personality: '{value}な性格限定',
    rebirth: '各メンバーがタマゴ転生{count}回以上', capacity: '各メンバーの容量{count}以上',
    plantType: '植物タイプ限定', mamemonType: '対象種：{names}',
    originDigital: '起源グループ：{names}', originPendulum: '振り子グループ：{names}',
    unknown: '特殊大会ルール', bits: '{value} ビット',
    shop: '優勝でショップ入荷：{names}（ショップで購入可能）',
    gate: '優勝でハントエリア開放：{names}（通常の入場料がかかります）',
    noDirectUnlock: '栄誉タイトル殿堂に記録（ショップやエリアの追加開放なし）',
    ageHealth: '出場するパートナーは健康で、バトル可能な成長段階である必要があります。',
    collection: '優勝するとタイトル殿堂に刻まれ、指定区分のタイトルを集めるとテイマーランクが上がります。',
    noEquipment: 'メダルは栄誉コレクション専用で、攻撃力・防御力などの直接強化はありません。',
    prizeNote: '優勝賞金は試合勝利後すぐに受け取れます。',
    attributes: { 1: '心輝', 2: '裂隙', 3: '黒鉄' },
    arenas: { 2: '火山', 3: '水域', 4: '氷雪', 5: '砂漠', 8: 'コロシアム' }
  },
  th: {
    teamSize: 'โควตาลงสนาม', participation: 'คุณสมบัติเข้าแข่ง', arena: 'สนามประจำรายการ', entryFee: 'ค่าสมัคร', victoryPrize: 'เงินรางวัลแชมป์', functions: 'รางวัลปลดล็อก',
    slots: 'พาร์ตเนอร์สูงสุด {count} ตัว', unrestricted: 'ไม่มีข้อจำกัดสมาชิกทีมเพิ่มเติม',
    family: 'เผ่าที่เข้าร่วมได้: {names} (ตรงเผ่าใดเผ่าหนึ่งก็ได้)', generation: 'เฉพาะ{value}', attribute: 'เฉพาะฝ่าย{value}', personality: 'เฉพาะนิสัย{value}',
    rebirth: 'สมาชิกแต่ละตัวต้องกลับเป็นไข่อย่างน้อย {count} ครั้ง', capacity: 'สมาชิกแต่ละตัวต้องมีความจุอย่างน้อย {count}',
    plantType: 'เฉพาะประเภทพืช', mamemonType: 'สายพันธุ์ที่เข้าร่วมได้: {names}',
    originDigital: 'กลุ่มต้นกำเนิด: {names}', originPendulum: 'กลุ่มลูกตุ้ม: {names}',
    unknown: 'กติกาพิเศษประจำรายการ', bits: '{value} บิต',
    shop: 'คว้าแชมป์เพื่อปลดล็อกในร้านค้า: {names} (ต้องซื้อในร้านค้า)',
    gate: 'คว้าแชมป์เพื่อเปิดพื้นที่ล่า: {names} (เก็บค่าเข้าตามปกติ)',
    noDirectUnlock: 'บันทึกลงหอเกียรติยศตำแหน่ง (ไม่มีการปลดล็อกร้านค้าหรือพื้นที่ล่าเพิ่มเติม)',
    ageHealth: 'พาร์ตเนอร์ที่ลงสนามต้องมีสุขภาพแข็งแรงและอยู่ในขั้นเติบโตที่ลงแข่งได้',
    collection: 'ชัยชนะจะถูกบันทึกลงหอเกียรติยศ สะสมตำแหน่งครบตามระดับเพื่อเลื่อนแรงก์เทมเมอร์',
    noEquipment: 'เหรียญรางวัลเป็นของสะสมเกียรติยศ ไม่มีผลเพิ่มพลังโจมตีหรือป้องกันโดยตรง',
    prizeNote: 'เงินรางวัลแชมป์จะโอนเข้ากระเป๋าทันทีหลังจบการแข่งขัน',
    attributes: { 1: 'ลูเมน', 2: 'รอยแยก', 3: 'เหล็กดำ' },
    arenas: { 2: 'ภูเขาไฟ', 3: 'น้ำ', 4: 'น้ำแข็ง', 5: 'ทะเลทราย', 8: 'โคลอสเซียม' }
  },
  vi: {
    teamSize: 'Suất ra sân', participation: 'Điều kiện dự giải', arena: 'Đấu trường cố định', entryFee: 'Phí ghi danh', victoryPrize: 'Thưởng vô địch', functions: 'Phần thưởng mở khóa',
    slots: 'Tối đa {count} bạn đồng hành', unrestricted: 'Không có giới hạn đội hình bổ sung',
    family: 'Tộc được tham gia: {names} (chỉ cần thuộc một tộc)', generation: 'Chỉ {value}', attribute: 'Chỉ phe {value}', personality: 'Chỉ tính cách {value}',
    rebirth: 'Mỗi thành viên phải từng tái sinh thành trứng ít nhất {count} lần', capacity: 'Mỗi thành viên phải có dung lượng từ {count} trở lên',
    plantType: 'Chỉ loại thực vật', mamemonType: 'Các loài được dự: {names}',
    originDigital: 'Nhóm Khởi nguyên: {names}', originPendulum: 'Nhóm Con lắc: {names}',
    unknown: 'Thể lệ đặc biệt của giải đấu', bits: '{value} Bit',
    shop: 'Vô địch để mở bán tại cửa hàng: {names} (mua tại cửa hàng)',
    gate: 'Vô địch để mở khóa khu săn: {names} (áp dụng phí vào cửa thông thường)',
    noDirectUnlock: 'Ghi danh vào Đại sảnh Danh hiệu (không mở thêm cửa hàng hay khu săn)',
    ageHealth: 'Bạn đồng hành ra sân cần khỏe mạnh và ở giai đoạn trưởng thành đủ điều kiện thi đấu.',
    collection: 'Chiến thắng được lưu tại Đại sảnh Danh hiệu; tích lũy đủ danh hiệu theo bậc để thăng hạng Tamer.',
    noEquipment: 'Huy chương là vật phẩm sưu tầm danh dự, không trực tiếp cộng chỉ số công thủ.',
    prizeNote: 'Tiền thưởng vô địch được cộng thẳng vào ví ngay sau khi thắng trận.',
    attributes: { 1: 'Tâm Huy', 2: 'Khe Nứt', 3: 'Hắc Thiết' },
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
