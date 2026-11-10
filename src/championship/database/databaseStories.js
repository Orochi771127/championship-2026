import {productSpeciesRecord,productBaseSpeciesIndex} from '../contracts/productSpeciesData.js';
import {getProductExtension} from '../contracts/productSpeciesExtensions.js';
import {getProductOriginal,isPlayableProductOriginal,listProductOriginalMoveRecords,productOriginalMoves} from '../contracts/productOriginalSpecies.js';
import {getDatabaseIllustrationStory} from './databaseIllustrations.js';
import catalog from '../../data/championship/database-original-profiles.r1.json' with {type:'json'};
import speciesCatalog from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import battleMovesCatalog from '../../data/championship/catalogs/battle-moves.r1.json' with {type:'json'};
import {BATTLE_MOVE_NAMES} from '../text/battleMoveNames.js';
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from '../text/locale.js';
import {speciesTaxonomy} from '../contracts/speciesTaxonomy.js';
import {taxonomyText} from '../text/taxonomyText.js';

export const DATABASE_ORIGINAL_PROFILES = deepFreeze(catalog);
const bySpecies = new Map(catalog.entries.map(entry=>[entry.speciesIndex,entry]));
const headings = Object.freeze({'zh-Hant':'角色故事',en:'Profile',ja:'プロフィール',th:'เรื่องราว',vi:'Câu chuyện'});

// Presentation-only; never reads or changes registration, saves or instances.
// Missing content stays absent. No cross-language or unrelated-species fallback.
export function databaseStory(speciesIndex, locale = getLocale()) {
  if (!Number.isSafeInteger(speciesIndex) || !Object.hasOwn(headings,locale)) return null;
  return bySpecies.get(speciesIndex)?.textByLocale[locale] ?? getProductExtension(speciesIndex)?.profileByLocale?.[locale] ?? getDatabaseIllustrationStory(speciesIndex, locale) ?? null;
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
  'zh-Hant': Object.freeze({ attribute: '陣營', element: '屬性', family: '種族', baseStats: '基礎能力', hp: '生命值', tp: '技力', moves: '習得招式', power: '威力', cost: '消耗', height: '身高', weight: '體重' }),
  en: Object.freeze({ attribute: 'Faction', element: 'Element', family: 'Race', baseStats: 'Base Stats', hp: 'HP', tp: 'TP', moves: 'Learned Moves', power: 'Power', cost: 'Cost', height: 'Height', weight: 'Weight' }),
  ja: Object.freeze({ attribute: '陣営', element: '属性', family: '種族', baseStats: '基本能力', hp: 'HP', tp: 'TP', moves: '習得技', power: '威力', cost: '消費', height: '身長', weight: '体重' }),
  th: Object.freeze({ attribute: 'ฝ่าย', element: 'ธาตุ', family: 'เผ่า', baseStats: 'ค่าพลังพื้นฐาน', hp: 'HP', tp: 'TP', moves: 'ท่าต่อสู้ที่เรียนรู้', power: 'พลัง', cost: 'ใช้', height: 'ส่วนสูง', weight: 'น้ำหนัก' }),
  vi: Object.freeze({ attribute: 'Phe', element: 'Thuộc tính', family: 'Chủng tộc', baseStats: 'Chỉ số cơ bản', hp: 'HP', tp: 'TP', moves: 'Kỹ năng đã học', power: 'Uy lực', cost: 'Tiêu hao', height: 'Chiều cao', weight: 'Cân nặng' })
});

const FAMILIES_BY_LOCALE = Object.freeze({
  'zh-Hant': Object.freeze(['無','獸族','機巧族','森羅族','羽翼族','龍族','海淵族','星靈族','幽冥族']),
  en: Object.freeze(['None','Beast','Mechanoid','Sylvan','Avian','Dragon','Aquatic','Astral','Nether']),
  ja: Object.freeze(['無','獣族','機巧族','森羅族','羽翼族','竜族','海淵族','星霊族','幽冥族']),
  th: Object.freeze(['ไม่มี','สัตว์ป่า','เครื่องจักร','แมลงและพืช','นก','มังกร','สัตว์น้ำ','ศักดิ์สิทธิ์','ความมืด']),
  vi: Object.freeze(['Không','Thú tộc','Cơ Xảo tộc','Sâm La tộc','Vũ Dực tộc','Long tộc','Hải Uyên tộc','Tinh Linh tộc','U Minh tộc'])
});

const ATTRIBUTES_BY_LOCALE = Object.freeze({
  'zh-Hant': Object.freeze(['無', '心輝', '裂隙', '黑鐵', '未定']),
  en: Object.freeze(['None', 'Lumen', 'Rift', 'Black Iron', 'Unaligned']),
  ja: Object.freeze(['無', '心輝', '裂隙', '黒鉄', '未定']),
  th: Object.freeze(['ไม่มี', 'ลูเมน', 'รอยแยก', 'เหล็กดำ', 'ไม่สังกัด']),
  vi: Object.freeze(['Không', 'Tâm Huy', 'Khe Nứt', 'Hắc Thiết', 'Chưa định'])
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
  if (!bySpecies.has(speciesIndex)&&!getProductExtension(speciesIndex)&&!getProductOriginal(speciesIndex)) return null;
  const sp = productSpeciesRecord(speciesIndex);
  if (!sp) return null;

  const col = LOCALE_COLUMN[locale];
  const labels = FIELD_LABELS[locale];
  const familyOrdinal = sp.familyBits === 0 ? 0 : 32 - Math.clz32((sp.familyBits & -sp.familyBits) >>> 0);
  // The three-axis taxonomy names the faction (ROM attribute), race (ROM family) and element.
  const taxonomy = speciesTaxonomy(speciesIndex);
  const familyName = taxonomy ? taxonomyText(`race.${taxonomy.race ?? 'NONE'}`, {}, locale) : FAMILIES_BY_LOCALE[locale][familyOrdinal] ?? '????';
  const attributeName = taxonomy ? taxonomyText(`faction.${taxonomy.faction ?? 'NONE'}`, {}, locale) : ATTRIBUTES_BY_LOCALE[locale][sp.attributeIndex] ?? '????';
  const elementName = taxonomy ? taxonomyText(`element.${taxonomy.element}`, {}, locale) : null;

  // Species traits do not establish an individual partner's battle stat rungs.
  // Keep the Dex independent of instance stats; move actionCost remains TP.
  // An original character has its own moves; an alternate form shares its base form's. An art-only original
  // (Owner 2026-11-03) shows its planned moves, named in its own data, before they exist in battle.
  const rawMoves = isPlayableProductOriginal(speciesIndex) ? listProductOriginalMoveRecords().filter(m => m.speciesId === speciesIndex)
    : getProductOriginal(speciesIndex) ? productOriginalMoves(speciesIndex).map(m => ({recordIndex: m.battleMoveRecord, power: m.power,
      actionCost: m.actionCost, kind: m.kind === 'MELEE' ? 0 : 1, names: m.nameByLocale}))
    : movesBySpecies.get(productBaseSpeciesIndex(speciesIndex)) ?? [];
  const moves = rawMoves.map(m => {
    const kindIdx = (m.kind === 0 || m.kind === 1) ? m.kind : 0;
    return Object.freeze({
      recordIndex: m.recordIndex,
      name: BATTLE_MOVE_NAMES[m.recordIndex]?.[col] ?? m.names?.[locale] ?? '????',
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
    element: taxonomy?.element ?? null,
    elementName,
    taxonomy,
    moves: Object.freeze(moves)
  });
}
