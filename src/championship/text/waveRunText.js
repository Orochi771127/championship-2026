// Five-locale copy for the story and challenge wave runs (WAVE_RUN_20261118). Pictures say most of it; the words are
// numbers first and a few short keys (in-game copy short: ≤24 characters a line, no sentences).
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from './locale.js';

const LOCALES = ['zh-Hant', 'en', 'ja', 'th', 'vi'];
const UI = {
  'mode.story': ['故事模式', 'Story', 'ストーリー', 'โหมดเรื่องราว', 'Cốt truyện'],
  'mode.challenge': ['挑戰模式', 'Challenge', 'チャレンジ', 'โหมดท้าทาย', 'Thử thách'],
  'mode.practice': ['練習', 'Practice', '練習', 'ฝึกซ้อม', 'Luyện tập'],
  'wave': ['第 {n} 波', 'Wave {n}', '第 {n} 波', 'คลื่น {n}', 'Đợt {n}'],
  'waveOf': ['第 {n}/{total} 波', 'Wave {n}/{total}', '第 {n}/{total} 波', 'คลื่น {n}/{total}', 'Đợt {n}/{total}'],
  'foesLeft': ['敵 ×{n}', 'Foes ×{n}', '敵 ×{n}', 'ศัตรู ×{n}', 'Địch ×{n}'],
  'boss': ['頭目', 'Boss', 'ボス', 'บอส', 'Trùm'],
  'next': ['下一波', 'Next wave', '次の波', 'คลื่นถัดไป', 'Đợt tiếp'],
  'finish': ['完成', 'Done', '完了', 'เสร็จ', 'Xong'],
  'leave': ['帶著戰利品離場', 'Leave with loot', '戦利品を持って退場', 'ออกพร้อมของ', 'Rời đi với chiến lợi phẩm'],
  'continue': ['繼續挑戰', 'Fight on', '挑戦を続ける', 'สู้ต่อ', 'Đánh tiếp'],
  'cleared': ['已過 {n} 波', '{n} waves cleared', '{n} 波クリア', 'ผ่าน {n} คลื่น', 'Qua {n} đợt'],
  'nextThreat': ['下一波', 'Next', '次', 'ถัดไป', 'Tiếp'],
  'stronger': ['+{n}%', '+{n}%', '+{n}%', '+{n}%', '+{n}%'],
  'unpicked': ['還有 {n} 個沒撿', '{n} left on the ground', 'あと {n} 個', 'เหลือ {n} ชิ้น', 'Còn {n} món'],
  'again': ['再按一次離場', 'Tap again to leave', 'もう一度で退場', 'แตะอีกครั้งเพื่อออก', 'Chạm lại để rời'],
  'full': ['滿了', 'Full', 'いっぱい', 'เต็มแล้ว', 'Đầy'],
  'saveFailed': ['沒存到，再按一次', 'Not saved, tap again', '保存失敗 もう一度', 'บันทึกไม่ได้ แตะอีกครั้ง', 'Chưa lưu, chạm lại'],
  'magnet': ['磁吸', 'Magnet', 'マグネット', 'แม่เหล็ก', 'Nam châm'],
  'over.LEFT': ['帶回戰利品', 'Loot brought home', '戦利品を持ち帰った', 'นำของกลับบ้าน', 'Mang về chiến lợi phẩm'],
  'over.DEFEATED': ['挑戰結束', 'Run over', '挑戦終了', 'จบการท้าทาย', 'Kết thúc'],
  'over.CLEARED': ['全部擊破', 'All waves cleared', '全波クリア', 'ผ่านทุกคลื่น', 'Qua hết các đợt'],
  'over.ABANDONED': ['已放棄', 'Abandoned', '中断', 'ยกเลิก', 'Đã bỏ'],
  'back': ['返回', 'Back', '戻る', 'กลับ', 'Quay lại'],
  'retry': ['重試', 'Retry', 'リトライ', 'ลองใหม่', 'Thử lại'],
  'loadFailed': ['戰鬥沒開成', 'Battle did not start', 'バトル開始失敗', 'เริ่มการต่อสู้ไม่ได้', 'Không vào được trận'],
  'best': ['最佳 {n} 波', 'Best {n} waves', '最高 {n} 波', 'ดีที่สุด {n} คลื่น', 'Tốt nhất {n} đợt'],
  'start': ['出發', 'Go', '出発', 'ไป', 'Đi'],
  'team': ['出戰 {n}', 'Team {n}', '出撃 {n}', 'ทีม {n}', 'Đội {n}'],
  'resume': ['接著打 第 {n} 波', 'Resume wave {n}', '第 {n} 波から再開', 'ต่อคลื่น {n}', 'Tiếp đợt {n}']
};
export const WAVE_RUN_COPY = deepFreeze(Object.fromEntries(LOCALES.map((locale, i) => [locale,
  Object.fromEntries(Object.entries(UI).map(([key, row]) => [key, row[i]]))])));

export function waveRunText(key, params = null, locale = getLocale()) {
  const table = WAVE_RUN_COPY[locale] ?? WAVE_RUN_COPY['zh-Hant'];
  const template = table[key] ?? WAVE_RUN_COPY['zh-Hant'][key] ?? key;
  return params ? template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : template;
}
