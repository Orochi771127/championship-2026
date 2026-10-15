import {productSpeciesRecord,productBaseSpeciesIndex} from '../contracts/productSpeciesData.js';
import {getProductExtension} from '../contracts/productSpeciesExtensions.js';
import catalog from '../../data/championship/database-original-profiles.r1.json' with {type:'json'};
import speciesCatalog from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import battleMovesCatalog from '../../data/championship/catalogs/battle-moves.r1.json' with {type:'json'};
import {BATTLE_MOVE_NAMES} from '../text/battleMoveNames.js';
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from '../text/locale.js';

export const DATABASE_ORIGINAL_PROFILES = deepFreeze(catalog);
const bySpecies = new Map(catalog.entries.map(entry=>[entry.speciesIndex,entry]));
const headings = Object.freeze({'zh-Hant':'角色故事',en:'Profile',ja:'プロフィール',th:'เรื่องราว',vi:'Câu chuyện'});

// Presentation-only; never reads or changes registration, saves or instances.
// Missing content stays absent. No cross-language or unrelated-species fallback.
export function databaseStory(speciesIndex, locale = getLocale()) {
  if (!Number.isSafeInteger(speciesIndex) || !Object.hasOwn(headings,locale)) return null;
  return bySpecies.get(speciesIndex)?.textByLocale[locale] ?? null;
}
export function databaseStoryHeading(locale = getLocale()) {
  return Object.hasOwn(headings,locale) ? headings[locale] : null;
}

const verifiedHeadings = Object.freeze({
  'zh-Hant': '能力與招式',
  en: 'Traits & Moves',
  ja: '能力と技',
  th: 'ความสามารถและท่าต่อสู้',
  vi: 'Năng lực & Kỹ năng'
});

const FIELD_LABELS = Object.freeze({
  'zh-Hant': Object.freeze({ attribute: '屬性', family: '種族', baseStats: '基礎能力', hp: '生命值', tp: '技力', moves: '習得招式', power: '威力', cost: '消耗' }),
  en: Object.freeze({ attribute: 'Attribute', family: 'Family', baseStats: 'Base Stats', hp: 'HP', tp: 'TP', moves: 'Learned Moves', power: 'Power', cost: 'Cost' }),
  ja: Object.freeze({ attribute: '属性', family: '種族', baseStats: '基本能力', hp: 'HP', tp: 'TP', moves: '習得技', power: '威力', cost: '消費' }),
  th: Object.freeze({ attribute: 'คุณสมบัติ', family: 'เผ่า', baseStats: 'ค่าพลังพื้นฐาน', hp: 'HP', tp: 'TP', moves: 'ท่าต่อสู้ที่เรียนรู้', power: 'พลัง', cost: 'ใช้' }),
  vi: Object.freeze({ attribute: 'Thuộc tính', family: 'Tộc', baseStats: 'Chỉ số cơ bản', hp: 'HP', tp: 'TP', moves: 'Kỹ năng đã học', power: 'Uy lực', cost: 'Tiêu hao' })
});

const FAMILIES_BY_LOCALE = Object.freeze({
  'zh-Hant': Object.freeze(['無','獸','機械','昆蟲植物','鳥','龍','水','聖','暗黑']),
  en: Object.freeze(['None','Beast','Machine','Insect & Plant','Bird','Dragon','Aquatic','Holy','Dark']),
  ja: Object.freeze(['無','獣','機械','虫植物','鳥','竜','水','聖','暗黒']),
  th: Object.freeze(['ไม่มี','สัตว์ป่า','เครื่องจักร','แมลงและพืช','นก','มังกร','สัตว์น้ำ','ศักดิ์สิทธิ์','ความมืด']),
  vi: Object.freeze(['Không','Thú','Máy móc','Côn trùng & Cây cỏ','Chim','Rồng','Thủy sinh','Thần thánh','Hắc ám'])
});

const ATTRIBUTES_BY_LOCALE = Object.freeze({
  'zh-Hant': Object.freeze(['無', '疫苗', '病毒', '資料', '自由']),
  en: Object.freeze(['None', 'Vaccine', 'Virus', 'Data', 'Free']),
  ja: Object.freeze(['無', 'ワクチン', 'ウイルス', 'データ', 'フリー']),
  th: Object.freeze(['ไม่มี', 'วัคซีน', 'ไวรัส', 'ข้อมูล', 'อิสระ']),
  vi: Object.freeze(['Không', 'Vắc-xin', 'Vi-rút', 'Dữ liệu', 'Tự do'])
});

const MOVE_KINDS_BY_LOCALE = Object.freeze({
  'zh-Hant': Object.freeze(['近戰', '射擊']),
  en: Object.freeze(['Melee', 'Ranged']),
  ja: Object.freeze(['近接', '射撃']),
  th: Object.freeze(['โจมตีใกล้', 'โจมตีไกล']),
  vi: Object.freeze(['Cận chiến', 'Bắn xa'])
});

const LOCALE_COLUMN = Object.freeze({ 'zh-Hant': 0, en: 1, ja: 2, th: 3, vi: 4 });

// Named component copy for the canonical locale-coverage contract. Only these
// exact values belong to this dictionary; stray literals still need coverage.
const indexedCopy = (prefix, values) => Object.fromEntries(values.map((text,index)=>[`${prefix}.${index}`,text]));
export const DATABASE_STORY_COPY = deepFreeze(Object.fromEntries(Object.keys(headings).map(locale=>[locale,{
  storyHeading: headings[locale],
  verifiedHeading: verifiedHeadings[locale],
  ...Object.fromEntries(Object.entries(FIELD_LABELS[locale]).map(([key,text])=>[`field.${key}`,text])),
  ...indexedCopy('family',FAMILIES_BY_LOCALE[locale]),
  ...indexedCopy('attribute',ATTRIBUTES_BY_LOCALE[locale]),
  ...indexedCopy('moveKind',MOVE_KINDS_BY_LOCALE[locale])
}])));

const movesBySpecies = new Map();
for (const record of battleMovesCatalog.records) {
  if (!movesBySpecies.has(record.speciesId)) movesBySpecies.set(record.speciesId, []);
  movesBySpecies.get(record.speciesId).push(record);
}

export function databaseVerifiedHeading(locale = getLocale()) {
  return Object.hasOwn(verifiedHeadings, locale) ? verifiedHeadings[locale] : null;
}

export function databaseVerifiedData(speciesIndex, locale = getLocale()) {
  if (!Number.isSafeInteger(speciesIndex) || !Object.hasOwn(verifiedHeadings, locale)) return null;
  if (!bySpecies.has(speciesIndex)&&!getProductExtension(speciesIndex)) return null;
  const sp = productSpeciesRecord(speciesIndex);
  if (!sp) return null;

  const col = LOCALE_COLUMN[locale];
  const labels = FIELD_LABELS[locale];
  const familyOrdinal = sp.familyBits === 0 ? 0 : 32 - Math.clz32((sp.familyBits & -sp.familyBits) >>> 0);
  const familyName = FAMILIES_BY_LOCALE[locale][familyOrdinal] ?? '????';
  const attributeName = ATTRIBUTES_BY_LOCALE[locale][sp.attributeIndex] ?? '????';

  // Species traits do not establish an individual partner's battle stat rungs.
  // Keep the Dex independent of instance stats; move actionCost remains TP.
  const rawMoves = movesBySpecies.get(productBaseSpeciesIndex(speciesIndex)) ?? [];
  const moves = rawMoves.map(m => {
    const kindIdx = (m.kind === 0 || m.kind === 1) ? m.kind : 0;
    return Object.freeze({
      recordIndex: m.recordIndex,
      name: BATTLE_MOVE_NAMES[m.recordIndex]?.[col] ?? '????',
      power: m.power,
      actionCost: m.actionCost,
      kind: m.kind,
      kindName: MOVE_KINDS_BY_LOCALE[locale][kindIdx] ?? '????'
    });
  });

  return Object.freeze({
    speciesIndex,
    labels,
    attributeName,
    familyName,
    moves: Object.freeze(moves)
  });
}
