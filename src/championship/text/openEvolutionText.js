// Five-locale copy for Open Blind-Box Evolution v1 (2026-11-21):
// vivid aura sensing (hiding undiscovered species names) and honest post-evolution causal chronicles.
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';

export const OPEN_EVOLUTION_COPY = deepFreeze({
  'zh-Hant': {
    'aura.title': '進化氣息感應',
    'aura.summary': '{race} · {faction} · {care}',
    'aura.raceValue': '{race}氣息 {points}',
    'aura.raceNone': '未成形氣息',
    'aura.factionValue': '{faction}陣營',
    'aura.factionNone': '無偏向陣營',
    'aura.pool': '感應到 {count} 種可能形態',
    'aura.unknownBadge': '✨ 含 {count} 種未知新拍檔',
    'aura.allKnown': '皆為已登錄形態',
    'aura.knownEchoes': '已知共鳴：{names}',
    'aura.tip': '放進不同育成籠累積種族與陣營點數，可引導出截然不同的進化盲盒！',
    'care.PRISTINE': '細心育成',
    'care.STEADY': '自然育成',
    'care.WILD': '狂野變異',
    'causal.firstDiscovery': '✨ 首次發現！',
    'causal.line': '{first}{race} × {faction} × {care}（失誤 {mistakes}）'
  },
  en: {
    'aura.title': 'Evolution aura sense',
    'aura.summary': '{race} · {faction} · {care}',
    'aura.raceValue': '{race} aura {points}',
    'aura.raceNone': 'Unshaped aura',
    'aura.factionValue': '{faction} faction',
    'aura.factionNone': 'Neutral faction',
    'aura.pool': '{count} possible forms sensed',
    'aura.unknownBadge': '✨ {count} undiscovered form(s)',
    'aura.allKnown': 'All resonant forms discovered',
    'aura.knownEchoes': 'Known echoes: {names}',
    'aura.tip': 'Different cages build different race and faction points to steer your blind-box evolution.',
    'care.PRISTINE': 'Pristine care',
    'care.STEADY': 'Steady care',
    'care.WILD': 'Wild care',
    'causal.firstDiscovery': '✨ First discovery! ',
    'causal.line': '{first}{race} × {faction} × {care} (mistakes {mistakes})'
  },
  ja: {
    'aura.title': '進化の気配センサー',
    'aura.summary': '{race}・{faction}・{care}',
    'aura.raceValue': '{race}の気配 {points}',
    'aura.raceNone': '未形成の気配',
    'aura.factionValue': '{faction}陣営',
    'aura.factionNone': '中立陣営',
    'aura.pool': '{count} 種の進化候補を感知',
    'aura.unknownBadge': '✨ 未知のパートナー {count} 種を含む',
    'aura.allKnown': 'すべて登録済みの姿',
    'aura.knownEchoes': '既知の共鳴：{names}',
    'aura.tip': '育てるケージを変えると種族・陣営ポイントが変わり、全く違う進化へ導けます。',
    'care.PRISTINE': 'ていねい育成',
    'care.STEADY': '自然育成',
    'care.WILD': 'ワイルド変異',
    'causal.firstDiscovery': '✨ 初発見！',
    'causal.line': '{first}{race} × {faction} × {care}（ミス {mistakes}）'
  },
  th: {
    'aura.title': 'สัมผัสกลิ่นอายวิวัฒนาการ',
    'aura.summary': '{race} · {faction} · {care}',
    'aura.raceValue': 'กลิ่นอาย{race} {points}',
    'aura.raceNone': 'ยังไม่ชัดเจน',
    'aura.factionValue': 'ฝ่าย{faction}',
    'aura.factionNone': 'ฝ่ายสมดุล',
    'aura.pool': 'รับรู้ร่างที่เป็นไปได้ {count} ร่าง',
    'aura.unknownBadge': '✨ มีคู่หูใหม่ที่ยังไม่เคยพบ {count} ร่าง',
    'aura.allKnown': 'พบร่างเหล่านี้ครบแล้ว',
    'aura.knownEchoes': 'ร่างที่เคยพบ: {names}',
    'aura.tip': 'เปลี่ยนกรงเลี้ยงเพื่อสะสมแต้มเผ่าและฝ่าย เปลี่ยนผลสุ่มวิวัฒนาการได้!',
    'care.PRISTINE': 'ดูแลพิถีพิถัน',
    'care.STEADY': 'เลี้ยงตามธรรมชาติ',
    'care.WILD': 'สายดุดันกลายพันธุ์',
    'causal.firstDiscovery': '✨ ค้นพบครั้งแรก! ',
    'causal.line': '{first}{race} × {faction} × {care} (พลาด {mistakes})'
  },
  vi: {
    'aura.title': 'Cảm ứng khí chất tiến hóa',
    'aura.summary': '{race} · {faction} · {care}',
    'aura.raceValue': 'Khí chất {race} {points}',
    'aura.raceNone': 'Chưa định hình',
    'aura.factionValue': 'Phe {faction}',
    'aura.factionNone': 'Phe trung lập',
    'aura.pool': 'Cảm nhận {count} dạng có thể tiến hóa',
    'aura.unknownBadge': '✨ Có {count} cộng sự mới chưa mở khóa',
    'aura.allKnown': 'Tất cả đều đã đăng ký',
    'aura.knownEchoes': 'Dạng đã biết: {names}',
    'aura.tip': 'Đổi chuồng nuôi để tích điểm tộc và phe khác nhau, mở ra tuyến tiến hóa bất ngờ!',
    'care.PRISTINE': 'Chăm sóc kỹ lưỡng',
    'care.STEADY': 'Nuôi tự nhiên',
    'care.WILD': 'Biến dị hoang dã',
    'causal.firstDiscovery': '✨ Khám phá mới! ',
    'causal.line': '{first}{race} × {faction} × {care} (lỗi {mistakes})'
  }
});

export function openEvolutionText(key, values = {}, locale = getLocale()) {
  const lang = Object.hasOwn(OPEN_EVOLUTION_COPY, locale) ? locale : 'zh-Hant';
  const raw = OPEN_EVOLUTION_COPY[lang][key] ?? OPEN_EVOLUTION_COPY['zh-Hant'][key] ?? '';
  return raw.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
