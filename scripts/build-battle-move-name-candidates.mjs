// Battle move names: candidates for Owner review (2026-10-12).
//
// Owner: 「保留穩定的技能 ID、角色關聯及傷害、屬性、射程等既有規則，區分『技能本身』與
// 『共用特效配方』…缺少名稱的，由你依技能實際效果與原創角色設定擬定原創名稱，標記為待審候選。」
//
// Reads only existing data: the move records (stable record index, owner
// species, kind, power, cost, element selector, target mode, status code and
// effect fields), the in-game character names, the effect-bank families and
// the Owner's original VFX titles. It writes review documents; nothing the game
// reads changes, and no move value is touched.
//
// Status per row:
//   APPROVED_EXISTING      the 30 special skills, approved five-language names (zhHant.js / gameText.*.js)
//   CANDIDATE_REVIEW_BATCH hand-written for the representative review batch
//   CANDIDATE_RULE         produced by the naming rule below, pending review
//   RESERVED               record 0, owned by no fighter
//
// Usage: node scripts/build-battle-move-name-candidates.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import profiles from '../src/data/championship/battleEffectProfiles.json' with {type: 'json'};
import {SPECIES_NAMES_ZH} from '../src/championship/text/catalogs.zhHant.js';
import {BATTLE_FX_ELEMENT_PALETTE, battleFxMoveBanks, describeBattleFxMove} from '../src/championship/presentation/battleFx/battleFxRecipes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'docs/reports/battle-move-names-2026-10-12');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// Approved special-skill names in five languages (index = record 0..30).
function frozenArray(source, name) {
  const match = source.match(new RegExp(`(?:const|export const) ${name} = Object\\.freeze\\((\\[[\\s\\S]*?\\])\\)`));
  if (!match) throw new Error(`${name} not found`);
  return Function(`return ${match[1]}`)();
}
const SPECIAL = {
  'zh-Hant': frozenArray(read('src/championship/text/zhHant.js'), 'SPECIAL_SKILLS'),
  en: frozenArray(read('src/championship/text/gameText.en.js'), 'SPECIAL_SKILLS_EN'),
  ja: frozenArray(read('src/championship/text/gameText.ja.js'), 'SPECIAL_SKILLS_JA'),
  th: frozenArray(read('src/championship/text/gameText.th.js'), 'SPECIAL_SKILLS_TH'),
  vi: frozenArray(read('src/championship/text/gameText.vi.js'), 'SPECIAL_SKILLS_VI')
};

// The Owner's original shared VFX titles, per bank and sequence (recipe names, never move names).
const vfx = JSON.parse(read('assets/production/vfx/original-shared-review-210-seamfix-r1/manifest.json'));
const recipeTitle = new Map();
for (const bank of vfx.banks ?? []) for (const seq of bank.sequences ?? []) recipeTitle.set(`${bank.bankId}:${seq}`, bank.title);

// ------------------------------------------------------------ representative batch
// Hand-written candidates. Each names the skill from its own data and its
// character; a shared effect recipe never decides the name.
export const REVIEW_BATCH = Object.freeze({
  // 鎧焰蜥 (m201): armoured fire lizard.
  59: ['鎧焰爪', 'BLAZE CLAW', '基本攻擊；命中序列為燃燒爪擊類（共用：焰爪掠擊）'],
  60: ['焰鱗彈', 'EMBER SCALE', '火屬投射（威力 300、消耗 6）；鱗片狀火彈呼應鎧甲蜥'],
  61: ['烈鎧焰砲', 'REX FLARE', '絕招：火屬光束（威力 400、消耗 10）收尾大爆炸'],
  // 爆風槍兔 (m313): blast-gun hare.
  179: ['疾耳衝', 'HARE DASH', '基本攻擊；無特效欄位，以身體衝撞'],
  180: ['爆風連射', 'GALE BARRAGE', '絕招：連射型投射（威力 60、消耗 22），呼應槍兔'],
  181: ['槍兔突進', 'HARE LUNGE', '技能（威力 60、消耗 12）；無特效欄位的突進動作'],
  // 焰核炎靈 (m353): flame-core wisp knight.
  254: ['焰核掌', 'PYRE PALM', '基本攻擊'],
  255: ['炎靈核爆拳', 'CORE BURST FIST', '絕招：火屬拳擊（威力 400）＋燃燒；原作特寫鏡頭招式'],
  // 腐泥滑怪 (m372): mire slug.
  299: ['泥沼拍', 'MUCK SLAP', '基本攻擊'],
  300: ['腐泥團', 'MIRE GLOB', '絕招：泥團投射（威力 400、消耗 12）'],
  // 赤曜槍皇 (m541): holy lance knight with a shield.
  593: ['曜槍突', 'SOL THRUST', '技能但不耗資源（威力 100）；命中序列共用霜裂斬'],
  594: ['赤曜盾斬', 'AEGIS SLASH', '斬擊（威力 280、消耗 35）；共用鋼月斬'],
  595: ['皇曜聖槍砲', 'SOLGUARD LANCE', '絕招：光屬光束（威力 380、消耗 65）；光束配方與霜砲機狼 555 共用，但屬性與數值不同，是不同技能'],
  // 霜砲機狼 (m529): frost-cannon mech wolf.
  554: ['機狼爪', 'WOLFRAM CLAW', '基本攻擊'],
  555: ['冰河霜砲', 'GLACIER CANNON', '絕招：水／冰屬光束（威力 350、消耗 45）＋冰晶；與赤曜槍皇 595 共用光束配方，但為不同技能'],
  556: ['寒鋼飛彈群', 'FROST MISSILES', '飛彈群（威力 70、消耗 50）收尾爆炸'],
  // 曜極星龍 (m509): radiant star dragon.
  501: ['曜龍爪', 'LUMINARC CLAW', '基本攻擊'],
  502: ['極光星彈', 'AURORA ORB', '光屬光球（威力 350、消耗 40）收尾爆炸'],
  503: ['曜極天爆', 'ZENITH NOVA', '絕招：光屬範圍（威力 400、消耗 60）'],
  504: ['星曜貫刃', 'STARPIERCE', '穿刺（威力 380、消耗 45）；共用貫槍突刺'],
  // 星糯核 (m111): star mochi core.
  51: ['糯糯撞', 'MOCHI BUMP', '基本攻擊'],
  52: ['星糯泡泡', 'STAR BUBBLE', '絕招：泡泡投射（威力 300、消耗 4），附帶狀態碼 7'],
  // 焰角幼龍 (m112): cinder-horned whelp.
  53: ['幼角頂', 'HORN BUMP', '基本攻擊'],
  54: ['焰角火球', 'CINDER BALL', '絕招：火球（威力 500、消耗 5）']
});

// --------------------------------------------------------------------- rule
// Rule for the rest (the same rule the review batch follows):
//   basic     = 角色字根 + 命中動作（爪／斬／拳／刺／咬／鞭…，取自命中序列）
//   skill     = 角色字根 + 效果名（依該招自己的投射物、光束、吐息、範圍與屬性色）
//   signature = 角色字根 + 屬性冠詞 + 形態字（每個角色唯一的「絕招」）
// 角色字根取遊戲內名稱前二字；與效果名首字重複時去重；全名單重名時加第三字或序號。
// Names describe the visible effect; effect families that carry an original
// game's move name are never translated into a candidate.
const HIT_NOUN = {H_claw: '爪', H_Slashtop: '斬', H_Knuckle: '拳', H_piercing: '刺', etc_hiteffect: '踏'};
const COMMON_HIT = {30: '焰擊', 31: '冰擊', 32: '電擊', 36: '掠爪', 37: '斬', 41: '射', 42: '咬', 44: '鞭'};
const PROJECTILE_NOUN = [
  [/fireball_w/, '白焰球'], [/fireball/, '火球'], [/magmaball/, '熔岩彈'], [/toyfire/, '玩具焰'], [/foxfire|kyubimonfire/, '狐火'],
  [/firewing/, '火翼'], [/thunderball/, '雷球'], [/lightball/, '光球'], [/waterball/, '水彈'], [/bubble/, '泡泡'],
  [/giantmissile/, '巨型飛彈'], [/missile/, '飛彈'], [/kikanzyu/, '連射'], [/hasyuriken/, '刃鏢'], [/syuriken/, '飛鏢'],
  [/airneedle/, '風針'], [/seed/, '種彈'], [/icerock/, '冰岩'], [/rock/, '岩彈'], [/spiralbone/, '旋骨'], [/bone/, '骨棒'],
  [/koorituno/, '冰角'], [/tuno/, '角擊'], [/toge/, '尖刺'], [/starlight/, '星光'], [/star/, '星彈'], [/crescent/, '月輪'],
  [/holyarrow/, '聖箭'], [/icearrow/, '冰箭'], [/jetarrow/, '噴射箭'], [/arrow/, '箭'], [/onpu/, '音波'], [/banana/, '蕉彈'],
  [/unchi/, '泥團'], [/fish/, '魚雷'], [/cogwheel/, '齒輪'], [/kinoko/, '孢子'], [/hartbreak/, '碎心'], [/hart/, '心彈'],
  [/catseye/, '瞳光'], [/trident/, '三叉戟'], [/spear/, '長槍'], [/sword/, '飛劍'], [/rose/, '薔薇'], [/deathcharm/, '咒符'],
  [/dirtysaucer/, '穢盤'], [/bigsmileybomber/, '巨彈'], [/bomb/, '炸彈'], [/leomonhed/, '獅頭彈'], [/rocketpunch/, '飛拳'],
  [/tyusyaki/, '針筒'], [/pointer/, '指標彈'], [/delumonegg/, '蛋彈'], [/ropear/, '藤索'], [/snowcrystal/, '雪晶'],
  [/purple/, '紫焰'], [/haguro/, '刃輪'], [/thunderjavelin/, '雷槍'], [/hammerspark/, '雷錘'], [/blacksmoke/, '黑煙']
];
const PALETTE_ADJ = {fire: '焰', water: '水', ice: '霜', light: '聖', dark: '暗', thunder: '雷', nature: '翠', metal: '鋼', earth: '岩',
  toxic: '毒', psychic: '念', wind: '風', neutral: ''};
const BEAM = {fire: '熾焰砲', water: '激流砲', ice: '冰霜砲', light: '聖光砲', dark: '暗影砲', thunder: '雷霆砲', nature: '翠光砲',
  metal: '鋼鐵砲', earth: '地脈砲', toxic: '毒液砲', psychic: '念波砲', wind: '風壓砲', neutral: '能量砲'};
const STREAM = {fire: '吐焰', water: '水流', ice: '冰息', light: '光流', dark: '黑霧', thunder: '雷流', nature: '花息', metal: '鋼屑流',
  earth: '沙流', toxic: '毒息', psychic: '念流', wind: '龍捲', neutral: '氣流'};
const AREA = {fire: '炎爆', water: '怒濤', ice: '冰暴', light: '聖爆', dark: '冥爆', thunder: '落雷', nature: '森嵐', metal: '鋼雨',
  earth: '地裂', toxic: '毒霧', psychic: '心靈波', wind: '風暴', neutral: '衝擊波'};
const AREA_FAMILY = [[/tsunami/, '海嘯'], [/raiun/, '雷雲'], [/yukigumo/, '雪雲'], [/kumo/, '雲爆'], [/jiware/, '地裂'],
  [/sun00/, '日輪'], [/moon00/, '月華'], [/clockmonclock/, '時鐘'], [/bakemoncurse/, '詛咒'], [/abduction/, '牽引']];
const CHARACTER_NOUN = {oukuwamon: '鉗擊', crescemon: '月鎌', brakedramon: '剎擊', kiwimonsmall00: '群鳥'};
const GRAND = {fire: '煉獄', water: '怒濤', ice: '冰獄', light: '聖曜', dark: '冥暗', thunder: '天雷', nature: '森羅', metal: '鋼魂',
  earth: '崩岩', toxic: '腐毒', psychic: '心靈', wind: '狂嵐', neutral: '極'};
const FORM_CHAR = {projectile: '彈', beam: '砲', stream: '息', area: '爆', character: '襲', smoke: '霧', support: '輝'};

function hitNoun(banks) {
  for (const bank of banks) {
    if (HIT_NOUN[bank.family]) return HIT_NOUN[bank.family];
    if (bank.bankId === 1 && COMMON_HIT[bank.sequence]) return COMMON_HIT[bank.sequence];
  }
  return '擊';
}
function effectNoun(look, banks) {
  const body = banks.find(b => b.role === 'body') ?? banks.find(b => b.role === 'launch') ?? banks.find(b => b.role === 'hit') ?? banks[0];
  const family = body?.family ?? '';
  if (look.form === 'beam') return family.includes('walaser') ? '水雷射' : BEAM[look.palette];
  if (look.form === 'stream') return /tatumaki/.test(family) ? '龍捲' : /snowstorm/.test(family) ? '暴風雪' : STREAM[look.palette];
  if (look.form === 'area') return AREA_FAMILY.find(([rule]) => rule.test(family))?.[1] ?? AREA[look.palette];
  if (look.form === 'character') return CHARACTER_NOUN[family] ?? '突襲';
  if (look.form === 'melee') return `${PALETTE_ADJ[look.palette]}${hitNoun(banks)}`;
  if (look.form === 'projectile' || look.form === 'smoke') return PROJECTILE_NOUN.find(([rule]) => rule.test(family))?.[1] ?? `${PALETTE_ADJ[look.palette]}彈`;
  return '衝擊';
}
const join = (morph, noun) => {
  let m = morph;
  while (m && noun.startsWith(m.at(-1))) m = m.slice(0, -1); // 腐泥 + 泥團 -> 腐泥團
  return (m.length ? m : morph.slice(0, 1)) + noun;
};
function ruleName(move, look, banks, morph) {
  // A skill with no effect fields is a body move: a lunge, not a projectile.
  if (!banks.length && look.tier === 'skill') return join(morph, '突進');
  if (!banks.length && look.tier === 'ultimate') return join(morph, `${GRAND[look.palette]}衝`);
  if (look.tier === 'basic') { const noun = hitNoun(banks); return join(morph, noun === '擊' ? '撞擊' : noun.length === 1 ? `${noun}擊` : noun); }
  if (look.tier === 'ultimate') {
    const formChar = look.form === 'melee' ? hitNoun(banks).slice(-1).replace('擊', '拳') : (FORM_CHAR[look.form] ?? '擊');
    return join(morph, `${GRAND[look.palette]}${formChar}`);
  }
  return join(morph, effectNoun(look, banks));
}

// ---------------------------------------------------------------------- build
const speciesById = new Map(species.records.map(s => [s.recordIndex, s]));
const bySpecies = new Map();
for (const move of moves.records) bySpecies.set(move.speciesId, [...(bySpecies.get(move.speciesId) ?? []), move]);
const recipeSpecies = new Map(); // main bank -> species using it
const rows = [];
for (const move of moves.records) {
  const banks = battleFxMoveBanks(move);
  const look = describeBattleFxMove(move, bySpecies.get(move.speciesId));
  const main = banks.find(b => b.role === 'body') ?? banks.find(b => b.role === 'launch') ?? banks.find(b => b.role === 'hit') ?? banks[0] ?? null;
  const special = move.recordIndex >= 1 && move.recordIndex <= 30;
  const reserved = move.recordIndex === 0;
  const s = speciesById.get(move.speciesId);
  const characterName = special || reserved ? null : SPECIES_NAMES_ZH[move.speciesId] ?? null;
  if (main && !special) recipeSpecies.set(`${main.bankId}:${main.sequence}`, new Set([...(recipeSpecies.get(`${main.bankId}:${main.sequence}`) ?? []), move.speciesId]));
  rows.push({
    moveId: move.recordIndex,
    owner: reserved ? 'RESERVED' : special ? 'SPECIAL_SKILL' : 'SPECIES',
    speciesId: special || reserved ? null : move.speciesId,
    entityId: special || reserved ? null : s?.lookupKey ?? null,
    characterNameZh: characterName,
    tier: special ? 'support' : look.tier,
    rules: {kind: move.kind, subKind: move.kind === 1 ? move.field0C : null, power: move.power, actionCost: move.actionCost,
      field4C: move.field4C, elementSelect: move.elementSelect, targetMode: move.targetMode, statusCode: move.statusCode},
    effectFields: banks.map(b => `${b.role}=${b.bankId}:${b.family}#${b.sequence}`),
    recipe: main ? {bankId: main.bankId, family: main.family, sequence: main.sequence, form: look.form,
      colour: look.palette, colourBasis: BATTLE_FX_ELEMENT_PALETTE[move.elementSelect] !== 'neutral' ? 'ELEMENT_SELECTOR_INFERENCE' : 'FAMILY_NAME',
      ownerVfxTitles: [...new Set(banks.map(b => recipeTitle.get(`${b.bankId}:${b.sequence}`)).filter(Boolean))]} : null,
    approvedName: special ? {zh: SPECIAL['zh-Hant'][move.recordIndex], en: SPECIAL.en[move.recordIndex], ja: SPECIAL.ja[move.recordIndex],
      th: SPECIAL.th[move.recordIndex], vi: SPECIAL.vi[move.recordIndex]} : null,
    candidate: null,
    status: reserved ? 'RESERVED' : special ? 'APPROVED_EXISTING' : null,
    _look: look, _banks: banks
  });
}
// Candidates: the batch first, then the rule; names are unique across the roster.
const taken = new Map();
for (const row of rows) if (row.approvedName) taken.set(row.approvedName.zh, row.moveId);
for (const row of rows.filter(r => r.owner === 'SPECIES')) {
  const hand = REVIEW_BATCH[row.moveId];
  if (!hand) continue;
  if (taken.has(hand[0])) throw new Error(`REVIEW_BATCH_DUPLICATE ${hand[0]}`);
  taken.set(hand[0], row.moveId);
  row.candidate = {zh: hand[0], en: hand[1], basis: hand[2]};
  row.status = 'CANDIDATE_REVIEW_BATCH';
}
for (const row of rows.filter(r => r.owner === 'SPECIES' && !r.candidate)) {
  const fullName = row.characterNameZh ?? `#${row.speciesId}`;
  let name = ruleName(row, row._look, row._banks, [...fullName].slice(0, 2).join(''));
  if (taken.has(name)) name = ruleName(row, row._look, row._banks, [...fullName].slice(0, 3).join(''));
  for (let n = 2; taken.has(name); n++) name = `${name.replace(/[二三四五六七八九]$/, '')}${'二三四五六七八九'[n - 2]}`;
  taken.set(name, row.moveId);
  row.candidate = {zh: name, en: null, basis: `${row.tier === 'basic' ? '基本攻擊' : row.tier === 'ultimate' ? '絕招' : '技能'}；`
    + `${row._look.form}／${row._look.palette}；威力 ${row.rules.power}、消耗 ${row.rules.actionCost}`
    + (row.rules.statusCode ? `、狀態碼 ${row.rules.statusCode}` : '') + (row.rules.targetMode === 2 ? '、多目標' : '')};
  row.status = 'CANDIDATE_RULE';
}
for (const row of rows) {
  if (row.recipe) row.recipe.sharedBySpecies = recipeSpecies.get(`${row.recipe.bankId}:${row.recipe.sequence}`)?.size ?? 0;
  delete row._look; delete row._banks;
}

// Character names whose in-game display differs from the OC name table are
// listed for the Owner; the game names are used here.
const counts = rows.reduce((a, r) => (a[r.status] = (a[r.status] ?? 0) + 1, a), {});
const document = {schemaVersion: 1, generatedBy: 'scripts/build-battle-move-name-candidates.mjs', ownerDirection: '2026-10-12',
  status: 'CANDIDATES_PENDING_OWNER_REVIEW', runtimeUse: 'NONE_UNTIL_APPROVED_INTO_BATTLE_FX_MOVE_NAMES', counts, rows};
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, 'MOVE_NAME_CANDIDATES.v1.json'), JSON.stringify(document, null, 1) + '\n');
const csvCell = v => { const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' | ') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const header = ['moveId', 'status', 'owner', 'characterNameZh', 'entityId', 'tier', 'candidateZh', 'candidateEn', 'approvedZh', 'approvedEn',
  'power', 'actionCost', 'elementSelect', 'targetMode', 'statusCode', 'recipeForm', 'recipeColour', 'recipeBank', 'recipeSharedBySpecies', 'ownerVfxTitles', 'basis'];
const lines = rows.map(r => [r.moveId, r.status, r.owner, r.characterNameZh, r.entityId, r.tier, r.candidate?.zh, r.candidate?.en,
  r.approvedName?.zh, r.approvedName?.en, r.rules.power, r.rules.actionCost, r.rules.elementSelect, r.rules.targetMode, r.rules.statusCode,
  r.recipe?.form, r.recipe?.colour, r.recipe ? `${r.recipe.bankId}:${r.recipe.family}#${r.recipe.sequence}` : '', r.recipe?.sharedBySpecies,
  r.recipe?.ownerVfxTitles, r.candidate?.basis].map(csvCell).join(','));
fs.writeFileSync(path.join(OUT, 'MOVE_NAME_CANDIDATES.v1.csv'), '﻿' + [header.join(','), ...lines].join('\n') + '\n');
console.log(JSON.stringify({counts, unique: taken.size}));
