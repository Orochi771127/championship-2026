// Five-locale copy for reversible per-individual ranch battle tendency (P1, 2026-11-21).
import { deepFreeze } from '../contracts/championshipContracts.js';
import { getLocale } from './locale.js';

export const PARTNER_TENDENCY_COPY = deepFreeze({
  'zh-Hant': {
    title: '戰鬥傾向練習',
    current: '目前：{label}',
    sourceDrill: '牧場練習',
    sourceCage: '籠舍習慣',
    none: '預設平衡',
    'kind.ENDURANCE': '耐力練習',
    'kind.SKILL': '招式練習',
    'tag.ENDURANCE': '耐力',
    'tag.SKILL': '招式',
    clear: '清除傾向',
    'desc.ENDURANCE': '偏普通攻擊、保守留 TP，適合多連戰續航；代價：前期施壓較緩，可能錯過速攻擊倒。',
    'desc.SKILL': '較早施放符合條件的技能搶節奏；代價：TP 消耗較快，可能影響後續連戰。',
    'desc.NONE': '尚未設定訓練傾向，出戰時沿用預設平衡方針（不改動數值、個性與招式）。',
    sparCta: '帶這隻去陪練驗證',
    'arena.pickIndividual': '同種多隻・選擇出戰個體'
  },
  en: {
    title: 'Battle tendency drill',
    current: 'Current: {label}',
    sourceDrill: 'Ranch drill',
    sourceCage: 'Cage habit',
    none: 'Default',
    'kind.ENDURANCE': 'Endurance drill',
    'kind.SKILL': 'Skill drill',
    'tag.ENDURANCE': 'Endurance',
    'tag.SKILL': 'Skill',
    clear: 'Reset',
    'desc.ENDURANCE': 'Favors basic attacks and conserves TP for multi-bout runs; trade-off: slower early pressure and fewer quick KOs.',
    'desc.SKILL': 'Casts eligible skills earlier to seize tempo; trade-off: spends TP faster, risking dry TP in later bouts.',
    'desc.NONE': 'No training preset set; uses default policy (never alters stats, nature or moves).',
    sparCta: 'Test this partner in Sparring',
    'arena.pickIndividual': 'Same species · Pick individual'
  },
  ja: {
    title: 'バトル傾向トレーニング',
    current: '現在：{label}',
    sourceDrill: '牧場練習',
    sourceCage: 'ケージ習慣',
    none: '標準',
    'kind.ENDURANCE': '持久練習',
    'kind.SKILL': '技練習',
    'tag.ENDURANCE': '持久',
    'tag.SKILL': '技重視',
    clear: '解除',
    'desc.ENDURANCE': '通常攻撃寄りでTPを温存し連戦向き。代償：序盤の圧力が弱く速攻撃破を逃しやすい。',
    'desc.SKILL': '条件を満たした技を早めに発動。代償：TP消費が速く、後の連戦に響きやすい。',
    'desc.NONE': '傾向未設定（標準方針を使用。能力・性格・技は変わりません）。',
    sparCta: 'この個体でスパー検証',
    'arena.pickIndividual': '同種複数・出撃個体を選択'
  },
  th: {
    title: 'ฝึกแนวโน้มการต่อสู้',
    current: 'ปัจจุบัน: {label}',
    sourceDrill: 'ฝึกในฟาร์ม',
    sourceCage: 'นิสัยจากกรง',
    none: 'ค่าเริ่มต้น',
    'kind.ENDURANCE': 'ฝึกความอึด',
    'kind.SKILL': 'ฝึกใช้ท่า',
    'tag.ENDURANCE': 'อึด',
    'tag.SKILL': 'สายท่า',
    clear: 'ล้างค่า',
    'desc.ENDURANCE': 'เน้นตีปกติและประหยัด TP เหมาะกับสู้ต่อเนื่อง ข้อเสีย: กดดันช่วงต้นช้ากว่า',
    'desc.SKILL': 'ออกท่าที่มีเงื่อนไขครบเร็วขึ้น ข้อเสีย: ใช้ TP หมดไว อาจกระทบแมตช์ถัดไป',
    'desc.NONE': 'ยังไม่ได้ตั้งแนวโน้ม ใช้แผนเริ่มต้น (ไม่เปลี่ยนค่าพลัง นิสัย หรือท่า)',
    sparCta: 'พาตัวนี้ไปซ้อมทดสอบ',
    'arena.pickIndividual': 'สายพันธุ์เดียวกัน · เลือกตัวลงสู้'
  },
  vi: {
    title: 'Luyện xu hướng chiến đấu',
    current: 'Hiện tại: {label}',
    sourceDrill: 'Tập tại trang trại',
    sourceCage: 'Thói quen chuồng',
    none: 'Mặc định',
    'kind.ENDURANCE': 'Luyện bền bỉ',
    'kind.SKILL': 'Luyện tung chiêu',
    'tag.ENDURANCE': 'Bền bỉ',
    'tag.SKILL': 'Tung chiêu',
    clear: 'Xóa',
    'desc.ENDURANCE': 'Ưu tiên đánh thường và giữ TP cho chuỗi trận; đánh đổi: áp lực đầu trận yếu hơn.',
    'desc.SKILL': 'Tung kỹ năng đủ điều kiện sớm hơn; đánh đổi: tốn TP nhanh, dễ hụt ở trận sau.',
    'desc.NONE': 'Chưa đặt xu hướng; dùng mặc định (không đổi chỉ số, tính cách hay chiêu).',
    sparCta: 'Đưa cá thể này đi đấu tập',
    'arena.pickIndividual': 'Cùng loài · Chọn cá thể ra trận'
  }
});

export function partnerTendencyText(key, values = {}, locale = getLocale()) {
  const lang = Object.hasOwn(PARTNER_TENDENCY_COPY, locale) ? locale : 'zh-Hant';
  const raw = PARTNER_TENDENCY_COPY[lang][key] ?? PARTNER_TENDENCY_COPY['zh-Hant'][key] ?? '';
  return raw.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
