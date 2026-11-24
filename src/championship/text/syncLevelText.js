// Five-locale copy for Sync Level (OWNER_APPROVED_ADAPTATION 2026-11-09): the
// post-battle EXP panel, level badges and the breakthroughs. Each breakthrough
// line says what the level really does in each engine (see productSyncLevel.js).
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';

export const SYNC_LEVEL_COPY = deepFreeze({
  'zh-Hant': {
    'panel.kicker': '心核同步', 'panel.title': '同步經驗', 'level': 'Lv.{level}', 'level.max': 'Lv.MAX',
    'exp.gain': '+{exp} EXP', 'exp.next': '{exp} / {next}', 'levelUp': 'LEVEL UP!', 'levelUp.range': 'Lv.{before} → Lv.{after}',
    'stat.vital': 'HP・TP +{value}%', 'overflow': '滿級溢出經驗轉化為經驗結晶 +{value}', 'capped': 'Lv.{level} 上限・融合同種升星',
    'breakthrough': '心核突破！', 'cap': '本戰同步上限 Lv.{level}', 'crown': '巔峰傳奇金冠',
    'STRIKE': '攻擊潛力進階・數據競技場戰力 +2%', 'GUARD': '防禦潛力進階・數據競技場戰力 +2%',
    'TEMPO': '速度與副屬性潛力進階・數據競技場戰力 +2%', 'SIGNATURE': '攻擊潛力再度進階・數據競技場戰力 +2%',
    'CROWN': '全四維潛力進階・解鎖金冠・溢出經驗轉結晶',
    'STRIKE.title': 'Lv.10 攻勢突破', 'GUARD.title': 'Lv.20 守勢突破', 'TEMPO.title': 'Lv.30 節奏突破', 'SIGNATURE.title': 'Lv.40 必殺突破', 'CROWN.title': 'Lv.50 巔峰共鳴'
  },
  en: {
    'panel.kicker': 'Core Sync', 'panel.title': 'Sync EXP', 'level': 'Lv.{level}', 'level.max': 'Lv.MAX',
    'exp.gain': '+{exp} EXP', 'exp.next': '{exp} / {next}', 'levelUp': 'LEVEL UP!', 'levelUp.range': 'Lv.{before} → Lv.{after}',
    'stat.vital': 'HP · TP +{value}%', 'overflow': 'Overflow EXP became {value} high-purity crystal points', 'capped': 'Lv.{level} cap · fuse its own kind for a star',
    'breakthrough': 'Core breakthrough', 'cap': 'Sync cap this match: Lv.{level}', 'crown': 'Legend crown',
    'STRIKE': 'Attack curve +1 step · Data Arena power +2%', 'GUARD': 'Defense curve +1 step · Data Arena power +2%',
    'TEMPO': 'Speed curve and one more curve +1 step · Data Arena power +2%', 'SIGNATURE': 'Attack curve +1 more step · Data Arena power +2%',
    'CROWN': 'All four curves +1 step · gold crown · overflow EXP becomes crystals',
    'STRIKE.title': 'Lv.10 Strike breakthrough', 'GUARD.title': 'Lv.20 Guard breakthrough', 'TEMPO.title': 'Lv.30 Tempo breakthrough', 'SIGNATURE.title': 'Lv.40 Signature breakthrough', 'CROWN.title': 'Lv.50 Peak'
  },
  ja: {
    'panel.kicker': 'コア同期', 'panel.title': '同期経験値', 'level': 'Lv.{level}', 'level.max': 'Lv.MAX',
    'exp.gain': '+{exp} EXP', 'exp.next': '{exp} / {next}', 'levelUp': 'LEVEL UP!', 'levelUp.range': 'Lv.{before} → Lv.{after}',
    'stat.vital': 'HP・TP +{value}%', 'overflow': 'あふれた経験値が高純度経験結晶 +{value} になりました', 'capped': 'Lv.{level} 上限・同種融合で星アップ',
    'breakthrough': 'コア突破', 'cap': 'この試合の同期上限 Lv.{level}', 'crown': '頂点の伝説金冠',
    'STRIKE': '攻撃カーブ +1 段・データアリーナ戦力 +2%', 'GUARD': '防御カーブ +1 段・データアリーナ戦力 +2%',
    'TEMPO': '速度カーブともう 1 本のカーブ各 +1 段・データアリーナ戦力 +2%', 'SIGNATURE': '攻撃カーブさらに +1 段・データアリーナ戦力 +2%',
    'CROWN': '4 本の能力カーブ各 +1 段・金冠・あふれた経験値は結晶に',
    'STRIKE.title': 'Lv.10 攻勢突破', 'GUARD.title': 'Lv.20 守勢突破', 'TEMPO.title': 'Lv.30 テンポ突破', 'SIGNATURE.title': 'Lv.40 必殺突破', 'CROWN.title': 'Lv.50 頂点'
  },
  th: {
    'panel.kicker': 'ซิงก์แกนใจ', 'panel.title': 'EXP ซิงก์', 'level': 'Lv.{level}', 'level.max': 'Lv.MAX',
    'exp.gain': '+{exp} EXP', 'exp.next': '{exp} / {next}', 'levelUp': 'LEVEL UP!', 'levelUp.range': 'Lv.{before} → Lv.{after}',
    'stat.vital': 'HP・TP +{value}%', 'overflow': 'EXP ส่วนเกินกลายเป็นคริสตัล EXP บริสุทธิ์ +{value}', 'capped': 'ถึงขีด Lv.{level} · หลอมรวมพันธุ์เดียวกันเพื่อเพิ่มดาว',
    'breakthrough': 'ทะลวงแกนใจ', 'cap': 'เพดานซิงก์ของแมตช์นี้ Lv.{level}', 'crown': 'มงกุฎทองตำนาน',
    'STRIKE': 'เส้นโค้งโจมตี +1 ขั้น・พลังใน Data Arena +2%', 'GUARD': 'เส้นโค้งป้องกัน +1 ขั้น・พลังใน Data Arena +2%',
    'TEMPO': 'เส้นโค้งความเร็วและอีกหนึ่งเส้น +1 ขั้น・พลังใน Data Arena +2%', 'SIGNATURE': 'เส้นโค้งโจมตี +1 ขั้นอีกครั้ง・พลังใน Data Arena +2%',
    'CROWN': 'เส้นโค้งทั้งสี่ +1 ขั้น・มงกุฎทอง・EXP ส่วนเกินเป็นคริสตัล',
    'STRIKE.title': 'Lv.10 ทะลวงจู่โจม', 'GUARD.title': 'Lv.20 ทะลวงป้องกัน', 'TEMPO.title': 'Lv.30 ทะลวงจังหวะ', 'SIGNATURE.title': 'Lv.40 ทะลวงท่าไม้ตาย', 'CROWN.title': 'Lv.50 จุดสูงสุด'
  },
  vi: {
    'panel.kicker': 'Đồng bộ lõi', 'panel.title': 'EXP đồng bộ', 'level': 'Lv.{level}', 'level.max': 'Lv.MAX',
    'exp.gain': '+{exp} EXP', 'exp.next': '{exp} / {next}', 'levelUp': 'LEVEL UP!', 'levelUp.range': 'Lv.{before} → Lv.{after}',
    'stat.vital': 'HP・TP +{value}%', 'overflow': 'EXP dư đã thành +{value} điểm tinh thể EXP tinh khiết', 'capped': 'Giới hạn Lv.{level} · dung hợp cùng loài để lên sao',
    'breakthrough': 'Đột phá lõi', 'cap': 'Giới hạn đồng bộ trận này Lv.{level}', 'crown': 'Vương miện huyền thoại',
    'STRIKE': 'Đường tấn công +1 bậc・sức mạnh Data Arena +2%', 'GUARD': 'Đường phòng thủ +1 bậc・sức mạnh Data Arena +2%',
    'TEMPO': 'Đường tốc độ và thêm một đường +1 bậc・sức mạnh Data Arena +2%', 'SIGNATURE': 'Đường tấn công thêm +1 bậc・sức mạnh Data Arena +2%',
    'CROWN': 'Cả bốn đường +1 bậc・vương miện vàng・EXP dư thành tinh thể',
    'STRIKE.title': 'Lv.10 Đột phá tấn công', 'GUARD.title': 'Lv.20 Đột phá phòng thủ', 'TEMPO.title': 'Lv.30 Đột phá nhịp độ', 'SIGNATURE.title': 'Lv.40 Đột phá tuyệt kỹ', 'CROWN.title': 'Lv.50 Đỉnh cao'
  }
});

export function syncText(key, values = {}, locale = getLocale()) {
  const table = Object.hasOwn(SYNC_LEVEL_COPY, locale) ? SYNC_LEVEL_COPY[locale] : SYNC_LEVEL_COPY['zh-Hant'];
  const text = Object.hasOwn(table, key) ? table[key] : (SYNC_LEVEL_COPY['zh-Hant'][key] ?? '');
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
