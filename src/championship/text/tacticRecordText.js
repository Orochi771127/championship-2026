// Five-locale copy for the battle-plan record and the Journey practice series
// (TACTIC_PRACTICE_LOOP_20261116). Short, glanceable lines: numbers first. Every
// figure is counted from the match that just ended, never chosen from the plan.
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';
import { battleStyleText } from './battleStyleText.js';

export const TACTIC_RECORD_COPY = deepFreeze({
  'zh-Hant': {
    tpLeft: 'TP 剩 {n}/{max}',
    'practice.rule': 'HP 每場回滿・TP 延續',
    'practice.tp': 'TP {n}/{max}',
    kicker: '作戰紀錄', title: '這場打法',
    'plan.0': '必殺優先', 'plan.1': '普通攻擊', 'plan.2': '支援優先',
    head: '{name}・{plan}', stats: '出手 {total}　招式 {skill}　走位 {pct}%', support: '　支援 {n}',
    moves: '{moves}', move: '{name} ×{n}', spEmpty: 'TP 用光：{t} 秒', down: '倒下：{t} 秒',
    previous: '上次「{plan}」：出手 {total}　招式 {skill}',
    'practice.title': '陪練三連戰', 'practice.tab': '陪練', 'practice.hint': '同一隻拍檔連打 3 場，每場可換方針。',
    'practice.partner': '拍檔', 'practice.pick': '先選一隻拍檔', 'practice.plan': '方針', 'practice.keep': '同上一場',
    'practice.round': '第 {n} 場・{foe}', 'practice.start': '開始第 {n} 場', 'practice.done': '3 場結束',
    'practice.foe.1': '普攻型', 'practice.foe.2': '招式型', 'practice.foe.SECOND_RIVAL': '對手 2', 'practice.foe.3': '三隻組隊',
    'practice.won': '勝', 'practice.lost': '敗', 'practice.reward': '每場 +{crystals} 結晶',
    'practice.again': '再來一輪', 'practice.log': '下載試玩紀錄', 'practice.next': '下一場（{n}/3）',
    'practice.boutLine': '{plan}｜出手 {total}・招式 {skill}・{seconds}s',
    'practice.memory': '📝 {line}', 'practice.memory.skillWin': '第一次{plan}，招式 ×{skill} 拿下{foe}',
    'practice.memory.fastWin': '{plan}，{seconds} 秒打倒{foe}', 'practice.memory.comeback': '{plan}，剩 {pct}% HP 撐贏{foe}'
  },
  en: {
    tpLeft: 'TP left {n}/{max}',
    'practice.rule': 'HP refills each bout · TP carries over',
    'practice.tp': 'TP {n}/{max}',
    kicker: 'Battle log', title: 'How it fought',
    'plan.0': 'Special first', 'plan.1': 'Normal attack', 'plan.2': 'Support',
    head: '{name} · {plan}', stats: 'Hits {total}  Skills {skill}  Moving {pct}%', support: '  Support {n}',
    moves: '{moves}', move: '{name} ×{n}', spEmpty: 'Out of TP: {t}s', down: 'Down: {t}s',
    previous: 'Last time ({plan}): Hits {total}  Skills {skill}',
    'practice.title': 'Sparring trio', 'practice.tab': 'Sparring', 'practice.hint': 'One partner, 3 bouts. Change the plan between bouts.',
    'practice.partner': 'Partner', 'practice.pick': 'Pick a partner first', 'practice.plan': 'Plan', 'practice.keep': 'Same as last',
    'practice.round': 'Bout {n} · {foe}', 'practice.start': 'Start bout {n}', 'practice.done': 'All 3 done',
    'practice.foe.1': 'Brawler', 'practice.foe.2': 'Skill user', 'practice.foe.SECOND_RIVAL': 'Rival 2', 'practice.foe.3': 'Trio',
    'practice.won': 'Win', 'practice.lost': 'Loss', 'practice.reward': '+{crystals} crystals per bout',
    'practice.again': 'Again', 'practice.log': 'Download playtest log', 'practice.next': 'Next ({n}/3)',
    'practice.boutLine': '{plan} | Hits {total} · Skills {skill} · {seconds}s',
    'practice.memory': '📝 {line}', 'practice.memory.skillWin': 'First {plan}: {skill} skills, beat the {foe}',
    'practice.memory.fastWin': '{plan}: beat the {foe} in {seconds}s', 'practice.memory.comeback': '{plan}: won on {pct}% HP vs the {foe}'
  },
  ja: {
    tpLeft: '残りTP {n}/{max}',
    'practice.rule': 'HPは毎戦全快・TPは持ち越し',
    'practice.tp': 'TP {n}/{max}',
    kicker: 'さくせん記録', title: 'この試合の戦い方',
    'plan.0': 'ひっさつ優先', 'plan.1': 'ノーマルアタック', 'plan.2': 'サポート',
    head: '{name}・{plan}', stats: '行動 {total}　技 {skill}　移動 {pct}%', support: '　サポート {n}',
    moves: '{moves}', move: '{name} ×{n}', spEmpty: 'TP切れ：{t} 秒', down: 'ダウン：{t} 秒',
    previous: '前回「{plan}」：行動 {total}　技 {skill}',
    'practice.title': 'スパーリング三連戦', 'practice.tab': 'スパー', 'practice.hint': '同じパートナーで3連戦。試合ごとにさくせんを変えられる。',
    'practice.partner': 'パートナー', 'practice.pick': '先にパートナーを選ぶ', 'practice.plan': 'さくせん', 'practice.keep': '前と同じ',
    'practice.round': '第 {n} 戦・{foe}', 'practice.start': '第 {n} 戦スタート', 'practice.done': '3戦終了',
    'practice.foe.1': '通常攻撃型', 'practice.foe.2': '技型', 'practice.foe.SECOND_RIVAL': '相手 2', 'practice.foe.3': '3体チーム',
    'practice.won': '勝', 'practice.lost': '負', 'practice.reward': '1戦ごと +{crystals} 結晶',
    'practice.again': 'もう一巡', 'practice.log': 'テスト記録をダウンロード', 'practice.next': '次へ（{n}/3）',
    'practice.boutLine': '{plan}｜行動 {total}・技 {skill}・{seconds}s',
    'practice.memory': '📝 {line}', 'practice.memory.skillWin': '初めての{plan}、技 ×{skill} で{foe}に勝利',
    'practice.memory.fastWin': '{plan}、{seconds} 秒で{foe}を撃破', 'practice.memory.comeback': '{plan}、HP {pct}% で{foe}に粘り勝ち'
  },
  th: {
    tpLeft: 'TP เหลือ {n}/{max}',
    'practice.rule': 'HP เต็มทุกแมตช์ · TP สะสมต่อ',
    'practice.tp': 'TP {n}/{max}',
    kicker: 'บันทึกการรบ', title: 'สไตล์การสู้รอบนี้',
    'plan.0': 'เน้นท่าไม้ตาย', 'plan.1': 'โจมตีปกติ', 'plan.2': 'เน้นสนับสนุน',
    head: '{name} · {plan}', stats: 'โจมตี {total}  ท่า {skill}  เดิน {pct}%', support: '  สนับสนุน {n}',
    moves: '{moves}', move: '{name} ×{n}', spEmpty: 'TP หมด: {t} วิ', down: 'ล้ม: {t} วิ',
    previous: 'ครั้งก่อน ({plan}): โจมตี {total}  ท่า {skill}',
    'practice.title': 'ซ้อมสามแมตช์', 'practice.tab': 'ซ้อม', 'practice.hint': 'คู่หูตัวเดียวสู้ 3 แมตช์ เปลี่ยนแผนได้ทุกแมตช์',
    'practice.partner': 'คู่หู', 'practice.pick': 'เลือกคู่หูก่อน', 'practice.plan': 'แผน', 'practice.keep': 'เหมือนเดิม',
    'practice.round': 'แมตช์ {n} · {foe}', 'practice.start': 'เริ่มแมตช์ {n}', 'practice.done': 'ครบ 3 แมตช์',
    'practice.foe.1': 'สายโจมตีปกติ', 'practice.foe.2': 'สายท่า', 'practice.foe.SECOND_RIVAL': 'คู่แข่ง 2', 'practice.foe.3': 'ทีมสามตัว',
    'practice.won': 'ชนะ', 'practice.lost': 'แพ้', 'practice.reward': '+{crystals} คริสตัลต่อแมตช์',
    'practice.again': 'อีกรอบ', 'practice.log': 'ดาวน์โหลดบันทึกทดสอบ', 'practice.next': 'ถัดไป ({n}/3)',
    'practice.boutLine': '{plan} | โจมตี {total} · ท่า {skill} · {seconds}วิ',
    'practice.memory': '📝 {line}', 'practice.memory.skillWin': '{plan} ครั้งแรก ใช้ท่า ×{skill} ชนะ{foe}',
    'practice.memory.fastWin': '{plan} ล้ม{foe}ใน {seconds} วิ', 'practice.memory.comeback': '{plan} เหลือ HP {pct}% ชนะ{foe}'
  },
  vi: {
    tpLeft: 'TP còn {n}/{max}',
    'practice.rule': 'HP hồi đầy mỗi trận · TP giữ nguyên',
    'practice.tp': 'TP {n}/{max}',
    kicker: 'Nhật ký trận', title: 'Cách nó đánh',
    'plan.0': 'Ưu tiên tuyệt chiêu', 'plan.1': 'Tấn công thường', 'plan.2': 'Ưu tiên hỗ trợ',
    head: '{name} · {plan}', stats: 'Ra đòn {total}  Chiêu {skill}  Di chuyển {pct}%', support: '  Hỗ trợ {n}',
    moves: '{moves}', move: '{name} ×{n}', spEmpty: 'Hết TP: {t}s', down: 'Gục: {t}s',
    previous: 'Lần trước ({plan}): Ra đòn {total}  Chiêu {skill}',
    'practice.title': 'Ba trận tập', 'practice.tab': 'Đấu tập', 'practice.hint': 'Một cộng sự, 3 trận. Đổi chiến thuật giữa các trận.',
    'practice.partner': 'Cộng sự', 'practice.pick': 'Chọn cộng sự trước', 'practice.plan': 'Chiến thuật', 'practice.keep': 'Như trận trước',
    'practice.round': 'Trận {n} · {foe}', 'practice.start': 'Đấu trận {n}', 'practice.done': 'Xong 3 trận',
    'practice.foe.1': 'Đánh thường', 'practice.foe.2': 'Dùng chiêu', 'practice.foe.SECOND_RIVAL': 'Đối thủ 2', 'practice.foe.3': 'Đội ba',
    'practice.won': 'Thắng', 'practice.lost': 'Thua', 'practice.reward': '+{crystals} tinh thể mỗi trận',
    'practice.again': 'Lượt nữa', 'practice.log': 'Tải nhật ký thử nghiệm', 'practice.next': 'Tiếp ({n}/3)',
    'practice.boutLine': '{plan} | Ra đòn {total} · Chiêu {skill} · {seconds}s',
    'practice.memory': '📝 {line}', 'practice.memory.skillWin': 'Lần đầu {plan}: {skill} chiêu, hạ {foe}',
    'practice.memory.fastWin': '{plan}: hạ {foe} trong {seconds}s', 'practice.memory.comeback': '{plan}: thắng {foe} với {pct}% HP'
  }
});

/** The rival label for a practice bout kind (productTacticPractice). */
export const tacticPracticeFoeKey = (kind) => ({ NORMAL_RIVAL: 'practice.foe.1', SKILL_RIVAL: 'practice.foe.2', SECOND_RIVAL: 'practice.foe.SECOND_RIVAL', TEAM: 'practice.foe.3' })[kind] ?? 'practice.foe.SECOND_RIVAL';

export function tacticRecordText(key, values = {}, locale = getLocale()) {
  const lang = Object.hasOwn(TACTIC_RECORD_COPY, locale) ? locale : 'zh-Hant';
  const text = TACTIC_RECORD_COPY[lang][key] ?? TACTIC_RECORD_COPY['zh-Hant'][key] ?? '';
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

/**
 * The result-screen lines for one match record (battleTacticRecord summary):
 * a name line, one numbers line, then only what actually happened (skills by
 * name, SP running out, going down) and the last different plan for contrast.
 * `nameOf(slot, speciesId)` and `moveName(id)` come from the caller, which owns
 * the display copy; `previous(entry)` may return the same partner's last record.
 */
export function tacticRecordLines(record, { nameOf, moveName, previous = () => null, locale = getLocale() } = {}) {
  if (!record?.local?.length) return [];
  const t = (key, values) => tacticRecordText(key, values, locale);
  const lines = [];
  for (const entry of record.local) {
    if (!Number.isInteger(entry.tactic)) continue;
    const plan = t(`plan.${entry.tactic}`);
    lines.push(t('head', { name: nameOf?.(entry.slot, entry.speciesId) ?? entry.displayName ?? '', plan }));
    const pct = entry.decisions?.total ? Math.round((entry.decisions.reposition / entry.decisions.total) * 100) : 0;
    lines.push(t('stats', { total: entry.total, skill: entry.counts.skill, pct }) + (entry.counts.support ? t('support', { n: entry.counts.support }) : ''));
    const moves = entry.moves.slice(0, 3).map(m => t('move', { name: moveName?.(m.moveId) ?? `#${m.moveId}`, n: m.count }));
    if (moves.length) lines.push(t('moves', { moves: moves.join('　') }));
    if (entry.spEmptyAt !== null) lines.push(t('spEmpty', { t: Math.round(entry.spEmptyAt) }));
    if (entry.downAt !== null) lines.push(t('down', { t: Math.round(entry.downAt) }));
    // P2: what the plan left for the next battle (TP carries over as the original writes it).
    if (Number.isFinite(entry.tpLeft) && Number.isFinite(entry.tpMax) && entry.tpMax > 0) lines.push(t('tpLeft', { n: entry.tpLeft, max: entry.tpMax }));
    const before = previous(entry);
    if (before && before.tactic !== entry.tactic) lines.push(t('previous', { plan: t(`plan.${before.tactic}`), total: before.total, skill: before.counts.skill }));
  }
  // BATTLE_STYLE_V1: the statuses that landed on the other team, e.g. 對手：中毒 ×2　麻痺 ×1.
  if (lines.length && record.foeStatuses?.length) {
    const list = record.foeStatuses.slice(0, 3).map(({ key, count }) =>
      battleStyleText('statusCount', { name: battleStyleText(`status.${key}`, {}, locale), n: count }, locale));
    lines.push(battleStyleText('foeStatus', { list: list.join('　') }, locale));
  }
  return lines;
}
