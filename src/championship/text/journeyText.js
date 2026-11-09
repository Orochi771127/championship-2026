// Five-locale copy for Journey (征途, OWNER_APPROVED_ADAPTATION 2026-11-10): the
// Sync Tower, the patrol pod and crystal feeding.
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';
import { AWAKENED_FORM_NAMES, AWAKENED_SECOND_TIER_NAMES } from './growthStageTerms.js';

export const JOURNEY_COPY = deepFreeze({
  'zh-Hant': {
    title: '征途', close: '返回對戰選單', tower: '同步之塔', feed: '灌注結晶', zones: '六大戰區', zonesSoon: '六大戰區與故事節點即將開放。',
    'patrol.title': '深網巡航補給艙', 'patrol.rate': '每小時 {rate} 經驗結晶', 'patrol.held': '已累積 {value}', 'patrol.full': '補給艙已滿（最多 {hours} 小時）',
    'patrol.claim': '領取巡航收益', 'patrol.start': '開始巡航', 'patrol.quick': '快速巡航 2 小時', 'patrol.quickUsed': '今日快速巡航已使用',
    'patrol.got': '獲得經驗結晶 +{value}', crystals: '經驗結晶 {value}',
    'tower.best': '最高樓層 {floor}F', 'tower.floor': '{floor}F', 'tower.challenge': '挑戰第 {floor} 層', 'tower.cleared': '已攻略', 'tower.locked': '未開放',
    'tower.chest': '寶箱', 'tower.guardian': '守關首領', 'tower.rewards': '首次攻略獎勵', 'tower.crystals': '經驗結晶 {value}', 'tower.tickets': '轉蛋券 {value}', 'tower.diamonds': '鑽石 {value}',
    'tower.team': '出戰隊伍（最多 3 隻）', 'tower.pick': '請先選擇出戰拍檔。', 'tower.top': '已登上塔頂！',
    'stage.BABY': '幼年期', 'stage.ROOKIE': '成長期', 'stage.CHAMPION': '成熟期',
    'feed.hint': '把經驗結晶灌注給拍檔，直接提升同步等級。', 'feed.next': '升到下一級', 'feed.none': '經驗結晶不足', 'feed.max': '已滿級',
    'result.clear': '第 {floor} 層攻略成功', 'result.fail': '第 {floor} 層挑戰失敗', 'result.next': '乘勝追擊：第 {floor} 層', 'result.retry': '再次挑戰第 {floor} 層'
  },
  en: {
    title: 'Journey', close: 'Back to battle menu', tower: 'Sync Tower', feed: 'Infuse crystals', zones: 'Six zones', zonesSoon: 'The six zones and story nodes open soon.',
    'patrol.title': 'Deep Web Patrol Pod', 'patrol.rate': '{rate} EXP crystals an hour', 'patrol.held': '{value} collected', 'patrol.full': 'Pod full (up to {hours} hours)',
    'patrol.claim': 'Collect patrol', 'patrol.start': 'Start patrol', 'patrol.quick': 'Quick patrol 2 h', 'patrol.quickUsed': 'Quick patrol used today',
    'patrol.got': 'EXP crystals +{value}', crystals: 'EXP crystals {value}',
    'tower.best': 'Best floor {floor}F', 'tower.floor': '{floor}F', 'tower.challenge': 'Challenge floor {floor}', 'tower.cleared': 'Cleared', 'tower.locked': 'Locked',
    'tower.chest': 'Chest', 'tower.guardian': 'Guardian', 'tower.rewards': 'First clear', 'tower.crystals': 'EXP crystals {value}', 'tower.tickets': 'Tickets {value}', 'tower.diamonds': 'Diamonds {value}',
    'tower.team': 'Team (up to 3)', 'tower.pick': 'Choose your partners first.', 'tower.top': 'You reached the top!',
    'stage.BABY': 'Baby', 'stage.ROOKIE': 'Rookie', 'stage.CHAMPION': 'Champion',
    'feed.hint': 'Infuse EXP crystals into a partner to raise its Sync Level.', 'feed.next': 'To next level', 'feed.none': 'Not enough crystals', 'feed.max': 'Max level',
    'result.clear': 'Floor {floor} cleared', 'result.fail': 'Floor {floor} not cleared', 'result.next': 'Press on: floor {floor}', 'result.retry': 'Retry floor {floor}'
  },
  ja: {
    title: '征途', close: 'バトルメニューに戻る', tower: 'シンクロの塔', feed: '結晶を注入', zones: '六大戦区', zonesSoon: '六大戦区とストーリーノードは近日公開。',
    'patrol.title': 'ディープウェブ巡航補給ポッド', 'patrol.rate': '1 時間に経験結晶 {rate}', 'patrol.held': '{value} 蓄積', 'patrol.full': '満タン（最大 {hours} 時間）',
    'patrol.claim': '巡航報酬を受け取る', 'patrol.start': '巡航を開始', 'patrol.quick': 'クイック巡航 2 時間', 'patrol.quickUsed': '本日のクイック巡航は使用済み',
    'patrol.got': '経験結晶 +{value}', crystals: '経験結晶 {value}',
    'tower.best': '最高到達 {floor}F', 'tower.floor': '{floor}F', 'tower.challenge': '{floor} 階に挑戦', 'tower.cleared': '攻略済み', 'tower.locked': '未開放',
    'tower.chest': '宝箱', 'tower.guardian': '階層ボス', 'tower.rewards': '初回攻略報酬', 'tower.crystals': '経験結晶 {value}', 'tower.tickets': 'ガチャ券 {value}', 'tower.diamonds': 'ダイヤ {value}',
    'tower.team': '出撃チーム（最大 3 体）', 'tower.pick': '先にパートナーを選んでください。', 'tower.top': '塔の頂上に到達！',
    'stage.BABY': '幼年期', 'stage.ROOKIE': '成長期', 'stage.CHAMPION': '成熟期',
    'feed.hint': '経験結晶をパートナーに注入してシンクロレベルを上げます。', 'feed.next': '次のレベルへ', 'feed.none': '経験結晶が足りません', 'feed.max': 'レベル最大',
    'result.clear': '{floor} 階攻略成功', 'result.fail': '{floor} 階の挑戦失敗', 'result.next': '勢いのまま：{floor} 階へ', 'result.retry': '{floor} 階に再挑戦'
  },
  th: {
    title: 'การเดินทาง', close: 'กลับเมนูต่อสู้', tower: 'หอซิงก์', feed: 'เติมคริสตัล', zones: 'หกเขตสงคราม', zonesSoon: 'หกเขตสงครามและโหนดเนื้อเรื่องจะเปิดเร็ว ๆ นี้',
    'patrol.title': 'ยานเสบียงลาดตระเวนเว็บลึก', 'patrol.rate': 'คริสตัล EXP {rate} ต่อชั่วโมง', 'patrol.held': 'สะสม {value}', 'patrol.full': 'ยานเต็ม (สูงสุด {hours} ชั่วโมง)',
    'patrol.claim': 'รับผลลาดตระเวน', 'patrol.start': 'เริ่มลาดตระเวน', 'patrol.quick': 'ลาดตระเวนด่วน 2 ชม.', 'patrol.quickUsed': 'วันนี้ใช้ลาดตระเวนด่วนแล้ว',
    'patrol.got': 'คริสตัล EXP +{value}', crystals: 'คริสตัล EXP {value}',
    'tower.best': 'ชั้นสูงสุด {floor}F', 'tower.floor': '{floor}F', 'tower.challenge': 'ท้าชั้นที่ {floor}', 'tower.cleared': 'ผ่านแล้ว', 'tower.locked': 'ยังไม่เปิด',
    'tower.chest': 'หีบ', 'tower.guardian': 'ผู้พิทักษ์ชั้น', 'tower.rewards': 'รางวัลผ่านครั้งแรก', 'tower.crystals': 'คริสตัล EXP {value}', 'tower.tickets': 'ตั๋วกาชา {value}', 'tower.diamonds': 'เพชร {value}',
    'tower.team': 'ทีม (สูงสุด 3 ตัว)', 'tower.pick': 'เลือกคู่หูก่อน', 'tower.top': 'ถึงยอดหอแล้ว!',
    'stage.BABY': 'วัยทารก', 'stage.ROOKIE': 'วัยเติบโต', 'stage.CHAMPION': 'วัยโตเต็มที่',
    'feed.hint': 'เติมคริสตัล EXP ให้คู่หูเพื่อเพิ่มเลเวลซิงก์', 'feed.next': 'ไปเลเวลถัดไป', 'feed.none': 'คริสตัลไม่พอ', 'feed.max': 'เลเวลสูงสุด',
    'result.clear': 'ผ่านชั้นที่ {floor}', 'result.fail': 'ชั้นที่ {floor} ไม่ผ่าน', 'result.next': 'บุกต่อ: ชั้น {floor}', 'result.retry': 'ท้าชั้น {floor} อีกครั้ง'
  },
  vi: {
    title: 'Hành trình', close: 'Về menu chiến đấu', tower: 'Tháp Đồng bộ', feed: 'Truyền tinh thể', zones: 'Sáu chiến khu', zonesSoon: 'Sáu chiến khu và nút cốt truyện sắp mở.',
    'patrol.title': 'Khoang tiếp tế tuần tra web sâu', 'patrol.rate': '{rate} tinh thể EXP mỗi giờ', 'patrol.held': 'Đã tích {value}', 'patrol.full': 'Khoang đầy (tối đa {hours} giờ)',
    'patrol.claim': 'Nhận tuần tra', 'patrol.start': 'Bắt đầu tuần tra', 'patrol.quick': 'Tuần tra nhanh 2 giờ', 'patrol.quickUsed': 'Hôm nay đã dùng tuần tra nhanh',
    'patrol.got': 'Tinh thể EXP +{value}', crystals: 'Tinh thể EXP {value}',
    'tower.best': 'Tầng cao nhất {floor}F', 'tower.floor': '{floor}F', 'tower.challenge': 'Thách đấu tầng {floor}', 'tower.cleared': 'Đã qua', 'tower.locked': 'Chưa mở',
    'tower.chest': 'Rương', 'tower.guardian': 'Hộ vệ tầng', 'tower.rewards': 'Thưởng lần đầu', 'tower.crystals': 'Tinh thể EXP {value}', 'tower.tickets': 'Vé gacha {value}', 'tower.diamonds': 'Kim cương {value}',
    'tower.team': 'Đội (tối đa 3)', 'tower.pick': 'Hãy chọn cộng sự trước.', 'tower.top': 'Bạn đã lên đỉnh tháp!',
    'stage.BABY': 'Ấu niên', 'stage.ROOKIE': 'Trưởng thành', 'stage.CHAMPION': 'Thành thục',
    'feed.hint': 'Truyền tinh thể EXP cho cộng sự để tăng cấp đồng bộ.', 'feed.next': 'Lên cấp tiếp', 'feed.none': 'Không đủ tinh thể', 'feed.max': 'Cấp tối đa',
    'result.clear': 'Đã qua tầng {floor}', 'result.fail': 'Chưa qua tầng {floor}', 'result.next': 'Thừa thắng: tầng {floor}', 'result.retry': 'Thử lại tầng {floor}'
  }
});

export function journeyText(key, values = {}, locale = getLocale()) {
  const lang = Object.hasOwn(JOURNEY_COPY, locale) ? locale : 'zh-Hant';
  let text;
  if (key === 'stage.AWAKENED') text = AWAKENED_FORM_NAMES[lang];
  else if (key === 'stage.ULTIMATE') text = AWAKENED_SECOND_TIER_NAMES[lang];
  else text = JOURNEY_COPY[lang][key] ?? JOURNEY_COPY['zh-Hant'][key] ?? '';
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
